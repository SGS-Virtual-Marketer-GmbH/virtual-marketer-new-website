#!/usr/bin/env node

/**
 * Builds the site search index — one small JSON file per language.
 *
 * WHAT THIS IS FOR
 *
 * The site had no way to search itself. Finding a blog post meant already
 * knowing which category it was filed under and paging through the archive;
 * finding a product meant already knowing it existed. This builds the data
 * half of a real site-wide search: every blog post, every solution page and
 * the core marketing pages, each reduced to a title, an excerpt and a URL.
 *
 * NO LLM, ON PURPOSE
 *
 * This is a keyword index, not a semantic one, matched at query time in the
 * browser by scripts/../assets/search/search.js using the exact same
 * fold-and-substring approach the blog archive's own search already uses
 * (scripts/lib/blog-index.js, searchScript()) — lowercase, strip German
 * umlauts to their ASCII form, then every query word must appear as a
 * substring of the title+excerpt text. It is not clever, and that is the
 * point: it runs in a few milliseconds against ~250 short documents with no
 * network round trip and no model call, which a semantic search cannot do
 * from a static site with no backend to call.
 *
 * READS THE BUILT SITE, NOT THE SOURCE DATA
 *
 * Blog posts could be indexed from blog-posts.json plus a legacy-post
 * harvest, the way the archive page itself is built. This does it
 * differently: it reads title and meta-description straight off the
 * already-built HTML in dist/. That means the index can never disagree with
 * what a visitor actually finds when they click through — a scheduled post
 * that generate-blog-posts.js has correctly withheld has no page yet and is
 * automatically absent from the index too, with no separate "is it
 * published" check to keep in sync.
 *
 * SCOPE: NOT EVERY PAGE
 *
 * Blog posts, the 16 solution pages (DE and EN), and a short curated list of
 * core marketing pages (home, solutions hub, contact, demo booking, custom-
 * model request, FAQ). Deliberately excluded: the legal pages (Impressum,
 * privacy policy, terms, the accessibility statement) and the blog's own
 * paginated/category archive pages. Nobody searches a marketing site for
 * "privacy policy", and indexing 173 near-duplicate category/pagination
 * pages would bury the results that matter under noise for no benefit —
 * the legal pages are one click away in the footer of every page already.
 *
 * Run late — after every page-generating step, so dist/ reflects the final
 * built site, and after scripts/generate-sitemap.js so scheduled posts have
 * already been excluded consistently in both places.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const OUT_DIR = path.join(DIST, 'assets/search');

function decodeEntities(s) {
  return (s || '')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/&#8217;|&rsquo;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** Title, description and h1 off a built page, decoded and whitespace-tidied. */
function readMeta(file) {
  const html = fs.readFileSync(file, 'utf-8');
  const title = decodeEntities(
    ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ')
  );
  const description = decodeEntities(
    ((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '').replace(
      /\s+/g,
      ' '
    )
  );
  return { title, description };
}

function findHtmlFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name === 'index.html') results.push(full);
  }
  return results;
}

/**
 * A directory of blog post pages, minus the pagination/category noise.
 * /blog/page/2/, /blog/kategorie/seo/, /blog/kategorie/seo/page/2/ — all of
 * that is filtered out by requiring the directory to be a direct child of
 * `blogDir` whose name is not "page" or "kategorie"/"category".
 */
function blogPosts(blogDir, urlPrefix, type) {
  if (!fs.existsSync(blogDir)) return [];
  const skip = new Set(['page', 'kategorie', 'category']);
  const docs = [];
  for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || skip.has(entry.name)) continue;
    const file = path.join(blogDir, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const { title, description } = readMeta(file);
    if (!title) continue;
    docs.push({ title, excerpt: description, url: `${urlPrefix}${entry.name}/`, type });
  }
  return docs;
}

function solutionPages(hubDir, urlPrefix, type) {
  if (!fs.existsSync(hubDir)) return [];
  const docs = [];
  for (const entry of fs.readdirSync(hubDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(hubDir, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const { title, description } = readMeta(file);
    if (!title) continue;
    docs.push({ title, excerpt: description, url: `${urlPrefix}${entry.name}/`, type });
  }
  return docs;
}

function corePage(file, url, type) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) return null;
  const { title, description } = readMeta(full);
  if (!title) return null;
  return { title, excerpt: description, url, type };
}

const CORE_DE = [
  ['index.html', '/', 'page'],
  ['ki-loesungen/index.html', '/ki-loesungen/', 'page'],
  ['kontakt/index.html', '/kontakt/', 'page'],
  ['virtual-marketer-demo/index.html', '/virtual-marketer-demo/', 'page'],
  ['modell-anfragen/index.html', '/modell-anfragen/', 'page'],
  ['faqs/index.html', '/faqs/', 'page'],
  ['blog/index.html', '/blog/', 'page'],
];

const CORE_EN = [
  ['en/index.html', '/en/', 'page'],
  ['en/solutions/index.html', '/en/solutions/', 'page'],
  ['en/contact/index.html', '/en/contact/', 'page'],
  ['en/demo/index.html', '/en/demo/', 'page'],
  ['en/request-custom-model/index.html', '/en/request-custom-model/', 'page'],
  ['en/faqs/index.html', '/en/faqs/', 'page'],
  ['en/blog/index.html', '/en/blog/', 'page'],
];

/** Trims the excerpt to a sane length — some meta descriptions run long. */
function trimExcerpt(s, max = 160) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function buildIndex(lang) {
  const docs = [];

  if (lang === 'de') {
    docs.push(...blogPosts(path.join(DIST, 'blog'), '/blog/', 'blog'));
    docs.push(...solutionPages(path.join(DIST, 'ki-loesungen'), '/ki-loesungen/', 'solution'));
    for (const [file, url, type] of CORE_DE) {
      const doc = corePage(file, url, type);
      if (doc) docs.push(doc);
    }
  } else {
    docs.push(...blogPosts(path.join(DIST, 'en/blog'), '/en/blog/', 'blog'));
    docs.push(...solutionPages(path.join(DIST, 'en/solutions'), '/en/solutions/', 'solution'));
    for (const [file, url, type] of CORE_EN) {
      const doc = corePage(file, url, type);
      if (doc) docs.push(doc);
    }
  }

  // Compact keys — this file ships to every visitor's browser on first
  // search, so t/e/u/y beat title/excerpt/url/type at ~250 documents.
  return docs.map((d) => ({
    t: d.title,
    e: trimExcerpt(d.excerpt || ''),
    u: d.url,
    y: d.type,
  }));
}

function main() {
  console.log('\n🔎 Building the search index...\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let totalBytes = 0;
  for (const lang of ['de', 'en']) {
    const index = buildIndex(lang);
    const json = JSON.stringify(index);
    const file = path.join(OUT_DIR, `index.${lang}.json`);
    fs.writeFileSync(file, json);
    totalBytes += json.length;

    const byType = {};
    for (const d of index) byType[d.y] = (byType[d.y] || 0) + 1;
    console.log(
      `   • ${lang}: ${index.length} document(s) — ${Object.entries(byType)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')} — ${(json.length / 1024).toFixed(1)} KB`
    );
  }

  console.log(`✅ search index built, ${(totalBytes / 1024).toFixed(1)} KB total\n`);

  // A near-empty index would mean the scrape patterns above stopped matching
  // — fail loudly rather than ship a search box that never finds anything.
  const de = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'index.de.json'), 'utf-8'));
  if (de.length < 50) {
    console.log(`   ⚠ only ${de.length} documents in the German index — expected 100+`);
    process.exitCode = 1;
  }
}

main();
