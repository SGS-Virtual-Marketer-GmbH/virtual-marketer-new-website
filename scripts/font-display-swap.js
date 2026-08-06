#!/usr/bin/env node

/**
 * Gives every @font-face an explicit font-display — `optional` for text,
 * `block` for icon fonts.
 *
 * Without it the browser uses the default `auto`, which in practice means a
 * block period of up to three seconds: the text is laid out but painted
 * invisibly until the webfont arrives. Lighthouse costs this at 970 ms on the
 * live homepage for Outfit alone, and lists nine fonts in total —
 * Outfit, Nunito Sans (four weights), Flaticon, and two Font Awesome faces.
 *
 * WHY NOT swap, WHICH IS THE USUAL ANSWER
 *
 * swap was tried first and measured. It does fix the invisible-text delay —
 * and it moved the homepage's CLS from 0.005 to 0.593, because the fallback
 * and the webfont have different metrics and every line of text reflows at
 * swap time. Trading a 970 ms paint delay for a layout shift that large is a
 * bad deal: CLS is a Core Web Vital and 0.593 is roughly six times the
 * failing threshold.
 *
 * `optional` gives the browser a ~100 ms window: if the font is not ready it
 * keeps the fallback for that page load and never swaps, so there is no
 * shift at all. The font still downloads and is cached, so it is used from
 * the second page view onward. First-time visitors on a slow connection see
 * the fallback face — the honest cost, and a smaller one than a jumping page.
 *
 * Icon fonts are the exception and get `block`. Their fallback is a
 * missing-glyph box, so `optional` would mean a page whose icons are
 * permanently empty rectangles on first visit. `block` keeps them invisible
 * briefly and then correct, which for a glyph that carries meaning is the
 * right trade — and icons occupy fixed boxes, so their swap shifts nothing.
 *
 * Operates on the stylesheets in dist/, so it survives a re-scrape: nothing
 * upstream has to remember to set it.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function findStylesheets(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findStylesheets(full, results);
    // The scrape keeps the query string in the filename, so a plain
    // endsWith('.css') misses "style.css?ver=7.0.1.css" — match anywhere.
    else if (/\.css(\?|$)/i.test(entry.name) || entry.name.toLowerCase().endsWith('.css')) results.push(full);
  }
  return results;
}

/**
 * Icon fonts, matched on the family name declared in the rule. These render
 * meaningless glyphs in a fallback face, so they must not use `optional`.
 */
const ICON_FAMILIES = /font-family\s*:\s*["']?\s*(fontawesome|font awesome|flaticon|icomoon|elementor-icons|eicons|themify|simple-line)/i;

/** The only values a font-display may take. Anything else is not a value. */
const VALID_DISPLAY = /font-display\s*:\s*(auto|block|swap|fallback|optional)\s*[;}]?/i;

/**
 * Rewrites @font-face blocks in a stylesheet body.
 *
 * TWO CASES THAT LOOK LIKE "ALREADY DONE" AND ARE NOT
 *
 * 1. `font-display:;` — an empty value. The OMGF plugin wrote this into
 *    every face it localised (Outfit, DM Sans, the Elementor Font Awesome
 *    copies) because its WordPress option was never set. It is invalid CSS,
 *    so the browser discards the declaration and the face falls back to
 *    `auto` — block for up to three seconds, then swap, then a reflow of
 *    every line it touches. This is what an earlier version of this script
 *    missed: it tested for the PRESENCE of the property, and an empty value
 *    is present. Measured cost on the live homepage: CLS 0.121–0.295, with
 *    Lighthouse naming "Web font loaded" as the cause, on the two fonts the
 *    page actually renders its body copy in.
 *
 * 2. `font-display:swap` — a real value, and the wrong one here. See the
 *    header comment: swap was measured on this site at CLS 0.593. The
 *    theme's local Roboto copies declare it explicitly, so leaving
 *    "already has a value" alone would preserve exactly the setting this
 *    script exists to avoid.
 *
 * So the test is on the VALUE, not the property, and an existing swap on a
 * text face is rewritten rather than respected.
 */
function addSwap(css, counters) {
  return css.replace(/@font-face\s*\{([^}]*)\}/gi, (block, body) => {
    const wanted = ICON_FAMILIES.test(body) ? 'block' : 'optional';
    const current = body.match(VALID_DISPLAY);

    if (current) {
      const value = current[1].toLowerCase();
      if (value === wanted || (value !== 'swap' && value !== 'auto')) {
        counters.already++;
        return block;
      }
      // A real but unwanted value (swap, or an auto someone wrote out) —
      // replace in place rather than appending a second declaration.
      counters[wanted]++;
      counters.replaced++;
      return `@font-face{${body.replace(VALID_DISPLAY, `font-display:${wanted};`)}}`;
    }

    // Either no font-display at all, or one with an empty/garbage value.
    const cleaned = body.replace(/font-display\s*:[^;}]*;?/gi, '');
    counters[wanted]++;
    counters.added++;
    // Appended at the end of the block, before the closing brace.
    const trimmed = cleaned.replace(/\s*$/, '');
    const sep = /;\s*$/.test(trimmed) || trimmed === '' ? '' : ';';
    return `@font-face{${trimmed}${sep}font-display:${wanted};}`;
  });
}

function main() {
  console.log('\n🔤 Setting font-display...\n');

  const counters = { added: 0, replaced: 0, already: 0, optional: 0, block: 0 };
  let files = 0;

  for (const file of findStylesheets(DIST)) {
    const css = fs.readFileSync(file, 'utf-8');
    if (!/@font-face/i.test(css)) continue;
    const out = addSwap(css, counters);
    if (out !== css) {
      fs.writeFileSync(file, out);
      files++;
    }
  }

  // Inline <style> blocks in the HTML can declare faces too.
  let inlineFiles = 0;
  (function walkHtml(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walkHtml(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(full, 'utf-8');
      if (!/@font-face/i.test(html)) continue;
      const out = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (tag, body) =>
        /@font-face/i.test(body) ? tag.replace(body, addSwap(body, counters)) : tag
      );
      if (out !== html) { fs.writeFileSync(full, out); inlineFiles++; }
    }
  })(DIST);

  console.log(`✅ font-display added to ${counters.added} @font-face rule(s)`);
  console.log(`   • ${counters.optional} text font(s) → optional (no swap, so no layout shift)`);
  console.log(`   • ${counters.block} icon font(s) → block (a fallback glyph would be a blank box)`);
  console.log(`   • ${files} stylesheet(s), ${inlineFiles} inline <style> block(s)`);
  if (counters.replaced) console.log(`   • ${counters.replaced} rule(s) had swap/auto and were rewritten`);
  if (counters.already) console.log(`   • ${counters.already} already had the right font-display`);

  const missing = findStylesheets(DIST).filter((f) => {
    const css = fs.readFileSync(f, 'utf-8');
    if (!/@font-face/i.test(css)) return false;
    // A face counts as unset if it has no font-display OR an empty one —
    // the exact case this script used to walk past.
    for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      if (!VALID_DISPLAY.test(m[1])) return true;
    }
    return false;
  });
  if (missing.length) {
    console.log(`   ⚠ ${missing.length} stylesheet(s) still have a face without font-display:`);
    missing.slice(0, 5).forEach((f) => console.log(`       ${path.relative(DIST, f)}`));
  } else {
    console.log('   ✓ every @font-face now declares a font-display');
  }
  console.log();
}

main();
