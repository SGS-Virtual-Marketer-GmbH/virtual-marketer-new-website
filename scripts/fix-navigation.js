#!/usr/bin/env node

/**
 * Site-wide "Lösungen" navigation fix
 *
 * Two different, both broken, "Lösungen" nav experiences existed side by
 * side across the site:
 *
 * - 76 legacy WordPress-scraped pages carry a stale 3-item dropdown
 *   ("Text Generation" -> api.virtual-marketer.de, "Interaktive Lösungen"
 *   -> /virtual-marketer-ai-services/, "CSS Price Comparison" ->
 *   shopping.virtual-marketer.de) that predates the current 11-page
 *   feature lineup entirely and doesn't link to a single one of them.
 * - The 26 pages this project generates itself (14 new blog posts, the
 *   blog index, and all 11 feature pages under /ki-loesungen/) use a
 *   flat "Lösungen" link with NO dropdown at all — no way to discover
 *   any of the other feature pages without first going back to the hub.
 *
 * Both are replaced here with the same self-contained <details>/<summary>
 * dropdown listing all 11 real feature pages. Deliberately NOT reusing
 * the WordPress theme's own menu JS/CSS (elementor-header.js,
 * header-mobile.js) — those aren't loaded consistently across both page
 * families, so a dependency-free native <details> element (tap-friendly
 * on mobile, keyboard-accessible, no JS required) is what actually works
 * identically everywhere.
 *
 * Run after scripts/generate-feature-pages.js (so the 11 pages it creates
 * already exist to patch) and scripts/inject-language-switcher.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const SOLUTIONS = [
  { href: '/ki-loesungen/agenten/', label: 'KI-Agenten für Marketing &amp; Ads' },
  { href: '/ki-loesungen/coding-api/', label: 'Coding-API &amp; MCP-Server' },
  { href: '/ki-loesungen/produktfotos-ki/', label: 'KI-Produktfotos &amp; Virtual Try-On' },
  { href: '/ki-loesungen/feed-veredelung/', label: 'KI Feed-Veredelung' },
  { href: '/ki-loesungen/texte-generieren/', label: 'KI-Textgenerierung' },
  { href: '/ki-loesungen/bilder-generieren/', label: 'KI-Bildgenerierung' },
  { href: '/ki-loesungen/videos-generieren/', label: 'KI-Videogenerierung' },
  { href: '/ki-loesungen/seo-content/', label: 'KI-SEO-Content' },
  { href: '/ki-loesungen/kampagnen-builder/', label: 'KI-Kampagnen-Builder' },
  { href: '/ki-loesungen/interne-verlinkung/', label: 'Interne Verlinkung' },
  { href: '/ki-loesungen/mail-generator/', label: 'KI-E-Mail-Generator' },
];

const DROPDOWN_STYLE = `<style>
  .vm-solutions-dd{position:relative;display:inline-block;font-family:inherit;}
  .vm-solutions-dd summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:4px;padding:0;color:inherit;font:inherit;}
  .vm-solutions-dd summary::-webkit-details-marker{display:none;}
  .vm-solutions-dd summary::after{content:" \\25BE";font-size:.7em;}
  .vm-solutions-dd .vm-solutions-list{position:absolute;top:calc(100% + 10px);left:0;background:#fff;border:1px solid #e7dfe0;border-radius:10px;box-shadow:0 12px 32px rgba(36,20,23,.14);min-width:270px;padding:8px;margin:0;list-style:none;z-index:9999;}
  .vm-solutions-dd .vm-solutions-list li{margin:0;}
  .vm-solutions-dd .vm-solutions-list a{display:block;padding:9px 12px;border-radius:6px;color:#241417;text-decoration:none;font-size:14px;white-space:nowrap;}
  .vm-solutions-dd .vm-solutions-list a:hover{background:#fbecee;color:#94152b;}
  .vm-solutions-dd .vm-solutions-list li.vm-solutions-all{border-top:1px solid #e7dfe0;margin-top:6px;padding-top:6px;}
  .vm-solutions-dd .vm-solutions-list li.vm-solutions-all a{color:#94152b;font-weight:600;}
  @media (max-width:900px){
    .vm-solutions-dd .vm-solutions-list{position:static;box-shadow:none;border:none;margin-top:6px;min-width:0;padding-left:12px;}
  }
</style>`;

function buildDropdown() {
  const items = SOLUTIONS.map((s) => `      <li><a href="${s.href}">${s.label}</a></li>`).join('\n');
  return `<details class="vm-solutions-dd">
    <summary>Lösungen</summary>
    <ul class="vm-solutions-list">
${items}
      <li class="vm-solutions-all"><a href="/ki-loesungen/">Alle Lösungen im Überblick &rarr;</a></li>
    </ul>
  </details>${DROPDOWN_STYLE}`;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

// Matches both the desktop nav's <li id="menu-item-58027" class="...">
// and the mobile nav clone's <li class="...menu-item-58027"> (no id attr,
// same class list) — anchoring on the class substring instead of a
// specific attribute so both variants are caught. The inner <a> varies
// too: absolute vs. relative href (https://virtual-marketer.de/ki-loesungen/
// on some pages, /ki-loesungen/ on others) and an extra aria-current="page"
// on the hub page's own self-link — matched loosely on both counts.
const LEGACY_BLOCK = /<li[^>]*\bmenu-item-58027\b[^>]*><a href="[^"]*\/ki-loesungen\/"[^>]*>Lösungen<\/a>\s*<ul class="sub-menu">[\s\S]*?<\/ul>\s*<\/li>/g;
const SIMPLE_LINK = /<a href="[^"]*\/ki-loesungen\/"[^>]*>Lösungen<\/a>/;

function main() {
  console.log('\n🧭 Unifying "Lösungen" navigation across all pages...\n');

  const dropdown = buildDropdown();
  const legacyReplacement = `<li class="menu-item vm-solutions-menu-item">${dropdown}</li>`;

  let legacyFixed = 0;
  let simpleFixed = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    if (html.includes('menu-item-58027')) {
      html = html.replace(LEGACY_BLOCK, legacyReplacement);
      legacyFixed++;
    } else if (SIMPLE_LINK.test(html)) {
      html = html.replace(SIMPLE_LINK, dropdown);
      simpleFixed++;
    }

    if (html !== before) fs.writeFileSync(file, html);
  }

  console.log(`  ✓ Replaced stale legacy dropdown on ${legacyFixed} page(s)`);
  console.log(`  ✓ Added missing dropdown to ${simpleFixed} page(s)\n`);
}

main();
