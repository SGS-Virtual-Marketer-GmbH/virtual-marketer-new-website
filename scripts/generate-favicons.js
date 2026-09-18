#!/usr/bin/env node

/**
 * One real favicon/app-icon set, generated from the brand mark, linked
 * from every page.
 *
 * Before this step: 183/238 pages had no icon link of any kind, and the
 * 55 that did pointed at whatever the legacy WordPress export happened to
 * ship at that path (a 32/180/192px crop of an OLDER logo variant —
 * "cropped-Virtual_Marketer_Logo_white_small…", not the current mark), and
 * dist/ had no favicon.ico, no site.webmanifest, no maskable icon, and no
 * apple-touch-icon.png at the root at all — every one of those legacy
 * <link> tags was a 404 waiting to happen the moment WordPress leftovers
 * get cleaned up.
 *
 * This step generates one real set from the CURRENT brand mark (the same
 * 512×512 "cropped-Virtual-Marketer-Logo-128x128-New.png" the OG cards and
 * every schema.org Organization.logo already use — one source of truth for
 * "the logo", not a second one) into dist/ root, and links the same seven
 * tags on every page:
 *
 *   favicon.ico             — 16+32px, PNG-in-ICO (see writeIco below)
 *   icon-192.png/icon-512.png — "any" purpose, full-bleed like the current mark
 *   icon-maskable-512.png   — the mark scaled to 60% and centered on a white
 *                             512 canvas, so Android's circle/squircle/rounded-
 *                             square masks can't clip the V or the profile
 *                             line (the source mark touches the top and right
 *                             edges — safe at "any" purpose, NOT at maskable's
 *                             ~80%-diameter safe circle without this padding)
 *   apple-touch-icon.png    — 180×180, opaque (iOS ignores alpha and paints
 *                             its own gray behind transparency, so the
 *                             mark's real white background is correct here,
 *                             not a bug to fix)
 *   site.webmanifest        — name/short_name/icons/theme_color/background_color
 *
 * THEME-COLOR, LIGHT AND DARK
 *
 * seo-optimize.js already writes a single `<meta name="theme-color"
 * content="#1a202c">` on its ~10 hardcoded pages — one value, no media
 * query, so a light-mode visitor got a dark-slate browser chrome that
 * doesn't match the page underneath. The site's actual light/dark ground
 * colors are #fff / #171717 (see enable-dark-mode.js's own body
 * background twin, generated straight from this same site's CSS) — this
 * step replaces that single tag everywhere with the real pair, scoped by
 * `media="(prefers-color-scheme: …)"`, so the chrome always matches the
 * page it's framing instead of guessing one value for both.
 *
 * Runs after generate-feed.js, before inject-social-meta.js — no
 * dependency between the three, this is just a tidy place for it. Icons
 * are cached in .cache/favicons (keyed on the source logo's content hash)
 * for the same reason generate-og-images.js caches: dist/ is rebuilt from
 * scratch every run and only a changed logo should pay for a re-render.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '../dist');
const CACHE_DIR = path.join(__dirname, '../.cache/favicons');
const LOGO_PNG = path.join(DIST, 'wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png');

const THEME_LIGHT = '#ffffff';
const THEME_DARK = '#171717';

const ICON_LINKS = `<link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" href="/icon-192.png" sizes="192x192">
  <link rel="icon" type="image/png" href="/icon-512.png" sizes="512x512">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">`;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/**
 * Minimal PNG-in-ICO writer. Every modern favicon.ico consumer has decoded
 * embedded PNG resources since Vista/Chrome 1 — there is no need for a
 * BMP/DIB encoder here, just the ICONDIR container format around PNG
 * bytes sharp already produced.
 */
function writeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const chunks = [header];

  pngBuffers.forEach(({ size, buffer }, i) => {
    const e = i * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, e + 0); // width
    entries.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    entries.writeUInt8(0, e + 2); // color count
    entries.writeUInt8(0, e + 3); // reserved
    entries.writeUInt16LE(1, e + 4); // planes
    entries.writeUInt16LE(32, e + 6); // bit count
    entries.writeUInt32LE(buffer.length, e + 8); // bytes in resource
    entries.writeUInt32LE(offset, e + 12); // image offset
    offset += buffer.length;
    chunks.push(buffer);
  });
  chunks.splice(1, 0, entries);

  return Buffer.concat(chunks);
}

async function main() {
  console.log('\n🖼️  Generating favicon / web app manifest icon set...\n');

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('❌ sharp is not installed. Run: npm install --save-dev sharp\n');
    process.exit(1);
  }

  if (!fs.existsSync(LOGO_PNG)) {
    console.error(`❌ Brand mark not found at ${LOGO_PNG} — skipping icon generation.\n`);
    return;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const logoBuf = fs.readFileSync(LOGO_PNG);
  const logoHash = crypto.createHash('sha1').update(logoBuf).digest('hex').slice(0, 12);
  const cacheKey = (name) => path.join(CACHE_DIR, `${logoHash}-${name}`);

  async function cachedPng(name, render) {
    const cached = cacheKey(name);
    if (fs.existsSync(cached)) return fs.readFileSync(cached);
    const buf = await render();
    fs.writeFileSync(cached, buf);
    return buf;
  }

  const png16 = await cachedPng('16.png', () => sharp(logoBuf).resize(16, 16).png().toBuffer());
  const png32 = await cachedPng('32.png', () => sharp(logoBuf).resize(32, 32).png().toBuffer());
  const png192 = await cachedPng('192.png', () => sharp(logoBuf).resize(192, 192).png().toBuffer());
  const png512 = await cachedPng('512.png', () => sharp(logoBuf).resize(512, 512).png().toBuffer());
  const appleTouch = await cachedPng('apple-touch-icon.png', () =>
    sharp(logoBuf)
      .resize(180, 180)
      .flatten({ background: THEME_LIGHT })
      .png()
      .toBuffer()
  );
  const maskable = await cachedPng('maskable-512.png', () =>
    sharp(logoBuf)
      .resize(Math.round(512 * 0.6), Math.round(512 * 0.6))
      .toBuffer()
      .then((inner) =>
        sharp({
          create: { width: 512, height: 512, channels: 4, background: THEME_LIGHT },
        })
          .composite([{ input: inner, gravity: 'center' }])
          .png()
          .toBuffer()
      )
  );
  const ico = writeIco([
    { size: 16, buffer: png16 },
    { size: 32, buffer: png32 },
  ]);

  fs.writeFileSync(path.join(DIST, 'favicon.ico'), ico);
  fs.writeFileSync(path.join(DIST, 'icon-192.png'), png192);
  fs.writeFileSync(path.join(DIST, 'icon-512.png'), png512);
  fs.writeFileSync(path.join(DIST, 'icon-maskable-512.png'), maskable);
  fs.writeFileSync(path.join(DIST, 'apple-touch-icon.png'), appleTouch);

  const manifest = {
    name: 'Virtual Marketer',
    short_name: 'Virtual Marketer',
    description: 'KI-Marketinglösung aus Deutschland — Custom KI-Modelle für Produktbeschreibungen, Blog, Ads und mehr.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'de',
    theme_color: '#94152b',
    background_color: THEME_LIGHT,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(DIST, 'site.webmanifest'), JSON.stringify(manifest, null, 2));

  console.log('✅ favicon.ico, icon-192/512.png, icon-maskable-512.png, apple-touch-icon.png, site.webmanifest written\n');

  // ---- link the set from every page, replacing any legacy/partial icon
  // links and the old single non-media theme-color tag ----------------------
  let linked = 0;
  let alreadyLinked = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;
    if (html.indexOf('</head>') === -1) continue;

    if (html.includes('href="/favicon.ico"')) {
      alreadyLinked++;
      continue;
    }

    // Legacy per-page icon links (32/180/192px crops of an older logo
    // variant) and the single flat theme-color tag seo-optimize.js writes —
    // both superseded by the unified set above.
    html = html.replace(/\s*<link rel="icon"[^>]*>\n?/gi, '');
    html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>\n?/gi, '');
    html = html.replace(/\s*<link rel="manifest"[^>]*>\n?/gi, '');
    html = html.replace(/\s*<meta name="theme-color" content="[^"]*">\n?/gi, '');

    html = html.replace('</head>', `  ${ICON_LINKS}\n</head>`);

    if (html !== before) {
      fs.writeFileSync(file, html);
      linked++;
    }
  }

  console.log(`✅ Icon links + theme-color added to ${linked} page(s) (${alreadyLinked} already linked)\n`);
}

main();
