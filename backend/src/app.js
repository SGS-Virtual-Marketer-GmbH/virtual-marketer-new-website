'use strict';

const express = require('express');
const bookingsRouter = require('./routes/bookings');
const contactRouter = require('./routes/contact');

const app = express();

// This service is only ever reached through nginx, which reverse-proxies
// same-origin /api/* requests — there is no cross-origin caller, so no CORS
// headers are set here at all (same-origin requests don't need them, and
// not setting Access-Control-Allow-Origin is safer than a wildcard).
// Trust exactly ONE hop (nginx), not `true` (trust every hop). `true` lets
// a client set its own X-Forwarded-For and have Express believe it
// verbatim — since nginx's proxy_set_header now overwrites (not appends
// to) X-Forwarded-For with $remote_addr (see docker/nginx.conf), the
// header reaching this service always contains exactly nginx's own view of
// the real client address, and `1` tells Express to trust that one hop and
// nothing an attacker could have prepended. This is what makes the
// per-IP rate limits in rateLimit.js actually hold — with `true` they were
// fully bypassable by sending a fresh X-Forwarded-For value per request.
app.set('trust proxy', 1);

app.use('/bookings', bookingsRouter);
app.use('/contact', contactRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

// Body-parser errors (e.g. malformed JSON) land here rather than crashing
// the process.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json' });
  }
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'internal_error' });
});

module.exports = app;
