#!/usr/bin/env node

/**
 * Rasterises assets/product-pages/staging-hero.svg to staging-hero.jpg.
 *
 * WHY THE HERO IS AUTHORED HERE RATHER THAN SYNCED
 *
 * The other fifteen feature heroes come from the product repo's
 * public/product-pages and are used as-is. This one is not: the synced
 * artwork showed a male figure beside a dress, and a woman in a blazer-and-
 * skirt suit as the result. Product Staging's entire claim is that the model
 * you choose and the garment you upload are the ones that come back — so an
 * illustration in which neither survives the arrow argues against the
 * feature it is illustrating. The replacement keeps the same composition and
 * palette and fixes what it says: one woman, one dress, same dress on her.
 *
 * WHY A JPG AND NOT AN <img src=".svg">
 *
 * The page references /product-pages/staging-hero.jpg in three places that
 * are not the <img> tag — og:image, the JSON-LD Product image, and the WebP
 * conversion in scripts/use-webp.js. Rendering to the filename the rest of
 * the pipeline already expects keeps all of them working with no special
 * case, and the JPEG is what social cards and search results can actually
 * display.
 *
 * Runs before scripts/optimize.js so the output picks up the same
 * compression and the same "Virtual Marketer" EXIF provenance mark as every
 * other own-work image.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '../assets/product-pages/staging-hero.svg');
const OUT = path.join(__dirname, '../assets/product-pages/staging-hero.jpg');
const DIST = path.join(__dirname, '../dist/product-pages/staging-hero.jpg');

async function main() {
  console.log('\n🖼  Rendering the Product Staging hero...\n');

  if (!fs.existsSync(SRC)) {
    console.log(`   ⚠ ${path.relative(process.cwd(), SRC)} missing — keeping the existing JPG`);
    return;
  }

  const svg = fs.readFileSync(SRC);

  // density rather than a resize: rendering the vector at 2x and letting
  // sharp downsample gives clean edges on the curves, where rasterising
  // straight to 1376 wide leaves the dress hem and the arrow visibly jagged.
  const buf = await sharp(svg, { density: 288 })
    .resize(1376, 768, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, progressive: true, mozjpeg: true })
    .toBuffer();

  fs.writeFileSync(OUT, buf);
  console.log(`   • assets/product-pages/staging-hero.jpg — ${Math.round(buf.length / 1024)} KB`);

  // dist/ may already exist at this point in the pipeline; keep both in step
  // so a rebuild that skips the asset copy still serves the corrected art.
  if (fs.existsSync(path.dirname(DIST))) {
    fs.writeFileSync(DIST, buf);
    console.log('   • dist/product-pages/staging-hero.jpg');
  }

  console.log('   ✓ one woman, one dress, same dress on her\n');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
