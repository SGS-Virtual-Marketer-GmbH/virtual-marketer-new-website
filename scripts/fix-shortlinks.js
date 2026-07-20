#!/usr/bin/env node

/**
 * Shortlink Reference Rewriter
 *
 * WordPress's "/?p=ID" shortlink format appears throughout the original
 * site's HTML (recent-post widgets, related-post links, CTA buttons like
 * "Demo buchen", author bio links, etc.) — the original wget mirror
 * captured the shortlink TARGETS as their own files (dist/index.html?p=ID.html)
 * rather than following through to each page's real canonical URL.
 *
 * scripts/build.js excludes those shortlink-target files from being copied
 * (they're malformed/duplicate copies of content that already exists at its
 * real URL — see the comment there for detail on file #58103, which even
 * had two different pages' <head> content merged together). But that means
 * every page that LINKS to one of those files via ?p=ID now points at
 * nothing — this was caught because it broke the "Demo buchen" CTA button
 * on all 45 legacy blog posts (?p=57684), but the same pattern affects 49
 * distinct IDs referenced thousands of times site-wide (recent-posts
 * widgets etc.), not just that one button.
 *
 * Fix: build an ID -> canonical URL map by matching <title> text between
 * the shortlink files (still present in the source scrape, since only
 * build.js's dist/ copy step excludes them) and the real pages already
 * copied into dist/, then rewrite every index.html%3Fp=ID(.html)? reference
 * in dist/ to a correct relative path to that canonical URL.
 *
 * Run after scripts/build.js, before scripts/generate-blog-posts.js (blog
 * posts' "Weiterlesen"/CTA links don't use this pattern, but running early
 * in the pipeline is simplest and cheap to re-run).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SCRAPE_SOURCE = path.join(require('os').homedir(), 'tmp_vm_scrape/virtual-marketer.de');

function findFiles(dir, pattern, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, pattern, results);
    else if (pattern.test(entry.name)) results.push(full);
  }
  return results;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1].trim() : null;
}

function main() {
  console.log('\n🔗 Rewriting WordPress shortlink (?p=ID) references...\n');

  // 1. Build ID -> title map from the shortlink files in the source scrape
  const shortlinkFiles = findFiles(SCRAPE_SOURCE, /^index\.html\?p=\d+\.html$/)
    .filter(f => path.dirname(f) === SCRAPE_SOURCE); // only the root-level ones build.js excludes
  const idToTitle = {};
  for (const f of shortlinkFiles) {
    const id = path.basename(f).match(/p=(\d+)/)[1];
    const title = extractTitle(fs.readFileSync(f, 'utf-8'));
    if (title) idToTitle[id] = title;
  }
  console.log(`  Found ${Object.keys(idToTitle).length} shortlink IDs to resolve`);

  // 2. Build title -> canonical dist/ URL map from real pages already in dist/
  const distPages = findFiles(DIST, /^index\.html$/);
  const titleToUrl = {};
  for (const f of distPages) {
    const title = extractTitle(fs.readFileSync(f, 'utf-8'));
    if (!title) continue;
    const relDir = path.relative(DIST, path.dirname(f)).split(path.sep).join('/');
    titleToUrl[title] = relDir ? `/${relDir}/` : '/';
  }

  // 3. Resolve ID -> canonical URL, warn on anything unresolved
  const idToUrl = {};
  const unresolved = [];
  for (const [id, title] of Object.entries(idToTitle)) {
    if (titleToUrl[title]) {
      idToUrl[id] = titleToUrl[title];
    } else {
      unresolved.push(`${id} (${title})`);
    }
  }
  if (unresolved.length) {
    console.log(`  ⚠ Could not resolve ${unresolved.length} ID(s), left as-is:`);
    unresolved.forEach(u => console.log(`    - ${u}`));
  }

  // 4. Rewrite every reference across dist/, relative-path-aware
  const htmlFiles = findFiles(DIST, /\.html$/);
  let filesChanged = 0;
  let refsChanged = 0;

  for (const file of htmlFiles) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    html = html.replace(/(?:\.\.\/)*index\.html%3Fp=(\d+)(?:\.html)?/g, (match, id) => {
      if (!idToUrl[id]) return match; // leave unresolved refs untouched
      refsChanged++;
      // idToUrl is already the correct site-root-relative path; every page
      // in this static site resolves absolute paths the same way regardless
      // of nesting depth, so no relative-prefix math is needed here.
      return idToUrl[id];
    });

    if (html !== before) {
      fs.writeFileSync(file, html);
      filesChanged++;
    }
  }

  console.log(`\n✅ Rewrote ${refsChanged} reference(s) across ${filesChanged} file(s)\n`);
}

main();
