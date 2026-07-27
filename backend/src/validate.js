'use strict';

// Deliberately simple, dependency-free validation — this API has few enough
// fields that a small validation library would add more surface area than
// it saves.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(v) {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
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

module.exports = { isValidEmail, cleanString, cleanOptionalString, cleanLocale };
