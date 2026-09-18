'use strict';

// Deliberately simple, dependency-free validation — this API has few enough
// fields that a small validation library would add more surface area than
// it saves.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(v) {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

// Lowercases + trims a validated email before it's stored or used as a
// flood-guard lookup key. RFC 5321 technically allows a case-sensitive
// local part, but essentially no real mail provider treats it that way —
// and skipping this normalization let the same-email 24h submission cap
// (routes/bookings.js, routes/contact.js) be trivially bypassed by
// re-casing the address (Victim@x.com vs victim@x.com counted as two
// different people). Does not touch the `+tag` local-part convention —
// that bypass is closed by the per-IP limiter instead (see rateLimit.js),
// since legitimate users do rely on +tags.
function normalizeEmail(v) {
  return v.trim().toLowerCase();
}

// Trims and length-caps a required string field; returns null if invalid.
function cleanString(v, { min = 1, max = 2000 } = {}) {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

// Same, but the field is optional (empty/missing is fine).
function cleanOptionalString(v, { max = 2000 } = {}) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length > max) return null;
  return trimmed;
}

function cleanLocale(v) {
  return v === 'en' ? 'en' : 'de';
}

// Strict boolean check for consent checkboxes. Only the literal `true`
// counts — a client sending the string "true", 1, or "on" does not silently
// satisfy a check that exists to prove an unambiguous, deliberate tick.
function isTrue(v) {
  return v === true;
}

// Honeypot field: a form field real users never see (hidden via CSS) or
// fill in, but a bot that fills every field on the page does. Any non-empty
// value means the submission is spam.
function honeypotTriggered(v) {
  return typeof v === 'string' && v.trim() !== '';
}

module.exports = { isValidEmail, normalizeEmail, cleanString, cleanOptionalString, cleanLocale, isTrue, honeypotTriggered };
