#!/usr/bin/env node

/**
 * Two link-level fixes, applied to the built site.
 *
 * ── 1. THE DISAPPEARING CTA ──────────────────────────────────────────
 *
 * The inherited WordPress theme ships this, globally:
 *
 *   a:visited { color: #94152b }
 *
 * `a:visited` has specificity (0,1,1). A component class like
 * `.vm-home-cta-btn { color:#fff }` has (0,1,0). So the theme rule WINS
 * on any link the visitor has already clicked, and the label is repainted
 * brand red — on a button whose background is that same brand red. The
 * text does not fade; it vanishes completely.
 *
 * It is invisible in development, which is why it survived: a fresh
 * profile has no history, so the button looks perfect. It only breaks for
 * people who have been to the target page before — i.e. returning
 * visitors and anyone comparing offers, exactly the audience a "Demo
 * buchen" button exists for. It is also invisible to `getComputedStyle`,
 * which deliberately reports the UNVISITED colour so pages cannot sniff
 * browsing history: every measurement says `rgb(255,255,255)` while the
 * pixels on screen are `#94152b`. Only a screenshot shows the truth.
 *
 * The theme author knew about this trap and defended each of their own
 * components by hand:
 *
 *   .octf-btn:visited{color:#fff}   .elementor-button:visited{color:#fff}
 *   .tech-box:visited{color:#fff}   .footer-menu ul li a:visited{color:#fff}
 *   .btn-details:visited{color:#66a3ce}   ...and six more
 *
 * That list is the bug. Every component added since — every `vm-*` CTA
 * built during this sweep — had to be remembered and added to it, and one
 * was not. Rather than extend the list by one more entry and leave the
 * next component to fail the same way, this removes the rule that makes
 * the list necessary. With `a:visited{color:#94152b}` gone, a visited link
 * simply keeps its own colour, the ten defensive rules become harmless
 * no-ops, and a new button cannot inherit this failure.
 *
 * Only that one exact declaration is removed. The defensive rules are left
 * alone: they now set the colour those components already have, so
 * deleting them would be churn with no effect.
 *
 * ── 2. NO UNDERLINES ─────────────────────────────────────────────────
 *
 * Requested directly: links should not be underlined, at rest or on
 * hover. Applied with `!important` because the rules being overridden are
 * spread across the theme, Elementor, and a dozen generator scripts, at
 * specificities up to (0,3,1) — a polite rule would lose to half of them
 * and the result would be underlines in some places and not others, which
 * looks worse than either choice made consistently.
 *
 * One exception is kept: `:focus-visible`. That state is reached only by
 * keyboard, never by mouse or touch, so it is invisible to the design
 * while leaving a keyboard user able to see which link they are on.
 *
 * Worth stating plainly, since it is a trade: underlines are how WCAG
 * 1.4.1 expects an inline link inside a paragraph to be distinguishable
 * without relying on colour. Removing them site-wide means body-copy links
 * are now told apart by colour and weight alone. That is a deliberate,
 * requested design decision, not an oversight — but it is the reason the
 * focus-visible underline stays.
 *
 * Runs AFTER the bundles are built and rewritten, and BEFORE
 * version-static-assets.js — appending bytes to a content-named bundle is
 * exactly the staleness that step exists to paper over, so it has to see
 * the final bytes.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

/** The theme's global visited recolour, in the forms it is minified to. */
const VISITED_RULE = /a:visited\s*\{\s*color\s*:\s*(?:#94152b|#700f2b|var\(--vm-red\))\s*;?\s*\}/gi;

const NO_UNDERLINE_CSS = [
  '/* vm: links carry no underline (see scripts/fix-link-styles.js) */',
  'a,a:link,a:visited,a:hover,a:active{text-decoration:none!important;}',
  'a:focus-visible{text-decoration:underline!important;text-underline-offset:3px;}',
  // The footer's legal links draw their underline as a BACKGROUND, not a
  // text-decoration: a solid-colour linear-gradient sized `0 0` at rest and
  // animated to full width on hover. `text-decoration:none` cannot touch it,
  // so the stripe would have survived the rule above and left exactly the
  // hover underline this is meant to remove. Scoped to `.title-link` on
  // purpose — a blanket `background-image:none` on links would erase the
  // gradient FILL of every `.elementor-button`, which is the button itself.
  'a.title-link{background-image:none!important;}',
].join('');

const MARKER = 'vm: links carry no underline';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function main() {
  console.log('\n🔗 Fixing link styles (visited-colour trap + underlines)...\n');

  if (!fs.existsSync(DIST)) {
    console.log('   ⚠ dist/ not found — nothing to do\n');
    return;
  }

  const files = walk(DIST);
  let cssTouched = 0;
  let visitedRemoved = 0;
  let bundlesStamped = 0;
  let htmlTouched = 0;

  // 1. Strip the visited recolour everywhere it ships: generated bundles,
  //    copied theme CSS, and inline <style> blocks in the pages.
  for (const file of files) {
    if (!/\.(css|html)$/i.test(file)) continue;
    const before = fs.readFileSync(file, 'utf-8');
    const hits = before.match(VISITED_RULE);
    if (!hits) continue;
    fs.writeFileSync(file, before.replace(VISITED_RULE, ''));
    visitedRemoved += hits.length;
    cssTouched++;
  }

  // 2. Append the underline rule to every generated bundle, so whichever
  //    bundle a given page loads, it carries the rule.
  const cssDir = path.join(DIST, 'assets', 'css');
  if (fs.existsSync(cssDir)) {
    for (const name of fs.readdirSync(cssDir)) {
      if (!/^vm-[0-9a-f]+\.css$/.test(name)) continue;
      const full = path.join(cssDir, name);
      const css = fs.readFileSync(full, 'utf-8');
      if (css.includes(MARKER)) continue; // idempotent
      fs.writeFileSync(full, css + NO_UNDERLINE_CSS);
      bundlesStamped++;
    }
  }

  // 3. Pages whose CSS is inlined (hoist-critical-css) need it too.
  for (const file of files) {
    if (!/\.html$/i.test(file)) continue;
    const before = fs.readFileSync(file, 'utf-8');
    if (before.includes(MARKER)) continue;
    if (!/<\/head>/i.test(before)) continue;
    const after = before.replace(/<\/head>/i, `<style>${NO_UNDERLINE_CSS}</style></head>`);
    if (after === before) continue;
    fs.writeFileSync(file, after);
    htmlTouched++;
  }

  console.log(`   ✓ removed ${visitedRemoved} global "a:visited" recolour rule(s) across ${cssTouched} file(s)`);
  console.log(`   ✓ underline reset appended to ${bundlesStamped} bundle(s) and ${htmlTouched} page(s)`);
  console.log();
}

main();
