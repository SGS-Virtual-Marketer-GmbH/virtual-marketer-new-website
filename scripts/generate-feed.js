#!/usr/bin/env node

/**
 * RSS 2.0 feeds for the blog — one DE, one EN.
 *
 * The site had no feed of any kind (no feed.xml/atom.xml anywhere in
 * dist/, no <link rel="alternate" type="application/rss+xml"> on any
 * page) — a content platform with 150 posts across two languages and no
 * subscribe mechanism at all, and no auto-discovery link for the readers
 * and aggregators that do look for one.
 *
 * DERIVED FROM THE RENDERED PAGE, NOT FROM blog-posts*.json
 *
 * The obvious data source looks like blog-posts.json /
 * blog-posts-en.json — but 44 of the 150 posts are legacy, scraped
 * WordPress pages that were never entered into those files (they predate
 * this pipeline entirely), so a JSON-driven feed would silently miss
 * almost a third of the blog. Every post — generated or legacy — DOES
 * carry a datePublished in its own JSON-LD (`BlogPosting` for the
 * generated posts, an `Article` in a Yoast `@graph` for the legacy ones),
 * so this script pulls title/description/date straight off the built
 * HTML the same way enrich-structured-data.js derives breadcrumbs from
 * the page's own <title> — one source of truth, and a post can never
 * drift out of sync with its own feed entry.
 *
 * Runs after generate-og-images.js (so og:title/description, when
 * present, are the final curated copy) and before generate-sitemap.js —
 * conceptually the same kind of "every URL on the site" pass, and this
 * one also needs to inject its own <link rel="alternate"> into blog pages
 * before those pages are otherwise done with head insertions.
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

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pageTitle(html) {
  const og = html.match(/<meta property="og:title" content="([^"]*)">/);
  if (og) return decodeEntities(og[1]);
  const t = html.match(/<title>([^<]*)<\/title>/);
  return t ? decodeEntities(t[1]).replace(/\s*[|\-–—]\s*Virtual Marketer.*$/, '').trim() : null;
}

function pageDescription(html) {
  const og = html.match(/<meta property="og:description" content="([^"]*)">/);
  if (og) return decodeEntities(og[1]);
  const d = html.match(/<meta name="description" content="([^"]*)">/);
  return d ? decodeEntities(d[1]) : '';
}

function pageDatePublished(html) {
  const m = html.match(/"datePublished":"([^"]+)"/);
  return m ? m[1] : null;
}

function toRfc822(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toUTCString().replace('GMT', '+0000');
}

function collectPosts(lang) {
  const root = lang === 'en' ? path.join(DIST, 'en/blog') : path.join(DIST, 'blog');
  if (!fs.existsSync(root)) return [];

  const posts = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'kategorie' || entry.name === 'category' || entry.name === 'page') continue;
    const file = path.join(root, entry.name, 'index.html');
    if (!fs.existsSync(file)) continue;

    const html = fs.readFileSync(file, 'utf-8');
    const title = pageTitle(html);
    const iso = pageDatePublished(html);
    if (!title || !iso) continue;

    const pubDate = toRfc822(iso);
    if (!pubDate) continue;

    posts.push({
      title,
      description: pageDescription(html),
      link: `${BASE_URL}/${lang === 'en' ? 'en/blog' : 'blog'}/${entry.name}/`,
      pubDate,
      isoDate: iso,
    });
  }

  posts.sort((a, b) => new Date(b.isoDate) - new Date(a.isoDate));
  return posts;
}

function buildFeed(lang, posts) {
  const isEn = lang === 'en';
  const feedUrl = `${BASE_URL}/${isEn ? 'en/blog' : 'blog'}/feed.xml`;
  const siteUrl = `${BASE_URL}/${isEn ? 'en/blog' : 'blog'}/`;
  const title = isEn ? 'Virtual Marketer Blog' : 'Virtual Marketer Blog';
  const description = isEn
    ? 'AI and marketing insights from Virtual Marketer.'
    : 'KI- und Marketing-Insights von Virtual Marketer.';
  const lastBuildDate = posts.length ? posts[0].pubDate : new Date().toUTCString().replace('GMT', '+0000');

  const items = posts
    .map(
      (p) => `    <item>
      <title>${escXml(p.title)}</title>
      <link>${escXml(p.link)}</link>
      <guid isPermaLink="true">${escXml(p.link)}</guid>
      <description>${escXml(p.description)}</description>
      <pubDate>${p.pubDate}</pubDate>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(title)}</title>
    <link>${escXml(siteUrl)}</link>
    <atom:link href="${escXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <description>${escXml(description)}</description>
    <language>${isEn ? 'en-US' : 'de-DE'}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/** Link the feed from every page in that language's blog section
 * (index, posts, category/archive, pagination) — insert-if-missing. */
function linkFeed(lang) {
  const root = lang === 'en' ? path.join(DIST, 'en/blog') : path.join(DIST, 'blog');
  if (!fs.existsSync(root)) return 0;

  const feedUrl = `${BASE_URL}/${lang === 'en' ? 'en/blog' : 'blog'}/feed.xml`;
  const title = lang === 'en' ? 'Virtual Marketer Blog (English)' : 'Virtual Marketer Blog';
  const tag = `<link rel="alternate" type="application/rss+xml" title="${escXml(title)}" href="${escXml(feedUrl)}">`;

  let linked = 0;
  for (const file of findHtmlFiles(root)) {
    let html = fs.readFileSync(file, 'utf-8');
    if (html.indexOf('</head>') === -1) continue;
    if (html.includes('type="application/rss+xml"')) continue;
    html = html.replace('</head>', `  ${tag}\n</head>`);
    fs.writeFileSync(file, html);
    linked++;
  }
  return linked;
}

function main() {
  console.log('\n📡 Generating RSS feeds for the blog (DE + EN)...\n');

  const dePosts = collectPosts('de');
  const enPosts = collectPosts('en');

  fs.writeFileSync(path.join(DIST, 'blog/feed.xml'), buildFeed('de', dePosts));
  fs.writeFileSync(path.join(DIST, 'en/blog/feed.xml'), buildFeed('en', enPosts));

  const deLinked = linkFeed('de');
  const enLinked = linkFeed('en');

  console.log(`✅ blog/feed.xml       — ${dePosts.length} post(s)`);
  console.log(`✅ en/blog/feed.xml    — ${enPosts.length} post(s)`);
  console.log(`   • <link rel="alternate" ...> added to ${deLinked} DE + ${enLinked} EN blog page(s)\n`);
}

main();
