'use strict';

const config = require('./config');
const db = require('./db');
const app = require('./app');

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
