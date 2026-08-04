'use strict';

const express = require('express');
const { contacts } = require('../db');
const config = require('../config');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const { isValidEmail, normalizeEmail, cleanString, cleanLocale } = require('../validate');
const { submitLimiter, confirmLimiter } = require('../rateLimit');

const router = express.Router();

router.post('/', submitLimiter, express.json({ limit: '10kb' }), async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = cleanString(body.name, { max: 200 });
    const email = isValidEmail(body.email) ? normalizeEmail(body.email) : null;
    const message = cleanString(body.message, { max: 4000 });
    const locale = cleanLocale(body.locale);

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'invalid_input', message: 'name, email and message are required.' });
    }

    const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
    if ((await contacts.countRecentByEmail(email, dayAgo)) >= 5) {
      return res.status(429).json({ error: 'too_many_requests', message: 'Too many contact requests for this email address in the last 24 hours.' });
    }

    const { raw, hash, expiresAt } = tokens.generateToken();
    const id = await contacts.create({
      name,
      email,
      message,
      locale,
      confirm_token_hash: hash,
      confirm_token_expires_at: expiresAt,
      ip: req.ip,
    });

    const confirmUrl = `${config.publicBaseUrl}/api/contact/confirm?id=${id}&token=${raw}`;
    const c = copy(locale);

    await Promise.allSettled([
      mailer.send({ to: config.notifyTo, subject: `[Contact] ${c.contactSubjectPending}`, text: c.contactInternalPending({ name, email, message }) }),
      mailer.send({ to: email, subject: c.contactSubjectPending, text: c.contactCustomerPending({ name, confirmUrl }) }),
    ]);

    res.status(201).json({ id, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

// `id` is a Firestore document id (an opaque string) rather than the SQLite
// autoincrement integer it used to be, so there is no parseInt guard here any
// more — an unknown id reads back as null and takes the same failure path as
// a wrong token.
router.get('/confirm', confirmLimiter, async (req, res, next) => {
  try {
    const id = String(req.query.id || '');
    const token = String(req.query.token || '');
    const submission = id ? await contacts.getById(id) : null;

    const fail = () =>
      res.status(400).send(
        confirmPageHtml({ locale: submission ? submission.locale : 'de', ok: false, homeHref: config.publicBaseUrl })
      );

    if (!submission || submission.status !== 'pending') return fail();
    if (tokens.isExpired(submission.confirm_token_expires_at)) return fail();
    if (!tokens.verifyToken(token, submission.confirm_token_hash)) return fail();

    // Transactional, so a double-clicked confirmation link produces exactly
    // one state change and one pair of notification emails.
    const changed = await contacts.confirm(id, new Date().toISOString());
    if (!changed) return fail();

    const c = copy(submission.locale);
    Promise.allSettled([
      mailer.send({ to: config.notifyTo, subject: `[Contact confirmed] ${c.contactSubjectConfirmed}`, text: c.contactInternalConfirmed({ name: submission.name, email: submission.email, message: submission.message }) }),
      mailer.send({ to: submission.email, subject: c.contactSubjectConfirmed, text: c.contactCustomerConfirmed({ name: submission.name }) }),
    ]);

    res.send(confirmPageHtml({ locale: submission.locale, ok: true, homeHref: config.publicBaseUrl }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
