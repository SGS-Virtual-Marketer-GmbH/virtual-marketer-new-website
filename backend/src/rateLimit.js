'use strict';

const rateLimit = require('express-rate-limit');

// In-memory store — correct for a single API instance (this service isn't
// horizontally scaled). If that ever changes, swap in a shared store (e.g.
// Redis) via express-rate-limit's `store` option.
const commonOpts = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'too_many_requests', message: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut. / Too many requests, please try again later.' });
  },
};

// Limits are env-overridable (falling back to the defaults below) for two
// reasons: it lets ops tune them post-deploy without a code change, and it
// lets the test suite (see test/booking-conflict.test.js) raise the submit
// cap so a concurrency stress test isn't itself rate-limited before it can
// prove anything about the SQL-level double-booking guard.
function intFromEnv(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// Submitting a new booking/contact request triggers an email send to a
// third party (the address in the form) — tight per-IP limit to keep this
// endpoint from being usable as an email-bombing tool.
const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: intFromEnv('RATE_LIMIT_SUBMIT', 5), ...commonOpts });

// Clicking a confirmation link. Tokens are unguessable (256-bit), so this
// is defense in depth rather than the primary protection.
const confirmLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: intFromEnv('RATE_LIMIT_CONFIRM', 20), ...commonOpts });

// Read-only, cheap, but still capped against scraping/DoS.
const availabilityLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: intFromEnv('RATE_LIMIT_AVAILABILITY', 60), ...commonOpts });

module.exports = { submitLimiter, confirmLimiter, availabilityLimiter };
