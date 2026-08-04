#!/usr/bin/env node

/**
 * Thin Archive Pruner
 *
 * The WordPress scrape brought along 21 auto-generated archive pages:
 * /author/virtualmarketer/ (+5 paginated), /tag/* (4), /category/* (6) and
 * /blog/page/N/ (5). They are pure duplicate surface — every one of them
 * lists posts that already have their own canonical URL, 59 of them share
 * the single meta description "Virtual Marketer - KI-Marketinglösung aus
 * Deutschland.", two pairs share a <title> outright, and none has an <h1>.
 *
 * They were already Disallow-ed in robots.txt, so they contribute nothing
 * to search today while still being served, crawlable via on-page links,
 * and carried around in the container image. Deleting them is strictly
 * better than keeping them blocked: a Disallow stops crawling, it does not
 * stop a URL that others link to from being indexed URL-only.
 *
 * Two halves to doing this safely:
 *
 *   1. Internal links (category/tag chips in post meta, the author byline,
 *      pagination) are rewritten to /blog/ *before* deletion, so the site
 *      never links into a redirect.
 *   2. Inbound links from outside still need to land somewhere, so
 *      docker/nginx.conf 301s /author/, /tag/, /category/ and /blog/page/
 *      to /blog/. That preserves whatever link equity those URLs hold and
 *      is why this is a prune plus a redirect rather than a plain delete.
 *
 * Run before scripts/generate-sitemap.js so the sitemap never lists them.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const TARGET_DIRS = ['author', 'tag', 'category', path.join('blog', 'page')];

// Any link whose path lands inside a pruned archive.
//
// The pagination alternative carries no "blog/" prefix on purpose: posts link
// to their archive pages relatively, as href="../page/1/index.html", so
// matching on "blog/page/N" alone missed all 44 of them. Matching a bare
// "page/N" is safe here because the only paginated section left after this
// prune is /blog/, and the match is anchored to a path boundary so it cannot
// fire on a slug that merely contains the word "page".
const ARCHIVE_LINK =
  /(?:\.\.\/)*\/?(?:author|tag|category)\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*\/?|(?:\.\.\/)*\/?(?:blog\/)?page\/\d+\/(?:index\.html)?|(?:\.\.\/)*\/?(?:blog\/)?page\/\d+\/?/g;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/** Relative path from a page to /blog/, so pages keep working at any depth. */
function blogHref(file) {
  const rel = path.relative(path.dirname(file), path.join(DIST, 'blog'));
  const href = rel.split(path.sep).join('/');
  return (href === '' ? '.' : href) + '/';
}

function main() {
  console.log('\n✂️  Pruning thin WordPress archives...\n');

  // --- 1. Repoint internal links at /blog/ -------------------------------
  const target = blogHref;
  let rewrittenPages = 0;
  let rewrittenLinks = 0;

  for (const file of findHtmlFiles(DIST)) {
    const url = '/' + path.relative(DIST, file).split(path.sep).join('/');
    // Pages that are themselves about to be deleted need no rewriting.
    if (/^\/(author|tag|category)\/|^\/blog\/page\//.test(url)) continue;

    const original = fs.readFileSync(file, 'utf-8');
    const to = target(file);
    let count = 0;

    // Only touch real link/attribute values, never prose that happens to
    // contain the word "category".
    const html = original.replace(
      /(\b(?:href|content)=)(["'])([^"']*)\2/gi,
      (full, attr, q, value) => {
        if (!/(?:^|\/)(?:author|tag|category)\/|(?:^|\/)page\/\d/.test(value)) return full;
        const next = value.replace(ARCHIVE_LINK, to);
        if (next === value) return full;
        count++;
        return `${attr}${q}${next}${q}`;
      }
    );

    if (count) {
      fs.writeFileSync(file, html);
      rewrittenPages++;
      rewrittenLinks += count;
    }
  }

  // --- 2. Delete the archive directories ---------------------------------
  let removed = 0;
  for (const dir of TARGET_DIRS) {
    const full = path.join(DIST, dir);
    if (!fs.existsSync(full)) continue;
    removed += findHtmlFiles(full).length;
    fs.rmSync(full, { recursive: true, force: true });
  }

  // /blog/page/ lived inside /blog/ — make sure removing it left /blog/ itself alone.
  if (!fs.existsSync(path.join(DIST, 'blog', 'index.html'))) {
    throw new Error('prune-thin-archives: /blog/index.html went missing — aborting rather than shipping a blog-less build');
  }

  console.log(`✅ Removed ${removed} thin archive page(s)`);
  console.log(`   • ${rewrittenLinks} internal link(s) across ${rewrittenPages} page(s) repointed to /blog/`);
  console.log(`   • inbound links handled by the 301s in docker/nginx.conf\n`);
}

main();
