#!/usr/bin/env node
/**
 * Gate between "the build finished" and "it goes live".
 *
 * A scheduled deploy has nobody watching it, so a broken scrape or a half-run
 * pipeline must not be able to replace a working site. Checks the shape of
 * dist/ and then runs the SEO audit in strict mode (any ERROR fails the run).
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const DIST = path.join(process.cwd(), 'dist');
const fail = (m) => { console.error(`VERIFY FAILED: ${m}`); process.exit(1); };

function count(dir, re) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    n += e.isDirectory() ? count(full, re) : re.test(e.name) ? 1 : 0;
  }
  return n;
}

const pages = count(DIST, /\.html$/);
if (pages < 200) fail(`only ${pages} HTML pages in dist/ (expected 230+)`);
for (const f of ['index.html', 'en/index.html', 'blog/index.html', 'sitemap.xml', 'robots.txt', '404.html']) {
  if (!fs.existsSync(path.join(DIST, f))) fail(`dist/${f} is missing`);
}
const urls = (fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf-8').match(/<loc>/g) || []).length;
if (urls < 200) fail(`sitemap lists only ${urls} URLs`);
console.log(`dist/ looks sane: ${pages} pages, ${urls} sitemap URLs`);

try {
  cp.execFileSync('node', ['scripts/audit-seo.js', '--strict'], { stdio: 'inherit' });
} catch {
  fail('SEO audit reported errors');
}
