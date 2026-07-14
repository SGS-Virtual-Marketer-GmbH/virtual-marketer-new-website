#!/usr/bin/env node

/**
 * Image Optimization
 *
 * Two things, both deliberately conservative:
 *
 * 1. Compress JPEG/PNG images IN PLACE (same filename, same path) using
 *    sharp. This needs zero HTML changes and can't break anything — every
 *    existing <img src>, CSS background-image, and srcset reference keeps
 *    working exactly as before, just pointing at a smaller file.
 *
 * 2. Generate a .webp SIBLING next to each compressed image (same
 *    directory, same basename, .webp extension) for future opt-in use.
 *    We do NOT rewrite HTML to <picture>/srcset here — this is a legacy
 *    WordPress + Elementor + WooCommerce export with background-images set
 *    via inline styles and CSS classes in ~77 pages, plus lazy-load
 *    libraries that expect specific markup. Regex-rewriting all of that
 *    reliably is a separate, higher-risk piece of work; the .webp files
 *    are ready whenever that's done properly (see README "What's not done
 *    yet").
 *
 * Only overwrites a file if the optimized version is actually smaller —
 * never makes an image bigger or lower quality for no reason.
 *
 * Run standalone: node scripts/optimize.js
 * (Not wired into `npm run build` — it's slow-ish and shouldn't re-run on
 * every build since dist/ images are already committed as optimized.)
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('\n❌ sharp is not installed. Run: npm install --save-dev sharp\n');
  process.exit(1);
}

const DIST = path.join(__dirname, '../dist');
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
const WEBP_QUALITY = 80;

function findImages(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findImages(full, results);
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

async function optimizeOne(file) {
  const originalSize = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();
  const isJpeg = ext === '.jpg' || ext === '.jpeg';

  try {
    const image = sharp(file);

    // 1. In-place lossy recompression (same format, same path)
    const optimizedBuffer = isJpeg
      ? await image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
      : await image.png({ quality: PNG_QUALITY, compressionLevel: 9, palette: true }).toBuffer();

    let newSize = originalSize;
    if (optimizedBuffer.length < originalSize) {
      fs.writeFileSync(file, optimizedBuffer);
      newSize = optimizedBuffer.length;
    }

    // 2. WebP sibling (additive — never overwrites source, only skipped if
    //    it already exists and is up to date with the source's mtime)
    const webpPath = file.replace(/\.(jpe?g|png)$/i, '.webp');
    const webpExists = fs.existsSync(webpPath);
    const sourceStillFresh = webpExists && fs.statSync(webpPath).mtimeMs >= fs.statSync(file).mtimeMs;

    let webpSize = null;
    if (!sourceStillFresh) {
      const webpBuffer = await sharp(file).webp({ quality: WEBP_QUALITY }).toBuffer();
      fs.writeFileSync(webpPath, webpBuffer);
      webpSize = webpBuffer.length;
    } else {
      webpSize = fs.statSync(webpPath).size;
    }

    return { file, originalSize, newSize, webpSize, skipped: false };
  } catch (err) {
    return { file, originalSize, error: err.message, skipped: true };
  }
}

async function main() {
  console.log('\n📦 Image Optimization\n');

  const images = findImages(DIST);
  console.log(`Found ${images.length} JPEG/PNG images in dist/\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let totalWebp = 0;
  let errors = 0;

  for (const file of images) {
    const result = await optimizeOne(file);
    const rel = path.relative(DIST, result.file);

    if (result.skipped) {
      console.log(`  ⚠ ${rel} — ${result.error}`);
      errors++;
      continue;
    }

    totalBefore += result.originalSize;
    totalAfter += result.newSize;
    totalWebp += result.webpSize;

    const savedPct = result.originalSize > 0
      ? Math.round((1 - result.newSize / result.originalSize) * 100)
      : 0;

    if (savedPct > 0) {
      console.log(`  ✓ ${rel} — ${(result.originalSize / 1024).toFixed(0)}KB → ${(result.newSize / 1024).toFixed(0)}KB (-${savedPct}%), webp: ${(result.webpSize / 1024).toFixed(0)}KB`);
    } else {
      console.log(`  · ${rel} — already optimal, webp: ${(result.webpSize / 1024).toFixed(0)}KB`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Image Optimization Complete\n');
  console.log(`  Images processed:     ${images.length - errors}`);
  if (errors) console.log(`  Errors:                ${errors}`);
  console.log(`  Original size:        ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Optimized size:       ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Saved:                ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(2)} MB (${totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0}%)`);
  console.log(`  WebP siblings total:  ${(totalWebp / 1024 / 1024).toFixed(2)} MB (available for future <picture> adoption)\n`);
}

main();
