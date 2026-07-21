#!/usr/bin/env node

/**
 * Broken Link Cleanup
 *
 * Two dead-link patterns left over from the WordPress scrape that
 * scripts/fix-shortlinks.js doesn't cover (different URL shapes):
 *
 * 1. "Simple Likes" plugin heart/like buttons on blog cards (~65 files)
 *    link to /wp-admin/admin-ajax.php?action=process_simple_like&... — a
 *    PHP endpoint that no longer exists on a static site. Neutralized to a
 *    non-navigating href so the (decorative, static-count) heart icon
 *    still renders but no longer points at a 404.
 *
 * 2. Two body-copy links on /modell-anfragen/ point at
 *    "../virtual-marketer-demo.html", which was never a real file (the
 *    actual demo page is /virtual-marketer-demo/, an index.html in its own
 *    directory) — rewritten to the correct absolute path, consistent with
 *    every other "Demo buchen" CTA on the site (see commit 7b44c9d).
 *
 * Run after scripts/fix-legal-content.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🔗 Cleaning up dead legacy WordPress links...\n');

  const files = findHtmlFiles(DIST);
  let likeButtonsFixed = 0;
  let demoLinksFixed = 0;
  let filesChanged = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    html = html.replace(/href="(?:\.\.\/)*wp-admin\/admin-ajax\.php%3Faction=process_simple_like[^"]*"/g, () => {
      likeButtonsFixed++;
      return 'href="javascript:void(0)" aria-disabled="true"';
    });

    html = html.replace(/href="(?:\.\.\/)*virtual-marketer-demo\.html"/g, () => {
      demoLinksFixed++;
      return 'href="/virtual-marketer-demo/"';
    });

    if (html !== before) {
      fs.writeFileSync(file, html);
      filesChanged++;
    }
  }

  console.log(`  ✓ Neutralized ${likeButtonsFixed} dead "like" button link(s)`);
  console.log(`  ✓ Fixed ${demoLinksFixed} dead demo-page link(s)`);
  console.log(`  ✓ ${filesChanged} file(s) changed\n`);
}

main();
