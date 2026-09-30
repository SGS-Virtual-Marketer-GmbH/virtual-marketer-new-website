#!/usr/bin/env node

/**
 * Completes the Article / BlogPosting structured data on every blog post.
 *
 * Google's Article rich result wants `image`, `datePublished`, `dateModified`,
 * `headline` and `author`. The post generators emit the last three, but not
 * `image` (151 posts) and, on the legacy scraped posts, sometimes not
 * `dateModified` (42 posts). Both values already exist on the same page, so
 * nothing is invented here:
 *
 *   image         <- the page's own og:image (the generated 1200x630 card)
 *   dateModified  <- article:modified_time, else the node's datePublished
 *   datePublished <- article:published_time, only when the node has none
 *
 * Runs after scripts/inject-social-meta.js, because that is what puts the
 * og:image meta tags on the page.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const LD_RE = /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi;
const ARTICLE = new Set(['Article', 'BlogPosting', 'NewsArticle']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === 'index.html') out.push(full);
  }
  return out;
}

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return m ? m[1] : '';
};

function isArticle(node) {
  const t = node && node['@type'];
  return (Array.isArray(t) ? t : [t]).some((x) => ARTICLE.has(x));
}

function main() {
  console.log('\n🧩 Completing Article structured data (image, dateModified)...\n');
  let pages = 0;
  let nodesFixed = 0;

  for (const file of walk(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!/"@type"\s*:\s*"(?:Article|BlogPosting|NewsArticle)"/.test(html)) continue;

    const ogImage = meta(html, 'og:image');
    const published = meta(html, 'article:published_time');
    const modified = meta(html, 'article:modified_time');
    let changed = false;

    const out = html.replace(LD_RE, (whole, open, body, close) => {
      let json;
      try { json = JSON.parse(body); } catch { return whole; }
      const nodes = Array.isArray(json) ? json : json['@graph'] || [json];
      let touched = false;
      for (const n of nodes) {
        if (!isArticle(n)) continue;
        if (!n.image && ogImage) { n.image = [ogImage]; touched = true; }
        if (!n.datePublished && published) { n.datePublished = published; touched = true; }
        if (!n.dateModified && (modified || n.datePublished)) { n.dateModified = modified || n.datePublished; touched = true; }
        if (touched) nodesFixed++;
      }
      if (!touched) return whole;
      changed = true;
      return `${open}${JSON.stringify(json)}${close}`;
    });

    if (changed) { fs.writeFileSync(file, out); pages++; }
  }

  console.log(`   ✓ ${nodesFixed} Article node(s) completed on ${pages} page(s)\n`);
}

main();
