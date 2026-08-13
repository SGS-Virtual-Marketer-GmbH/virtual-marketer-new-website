#!/usr/bin/env node

/**
 * Adds the search trigger and its panel to every page.
 *
 * WHY A SINGLE <body>-ANCHORED INSERTION, NOT A NAV-BAR ITEM
 *
 * This site renders its header from at least six different places — the
 * legacy Elementor theme's own export, plus five separate generator
 * functions (generate-contact-page.js, generate-blog-posts.js twice,
 * generate-en-blog-posts.js twice, generate-en-pages.js,
 * generate-feature-pages.js) — none of which share a function, so there is
 * no single template to add a nav item to. Measured on the homepage: the
 * "Lösungen" nav link alone (`vm-solutions-dd`) appears 32 times across
 * sections that are not all the visible header. Anchoring on any of that
 * structure risks either missing page types or duplicating the trigger in
 * places that are not navigation at all.
 *
 * Every page has exactly one `</body>`, so that is the anchor (matched by
 * lastIndexOf, not a regex on the opening tag — see the inline comment at
 * the insertion point for why). The trigger renders as a small fixed button
 * (assets/search/search.css positions it beneath the existing language
 * switcher, see that file for why) rather than a nav-bar item — it looks the
 * same on every page regardless of which of the six generators built it,
 * which a nav-bar insertion could not promise.
 *
 * Run after inject-language-switcher.js (so the fixed-position math in
 * search.css is measuring against a switch that is already in the page)
 * and after scripts/build-search-index.js (so the index files this widget
 * fetches already exist).
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const ICON_SEARCH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
const ICON_CLOSE_TEXT = '×';

const COPY = {
  de: {
    openLabel: 'Suche öffnen',
    closeLabel: 'Suche schließen',
    placeholder: 'Blogartikel, Lösungen und Seiten durchsuchen…',
    dialogLabel: 'Suche',
  },
  en: {
    openLabel: 'Open search',
    closeLabel: 'Close search',
    placeholder: 'Search blog posts, solutions and pages…',
    dialogLabel: 'Search',
  },
};

function widget(lang) {
  const L = COPY[lang];
  return `<!-- vm-search:start -->
<link rel="stylesheet" href="/assets/search/search.css">
<div class="vm-search">
  <button type="button" class="vm-search-toggle" aria-expanded="false" aria-controls="vm-search-panel" aria-label="${L.openLabel}">
    ${ICON_SEARCH}
  </button>
</div>
<div class="vm-search-panel" id="vm-search-panel" role="dialog" aria-modal="true" aria-label="${L.dialogLabel}" hidden>
  <div class="vm-search-box">
    <div class="vm-search-field">
      ${ICON_SEARCH}
      <input type="text" class="vm-search-input" role="combobox" aria-expanded="true" aria-controls="vm-search-results" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${L.placeholder}">
      <button type="button" class="vm-search-close" aria-label="${L.closeLabel}">${ICON_CLOSE_TEXT}</button>
    </div>
    <ul class="vm-search-results" id="vm-search-results" role="listbox" hidden></ul>
  </div>
</div>
<script defer src="/assets/search/search.js"></script>
<!-- vm-search:end -->
`;

}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function copyAssets() {
  const src = path.join(__dirname, '../assets/search');
  const dest = path.join(DIST, 'assets/search');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['search.css', 'search.js']) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
}

function main() {
  console.log('\n🔎 Adding the search trigger to every page...\n');

  copyAssets();

  let added = 0;
  let skipped = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    if (html.includes('vm-search:start')) {
      skipped++;
      continue;
    }

    // lastIndexOf('</body>'), not a regex match on the opening <body> tag —
    // the established pattern in this codebase (see
    // inject-language-switcher.js). An opening-tag regex is not safe here:
    // fix-preloader.js writes a CSS comment containing the literal text
    // "hides <body> itself", and `<body\b[^>]*>` matches that string too,
    // inserting this whole widget block inside a <style> tag instead of the
    // real document body.
    const bodyCloseIdx = html.lastIndexOf('</body>');
    if (bodyCloseIdx === -1) continue;

    const isEnglish = /\/en\//.test(file.split(path.sep).join('/')) || /<html[^>]+lang=["']en/i.test(html);
    html = html.slice(0, bodyCloseIdx) + widget(isEnglish ? 'en' : 'de') + html.slice(bodyCloseIdx);

    fs.writeFileSync(file, html);
    added++;
  }

  console.log(`✅ Search added to ${added} page(s) (${skipped} already had it)\n`);
}

main();
