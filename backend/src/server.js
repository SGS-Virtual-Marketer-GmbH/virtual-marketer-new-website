'use strict';

const config = require('./config');
const { bookings, contacts, modelRequests, newsletter, whitepaper } = require('./db');
const app = require('./app');

app.listen(config.port, () => {
  console.log(`[server] virtual-marketer-api listening on :${config.port}`);
});

// Housekeeping only — the actual double-booking guard (src/db.js's
// blocksSlot) already treats expired-pending documents as free without
// needing this sweep to have run. This just keeps `status` accurate for
// anyone inspecting the collections directly.
//
// Errors are caught rather than left to reject: an unhandled rejection from
// a background timer would take the whole process down, and a failed tidy-up
// is not worth dropping live requests over.
async function sweepExpired() {
  const now = new Date().toISOString();
  try {
    const [b, c, m, n, w] = await Promise.all([
      bookings.sweepExpired(now),
      contacts.sweepExpired(now),
      modelRequests.sweepExpired(now),
      newsletter.sweepExpired(now),
      whitepaper.sweepExpired(now),
    ]);
    if (b || c || m || n || w) {
      console.log(
        `[server] swept ${b} expired booking(s), ${c} expired contact submission(s), ${m} expired model request(s), ${n} expired newsletter signup(s), ${w} expired whitepaper request(s)`
      );
    }
  } catch (err) {
    console.error('[server] expiry sweep failed:', err.message);
  }
}

setInterval(sweepExpired, 15 * 60 * 1000).unref();
sweepExpired();
