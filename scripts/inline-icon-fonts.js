#!/usr/bin/env node

/**
 * Replaces icon-font glyphs with inline SVG, so the pages that only used a
 * handful of them stop downloading the fonts and stylesheets behind them.
 *
 * WHAT IT COSTS TO DRAW AN ICON WITH A FONT
 *
 * Counted across the whole of dist/, the site renders exactly fifteen
 * distinct glyphs. To draw them it loads, on the legacy pages:
 *
 *   font-awesome.min.css  (theme)          57 KB
 *   fontawesome.min.css   (Elementor)      58 KB   — the same icons again
 *   elementor-icons.min.css                22 KB   — eicon-*, used nowhere
 *   flaticon.css                            3 KB
 *   fa-solid-900                           77 KB transferred, for two glyphs
 *
 * Lighthouse listed fa-solid-900 as the third-largest resource on the
 * homepage, behind two hero images. Two icons.
 *
 * An inline SVG has no such fixed cost: it is a few hundred bytes, it is in
 * the HTML so there is nothing extra to fetch, and it paints with the first
 * frame instead of after a font swap.
 *
 * WHY THE BRAND MARKS ARE LEFT ALONE
 *
 * fab fa-twitter, fa-facebook-f, fa-linkedin-in, fa-pinterest-p and
 * fa-reddit-alien are the share row on the blog posts. Those are company
 * logos, and redrawing a logo by hand produces something that is recognisably
 * not the logo — a worse outcome than the bytes are worth, on pages that
 * already measure 98-100. They keep the font. Every page that does NOT use a
 * brand mark drops the whole icon stack, which is all 16 feature pages, both
 * homepages, the hub and the legal pages.
 *
 * The drop itself is done by scripts/bundle-css.js, which already omits a
 * stylesheet whose marker string is absent from the page. This script only
 * has to remove the last usage; running before the bundler is what connects
 * the two.
 *
 * STYLE: FILLED, NOT STROKED
 *
 * The obvious drawing style — a 24x24 outline stroked in currentColor, like
 * the nav icons — was tried and is wrong here, for a reason worth recording.
 *
 * The theme writes its icon rules in pairs:
 *
 *     .icon-main i   { font-size: 58px; color: #FFF }
 *     .icon-main svg { width: 58px;     fill:  #FFF }
 *
 * It already expects an <svg> in that slot and controls it through `width`
 * and `fill`. A stroked icon ignores both: `fill` paints its interior rather
 * than its lines, so the glyph becomes a solid blob, and `width: 58px` with
 * a `height: 1em` of its own comes out 58x16 — the icon letterboxed inside a
 * strip. Measured on the homepage before this was fixed.
 *
 * Filled paths in `fill: currentColor` behave exactly like the font glyph
 * they replace: they take their colour from whatever the surrounding rule
 * sets, and where the theme overrides `fill` outright they simply obey it.
 * Height is `auto` with `aspect-ratio: 1`, so a rule that sets only the
 * width — as both of the above do — still produces a square.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/**
 * Glyph -> SVG body. Keys are the class names as they appear in the markup.
 * Everything here is drawn for this repo; nothing is traced from a font.
 */
const ENVELOPE =
  '<path d="M3 5h18a1 1 0 0 1 1 1v.55l-9.47 6.16a1 1 0 0 1-1.06 0L2 6.55V6a1 1 0 0 1 1-1Z"/>' +
  '<path d="M2 8.94l9.46 6.15a1 1 0 0 0 1.08 0L22 8.94V18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"/>';

const GLYPHS = {
  // --- Font Awesome, non-brand -------------------------------------------
  'fa-envelope': ENVELOPE,
  'fa-shopping-basket':
    '<path d="m9.42 3.13 1.86.74L9.79 8h4.42l-1.49-4.13 1.86-.74L16.35 8H21a1 1 0 0 1 .98 1.2l-1.8 9A2 2 0 0 1 18.22 20H5.78a2 2 0 0 1-1.96-1.8l-1.8-9A1 1 0 0 1 3 8h4.65ZM8 11v6h2v-6Zm6 0v6h2v-6Z"/>',
  'fa-university':
    '<path d="M12 2 2 7v2h20V7ZM3.5 11H6v7H3.5Zm5 0H11v7H8.5Zm5 0H16v7h-2.5Zm5 0H21v7h-2.5ZM2 19h20v2H2Z"/>',
  'fa-newspaper':
    '<path d="M3 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v13a2 2 0 0 0 .55 1.38A2 2 0 0 1 19 20H5a2 2 0 0 1-2-2Zm3 2v2.5h9V7Zm0 4.5V13h9v-1.5ZM6 15v1.5h6V15Z"/>' +
    '<path d="M19.5 8H20a1 1 0 0 1 1 1v9a.75.75 0 0 1-1.5 0Z"/>',

  // --- Flaticon ----------------------------------------------------------
  // Line-ish glyphs are still drawn as filled shapes rather than strokes, so
  // that a rule setting `fill` on the svg colours them the way it coloured
  // the font glyph before.
  'flaticon-up-arrow': '<path d="M12 2.6 3.9 10.7l1.7 1.7 5.2-5.2V21.4h2.4V7.2l5.2 5.2 1.7-1.7Z"/>',
  'flaticon-right-arrow-1': '<path d="M13.3 3.9 11.6 5.6l5.2 5.2H2.6v2.4h14.2l-5.2 5.2 1.7 1.7 8.1-8.1Z"/>',
  'flaticon-close':
    '<path d="M4.7 3.3 12 10.6l7.3-7.3 1.4 1.4L13.4 12l7.3 7.3-1.4 1.4L12 13.4l-7.3 7.3-1.4-1.4L10.6 12 3.3 4.7Z"/>',
  'flaticon-envelope': ENVELOPE,
  'flaticon-search':
    '<path d="M10.5 3a7.5 7.5 0 1 1-4.6 13.43l-.02.02-.68-.68A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/>' +
    '<path d="m15.6 17.02 1.42-1.42 4.4 4.4-1.42 1.42Z"/>',
  'flaticon-download-arrow':
    '<path d="M10.8 2.6h2.4v10.6l4.4-4.4 1.7 1.7L12 17.8l-7.3-7.3 1.7-1.7 4.4 4.4ZM3.5 19h17v2.4h-17Z"/>',
};

/**
 * Glyphs deliberately not converted. Listed rather than merely absent so the
 * decision is visible at the point someone wonders why the font is still
 * being loaded on the blog.
 */
const KEEP_AS_FONT = ['fa-twitter', 'fa-facebook-f', 'fa-linkedin-in', 'fa-pinterest-p', 'fa-reddit-alien'];

const ICON_STYLE_ID = 'vm-inline-icons';
const ICON_STYLE = `<style id="${ICON_STYLE_ID}">.vm-icon{width:1em;height:auto;aspect-ratio:1;display:inline-block;vertical-align:-.125em;fill:currentColor;flex:0 0 auto;}</style>`;

/** <i ...></i> or <i .../> — the theme writes both. */
const ICON_TAG = /<i\b([^>]*)>\s*<\/i>|<i\b([^>]*)\/>/gi;

function classesOf(attrs) {
  const m = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const raw = m ? (m[1] !== undefined ? m[1] : m[2]) : '';
  return raw.split(/\s+/).filter(Boolean);
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function processPage(file, stats) {
  let html = fs.readFileSync(file, 'utf-8');
  let replaced = 0;

  const out = html.replace(ICON_TAG, (whole, a1, a2) => {
    const attrs = a1 !== undefined ? a1 : a2;
    const classes = classesOf(attrs);
    const glyph = classes.find((c) => GLYPHS[c]);
    if (!glyph) return whole;

    replaced++;
    stats.byGlyph.set(glyph, (stats.byGlyph.get(glyph) || 0) + 1);

    // Sibling classes are carried over — .up and .down are positional and
    // dropping them would move the icon. The GLYPH class is not: it only
    // ever meant "put codepoint F1xx here via ::before", which is now what
    // the <svg> does, and leaving it behind would defeat the point of the
    // exercise. scripts/bundle-css.js decides whether a page still needs the
    // icon stylesheets by looking for a font-drawn glyph, and a converted
    // icon that kept its class would keep answering yes.
    const keptClasses = ['vm-icon', ...classes.filter((c) => c !== glyph)].join(' ');
    return `<svg class="${keptClasses}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${GLYPHS[glyph]}</svg>`;
  });

  if (!replaced) return;

  let html2 = out;
  if (!html2.includes(ICON_STYLE_ID)) {
    const headEnd = html2.search(/<\/head>/i);
    if (headEnd !== -1) html2 = html2.slice(0, headEnd) + ICON_STYLE + '\n' + html2.slice(headEnd);
  }

  fs.writeFileSync(file, html2);
  stats.pages++;
  stats.replaced += replaced;
}

function main() {
  console.log('\n🎯 Inlining icon-font glyphs as SVG...\n');

  const stats = { pages: 0, replaced: 0, byGlyph: new Map() };
  for (const file of findHtmlFiles(DIST)) processPage(file, stats);

  console.log(`✅ ${stats.replaced} glyph(s) inlined across ${stats.pages} page(s)`);
  for (const [g, n] of [...stats.byGlyph].sort((a, b) => b[1] - a[1])) {
    console.log(`   • ${g.padEnd(26)} ${n}`);
  }

  // How many pages can now drop the icon stack entirely, and which glyphs
  // are keeping it alive on the rest.
  const files = findHtmlFiles(DIST);
  const stillFa = files.filter((f) => /\bfa-[a-z0-9-]+/.test(fs.readFileSync(f, 'utf-8').match(/class="[^"]*"/g)?.join(' ') || ''));
  const stillFlaticon = files.filter((f) => /\bflaticon-[a-z0-9-]+/.test(fs.readFileSync(f, 'utf-8')));

  console.log(`\n   • ${files.length - stillFa.length} of ${files.length} page(s) no longer reference a Font Awesome glyph`);
  console.log(`   • ${files.length - stillFlaticon.length} of ${files.length} no longer reference a Flaticon glyph`);
  console.log(`   • kept as a font on purpose: ${KEEP_AS_FONT.join(', ')} — brand marks, see the header comment`);

  // Any non-brand glyph left behind is one this script does not know about,
  // and it will silently keep 140 KB of stylesheets alive on its page.
  const unknown = new Map();
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf-8');
    for (const m of html.matchAll(/class="([^"]*\b(?:fa|flaticon)-[a-z0-9-]+[^"]*)"/gi)) {
      for (const c of m[1].split(/\s+/)) {
        if (!/^(fa|flaticon)-/.test(c)) continue;
        if (GLYPHS[c] || KEEP_AS_FONT.includes(c)) continue;
        unknown.set(c, (unknown.get(c) || 0) + 1);
      }
    }
  }
  if (unknown.size) {
    console.log(`   ⚠ ${unknown.size} glyph(s) still drawn with a font and not listed above — add them to GLYPHS:`);
    [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([c, n]) => console.log(`       ${c} (${n})`));
  } else {
    console.log('   ✓ every remaining font glyph is a deliberate exception\n');
  }
}

main();
