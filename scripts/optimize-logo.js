#!/usr/bin/env node

/**
 * Serves the header logo at the size it is actually displayed at.
 *
 * The header `<img>` everywhere on the site points at
 * cropped-Virtual-Marketer-Logo-128x128-New.webp — a 512x512, 27.7 KB
 * master — but the page CSS never shows it larger than 60px
 * (`.the-logo img{width:60px}`, the widest of the theme's own responsive
 * steps; mobile-polish.js already shrinks it further to 34px below 1024px).
 * That is 27.6 KB thrown away on every single pageview, site-wide, because
 * the image lives in a shared header include used by every generated page.
 *
 * WHY A SEPARATE STEP RATHER THAN A CHANGE TO size-images.js
 *
 * size-images.js gives an <img> the dimensions it is MISSING; this logo
 * already has explicit width/height (512x512 — accurate, just enormous). No
 * amount of adding attributes fixes an oversized source file: the bytes
 * downloaded are set by which FILE is requested, not by what the markup
 * claims about it. This step instead emits correctly-sized files and points
 * the header at them, which is a distinct job — hence its own script.
 *
 * WHAT IS EMITTED
 *
 * 60x60 (the largest size the image is ever shown at) and 120x120 for 2x
 * displays, both WebP at the project's standard quality (see optimize.js,
 * WEBP_QUALITY = 80), plus an `.avif` sibling for each — the same
 * `<file>.avif` convention generate-avif.js uses, so nginx's existing
 * content-negotiation `try_files` picks them up automatically. Written next
 * to the master file under a new name; the 512x512 original is NEVER
 * touched or deleted; another agent generates the site's favicons from it.
 *
 * WHAT IS REWRITTEN, AND WHAT IS DELIBERATELY LEFT ALONE
 *
 * Only <img> tags whose src is the master file, matched wherever they
 * appear (found on both the ".the-logo" header markup and a differently-
 * templated page's own simplified header, so the header wrapper is not
 * assumed) — path prefix (site-root "/" vs a relative "../…", both occur)
 * is captured and preserved so a rewritten tag still resolves from whatever
 * depth the page lives at. width/height attributes are updated to the new
 * intrinsic size (still 1:1, so nothing about the reserved aspect ratio
 * changes) and a srcset is added for the 2x file. Any existing `style`
 * attribute controlling the DISPLAYED size (several page templates set one)
 * is left exactly as written — only the source and its declared intrinsic
 * size change, never how large it is drawn.
 *
 * The `"logo"` field in JSON-LD structured data on every page also names
 * this file, at full resolution — that is schema.org metadata about the
 * brand mark, not a rendered resource, and is correctly left pointing at
 * the highest-quality master.
 *
 * Runs after use-webp.js/generate-avif.js (so the master .webp exists) and
 * after strip-dead-assets.js (so the new files this step writes cannot be
 * swept as "unreferenced" by a step that ran before they existed).
 * Idempotent: rewritten <img> tags already point at the new files, so a
 * second run's regex simply finds nothing left to match.
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
const LOGO_DIR = 'wp-content/uploads/2023/04';
const MASTER_NAME = 'cropped-Virtual-Marketer-Logo-128x128-New.webp';

const SIZES = [
  { px: 60, suffix: '60' },
  { px: 120, suffix: '120' },
];
const WEBP_QUALITY = 80; // matches scripts/optimize.js
const AVIF_QUALITY = 55; // matches scripts/generate-avif.js
const AVIF_EFFORT = 3;

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

async function emitVariants(masterPath, outDir) {
  const written = [];
  for (const { px, suffix } of SIZES) {
    const webpName = `vm-logo-header-${suffix}.webp`;
    const webpPath = path.join(outDir, webpName);
    if (!fs.existsSync(webpPath)) {
      const buf = await sharp(masterPath).resize(px, px).webp({ quality: WEBP_QUALITY }).toBuffer();
      fs.writeFileSync(webpPath, buf);
      written.push(webpName);
    }
    const avifPath = `${webpPath}.avif`;
    if (!fs.existsSync(avifPath)) {
      const buf = await sharp(masterPath).resize(px, px).avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT }).toBuffer();
      fs.writeFileSync(avifPath, buf);
      written.push(`${webpName}.avif`);
    }
  }
  return written;
}

/** Matches an <img> tag whose src is the master logo, capturing the path prefix. */
const IMG_RE = new RegExp(
  `<img\\b([^>]*?)\\bsrc=(["'])([^"']*?)${MASTER_NAME}\\2([^>]*)>`,
  'g'
);

function rewriteHtml(html) {
  let changed = 0;
  const out = html.replace(IMG_RE, (whole, before, quote, prefix, after) => {
    // Already pointed at a small variant (idempotence) — matched only
    // because the master filename appears nowhere in it, so this branch is
    // unreachable in practice; kept as an explicit guard rather than relying
    // on that.
    if (before.includes('vm-logo-header') || after.includes('vm-logo-header')) return whole;

    const base = `${prefix}vm-logo-header`;
    const src1x = `${base}-60.webp`;
    const src2x = `${base}-120.webp`;

    let rest = `${before} ${after}`;
    // Replace an existing width/height pair with the new intrinsic size;
    // add them if a tag somehow lacks one (defensive — every known instance
    // has both).
    if (/\bwidth=["']?\d+["']?/.test(rest)) {
      rest = rest.replace(/\bwidth=["']?\d+["']?/, 'width="60"');
    } else {
      rest = `${rest} width="60"`;
    }
    if (/\bheight=["']?\d+["']?/.test(rest)) {
      rest = rest.replace(/\bheight=["']?\d+["']?/, 'height="60"');
    } else {
      rest = `${rest} height="60"`;
    }
    // Drop any existing srcset naming the master (none currently do, but a
    // future edit might) before adding ours, so re-generation can't stack.
    rest = rest.replace(/\s*srcset=["'][^"']*["']/, '');
    rest = rest.trim().replace(/\s{2,}/g, ' ');

    changed++;
    return `<img ${rest} src=${quote}${src1x}${quote} srcset="${src1x} 1x, ${src2x} 2x">`;
  });
  return { out, changed };
}

async function main() {
  console.log('\n🖼️  Sizing the header logo for how it is actually displayed...\n');

  const masterPath = path.join(DIST, LOGO_DIR, MASTER_NAME);
  if (!fs.existsSync(masterPath)) {
    console.log(`   ⚠ master logo not found at ${LOGO_DIR}/${MASTER_NAME} — skipped\n`);
    return;
  }

  const outDir = path.join(DIST, LOGO_DIR);
  const written = await emitVariants(masterPath, outDir);

  let pages = 0;
  let tags = 0;
  for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!html.includes(MASTER_NAME)) continue;
    const { out, changed } = rewriteHtml(html);
    if (changed) {
      fs.writeFileSync(file, out);
      pages++;
      tags += changed;
    }
  }

  console.log(`   • ${written.length ? written.join(', ') : 'variants already present'}`);
  console.log(`✅ ${tags} <img> tag(s) repointed at the small variant across ${pages} page(s)\n`);
}

main();
