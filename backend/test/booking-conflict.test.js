'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolated on-disk DB per test run (better-sqlite3 needs a real file for
// this test, not ':memory:' — an in-memory DB is private to one connection,
// but the point here is to prove the app's actual single-connection,
// single-process concurrency story, which ':memory:' would trivially "pass"
// for the wrong reason).
const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vm-api-test-')), 'test.sqlite3');
process.env.DB_PATH = dbPath;
process.env.PUBLIC_BASE_URL = 'http://localhost:0';
// This file's tests all share one Express app instance (and therefore one
// in-memory rate-limit store) across all `test()` blocks below, since
// they're one process. Raised well above what this file actually sends so
// the concurrency stress test proves the SQL-level double-booking guard,
// not the (separately, deliberately tight) production rate limit.
process.env.RATE_LIMIT_SUBMIT = '1000';
require('./env');

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

test('concurrent booking requests for the same slot: exactly one succeeds', async (t) => {
  const server = await listen();
  t.after(() => server.close());

  const [slot] = slots.slotsForDate('2026-09-08'); // a Tuesday, far in the future
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
  const server = await listen();
  t.after(() => server.close());

  const [, secondSlot] = slots.slotsForDate('2026-09-09'); // different date than the concurrency test, avoids cross-test interference
  const slotStart = secondSlot.toISOString();

  const first = await post(server, '/bookings', { name: 'First', email: 'first@example.com', slotStart });
  assert.equal(first.status, 201);

  const second = await post(server, '/bookings', { name: 'Second', email: 'second@example.com', slotStart });
  assert.equal(second.status, 409);
});

test('booking rejects a slot outside business hours even with a well-formed request', async (t) => {
  const server = await listen();
  t.after(() => server.close());

  const res = await post(server, '/bookings', {
    name: 'Off Hours', email: 'offhours@example.com', slotStart: '2026-09-08T05:00:00.000Z', // ~7am Berlin, before the window
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_slot');
});
