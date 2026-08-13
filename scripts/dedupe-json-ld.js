#!/usr/bin/env node

/**
 * Removes the leftover Yoast schema graph on pages that already have our own.
 *
 * 55 pages carry a `<script class="yoast-schema-graph">` block from the
 * original WordPress export — the SEO plugin's own structured-data output,
 * generated at scrape time and never touched since. On 46 of those pages it
 * is the ONLY structured data present, so it stays: removing it there would
 * leave the page with none at all, which is a regression, not a fix.
 *
 * On 9 — the pages this project's own generators also write schema for
 * (generate-impressum.js, generate-accessibility-statement.js, and the
 * per-page table in seo-optimize.js: the homepage, /management/, /faqs/,
 * /kontakt/-adjacent pages, the legal pages) — it is a second, independent,
 * increasingly stale copy of the same facts sitting next to a current one.
 * It is also actively wrong in a way the current copy is not:
 * "thumbnailUrl":"http:\/\/virtual-marketer.de\/…Jens-Goeckus.avif" — an
 * http:// URL on a site that redirects everything to https, frozen at
 * scrape time and never updated as the rest of the pipeline moved to
 * self-hosted, https-only asset URLs.
 *
 * WHY A COUNT CHECK RATHER THAN A FIXED PAGE LIST
 *
 * Which pages get their own schema is decided in three different generators
 * (generate-impressum.js, generate-accessibility-statement.js, and the
 * per-page table inside seo-optimize.js), and that list already changed
 * once this session alone. A fixed list here would silently stop matching
 * the moment any of those three tables gained or lost an entry. Counting
 * `application/ld+json` blocks on the page at this point in the pipeline —
 * after every schema-injecting step has run — answers the actual question
 * ("does this page have a replacement already") directly, and needs no
 * second list to keep in sync.
 *
 * Deliberately narrow: only ever removes the specific Yoast block, never
 * touches any other application/ld+json script, and never removes anything
 * from a page where it would be the last one standing.
 *
 * Runs last among the schema-writing steps, after seo-optimize.js,
 * generate-impressum.js and generate-accessibility-statement.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const YOAST_BLOCK = /<script[^>]*\bclass=["']yoast-schema-graph["'][^>]*>[\s\S]*?<\/script>\s*/i;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🧹 Removing the leftover Yoast schema graph where it is now redundant...\n');

  let removed = 0;
  let keptAsOnlySource = 0;

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!YOAST_BLOCK.test(html)) continue;
    YOAST_BLOCK.lastIndex = 0;

    const totalBlocks = (html.match(/<script[^>]*application\/ld\+json[^>]*>/gi) || []).length;
    if (totalBlocks <= 1) {
      keptAsOnlySource++;
      continue;
    }

    const next = html.replace(YOAST_BLOCK, '');
    fs.writeFileSync(file, next);
    removed++;
  }

  console.log(`✅ ${removed} page(s) had the leftover Yoast schema removed (a current replacement already exists)`);
  console.log(`   • ${keptAsOnlySource} page(s) kept it — it is still their only structured data\n`);
}

main();
