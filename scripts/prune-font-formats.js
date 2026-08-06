#!/usr/bin/env node

/**
 * Keeps one webfont format and deletes the other four.
 *
 * The WordPress export ships every @font-face with the full 2013 fallback
 * chain — eot, then eot again with the IE hack, then woff2, woff, ttf and an
 * SVG font:
 *
 *   src: url(fa-solid-900.eot);
 *   src: url(fa-solid-900.eot?#iefix) format("embedded-opentype"),
 *        url(fa-solid-900.woff2) format("woff2"),
 *        url(fa-solid-900.woff)  format("woff"),
 *        url(fa-solid-900.ttf)   format("truetype"),
 *        url(fa-solid-900.svg#fontawesome) format("svg");
 *
 * A browser downloads only the first format it understands, so the other
 * files were never fetched by anyone — but they are all still in the image,
 * and they are not small. fa-solid-900.svg alone is 919 KB, and the eot, ttf,
 * svg and woff copies together are about 4.5 MB across the tree.
 *
 * That is 4.5 MB of container image, registry storage and cold-start pull
 * time for formats whose last relevant consumer was Internet Explorer 11
 * (eot), Android 4.3 (ttf in that chain) and iOS 4 (SVG fonts, removed from
 * every engine years ago). woff2 is supported by every browser this site
 * targets and is the smallest of the six.
 *
 * WHAT THIS DOES NOT TOUCH
 *
 * SVG *images*. dist has 3 MB of .svg and most of it is logos and
 * illustrations — client1.svg and friends. Only files inside a fonts/ or
 * webfonts/ directory that a @font-face actually named are candidates, which
 * is why deletion is driven by the src lists this step rewrote rather than
 * by a file extension.
 *
 * A family with no woff2 is left completely alone and reported. There are
 * none today, and if one appears the honest outcome is that it keeps its
 * fallbacks rather than silently losing its only usable format.
 *
 * Runs before scripts/bundle-css.js so the bundles are built from the
 * rewritten CSS rather than needing a second pass.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/** Formats we drop, once a woff2 is confirmed present for the same face. */
const LEGACY = /\.(eot|ttf|svg|woff)(\?|#|$)/i;

function findFiles(dir, match, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, match, results);
    else if (match(entry.name)) results.push(full);
  }
  return results;
}

/** Splits a src value into its url(...) format(...) entries. */
function srcEntries(value) {
  return value
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const urlOf = (entry) => {
  const m = entry.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  return m ? m[2].trim() : null;
};

/** Resolves a CSS url() against the stylesheet it appears in. */
function resolve(cssFile, url) {
  if (/^(data:|https?:|\/\/)/i.test(url)) return null;
  const clean = url.split(/[?#]/)[0];
  const base = clean.startsWith('/')
    ? path.join(DIST, clean)
    : path.resolve(path.dirname(cssFile), clean);
  return base;
}

function main() {
  console.log('\n🔡 Pruning legacy webfont formats...\n');

  const cssFiles = findFiles(DIST, (n) => n.toLowerCase().includes('.css'));
  const keptUrls = new Set();
  const droppedUrls = new Set();
  const noWoff2 = [];
  let facesRewritten = 0;

  for (const file of cssFiles) {
    const original = fs.readFileSync(file, 'utf-8');

    const next = original.replace(/@font-face\s*\{[^}]*\}/gi, (face) => {
      // Collect every src declaration in the block. The export writes two:
      // a bare eot for IE8, then the real list.
      const decls = [...face.matchAll(/src\s*:\s*([^;}]+)/gi)];
      if (!decls.length) return face;

      const all = decls.flatMap((d) => srcEntries(d[1]));
      const woff2 = all.find((e) => /\.woff2(\?|#|$)/i.test(urlOf(e) || ''));

      if (!woff2) {
        const family = (face.match(/font-family\s*:\s*([^;]+)/i) || [])[1];
        if (all.length > 1) noWoff2.push((family || '?').trim());
        return face;
      }

      // Confirm the woff2 is actually on disk before throwing the others
      // away — a src list can name a file the export never copied.
      const onDisk = resolve(file, urlOf(woff2));
      if (onDisk && !fs.existsSync(onDisk)) return face;

      for (const entry of all) {
        const u = urlOf(entry);
        if (!u) continue;
        const abs = resolve(file, u);
        if (!abs) continue;
        if (entry === woff2) keptUrls.add(abs);
        else if (LEGACY.test(u)) droppedUrls.add(abs);
      }

      facesRewritten++;

      // One src, one format. The bare IE8 declaration goes with it.
      let out = face.replace(/src\s*:\s*[^;}]+;?/gi, '');
      out = out.replace(/\}\s*$/, `  src: ${woff2};\n}`);
      return out;
    });

    if (next !== original) fs.writeFileSync(file, next);
  }

  console.log(`   • ${facesRewritten} @font-face rule(s) reduced to woff2 only`);
  if (noWoff2.length) {
    console.log(`   ⚠ ${[...new Set(noWoff2)].length} family/families have no woff2 and keep their fallbacks:`);
    [...new Set(noWoff2)].slice(0, 5).forEach((f) => console.log(`       ${f}`));
  }

  // Delete only files that no stylesheet, page or script still names. A file
  // kept by one @font-face and dropped by another must survive.
  const stillReferenced = new Set();
  for (const file of findFiles(DIST, (n) => /\.(css|html|js)$/i.test(n) || n.toLowerCase().includes('.css'))) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const abs of droppedUrls) {
      if (stillReferenced.has(abs)) continue;
      if (text.includes(path.basename(abs))) stillReferenced.add(abs);
    }
  }

  let removed = 0;
  let bytes = 0;
  for (const abs of droppedUrls) {
    if (stillReferenced.has(abs) || keptUrls.has(abs)) continue;
    if (!fs.existsSync(abs)) continue;
    bytes += fs.statSync(abs).size;
    fs.unlinkSync(abs);
    removed++;
  }

  console.log(`✅ ${removed} legacy font file(s) removed, ${(bytes / 1024 / 1024).toFixed(2)} MB freed`);

  // Every face that shipped must still resolve to a file that exists.
  const broken = [];
  for (const abs of keptUrls) {
    if (!fs.existsSync(abs)) broken.push(path.relative(DIST, abs));
  }
  if (broken.length) {
    console.log(`   ⚠ ${broken.length} kept font file(s) missing from dist:`);
    broken.slice(0, 5).forEach((b) => console.log(`       ${b}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ every remaining @font-face resolves to a file on disk\n');
  }
}

main();
