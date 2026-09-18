#!/usr/bin/env node

/**
 * Gives CSS custom properties a literal fallback wherever they size a box,
 * so an element that depends on one never collapses before the rule that
 * defines it has actually applied.
 *
 * WHAT THIS FIXES
 *
 * The homepage's "Industries" marquee (`div.ot-industries-marquee`) is sized
 * entirely through custom properties:
 *
 *     :root{--marquee-width:100vw;--marquee-height:16vh}
 *     .ot-industries-marquee{width:var(--marquee-width);height:var(--marquee-height)}
 *
 * Both declarations live in the SAME page bundle
 * (dist/assets/css/vm-<hash>.css) and always ship together, so today the
 * marquee is never visibly wrong. But `hoist-critical-css.js` now defers
 * that same bundle so it stops blocking first paint — which means there is
 * a real window, between first paint and the bundle finishing, where
 * `--marquee-height` has no value yet. `var()` with an unresolved custom
 * property doesn't fall back to anything; the property using it becomes
 * invalid at computed-value time and behaves as if it were never set, i.e.
 * `height:auto`. The box collapses to its content's natural height, then
 * jumps to 16vh the moment the bundle applies — a measured 0.10-0.27 CLS
 * contribution on the homepage, and the largest single shift on any page in
 * this site's Lighthouse baseline.
 *
 * THE FIX, AND WHY IT IS SAFE
 *
 * `var(--name, <value>)` — the two-argument form — resolves to `<value>`
 * for exactly as long as `--name` is unset, and to `--name` itself the
 * moment it becomes available. So a fallback that repeats the SAME literal
 * the variable is eventually defined as changes nothing about the final,
 * fully-loaded page: the box is 16vh before the stylesheet applies and 16vh
 * after. There is no guessing involved — the fallback value is read from
 * the stylesheet's own `:root` block, not invented.
 *
 * This is deliberately generic rather than a marquee-specific patch: ANY
 * current or future element whose size comes from a custom property gets
 * the same guarantee, in one pass, without another script needing to know
 * about it.
 *
 * SCOPE AND SAFETY LIMITS (be conservative — a wrong fallback is worse than
 * no fallback)
 *
 *   1. Only a `:root{...}` block with no nesting (no `@media`/`@supports`
 *      wrapping it) is read for values. A property redefined per breakpoint
 *      would need per-breakpoint fallbacks to be exactly right; the base
 *      value is used instead, which is correct for the common case and only
 *      ever imprecise — never wrong in a way that breaks layout — for the
 *      brief pre-load window on the breakpoints that override it.
 *   2. Only a property whose value contains no `var(`, `calc(` reference to
 *      another custom property, or `url(` is captured — anything that
 *      itself depends on something else is not a literal and is skipped.
 *   3. A `var(--name)` that already carries a fallback (a comma inside the
 *      parens) is left untouched — never overwritten, whether the fallback
 *      is ours from a previous run or hand-authored.
 *   4. Only plain style rules and `@media`/`@supports` bodies are visited,
 *      matching purge-unused-css.js's own top-level rule walk; `@keyframes`
 *      and `@font-face` are opaque and never parsed for this.
 *
 * SCOPE: dist/assets/css/*.css (the page bundles) and every inline
 * `<style>` block in dist HTML — a `:root` definition can live in either.
 * Idempotent: a fallback is only ever added, never duplicated, and adding
 * one that already matches the current value is a no-op on the next run.
 *
 * Runs after bundle-css.js/purge-unused-css.js (bundles must be final) and
 * after enable-dark-mode.js (so light-dark() twins are already in place —
 * this script only touches custom-property declarations, but running after
 * keeps the CSS it reads representative of what ships). Must run before, or
 * independently of, hoist-critical-css.js — the two address the same class
 * of problem (a deferred stylesheet leaving a gap before first render) from
 * two different angles: this script protects custom-property-driven
 * sizing, hoist-critical-css.js protects everything else.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

/**
 * Literal (non-referential) custom properties declared in a top-level :root
 * block. When the SAME property is declared in more than one :root block —
 * this genuinely happens: Elementor emits one per widget instance, so two
 * marquee widgets on one page each write their own `:root{--marquee-height:…}`
 * — the LAST one wins, matching how the cascade actually resolves two
 * same-specificity `:root` rules in document order. Taking the first
 * instead would produce a fallback that is confidently wrong rather than
 * simply absent.
 */
function collectRootLiterals(css) {
  const map = new Map();
  // :root blocks with no nested braces — see scope note #1 above. The
  // negated character class in the capture group is what keeps this from
  // reaching past the block's own closing brace into unrelated CSS.
  for (const m of css.matchAll(/:root\s*\{([^{}]*)\}/g)) {
    // Trailing `;` is optional — the last declaration in a block need not
    // have one, and that last declaration is exactly the common case here
    // (--marquee-height, closing the block).
    for (const decl of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;}]+);?/g)) {
      const [, name, rawValue] = decl;
      const value = rawValue.trim();
      if (!value || /var\(|calc\(|url\(/.test(value)) continue; // not a literal — see scope note #2
      map.set(name, value); // last declaration in document order wins
    }
  }
  return map;
}

/**
 * Properties whose value actually sizes or positions a box. A fallback is only
 * ever added to a `var()` sitting in one of these.
 *
 * WHY AN ALLOWLIST AND NOT "EVERY DECLARATION": this script used to rewrite
 * every `var(--name)` it could see, which is wrong in a way that is invisible
 * here and breaks something else. `enable-dark-mode.js` runs later and turns
 * colour values into `light-dark(<light>, <dark>)`. Give a COLOUR declaration
 * a fallback first and you get `color:var(--vm-red, light-dark(#a,#b))` — and
 * because `--vm-red` *is* defined, the browser takes the variable and never
 * looks at the fallback, so the dark twin silently resolves to the light
 * value. That is not theoretical: it produced real contrast failures on the
 * whitepaper page (a list item at 1.01:1 — invisible text) and on /kontakt/.
 * A fallback outside these properties reserves no layout space whatsoever, so
 * there is nothing to trade off: restricting the rewrite is pure win.
 *
 * Vendor prefixes are stripped before the lookup (`-webkit-flex-basis`).
 */
const SIZING_PROPS = new Set([
  'width', 'min-width', 'max-width',
  'height', 'min-height', 'max-height',
  'inline-size', 'min-inline-size', 'max-inline-size',
  'block-size', 'min-block-size', 'max-block-size',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-block', 'margin-block-start', 'margin-block-end',
  'margin-inline', 'margin-inline-start', 'margin-inline-end',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-block', 'padding-block-start', 'padding-block-end',
  'padding-inline', 'padding-inline-start', 'padding-inline-end',
  'top', 'right', 'bottom', 'left',
  'inset', 'inset-block', 'inset-inline',
  'gap', 'row-gap', 'column-gap', 'grid-gap', 'grid-row-gap', 'grid-column-gap',
  'flex-basis', 'aspect-ratio',
  'grid-template-columns', 'grid-template-rows',
  'grid-auto-columns', 'grid-auto-rows',
  'border-width', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width',
  'font-size', 'line-height',
]);

/**
 * Adds a fallback to every var(--name) that lacks one, has a known literal,
 * AND sits in a property from SIZING_PROPS.
 *
 * Declarations are matched as `prop: value` rather than hunting bare `var()`
 * calls, because the property name is the whole point — a bare `var()` regex
 * cannot tell `height:var(--h)` from `color:var(--c)`. Selectors and at-rule
 * preludes (`@media (min-width:600px)`) fall out on their own: they contain no
 * `var(`, so they return untouched.
 */
function addFallbacks(css, literals, stats) {
  return css.replace(/(^|[;{]\s*)(-{0,2}[a-zA-Z][\w-]*)(\s*:\s*)([^;{}]+)/g,
    (whole, lead, prop, sep, value) => {
      if (!value.includes('var(')) return whole;
      const bare = prop.toLowerCase().replace(/^-(?:webkit|moz|ms|o)-/, '');
      if (!SIZING_PROPS.has(bare)) {
        stats.skipped++;
        return whole;
      }
      const patched = value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (call, name) => {
        const literal = literals.get(name);
        if (!literal) return call; // no literal on file — nothing safe to add
        stats.added++;
        return `var(${name}, ${literal})`;
      });
      return lead + prop + sep + patched;
    });
}

function processCssText(css, stats) {
  const literals = collectRootLiterals(css);
  if (!literals.size) return css;
  return addFallbacks(css, literals, stats);
}

function main() {
  console.log('\n🧱 Reserving layout space for custom-property-sized elements...\n');

  const stats = { added: 0, skipped: 0 };
  let cssFiles = 0;
  let htmlFiles = 0;

  const cssDir = path.join(DIST, 'assets/css');
  if (fs.existsSync(cssDir)) {
    for (const file of walk(cssDir).filter((f) => f.endsWith('.css'))) {
      const before = fs.readFileSync(file, 'utf-8');
      const before_added = stats.added;
      const after = processCssText(before, stats);
      if (after !== before) {
        fs.writeFileSync(file, after);
        cssFiles++;
      } else {
        stats.added = before_added;
      }
    }
  }

  for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!html.includes('<style')) continue;
    let changed = false;
    const next = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (whole, open, css, close) => {
      const out = processCssText(css, stats);
      if (out !== css) changed = true;
      return open + out + close;
    });
    if (changed) {
      fs.writeFileSync(file, next);
      htmlFiles++;
    }
  }

  console.log(`✅ ${stats.added} var() usage(s) given a literal fallback across ${cssFiles} bundle(s) and ${htmlFiles} inline <style> block(s)`);
  console.log(`   ${stats.skipped} declaration(s) left alone — var() outside a box-sizing property (colours especially: a fallback there would go dead once enable-dark-mode.js wraps it in light-dark())\n`);
}

main();
