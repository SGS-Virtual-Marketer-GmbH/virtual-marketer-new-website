#!/usr/bin/env node

/**
 * Branded Open Graph cards — one system, every page type.
 *
 * This started as a blog-only fix: every post shipped the 128px favicon as
 * a RELATIVE og:image, which Open Graph consumers treat as no image at all
 * (the spec requires absolute), so a shared blog link rendered as bare text
 * in Slack/LinkedIn/WhatsApp/iMessage. That is still fixed here exactly as
 * before.
 *
 * The social-sharing sweep (2026-09) found the same problem, or a weaker
 * one, on the other 88 non-blog pages: 16 with no og:image at all (404,
 * contact, legal, the EN homepage, a straggler legacy blog post whose
 * og:image tag never existed for this script to regex-replace into — see
 * "INSERT, NOT JUST REPLACE" below), and 40 more falling back to the
 * 128×128 favicon crop as their "card" — technically present, but a small
 * square logo is a poor link preview next to a designed 1200×630 card.
 *
 * So the card renderer now runs over EVERY page, classified into a small
 * set of types (home / blog post / blog archive / solutions overview /
 * contact / legal / 404 / faq / about / custom-ai / demo / ai-services /
 * login), each with its own kicker text (translated for /en/), all drawn
 * from the exact same SVG template — same white ground, vm-red accent bar,
 * vm-blue tints, Outfit type, logo + domain footer — so a LinkedIn feed
 * full of Virtual Marketer links reads as one brand no matter which page
 * they came from.
 *
 * ONE DELIBERATE EXCEPTION: the 32 individual feature/solution leaf pages
 * (ki-loesungen/*, en/solutions/*) keep their existing photoreal hero JPGs
 * untouched. Those are real product photography — a better link preview
 * than any text card — and were correct before this sweep. The *listing*
 * pages one level up (/ki-loesungen/, /en/solutions/) are a different
 * story: they had no hero of their own and fell back to the 128px logo, so
 * they get a generated "LÖSUNGEN"/"SOLUTIONS" archive card like any other
 * overview page.
 *
 * The homepage is a card now too, DE and EN both — not because a photo
 * hero is wrong in principle (see above), but because the DE homepage's
 * existing og:image (home17-lllustration.png, 790×751) has always been
 * declared as og:image:width/height 1200×630, which is simply false; and
 * the EN homepage had no og:image of any kind (mirror-en-homepage.js runs
 * before seo-optimize.js, so it copies the DE page before that page has
 * any OG tags to inherit). A generated card is honestly 1200×630 in both
 * languages, which the real photo never was.
 *
 * INSERT, NOT JUST REPLACE
 *
 * The original version only ever regex-*replaced* an existing og:image /
 * twitter:image tag — fine when seo-optimize.js is guaranteed to have put
 * one there first, but at least one legacy blog post never got one (its
 * canonical+hreflang predate this pipeline, so seo-optimize.js's "already
 * has canonical+hreflang, skip" fast path never gave it a fallback image
 * either) and every non-blog page type this step now covers starts from
 * zero. setImageMeta() below inserts the tag before </head> when it is
 * missing, and replaces it in place when it already exists — the same
 * insert-or-replace pattern og:image:width/height already used.
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
 * Outfit, not Montserrat: the Montserrat woff2 the export ships is the
 * Vietnamese-diacritics unicode-range subset and contains no basic Latin
 * glyphs at all. Outfit's latin subset is complete (incl. äöüß), and Outfit
 * is the heading face on every page this project generated itself — it IS
 * the site's current typography. Umlauts/ß are exercised directly by real
 * page titles (e.g. "Datenschutzerklärung", "Erklärung zur Barrierefreiheit"),
 * not a synthetic test string, so a subset regression would show up here.
 *
 * Rendered PNGs are cached in .cache/og keyed on the SVG's content hash,
 * for the same reason generate-avif.js caches: dist/ is wiped every build
 * and only changed titles should pay for a re-render.
 *
 * Runs after enrich-structured-data.js (titles are final) and before
 * generate-feed.js / generate-sitemap.js.
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

// ---- page classification --------------------------------------------------

// Kicker text per card type, DE then EN — every EN page (rel starting
// "en/", or the bare "en" homepage) gets the English column.
const KICKERS = {
  home: ['KI-MARKETING', 'AI MARKETING'],
  'solutions-overview': ['LÖSUNGEN', 'SOLUTIONS'],
  'blog-post': ['BLOG', 'BLOG'],
  'blog-archive': ['BLOG', 'BLOG'],
  contact: ['KONTAKT', 'CONTACT'],
  legal: ['RECHTLICHES', 'LEGAL'],
  '404': ['404', '404'],
  faq: ['FAQ', 'FAQ'],
  about: ['ÜBER UNS', 'ABOUT'],
  'custom-ai': ['CUSTOM KI', 'CUSTOM AI'],
  demo: ['DEMO', 'DEMO'],
  'ai-services': ['AI SERVICES', 'AI SERVICES'],
  login: ['LOGIN', 'LOGIN'],
};

const LEGAL_PATHS = new Set([
  'datenschutzerklaerung',
  'impressum',
  'nutzungsbedingungen',
  'barrierefreiheit',
  'en/privacy-policy',
  'en/legal-notice',
  'en/terms-of-service',
  'en/accessibility',
]);

/**
 * Classify a page by its dist-relative directory (`rel`, '/'-joined, no
 * leading/trailing slash — '' for the site root) and file basename.
 * Returns { type, isEn } or null for pages that keep their existing image
 * (the 32 feature/solution leaf pages — see header comment).
 */
function classify(rel, base) {
  const isEn = rel === 'en' || rel.startsWith('en/');
  if (base === '404.html') return { type: '404', isEn };
  if (rel === '' || rel === 'en') return { type: 'home', isEn };
  if (/^ki-loesungen\/[^/]+$/.test(rel) || /^en\/solutions\/[^/]+$/.test(rel)) return null;
  if (rel === 'ki-loesungen' || rel === 'en/solutions') return { type: 'solutions-overview', isEn };
  if (/^(en\/)?blog\/[^/]+$/.test(rel)) return { type: 'blog-post', isEn };
  if (
    rel === 'blog' ||
    rel === 'en/blog' ||
    /^blog\/kategorie(\/.*)?$/.test(rel) ||
    /^en\/blog\/category(\/.*)?$/.test(rel) ||
    /^(en\/)?blog\/page(\/.*)?$/.test(rel)
  ) {
    return { type: 'blog-archive', isEn };
  }
  if (rel === 'kontakt' || rel === 'en/contact') return { type: 'contact', isEn };
  if (LEGAL_PATHS.has(rel)) return { type: 'legal', isEn };
  if (rel === 'faqs' || rel === 'en/faqs') return { type: 'faq', isEn };
  if (rel === 'management' || rel === 'en/about') return { type: 'about', isEn };
  if (rel === 'modell-anfragen' || rel === 'en/request-custom-model') return { type: 'custom-ai', isEn };
  if (rel === 'virtual-marketer-demo' || rel === 'en/demo') return { type: 'demo', isEn };
  if (rel === 'virtual-marketer-ai-services') return { type: 'ai-services', isEn };
  if (rel === 'login') return { type: 'login', isEn };
  return null;
}

/**
 * Prefer an already-curated og:title over the raw <title> — but strip the
 * "| Virtual Marketer ..." brand suffix from EITHER source. Some pages
 * only ever got seo-optimize.js's lightweight fallback og:title, which is
 * the raw <title> verbatim (e.g. "AI-Trends | Virtual Marketer Blog"),
 * so checking og:title first must not skip the same suffix-strip the raw
 * <title> path already applies, or the card ends up with a redundant
 * brand mention baked into its own headline.
 */
function pageTitle(html) {
  const strip = (s) => s.replace(/\s*[|\-–—]\s*Virtual Marketer.*$/, '').trim() || s;
  const og = html.match(/<meta property="og:title" content="([^"]*)">/);
  if (og) return strip(decodeEntities(og[1]));
  const t = html.match(/<title>([^<]*)<\/title>/);
  if (!t) return null;
  return strip(decodeEntities(t[1])) || null;
}

/** Insert-or-replace og:image / twitter:image + their width/height. */
function setImageMeta(html, url) {
  if (/<meta property="og:image" content="[^"]*">/.test(html)) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${url}$2`);
  } else {
    html = html.replace('</head>', `  <meta property="og:image" content="${url}">\n</head>`);
  }

  if (/property="og:image:width"/.test(html)) {
    html = html
      .replace(/(<meta property="og:image:width" content=")[^"]*(")/, '$11200$2')
      .replace(/(<meta property="og:image:height" content=")[^"]*(")/, '$1630$2');
  } else {
    html = html.replace(
      /(<meta property="og:image" content="[^"]*">)/,
      `$1\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`
    );
  }

  if (/<meta (?:name|property)="twitter:image" content="[^"]*">/.test(html)) {
    html = html.replace(/(<meta (?:name|property)="twitter:image" content=")[^"]*(")/, `$1${url}$2`);
  } else {
    html = html.replace('</head>', `  <meta name="twitter:image" content="${url}">\n</head>`);
  }

  return html;
}

async function main() {
  console.log('\n🪪 Generating branded OG cards for every page type...\n');

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
  let skippedNoTitle = 0;
  const byType = {};

  for (const file of findHtmlFiles(DIST)) {
    const rel = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
    const base = path.basename(file);
    const cls = classify(rel === '.' ? '' : rel, base);
    if (!cls) continue; // feature/solution leaf page — keep its hero photo

    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    const title = pageTitle(html);
    if (!title) {
      skippedNoTitle++;
      continue;
    }

    const kicker = KICKERS[cls.type][cls.isEn ? 1 : 0];
    // rel is '' for BOTH index.html and 404.html at the dist root — cannot
    // slug on rel alone there, or the homepage and the 404 page collide on
    // the same cached file (they did, before this fix: base disambiguates).
    const relKey = rel === '.' ? '' : rel;
    const slugName =
      base === '404.html' ? '404' : relKey === '' ? 'home' : relKey === 'en' ? 'en--home' : relKey.replace(/\//g, '--');
    const outFile = path.join(OG_DIR, `${slugName}.png`);
    const ogUrl = `${BASE_URL}/assets/og/${slugName}.png`;

    const svg = cardSvg(title, kicker, logoB64);
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
    byType[cls.type] = (byType[cls.type] || 0) + 1;

    html = setImageMeta(html, ogUrl);
    if (html !== before) fs.writeFileSync(file, html);
  }

  console.log(`✅ ${cards} OG card(s) generated (${fromCache} from cache)`);
  Object.entries(byType)
    .sort()
    .forEach(([type, n]) => console.log(`   • ${type.padEnd(20)} ${n}`));
  if (skippedNoTitle) console.log(`   ⚠ ${skippedNoTitle} classified page(s) had no extractable title — left untouched`);
  console.log('');
}

main();
