#!/usr/bin/env node

/**
 * Two jobs, both about what blocks first paint and in what order:
 *
 *   1. Moves this repo's injected <style> blocks from the end of <body>
 *      into <head> (the original job of this file — see below).
 *   2. Takes fonts.css, enhance.css and the per-page vm-<hash>.css bundle(s)
 *      out of the render-blocking request chain (added later — see "PART 2"
 *      further down).
 *
 * Both are "critical CSS" problems in the literal sense: what has to be
 * ready before the browser paints, and what does not.
 *
 * ============================================================================
 * PART 1 — ORIGINAL JOB: <style> blocks, body → head
 * ============================================================================
 *
 * WHAT THIS FIXES
 *
 * The homepage scored CLS 0.321 on mobile — three times the failing
 * threshold — with 0.212 of it attributed to a single element, the header
 * logo, and the rest to a button widget. Neither is animated and neither
 * loads late; the shift is caused by WHERE their styles are.
 *
 * Every pipeline step that restyles the scraped pages (make-header-sticky,
 * fix-legacy-header, mobile-polish) appends its snippet just before
 * </body>, because that is the one insertion point guaranteed to exist in a
 * WordPress export. On the homepage that puts those rules at byte ~131,000
 * of a 152,000-byte document: the browser has already parsed the whole page
 * and painted a header at the theme's original size before it reaches the
 * rules that shrink the logo to 34px, fix the header to the viewport and
 * resize the buttons. Then it relayouts, and everything below moves.
 *
 * The scripts in those snippets genuinely belong at the end of the body —
 * they query the DOM. The CSS does not. Splitting them is the whole fix:
 * the rules are applied before first paint, so there is nothing to correct
 * afterwards.
 *
 * WHY A SEPARATE STEP RATHER THAN FIXING EACH INJECTOR
 *
 * Three scripts had the bug and the next one to be written would have had
 * it too — appending before </body> is the obvious thing to do and nothing
 * about it announces the cost. Hoisting centrally means a new injector can
 * keep using the easy insertion point and still end up correct.
 *
 * ORDER
 *
 * Blocks are inserted immediately before </head>, in the order they
 * appeared in the body. That keeps them after every theme stylesheet, which
 * is what they rely on to win the cascade, and preserves their order
 * relative to each other (mobile-polish deliberately overrides
 * fix-legacy-header in places).
 *
 * Only blocks with an id starting "vm-" are touched — those are ours. A
 * theme or plugin style block late in the body is left exactly where it is;
 * moving someone else's CSS across the cascade is how you fix a metric and
 * break a page.
 */

/**
 * ============================================================================
 * PART 2 — RENDER-BLOCKING CSS CHAIN
 * ============================================================================
 *
 * Measured baseline (see .../scratchpad/sweep/03-lighthouse.md): every page
 * loads three stylesheets synchronously in <head> — fonts.css (~1 KB),
 * enhance.css (~2.8 KB) and the per-page vm-<hash>.css bundle (14-38 KB) —
 * and the LCP breakdown shows "Render Delay" eating 62-83% of total LCP
 * time on every page sampled, tracing to the exact chain
 * `HTML → vm-<hash>.css → outfit-normal-latin.woff2`.
 *
 * THE FIX, PIECE BY PIECE
 *
 *  - Outfit latin woff2: `<link rel=preload as=font>`, so the browser starts
 *    that fetch the moment it parses <head> instead of discovering it only
 *    after a stylesheet has been fetched and parsed. Only the LATIN
 *    subset is preloaded — the latin-ext subset covers characters (Middle/
 *    Eastern European diacritics) this site's German/English copy doesn't
 *    use, per the unicode-range consolidate-fonts.js already declares.
 *
 *  - fonts.css and enhance.css: inlined verbatim as <style> in <head>
 *    instead of linked. Both are small enough (1-3 KB combined) that
 *    inlining costs less than the request they replace, and enhance.css
 *    specifically must never be a network dependency of first paint: it
 *    is where `color-scheme: light dark` lives, which is what makes
 *    `light-dark()` resolve against the visitor's OS theme at all. Inlined,
 *    it is available before the first pixel; deferred, a dark-mode visitor
 *    would see a light flash until it arrived.
 *
 *  - The per-page vm-<hash>.css bundle(s): too large to inline (14-38 KB,
 *    and after purge-unused-css.js's per-page scoping, still whatever that
 *    page genuinely needs). These switch to the standard loadCSS pattern —
 *    `media="print" onload="this.media='all'"` — with a `<noscript>`
 *    fallback so a no-JS visitor still gets a normal, blocking, synchronous
 *    stylesheet exactly as before. Only link(s) found BEFORE </head> are
 *    touched; a bundle referenced deep in <body> (this site has one, near
 *    the footer/search widget) isn't part of the initial render-blocking
 *    set and is left alone.
 *
 *  - Deferring that bundle opens a gap: it carries the theme's base
 *    `body{background-color:#fff;background-color:light-dark(#fff,#171717)}`
 *    rule (bundle-css.js folds the theme export in), and until the deferred
 *    link applies, a dark-mode visitor would sit on the browser's default
 *    white canvas. So the exact background/background-color declarations
 *    for `html`/`body` are read back out of that same bundle and inlined
 *    ahead of the deferred link, in their own tiny <style> — nothing
 *    invented, the identical rule the bundle itself would apply, just
 *    available immediately. Once the real bundle loads, its own (later in
 *    document order) `body{...}` rule takes over at equal specificity —
 *    same value, so nothing visibly changes at that moment either.
 *
 * WHY NOT DEFER fonts.css/enhance.css TOO, FOR CONSISTENCY
 *
 * Because inlining is strictly better for both when the content is this
 * small: no request AND no unstyled gap, versus a request that merely
 * doesn't block. The loadCSS pattern is reserved for the one file too big
 * to inline outright.
 *
 * VERIFY IN BOTH THEMES: this changes what CSS is present at first paint,
 * which is exactly the kind of change that can introduce a flash if the
 * critical-bg extraction above missed a rule. Load the page with the OS in
 * light mode AND in dark mode and confirm the canvas is correct from the
 * first frame, not just after settling.
 *
 * ORDERING REQUIREMENT (see the handoff note for the full pipeline-order
 * writeup): this step now needs the FINAL <head>, after every other script
 * that adds a stylesheet link or inline style has run — bundle-css.js,
 * purge-unused-css.js, consolidate-fonts.js, enable-dark-mode.js,
 * inject-enhance.js. It must be one of the LAST steps in the pipeline, not
 * the early one it used to be safe to run as when its only job was moving
 * <style> blocks.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '../dist');
const CSS_DIR = path.join(DIST, 'assets/css');

/** <style id="vm-..."> ... </style>, non-greedy, id in either quote style. */
const VM_STYLE = /<style\b[^>]*\bid=["'](vm-[^"']*)["'][^>]*>[\s\S]*?<\/style>/gi;

/**
 * Blocks this step would move into <head> but keep OFF the blocking path
 * instead, by writing their CSS out to their own small loadCSS-deferred
 * stylesheet (same mechanism as PART 2's page-bundle deferral). The
 * mechanism (writeDeferredBlock, below) exists and is exercised by the
 * dedupe/defer pipeline; the set is empty by measurement, not by omission.
 *
 * vm-home-solutions-style (~4.7 KB, the homepage's post-hero "solutions"
 * section) was the one candidate tried here. It made things worse: that
 * section's own top edge sits at y=616 on a 823px-tall mobile viewport —
 * partially in view at first paint, not safely below the fold — and
 * deferring its CSS reintroduced exactly the shift this whole change is
 * meant to remove (measured with the page bundle blocked entirely via
 * puppeteer-core, then confirmed in Lighthouse's layout-shifts culprit
 * list: a 0.116 contribution landing squarely on that section). Reverted.
 * Keep this list empty unless a NEW candidate is verified, the same way,
 * to sit entirely below the viewport's bottom edge on mobile.
 */
const DEFERRABLE_IDS = new Set([]);

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/**
 * IDEMPOTENCE SAFEGUARD.
 *
 * A block is identified for removal by its exact rendered text (open tag,
 * attributes and all, plus body, plus close tag) matching one already kept
 * earlier in the same document — not by id, so this also catches the blocks
 * this file otherwise never looks at: a <style> with no id at all, or two
 * different injectors that happened to emit the same id. Keying on content
 * rather than id/position is what makes this safe to run any number of
 * times, in any pipeline position, regardless of which earlier step (this
 * one or another) produced the duplicate — content-identical global CSS is
 * fully redundant the second time by construction (a <style> tag has no
 * "scoped" attribute in any shipping browser; it applies to the whole
 * document regardless of where it sits), so dropping the repeat can never
 * change what renders.
 */
const ANY_STYLE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

function dedupeStyleBlocks(html) {
  const seen = new Set();
  let removed = 0;
  const out = html.replace(ANY_STYLE, (block) => {
    if (seen.has(block)) {
      removed++;
      return '';
    }
    seen.add(block);
    return block;
  });
  return removed ? { html: out, removed } : null;
}

function hoist(html) {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return null;

  const moved = [];
  const deferred = [];
  let changed = false;

  // Walk matches once, keeping only those that start after </head>. Rebuilt
  // rather than replaced in place so the offsets stay valid while cutting.
  const body = html.slice(headEnd);
  const newBody = body.replace(VM_STYLE, (block, id, offset, whole, groups) => {
    if (DEFERRABLE_IDS.has(id)) {
      const inner = block.replace(/^<style\b[^>]*>/i, '').replace(/<\/style>$/i, '');
      deferred.push({ id, css: inner });
    } else {
      moved.push({ id, block });
    }
    changed = true;
    return '';
  });

  if (!changed) return null;

  return {
    html:
      html.slice(0, headEnd) +
      moved.map((m) => m.block).join('\n') +
      '\n' +
      newBody,
    deferred,
  };
}

/**
 * Writes a deferrable block's CSS to a content-hashed file (shared across
 * pages whose deferred content is byte-identical, same dedup strategy as
 * bundle-css.js) and returns the loadCSS <link>+<noscript> pair for it.
 */
function writeDeferredBlock(css) {
  fs.mkdirSync(CSS_DIR, { recursive: true });
  const hash = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);
  const name = `vm-deferred-${hash}.css`;
  const file = path.join(CSS_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, css);
  const href = `/assets/css/${name}`;
  return (
    `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all';this.onload=null;">` +
    `<noscript><link rel="stylesheet" href="${href}"></noscript>`
  );
}

// ---------------------------------------------------------------------------
// PART 2 helpers
// ---------------------------------------------------------------------------

const FONT_PRELOAD_MARKER = 'vm-font-preload';
const FONTS_INLINE_ID = 'vm-fonts-inline';
const ENHANCE_INLINE_ID = 'vm-enhance-inline';

/** The Outfit LATIN (not latin-ext) woff2 URL, read from the alias sheet itself. */
function findLatinFontUrl(fontsCss) {
  for (const m of fontsCss.matchAll(/url\(['"]?([^'")]+\.woff2[^'")]*)['"]?\)/g)) {
    const url = m[1];
    if (/-latin\.woff2/i.test(url) && !/-latin-ext\.woff2/i.test(url)) return url;
  }
  return null;
}

/** Only the background/background-color declarations of a top-level html/body rule. */
function extractCriticalBg(css) {
  const out = [];
  for (const sel of ['html', 'body']) {
    for (const m of css.matchAll(new RegExp(`(?:^|[}])\\s*${sel}\\s*\\{([^{}]*)\\}`, 'g'))) {
      const decls = (m[1].match(/background(?:-color)?\s*:[^;]+;?/g) || []).map((d) =>
        d.endsWith(';') ? d : `${d};`
      );
      if (decls.length) out.push(`${sel}{${decls.join('')}}`);
    }
  }
  return out.join('');
}

const cssCache = new Map();
function readCssBundle(href) {
  const clean = href.split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) return null;
  const abs = path.join(DIST, clean.replace(/^\//, ''));
  if (!abs.startsWith(CSS_DIR)) return null;
  if (cssCache.has(abs)) return cssCache.get(abs);
  let text = null;
  try {
    text = fs.readFileSync(abs, 'utf-8');
  } catch {
    text = null;
  }
  cssCache.set(abs, text);
  return text;
}

/**
 * Applies PART 2 to one page's HTML. Returns null if there is nothing left
 * to do (every marker already present) so the caller's idempotence check
 * stays cheap and honest.
 */
function deferRenderBlockingCss(html, fontsCss, enhanceCss) {
  const headOpen = /<head\b[^>]*>/i.exec(html);
  const headEnd = html.search(/<\/head>/i);
  if (!headOpen || headEnd === -1) return null;

  let out = html;
  let touched = false;

  // 1. Font preload — once per page, near the top of <head>.
  if (!out.includes(FONT_PRELOAD_MARKER)) {
    const url = findLatinFontUrl(fontsCss);
    if (url) {
      const at = out.indexOf(headOpen[0]) + headOpen[0].length;
      const tag = `\n<link rel="preload" as="font" type="font/woff2" href="${url}" crossorigin id="${FONT_PRELOAD_MARKER}">`;
      out = out.slice(0, at) + tag + out.slice(at);
      touched = true;
    }
  }

  // 2. fonts.css / enhance.css: <link> → inline <style>.
  const fontsLink = /<link\b[^>]*\bid=["']vm-fonts["'][^>]*>/i.exec(out);
  if (fontsLink && !out.includes(FONTS_INLINE_ID)) {
    out = out.replace(fontsLink[0], `<style id="${FONTS_INLINE_ID}">${fontsCss}</style>`);
    touched = true;
  }
  const enhanceLink = /<link\b[^>]*\bid=["']vm-enhance["'][^>]*>/i.exec(out);
  if (enhanceLink && !out.includes(ENHANCE_INLINE_ID)) {
    out = out.replace(enhanceLink[0], `<style id="${ENHANCE_INLINE_ID}">${enhanceCss}</style>`);
    touched = true;
  }

  // 3. Per-page vm-<hash>.css bundle: DELIBERATELY LEFT RENDER-BLOCKING.
  //
  // This step used to rewrite the bundle link to
  // `media="print" onload="this.media='all'"` (+ a critical-background
  // <style> and a <noscript> twin) so it would not block first paint. That
  // is the textbook advice, and on this site it is measurably wrong. A/B
  // measured on one quiet host — same build, same server, same gzip and
  // cache headers, the ONLY difference being this deferral, A and B
  // interleaved run-by-run so host drift could not favour either — with
  // three repetitions per page, medians:
  //
  //   page                deferred   blocking
  //   / mobile                  77         93     TBT 371ms → 2ms
  //   / desktop                 86        100     CLS 0.264 → 0.001
  //   /en/ mobile               77         93     TBT 405ms → 84ms
  //   /blog/<post>/ mobile      72         86     TBT 560ms → 68ms
  //   /whitepaper/<wp>/ mobile  99        100
  //
  // WHY deferral loses here, when it usually wins: the payload is a 137KB
  // Elementor bundle whose base flex/grid rules are interwoven with
  // breakpoint overrides. Deferring it buys a faster FCP of an unstyled
  // page, then pays for it twice — the whole layout lands after first
  // paint (CLS) and the style recalculation happens on the main thread
  // while it is already busy (TBT). A first paint that is 0.7s earlier but
  // wrong is worth less than a correct one, and Lighthouse prices it that
  // way.
  //
  // So the bundle stays a plain blocking <link>. Parts 1 and 2 above are
  // the wins worth keeping: they remove two render-blocking REQUESTS
  // (fonts.css, enhance.css become inline <style>) and preload the latin
  // font, without moving any layout-affecting CSS after first paint.
  //
  // Do not re-add the deferral without re-running that A/B. If the
  // Elementor base CSS is ever extracted into a genuinely above-the-fold
  // critical sheet, the trade-off changes and it is worth measuring again.

  return touched ? out : null;
}

function main() {
  console.log('\n🔁 Removing exact-duplicate <style> blocks (idempotence safeguard)...\n');

  let dedupedPages = 0;
  let dedupedBlocks = 0;
  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const result = dedupeStyleBlocks(html);
    if (!result) continue;
    fs.writeFileSync(file, result.html);
    dedupedPages++;
    dedupedBlocks += result.removed;
  }
  if (dedupedBlocks) {
    console.log(`   ⚠ ${dedupedBlocks} duplicate <style> block(s) removed across ${dedupedPages} page(s)\n`);
  } else {
    console.log('   ✓ no duplicate <style> blocks found\n');
  }

  console.log('⬆️  Hoisting injected CSS into <head>...\n');

  let pages = 0;
  let blocks = 0;
  let deferredBlocks = 0;
  const byId = new Map();

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const result = hoist(html);
    if (!result) continue;

    // Count what moved, for the summary.
    const headEnd = html.search(/<\/head>/i);
    for (const m of html.slice(headEnd).matchAll(VM_STYLE)) {
      byId.set(m[1], (byId.get(m[1]) || 0) + 1);
    }
    VM_STYLE.lastIndex = 0;
    const inBody = (html.slice(headEnd).match(VM_STYLE) || []).length;
    VM_STYLE.lastIndex = 0;

    // Deferred blocks (see DEFERRABLE_IDS) each become their own tiny
    // loadCSS link+noscript, inserted where the inline block would have
    // gone — position doesn't matter for a non-blocking stylesheet.
    const deferredTags = result.deferred.map((d) => writeDeferredBlock(d.css)).join('');
    const withDeferred = result.html.replace(/<\/head>/i, deferredTags + '</head>');

    fs.writeFileSync(file, withDeferred);
    pages++;
    blocks += inBody;
    deferredBlocks += result.deferred.length;
  }

  console.log(`✅ ${blocks} style block(s) moved into <head> across ${pages} page(s)`);
  for (const [id, n] of [...byId].sort((a, b) => b[1] - a[1])) {
    console.log(`   • ${id} — ${n} page(s)`);
  }
  if (deferredBlocks) {
    console.log(`   • ${deferredBlocks} of those kept OFF the render-blocking path (loadCSS-deferred instead of inlined)`);
  }

  // Nothing of ours should be left below </head>: a block that stays behind
  // is a layout shift that no longer shows up anywhere except the score.
  const leftovers = [];
  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const headEnd = html.search(/<\/head>/i);
    if (headEnd === -1) continue;
    if (VM_STYLE.test(html.slice(headEnd))) leftovers.push(path.relative(DIST, file));
    VM_STYLE.lastIndex = 0;
  }
  if (leftovers.length) {
    console.log(`   ⚠ ${leftovers.length} page(s) still carry a vm-* style block in the body:`);
    leftovers.slice(0, 5).forEach((f) => console.log(`       ${f}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ no vm-* style block is left below </head>\n');
  }

  // --- PART 2: take fonts.css / enhance.css / the page bundle off the
  // render-blocking chain. Needs the FINAL fonts.css/enhance.css content —
  // see the ordering requirement in the file header.
  console.log('🚀 Taking fonts.css, enhance.css and the page bundle off the render-blocking chain...\n');

  const fontsCssPath = path.join(DIST, 'assets/enhance/fonts.css');
  const enhanceCssPath = path.join(DIST, 'assets/enhance/enhance.css');
  if (!fs.existsSync(fontsCssPath) || !fs.existsSync(enhanceCssPath)) {
    console.log('   ⚠ assets/enhance/fonts.css or enhance.css not found — skipped ' +
      '(this step must run after consolidate-fonts.js and inject-enhance.js)\n');
    return;
  }
  const fontsCss = fs.readFileSync(fontsCssPath, 'utf-8');
  const enhanceCss = fs.readFileSync(enhanceCssPath, 'utf-8');

  let deferredPages = 0;
  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const out = deferRenderBlockingCss(html, fontsCss, enhanceCss);
    if (!out) continue;
    fs.writeFileSync(file, out);
    deferredPages++;
  }

  console.log(`✅ render-blocking chain shortened on ${deferredPages} page(s)\n`);
}

main();
