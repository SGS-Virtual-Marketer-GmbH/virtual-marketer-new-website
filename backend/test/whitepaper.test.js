'use strict';

/**
 * Whitepaper gated download: same double opt-in shape as contact.js, plus
 * the slug allowlist (the whole point of which is that this endpoint can
 * never be used to mail an arbitrary URL) and the separate newsletter
 * opt-in checkbox. See test/newsletter.test.js for why mailer.send is
 * stubbed rather than left to hit the fake SMTP host.
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
const { whitepaper, newsletter } = require('../src/db');

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

function urlFrom(text, path) {
  const re = new RegExp(`https?://[^\\s]*${path}\\?[^\\s]*`);
  const m = text.match(re);
  return m ? m[0] : null;
}

// Mail links are built with the public `/api/...` prefix (see
// src/routes/whitepaper.js) because that's what a real browser hits — nginx
// strips `/api` before proxying to this service. These tests talk to the
// Express app directly, with no nginx in front of it, so that prefix has to
// be stripped here the same way nginx would.
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

test('whitepaper: an unknown slug is rejected with 400 before anything is created', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `unknownslug-${Date.now()}@example.com`;
  const res = await request(server, 'POST', '/whitepaper', { email, locale: 'de', slug: 'not-a-real-whitepaper', consent: true });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'invalid_input');
  assert.equal(sentMails.length, 0);
});

test('whitepaper happy path: POST -> pending, confirm delivers a download link', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `wp-${Date.now()}@example.com`;
  const signup = await request(server, 'POST', '/whitepaper', { email, locale: 'de', slug: 'agentic-marketing-2026', consent: true });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.status, 'pending');

  const customerMail = sentMails.find((m) => m.to === email);
  const confirmUrl = urlFrom(customerMail.text, '/api/whitepaper/confirm');
  assert.ok(confirmUrl);

  sentMails.length = 0;
  const confirmRes = await request(server, 'GET', pathFromMailUrl(confirmUrl));
  assert.equal(confirmRes.status, 200);
  // Content-hashed, single-language filename (defect 1 + defect 2 fix) —
  // NOT the old fixed "agentic-marketing-2026.pdf" a link could be guessed
  // from, and locale-suffixed so a DE request never resolves to the EN file.
  assert.match(String(confirmRes.body), /agentic-marketing-2026\.de\.[0-9a-f]+\.pdf/);

  const record = await whitepaper.getById(signup.body.id);
  assert.equal(record.status, 'confirmed');

  const deliveryMail = sentMails.find((m) => m.to === email);
  assert.ok(deliveryMail, 'a delivery mail with the download link should be sent on confirm');
  assert.match(deliveryMail.text, /agentic-marketing-2026\.de\.[0-9a-f]+\.pdf/);
});

test('whitepaper: locale selects the matching single-language PDF from the manifest', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());

  // eslint-disable-next-line global-require
  const manifest = require('../src/generated/whitepaper-manifest.json');
  const entry = manifest['agentic-marketing-2026'];
  assert.ok(entry.de && entry.en, 'manifest must have both locales for this build to exercise the test');
  assert.notEqual(entry.de.filename, entry.en.filename, 'DE and EN must be two distinct files, not the same one');

  for (const locale of ['de', 'en']) {
    sentMails.length = 0;
    const email = `wp-locale-${locale}-${Date.now()}@example.com`;
    const signup = await request(server, 'POST', '/whitepaper', { email, locale, slug: 'agentic-marketing-2026', consent: true });
    assert.equal(signup.status, 201);

    const customerMail = sentMails.find((m) => m.to === email);
    const confirmUrl = urlFrom(customerMail.text, '/api/whitepaper/confirm');
    sentMails.length = 0;
    const confirmRes = await request(server, 'GET', pathFromMailUrl(confirmUrl));
    assert.equal(confirmRes.status, 200);

    const own = entry[locale];
    const other = entry[locale === 'de' ? 'en' : 'de'];
    assert.ok(String(confirmRes.body).includes(own.filename), `${locale} confirm page must link to the ${locale} PDF (${own.filename})`);
    assert.ok(!String(confirmRes.body).includes(other.filename), `${locale} confirm page must NOT link to the other locale's PDF (${other.filename})`);

    const deliveryMail = sentMails.find((m) => m.to === email);
    assert.ok(deliveryMail.text.includes(own.filename));
    assert.ok(!deliveryMail.text.includes(other.filename));
  }
});

test('whitepaper: the separate newsletter checkbox creates its own consent record and, on confirm, an active subscription', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `wp-nl-${Date.now()}@example.com`;
  const signup = await request(server, 'POST', '/whitepaper', {
    email,
    locale: 'de',
    slug: 'agentic-marketing-2026',
    consent: true,
    newsletterOptIn: true,
  });
  assert.equal(signup.status, 201);

  const record = await whitepaper.getById(signup.body.id);
  assert.equal(record.newsletter_opt_in, true);
  assert.ok(record.newsletter_consent_version);
  assert.ok(record.newsletter_consent_timestamp);
  assert.notEqual(record.newsletter_consent_version, record.consent_version, 'whitepaper and newsletter consent must be recorded separately');

  const customerMail = sentMails.find((m) => m.to === email);
  const confirmUrl = urlFrom(customerMail.text, '/api/whitepaper/confirm');
  await request(server, 'GET', pathFromMailUrl(confirmUrl));

  const subs = await newsletter.findByEmail(email);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].status, 'confirmed', 'confirming the whitepaper request must activate the newsletter subscription');
  assert.equal(subs[0].source, 'whitepaper');
});

test('whitepaper: no newsletter checkbox means no newsletter record at all', async (t) => {
  if (!(await ready(t))) return;
  const server = await listen();
  t.after(() => server.close());
  sentMails.length = 0;

  const email = `wp-nonl-${Date.now()}@example.com`;
  const signup = await request(server, 'POST', '/whitepaper', { email, locale: 'de', slug: 'agentic-marketing-2026', consent: true });
  const customerMail = sentMails.find((m) => m.to === email);
  const confirmUrl = urlFrom(customerMail.text, '/api/whitepaper/confirm');
  await request(server, 'GET', pathFromMailUrl(confirmUrl));

  const subs = await newsletter.findByEmail(email);
  assert.equal(subs.length, 0);
});
