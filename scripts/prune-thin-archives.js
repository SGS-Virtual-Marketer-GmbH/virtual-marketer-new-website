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

/**
 * WordPress's own thin archives. /blog/page/ is NOT in this list any more.
 *
 * It used to be, and correctly so: back then /blog/ was a single unpaginated
 * page and the WordPress /blog/page/N/ directories were duplicate surface
 * with nothing on them. scripts/generate-blog-posts.js now builds real
 * pagination at those same URLs — eight pages of twelve posts each, plus
 * /blog/kategorie/<slug>/ — so deleting the directory would delete the
 * blog's own navigation. The old WordPress pages are gone regardless: the
 * generator writes the directory fresh on every build.
 */
const TARGET_DIRS = ['author', 'tag', 'category'];

/**
 * Any link whose path lands inside a pruned archive.
 *
 * The pagination arm is still here, and still matches a bare "page/N"
 * without a "blog/" prefix, because the 44 scraped posts link to their old
 * archive as href="../page/1/index.html". Those old links point at
 * WordPress's pagination, whose page 1 was a different post ordering from
 * today's — sending them to /blog/ is right. What must NOT be rewritten is
 * the generator's own pagination, which is why PRESERVE below exists.
 */
const ARCHIVE_LINK =
  /(?:\.\.\/)*\/?(?:author|tag|category)\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*\/?|(?:\.\.\/)*\/?(?:blog\/)?page\/\d+\/(?:index\.html)?|(?:\.\.\/)*\/?(?:blog\/)?page\/\d+\/?/g;

/**
 * Pages whose links this step must leave alone.
 *
 * The generated archive pages link to /blog/page/2/ and friends on purpose.
 * Running the rewrite over them would collapse every pagination link to
 * /blog/, leaving eight pages that all point at page one — the failure would
 * look like "pagination does nothing" rather than like an error.
 */
const PRESERVE = [
  /^\/blog\/(page\/\d+\/)?index\.html$/,
  /^\/blog\/kategorie\//,
  // The English archive too. Leaving it out was not a hypothetical: the
  // build rewrote all four of /en/blog/'s pagination links to /blog/ —
  // pointing English readers at the German blog — and the only visible
  // symptom was a pagination bar with no page numbers in it.
  /^\/en\/blog\/(page\/\d+\/)?index\.html$/,
  /^\/en\/blog\/category\//,
];

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
    if (/^\/(author|tag|category)\//.test(url)) continue;
    // Pages whose pagination links are the real ones. See PRESERVE.
    if (PRESERVE.some((re) => re.test(url))) continue;

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
