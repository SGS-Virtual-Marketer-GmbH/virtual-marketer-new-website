'use strict';

/**
 * Newsletter double opt-in, with one-click unsubscribe (required for
 * marketing mail under §7 UWG / TMG).
 *
 * Lifecycle: pending -> confirmed -> unsubscribed. Unsubscribing never
 * deletes the record — GDPR puts the burden of proving consent existed on
 * the operator, and a deleted row can't be shown to anyone later. The
 * unsubscribe link itself never expires and needs no separate stored
 * token: it's an HMAC of the record id (see src/tokens.js), so it can be
 * regenerated identically at signup time, at confirm time, or from any
 * future weekly issue, without ever persisting the raw value.
 *
 * Re-submitting the same address is idempotent and enumeration-safe: the
 * HTTP response is identical ("check your inbox") whether the address is
 * brand new, already pending, or already confirmed, and at most one
 * document is ever created per address (see db.js's findByEmail /
 * reissueToken).
 */

const express = require('express');
const { newsletter, MAX_CONFIRM_SENDS_PER_DAY } = require('../db');
const config = require('../config');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const { isValidEmail, normalizeEmail, cleanLocale, isTrue, honeypotTriggered } = require('../validate');
const { submitLimiter, confirmLimiter } = require('../rateLimit');
const { NEWSLETTER_CONSENT_VERSION } = require('../consent');

const router = express.Router();

router.post('/', submitLimiter, express.json({ limit: '10kb' }), async (req, res, next) => {
  try {
    const body = req.body || {};

    // Honeypot: a field the real form hides from humans via CSS. A bot
    // that fills in every field trips this. Respond exactly like a real
    // success so the bot gets no signal that it was caught.
    if (honeypotTriggered(body.website)) {
      return res.status(202).json({ status: 'pending' });
    }

    const email = isValidEmail(body.email) ? normalizeEmail(body.email) : null;
    const locale = cleanLocale(body.locale);
    const consentGiven = isTrue(body.consent);

    if (!email) {
      return res.status(400).json({ error: 'invalid_input', message: 'A valid email address is required.' });
    }
    if (!consentGiven) {
      return res.status(400).json({ error: 'consent_required', message: 'Consent to the privacy policy is required to subscribe.' });
    }

    // Idempotency + anti-enumeration: figure out which case this address
    // is in, but never let that difference leak into the response below.
    const existing = await newsletter.findByEmail(email);
    const alreadyConfirmed = existing.find((r) => r.status === 'confirmed');

    if (!alreadyConfirmed) {
      // Per-address flood cap. Counted from the mails this address actually
      // caused, NOT from how many documents exist for it: a repeat signup
      // on a pending record reuses that record (reissueToken), so a
      // document count never rises and the cap never fired. Checked here,
      // after the already-confirmed branch, because that branch sends
      // nothing at all and so cannot be used to flood anyone.
      const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
      if (newsletter.countRecentConfirmSends(existing, dayAgo) >= MAX_CONFIRM_SENDS_PER_DAY) {
        return res.status(429).json({ error: 'too_many_requests', message: 'Too many newsletter signups for this email address in the last 24 hours.' });
      }

      const pending = existing.find((r) => r.status === 'pending');
      const { raw, hash, expiresAt } = tokens.generateToken();
      const nowIso = new Date().toISOString();

      let id;
      if (pending) {
        id = pending.id;
        await newsletter.reissueToken(id, { confirm_token_hash: hash, confirm_token_expires_at: expiresAt }, nowIso);
      } else {
        id = await newsletter.create({
          email,
          locale,
          confirm_token_hash: hash,
          confirm_token_expires_at: expiresAt,
          ip: req.ip,
          user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
          consent_version: NEWSLETTER_CONSENT_VERSION,
          consent_timestamp: nowIso,
          source: 'newsletter',
        });
      }

      const confirmUrl = `${config.publicBaseUrl}/api/newsletter/confirm?id=${id}&token=${raw}`;
      const unsubscribeUrl = `${config.publicBaseUrl}/api/newsletter/unsubscribe?id=${id}&token=${tokens.unsubscribeToken(id)}`;
      const c = copy(locale);

      await Promise.allSettled([
        mailer.send({ to: config.notifyTo, subject: `[Newsletter] ${c.newsletterSubjectPending}`, text: c.newsletterInternalPending({ email }) }),
        mailer.send({
          to: email,
          subject: c.newsletterSubjectPending,
          text: c.newsletterCustomerPending({ confirmUrl, unsubscribeUrl }),
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      ]);
    }
    // If already confirmed: do nothing at all (no mail, no write) — the
    // response below is identical either way.

    res.status(202).json({ status: 'pending' });
  } catch (err) {
    next(err);
  }
});

router.get('/confirm', confirmLimiter, async (req, res, next) => {
  try {
    const id = String(req.query.id || '');
    const token = String(req.query.token || '');
    const record = id ? await newsletter.getById(id) : null;
    const locale = record ? record.locale : 'de';

    const fail = () => res.status(400).send(confirmPageHtml({ locale, ok: false, homeHref: config.publicBaseUrl }));

    if (!record || record.status !== 'pending') return fail();
    if (tokens.isExpired(record.confirm_token_expires_at)) return fail();
    if (!tokens.verifyToken(token, record.confirm_token_hash)) return fail();

    const changed = await newsletter.confirm(id, new Date().toISOString());
    if (!changed) return fail();

    const c = copy(record.locale);
    const unsubscribeUrl = `${config.publicBaseUrl}/api/newsletter/unsubscribe?id=${id}&token=${tokens.unsubscribeToken(id)}`;

    Promise.allSettled([
      mailer.send({ to: config.notifyTo, subject: `[Newsletter confirmed] ${c.newsletterSubjectConfirmed}`, text: c.newsletterInternalConfirmed({ email: record.email }) }),
      mailer.send({
        to: record.email,
        subject: c.newsletterSubjectConfirmed,
        text: c.newsletterCustomerConfirmed({ unsubscribeUrl }),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    ]);

    res.send(confirmPageHtml({ locale: record.locale, ok: true, homeHref: config.publicBaseUrl }));
  } catch (err) {
    next(err);
  }
});

/**
 * Resolves the record an unsubscribe link points at, WITHOUT changing it.
 * Returns null for an unknown id or a token that does not verify.
 */
async function resolveUnsubscribeTarget(req) {
  const id = String(req.query.id || '');
  const token = String(req.query.token || '');
  const record = id ? await newsletter.getById(id) : null;
  if (!record || !tokens.verifyUnsubscribeToken(id, token)) return null;
  return record;
}

/** Escapes a value for an HTML attribute. ids and tokens are already
 *  [A-Za-z0-9_-], but these end up in markup, so they get escaped anyway
 *  rather than relying on that staying true. */
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * GET ONLY ASKS. IT MUST NOT UNSUBSCRIBE ANYONE.
 *
 * This URL is a plain link inside mail we send — including the pending
 * double-opt-in mail, which carries the confirm link right next to it.
 * Mail scanners, "safe link" rewriters, corporate gateways and clients
 * with link previews all fetch the URLs in a message before any human
 * touches them. When GET was the state change, that fetch was enough to:
 *
 *   - flip a brand-new `pending` record straight to `unsubscribed`, so the
 *     human's own confirm click then hit "link invalid" — and signing up
 *     again just repeated the cycle, so the address could never subscribe
 *     at all; and
 *   - silently unsubscribe an already-confirmed subscriber whose client
 *     prefetched the link in any issue they were ever sent.
 *
 * So GET now renders a confirmation page whose button POSTs. RFC 8058
 * one-click is unaffected: that is a POST by definition, and nothing
 * prefetches a POST.
 */
router.get('/unsubscribe', confirmLimiter, async (req, res, next) => {
  try {
    const record = await resolveUnsubscribeTarget(req);
    if (!record) {
      return res.status(400).send(confirmPageHtml({ locale: 'de', ok: false, homeHref: config.publicBaseUrl }));
    }

    const locale = record.locale;
    const c = copy(locale);

    // Already done — say so rather than asking them to confirm again.
    if (record.status === 'unsubscribed') {
      return res.send(
        confirmPageHtml({
          locale,
          ok: true,
          homeHref: config.publicBaseUrl,
          title: c.newsletterUnsubscribedTitle,
          body: c.newsletterUnsubscribedBody,
        })
      );
    }

    const action = `/api/newsletter/unsubscribe?id=${encodeURIComponent(record.id)}&token=${encodeURIComponent(String(req.query.token || ''))}`;
    res.send(
      confirmPageHtml({
        locale,
        ok: true,
        homeHref: config.publicBaseUrl,
        title: c.newsletterUnsubscribeConfirmTitle,
        body: c.newsletterUnsubscribeConfirmBody,
        extraHtml: `<form class="vm-inline" method="post" action="${attr(action)}"><button class="btn" type="submit">${c.newsletterUnsubscribeConfirmButton}</button></form>`,
      })
    );
  } catch (err) {
    next(err);
  }
});

/**
 * The actual unsubscribe. Serves two callers:
 *
 *   - RFC 8058 one-click: mail clients POST here with no user interaction
 *     beyond the click on the mail's unsubscribe control, and expect a
 *     plain 200 with no redirect and no HTML.
 *   - the confirmation page above, submitted by a human in a browser.
 *
 * Told apart by Accept, because only the browser asks for HTML. Both are
 * idempotent: a second submit, or a client retrying, still reports success
 * for what is — from the subscriber's perspective — already done.
 */
router.post('/unsubscribe', confirmLimiter, express.text({ type: '*/*', limit: '2kb' }), async (req, res, next) => {
  try {
    const record = await resolveUnsubscribeTarget(req);
    if (record) await newsletter.unsubscribe(record.id, new Date().toISOString());

    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    if (!wantsHtml) {
      // Invalid/stale links still get a 200 here: an RFC 8058 client has no
      // useful way to act on an error, and a non-200 makes some of them
      // surface a scary failure for an unsubscribe that already happened.
      return res.status(200).end();
    }

    if (!record) {
      return res.status(400).send(confirmPageHtml({ locale: 'de', ok: false, homeHref: config.publicBaseUrl }));
    }
    const c = copy(record.locale);
    res.send(
      confirmPageHtml({
        locale: record.locale,
        ok: true,
        homeHref: config.publicBaseUrl,
        title: c.newsletterUnsubscribedTitle,
        body: c.newsletterUnsubscribedBody,
      })
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
