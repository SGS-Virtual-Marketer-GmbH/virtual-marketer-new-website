'use strict';

/**
 * Defect 1's fail-safe requirement: if backend/src/generated/whitepaper-
 * manifest.json is missing (a build that never ran generate-lead-magnet-
 * pages.js, or a bad deploy), src/routes/whitepaper.js must degrade to a
 * clear, logged 503 — never crash the process, and never take the rest of
 * this Express app (booking, contact, newsletter) down with it.
 *
 * This has to run in a FRESH child process, not inline in this test file:
 * the manifest is `require()`d once at module load in whitepaper.js, and
 * every other test file in this suite depends on that cached, real
 * manifest being present. Renaming the file away and re-requiring the app
 * in-process would either not observe the change (Node's require cache)
 * or, if the cache were forcibly cleared, would poison every whitepaper
 * test that runs afterwards in the same `node --test` process. A child
 * process gets its own require cache and exits before the real file is
 * restored, so nothing else in the suite ever sees the manifest missing —
 * PROVIDED the suite runs serially. `node --test` executes test FILES in
 * parallel by default (one worker per CPU), and under that default this
 * rename raced whitepaper.test.js: that file's four Firestore-backed tests
 * would intermittently see the manifest gone and get the 503 this file is
 * deliberately provoking, failing with `503 !== 201`. The suite is therefore
 * pinned to `--test-concurrency=1` in package.json. If you ever remove that
 * flag, isolate this test (run it against a copy of the tree in a child
 * process) instead — do not simply restore the parallel default.
 *
 * Deliberately does not need Firestore or the emulator: the fail-safe
 * check in whitepaper.js runs before any Firestore read/write (see its
 * own comment, "Fail safe BEFORE touching Firestore or sending any
 * mail"), so this test exercises that path in complete isolation.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const BACKEND_ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(BACKEND_ROOT, 'src', 'generated', 'whitepaper-manifest.json');
const BACKUP = `${MANIFEST}.failsafe-test-backup`;

// Runs the check in its own node process so the require-cache never leaks
// into this test file's own process (which the rest of the suite shares).
const CHILD_SCRIPT = `
'use strict';
process.env.SMTP_HOST = 'test-smtp.invalid';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test';
process.env.SMTP_FROM = 'Test <test@example.com>';
process.env.NOTIFY_TO = 'notify@example.com';
process.env.PUBLIC_BASE_URL = 'http://localhost:0';
process.env.RATE_LIMIT_SUBMIT = '1000';

const mailer = require('./src/mailer');
mailer.send = async () => ({});

const app = require('./src/app');
const http = require('http');

const server = app.listen(0, () => {
  const { port } = server.address();
  const data = JSON.stringify({
    email: 'failsafe@example.com',
    locale: 'de',
    slug: 'agentic-marketing-2026',
    consent: true,
  });
  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      path: '/whitepaper',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    },
    (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        process.stdout.write(JSON.stringify({ status: res.statusCode, body: JSON.parse(raw) }));
        server.close(() => process.exit(0));
      });
    }
  );
  req.on('error', (e) => { console.error(e); process.exit(1); });
  req.write(data);
  req.end();
});
`;

test('whitepaper: fails safe (503, no crash) when the manifest is missing', async (t) => {
  if (!fs.existsSync(MANIFEST)) {
    t.skip('backend/src/generated/whitepaper-manifest.json not present in this checkout — run `npm run build` first');
    return;
  }

  fs.renameSync(MANIFEST, BACKUP);
  let result;
  try {
    const child = spawnSync(process.execPath, ['-e', CHILD_SCRIPT], {
      cwd: BACKEND_ROOT,
      encoding: 'utf-8',
      timeout: 15000,
    });
    assert.equal(child.status, 0, `child process should exit cleanly (never crash): stderr=${child.stderr}`);
    result = JSON.parse(child.stdout);
  } finally {
    // Restored unconditionally, even if an assertion above throws, so a
    // failing assertion can never leave the real suite without its
    // manifest for whatever runs next.
    fs.renameSync(BACKUP, MANIFEST);
  }

  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'whitepaper_unavailable');
});
