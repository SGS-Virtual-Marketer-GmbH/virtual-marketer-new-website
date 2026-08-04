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

// Directories that should never be treated as pages
const EXCLUDE_DIR_PATTERNS = [
  /^wp-content$/,
  /^wp-includes$/,
  /^wp-json$/,
  /^feed$/,
  /^comments$/,
  /^category$/,
  /^tag$/,
  /^author$/,
];

// Slugs that are redirect stubs, not canonical content (kept out of sitemap)
const REDIRECT_SLUGS = new Set(['home']);

// Path prefixes that are duplicate-content pagination/archive artifacts from
// the original WordPress scrape (e.g. /blog/page/2/) — excluded from the
// sitemap to avoid duplicate-content signals; still reachable, just not
// submitted for indexing.
const EXCLUDE_PATH_PREFIXES = ['/blog/page/', '/tag/', '/category/', '/author/', '/login/'];

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
  const shared = [
    'Disallow: /wp-admin/',
    'Disallow: /wp-login.php',
    'Disallow: /wp-includes/',
    'Disallow: /wp-content/plugins/',
    'Disallow: /wp-json/',
    'Disallow: /login/',
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
