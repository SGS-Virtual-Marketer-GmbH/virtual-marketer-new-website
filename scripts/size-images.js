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

async function main() {
  console.log('\n📐 Adding intrinsic dimensions to images...\n');

  let sized = 0;
  let already = 0;
  let unknown = 0;
  let pages = 0;

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const tags = [...html.matchAll(/<img\b[^>]*>/gi)];
    if (!tags.length) continue;

    let out = html;
    let changed = 0;

    for (const [tag] of tags) {
      if (/\bwidth=/i.test(tag) && /\bheight=/i.test(tag)) { already++; continue; }
      const src = (/\bsrc=(["'])(.*?)\1/i.exec(tag) || [])[2];
      if (!src) continue;

      const dims = await dimensionsOf(src, file);
      if (!dims) { unknown++; continue; }

      // Insert before the closing bracket, preserving a self-closing slash.
      const next = tag.replace(/\s*(\/?)>$/, ` width="${dims.w}" height="${dims.h}"$1>`);
      if (next === tag) continue;
      out = out.replace(tag, next);
      changed++;
    }

    if (changed) {
      fs.writeFileSync(file, out);
      pages++;
      sized += changed;
    }
  }

  console.log(`✅ ${sized} <img> tag(s) given width/height across ${pages} page(s)`);
  console.log(`   • ${already} already had both`);
  if (unknown) console.log(`   • ${unknown} skipped — no readable intrinsic size (SVG, or not an image)`);
  console.log();
}

main();
