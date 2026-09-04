#!/usr/bin/env node

/**
 * Branded Open Graph cards for the blog.
 *
 * Every blog post (DE and EN) shipped with the 128 px favicon-logo as its
 * og:image — and as a RELATIVE URL, which Open Graph consumers treat as no
 * image at all (the spec requires absolute). A shared link therefore
 * rendered as bare text in Slack/LinkedIn/WhatsApp/iMessage previews. The
 * feature pages are deliberately NOT touched: they already point at their
 * photoreal hero JPGs, which are better link previews than any text card.
 *
 * Each post gets a 1200×630 card rendered from an SVG template: white
 * ground, vm-red (#94152b) accent bar, soft vm-blue (#66a3ce) accents, the
 * post title set in the site's own Montserrat, and the logo + domain
 * footer. No new palette, no new typeface — the site's design language,
 * just at card size.
 *
 * FONTS — WHY A PYTHON SIDE-STEP
 *
 * sharp rasterises SVG text through fontconfig, which only sees installed
 * system fonts — and the build machine does not have Montserrat installed.
 * The site itself ships Montserrat as a VARIABLE woff2 (wght 100–900), so
 * this script instantiates static TTFs at the needed weights from the
 * site's own font files (fonttools + brotli, present on the build machine)
 * into .cache/og-fonts/, and points fontconfig there via FONTCONFIG_PATH.
 * If python3/fonttools is missing the script falls back to the system
 * sans-serif rather than failing the build — the cards render slightly
 * off-typeface but correct.
 *
 * Rendered PNGs are cached in .cache/og keyed on the SVG's content hash,
 * for the same reason generate-avif.js caches: dist/ is wiped every build
 * and only changed titles should pay for a re-render.
 *
 * Runs after enrich-structured-data.js (titles are final) and before
 * generate-sitemap.js.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';
const FONT_CACHE = path.join(__dirname, '../.cache/og-fonts');
const CARD_CACHE = path.join(__dirname, '../.cache/og');
const OG_DIR = path.join(DIST, 'assets/og');

const VM_RED = '#94152b';
const VM_BLUE = '#66a3ce';
const VM_BLUE_LIGHT = '#a3cce9';
const INK = '#23282d';

// Outfit, not Montserrat: the Montserrat woff2 the export ships is the
// Vietnamese-diacritics unicode-range subset and contains no basic Latin
// glyphs at all. Outfit's latin subset is complete (incl. äöüß), and Outfit
// is the heading face on every page this project generated itself — it IS
// the site's current typography.
const OUTFIT_VF = path.join(
  DIST,
  'wp-content/uploads/omgf/elementor-gf-local-outfit/outfit-normal-latin.woff2?ver=1667681412'
);
const LOGO_PNG = path.join(DIST, 'wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png');

let HEAD_FAMILY = 'sans-serif';
let TEXT_FAMILY = 'sans-serif';

function prepareFonts() {
  fs.mkdirSync(FONT_CACHE, { recursive: true });
  const head = path.join(FONT_CACHE, 'VMOGHead.ttf');
  const text = path.join(FONT_CACHE, 'VMOGText.ttf');

  if (!fs.existsSync(head) || !fs.existsSync(text)) {
    if (!fs.existsSync(OUTFIT_VF)) {
      console.warn('   ⚠️  Outfit variable font not found in dist — using system sans-serif');
      return;
    }
    const py = `
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

src, out, family, weight = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
f = TTFont(src)
instantiateVariableFont(f, {"wght": weight}, inplace=True)
f["OS/2"].usWeightClass = int(weight)
for nid in (1, 4, 6, 16):
    f["name"].setName(family, nid, 3, 1, 0x409)
f["name"].setName("Regular", 2, 3, 1, 0x409)
f.flavor = None
f.save(out)
`;
    try {
      execFileSync('python3', ['-c', py, OUTFIT_VF, head, 'VM OG Head', '700']);
      execFileSync('python3', ['-c', py, OUTFIT_VF, text, 'VM OG Text', '500']);
    } catch (e) {
      console.warn(`   ⚠️  Font instancing failed (${e.message.split('\n')[0]}) — using system sans-serif`);
      return;
    }
  }

  fs.writeFileSync(
    path.join(FONT_CACHE, 'fonts.conf'),
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_CACHE}</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>${path.join(FONT_CACHE, 'fc-cache')}</cachedir>
</fontconfig>
`
  );
  // Must be set before sharp's first SVG render — fontconfig reads it once.
  process.env.FONTCONFIG_PATH = FONT_CACHE;
  HEAD_FAMILY = 'VM OG Head';
  TEXT_FAMILY = 'VM OG Text';
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Greedy word-wrap sized to fit the 1040px text column. */
function layoutTitle(title) {
  const size = title.length < 45 ? 68 : title.length < 85 ? 56 : 46;
  const perLine = Math.floor(1040 / (size * 0.62));
  const lines = [];
  let line = '';
  for (const word of title.split(' ')) {
    if (line && (line + ' ' + word).length > perLine) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
    if (lines.length === 4) break;
  }
  if (line && lines.length < 4) lines.push(line);
  if (lines.length === 4 && title.split(' ').length > lines.join(' ').split(' ').length) {
    lines[3] = lines[3].replace(/\s+\S*$/, '') + ' …';
  }
  return { size, lines };
}

function cardSvg(title, kicker, logoB64) {
  const { size, lines } = layoutTitle(title);
  const lineHeight = Math.round(size * 1.22);
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = Math.round(315 - blockHeight / 2 + size * 0.85);

  const tspans = lines
    .map((l, i) => `<tspan x="96" y="${firstBaseline + i * lineHeight}">${esc(l)}</tspan>`)
    .join('');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="1200" height="630" fill="#ffffff"/>
  <circle cx="1150" cy="40" r="230" fill="${VM_BLUE_LIGHT}" opacity="0.28"/>
  <circle cx="1205" cy="600" r="120" fill="${VM_BLUE}" opacity="0.16"/>
  <rect x="0" y="0" width="14" height="630" fill="${VM_RED}"/>
  <text x="96" y="120" font-family="${TEXT_FAMILY}" font-size="26" letter-spacing="6" fill="${VM_RED}">${esc(kicker.toUpperCase())}</text>
  <rect x="96" y="140" width="64" height="5" fill="${VM_RED}"/>
  <text font-family="${HEAD_FAMILY}" font-size="${size}" fill="${INK}">${tspans}</text>
  ${logoB64 ? `<image x="96" y="514" width="60" height="60" xlink:href="data:image/png;base64,${logoB64}"/>` : ''}
  <text x="${logoB64 ? 176 : 96}" y="552" font-family="${HEAD_FAMILY}" font-size="30" fill="${INK}">Virtual Marketer</text>
  <text x="1104" y="552" text-anchor="end" font-family="${TEXT_FAMILY}" font-size="24" fill="#6b7280">virtual-marketer.de</text>
</svg>`;
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
  console.log('\n🪪 Generating branded OG cards for blog posts...\n');

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('❌ sharp is not installed. Run: npm install --save-dev sharp\n');
    process.exit(1);
  }

  prepareFonts();
  fs.mkdirSync(CARD_CACHE, { recursive: true });
  fs.mkdirSync(OG_DIR, { recursive: true });

  const logoB64 = fs.existsSync(LOGO_PNG) ? fs.readFileSync(LOGO_PNG).toString('base64') : null;

  const headTtf = path.join(FONT_CACHE, 'VMOGHead.ttf');
  const fontsStamp = fs.existsSync(headTtf)
    ? crypto.createHash('sha1').update(fs.readFileSync(headTtf)).digest('hex')
    : 'system';

  let cards = 0;
  let fromCache = 0;
  let absolutized = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    const rel = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
    const isBlogPost = /^(en\/)?blog\/[^/]+$/.test(rel);

    if (isBlogPost) {
      const titleMatch = html.match(/<title>([^<]*)<\/title>/);
      const title = titleMatch
        ? decodeEntities(titleMatch[1]).replace(/\s*[|\-–—]\s*Virtual Marketer.*$/, '').trim()
        : null;

      if (title) {
        const slugName = rel.replace(/\//g, '--');
        const outFile = path.join(OG_DIR, `${slugName}.png`);
        const ogUrl = `${BASE_URL}/assets/og/${slugName}.png`;

        const svg = cardSvg(title, 'Blog', logoB64);
        // fontsStamp in the key: a changed/instanced font must invalidate
        // cached cards even though the SVG markup is byte-identical.
        const hash = crypto.createHash('sha1').update(fontsStamp).update(svg).digest('hex');
        const cached = path.join(CARD_CACHE, `${hash}.png`);

        if (fs.existsSync(cached)) {
          fs.copyFileSync(cached, outFile);
          fromCache++;
        } else {
          const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
          fs.writeFileSync(cached, buf);
          fs.writeFileSync(outFile, buf);
        }
        cards++;

        html = html.replace(
          /(<meta property="og:image" content=")[^"]*(")/,
          `$1${ogUrl}$2`
        );
        html = html.replace(
          /(<meta name="twitter:image" content=")[^"]*(")/,
          `$1${ogUrl}$2`
        );
        if (!html.includes('property="og:image:width"')) {
          html = html.replace(
            /(<meta property="og:image" content="[^"]*">)/,
            `$1\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`
          );
        } else {
          html = html
            .replace(/(<meta property="og:image:width" content=")[^"]*(")/, '$11200$2')
            .replace(/(<meta property="og:image:height" content=")[^"]*(")/, '$1630$2');
        }
      }
    }

    // Site-wide: og:image must be absolute or consumers ignore it.
    const abs = html.replace(
      /(<meta (?:property="og:image"|name="twitter:image") content=")\/(?!\/)/g,
      `$1${BASE_URL}/`
    );
    if (abs !== html) {
      absolutized++;
      html = abs;
    }

    if (html !== before) fs.writeFileSync(file, html);
  }

  console.log(`✅ ${cards} OG card(s) generated (${fromCache} from cache)`);
  console.log(`   • ${absolutized} page(s) had relative og:/twitter:image URLs made absolute\n`);
}

main();
