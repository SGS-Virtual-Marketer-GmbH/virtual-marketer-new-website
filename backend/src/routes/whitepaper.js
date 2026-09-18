'use strict';

/**
 * Gated whitepaper downloads: same double opt-in shape as contact.js, plus
 * a `slug` naming which asset to deliver, plus a `locale` axis so a DE
 * requester and an EN requester each get their own single-language PDF
 * (see scripts/generate-lead-magnet-pages.js's header comment, "TWO PDFs,
 * NOT ONE" — the previous version of this route had no locale axis at all
 * and the generator compensated by bolting both languages into one file).
 *
 * The slug is checked against a closed vocabulary (KNOWN_SLUGS below),
 * never used to build an arbitrary URL — the whole point of an allowlist
 * here is that this endpoint can never be made to email a link to
 * something that isn't a real, known whitepaper. The actual slug -> file
 * mapping is resolved through a committed manifest (see "MANIFEST
 * RESOLUTION" below), never hardcoded here, because the real filename is
 * content-hashed (unguessable, un-indexable) and changes whenever the
 * whitepaper's content changes — see generate-lead-magnet-pages.js for the
 * full gating rationale (defect 1: an unguessable path plus robots.txt/
 * nginx noindex is what stops the PDF from being reached or ranked
 * outside the confirmed-email flow).
 *
 * MANIFEST RESOLUTION
 *
 * backend/Dockerfile only ever COPYs backend/src (+ package.json) into the
 * api image — deploy-service.yaml runs `web` (this static site, which owns
 * dist/) and `api` (this service) as two independent sidecar containers,
 * so this process can never read dist/downloads/ directly, no shared
 * volume, no network hop to the sibling container either. The manifest
 * generate-lead-magnet-pages.js writes at build time is therefore
 * committed as a plain source file under backend/src/generated/ — see
 * that script's own header comment for why that beats a build-arg/env-var
 * approach — and `require()`d here like any other module.
 *
 * A missing or malformed manifest must never crash this service (booking,
 * contact and newsletter share this same Express app) — see the
 * require()/resolveAsset() pair below, which degrade to a clear 503
 * instead, and are exercised directly by
 * backend/test/whitepaper-manifest-failsafe.test.js.
 *
 * A separate, explicit "also subscribe to the newsletter" checkbox records
 * its own consent (own version string, own timestamp) and — once the
 * whitepaper request itself is confirmed — activates a real newsletter
 * subscription via newsletter.upsertConfirmed. It deliberately does not
 * send a second confirmation email of its own: the whitepaper link click
 * already proved the address, and asking someone to confirm the same
 * mailbox twice for two checkboxes ticked in the same form is friction
 * without a compliance benefit. Bundling the two consents into one
 * checkbox, however, would not be lawful under GDPR — hence they stay two
 * separate fields, recorded separately, from the very first request.
 */

const express = require('express');
const { whitepaper, newsletter } = require('../db');
const config = require('../config');
const tokens = require('../tokens');
const mailer = require('../mailer');
const { copy, confirmPageHtml } = require('../emails');
const { isValidEmail, normalizeEmail, cleanLocale, isTrue, honeypotTriggered } = require('../validate');
const { submitLimiter, confirmLimiter } = require('../rateLimit');
const { WHITEPAPER_CONSENT_VERSION, NEWSLETTER_CONSENT_VERSION } = require('../consent');

const router = express.Router();

/**
 * Closed vocabulary of known whitepaper slugs — see the "Primary
 * Recommendation" whitepaper in the content/SEO research (07-content.md):
 * "Agentic Marketing in 2026". Add new entries here as new whitepapers
 * ship; never accept a path from the request itself. This is deliberately
 * separate from the manifest (below): a slug can be "known" to the
 * product (a real whitepaper this route is meant to serve) while
 * temporarily unresolvable (the manifest failed to load, or this build's
 * manifest doesn't have this slug yet) — those are different failure
 * modes and get different responses (400 vs 503, see the POST handler).
 */
const KNOWN_SLUGS = ['agentic-marketing-2026'];

/**
 * Loaded once at require-time, not per-request — this route is a thin,
 * frequently-hit endpoint and the manifest only ever changes on a new
 * deploy (a fresh `require()` of the whole process). A failure here is
 * logged loudly and leaves `manifest` null; every caller below treats
 * null exactly like "slug not found", never throws.
 */
let manifest = null;
try {
  // eslint-disable-next-line global-require
  manifest = require('../generated/whitepaper-manifest.json');
} catch (err) {
  console.error(
    `[whitepaper] Could not load backend/src/generated/whitepaper-manifest.json (${err.message}). ` +
      'Whitepaper downloads will fail safe (503) until the next build regenerates it — see ' +
      'scripts/generate-lead-magnet-pages.js.'
  );
}

/**
 * Resolves a manifest entry for slug+locale. Falls back to the German
 * edition when the given locale isn't in the manifest (a "sensible
 * default when absent" — cleanLocale() upstream already normalizes any
 * unrecognized value to 'de', so in practice this fallback only matters
 * if a manifest is ever published with just one locale). Returns null
 * (never throws) if the manifest didn't load, the slug is unknown to it,
 * or neither locale entry exists.
 */
function resolveAsset(slug, locale) {
  if (!manifest) return null;
  const entry = manifest[slug];
  if (!entry) return null;
  return entry[locale] || entry.de || null;
}

router.post('/', submitLimiter, express.json({ limit: '10kb' }), async (req, res, next) => {
  try {
    const body = req.body || {};

    if (honeypotTriggered(body.website)) {
      return res.status(202).json({ status: 'pending' });
    }

    const email = isValidEmail(body.email) ? normalizeEmail(body.email) : null;
    const locale = cleanLocale(body.locale);
    const slug = KNOWN_SLUGS.includes(body.slug) ? body.slug : null;
    const consentGiven = isTrue(body.consent);
    const newsletterOptIn = isTrue(body.newsletterOptIn);

    if (!email || !slug) {
      return res.status(400).json({ error: 'invalid_input', message: 'email and a known whitepaper slug are required.' });
    }
    if (!consentGiven) {
      return res.status(400).json({ error: 'consent_required', message: 'Consent to the privacy policy is required to receive the whitepaper.' });
    }

    // Fail safe BEFORE touching Firestore or sending any mail: a manifest
    // that failed to load, or that doesn't (yet) have this slug/locale,
    // must not create a pending request nobody can ever confirm into a
    // working download. Checked ahead of the rate-limit read below on
    // purpose, so this path also never depends on Firestore being up.
    if (!resolveAsset(slug, locale)) {
      console.error(`[whitepaper] No resolvable asset for slug="${slug}" locale="${locale}" — manifest ${manifest ? 'loaded but missing this entry' : 'failed to load'}.`);
      return res.status(503).json({ error: 'whitepaper_unavailable', message: 'This whitepaper is temporarily unavailable. Please try again later.' });
    }

    const dayAgo = new Date(Date.now() - 24 * 3600000).toISOString();
    if ((await whitepaper.countRecentByEmail(email, dayAgo)) >= 5) {
      return res.status(429).json({ error: 'too_many_requests', message: 'Too many whitepaper requests for this email address in the last 24 hours.' });
    }

    const nowIso = new Date().toISOString();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
    const { raw, hash, expiresAt } = tokens.generateToken();

    const id = await whitepaper.create({
      email,
      locale,
      slug,
      confirm_token_hash: hash,
      confirm_token_expires_at: expiresAt,
      ip: req.ip,
      user_agent: userAgent,
      consent_version: WHITEPAPER_CONSENT_VERSION,
      consent_timestamp: nowIso,
      newsletter_opt_in: newsletterOptIn,
      // Recorded now, at the moment the checkbox was ticked — not
      // backfilled with the (later) confirmation timestamp, which would
      // misstate when consent was actually given.
      newsletter_consent_version: newsletterOptIn ? NEWSLETTER_CONSENT_VERSION : null,
      newsletter_consent_timestamp: newsletterOptIn ? nowIso : null,
    });

    const confirmUrl = `${config.publicBaseUrl}/api/whitepaper/confirm?id=${id}&token=${raw}`;
    const c = copy(locale);

    await Promise.allSettled([
      mailer.send({ to: config.notifyTo, subject: `[Whitepaper] ${slug}`, text: c.whitepaperInternalPending({ email, slug, newsletterOptIn }) }),
      mailer.send({ to: email, subject: c.whitepaperSubjectPending, text: c.whitepaperCustomerPending({ confirmUrl }) }),
    ]);

    res.status(201).json({ id, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

router.get('/confirm', confirmLimiter, async (req, res, next) => {
  try {
    const id = String(req.query.id || '');
    const token = String(req.query.token || '');
    const record = id ? await whitepaper.getById(id) : null;

    const fail = () =>
      res.status(400).send(confirmPageHtml({ locale: record ? record.locale : 'de', ok: false, homeHref: config.publicBaseUrl }));

    if (!record || record.status !== 'pending') return fail();
    if (tokens.isExpired(record.confirm_token_expires_at)) return fail();
    if (!tokens.verifyToken(token, record.confirm_token_hash)) return fail();

    // Resolved by the requester's own locale (recorded at submit time),
    // not the confirm-time request — see resolveAsset()/the module header
    // comment. Same fail-safe page as an expired/invalid token if the
    // manifest is missing or was changed to no longer cover this
    // slug/locale between the request and the confirm click.
    const asset = resolveAsset(record.slug, record.locale);
    if (!asset) return fail();

    const downloadUrl = `${config.publicBaseUrl}${asset.path}`;
    const c = copy(record.locale);

    // BEFORE the token is spent, deliberately.
    //
    // This used to run after whitepaper.confirm(). If upsertConfirmed threw
    // — a Firestore blip, a contended transaction — the request 500'd with
    // the record already flipped to 'confirmed', so the download mail was
    // never sent AND re-clicking the link failed the `status !== 'pending'`
    // check. The whitepaper became permanently unreachable for that
    // request, with no way back except an operator editing the record.
    //
    // Running it first inverts the failure: the token is still unspent, so
    // the user simply clicks the link again and the whole thing retries.
    // upsertConfirmed is idempotent (it reuses any existing subscription
    // for the address), so a retry cannot produce a second subscription.
    let unsubscribeUrl = null;
    if (record.newsletter_opt_in) {
      const subscriptionId = await newsletter.upsertConfirmed({
        email: record.email,
        locale: record.locale,
        ip: record.ip,
        userAgent: record.user_agent,
        consentVersion: record.newsletter_consent_version,
        consentTimestamp: record.newsletter_consent_timestamp,
        source: 'whitepaper',
      });
      unsubscribeUrl = `${config.publicBaseUrl}/api/newsletter/unsubscribe?id=${subscriptionId}&token=${tokens.unsubscribeToken(subscriptionId)}`;
    }

    const changed = await whitepaper.confirm(id, new Date().toISOString());
    if (!changed) return fail();

    const newsletterNote = unsubscribeUrl ? c.whitepaperNewsletterNote({ unsubscribeUrl }) : '';

    Promise.allSettled([
      mailer.send({ to: config.notifyTo, subject: `[Whitepaper confirmed] ${record.slug}`, text: c.whitepaperInternalConfirmed({ email: record.email, slug: record.slug }) }),
      mailer.send({
        to: record.email,
        subject: c.whitepaperSubjectConfirmed,
        text: c.whitepaperCustomerConfirmed({ downloadUrl, newsletterNote }),
        ...(unsubscribeUrl
          ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
          : {}),
      }),
    ]);

    res.send(
      confirmPageHtml({
        locale: record.locale,
        ok: true,
        homeHref: config.publicBaseUrl,
        extraHtml: `<a class="btn" href="${downloadUrl}">${c.whitepaperDownloadButtonLabel}</a>`,
      })
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
