'use strict';

/**
 * Newsletter double opt-in + one-click unsubscribe, exercised end to end
 * against real Firestore (see test/firestore-env.js — same reasoning as
 * booking-conflict.test.js: a hand-rolled in-memory fake would pass these
 * assertions without exercising the transactional confirm/unsubscribe
 * logic in src/db.js).
 *
 * mailer.send is stubbed rather than left to hit the fake SMTP host from
 * test/env.js: these tests need the actual confirm/unsubscribe URLs the
 * route generated (to click them), and stubbing is simpler and faster than
 * standing up a mail sink to scrape them back out of a real send attempt.
 */

process.env.PUBLIC_BASE_URL = 'http://localhost:0';
process.env.RATE_LIMIT_SUBMIT = '1000';

const { firestoreAvailable, cleanup } = require('./firestore-env');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const mailer = require('../src/mailer');
const sentMails = [];
mailer.send = async (opts) => {
  sentMails.push(opts);
  return {};
};

const app = require('../src/app');
const { newsletter, MAX_CONFIRM_SENDS_PER_DAY } = require('../src/db');

function listen() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function request(server, method, path, body) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {};
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let parsed = raw;
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* HTML confirm pages aren't JSON */
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/** Pulls the confirm/unsubscribe URL out of a stubbed customer-facing mail. */
function urlFrom(text, path) {
  const re = new RegExp(`https?://[^\\s]*${path}\\?[^\\s]*`);
  const m = text.match(re);
  return m ? m[0] : null;
}

// Mail links are built with the public `/api/...` prefix (see
// src/routes/newsletter.js) because that's what a real browser hits — nginx
// strips `/api` before proxying to this service (see docker/nginx.conf).
// These tests talk to the Express app directly, with no nginx in front of
// it, so that prefix has to be stripped here the same way nginx would.
function pathFromMailUrl(url) {
  return url.replace(/^https?:\/\/[^/]*\/api/, '');
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

test('newsletter happy path: POST -> pending, confirm link activates the subscription', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `happy-${Date.now()}@example.com`;
  const signup = await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });
  assert.equal(signup.status, 202);
  assert.equal(signup.body.status, 'pending');

  const customerMail = sentMails.find((m) => m.to === email);
  assert.ok(customerMail, 'a confirmation mail should have been sent to the subscriber');
  const confirmUrl = urlFrom(customerMail.text, '/api/newsletter/confirm');
  assert.ok(confirmUrl, 'mail body should contain a confirm link');
  assert.match(customerMail.headers['List-Unsubscribe'], /^<http/);
  assert.equal(customerMail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

  const path = pathFromMailUrl(confirmUrl);
  const confirmRes = await request(server, 'GET', path);
  assert.equal(confirmRes.status, 200);

  const records = await newsletter.findByEmail(email);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'confirmed');
  assert.ok(records[0].confirmed_at);
  assert.equal(records[0].consent_version, '2026-09-15-newsletter-v1');
});

test('newsletter: an expired confirm link is rejected', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const tokens = require('../src/tokens');
  const email = `expired-${Date.now()}@example.com`;
  const { raw, hash } = tokens.generateToken();
  const id = await newsletter.create({
    email,
    locale: 'de',
    confirm_token_hash: hash,
    confirm_token_expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    ip: '127.0.0.1',
    user_agent: 'test',
    consent_version: 'v1',
    consent_timestamp: new Date().toISOString(),
    source: 'newsletter',
  });

  const res = await request(server, 'GET', `/newsletter/confirm?id=${id}&token=${raw}`);
  assert.equal(res.status, 400);

  const record = await newsletter.getById(id);
  assert.equal(record.status, 'pending', 'an expired token must not confirm the record');
});

test('newsletter: re-subscribing an already-confirmed address does not create a duplicate and returns the same response', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `dup-${Date.now()}@example.com`;
  const first = await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });
  assert.equal(first.status, 202);

  const customerMail = sentMails.find((m) => m.to === email);
  const confirmUrl = urlFrom(customerMail.text, '/api/newsletter/confirm');
  const path = pathFromMailUrl(confirmUrl);
  await request(server, 'GET', path);

  sentMails.length = 0;
  const second = await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });
  assert.equal(second.status, 202);
  assert.deepEqual(second.body, first.body, 'response must be identical whether or not the address is already subscribed');
  assert.equal(sentMails.length, 0, 'no mail should be sent for an address that is already confirmed');

  const records = await newsletter.findByEmail(email);
  assert.equal(records.length, 1, 'exactly one document must exist for this address');
  assert.equal(records[0].status, 'confirmed');
});

test('newsletter: unsubscribe link deactivates the subscription and is idempotent on a second click', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `unsub-${Date.now()}@example.com`;
  await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });
  const customerMail = sentMails.find((m) => m.to === email);
  const confirmUrl = urlFrom(customerMail.text, '/api/newsletter/confirm');
  await request(server, 'GET', pathFromMailUrl(confirmUrl));

  const records = await newsletter.findByEmail(email);
  const id = records[0].id;
  const tokens = require('../src/tokens');
  const unsubUrl = `/newsletter/unsubscribe?id=${id}&token=${tokens.unsubscribeToken(id)}`;

  // POST, not GET: GET only renders the confirmation page (see the next
  // test). This is both what the page's own button submits and what an
  // RFC 8058 one-click client sends.
  const firstClick = await request(server, 'POST', unsubUrl);
  assert.equal(firstClick.status, 200);
  const after1 = await newsletter.getById(id);
  assert.equal(after1.status, 'unsubscribed');
  assert.ok(after1.unsubscribed_at);

  // Second click on the same (already-used) link must still succeed, not error.
  const secondClick = await request(server, 'POST', unsubUrl);
  assert.equal(secondClick.status, 200);
  const after2 = await newsletter.getById(id);
  assert.equal(after2.status, 'unsubscribed');
  assert.equal(after2.unsubscribed_at, after1.unsubscribed_at, 'the second click must not change the record again');
});

test('newsletter: GET on an unsubscribe link only asks — a prefetch must not unsubscribe anyone', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  // This is the regression guard for a real defect: the unsubscribe link
  // sits in the same pending double-opt-in mail as the confirm link, so a
  // mail scanner, link-preview or corporate "safe links" gateway fetches
  // it before any human sees the message. While GET was the state change,
  // that fetch flipped a fresh `pending` record to `unsubscribed`, the
  // human's own confirm click then failed, and signing up again just
  // repeated the cycle — the address could never subscribe at all.
  const email = `prefetch-${Date.now()}@example.com`;
  await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });

  const records = await newsletter.findByEmail(email);
  const id = records[0].id;
  assert.equal(records[0].status, 'pending');

  const tokens = require('../src/tokens');
  const unsubUrl = `/newsletter/unsubscribe?id=${id}&token=${tokens.unsubscribeToken(id)}`;

  // The "scanner" follows the link.
  const prefetch = await request(server, 'GET', unsubUrl);
  assert.equal(prefetch.status, 200, 'a valid link must render a page, not an error');

  const afterPrefetch = await newsletter.getById(id);
  assert.equal(afterPrefetch.status, 'pending', 'GET must not change the record');
  assert.equal(afterPrefetch.unsubscribed_at, null);

  // And the human can still confirm, which was the part that broke.
  const customerMail = sentMails.find((m) => m.to === email);
  const confirmUrl = urlFrom(customerMail.text, '/api/newsletter/confirm');
  const confirmed = await request(server, 'GET', pathFromMailUrl(confirmUrl));
  assert.equal(confirmed.status, 200);
  assert.equal((await newsletter.getById(id)).status, 'confirmed');
});

test('newsletter: unsubscribe with a wrong token is rejected, not silently accepted', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const email = `badtoken-${Date.now()}@example.com`;
  const id = await newsletter.create({
    email,
    locale: 'de',
    confirm_token_hash: 'irrelevant',
    confirm_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    ip: '127.0.0.1',
    user_agent: 'test',
    consent_version: 'v1',
    consent_timestamp: new Date().toISOString(),
    source: 'newsletter',
  });
  await newsletter.confirm(id, new Date().toISOString());

  const res = await request(server, 'GET', `/newsletter/unsubscribe?id=${id}&token=not-the-real-token`);
  assert.equal(res.status, 400);
  const record = await newsletter.getById(id);
  assert.equal(record.status, 'confirmed', 'a wrong token must not unsubscribe the record');
});

test('newsletter: missing consent is rejected with 400', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  const res = await request(server, 'POST', '/newsletter', { email: `noconsent-${Date.now()}@example.com`, locale: 'de' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'consent_required');
});

test('newsletter: a filled-in honeypot field is silently accepted-looking but creates nothing', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `bot-${Date.now()}@example.com`;
  const res = await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true, website: 'http://spam.example' });
  assert.equal(res.status, 202);
  assert.equal(sentMails.length, 0);
  const records = await newsletter.findByEmail(email);
  assert.equal(records.length, 0);
});

test('newsletter: the per-address flood cap actually stops repeat signups for a stranger', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  // The cap used to count DOCUMENTS created per address, which never rose:
  // a repeat signup for an address that is already pending goes through
  // reissueToken, updating the one existing document. So the guard was
  // dead code and anyone could point the form at a stranger's inbox and
  // have us mail it on demand — the per-IP limiter being the only brake,
  // and an attacker picking their own IPs. It now counts mails sent.
  const email = `flood-${Date.now()}@example.com`;

  for (let i = 1; i <= MAX_CONFIRM_SENDS_PER_DAY; i++) {
    const res = await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });
    assert.equal(res.status, 202, `signup ${i} of ${MAX_CONFIRM_SENDS_PER_DAY} should be accepted`);
  }
  assert.equal(
    sentMails.filter((m) => m.to === email).length,
    MAX_CONFIRM_SENDS_PER_DAY,
    'one confirmation mail per accepted signup'
  );

  const blocked = await request(server, 'POST', '/newsletter', { email, locale: 'de', consent: true });
  assert.equal(blocked.status, 429, 'the signup past the cap must be refused');
  assert.equal(blocked.body.error, 'too_many_requests');
  assert.equal(
    sentMails.filter((m) => m.to === email).length,
    MAX_CONFIRM_SENDS_PER_DAY,
    'and must not have sent another mail'
  );

  // Still exactly one document — the reuse that broke the old cap is the
  // intended behaviour and must not have been "fixed" by piling up rows.
  const records = await newsletter.findByEmail(email);
  assert.equal(records.length, 1);
  assert.equal(records[0].confirm_sends.length, MAX_CONFIRM_SENDS_PER_DAY);
});
