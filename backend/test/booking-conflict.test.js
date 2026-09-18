'use strict';

// Runs against real Firestore in an isolated, throwaway collection namespace
// (see test/firestore-env.js), not against a stub. The whole point of this
// file is the double-booking guard, which now lives in Firestore's
// runTransaction contention/retry behaviour (see src/db.js) rather than in
// better-sqlite3's synchronous single connection — a hand-rolled in-memory
// fake would pass these assertions without exercising any of that.
process.env.PUBLIC_BASE_URL = 'http://localhost:0';
// This file's tests all share one Express app instance (and therefore one
// in-memory rate-limit store) across all `test()` blocks below, since
// they're one process. Raised well above what this file actually sends so
// the concurrency stress test proves the transactional double-booking
// guard, not the (separately, deliberately tight) production rate limit.
process.env.RATE_LIMIT_SUBMIT = '1000';

const { firestoreAvailable, cleanup } = require('./firestore-env');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const slots = require('../src/slots');

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

// `slots.isValidSlotStart` rejects anything not strictly in the future, so a
// hardcoded calendar date bit-rots the moment the wall clock passes it (this
// suite's original 2026-09-08/09 literals broke exactly that way once "now"
// caught up to them). Picking a weekday well ahead of whenever the suite
// actually runs keeps it valid indefinitely instead of just "at the time it
// was written".
function futureWeekdayDateStr(minDaysAhead) {
  let d = new Date(Date.now() + minDaysAhead * 86400000);
  for (let i = 0; i < 14; i++) {
    const parts = slots.berlinParts(d);
    const weekdayIdx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
    if (weekdayIdx >= 1 && weekdayIdx <= 5) {
      return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    }
    d = new Date(d.getTime() + 86400000);
  }
  throw new Error('futureWeekdayDateStr: no weekday found in range');
}

function post(server, path, body) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Resolved lazily on first use: `await` is not available at module scope in
// CommonJS, and node:test has no async gate that runs before test discovery.
let available = null;
async function ready(t) {
  if (available === null) available = await firestoreAvailable();
  if (!available) t.skip('Firestore unavailable — see test/firestore-env.js');
  return available;
}

test.after(async () => {
  if (available) await cleanup();
});

test('concurrent booking requests for the same slot: exactly one succeeds', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const [slot] = slots.slotsForDate(futureWeekdayDateStr(60)); // a weekday, well in the future
  const slotStart = slot.toISOString();

  const N = 10;
  const requests = Array.from({ length: N }, (_, i) =>
    post(server, '/bookings', { name: `Racer ${i}`, email: `racer${i}@example.com`, slotStart })
  );
  const results = await Promise.all(requests);

  const created = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);

  assert.equal(created.length, 1, `expected exactly 1 of ${N} concurrent requests to win the slot, got ${created.length}`);
  assert.equal(conflicts.length, N - 1, `expected the other ${N - 1} to be rejected with 409, got ${conflicts.length}`);
  conflicts.forEach((r) => assert.equal(r.body.error, 'slot_taken'));
});

test('a slot rejected once as taken stays taken for a later, non-concurrent request', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const [, secondSlot] = slots.slotsForDate(futureWeekdayDateStr(67)); // different date than the concurrency test, avoids cross-test interference
  const slotStart = secondSlot.toISOString();

  const first = await post(server, '/bookings', { name: 'First', email: 'first@example.com', slotStart });
  assert.equal(first.status, 201);

  const second = await post(server, '/bookings', { name: 'Second', email: 'second@example.com', slotStart });
  assert.equal(second.status, 409);
});

test('booking rejects a slot outside business hours even with a well-formed request', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  // A future date is required here specifically so this asserts the
  // business-hours check, not the (separate) in-the-past check — a stale
  // past date would return the same 400/invalid_slot for the wrong reason
  // and this test would stay green even if the business-hours logic broke.
  const [y, m, d] = futureWeekdayDateStr(75).split('-');
  const offHoursIso = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 5, 0, 0)).toISOString(); // ~7am Berlin, before the window

  const res = await post(server, '/bookings', {
    name: 'Off Hours', email: 'offhours@example.com', slotStart: offHoursIso,
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_slot');
});
