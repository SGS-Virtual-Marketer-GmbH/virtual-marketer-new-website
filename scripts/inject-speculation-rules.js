#!/usr/bin/env node

/**
 * Adds a Speculation Rules block to every page, so supporting browsers
 * (Chrome/Edge 121+) prerender an internal link the moment the visitor
 * hovers or touches it — navigation then completes in ~0ms, which both
 * feels instant and improves the field LCP/INP data that feeds Core Web
 * Vitals.
 *
 * Safe on this site by construction: every page is static HTML with no
 * per-view side effects, so prerendering N pages costs nothing but a few
 * requests to nginx. The only same-origin paths with side effects are the
 * booking/contact API under /api/ — excluded below, along with legacy
 * /wp-admin/ paths (410) — and browsers that don't support the API ignore
 * the block entirely (it is JSON, never executed as script).
 *
 * "moderate" eagerness means: speculate on hover/pointerdown only, never
 * speculatively fetch the whole page's links — the conservative choice for
 * a site with image-heavy feature pages. Chrome caps concurrent moderate
 * prerenders at 2, so this cannot stampede the server.
 *
 * Runs last in the pipeline (after inject-search.js) so every generated
 * page — including any added by earlier steps — gets the block.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const RULES = {
  prerender: [
    {
      where: {
        and: [
          { href_matches: '/*' },
          { not: { href_matches: '/api/*' } },
          { not: { href_matches: '/wp-admin/*' } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
};

const BLOCK = `<script type="speculationrules">${JSON.stringify(RULES)}</script>\n`;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n⚡ Adding speculation rules (hover-prerender) to every page...\n');

  let added = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    if (html.includes('type="speculationrules"')) continue;

    const headClose = html.indexOf('</head>');
    if (headClose === -1) continue;

    html = html.slice(0, headClose) + BLOCK + html.slice(headClose);
    fs.writeFileSync(file, html);
    added++;
  }

  console.log(`✅ Speculation rules added to ${added} page(s)\n`);
}

main();
