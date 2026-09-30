#!/usr/bin/env node

/**
 * Rewrites internal links that end in `index.html` to the clean directory URL.
 *
 * The WordPress scrape links pages relatively, e.g. href="../../index.html" or
 * href="index.html#". Google resolves those to /index.html, /blog/index.html
 * and so on, which are the same pages as /, /blog/, ... and the server now
 * answers those file URLs with a 301 (docker/nginx.conf.template). Every such
 * link was therefore a redirect hop and a second, duplicate URL for the same
 * page. Each one is resolved against the page it sits on and rewritten to the
 * absolute directory URL, keeping any #fragment.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'https://virtual-marketer.de';
const HREF_RE = /(\bhref=)(["'])([^"']*?index\.html(?:#[^"']*)?)\2/gi;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function main() {
  console.log('\n🔗 Rewriting links to index.html files as clean directory URLs...\n');
  let links = 0;
  let files = 0;

  for (const file of walk(DIST)) {
    const rel = path.relative(DIST, file).split(path.sep);
    rel.pop();
    const pageUrl = `${ORIGIN}/${rel.join('/')}${rel.length ? '/' : ''}`;
    const before = fs.readFileSync(file, 'utf-8');

    const after = before.replace(HREF_RE, (whole, attr, q, href) => {
      if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) && !href.startsWith(ORIGIN)) return whole; // other host
      if (/^(?:mailto|tel|javascript|data):/i.test(href)) return whole;
      let u;
      try { u = new URL(href, pageUrl); } catch { return whole; }
      if (u.origin !== ORIGIN || !/\/index\.html$/.test(u.pathname)) return whole;
      links++;
      return `${attr}${q}${u.pathname.replace(/index\.html$/, '')}${u.hash}${q}`;
    });

    if (after !== before) { fs.writeFileSync(file, after); files++; }
  }

  console.log(`   ✓ ${links} link(s) rewritten on ${files} page(s)\n`);
}

main();
