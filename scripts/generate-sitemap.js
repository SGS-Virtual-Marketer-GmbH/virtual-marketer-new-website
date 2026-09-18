#!/usr/bin/env node

/**
 * Sitemap Auto-Generator
 *
 * Scans dist/ for all index.html pages (excluding WP admin/API leftovers,
 * redirect stubs, and asset directories) and generates an up-to-date
 * sitemap.xml + sitemap_index.xml + robots.txt referencing them.
 *
 * Run this as the LAST step of every build (see package.json "postbuild").
 * It is intentionally dependency-free (no glob package) so it runs
 * identically in CI/Docker without an npm install step.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';

// Directories that should never be treated as pages.
//
// /^category$/ used to be here alongside /tag/ and /author/, to keep out
// WordPress's own scraped archive pages. prune-thin-archives.js has since
// deleted every one of those — dist/ has no /tag/ or /author/ directory
// left, and its only directory literally named "category" is
// en/blog/category/, the real (and wanted) English mirror of
// /blog/kategorie/. Matching by bare directory name rather than full path
// meant that one entry silently swallowed the whole subtree: 8 indexable
// EN blog-category listing pages, walk() never descending into them at
// all. Removed for the same reason /blog/page/ came off EXCLUDE_PATH_PREFIXES
// below — the WordPress-archive content the pattern was written for is gone,
// and it now excludes only the site's own real pages.
const EXCLUDE_DIR_PATTERNS = [
  /^wp-content$/,
  /^wp-includes$/,
  /^wp-json$/,
  /^feed$/,
  /^comments$/,
];

// Slugs that are redirect stubs, not canonical content (kept out of sitemap)
const REDIRECT_SLUGS = new Set(['home']);

// Path prefixes that are duplicate-content archive artifacts from the
// original WordPress scrape — excluded from the sitemap to avoid
// duplicate-content signals; still reachable, just not submitted.
//
// /blog/page/ was on this list and has come off it. When it held WordPress's
// own scraped pagination that was right. It now holds the blog's real
// pagination, generated with per-page canonicals and rel=prev/next, and those
// pages are how a crawler reaches the 88 posts beyond the first twelve.
// Leaving them out would have kept most of the blog out of the index — the
// opposite of what excluding them was for. /blog/kategorie/ is listed for the
// same reason: each category page is a distinct, substantive listing.
const EXCLUDE_PATH_PREFIXES = ['/tag/', '/category/', '/author/', '/login/'];

// Priority + change frequency rules
function priorityFor(urlPath) {
  if (urlPath === '/') return { priority: '1.0', changefreq: 'weekly' };
  if (urlPath.startsWith('/blog/') && urlPath !== '/blog/') return { priority: '0.7', changefreq: 'monthly' };
  if (urlPath === '/blog/') return { priority: '0.9', changefreq: 'daily' };
  return { priority: '0.8', changefreq: 'monthly' };
}

function walk(dir, base, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIR_PATTERNS.some((re) => re.test(entry.name))) continue;
      walk(path.join(dir, entry.name), base, results);
    } else if (entry.name === 'index.html') {
      const relDir = path.relative(base, dir).split(path.sep).filter(Boolean);
      const slug = relDir[relDir.length - 1];
      if (slug && REDIRECT_SLUGS.has(slug)) continue;

      const urlPath = relDir.length === 0 ? '/' : `/${relDir.join('/')}/`;
      if (EXCLUDE_PATH_PREFIXES.some((prefix) => urlPath.startsWith(prefix))) continue;
      const stat = fs.statSync(path.join(dir, entry.name));
      results.push({ urlPath, lastmod: stat.mtime.toISOString().split('T')[0] });
    }
  }
}

function generateSitemapXML(pages) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const page of pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath))) {
    const { priority, changefreq } = priorityFor(page.urlPath);
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${page.urlPath}</loc>\n`;
    xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  }
  xml += '</urlset>\n';
  return xml;
}

function generateSitemapIndexXML() {
  const today = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemap.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

// Crawlers that should be able to read everything: classic search, plus the
// answer engines. Being readable by those is the whole point of the GEO work
// — a page that is not crawlable cannot be cited in an AI answer, and these
// are referral sources now, not just training scrapers.
const ALLOWED_BOTS = [
  'Googlebot',
  'Googlebot-Image',
  'Google-Extended',      // Gemini / AI Overviews grounding
  'Bingbot',
  'DuckDuckBot',
  'Applebot',
  'Applebot-Extended',
  'GPTBot',               // OpenAI crawler
  'OAI-SearchBot',        // ChatGPT search index
  'ChatGPT-User',         // live fetch when a user asks about the site
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'cohere-ai',
  'meta-externalagent',
];

// Commercial SEO/backlink scrapers and aggressive content harvesters. They
// cost bandwidth (and on Cloud Run, request billing) while returning nothing.
// Blocked here by request AND enforced in docker/nginx.conf, because
// robots.txt is a convention that only well-behaved bots honour — the nginx
// rule is what actually stops them.
const BLOCKED_BOTS = [
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'DataForSeoBot',
  'BLEXBot',
  'PetalBot',
  'SerpstatBot',
  'ZoominfoBot',
  'magpie-crawler',
  'Bytespider',
  'ImagesiftBot',
];

function generateRobotsTxt() {
  // Note what is NOT disallowed any more: /tag/, /category/, /author/ and
  // /blog/page/ used to be listed here. scripts/prune-thin-archives.js
  // deleted those pages and docker/nginx.conf now 301s them to /blog/ — and
  // a crawler cannot follow a redirect it is forbidden to request. Keeping
  // the old Disallow lines would strand whatever inbound links those URLs
  // still hold instead of passing them to /blog/.
  //
  // /login/ came off this list for the same "crawler can't see what it's
  // forbidden to request" reason. It is a real, publicly reachable page
  // (not an admin/API surface), so scripts/fix-title-meta-lengths.js now
  // marks it `noindex, follow` directly on the page instead — and that
  // meta tag only ever gets read if a crawler is allowed to fetch the page.
  // Disallowing it here would silence the noindex signal, not reinforce it:
  // Google's own guidance is that a disallowed-but-linked URL can still
  // surface in results (with no snippet), which is the outcome noindex is
  // meant to prevent. sitemap generation above independently keeps it out
  // of sitemap.xml via EXCLUDE_PATH_PREFIXES.
  //
  // /downloads/ is the whitepaper lead-magnet gate (see scripts/
  // generate-lead-magnet-pages.js and backend/src/routes/whitepaper.js):
  // the PDFs living there are only ever supposed to be reached through a
  // confirmed-email download link, never crawled or indexed directly —
  // both because that would hand the asset out for free without the lead
  // capture, and because an indexed PDF can outrank its own landing page
  // for the same queries. Listed here in `shared` (not just the default
  // `User-agent: *` block) so it applies to every allowed search/answer
  // engine too, the same way wp-admin/wp-json etc. do — this is a
  // convention-only signal for well-behaved crawlers; docker/nginx.conf.
  // template's `X-Robots-Tag: noindex, nofollow` on the same path is the
  // enforced half of this gate, for a page that fetches it anyway.
  const shared = [
    'Disallow: /wp-admin/',
    'Disallow: /wp-login.php',
    'Disallow: /wp-includes/',
    'Disallow: /wp-content/plugins/',
    'Disallow: /wp-json/',
    'Disallow: /downloads/',
  ].join('\n');

  const allowBlocks = ALLOWED_BOTS.map(
    (bot) => `User-agent: ${bot}\nAllow: /\n${shared}\n`
  ).join('\n');

  const blockBlocks = BLOCKED_BOTS.map((bot) => `User-agent: ${bot}\nDisallow: /\n`).join('\n');

  return `# Virtual Marketer - robots.txt (auto-generated, see scripts/generate-sitemap.js)

# --- Default policy -------------------------------------------------------
User-agent: *
Allow: /
${shared}

# --- Search and answer engines (explicitly welcome) -----------------------
${allowBlocks}
# --- SEO scrapers and harvesters (not welcome) ----------------------------
${blockBlocks}
# --- Discovery ------------------------------------------------------------
Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap_index.xml
`;
}

function main() {
  const pages = [];
  walk(DIST, DIST, pages);

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), generateSitemapXML(pages));
  fs.writeFileSync(path.join(DIST, 'sitemap_index.xml'), generateSitemapIndexXML());
  fs.writeFileSync(path.join(DIST, 'robots.txt'), generateRobotsTxt());

  console.log(`\n🗺️  Sitemap generated: ${pages.length} URLs`);
  pages
    .sort((a, b) => a.urlPath.localeCompare(b.urlPath))
    .forEach((p) => console.log(`   ${p.urlPath}`));
  console.log('\n✅ sitemap.xml, sitemap_index.xml, robots.txt written to dist/\n');
}

main();
