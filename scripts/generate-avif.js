#!/usr/bin/env node

/**
 * Writes an `.avif` sibling next to every image worth negotiating, so nginx
 * can serve AVIF to browsers that ask for it (Accept: image/avif) without a
 * single markup change.
 *
 * WHY SIBLINGS + CONTENT NEGOTIATION, NOT A MARKUP REWRITE
 *
 * use-webp.js already rewrote every reference to point at the WebP file, and
 * its header explains why a flat rewrite beat <picture> here (most
 * references are CSS background-images, which <picture> cannot express).
 * Repeating that trick for AVIF would be different in one important way:
 * WebP has had universal browser support since 2020, AVIF only since Safari
 * 16.4 (March 2023) — a flat rewrite would hand older Safari users broken
 * images. Negotiation keeps the WebP URL as the one in the markup and lets
 * the browser's own Accept header decide, with automatic fallback.
 *
 * The sibling is named `<referenced-file>.avif` (e.g. hero.webp.avif),
 * because nginx's `try_files $uri$vm_avif $uri` appends the suffix to the
 * requested path — see the images location in docker/nginx.conf.template.
 *
 * Encoding choices:
 * - Source is the ORIGINAL png/jpg when it still sits next to the webp,
 *   avoiding a lossy webp→avif generation loss; the webp itself otherwise.
 * - Only files ≥ 8 KB are considered — below that AVIF's container overhead
 *   eats the gain and the encode time buys nothing.
 * - The sibling is only kept when it is ≥ 5% smaller than the file it would
 *   replace; AVIF occasionally loses to WebP on flat graphics, and serving a
 *   larger "optimised" file is the same failure use-webp.js guards against.
 *
 * Runs near the end of the pipeline, after use-webp.js and strip-dead-assets,
 * so it never encodes an image that no page references anymore.
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
// Encodes are cached outside dist/ keyed on the source file's content hash,
// because the build wipes dist/ every run and a full re-encode of ~250
// images costs over four minutes; with the cache a rebuild pays only for
// images that actually changed. A cache entry of 0 bytes records "AVIF was
// not smaller for this source" so that outcome is also remembered.
const CACHE = path.join(__dirname, '../.cache/avif');
const MIN_SOURCE_BYTES = 8 * 1024;
const MIN_SAVING = 0.05;
const CONCURRENCY = 4;

function findImages(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findImages(full, results);
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name) && !entry.name.includes('?')) results.push(full);
  }
  return results;
}

/** The original png/jpg a webp was derived from, if it still exists. */
function encodeSourceFor(file) {
  if (!/\.webp$/i.test(file)) return file;
  const base = file.replace(/\.webp$/i, '');
  for (const ext of ['.png', '.jpg', '.jpeg', '.PNG', '.JPG']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  return file;
}

async function processOne(file, stats) {
  const out = `${file}.avif`;
  if (fs.existsSync(out)) {
    stats.kept++;
    return;
  }

  const referencedSize = fs.statSync(file).size;
  if (referencedSize < MIN_SOURCE_BYTES) {
    stats.tooSmall++;
    return;
  }

  const source = encodeSourceFor(file);
  const hash = require('crypto').createHash('sha1').update(fs.readFileSync(source)).digest('hex');
  const cached = path.join(CACHE, `${hash}.avif`);

  try {
    let buf;
    if (fs.existsSync(cached)) {
      stats.fromCache++;
      buf = fs.readFileSync(cached);
      if (buf.length === 0) {
        stats.notSmaller++;
        return;
      }
    } else {
      buf = await sharp(source).avif({ quality: 55, effort: 3 }).toBuffer();
      if (buf.length > referencedSize * (1 - MIN_SAVING)) {
        fs.writeFileSync(cached, Buffer.alloc(0));
        stats.notSmaller++;
        return;
      }
      fs.writeFileSync(cached, buf);
    }

    fs.writeFileSync(out, buf);
    stats.written++;
    stats.savedBytes += referencedSize - buf.length;
  } catch (e) {
    stats.failed++;
    console.warn(`   ⚠️  ${path.relative(DIST, file)}: ${e.message}`);
  }
}

async function main() {
  console.log('\n🖼️  Generating AVIF siblings for content negotiation...\n');

  fs.mkdirSync(CACHE, { recursive: true });
  const images = findImages(DIST);
  const stats = { written: 0, kept: 0, tooSmall: 0, notSmaller: 0, failed: 0, savedBytes: 0, fromCache: 0 };

  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < images.length) {
        const file = images[i++];
        await processOne(file, stats);
      }
    })
  );

  console.log(`✅ ${stats.written} AVIF sibling(s) written, ${stats.fromCache} from cache (${(stats.savedBytes / 1024).toFixed(0)} KB saved for AVIF-capable browsers)`);
  console.log(`   • ${stats.notSmaller} skipped — AVIF not meaningfully smaller`);
  console.log(`   • ${stats.tooSmall} skipped — source under ${MIN_SOURCE_BYTES / 1024} KB`);
  if (stats.kept) console.log(`   • ${stats.kept} already existed`);
  if (stats.failed) console.log(`   • ${stats.failed} failed to encode`);
  console.log();
}

main();
