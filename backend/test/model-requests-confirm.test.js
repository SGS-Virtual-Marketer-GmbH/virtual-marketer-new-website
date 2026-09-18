'use strict';

/**
 * Regression test for the confirmed live bug in routes/model-requests.js:
 * GET /api/model-requests/confirm called tokens.isFresh() and
 * tokens.matches(), neither of which exists on src/tokens.js (which only
 * exports generateToken/verifyToken/isExpired) — every confirmation click
 * threw a TypeError, so no model request could ever be confirmed in
 * production. Fixed to `!tokens.isExpired(...)` and `tokens.verifyToken(...)`.
 *
 * The two cases here specifically guard the semantic inversion risk called
 * out in the fix: isFresh(x) would have meant !isExpired(x), so getting the
 * negation wrong the other way (using isExpired(x) directly, un-negated)
 * would silently flip the check to accept only *expired* tokens and reject
 * valid ones — or worse, drop the negation entirely and accept expired
 * tokens as valid. Both directions are covered below.
 */

process.env.PUBLIC_BASE_URL = 'http://localhost:0';

const { firestoreAvailable, cleanup } = require('./firestore-env');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const mailer = require('../src/mailer');
mailer.send = async () => ({});

const app = require('../src/app');
const { modelRequests } = require('../src/db');
const tokens = require('../src/tokens');

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function get(server, path) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      })
      .on('error', reject);
  });
}

function baseRow(overrides) {
  return {
    email: `mr-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    customer_type: 'new',
    request_type: 'new_model',
    domain: 'example.com',
    details: { language: 'DE', name: 'Test Model', exampleInput: 'in', exampleOutput: 'out', outputFormat: 'plain' },
    locale: 'de',
    ip: '127.0.0.1',
    ...overrides,
  };
}

let available = null;
async function ready(t) {
  if (available === null) available = await firestoreAvailable();
  if (!available) t.skip('Firestore unavailable — see test/firestore-env.js');
  return available;
}

test.after(async () => {
  if (available) await cleanup();
});

test('model-requests confirm: a valid, unexpired token confirms the request (the route must not throw)', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const { raw, hash, expiresAt } = tokens.generateToken();
  const id = await modelRequests.create(baseRow({ confirm_token_hash: hash, confirm_token_expires_at: expiresAt }));

  const res = await get(server, `/model-requests/confirm?id=${id}&token=${raw}`);
  assert.equal(res.status, 200, `expected the confirm route to succeed, got ${res.status}: ${res.body}`);

  const record = await modelRequests.getById(id);
  assert.equal(record.status, 'confirmed');
  assert.ok(record.confirmed_at);
});

test('model-requests confirm: an expired token is rejected, not confirmed', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const { raw, hash } = tokens.generateToken();
  const id = await modelRequests.create(
    baseRow({ confirm_token_hash: hash, confirm_token_expires_at: new Date(Date.now() - 1000).toISOString() })
  );

  const res = await get(server, `/model-requests/confirm?id=${id}&token=${raw}`);
  assert.equal(res.status, 400);

  const record = await modelRequests.getById(id);
  assert.equal(record.status, 'pending', 'an expired token must never confirm the request');
});

test('model-requests confirm: a wrong token against a valid, unexpired record is rejected', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const { hash, expiresAt } = tokens.generateToken();
  const { raw: wrongRaw } = tokens.generateToken();
  const id = await modelRequests.create(baseRow({ confirm_token_hash: hash, confirm_token_expires_at: expiresAt }));

  const res = await get(server, `/model-requests/confirm?id=${id}&token=${wrongRaw}`);
  assert.equal(res.status, 400);

  const record = await modelRequests.getById(id);
  assert.equal(record.status, 'pending');
});
