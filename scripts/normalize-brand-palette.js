#!/usr/bin/env node

/**
 * Rewrites the retired "engitech" theme accent colours to the real brand
 * palette across every CSS bundle and inline <style> block in dist/.
 *
 * THE PROBLEM: the site inherited a WordPress theme demo palette that is
 * off-brand and explicitly banned by this project's CLAUDE.md, but still
 * ships and still renders (base `a{color:...}` links, `.octf-btn` fills,
 * carousel controls, hero gradients, per-page Kirki overrides). The
 * retired hexes handled here:
 *
 *   #7141b1 (purple)   — base link colour, `.octf-btn` hover fill,
 *                        `.text-second`/`.bg-second`, dozens of hover
 *                        states, one hero-form gradient stop.
 *   #43baff (cyan)     — `.octf-btn` base fill, `.text-primary`,
 *                        `a:hover` colour, nav highlight, carousel
 *                        arrows/dots, `.circle:before`.
 *   #bb04ff (magenta)  — roadmap glow marker (background + box-shadow).
 *   #00deff (cyan #2)  — hero gradient start stop (paired with purple
 *                        and with #502a71).
 *   #3f5aff (indigo)   — a couple of one-off CTA button fills / checkbox
 *                        accent colours.
 *   #35d3c9 (teal)     — pricing-table accents, alt `.octf-btn` fills,
 *                        and per-page `#back-to-top` colour overrides
 *                        inside inline Kirki <style> blocks.
 *   #502a71 (dark violet) — not in the original ban list, but it is the
 *                        dark stop of the #00deff gradient above: same
 *                        off-brand origin, not neutral, not brand. Added
 *                        under "any other saturated accent that is
 *                        neither brand nor neutral" — see the CLAUDE.md
 *                        instruction this script implements. Only 6
 *                        occurrences, all inside that one gradient.
 *
 * ---------------------------------------------------------------------
 * B3 FOLLOW-UP — the per-page Kirki sprawl, and everything else, closed
 * ---------------------------------------------------------------------
 * The paragraph immediately below originally described a second, distinct
 * palette-sprawl problem that this script left out of scope: one-off
 * accent hexes inside per-page Kirki `<style id="kirki-inline-styles">`
 * `.page-id-*` overrides (#656AE5, #53E79C), plus whatever else a full
 * site-wide colour census would find. That work is done: a full census of
 * every hex/rgb() in dist/ turned up those two, plus a handful of other
 * genuine off-brand accents in the retired engitech theme's own CSS and in
 * the newer `.vmd-*` interactive-demo widget used on the `/en/solutions/`
 * and `/ki-loesungen/` pages. All of it is now in scope and handled below
 * by the same role-aware, hue-family mapping this script already does —
 * see the HUE_FAMILY / RGB_FAMILY entries marked "B3" and the
 * SEMANTIC_FILL_OVERRIDE table for the handful of cases that need special
 * handling. Full census + rationale for every new entry:
 * .../scratchpad/sweep/B2-palette-done.md (dated section appended after
 * the original B2 handoff).
 *
 * Deliberately still OUT of scope (verified, not silently missed):
 *   - Third-party plugin CSS (wp-content/plugins/**: WooCommerce, WPBakery/
 *     js_composer incl. its bundled-per-page `.vc_*` colour-name presets,
 *     Contact Form 7, LayerSlider, wpcal) and WordPress core CSS
 *     (wp-includes/**, incl. Gutenberg's block-library default colour
 *     palette and its `.wp-social-link-*` per-network icon colours) — not
 *     site-authored, and in the social-link case actively SHOULD stay
 *     off-brand: a Twitter/Facebook/Pinterest/etc. share icon needs to
 *     stay that network's own recognisable colour, the same reasoning
 *     that already exempts icon fonts.
 *   - The retired theme's own per-network social-share widget
 *     (`.otf-social-share a.share-*`, `.author-widget_social a.social-*`)
 *     for the same reason — `.share-facebook`, `.share-twitter` etc. name
 *     the network they link to.
 *   - `#3d7ba8` (and its sitewide sticky-header CTA gradient use) — this
 *     is NOT a leftover off-brand accent, it is a deliberate, documented,
 *     already-shipped darkened variant of vm-blue, created specifically to
 *     fix the exact "white text on vm-blue is 2.73:1" contrast failure
 *     this project's brand-palette work cares about (see the comment
 *     above `#site-header .octf-btn.octf-btn-primary` in the homepage's
 *     injected `<style id="vm-legacy-header-fix">` block). Remapping it
 *     would undo a correct accessibility fix, not complete one.
 *   - `#0a1636` / `#1a1b1e` (and their light-dark twins `#c9d5f5` /
 *     `#d4d6da`) — the theme's own near-black header/nav ink colours
 *     (very low absolute chroma once you account for how dark they are;
 *     HSL "saturation" alone overstates how colourful a near-black or
 *     near-white shade reads). These are neutrals, not accents, the same
 *     way `#fff`/`#000`/greys already were out of scope.
 *   - `#337ab7` / `#23527c` — Bootstrap's own default `a{color}` /
 *     `a:hover{color}`, vendored wholesale into
 *     `engitech/css/bootstrap.css`. The theme's own style.css sets the
 *     actually-rendered link colour (already handled, violet family); this
 *     is Bootstrap's stock palette sitting underneath it, not a choice the
 *     theme authors made.
 *   - WordPress's auto-generated `<style id="global-styles-inline-css">`
 *     block (Gutenberg's default colour/gradient preset custom properties
 *     in `:root`) — core WP boilerplate injected on every page whether or
 *     not any block on the page uses it; verified unused by this theme's
 *     markup, so it is inert, not a rendered off-brand accent.
 *
 * NOT in scope: this pass is deliberately narrow. A search turned up
 * OTHER one-off accent hexes (e.g. #656AE5, #53E79C) inside per-page
 * Kirki `<style id="kirki-inline-styles">` overrides for individual
 * `.page-id-*` rules — those are a distinct, page-by-page palette sprawl
 * problem, not the retired theme palette this script targets, and
 * "be conservative" rules out sweeping them here. Flagged separately for
 * a follow-up pass; do not fold that scope into this script silently.
 *
 * ---------------------------------------------------------------------
 * DESIGN DECISION 1 — role-aware mapping, not blind find/replace
 * ---------------------------------------------------------------------
 * The seven retired hexes split into two hue families by ORIGIN, not by
 * the WordPress theme's own (unreliable) class names — `.bg-primary` is
 * cyan and `.bg-second` is purple, but purple is actually the dominant,
 * highest-traffic colour (the base `a{color}` rule, i.e. every plain
 * link on the site), while cyan is reserved for interactive controls
 * (button fills, carousel arrows, nav hover). We map by that functional
 * role, not the theme's naming:
 *
 *   VIOLET family (dominant / primary-role): #7141b1, #bb04ff, #3f5aff,
 *   #502a71
 *   CYAN family (interactive / secondary-role): #43baff, #00deff,
 *   #35d3c9
 *
 * Within each family, the CSS PROPERTY the colour sits in decides which
 * of the four brand colours it becomes:
 *
 *   Property is a FILL (background, background-color, background-image
 *   incl. gradient stops, box-shadow glow):
 *     cyan family   → vm-red        (#94152b) — the base/primary fill
 *     violet family → vm-red-dark   (#700f2b) — the hover/pressed fill
 *   This exactly reproduces the concrete case in the brief: `.octf-btn`
 *   is cyan-fill / purple-hover today, and becomes red-fill /
 *   dark-red-hover — hover DARKENS, which is the conventional direction.
 *   (`.octf-btn-second`, which today is purple-fill / cyan-hover, ends
 *   up dark-red-fill / red-hover — hover LIGHTENS instead. That is a
 *   direction change for that one variant, but it is still a monochrome
 *   red hover, not a colour clash, and it is required by the contrast
 *   rule below: a fill with opaque white text on it can only ever become
 *   vm-red or vm-red-dark, never vm-blue.)
 *
 *   Property is TEXT/BORDER/ICON (color, border*, outline*, svg
 *   fill/stroke):
 *     violet family → vm-red        (#94152b) — the primary link/text/
 *                                    icon colour (this is the "the
 *                                    dominant colour becomes the
 *                                    dominant brand colour" case)
 *     cyan family   → vm-blue       (#66a3ce) — secondary/interactive
 *                                    accent colour
 *
 *   A low-alpha (<=0.5) cyan-family rgba() inside a `box-shadow` /
 *   `-webkit-box-shadow` / `-moz-box-shadow` declaration is a decorative
 *   TINT (translucent glow, never paired with opaque text) and maps to
 *   vm-blue-light (#a3cce9) instead of vm-red, preserving the alpha.
 *   This is the one place vm-blue-light is used, and it is deliberate:
 *   the only genuinely low-alpha "wash" instance in the corpus
 *   (`rgba(67,186,255,0.4)` on `.ot-team__thumb`'s box-shadow) is exactly
 *   the tint role the brief describes, and a shadow has no text sitting
 *   on it, so there is no contrast reason to force it into the red
 *   family the way solid fills are forced.
 *
 * ---------------------------------------------------------------------
 * DESIGN DECISION 2 — contrast safety
 * ---------------------------------------------------------------------
 * Checked with WCAG relative-luminance contrast ratios:
 *
 *   vm-red        vs #fff:  8.75:1   (background OR text — both directions safe)
 *   vm-red-dark   vs #fff: 11.72:1   (background OR text — both directions safe)
 *   vm-blue       vs #fff:  2.73:1   (fails AA for text/UI at any size)
 *   vm-blue-light vs #fff:  1.70:1   (fails AA badly)
 *
 *   Original #43baff vs #fff: 2.16:1 (i.e. cyan-as-text ALREADY failed
 *   AA before this script ever touched it)
 *   Original #7141b1 vs #fff: 6.79:1 (already passed)
 *
 * Consequence: vm-blue and vm-blue-light are NEVER used where a
 * declaration is a background/fill (every fill in this corpus pairs with
 * opaque white foreground text, e.g. `.octf-btn{color:#fff}`,
 * `.wpcf7 .main-form{color:#fff}`) — those are hard-routed to the red
 * family regardless of hue group, which is why the FILL rule above does
 * not have a vm-blue branch at all. vm-blue is only used for the TEXT/
 * BORDER/ICON role, where the original cyan already failed contrast
 * (2.16:1); mapping it to vm-blue (2.73:1) is a measured IMPROVEMENT and
 * never a regression, even though it does not reach AA on its own — this
 * script fixes brand-colour drift, not the theme's pre-existing text-
 * contrast debt, and does not silently pretend that debt is gone.
 * vm-red used as text is 8.75:1 either way, comfortably AA-safe.
 *
 * ---------------------------------------------------------------------
 * DESIGN DECISION 3 — dark mode twins (light-dark())
 * ---------------------------------------------------------------------
 * scripts/enable-dark-mode.js duplicates qualifying colour declarations
 * into `prop:value;prop:light-dark(value,derived-dark-twin)` — so a
 * retired colour can show up as `color:#7141b1;color:light-dark(#7141b1,
 * #9871cb)`, where #9871cb is a HSL-derived twin of the off-brand colour
 * that isn't itself in any hex ban list.
 *
 * RECOMMENDED PIPELINE POSITION: immediately after
 * `scripts/consolidate-fonts.js` and BEFORE `scripts/enable-dark-mode.js`
 * (the two currently sit back to back, right before inject-enhance.js).
 * Run there, this script only ever sees plain brand hexes — never a
 * light-dark() twin to repair — and enable-dark-mode.js derives correct
 * dark twins FROM the already-corrected brand colours on its own very
 * next pass. That is the clean path and it is what should be wired into
 * package.json's build script.
 *
 * It is placed there for a reason beyond tidiness: vm-red and vm-red-dark
 * are both too dark (L 0.33 / 0.25) to cross enable-dark-mode.js's
 * background-twin threshold (L>=0.75), so brand FILLS never even get a
 * light-dark() wrapper — they're already fine in dark mode as-is. Only
 * vm-red used as TEXT (L<=0.5) and vm-blue-light used as a background/
 * border (L>=0.75/0.7) end up twinned. Running before enable-dark-mode.js
 * means it gets to make exactly those calls itself, correctly, once.
 *
 * BUT this script is NOT only correct in that position — it must also
 * cope with being run on a dist/ that already has enable-dark-mode.js's
 * twins baked in (e.g. because it was mistakenly placed after it, or
 * because this is a re-run against an already-built tree, which is
 * exactly how this script was tested — see below). So: the HSL math and
 * the three derive functions (surfaceDark/textLight/borderDark) below
 * are a deliberate line-for-line port of scripts/enable-dark-mode.js's
 * own versions. When an existing `light-dark(offBrandHex, oldTwin)` is
 * found, the light side is remapped to its brand colour and the dark
 * side is COMPLETELY RECOMPUTED from that new brand colour using the
 * same thresholds enable-dark-mode.js itself uses (or dropped back to a
 * plain value if the threshold says no twin is warranted) — never a
 * blind swap of the old twin's hex. That guarantees byte-identical
 * output whichever side of enable-dark-mode.js this step ends up on.
 *
 * ---------------------------------------------------------------------
 * DESIGN DECISION 4 — what is deliberately left alone
 * ---------------------------------------------------------------------
 * @font-face blocks, icon fonts, images, neutrals (#fff/#000/greys), the
 * brand colours themselves, and any hex/rgb that isn't one of the seven
 * retired accents above. None of the seven ever appear inside a
 * @font-face block in this codebase (verified), so no special stripping
 * is required, but the value-matching regex only ever runs on values of
 * recognised colour-bearing properties (color, background*, border*,
 * outline*, box-shadow, fill, stroke) — never on font stacks, transform
 * lists, etc. — which keeps it conservative by construction.
 *
 * ---------------------------------------------------------------------
 * DESIGN DECISION 5 — hex + rgb()/rgba() forms
 * ---------------------------------------------------------------------
 * Every retired colour is matched as a 6-digit hex, a (theoretical)
 * 3-digit hex (normalised for comparison — none of the seven happen to
 * have a valid 3-digit form, but the matcher handles it generically
 * rather than assuming), and as rgb()/rgba(), alpha preserved verbatim.
 *
 * Idempotent by construction: this script only ever REMOVES retired
 * colours, it never invents a new marker to strip and reapply the way
 * enable-dark-mode.js's OWN_TWIN cycle does. Once a file contains none
 * of the seven retired hexes/triples, every subsequent run is a no-op.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

// ---- brand palette (CLAUDE.md, vm-customer-web-ui/tailwind.config.js) ----

const BRAND = {
  red: '#94152b',
  redDark: '#700f2b',
  blue: '#66a3ce',
  blueLight: '#a3cce9',
};

const BRAND_RGB = {
  red: [148, 21, 43],
  redDark: [112, 15, 43],
  blue: [102, 163, 206],
  blueLight: [163, 204, 233],
};

// ---- retired palette: hex -> hue family --------------------------------

const HUE_FAMILY = {
  '7141b1': 'violet',
  bb04ff: 'violet',
  '3f5aff': 'violet',
  '502a71': 'violet',
  '43baff': 'cyan',
  '00deff': 'cyan',
  '35d3c9': 'cyan',

  // ---- B3: per-page Kirki `#back-to-top` overrides (the two hexes named
  // in the follow-up brief) — decorative TEXT-only accents, no semantic
  // weight (just a per-post customizer colour pick). Family assigned by
  // hue proximity to the existing two clusters (violet ~231-284deg, cyan
  // ~176-202deg): #656AE5 is ~238deg, inside the violet cluster's own
  // range; #53E79C is ~150deg, closest to the cyan cluster. ------------
  '656ae5': 'violet',
  '53e79c': 'cyan',

  // ---- B3: retired engitech theme, additional decorative accents found
  // by the full census (same theme, same kind of colour as the original
  // seven — just not in the original narrow ban list). Each assigned by
  // hue proximity to the violet/cyan clusters above; hues outside BOTH
  // clusters (oranges, yellows, warm reds) are bucketed with "violet"
  // (this script's existing catch-all for "dominant/warm", vs. cyan's
  // "cool/interactive") rather than invented as a third family. ---------
  '3b5999': 'cyan', // .ot-team__info .team-social a:hover — a second,
  // more specific rule for the SAME element the already-in-scope #43baff
  // "a:hover" rule also targets (cascade leftover from a customizer
  // change). Deliberately kept in the CYAN family — not its own ~221deg
  // hue reading, which sits ambiguously between both clusters — so both
  // competing rules resolve to the identical final colour (vm-blue) and
  // the redundant cascade stops mattering.
  '262051': 'violet', // .page-header / .serv-box-2 background fill (dark navy)
  aeaacb: 'violet', // .page-header .breadcrumbs a / .serv-box-2 text (pale lavender)
  '8990ac': 'violet', // .ot-testimonials-3 subtext/paging-info text
  '495aff': 'violet', // .ot-timeline__list gradient stop
  d7f024: 'violet', // .roadmap-item.roadmap-current marker fill + glow (yellow-green)
  fe8423: 'violet', // .icon-box-grid .icon-main text + svg fill (orange)
  ff2f2f: 'violet', // .sl-wrapper / a.liked (Simple Likes module, bundled in the theme's own inc/backend/) — already red-hued, clean fit
  '9efbd3': 'cyan', // .ot-image-box.basic:hover gradient, stop 1/3 (mint)
  '57e9f2': 'cyan', // .ot-image-box.basic:hover gradient, stop 2/3 (cyan)
  '45d4fb': 'cyan', // .ot-image-box.basic:hover gradient, stop 3/3 (sky blue)
  '1080d0': 'cyan', // .ot-icon-list-wrapper icon colour + svg fill
  ffdfac: 'violet', // .grid-lines .g-dot decorative dot (pale peach) — see SEMANTIC_FILL_OVERRIDE
  fff9c0: 'violet', // mark,ins highlight background (pale yellow) — see SEMANTIC_FILL_OVERRIDE

  // ---- B3: the `.vmd-*` interactive-demo widget (32 pages: every
  // /en/solutions/* and /ki-loesungen/* page). Some of these are genuinely
  // semantic (success/info/warning/negative UI states) — see
  // SEMANTIC_FILL_OVERRIDE below and the header note it points to for the
  // trade-off this forces given only two brand hues exist. ------------
  '047857': 'cyan', // success/positive badge + cell-fill text (green)
  '34d399': 'cyan', // success/positive fill (calendar "done" slot) — SEMANTIC_FILL_OVERRIDE
  '7de3c8': 'cyan', // .vm-fp .demo-code-block text (homepage feature-preview code snippet)
  '1d4ed8': 'violet', // informational badge text (blue, but too saturated/dark to be vm-blue itself)
  fbbf24: 'violet', // warning-tier state + code-string colour — SEMANTIC_FILL_OVERRIDE
  f87171: 'violet', // negative/error-tier fill — already red-hued, clean fit
};

const RGB_FAMILY = new Map([
  ['113,65,177', 'violet'],
  ['187,4,255', 'violet'],
  ['63,90,255', 'violet'],
  ['80,42,113', 'violet'],
  ['67,186,255', 'cyan'],
  ['0,222,255', 'cyan'],
  ['53,211,201', 'cyan'],

  // ---- B3 additions ----------------------------------------------------
  ['42,67,113', 'cyan'], // low-alpha box-shadow tint (.is-stuck / #back-to-top glow)
  ['7,73,111', 'cyan'], // low-alpha box-shadow tint (.icon-box-grid glow)
  ['52,211,153', 'cyan'], // low-alpha translucent badge background (.vmd-badge / .vmd-senti-pos) — same colour as #34d399 above, alpha form
]);

// ---- B3: explicit per-hex overrides for FILL-role declarations where the
// mechanical family/role table below would misrepresent the colour's
// actual purpose. Two distinct reasons force an entry onto this list:
//
//   1. SEMANTIC COLLISION — a colour marking a success/positive UI state
//      would mechanically fall into a FILL role that this script always
//      routes to the red family (for the white-text contrast reason
//      explained in Design Decision 2 below). But nothing in the `.vmd-*`
//      demo widget's success/positive fills (e.g. a "done" calendar slot)
//      pairs that fill with opaque white text — they're small colour
//      swatches, not buttons — so the contrast reason for forcing red
//      does not actually apply, and doing it anyway would make a success
//      state read as an error, which is the one thing the brief
//      explicitly warned against. '34d399' is forced to blue instead.
//      'fbbf24' (the widget's warning-tier state, plus a code-syntax
//      string colour reused from the same token) is forced to the BASE
//      red rather than the mechanical red-DARK, so the widget keeps a
//      three-step severity ladder — blue (good) / red (caution) / red-dark
//      (critical, via the untouched 'f87171' negative-tier fill, which
//      already reads as red mechanically) — using only the two hues the
//      brand palette actually has. Documented as a trade-off, not hidden:
//      the palette cannot express three independent hues, so "caution"
//      borrows red's lighter shade rather than inventing a third colour.
//   2. PALE FILL / DARK-TEXT PAIRING — 'ffdfac' and 'fff9c0' are both very
//      light fills (a decorative dot, and a <mark>/<ins> highlight
//      background respectively) that read as a pale wash, not a solid
//      CTA-style fill — 'fff9c0' in particular has ordinary inherited
//      (dark) text sitting on top of it, which vm-red/vm-red-dark are far
//      too dark to hold against. blue-light is the only brand colour pale
//      enough for either role, so both are forced to it regardless of
//      hue family.
const SEMANTIC_FILL_OVERRIDE = new Map([
  ['34d399', 'blue'],
  ['fbbf24', 'red'],
  ['ffdfac', 'blueLight'],
  ['fff9c0', 'blueLight'],
]);

// ---- HSL math, ported verbatim from scripts/enable-dark-mode.js so a --
// ---- recomputed light-dark() twin matches that step's own output ------

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hsl(hex) {
  return rgbToHsl(...hexToRgb(hex));
}

const surfaceDark = (hex) => {
  const [h, s, l] = hsl(hex);
  return hslToHex(h, Math.min(s, 0.3), 0.09 + (1 - l) * 0.09);
};
const textLight = (hex) => {
  const [h, s, l] = hsl(hex);
  if (s < 0.15) return hslToHex(h, s, 0.86 - l * 0.15);
  return hslToHex(h, s, Math.max(0.62, 1 - l));
};
const borderDark = (hex) => {
  const [h, s, l] = hsl(hex);
  return hslToHex(h, Math.min(s, 0.25), 0.16 + (1 - l) * 0.1);
};

// Given a brand hex and the enable-dark-mode.js "kind" of threshold that
// property uses, return a derived dark twin, or null if that step
// wouldn't have twinned a value this dark/light in the first place.
function deriveTwin(hex, kind) {
  const [, , l] = hsl(hex);
  if (kind === 'bg') return l >= 0.75 ? surfaceDark(hex) : null;
  if (kind === 'text') return l <= 0.5 ? textLight(hex) : null;
  if (kind === 'border') return l >= 0.7 ? borderDark(hex) : null;
  return null;
}

// ---- property classification -------------------------------------------

// role decides which brand colour family a match becomes; twinKind (or
// null) decides how an existing light-dark() twin gets recomputed;
// isBoxShadow gates the low-alpha cyan tint exception.
function classify(prop) {
  const p = prop.toLowerCase();
  if (p === 'color') return { role: 'text', twinKind: 'text', isBoxShadow: false };
  if (p === 'background' || p === 'background-color' || p === 'background-image') {
    return { role: 'fill', twinKind: 'bg', isBoxShadow: false };
  }
  if (/^(?:-webkit-|-moz-|-ms-|-o-)?box-shadow$/.test(p)) {
    return { role: 'fill', twinKind: null, isBoxShadow: true };
  }
  if (
    p === 'border' ||
    /^border-(?:top|right|bottom|left)$/.test(p) ||
    /^border(?:-(?:top|right|bottom|left))?-color$/.test(p) ||
    p === 'outline' || p === 'outline-color'
  ) {
    return { role: 'border', twinKind: 'border', isBoxShadow: false };
  }
  if (p === 'fill' || p === 'stroke') return { role: 'text', twinKind: null, isBoxShadow: false };
  // Conservative default for anything unrecognised (e.g. a custom prop):
  // treat like text so it can never land on a contrast-unsafe fill.
  return { role: 'text', twinKind: null, isBoxShadow: false };
}

function brandHexFor(family, role, hex) {
  if (role === 'fill' && hex && SEMANTIC_FILL_OVERRIDE.has(hex)) {
    return BRAND[SEMANTIC_FILL_OVERRIDE.get(hex)];
  }
  if (role === 'fill') return family === 'violet' ? BRAND.redDark : BRAND.red;
  return family === 'violet' ? BRAND.red : BRAND.blue;
}

function normalizeHex(token) {
  let h = token.slice(1).toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return h;
}

// ---- value-level rewriting ----------------------------------------------

const LIGHT_DARK_RE = /light-dark\(\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))\s*,\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))\s*\)/g;
const HEX_TOKEN_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
const RGB_TOKEN_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/g;
const QUICK_SCAN_RE = new RegExp(
  Object.keys(HUE_FAMILY).join('|') + '|' + [...RGB_FAMILY.keys()].map((t) => t.replace(/,/g, '\\s*,\\s*')).join('|'),
  'i'
);

function familyOfHexToken(token) {
  return HUE_FAMILY[normalizeHex(token)] || null;
}

function familyOfRgbTriple(r, g, b) {
  return RGB_FAMILY.get(`${+r},${+g},${+b}`) || null;
}

const counts = { declarations: 0, byColor: {} };
function tally(hex) {
  counts.declarations++;
  counts.byColor[hex] = (counts.byColor[hex] || 0) + 1;
}

function transformValue(value, info) {
  if (!QUICK_SCAN_RE.test(value)) return value;

  let changed = false;

  let out = value.replace(LIGHT_DARK_RE, (whole, a) => {
    let family = null;
    let sourceLabel = null;
    let hexKey = null;
    if (a[0] === '#') {
      family = familyOfHexToken(a);
      sourceLabel = a.toLowerCase();
      hexKey = normalizeHex(a);
    } else {
      const m = a.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
      if (m) {
        family = familyOfRgbTriple(m[1], m[2], m[3]);
        sourceLabel = `rgb(${m[1]},${m[2]},${m[3]})`;
        hexKey = [m[1], m[2], m[3]].map((x) => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
      }
    }
    if (!family) return whole; // not one of the retired colours — leave it

    const mapped = brandHexFor(family, info.role, hexKey);
    changed = true;
    tally(sourceLabel);
    if (!info.twinKind) return mapped;
    const twin = deriveTwin(mapped, info.twinKind);
    return twin ? `light-dark(${mapped},${twin})` : mapped;
  });

  out = out.replace(HEX_TOKEN_RE, (m) => {
    const family = familyOfHexToken(m);
    if (!family) return m;
    changed = true;
    tally(m.toLowerCase());
    return brandHexFor(family, info.role, normalizeHex(m));
  });

  out = out.replace(RGB_TOKEN_RE, (m, r, g, b, alpha) => {
    const family = familyOfRgbTriple(r, g, b);
    if (!family) return m;
    changed = true;
    tally(`rgb(${r},${g},${b})`);

    const hexKey = [r, g, b].map((x) => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
    // Low-alpha cyan-family tints (glow/box-shadow washes as well as
    // translucent badge fills — both are role:'fill') read as washed-out
    // blue rather than a solid brand hue, so they route to vm-blue-light
    // instead of the mechanical red/blue pick — UNLESS this exact hex has
    // its own SEMANTIC_FILL_OVERRIDE entry, which always wins.
    const useTint =
      info.role === 'fill' &&
      family === 'cyan' &&
      alpha !== undefined &&
      parseFloat(alpha) <= 0.5 &&
      !SEMANTIC_FILL_OVERRIDE.has(hexKey);
    const key = useTint ? 'blueLight' : brandKeyFor(family, info.role, hexKey);
    const [tr, tg, tb] = BRAND_RGB[key];
    return alpha !== undefined ? `rgba(${tr},${tg},${tb},${alpha})` : `rgb(${tr},${tg},${tb})`;
  });

  return changed ? out : value;
}

function brandKeyFor(family, role, hex) {
  if (role === 'fill' && hex && SEMANTIC_FILL_OVERRIDE.has(hex)) {
    return SEMANTIC_FILL_OVERRIDE.get(hex);
  }
  if (role === 'fill') return family === 'violet' ? 'redDark' : 'red';
  return family === 'violet' ? 'red' : 'blue';
}

// Matches `;prop:value` / `{prop:value` pairs at the top level of a CSS
// blob — the same flat-scan approach scripts/enable-dark-mode.js uses.
const DECL_RE = /([;{])\s*([a-zA-Z-]+)\s*:\s*([^;{}]+)(?=[;}])/g;

function processCssText(css) {
  let touched = false;
  const next = css.replace(DECL_RE, (whole, sep, prop, value) => {
    const info = classify(prop);
    const newValue = transformValue(value, info);
    if (newValue === value) return whole;
    touched = true;
    return `${sep}${prop}:${newValue}`;
  });
  return { next, touched };
}

// ---- file walk ------------------------------------------------------------

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🎨 Normalizing retired theme accents to the brand palette...\n');

  const targets = walk(DIST).filter((f) => /\.(css|html)$/.test(f) || f.includes('.css?'));

  let filesTouched = 0;

  for (const f of targets) {
    const isHtml = f.endsWith('.html');
    const text = fs.readFileSync(f, 'utf-8');
    if (!QUICK_SCAN_RE.test(text)) continue;

    let next;
    let touched = false;

    if (!isHtml) {
      ({ next, touched } = processCssText(text));
    } else {
      next = text.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, inner, close) => {
        const r = processCssText(inner);
        if (r.touched) touched = true;
        return open + r.next + close;
      });
    }

    if (touched) {
      fs.writeFileSync(f, next);
      filesTouched++;
    }
  }

  console.log(`✅ ${counts.declarations} declaration(s) rewritten across ${filesTouched} file(s)`);
  const breakdown = Object.entries(counts.byColor)
    .sort((a, b) => b[1] - a[1])
    .map(([hex, n]) => `${hex}×${n}`)
    .join(', ');
  if (breakdown) console.log(`   • by source colour: ${breakdown}`);
  console.log('');
}

main();
