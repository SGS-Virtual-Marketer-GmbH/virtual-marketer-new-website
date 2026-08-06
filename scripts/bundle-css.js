#!/usr/bin/env node

/**
 * Concatenates each page's render-blocking stylesheets into one file.
 *
 * The homepage links 21 stylesheets in <head>, 474 KB uncompressed. Every
 * one of them blocks the first paint, and under a throttled mobile
 * connection the cost is not mainly the bytes — gzip takes that to well
 * under a fifth — it is that the browser cannot paint until the last of 21
 * serialised requests comes back. With CLS fixed, this is what is left
 * between the page and a passing score: FCP 2.3-2.6 s, Speed Index ~4.4 s.
 *
 * Bundling is safe here in a way it usually is not, because the site is
 * static and the set of stylesheets per page is fixed at build time. Pages
 * that link the same set in the same order share one bundle file, keyed by
 * content hash, so a visitor moving from the homepage to a blog post
 * re-uses what is already in cache instead of fetching a near-identical
 * second copy.
 *
 * WHAT MAKES THIS FIDDLY: url()
 *
 * A stylesheet's url() references resolve against the STYLESHEET's location,
 * not the document's. Move the CSS and every relative reference breaks —
 * silently, as missing fonts and missing background images rather than as an
 * error. This site has 264 of them on the homepage alone (../fonts/,
 * ../webfonts/, ../../2024/03/, bare filenames), so each is rewritten to an
 * absolute site path as its stylesheet is inlined.
 *
 * The rewrite deliberately does NOT decode anything. The scrape kept the
 * query string inside the filename, so a font is genuinely called
 * "outfit-normal-latin.woff2%3Fver=1667681412" on disk and the CSS already
 * refers to it that way; treating the reference as an opaque path segment
 * and only prefixing the directory is the one transformation that cannot
 * corrupt it.
 *
 * @import would break this — an @import is only valid at the top of a
 * stylesheet, so concatenating would move some below rules and the browser
 * would drop them. There are none in dist/, and the script refuses to bundle
 * a page whose stylesheets contain one rather than silently producing a
 * page with missing styles.
 *
 * WHAT IS NOT BUNDLED
 *
 * Anything with a media attribute other than "all" (it is not
 * render-blocking in the same way, and folding it in would apply it
 * unconditionally), anything loaded from another origin, and any stylesheet
 * whose file is missing. Those are left as their own <link>.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '../dist');
const BUNDLE_DIR = path.join(DIST, 'assets/css');

/**
 * Stylesheets that only matter when a page actually uses the thing they
 * style. The marker is a string that must appear in the page's HTML.
 *
 * contact-form-7 is here because the plugin's markup appears on no page at
 * all any more — the contact and model-request forms are ours — so its
 * stylesheet was 2.4 KB and a blocking request on all 54 legacy pages in
 * exchange for styling nothing.
 */
const CONDITIONAL = [
  { match: /contact-form-7/i, marker: 'wpcf7' },

  // The icon stacks. scripts/inline-icon-fonts.js replaces every non-brand
  // glyph with inline SVG, which leaves most pages with no fa-* or flaticon-*
  // class at all — and a page with no such class gets nothing from 140 KB of
  // icon CSS but a slower first paint. The brand marks on the blog share row
  // are deliberately still drawn with the font, so those pages keep it.
  //
  // The markers are the class prefixes rather than a plugin name because
  // that is the actual question: not "is Font Awesome installed" but "does
  // anything on this page ask to be drawn with it".
  // The marker is matched against an <i> element specifically, not the whole
  // document. A converted icon is an <svg>, and the theme's own class names
  // contain these prefixes in places that have nothing to do with icons, so
  // a plain substring test would answer "still needed" on every page.
  { match: /font-?awesome[^/]*\.css/i, marker: /<i\b[^>]*\bfa-[a-z0-9-]+/i },
  { match: /\/(solid|regular|brands)\.min\.css/i, marker: /<i\b[^>]*\bfa-[a-z0-9-]+/i },
  { match: /flaticon\.css/i, marker: /<i\b[^>]*\bflaticon-[a-z0-9-]+/i },
  { match: /elementor-icons\.min\.css/i, marker: /<i\b[^>]*\beicon-[a-z0-9-]+/i },
];

/** A page "needs" a conditional stylesheet if its marker is present. */
function needs(html, marker) {
  return marker instanceof RegExp ? marker.test(html) : html.includes(marker);
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/** <link ... rel=stylesheet ... > in either attribute order and quote style. */
const LINK = /<link\b[^>]*>/gi;

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

/**
 * Resolves an href written in the HTML to a path on disk.
 *
 * The scrape encodes the query separator as %3F in HTML attributes while the
 * file on disk carries a literal "?", so the decode happens here and nowhere
 * else.
 */
function distPathFor(href, pageDir) {
  const clean = href.split('#')[0];
  const onDisk = decodeURIComponent(clean);
  return clean.startsWith('/')
    ? path.join(DIST, onDisk.slice(1))
    : path.join(pageDir, onDisk);
}

/** Site-absolute URL (still %-encoded) for an href seen on a page. */
function siteUrlFor(href, pageUrlDir) {
  if (href.startsWith('/')) return href;
  return path.posix.normalize(pageUrlDir + '/' + href);
}

/**
 * Rewrites relative url() references so they still resolve once the rules
 * have moved to /assets/css/. cssUrlDir is the stylesheet's own directory as
 * a site-absolute, still-encoded URL path.
 */
function rewriteUrls(css, cssUrlDir) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, quote, ref) => {
    const r = ref.trim();
    if (
      r === '' ||
      r.startsWith('data:') ||
      r.startsWith('#') ||
      r.startsWith('/') ||
      /^[a-z][a-z0-9+.-]*:/i.test(r)
    ) {
      return whole;
    }
    const abs = path.posix.normalize(cssUrlDir + '/' + r);
    return `url(${quote}${abs}${quote})`;
  });
}

/** Comments only. Whitespace is left to gzip, which handles it better. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Bundles the stylesheet links inside one region of a document.
 *
 * Head and body are bundled separately rather than together. Elementor emits
 * three per-post stylesheets deep in the body on the scraped pages, and
 * folding those into a link that sits in <head> would move them ahead of the
 * theme's inline <style> blocks — a cascade change, for 10 KB. Two bundles
 * that each keep their position is the version that cannot alter rendering.
 */
function bundleRegion(region, html, file, stats) {
  const pageDir = path.dirname(file);
  const pageUrlDir = '/' + path.relative(DIST, pageDir).split(path.sep).join('/');

  const candidates = [];
  for (const m of region.matchAll(LINK)) {
    const tag = m[0];
    if (!/\brel\s*=\s*(['"]?)stylesheet\1/i.test(tag)) continue;
    const href = attr(tag, 'href');
    if (!href) continue;

    const media = attr(tag, 'media');
    if (media && media.trim().toLowerCase() !== 'all') continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue;

    const onDisk = distPathFor(href, pageDir);
    if (!fs.existsSync(onDisk)) continue;

    candidates.push({ tag, href, onDisk, index: m.index });
  }

  if (candidates.length < 2) return null;

  // A page whose stylesheets @import would be broken by concatenation.
  for (const c of candidates) {
    if (/@import/i.test(fs.readFileSync(c.onDisk, 'utf-8'))) {
      stats.skippedImport++;
      return null;
    }
  }

  const parts = [];
  const dropped = [];
  for (const c of candidates) {
    const cond = CONDITIONAL.find((x) => x.match.test(c.href));
    if (cond && !needs(html, cond.marker)) {
      dropped.push(c);
      stats.droppedDead++;
      continue;
    }
    const siteUrl = siteUrlFor(c.href, pageUrlDir);
    const cssUrlDir = path.posix.dirname(siteUrl);
    const css = rewriteUrls(stripComments(fs.readFileSync(c.onDisk, 'utf-8')), cssUrlDir);
    // @charset is only honoured at the very start of a stylesheet; anywhere
    // else it is an error, so drop them all — the bundle is served as UTF-8
    // by the Content-Type header either way.
    parts.push(`/* ${siteUrl} */\n` + css.replace(/@charset\s+["'][^"']*["']\s*;/gi, ''));
  }

  if (!parts.length) return null;

  const bundle = parts.join('\n');
  const hash = crypto.createHash('sha1').update(bundle).digest('hex').slice(0, 10);
  const name = `vm-${hash}.css`;
  const outFile = path.join(BUNDLE_DIR, name);
  if (!fs.existsSync(outFile)) {
    fs.mkdirSync(BUNDLE_DIR, { recursive: true });
    fs.writeFileSync(outFile, bundle);
    stats.bundles.add(name);
  }
  stats.bundleUse.set(name, (stats.bundleUse.get(name) || 0) + 1);

  // Replace the first bundled link in place — keeping its position preserves
  // the cascade against anything before or after it — and remove the rest.
  //
  // Matched on the tag's byte offset rather than its text: several of these
  // <link> tags are byte-identical to each other, so comparing strings would
  // delete the wrong one.
  const dropOffsets = new Set(dropped.map((d) => d.index));
  const bundledOffsets = new Set(
    candidates.filter((c) => !dropOffsets.has(c.index)).map((c) => c.index)
  );
  const keepOffset = candidates.find((c) => !dropOffsets.has(c.index)).index;

  const out = region.replace(LINK, (tag, offset) => {
    if (dropOffsets.has(offset)) return '';
    if (!bundledOffsets.has(offset)) return tag;
    if (offset === keepOffset) {
      return `<link rel="stylesheet" href="/assets/css/${name}" media="all">`;
    }
    return '';
  });

  stats.linksBefore += candidates.length;
  stats.linksAfter++;
  return out;
}

function processPage(file, stats) {
  const html = fs.readFileSync(file, 'utf-8');
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return false;

  const head = bundleRegion(html.slice(0, headEnd), html, file, stats);
  const body = bundleRegion(html.slice(headEnd), html, file, stats);
  if (head === null && body === null) return false;

  fs.writeFileSync(file, (head ?? html.slice(0, headEnd)) + (body ?? html.slice(headEnd)));
  stats.pages++;
  return true;
}

function main() {
  console.log('\n📦 Bundling render-blocking CSS...\n');

  const stats = {
    pages: 0,
    linksBefore: 0,
    linksAfter: 0,
    droppedDead: 0,
    skippedImport: 0,
    bundles: new Set(),
    bundleUse: new Map(),
  };

  for (const file of findHtmlFiles(DIST)) processPage(file, stats);

  console.log(`✅ ${stats.linksBefore} stylesheet link(s) collapsed to ${stats.linksAfter} across ${stats.pages} page(s)`);
  console.log(`   • ${stats.bundles.size} distinct bundle(s) — pages with the same stylesheet set share one`);
  for (const [name, n] of [...stats.bundleUse].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    const kb = Math.round(fs.statSync(path.join(BUNDLE_DIR, name)).size / 1024);
    console.log(`       ${name}  ${String(kb).padStart(4)} KB  ${n} page(s)`);
  }
  if (stats.droppedDead) {
    console.log(`   • ${stats.droppedDead} stylesheet(s) dropped as unused on their page`);
  }
  if (stats.skippedImport) {
    console.log(`   ⚠ ${stats.skippedImport} page(s) left alone — a stylesheet uses @import`);
  }

  // Every url() in a bundle must point at a file that exists. A broken
  // reference here is a missing font or background, which looks like a
  // design decision rather than a build fault.
  let checked = 0;
  const broken = [];
  for (const name of stats.bundles) {
    const css = fs.readFileSync(path.join(BUNDLE_DIR, name), 'utf-8');
    for (const m of css.matchAll(/url\(\s*['"]?(\/[^'")]+)['"]?\s*\)/gi)) {
      checked++;
      const target = path.join(DIST, decodeURIComponent(m[1]).slice(1).split('#')[0]);
      if (!fs.existsSync(target)) broken.push(m[1]);
    }
  }
  const uniqueBroken = [...new Set(broken)];
  if (uniqueBroken.length) {
    console.log(`   ⚠ ${uniqueBroken.length} of ${checked} url() reference(s) point at a missing file:`);
    uniqueBroken.slice(0, 8).forEach((u) => console.log(`       ${u}`));
  } else {
    console.log(`   ✓ all ${checked} rewritten url() reference(s) resolve to a real file\n`);
  }
}

main();
