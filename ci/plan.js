#!/usr/bin/env node
/**
 * Decides whether this run has to build and deploy at all.
 *
 * The scheduler fires several times a day, but a build only makes sense when
 * something changed: a new commit on main, or a blog post whose publish date
 * has arrived since the last deployed build. Everything else would produce a
 * byte-identical site, so the run stops after this step (a few seconds).
 *
 * Reads  /workspace/state.json  (what the last successful deploy recorded)
 * Writes /workspace/build.flag  when a build is needed, plus the reason.
 *
 * FORCE=true skips the check (manual runs, "deploy now").
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO = '/workspace/repo';
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const commit = cp.execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();

let state = {};
try { state = JSON.parse(fs.readFileSync('/workspace/state.json', 'utf-8')); } catch { /* first run */ }

/** Publish dates in the blog manifests (German `date`, English `dateISO`). */
function postDates() {
  const dates = new Set();
  for (const f of fs.readdirSync(REPO)) {
    if (!/^blog-posts.*\.json$/.test(f)) continue;
    const text = fs.readFileSync(path.join(REPO, f), 'utf-8');
    for (const m of text.matchAll(/"(?:date|dateISO)"\s*:\s*"(\d{4}-\d{2}-\d{2})/g)) dates.add(m[1]);
  }
  return [...dates];
}

let reason = '';
if (process.env.FORCE === 'true') reason = 'forced';
else if (!state.commit) reason = 'no previous build recorded';
else if (state.commit !== commit) reason = `new commit ${commit.slice(0, 7)} (was ${state.commit.slice(0, 7)})`;
else {
  const due = postDates().filter((d) => d > (state.builtOn || '') && d <= today).sort();
  if (due.length) reason = `post date(s) reached since last build: ${due.join(', ')}`;
}

fs.writeFileSync('/workspace/commit', commit);
fs.writeFileSync('/workspace/today', today);
if (reason) {
  fs.writeFileSync('/workspace/build.flag', reason);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
  fs.writeFileSync('/workspace/tag', `b${stamp}-${commit.slice(0, 7)}`);
  console.log(`BUILD: ${reason}`);
} else {
  console.log(`SKIP: commit ${commit.slice(0, 7)} already deployed on ${state.builtOn}, no post due (today ${today})`);
}
