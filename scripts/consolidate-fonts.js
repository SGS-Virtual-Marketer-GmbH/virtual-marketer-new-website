#!/usr/bin/env node

/**
 * Collapses the site's six text typefaces into one: Outfit.
 *
 * The WordPress/Elementor era left ~2000 @font-face rules across the CSS
 * bundles declaring Montserrat, Nunito Sans, DM Sans, Roboto, Roboto Slab
 * and Inter — six families for one brand, most inherited from theme demos
 * rather than chosen. Outfit is the heading face of every page this
 * project generated itself and ships as a VARIABLE woff2 (wght 100–900),
 * so it can stand in for every weight of every legacy family from two
 * small files.
 *
 * HOW: rather than rewriting thousands of `font-family:` usages, the
 * legacy families' @font-face rules are REMOVED and re-declared as aliases
 * — same family names, src pointing at the Outfit variable files with
 * `font-weight: 100 900`. Every existing rule keeps working; the browser
 * just resolves each name to Outfit. Italic faces are deliberately not
 * declared: with none in the family, browsers synthesize an oblique from
 * the normal face, which reads better than serving upright glyphs labeled
 * italic.
 *
 * Icon fonts (Font Awesome, Flaticon, elementor-icons, vc/vcpb,
 * WooCommerce, wpcal) are never touched — aliasing those would replace
 * glyph codepoints with letters.
 *
 * Freed font FILES are deleted only after confirming nothing in dist/
 * references them anymore, and only from the known webfont directories —
 * the same double-check use-webp.js applies before rewriting.
 *
 * Runs after purge-unused-css.js (bundles are final) and before
 * inject-enhance.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const ALIAS_FAMILIES = ['Montserrat', 'Nunito Sans', 'DM Sans', 'Roboto Slab', 'Roboto', 'Inter'];

const OUTFIT_LATIN = "/wp-content/uploads/omgf/elementor-gf-local-outfit/outfit-normal-latin.woff2%3Fver=1667681412";
const OUTFIT_LATIN_EXT = "/wp-content/uploads/omgf/elementor-gf-local-outfit/outfit-normal-latin-ext.woff2%3Fver=1667681412";
const RANGE_LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const RANGE_LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

// Directories whose woff2 files belong to the aliased families. The Outfit
// dir is NOT here — it is the replacement.
const REMOVABLE_FONT_DIRS = [
  'wp-content/uploads/fonts',
  'wp-content/uploads/omgf/elementor-gf-local-dmsans',
  'wp-content/uploads/omgf/elementor-gf-local-nunitosans',
  'wp-content/uploads/omgf/elementor-gf-local-roboto',
  'wp-content/uploads/omgf/elementor-gf-local-robotoslab',
  'wp-content/uploads/omgf/omgf-stylesheet-70',
  'wp-content/uploads/omgf/omgf-stylesheet-80',
  'wp-content/fonts/roboto',
];

function aliasCss() {
  const rules = [];
  for (const fam of ALIAS_FAMILIES.concat('Outfit')) {
    rules.push(
      `@font-face{font-family:'${fam}';font-style:normal;font-weight:100 900;font-display:swap;src:url('${OUTFIT_LATIN_EXT}')format('woff2');unicode-range:${RANGE_LATIN_EXT};}`,
      `@font-face{font-family:'${fam}';font-style:normal;font-weight:100 900;font-display:swap;src:url('${OUTFIT_LATIN}')format('woff2');unicode-range:${RANGE_LATIN};}`
    );
  }
  return `/* One typeface for the whole site — see scripts/consolidate-fonts.js */\n${rules.join('\n')}\n`;
}

function familyOf(faceBlock) {
  const m = faceBlock.match(/font-family:\s*['"]?([^'";}]+)/i);
  return m ? m[1].trim() : null;
}

function stripAliasedFaces(text) {
  let removed = 0;
  const next = text.replace(/@font-face\s*\{[^{}]*\}/g, (block) => {
    const fam = familyOf(block);
    if (fam && ALIAS_FAMILIES.includes(fam)) {
      removed++;
      return '';
    }
    return block;
  });
  return { next, removed };
}

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🔤 Consolidating six text typefaces into Outfit...\n');

  const all = walk(DIST);
  const textFiles = all.filter(
    (f) => (/\.(css|html)$/.test(f) || f.includes('.css?')) && !f.endsWith(path.join('enhance', 'fonts.css'))
  );

  let rulesRemoved = 0;
  let filesTouched = 0;
  for (const f of textFiles) {
    const text = fs.readFileSync(f, 'utf-8');
    if (!text.includes('@font-face')) continue;
    const { next, removed } = stripAliasedFaces(text);
    if (removed > 0) {
      fs.writeFileSync(f, next);
      rulesRemoved += removed;
      filesTouched++;
    }
  }

  // Ship the alias stylesheet and reference it from every page.
  const enhanceDir = path.join(DIST, 'assets/enhance');
  fs.mkdirSync(enhanceDir, { recursive: true });
  fs.writeFileSync(path.join(enhanceDir, 'fonts.css'), aliasCss());

  const TAG = '<link rel="stylesheet" href="/assets/enhance/fonts.css" id="vm-fonts">\n';
  let injected = 0;
  for (const f of textFiles.filter((x) => x.endsWith('.html'))) {
    let html = fs.readFileSync(f, 'utf-8');
    if (html.includes('id="vm-fonts"')) continue;
    const headClose = html.indexOf('</head>');
    if (headClose === -1) continue;
    fs.writeFileSync(f, html.slice(0, headClose) + TAG + html.slice(headClose));
    injected++;
  }

  // Delete font files nothing references anymore — verified per file.
  const corpus = textFiles
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf-8'))
    .join('\n');
  let deleted = 0;
  let freed = 0;
  for (const dir of REMOVABLE_FONT_DIRS) {
    const abs = path.join(DIST, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of walk(abs)) {
      if (!/\.(woff2?|ttf|eot|svg)/.test(f)) continue;
      const base = path.basename(f).split('?')[0];
      if (corpus.includes(base)) continue;
      freed += fs.statSync(f).size;
      fs.unlinkSync(f);
      deleted++;
    }
  }

  console.log(`✅ ${rulesRemoved} legacy @font-face rule(s) removed from ${filesTouched} file(s)`);
  console.log(`   • alias stylesheet linked on ${injected} page(s)`);
  console.log(`   • ${deleted} unreferenced font file(s) deleted (${(freed / 1024).toFixed(0)} KB)\n`);
}

main();
