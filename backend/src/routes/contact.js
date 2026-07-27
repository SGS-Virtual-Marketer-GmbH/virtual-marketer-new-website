'use strict';

const express = require('express');
const db = require('../db');
const config = require('../config');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const { isValidEmail, cleanString, cleanLocale } = require('../validate');
const { submitLimiter, confirmLimiter } = require('../rateLimit');

const router = express.Router();

const insertContact = db.prepare(`
  INSERT INTO contact_submissions (name, email, message, locale, status, confirm_token_hash, confirm_token_expires_at, ip)
  VALUES (@name, @email, @message, @locale, 'pending', @confirm_token_hash, @confirm_token_expires_at, @ip)
`);

const recentSubmissionsByEmail = db.prepare(`
  SELECT COUNT(*) AS n FROM contact_submissions WHERE email = ? AND created_at > ?
`);

router.post('/', submitLimiter, express.json({ limit: '10kb' }), async (req, res) => {
  const body = req.body || {};
  const name = cleanString(body.name, { max: 200 });
  const email = isValidEmail(body.email) ? body.email.trim() : null;
  const message = cleanString(body.message, { max: 4000 });
  const locale = cleanLocale(body.locale);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'invalid_input', message: 'name, email and message are required.' });
  }

  const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
  if (recentSubmissionsByEmail.get(email, dayAgo).n >= 5) {
    return res.status(429).json({ error: 'too_many_requests', message: 'Too many contact requests for this email address in the last 24 hours.' });
  }

  const { raw, hash, expiresAt } = tokens.generateToken();
  const info = insertContact.run({
    name, email, message, locale,
    confirm_token_hash: hash,
    confirm_token_expires_at: expiresAt,
    ip: req.ip,
  });
  const id = info.lastInsertRowid;

  const confirmUrl = `${config.publicBaseUrl}/api/contact/confirm?id=${id}&token=${raw}`;
  const c = copy(locale);

  await Promise.allSettled([
    mailer.send({ to: config.notifyTo, subject: `[Contact] ${c.contactSubjectPending}`, text: c.contactInternalPending({ name, email, message }) }),
    mailer.send({ to: email, subject: c.contactSubjectPending, text: c.contactCustomerPending({ name, confirmUrl }) }),
  ]);

  res.status(201).json({ id, status: 'pending' });
});

const getContact = db.prepare('SELECT * FROM contact_submissions WHERE id = ?');
const confirmContact = db.prepare(`
  UPDATE contact_submissions SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND status = 'pending'
`);

router.get('/confirm', confirmLimiter, (req, res) => {
  const id = parseInt(req.query.id, 10);
  const token = String(req.query.token || '');
  const submission = Number.isInteger(id) ? getContact.get(id) : null;

  const fail = () => res.status(400).send(confirmPageHtml({ locale: submission ? submission.locale : 'de', ok: false, homeHref: config.publicBaseUrl }));

  if (!submission || submission.status !== 'pending') return fail();
  if (tokens.isExpired(submission.confirm_token_expires_at)) return fail();
  if (!tokens.verifyToken(token, submission.confirm_token_hash)) return fail();

  const now = new Date().toISOString();
  const changed = confirmContact.run(now, id);
  if (changed.changes !== 1) return fail();

  const c = copy(submission.locale);
  Promise.allSettled([
    mailer.send({ to: config.notifyTo, subject: `[Contact confirmed] ${c.contactSubjectConfirmed}`, text: c.contactInternalConfirmed({ name: submission.name, email: submission.email, message: submission.message }) }),
    mailer.send({ to: submission.email, subject: c.contactSubjectConfirmed, text: c.contactCustomerConfirmed({ name: submission.name }) }),
  ]);

  res.send(confirmPageHtml({ locale: submission.locale, ok: true, homeHref: config.publicBaseUrl }));
});

module.exports = router;
