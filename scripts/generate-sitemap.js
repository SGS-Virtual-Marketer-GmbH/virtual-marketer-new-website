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

function generateRobotsTxt() {
  return `# Virtual Marketer - robots.txt (auto-generated, see scripts/generate-sitemap.js)
User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /wp-login.php
Disallow: /wp-includes/
Disallow: /wp-content/plugins/
Disallow: /wp-json/
Disallow: /blog/page/
Disallow: /tag/
Disallow: /category/
Disallow: /author/
Disallow: /login/

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
