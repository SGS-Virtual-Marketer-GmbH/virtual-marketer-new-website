#!/usr/bin/env node

/**
 * Newsletter signup injection — "Der Agentic Brief" / "The Agent Report".
 *
 * The UX/CRO audit (scratchpad/sweep/05-uxcro.md, finding #2, "the single
 * largest gap identified") found the site has exactly one conversion path —
 * book a 1:1 demo call — and nothing between that and reading a blog post.
 * This script adds the missing mid-funnel offer in the three placements the
 * content strategy (scratchpad/sweep/07-content.md, Section 5) calls for:
 *
 *   1. compact  — footer of EVERY page (238 pages, every template family)
 *   2. inline   — end of EVERY blog post (highest-intent placement: a reader
 *                 who finished the article)
 *   3. index    — the blog archive landing page (DE + EN, page 1 only)
 *
 * It also closes the specific gap the audit quantified in finding #6: 44 of
 * 92 DE blog posts (the legacy WordPress-exported ones) carry the current
 * template's `.vm-cta` demo-booking block; the other 44 have ZERO in-article
 * conversion path at all (`grep -l 'vm-cta'` over every dist/blog/<slug>/
 * index.html finds exactly the same 44 the audit found). Those 44 get an
 * extra contextual CTA
 * pointing at the gated whitepaper — not just the newsletter — since a
 * dead-end page deserves the more substantial offer, not only the lightest one.
 *
 * WHY A GENERIC "FIND THE LAST </footer>", NOT A PER-TEMPLATE HOOK
 *
 * There are four distinct footer markups across the site (the legacy WP
 * theme's `#site-footer`, and three inline-styled variants used by different
 * generators — verified by `grep -oh '<footer[^>]*>' dist/**\/*.html | sort
 * | uniq -c`: 106 + 55 + 45 + 31 + 1 = 238, i.e. exactly one `<footer>` per
 * page across the whole site). Rather than special-case four generators,
 * this inserts right before each page's own `</footer>` — a widget dropped
 * as the last element inside whatever footer already exists there, styled
 * entirely by its own scoped CSS so it looks the same regardless of which
 * footer it landed in.
 *
 * IDEMPOTENCE
 *
 * Every insertion is guarded by checking for the marker id it would create
 * (`vm-newsletter-footer`, `vm-newsletter-inline`, `vm-newsletter-index`,
 * `vm-lm-cta`) already being present in the file — a second run changes
 * nothing, matching the "second run = 0 changes" requirement for every
 * script in this pipeline.
 *
 * Run after inject-enhance.js (last content-injecting step) and before
 * inject-speculation-rules.js, so the widget's markup is final before that
 * step's prefetch rules are computed. Also run generate-lead-magnet-pages.js
 * before this script, so the whitepaper URL this script links to
 * (/whitepaper/agentic-marketing-2026/, /en/whitepaper/agentic-marketing-2026/)
 * already exists and this step never has to special-case a 404 it created.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const SRC_ASSETS = path.join(__dirname, '../assets/lead-magnet');
const DIST_ASSETS = path.join(DIST, 'assets/lead-magnet');

const CSS_MARKER = 'vm-lead-magnet-css';
const JS_MARKER = 'vm-lead-magnet-js';
const ASSET_TAGS =
  `<link rel="stylesheet" href="/assets/lead-magnet/newsletter-signup.css" id="${CSS_MARKER}">\n` +
  `<script src="/assets/lead-magnet/newsletter-signup.js" defer id="${JS_MARKER}"></script>\n`;

const WHITEPAPER_PATH = {
  de: '/whitepaper/agentic-marketing-2026/',
  en: '/en/whitepaper/agentic-marketing-2026/',
};

const CTA_COPY = {
  de: {
    heading: 'Kostenloses Whitepaper',
    body: 'Wie KI-Agenten Recherche, Kundenservice und Kampagnen übernehmen — mit einem realistischen Einstiegsplan, ohne erfundene Zahlen.',
    button: 'Whitepaper herunterladen',
  },
  en: {
    heading: 'Free whitepaper',
    body: 'How AI agents take on research, customer service and campaigns — with a realistic starting roadmap, no invented numbers.',
    button: 'Download the whitepaper',
  },
};

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function localeFor(relPath) {
  return relPath.split(path.sep)[0] === 'en' ? 'en' : 'de';
}

/** Blog POST pages only — excludes the archive index, /page/N/ and /kategorie/. */
function isBlogPost(relSegments) {
  // relSegments is e.g. ['blog','some-slug','index.html'] or ['en','blog','some-slug','index.html']
  const i = relSegments[0] === 'en' ? 1 : 0;
  if (relSegments[i] !== 'blog') return false;
  if (relSegments.length !== i + 3) return false; // blog / <slug> / index.html
  if (relSegments[i + 1] === 'page' || relSegments[i + 1] === 'kategorie') return false;
  return relSegments[i + 2] === 'index.html';
}

/** The two blog archive landing pages (page 1 only — deeper pages/categories
 * are not "the blog index" the content strategy calls out for this placement). */
function isBlogIndexPage(relSegments) {
  const i = relSegments[0] === 'en' ? 1 : 0;
  return relSegments.length === i + 2 && relSegments[i] === 'blog' && relSegments[i + 1] === 'index.html';
}

function widgetHtml(id, variant, locale) {
  return `<div data-vm-newsletter data-locale="${locale}" data-variant="${variant}" id="${id}"></div>`;
}

function ctaHtml(locale) {
  const c = CTA_COPY[locale];
  const href = WHITEPAPER_PATH[locale];
  return (
    `<div class="vm-lm-cta" id="vm-lm-cta">\n` +
    `  <strong>${c.heading}</strong>\n` +
    `  <p>${c.body}</p>\n` +
    `  <a class="vm-lm-cta-btn" href="${href}">${c.button}</a>\n` +
    `</div>`
  );
}

/** Insert `insertion` right before the LAST occurrence of `closingTag` in
 * `html`. Returns null if `closingTag` isn't found (page has no such element)
 * or if `guardMarker` is already present (idempotence). */
function insertBeforeLastClosing(html, closingTag, guardMarker, insertion) {
  if (html.includes(guardMarker)) return null;
  const idx = html.lastIndexOf(closingTag);
  if (idx === -1) return null;
  return html.slice(0, idx) + insertion + '\n' + html.slice(idx);
}

function ensureAssetsLoaded(html) {
  if (html.includes(CSS_MARKER)) return html;
  const headClose = html.indexOf('</head>');
  if (headClose === -1) return html;
  return html.slice(0, headClose) + ASSET_TAGS + html.slice(headClose);
}

function main() {
  console.log('\n📰 Injecting newsletter signup (footer / inline / blog index) + whitepaper CTA for dead-end posts...\n');

  fs.mkdirSync(DIST_ASSETS, { recursive: true });
  fs.copyFileSync(path.join(SRC_ASSETS, 'newsletter-signup.css'), path.join(DIST_ASSETS, 'newsletter-signup.css'));
  fs.copyFileSync(path.join(SRC_ASSETS, 'newsletter-signup.js'), path.join(DIST_ASSETS, 'newsletter-signup.js'));
  console.log('  ✓ Copied newsletter-signup.css / newsletter-signup.js to dist/assets/lead-magnet/');

  let footerCount = 0;
  let inlineCount = 0;
  let indexCount = 0;
  let ctaCount = 0;
  let touchedFiles = 0;

  for (const file of findHtmlFiles(DIST)) {
    const relPath = path.relative(DIST, file);
    const relSegments = relPath.split(path.sep);
    const locale = localeFor(relPath);

    let html = fs.readFileSync(file, 'utf-8');
    const before = html;
    let anyInsert = false;

    // 1. Compact widget in every page's footer.
    const footerInsert = insertBeforeLastClosing(
      html, '</footer>', 'vm-newsletter-footer',
      widgetHtml('vm-newsletter-footer', 'compact', locale)
    );
    if (footerInsert !== null) { html = footerInsert; anyInsert = true; footerCount++; }

    // 2. Blog posts: inline widget at the end of the article, plus (for
    //    posts with no existing conversion path) a whitepaper CTA before it.
    if (isBlogPost(relSegments)) {
      const hasOwnCta = html.includes('vm-cta');
      if (!hasOwnCta) {
        const ctaInsert = insertBeforeLastClosing(html, '</article>', 'vm-lm-cta', ctaHtml(locale));
        if (ctaInsert !== null) { html = ctaInsert; anyInsert = true; ctaCount++; }
      }
      const inlineInsert = insertBeforeLastClosing(
        html, '</article>', 'vm-newsletter-inline',
        widgetHtml('vm-newsletter-inline', 'inline', locale)
      );
      if (inlineInsert !== null) { html = inlineInsert; anyInsert = true; inlineCount++; }
    }

    // 3. Blog archive index (DE + EN, page 1 only).
    if (isBlogIndexPage(relSegments)) {
      const indexInsert = insertBeforeLastClosing(
        html, '</main>', 'vm-newsletter-index',
        widgetHtml('vm-newsletter-index', 'index', locale)
      );
      if (indexInsert !== null) { html = indexInsert; anyInsert = true; indexCount++; }
    }

    if (anyInsert) {
      html = ensureAssetsLoaded(html);
    }

    if (html !== before) {
      fs.writeFileSync(file, html);
      touchedFiles++;
    }
  }

  console.log(`  ✓ Footer widget added to ${footerCount} page(s)`);
  console.log(`  ✓ Inline widget added to ${inlineCount} blog post(s)`);
  console.log(`  ✓ Blog-index widget added to ${indexCount} page(s)`);
  console.log(`  ✓ Whitepaper CTA added to ${ctaCount} previously dead-end blog post(s)`);
  console.log(`\n✅ ${touchedFiles} file(s) touched\n`);
}

main();
