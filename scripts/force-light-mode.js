#!/usr/bin/env node

/**
 * Pins the site to its light brand palette, for every visitor.
 *
 * WHY THIS EXISTS AS A SEPARATE STEP AND NOT AS A PILE OF EDITS
 *
 * The automatic dark theme was removed because it looked bad: a palette
 * derived mechanically in HSL from a light-first design is not a designed
 * dark theme, and the homepage shipped with the second clause of its hero
 * headline nearly illegible against the dark surface.
 *
 * Removing `scripts/enable-dark-mode.js` from the pipeline deletes the bulk
 * of it — that script was the source of the thousands of `light-dark()`
 * twins. But it was never the ONLY source. Dark values are also written by
 * hand in:
 *
 *   assets/enhance/enhance.css            assets/contact-form/contact-form.css
 *   assets/lead-magnet/newsletter-signup.css
 *   assets/lead-magnet/whitepaper-form.css
 *   scripts/generate-contact-page.js      scripts/generate-lead-magnet-pages.js
 *   scripts/inject-social-meta.js         scripts/hoist-critical-css.js
 *   scripts/normalize-brand-palette.js    scripts/generate-favicons.js
 *
 * plus the imported WordPress/WooCommerce CSS, which ships its own
 * `prefers-color-scheme: dark` blocks nobody here wrote. Chasing that across
 * twelve-plus files means the next person who adds a `light-dark()` quietly
 * reintroduces a half-dark site. So this runs LAST and makes the guarantee
 * structurally instead: whatever upstream emitted, the built output is light.
 *
 * WHAT IT DOES
 *
 *   1. `light-dark(<light>, <dark>)` → `<light>`, with real paren matching so
 *      nested functions survive: `light-dark(color-mix(in srgb,a,b), #000)`
 *      collapses to `color-mix(in srgb,a,b)`, not to `color-mix(in srgb,a`.
 *   2. `@media (prefers-color-scheme: dark) { … }` blocks are deleted, brace-
 *      matched so a nested rule cannot end the block early.
 *   3. `color-scheme: light dark` → `color-scheme: light`. This one matters
 *      beyond our own CSS: it pins form controls, scrollbars and input text
 *      to light, and it is what makes any `light-dark()` that somehow escapes
 *      step 1 still resolve light.
 *   4. The `<meta name="theme-color" media="(prefers-color-scheme: dark)">`
 *      twin is dropped so browser chrome stops going dark. The light one is
 *      kept and its media query stripped, so it applies unconditionally.
 *
 * Idempotent: after one pass there is no `light-dark(`, no dark media block
 * and no `light dark` left to match, so a second run is a no-op.
 *
 * TO RESTORE DARK MODE: remove this step from package.json AND re-add
 * enable-dark-mode.js AND put `color-scheme: light dark` back in
 * enhance.css. Do not do that without a hand-designed dark palette — the
 * derived one is what got removed.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

/** Collapses light-dark(a, b) to a, matching parens rather than regex. */
function collapseLightDark(text) {
  const NEEDLE = 'light-dark(';
  let out = '';
  let i = 0;
  let count = 0;

  for (;;) {
    const at = text.indexOf(NEEDLE, i);
    if (at === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, at);

    const start = at + NEEDLE.length;
    let depth = 1;
    let splitAt = -1;
    let k = start;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) break;
      } else if (ch === ',' && depth === 1 && splitAt === -1) {
        splitAt = k;
      }
    }
    if (depth !== 0) {
      // Unbalanced — leave the rest untouched rather than corrupt the file.
      out += text.slice(at);
      break;
    }
    const light = (splitAt === -1 ? text.slice(start, k) : text.slice(start, splitAt)).trim();
    out += light;
    count++;
    i = k + 1;
  }

  return { text: out, count };
}

/** Deletes @media blocks whose prelude asks for prefers-color-scheme: dark. */
function stripDarkMediaBlocks(text) {
  const re = /@media[^{}]*prefers-color-scheme\s*:\s*dark[^{}]*\{/gi;
  let out = text;
  let count = 0;

  for (;;) {
    re.lastIndex = 0;
    const m = re.exec(out);
    if (!m) break;

    const openBrace = m.index + m[0].length - 1;
    let depth = 1;
    let k = openBrace + 1;
    for (; k < out.length; k++) {
      if (out[k] === '{') depth++;
      else if (out[k] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break; // unbalanced; stop rather than mangle
    out = out.slice(0, m.index) + out.slice(k + 1);
    count++;
  }

  return { text: out, count };
}

/** color-scheme: light dark → light (also `dark light`, and the meta tag). */
function pinColorScheme(text) {
  let count = 0;
  const out = text.replace(
    /(color-scheme\s*:\s*)(?:light\s+dark|dark\s+light|only\s+dark|dark)(\s*(?:!important)?\s*[;}"']|$)/gi,
    (whole, head, tail) => {
      count++;
      return `${head}light${tail}`;
    }
  );
  return { text: out, count };
}

/** Drops the dark theme-color meta; unconditionalises the light one. */
function fixThemeColorMeta(html) {
  let count = 0;

  let out = html.replace(
    /<meta\b[^>]*name=["']theme-color["'][^>]*media=["'][^"']*prefers-color-scheme\s*:\s*dark[^"']*["'][^>]*>\s*/gi,
    () => {
      count++;
      return '';
    }
  );
  // Same tag, attributes the other way round.
  out = out.replace(
    /<meta\b[^>]*media=["'][^"']*prefers-color-scheme\s*:\s*dark[^"']*["'][^>]*name=["']theme-color["'][^>]*>\s*/gi,
    () => {
      count++;
      return '';
    }
  );
  // The surviving light one should apply to everyone, so drop its media attr.
  out = out.replace(
    /(<meta\b[^>]*name=["']theme-color["'][^>]*?)\s*media=["'][^"']*prefers-color-scheme\s*:\s*light[^"']*["']/gi,
    '$1'
  );

  return { html: out, count };
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function main() {
  console.log('\n☀️  Pinning the site to its light palette...\n');

  if (!fs.existsSync(DIST)) {
    console.log('   ⚠ dist/ not found — nothing to do\n');
    return;
  }

  const stats = { files: 0, collapsed: 0, media: 0, scheme: 0, meta: 0 };

  for (const file of walk(DIST)) {
    const ext = path.extname(file).toLowerCase();
    const isCss = ext === '.css' || file.toLowerCase().includes('.css?');
    const isHtml = ext === '.html' || ext === '.htm';
    if (!isCss && !isHtml) continue;

    const before = fs.readFileSync(file, 'utf-8');
    let text = before;

    const a = collapseLightDark(text);
    text = a.text;
    const b = stripDarkMediaBlocks(text);
    text = b.text;
    const c = pinColorScheme(text);
    text = c.text;

    let metaCount = 0;
    if (isHtml) {
      const d = fixThemeColorMeta(text);
      text = d.html;
      metaCount = d.count;
    }

    if (text === before) continue;

    fs.writeFileSync(file, text);
    stats.files++;
    stats.collapsed += a.count;
    stats.media += b.count;
    stats.scheme += c.count;
    stats.meta += metaCount;
  }

  console.log(`   ✓ ${stats.collapsed} light-dark() call(s) collapsed to their light value`);
  console.log(`   ✓ ${stats.media} prefers-color-scheme:dark block(s) removed`);
  console.log(`   ✓ ${stats.scheme} color-scheme declaration(s) pinned to light`);
  console.log(`   ✓ ${stats.meta} dark theme-color meta tag(s) removed`);
  console.log(`\n✅ ${stats.files} file(s) rewritten — the site now renders light for every visitor\n`);
}

main();
