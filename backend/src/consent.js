'use strict';

/**
 * Single source of truth for the exact consent-wording versions this API
 * records. German newsletter law (§7 UWG) and the GDPR both put the burden
 * of proof on the operator to show consent existed and what it covered — a
 * version string frozen at the moment of signup is what makes that provable
 * later, but only if every place that checks a box for the same wording
 * references the same constant. The newsletter route and the whitepaper
 * route's separate "also subscribe" checkbox both grant consent to the same
 * newsletter, so they must record the same version here rather than two
 * copies of a string that could drift apart.
 *
 * Bump these (with a new suffix, e.g. `-v2`) whenever the checkbox wording
 * on the site changes, and keep the old value around in comments/history —
 * never edit a version string in place, since that would silently rewrite
 * what past consent records are proof of.
 */
module.exports = {
  NEWSLETTER_CONSENT_VERSION: '2026-09-15-newsletter-v1',
  WHITEPAPER_CONSENT_VERSION: '2026-09-15-whitepaper-v1',
  // The contact form's own checkbox. Narrower than the newsletter one — it
  // covers processing the enquiry to answer it, nothing else — so it is a
  // separate version string and must never be conflated with the two above.
  CONTACT_CONSENT_VERSION: '2026-09-17-contact-v1',
};
