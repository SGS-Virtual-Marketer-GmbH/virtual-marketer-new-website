#!/usr/bin/env node

/**
 * Gives every <img> an explicit width and height.
 *
 * Without them the browser cannot reserve space before the image arrives, so
 * everything below it jumps down when it does. On the homepage that was the
 * single largest layout shift — Lighthouse named `div.the-logo` with an
 * "Unsized image element" and scored it 0.212 of a total CLS of 0.355, which
 * on its own is the difference between a passing and a failing Core Web
 * Vital.
 *
 * The attributes do not force a display size. Since 2019 browsers use the
 * width/height pair only to derive an aspect ratio for the placeholder box;
 * CSS still decides how large the image actually renders. So adding them to a
 * responsive image whose CSS says `width: 100%` changes nothing visually and
 * removes the shift — which is why this can be applied blindly to the scraped
 * markup without auditing each layout.
 *
 * Dimensions come from the file itself rather than from the markup, because
 * the markup is what is missing them. Reading 200-odd images costs a second
 * or so and is cached per path, since the same logo appears on every page.
 *
 * ALSO: an inline `aspect-ratio`, on every image with known dimensions —
 * not only the ones this step just sized.
 *
 * width/height attributes are what let a browser reserve space before an
 * image arrives, but the reservation only holds as long as nothing later in
 * the cascade sets ONE of width/height without the other. The header logo
 * hit exactly that: mobile-polish.js has to set `height:34px` for the
 * mobile header, and the moment it did, the box's width became genuinely
 * unknown again until the image decoded — the site's largest measured
 * layout shift before that file's own aspect-ratio override was added by
 * hand (see its comment for the full mechanism). That was a one-off, manual
 * fix for one selector. An inline `aspect-ratio:W/H` on the element itself
 * outranks any external stylesheet rule that isn't `!important` (inline
 * beats selector specificity outright), so it is a generic backstop against
 * the SAME bug on every image, present or future, without needing to find
 * and patch each CSS rule that might someday set a single dimension. Where
 * no such rule exists today it changes nothing: the ratio it states is the
 * same one the browser already infers from width/height.
 *
 * Added to the `style` attribute (appended if one exists, created if not)
 * rather than as a stylesheet rule, so it travels with the element
 * regardless of which bundle purge-unused-css.js does or doesn't keep, and
 * is skipped if a `style` already sets `aspect-ratio` — never overridden.
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('\n❌ sharp is not installed. Run: npm install --save-dev sharp\n');
  process.exit(1);
}

const DIST = path.join(__dirname, '../dist');

const sizeCache = new Map();

async function dimensionsOf(url, fromFile) {
  const clean = url.split('?')[0].split('#')[0];
  if (!clean || /^(https?:)?\/\//i.test(clean) || clean.startsWith('data:')) return null;

  const abs = clean.startsWith('/')
    ? path.join(DIST, clean.replace(/^\//, ''))
    : path.resolve(path.dirname(fromFile), clean);
  if (!abs.startsWith(DIST)) return null;

  if (sizeCache.has(abs)) return sizeCache.get(abs);

  let dims = null;
  try {
    const meta = await sharp(abs).metadata();
    if (meta.width && meta.height) dims = { w: meta.width, h: meta.height };
  } catch {
    dims = null; // SVG without an intrinsic size, or a file that is not an image
  }
  sizeCache.set(abs, dims);
  return dims;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/** Simplest integer W/H ratio for a CSS `aspect-ratio` value. */
function ratioOf(w, h) {
  const d = gcd(w, h) || 1;
  return `${w / d}/${h / d}`;
}

/** Appends aspect-ratio to a tag's style attribute, creating one if needed. */
function withAspectRatio(tag, w, h) {
  const styleMatch = /\bstyle=(["'])(.*?)\1/i.exec(tag);
  if (styleMatch) {
    if (/aspect-ratio\s*:/i.test(styleMatch[2])) return tag; // already stated — never overridden
    const sep = /;\s*$/.test(styleMatch[2]) || !styleMatch[2].trim() ? '' : ';';
    const nextStyle = `${styleMatch[2]}${sep}aspect-ratio:${ratioOf(w, h)}`;
    return tag.replace(styleMatch[0], `style=${styleMatch[1]}${nextStyle}${styleMatch[1]}`);
  }
  return tag.replace(/\s*(\/?)>$/, ` style="aspect-ratio:${ratioOf(w, h)}"$1>`);
}

async function main() {
  console.log('\n📐 Adding intrinsic dimensions and a reserved aspect-ratio to images...\n');

  let sized = 0;
  let already = 0;
  let unknown = 0;
  let ratioed = 0;
  let pages = 0;

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const tags = [...html.matchAll(/<img\b[^>]*>/gi)];
    if (!tags.length) continue;

    let out = html;
    let changed = 0;

    for (const [tag] of tags) {
      const existingW = (/\bwidth=["']?(\d+)["']?/i.exec(tag) || [])[1];
      const existingH = (/\bheight=["']?(\d+)["']?/i.exec(tag) || [])[1];
      let w = existingW ? Number(existingW) : null;
      let h = existingH ? Number(existingH) : null;
      let next = tag;

      if (w && h) {
        already++;
      } else {
        const src = (/\bsrc=(["'])(.*?)\1/i.exec(tag) || [])[2];
        if (!src) continue;
        const dims = await dimensionsOf(src, file);
        if (!dims) { unknown++; continue; }
        w = dims.w;
        h = dims.h;
        // Insert before the closing bracket, preserving a self-closing slash.
        next = next.replace(/\s*(\/?)>$/, ` width="${w}" height="${h}"$1>`);
      }

      const withRatio = withAspectRatio(next, w, h);
      if (withRatio !== next) ratioed++;
      if (withRatio === tag) continue;

      out = out.replace(tag, withRatio);
      changed++;
    }

    if (changed) {
      fs.writeFileSync(file, out);
      pages++;
      sized += changed;
    }
  }

  console.log(`✅ ${sized} <img> tag(s) touched across ${pages} page(s)`);
  console.log(`   • ${already} already had width/height; ${ratioed} tag(s) gained an aspect-ratio`);
  if (unknown) console.log(`   • ${unknown} skipped — no readable intrinsic size (SVG, or not an image)`);
  console.log();
}

main();
