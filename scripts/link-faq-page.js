#!/usr/bin/env node

/**
 * Gives the FAQ pages an inbound link from the homepages.
 *
 * /faqs/ and /en/faqs/ were linked only from each other (through the
 * language switcher): no navigation, footer or article pointed at them. A
 * page nothing else links to is what Search Console files under "discovered,
 * currently not indexed", and the FAQ answers are exactly the content that
 * should be findable. The footer link row on both homepages gets one more
 * entry, in the same markup as its neighbours.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

const TARGETS = [
  { file: 'index.html', after: '/impressum/', href: '/faqs/', label: 'FAQ' },
  { file: 'en/index.html', after: '/en/legal-notice/', href: '/en/faqs/', label: 'FAQ' },
];

function main() {
  console.log('\n🔗 Linking the FAQ pages from the homepage footers...\n');
  for (const t of TARGETS) {
    const file = path.join(DIST, t.file);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf-8');
    if (html.includes(`href="${t.href}"`)) { console.log(`   = ${t.file}: already linked`); continue; }

    // The whole <li> that holds the neighbouring footer link.
    const re = new RegExp(`<li class="ot-icon-list-item --inline-item">(?:(?!</li>)[\\s\\S])*?href="${t.after.replace(/\//g, '\\/')}"[\\s\\S]*?</li>`);
    const m = html.match(re);
    if (!m) { console.log(`   ⚠ ${t.file}: footer link row not found`); continue; }

    const item = m[0]
      .replace(/href="[^"]*"/, `href="${t.href}"`)
      .replace(/(<span class="ot-icon-list-text">)[\s\S]*?(<\/span>)/, `$1${t.label}$2`);
    fs.writeFileSync(file, html.replace(m[0], m[0] + '\n' + item));
    console.log(`   ✓ ${t.file}: linked ${t.href}`);
  }
  console.log();
}

main();
