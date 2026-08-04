#!/usr/bin/env node

/**
 * Nested Document Unwrapper
 *
 * Three pages ship a complete second HTML document — <html><head>…</head>
 * <body>…</body></html> — pasted inside the outer page's <body>:
 *
 *   /management/
 *   /virtual-marketer-ai-services/
 *   /blog/multimodale-ki-die-zukunft-des-verstaendnisses-von-text-bild-und-ton/
 *
 * They came from WordPress "Custom HTML" blocks that got a whole standalone
 * page pasted into them instead of a fragment. Browsers paper over it (the
 * HTML parser drops a nested <html>/<head>/<body> and renders the contents
 * inline), which is why nobody noticed visually — but each page really does
 * serve two <title> tags and two meta descriptions, and a crawler has no
 * principled way to pick. That is a genuine indexing risk on a page like
 * /management/, which is the company's own team page.
 *
 * The unwrap keeps the outer <head> authoritative: its <title>, description
 * and canonical are the ones the rest of the pipeline maintains and the ones
 * the sitemap, hreflang and og: tags already agree with. So the inner
 * <title>/<meta> are dropped, and only the inner head's <style> and
 * <link rel="stylesheet"> are kept — those are load-bearing (the pages are
 * built with the Tailwind services bundle) and get hoisted into the outer
 * <head>, which is where a stylesheet belongs. Then the inner <html>,
 * <head>, <body> and their closers are removed, leaving the inner body's
 * markup exactly where it already rendered.
 *
 * All the inner stylesheets are self-hosted (assets/tailwind-services,
 * local omgf font CSS) — verified before writing this, since hoisting an
 * external stylesheet would have quietly reintroduced a third-party request.
 *
 * Also swaps the one remaining via.placeholder.com hotlink (a 60px demo
 * "Produktbild" on /virtual-marketer-ai-services/) for an inline SVG data
 * URI: same look, no external request, no extra file to ship.
 *
 * Run after the page generators, before scripts/seo-optimize.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

// Neutral grey product-image placeholder, inlined so it costs no request.
const PLACEHOLDER_SVG =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">' +
      '<rect width="60" height="60" rx="8" fill="#e5e7eb"/>' +
      '<path d="M14 40l10-12 7 8 5-5 10 9z" fill="#9ca3af"/>' +
      '<circle cx="22" cy="20" r="4" fill="#9ca3af"/>' +
    '</svg>'
  );

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/**
 * Locates a nested <html> that starts after the outer <body>. Returns null
 * when the page is well-formed, which is the case for all but three pages.
 */
function findNestedDocument(html) {
  const outerBody = html.search(/<body[\s>]/i);
  if (outerBody === -1) return null;

  const inner = [...html.matchAll(/<html[\s>]/gi)].find((m) => m.index > outerBody);
  if (!inner) return null;

  const closeHtml = html.toLowerCase().indexOf('</html>', inner.index);
  if (closeHtml === -1) return null;

  return { start: inner.index, end: closeHtml + '</html>'.length };
}

function main() {
  console.log('\n🪆 Unwrapping nested HTML documents...\n');

  let fixed = 0;
  let hoisted = 0;
  let placeholders = 0;

  for (const file of findHtmlFiles(DIST)) {
    const original = fs.readFileSync(file, 'utf-8');
    let html = original;

    const nested = findNestedDocument(html);
    if (nested) {
      const url = '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/index\.html$/, '');
      let block = html.slice(nested.start, nested.end);

      // Pull the load-bearing bits out of the inner <head> before dropping it.
      const innerHead = block.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      let carry = '';
      if (innerHead) {
        const keep = [
          ...(innerHead[1].match(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi) || []),
          ...(innerHead[1].match(/<style\b[\s\S]*?<\/style>/gi) || []),
        ];
        carry = keep.join('\n');
        hoisted += keep.length;
      }

      // Strip the inner document's structural tags; keep everything else.
      block = block
        .replace(/<head[^>]*>[\s\S]*?<\/head>/i, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '');

      html = html.slice(0, nested.start) + block + html.slice(nested.end);

      if (carry) {
        const headClose = html.search(/<\/head>/i);
        if (headClose !== -1) {
          html = html.slice(0, headClose) + carry + '\n' + html.slice(headClose);
        }
      }

      console.log(`   • ${url} — inner document unwrapped, ${carry ? 'stylesheets hoisted' : 'no stylesheets to hoist'}`);
      fixed++;
    }

    if (html.includes('via.placeholder.com')) {
      html = html.replace(/https?:\/\/via\.placeholder\.com\/\d+/gi, PLACEHOLDER_SVG);
      placeholders++;
    }

    if (html !== original) fs.writeFileSync(file, html);
  }

  console.log(`\n✅ ${fixed} nested document(s) unwrapped, ${hoisted} stylesheet/style tag(s) hoisted into the outer <head>`);
  console.log(`   • ${placeholders} page(s) moved off via.placeholder.com to an inline SVG\n`);
}

main();
