#!/usr/bin/env node

/**
 * Preloader Fix
 *
 * The original WordPress theme (Engitech) ships a "royal_preloader" overlay:
 * a fixed, full-viewport div (#royal_preloader, z-index 2147483647) that
 * covers the page until a bundled jQuery plugin fires on window.load and
 * hides it, revealing the real content (#page, which starts as
 * visibility:hidden).
 *
 * In this static rebuild, that plugin's completion path doesn't reliably
 * fire (it depends on WordPress-era script timing/ordering this export
 * doesn't reproduce exactly), so the preloader can get stuck showing an
 * indefinite blank overlay with the real page invisible underneath it.
 *
 * Fix: since this is now a static site — there's no real "loading" work
 * happening — we just remove the preloader mechanism outright with a CSS
 * override injected into every page's <head>, rather than trying to
 * reproduce the exact legacy JS timing. This is applied site-wide (not
 * just the two pages touched by the AI-features work) because the bug
 * affects every page that includes the theme's preloader markup.
 *
 * Run as part of `npm run build`, after build.js (which regenerates dist/
 * from the WordPress export each time).
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const MARKER_START = '<!-- vm-fix-preloader:start -->';
const MARKER_END = '<!-- vm-fix-preloader:end -->';

const OVERRIDE = `${MARKER_START}
<style>
  #royal_preloader{display:none!important}
  /* The theme hides <body> itself (anti-flash-of-unstyled-content), not just
     #page — and since visibility is inherited, anything appended as a body
     child OUTSIDE #page (e.g. content injected right before </body>) stays
     hidden even after #page is forced visible. Un-hide body itself so both
     #page and any sibling content are visible. */
  body{visibility:visible!important}
  #page{visibility:visible!important;opacity:1!important}
</style>
${MARKER_END}`;

function findHtmlFiles(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(full, results);
    } else if (entry.name === 'index.html') {
      results.push(full);
    }
  }
  return results;
}

function main() {
  const files = findHtmlFiles(DIST, []);
  let fixed = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf-8');
    if (!html.includes('id="royal_preloader"') && !html.includes("id='royal_preloader'")) continue;

    const startIdx = html.indexOf(MARKER_START);
    const endIdx = html.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      html = html.slice(0, startIdx) + OVERRIDE + html.slice(endIdx + MARKER_END.length);
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', `${OVERRIDE}\n</head>`);
    } else {
      continue;
    }

    fs.writeFileSync(file, html);
    fixed++;
  }

  console.log(`\n🩹 Preloader fix applied to ${fixed} page(s) (of ${files.length} scanned).\n`);
}

main();
