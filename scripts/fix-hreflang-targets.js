#!/usr/bin/env node

/**
 * Removes hreflang alternate links that point at pages which do not exist.
 *
 * Every DE blog post's `<link rel="alternate" hreflang="en" …>` and every EN
 * blog post's `hreflang="de"`/`hreflang="x-default"` are written assuming a
 * 1:1 slug match between /blog/<slug>/ and /en/blog/<slug>/. That match does
 * not hold in two directions:
 *
 * 1. Only 58 of the 92 DE posts have ever been translated (see
 *    blog-posts-en.json's own header) — the other 41 still declare
 *    hreflang="en" pointing at an /en/blog/<slug>/ that generate-en-blog-
 *    posts.js never created.
 * 2. 7 of the 58 translated posts point hreflang="de" (and, since x-default
 *    conventionally mirrors the German URL — see generate-en-blog-posts.js's
 *    pageShell()) hreflang="x-default" at a DE original that
 *    scripts/prune-thin-archives.js has since deleted.
 *
 * A hreflang pointing at a 404 is worse than no hreflang: it tells a search
 * engine a translation exists, sends its crawler to fetch it, and gets a
 * dead end. The fix here is targeted removal, not page generation — writing
 * the missing 41 EN translations (or resurrecting 7 pruned DE originals) is
 * a content decision for the blog generators, not something this pass
 * should invent copy for.
 *
 * - A broken hreflang="de" or hreflang="en" tag is deleted outright — the
 *   remaining tag(s) on the page (its own self-referencing hreflang, and any
 *   still-valid alternate) are untouched.
 * - A broken hreflang="x-default" is repointed at the page's OWN canonical
 *   URL rather than deleted. x-default must resolve to *something*, and a
 *   page with no valid translation is its own best fallback — this is the
 *   same choice the site already makes for every monolingual, non-blog page
 *   (e.g. /impressum/, which has no EN twin and sets x-default to itself).
 *
 * Reciprocity (every real alternate having a return link) and the use of
 * absolute URLs are both already correct across the other 632 hreflang
 * hrefs — this script only ever touches a tag whose target fails the
 * existence check below, so it cannot regress either of those.
 *
 * Run anywhere after the last script that can add or remove an indexable
 * page (prune-thin-archives.js) and before generate-sitemap.js — sitemap
 * generation doesn't read hreflang, but keeping SEO-tag fixes grouped
 * before the sitemap/robots step matches where fix-page-titles.js and
 * fix-meta-descriptions.js already sit. Idempotent: the existence check is
 * re-run fresh each time, and a fixed tag always passes it on the next run.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function canonicalPath(html) {
  const m = html.match(/<link rel="canonical" href="https:\/\/virtual-marketer\.de(\/[^"]*)"/);
  return m ? m[1] : null;
}

const HREFLANG_RE = /([ \t]*)<link rel="alternate" hreflang="([^"]+)" href="https:\/\/virtual-marketer\.de(\/[^"]*)">\n?/g;

function main() {
  console.log('\n🌍 Fixing hreflang tags that point at pages which no longer (or never) existed...\n');

  const files = findHtmlFiles(DIST);

  // Every page's own canonical URL is a real, existing page — that is the
  // full set of valid hreflang targets in this static site.
  const realPaths = new Set();
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf-8');
    const p = canonicalPath(html);
    if (p) realPaths.add(p);
  }

  let removed = 0;
  let xdefaultRepointed = 0;
  let filesTouched = 0;

  for (const file of files) {
    if (path.basename(file) === '404.html') continue;
    const html = fs.readFileSync(file, 'utf-8');
    if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) continue;

    const ownPath = canonicalPath(html);
    if (!ownPath) continue;

    let changed = false;
    const next = html.replace(HREFLANG_RE, (full, indent, lang, hrefPath) => {
      if (realPaths.has(hrefPath)) return full;

      changed = true;
      if (lang === 'x-default') {
        xdefaultRepointed++;
        return `${indent}<link rel="alternate" hreflang="x-default" href="${BASE_URL}${ownPath}">\n`;
      }
      removed++;
      return '';
    });

    if (changed) {
      fs.writeFileSync(file, next);
      filesTouched++;
    }
  }

  console.log(`✅ ${removed} broken hreflang alternate(s) removed`);
  console.log(`   • ${xdefaultRepointed} broken hreflang="x-default" repointed to their own page`);
  console.log(`   • ${filesTouched} file(s) touched\n`);
}

main();
