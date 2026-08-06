#!/usr/bin/env node

/**
 * Rebuilds the theme's "Aktuelle Beiträge" sidebar widget from the real post
 * set, instead of leaving the copy that was frozen into the WordPress export.
 *
 * WHAT WAS WRONG
 *
 * The widget is server-rendered markup: WordPress baked the five newest posts
 * into every page at export time and the scrape captured that HTML. Nothing
 * in this pipeline ever touched it again, so on 47 pages it still advertised
 * "Edge AI" (22 July 2025), "Multimodale KI" (21 July 2025) and a piece from
 * May 2024 — while the blog index beside it listed articles from 2026.
 *
 * A visitor reading a sidebar that stops a year before the newest article
 * concludes the site is abandoned, which is the opposite of what a "recent
 * posts" widget is for.
 *
 * WHERE THE POSTS COME FROM
 *
 * The same two sources the blog index uses — lib/blog-index.js's
 * loadManifests() for the authored posts and harvestLegacy() for the scraped
 * ones — so the widget cannot drift from the archive again. Crucially it also
 * uses the same splitByDate() gate, so a post dated in the future stays out
 * of the sidebar exactly as it stays out of the index. Without that the
 * widget would have become the one place on the site that leaks scheduled
 * posts early.
 *
 * SELF-LINKS
 *
 * A post's own page drops itself from its sidebar and backfills from the next
 * one down, so the list is never five items with one of them pointing at the
 * page you are already reading.
 *
 * DATE FORMAT
 *
 * The export wrote "Juli 22, 2025" — WordPress's US order with German month
 * names, which is not a format German uses. Regenerating gives it for free in
 * the real one ("22. Juli 2025"), from the same Intl formatter as the article
 * pages, so the sidebar and the byline beside it agree.
 */

const fs = require('fs');
const path = require('path');
const BI = require('./lib/blog-index');

const DIST = path.join(__dirname, '../dist');
const DIST_BLOG = path.join(DIST, 'blog');

/** How many the theme's widget was built to show. */
const LIMIT = 5;

/**
 * The whole <ul>, so the replacement controls the list itself rather than
 * trying to patch individual <li>s. No <ul> nests inside it, so non-greedy is
 * unambiguous here.
 */
const RECENT_UL = /(<ul class="recent-news[^"]*">)([\s\S]*?)(<\/ul>)/i;

function formatDateDE(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/** One <li>, matching the theme's own structure so the widget CSS still applies. */
function itemHtml(post) {
  const date = post.date ? formatDateDE(post.date) : '';
  return `                <li class="clearfix">
                    <div class="entry-header">
                        <h6>
                            <a href="/blog/${BI.esc(post.slug)}/">${BI.esc(post.title)}</a>
                        </h6>
                        ${date ? `<span class="post-on"><span class="entry-date">${date}</span></span>` : ''}
                    </div>
                </li>`;
}

function main() {
  console.log('\n🗞️  Refreshing the "Aktuelle Beiträge" widget...\n');

  const manifestPosts = BI.loadManifests();
  const knownSlugs = new Set(manifestPosts.map((p) => p.slug));
  const legacy = BI.harvestLegacy(DIST_BLOG, knownSlugs);

  // Same gate as the archive: a post dated in the future is not published.
  const today = new Date().toISOString().slice(0, 10);
  const { published, scheduled } = BI.splitByDate([...manifestPosts, ...legacy], today);

  if (!published.length) {
    console.log('   ⚠ no published posts found — leaving the widget alone');
    return;
  }

  // One more than the widget shows, so a post dropping its own self-link
  // still has a fifth item to promote.
  const pool = published.slice(0, LIMIT + 1);

  let pages = 0;
  let skipped = 0;
  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!RECENT_UL.test(html)) continue;

    // Which post IS this page, if any — so it can leave itself out.
    const rel = path.relative(DIST, file).split(path.sep).join('/');
    const selfMatch = /^blog\/([^/]+)\/index\.html$/.exec(rel);
    const selfSlug = selfMatch ? selfMatch[1] : null;

    const items = pool.filter((p) => p.slug !== selfSlug).slice(0, LIMIT);
    if (!items.length) { skipped++; continue; }

    const out = html.replace(
      RECENT_UL,
      (_m, open, _body, close) => `${open}\n${items.map(itemHtml).join('\n')}\n            ${close}`
    );
    if (out === html) { skipped++; continue; }

    fs.writeFileSync(file, out);
    pages++;
  }

  console.log(`✅ widget rebuilt on ${pages} page(s)${skipped ? ` (${skipped} skipped)` : ''}`);
  console.log(`   • ${published.length} published post(s) known, newest ${published.length ? published[0].date : '—'}`);
  console.log(`   • showing: ${pool.slice(0, LIMIT).map((p) => p.date).join(', ')}`);
  if (scheduled.length) {
    console.log(`   • ${scheduled.length} scheduled post(s) correctly withheld (next ${scheduled[0].date})`);
  }

  // The failure this script exists to end is a silently stale widget, so
  // assert the old dates are actually gone rather than trusting the count.
  const stale = findHtmlFiles(DIST).filter((f) => {
    const h = fs.readFileSync(f, 'utf-8');
    const m = RECENT_UL.exec(h);
    return m && /Juli 22, 2025|Mai 15, 2024/.test(m[2]);
  });
  if (stale.length) {
    console.log(`   ⚠ ${stale.length} page(s) still show the frozen export dates:`);
    stale.slice(0, 5).forEach((f) => console.log(`       ${path.relative(DIST, f)}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ no page still carries the frozen export dates\n');
  }
}

main();
