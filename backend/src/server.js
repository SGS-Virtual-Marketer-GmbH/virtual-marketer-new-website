'use strict';

const express = require('express');
const config = require('./config');
const db = require('./db');
const bookingsRouter = require('./routes/bookings');
const contactRouter = require('./routes/contact');

const app = express();

// This service is only ever reached through nginx, which reverse-proxies
// same-origin /api/* requests — there is no cross-origin caller, so no CORS
// headers are set here at all (same-origin requests don't need them, and
// not setting Access-Control-Allow-Origin is safer than a wildcard).
app.set('trust proxy', true); // nginx sits in front — req.ip must reflect X-Forwarded-For, not the proxy's own address

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

app.listen(config.port, () => {
  console.log(`[server] virtual-marketer-api listening on :${config.port}`);
});

// Housekeeping only — the actual double-booking guard (routes/bookings.js's
// findConflict query) already treats expired-pending rows as free without
// needing this sweep to have run. This just keeps `status` accurate for
// anyone inspecting the DB directly.
function sweepExpired() {
  const now = new Date().toISOString();
  db.prepare(`UPDATE bookings SET status = 'expired' WHERE status = 'pending' AND confirm_token_expires_at < ?`).run(now);
  db.prepare(`UPDATE contact_submissions SET status = 'expired' WHERE status = 'pending' AND confirm_token_expires_at < ?`).run(now);
}
setInterval(sweepExpired, 15 * 60 * 1000).unref();
sweepExpired();
