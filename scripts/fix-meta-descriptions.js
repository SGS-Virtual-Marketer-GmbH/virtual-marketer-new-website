#!/usr/bin/env node

/**
 * Meta Description Fixer
 *
 * Two defects found by the pre-deploy SEO audit, both inherited from the
 * WordPress scrape:
 *
 *   1. 43 legacy blog posts all carry the same site-wide fallback
 *      description, "Virtual Marketer - KI-Marketinglösung aus Deutschland."
 *      Duplicate descriptions across a whole content section are worse than
 *      having none — Google discards them and writes its own snippet, and
 *      the pages lose the chance to say what they are actually about. Each
 *      one now gets a description derived from its own opening paragraph.
 *
 *   2. 51 pages exceed ~165 characters and get cut off mid-word in the
 *      SERP. Those are trimmed back to a sentence or word boundary.
 *
 * Truncation is only ever applied to the meta description, never to visible
 * copy: the description is a summary of the page, so shortening it loses
 * nothing a reader sees. Titles are not touched here at all —
 * scripts/fix-page-titles.js owns those.
 *
 * og:description and twitter:description are kept in sync, otherwise social
 * previews would keep showing the old duplicate text.
 *
 * Runs LAST in the pipeline, after scripts/seo-optimize.js — which matters.
 * seo-optimize rebuilds the <head> of any page that does not already carry a
 * canonical + hreflang: it captures the existing description, strips the old
 * head tags, then re-injects. For the 44 legacy blog posts that capture comes
 * back empty and they get seo-optimize's site-wide fallback string, which is
 * exactly the generic description this script exists to remove. Running
 * before it meant every fix was silently overwritten a step later (the build
 * log cheerfully reported 60 descriptions trimmed while the shipped pages
 * were all identical). Running afterwards makes this script the last word on
 * what a page's description actually is.
 *
 * Still needs to run after scripts/strip-wp-cruft.js so the dead comment
 * block is gone and cannot leak into an extracted description.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const GENERIC = /^Virtual Marketer\s*[-–]\s*KI-Marketinglösung aus Deutschland\.?$/i;
const MAX_DESC = 158;   // comfortably inside the ~160-165 char SERP cutoff



function decodeEntities(s) {
  return s
    .replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&quot;|&#34;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&raquo;/g, '»')
    .replace(/&laquo;/g, '«')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Cuts at the last sentence end inside the limit, else the last whole word. */
function shorten(text, limit) {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentence > limit * 0.6) return window.slice(0, sentence + 1).trim();
  const word = window.lastIndexOf(' ');
  return (word > 0 ? window.slice(0, word) : window).replace(/[,;:–—-]+$/, '').trim() + '…';
}

/** Plain-text opening of the page's own article body. */
function extractLede(html) {
  const article = html.search(/<article\b/i);
  if (article === -1) return null;
  let body = html.slice(article);

  // Drop everything that is not prose before flattening to text.
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ');

  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 40 && !/^(von|by)\s/i.test(t));

  if (!paragraphs.length) return null;

  let text = paragraphs[0];
  for (let i = 1; i < paragraphs.length && text.length < 110; i++) text += ' ' + paragraphs[i];
  return text.trim();
}

function replaceMeta(html, selectorRe, value) {
  return html.replace(selectorRe, (tag) =>
    tag.replace(/content=(["'])[\s\S]*?\1/i, `content="${escapeAttr(value)}"`)
  );
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n📝 Fixing meta descriptions...\n');

  const stats = { derived: 0, trimmed: 0, titles: 0, unresolved: [] };

  for (const file of findHtmlFiles(DIST)) {
    const url = '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/index\.html$/, '');
    const original = fs.readFileSync(file, 'utf-8');
    let html = original;

    const descTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i);
    if (descTag) {
      const current = decodeEntities(((descTag[0].match(/content=(["'])([\s\S]*?)\1/i) || [])[2] || '').trim());
      let next = current;

      if (GENERIC.test(current) || current === '') {
        const lede = extractLede(html);
        if (lede) next = shorten(lede, MAX_DESC);
      }
      if (next.length > MAX_DESC) next = shorten(next, MAX_DESC);

      if (next && next !== current) {
        if (GENERIC.test(current) || current === '') stats.derived++;
        else stats.trimmed++;
        html = replaceMeta(html, /<meta[^>]+name=["']description["'][^>]*>/i, next);
        html = replaceMeta(html, /<meta[^>]+property=["']og:description["'][^>]*>/i, next);
        html = replaceMeta(html, /<meta[^>]+name=["']twitter:description["'][^>]*>/i, next);
      } else if (GENERIC.test(current)) {
        stats.unresolved.push(url);
      }
    }

    // Titles are deliberately not touched here — scripts/fix-page-titles.js
    // owns them end to end (brand suffix, clause trimming, og:/twitter:
    // mirrors). Two scripts editing the same tag in sequence made the build
    // log double-count and made it unclear which one produced a given title.
    if (html !== original) fs.writeFileSync(file, html);
  }

  console.log(`✅ Descriptions normalised`);
  console.log(`   • ${stats.derived} page(s) given a unique description from their own opening paragraph`);
  console.log(`   • ${stats.trimmed} over-long description(s) trimmed to ≤${MAX_DESC} chars`);

  if (stats.unresolved.length) {
    console.log(`   ⚠ ${stats.unresolved.length} page(s) still on the generic description (no usable body text):`);
    stats.unresolved.slice(0, 10).forEach((u) => console.log(`       ${u}`));
  }
  console.log('');
}

main();
