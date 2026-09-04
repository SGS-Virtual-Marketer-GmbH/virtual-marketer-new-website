#!/usr/bin/env node

/**
 * Deepens the structured data across page types, filling three gaps the
 * earlier schema steps leave open:
 *
 * 1. FAQPage on the feature pages. All 32 of them (16 DE + 16 EN) render
 *    their FAQ section through the same generator markup —
 *    `<div class="faq-item"><p class="q">…</p><p class="a">…</p></div>` —
 *    but none declare it as schema. The Q&A text is extracted from the
 *    rendered page rather than re-stated here, so the markup and the schema
 *    can never drift apart (the copy itself comes verbatim from the product
 *    repo's appRegistry.ts and must not be paraphrased).
 *
 * 2. BreadcrumbList on every indexable page that lacks one. Coverage before
 *    this step is an accident of history: 44 legacy blog posts still have
 *    one inside their old Yoast graph, seo-optimize.js/add-en-structured-data.js
 *    give one to ~10 core pages each, and the other ~120 pages have none.
 *    The trail is derived from the canonical URL (segment labels from the
 *    table below, leaf name from the page's own <title>), with "Startseite"
 *    as the DE root to match what the legacy Yoast blocks already declare,
 *    and "Home" → /en/ on the English half.
 *
 * 3. Absolute publisher-logo URLs. The blog generators write
 *    `"logo":{"@type":"ImageObject","url":"/wp-content/…"}` — schema.org
 *    consumers require absolute URLs, and a relative one is silently
 *    dropped by Google's parser.
 *
 * Idempotent by construction: every insertion first checks whether the page
 * already carries that schema type, so the step can run at any point after
 * the last schema-writing step and never duplicates. It runs after
 * fix-page-titles.js / fix-meta-descriptions.js so the <title> it derives
 * breadcrumb leaf names from is the final, trimmed one.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';

// Labels for intermediate path segments only — the leaf crumb always takes
// its name from the page's <title>. Unknown segments fall back to a
// capitalized version of the slug.
const SEGMENT_LABELS = {
  blog: 'Blog',
  'ki-loesungen': 'KI-Lösungen',
  solutions: 'Solutions',
  faqs: 'FAQs',
};

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

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ');
}

function canonicalPath(html) {
  const m = html.match(/<link rel="canonical" href="https:\/\/virtual-marketer\.de(\/[^"]*)"/);
  return m ? m[1] : null;
}

function pageTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/);
  if (!m) return null;
  // Strip a trailing brand suffix ("… | Virtual Marketer", "… - Virtual
  // Marketer …") but never a title that merely starts with the brand name.
  return decodeEntities(m[1]).replace(/\s*[|\-–—]\s*Virtual Marketer.*$/, '').trim() || null;
}

function segmentLabel(seg) {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  return seg
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function breadcrumbFor(urlPath, title) {
  const isEn = urlPath === '/en/' || urlPath.startsWith('/en/');
  if (urlPath === '/' || urlPath === '/en/') return null; // nothing to crumb on a homepage

  const home = isEn
    ? { name: 'Home', item: `${BASE_URL}/en/` }
    : { name: 'Startseite', item: `${BASE_URL}/` };

  const segs = urlPath.split('/').filter(Boolean);
  if (isEn) segs.shift(); // /en/ is the root crumb, not a segment

  const items = [{ '@type': 'ListItem', position: 1, name: home.name, item: home.item }];
  let acc = isEn ? '/en' : '';
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLeaf = i === segs.length - 1;
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: isLeaf && title ? title : segmentLabel(seg),
      item: `${BASE_URL}${acc}/`,
    });
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}${urlPath}#breadcrumb`,
    itemListElement: items,
  };
}

function faqFor(html, urlPath) {
  const pairs = [];
  const re = /<div class="faq-item"><p class="q">([\s\S]*?)<\/p><p class="a">([\s\S]*?)<\/p><\/div>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const q = decodeEntities(stripTags(m[1]));
    const a = decodeEntities(stripTags(m[2]));
    if (q && a) pairs.push({ q, a });
  }
  if (!pairs.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${BASE_URL}${urlPath}#faq`,
    mainEntity: pairs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

function jsonLdTag(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>\n`;
}

function main() {
  console.log('\n🧬 Deepening structured data (FAQPage, BreadcrumbList, absolute logo URLs)...\n');

  let breadcrumbs = 0;
  let faqs = 0;
  let logosFixed = 0;

  for (const file of findHtmlFiles(DIST)) {
    if (path.basename(file) === '404.html') continue;

    let html = fs.readFileSync(file, 'utf-8');
    if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) continue;

    const headClose = html.indexOf('</head>');
    if (headClose === -1) continue;

    const urlPath = canonicalPath(html);
    let inserts = '';

    if (urlPath) {
      if (!html.includes('"BreadcrumbList"')) {
        const bc = breadcrumbFor(urlPath, pageTitle(html));
        if (bc) {
          inserts += jsonLdTag(bc);
          breadcrumbs++;
        }
      }
      if (!html.includes('"FAQPage"') && html.includes('class="faq-item"')) {
        const faq = faqFor(html, urlPath);
        if (faq) {
          inserts += jsonLdTag(faq);
          faqs++;
        }
      }
    }

    let next = inserts ? html.slice(0, headClose) + inserts + html.slice(headClose) : html;

    // Relative → absolute inside JSON-LD only: the pattern with the leading
    // escaped-or-plain quote and /wp-content only occurs in schema blocks.
    const fixed = next.replace(/("url":")\/wp-content/g, `$1${BASE_URL}/wp-content`);
    if (fixed !== next) {
      logosFixed++;
      next = fixed;
    }

    if (next !== html) fs.writeFileSync(file, next);
  }

  console.log(`✅ BreadcrumbList added to ${breadcrumbs} page(s)`);
  console.log(`   • FAQPage added to ${faqs} page(s)`);
  console.log(`   • ${logosFixed} page(s) had relative schema image URLs made absolute\n`);
}

main();
