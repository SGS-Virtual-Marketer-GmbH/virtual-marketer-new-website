#!/usr/bin/env node

/**
 * Removes JavaScript and CSS the pages load but never use.
 *
 * The scraped pages carry the full asset list of the WordPress install they
 * came from: a shop, a slider plugin, three carousel libraries, a lightbox,
 * an audio player. None of it has anything to render here. Measured in the
 * browser on the built page — not inferred from the file names:
 *
 *     LayerSlider elements   0        WooCommerce elements  0
 *     Slick sliders          0        Isotope grids         0
 *     Magnific lightboxes    0        MediaElement players  0
 *     EasyPieCharts          0        Countdowns            0
 *     Swiper carousels       0
 *
 * and yet 58 scripts and 37 stylesheets were requested, ~480 KiB of them
 * render-blocking. LayerSlider alone is 241 KiB of JavaScript for a slider
 * that does not exist on any page.
 *
 * This is the single biggest lever on the mobile Lighthouse score, and it
 * needs no infrastructure: the files are simply not referenced any more.
 *
 * WHY A DENYLIST AND NOT AN ALLOWLIST
 *
 * An allowlist would be safer in principle and unusable in practice — the
 * Elementor runtime alone is six interdependent files, and getting one wrong
 * breaks the page silently. Every entry below was checked against the
 * rendered DOM for the feature it powers, and the build verifies afterwards
 * that no removed file is still referenced anywhere.
 *
 * DELIBERATELY KEPT
 *
 *   block-library CSS        Five pages carry wp-block-* markup.
 *   simple-likes CSS         54 blog posts still render its button. The
 *                            button no longer does anything — it posts to a
 *                            WordPress admin-ajax endpoint that is gone — but
 *                            removing dead UI is a content decision, not an
 *                            asset one. Flagged, not silently deleted.
 *
 * NOT KEPT ANY MORE — see scripts/replace-theme-js.js
 *
 * This header used to argue for keeping jQuery, jQuery Migrate and the
 * Elementor runtime, on the grounds that "these lay out the pages". That was
 * wrong, and it was wrong in the way assumptions usually are: nobody had
 * measured it. Rendering the homepage with and without the entire script
 * stack and diffing the two images pixel by pixel showed a 0.296% difference,
 * all of it one CSS marquee caught mid-animation. The stack is removed there
 * rather than here, because the mobile menu did depend on it and had to be
 * reimplemented first.
 *
 * Runs late, after every generator has written its pages, and before
 * optimize.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/**
 * Scripts to drop. Each is matched against the src attribute.
 * The comment on each line names the feature checked for and not found.
 */
const DEAD_SCRIPTS = [
  /layerslider\.utils/i,                  // slider plugin — 0 .ls-* elements
  /layerslider\.kreaturamedia/i,          //   "
  /layerslider\.transitions/i,            //   "
  /jquery\.blockUI/i,                     // WooCommerce ajax overlay — no shop
  /add-to-cart(\.min)?\.js/i,             // WooCommerce
  /woocommerce-add-to-cart/i,             // WooCommerce
  /frontend\/woocommerce(\.min)?\.js/i,   // WooCommerce
  /js\.cookie(\.min)?\.js/i,              // only pulled in as a WooCommerce dep
  /sourcebuster(\.min)?\.js/i,            // WooCommerce visit-source tracking
  /order-attribution(\.min)?\.js/i,       // WooCommerce order attribution
  /magnific-popup/i,                      // lightbox — 0 targets
  /isotope\.pkgd/i,                       // filter grid — 0 grids
  /slick(\.min)?\.js/i,                   // carousel — 0 sliders
  /easypiechart/i,                        // donut charts — 0 charts
  /jquery\.countdown/i,                   // countdown — 0 timers
  /imagesloaded(\.min)?\.js/i,            // only used by isotope/masonry
  /swiper(\.min)?\.js/i,                  // Elementor carousel — 0 carousels
  /royal_preloader/i,                     // preloader, already neutralised

  /**
   * Contact Form 7. There is not one wpcf7 form anywhere in dist/ — checked,
   * zero matches for "wpcf7-form" across every page. Beyond being dead
   * weight, its schema validator builds a Web Worker from a blob: URL, which
   * the site's Content-Security-Policy correctly refuses. That refusal was
   * the sole remaining Best Practices failure on the homepage; the honest fix
   * is to stop shipping a validator for forms that do not exist, rather than
   * to widen the CSP with worker-src blob: to accommodate it.
   */
  /contact-form-7\/includes\/swv\/js\/index/i,
  /contact-form-7\/includes\/js\/index/i,
];

const DEAD_STYLES = [
  /layerslider\.css/i,
  /jetpack-forms/i,
  /mediaelement/i,                        // audio/video player — 0 media elements
  /wp-mediaelement/i,
  /woocommerce[-.]/i,                     // all WooCommerce sheets
  /wc-blocks/i,
  /slick(-theme)?\.css/i,
  /magnific-popup\.css/i,
  /royal-preload\.css/i,
  /swiper(\.min)?\.css/i,
  /e-swiper/i,
  /elementor-gf-local-roboto\b/i,         // Roboto — the site sets Nunito Sans,
  /elementor-gf-local-robotoslab/i,       //   DM Sans and Outfit
];

/**
 * Inline configuration blocks belonging to removed scripts.
 *
 * These matter for more than tidiness. wc_order_attribution and sourcebuster
 * are WooCommerce's visitor-source tracking: leaving their config in place
 * would keep declaring tracking parameters on a site whose privacy policy
 * states that no such tracking happens.
 */
const DEAD_INLINE = [
  /var\s+LS_Meta\s*=/,
  /var\s+wc_add_to_cart_params\s*=/,
  /var\s+woocommerce_params\s*=/,
  /var\s+wc_order_attribution\s*=/,
  /var\s+wpcf7\s*=/,
];

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/** Removes whole <script src=...></script> / <link rel=stylesheet> tags. */
function stripTags(html, patterns, counters) {
  let out = html.replace(/<script\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>\s*<\/script>/gi, (tag, _q, src) => {
    const hit = patterns.scripts.find((re) => re.test(src));
    if (!hit) return tag;
    counters.scripts++;
    return '';
  });

  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel=["']?stylesheet/i.test(tag)) return tag;
    const href = (/href=(["'])(.*?)\1/i.exec(tag) || [])[2] || '';
    const hit = patterns.styles.find((re) => re.test(href));
    if (!hit) return tag;
    counters.styles++;
    return '';
  });

  // Inline config for scripts that are gone.
  out = out.replace(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi, (tag, body) => {
    if (!DEAD_INLINE.some((re) => re.test(body))) return tag;
    counters.inline++;
    return '';
  });

  return out;
}

function main() {
  console.log('\n🧹 Removing unused scripts and stylesheets...\n');

  const patterns = { scripts: DEAD_SCRIPTS, styles: DEAD_STYLES };
  let pages = 0;
  const total = { scripts: 0, styles: 0, inline: 0 };
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const counters = { scripts: 0, styles: 0, inline: 0 };
    const out = stripTags(html, patterns, counters);
    if (out === html) continue;

    bytesBefore += Buffer.byteLength(html);
    bytesAfter += Buffer.byteLength(out);
    fs.writeFileSync(file, out);
    pages++;
    total.scripts += counters.scripts;
    total.styles += counters.styles;
    total.inline += counters.inline;
  }

  console.log(`✅ ${pages} page(s) cleaned`);
  console.log(`   • ${total.scripts} <script> tag(s) removed`);
  console.log(`   • ${total.styles} stylesheet link(s) removed`);
  console.log(`   • ${total.inline} inline config block(s) removed`);
  console.log(`   • HTML itself: ${(bytesBefore / 1024).toFixed(0)}KB → ${(bytesAfter / 1024).toFixed(0)}KB`);

  // Verification. A pattern that still matches means a page references a file
  // this step claims to have removed — worth failing over, because the symptom
  // otherwise is a 200-with-missing-behaviour that no test would catch.
  //
  // Only real src/href values are checked, not the whole document. Testing the
  // raw HTML flagged all 54 blog posts on the first run, every one of them for
  // the same string inside a comment the theme ships:
  //     <!-- LayerSlider updates and docs at: https://layerslider.kreatura... -->
  // A check that cries wolf on a comment is worse than no check, because the
  // next real hit gets skimmed past with the rest.
  const leftovers = [];
  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const refs = [
      ...[...html.matchAll(/<script\b[^>]*\bsrc=(["'])(.*?)\1/gi)].map((m) => m[2]),
      ...[...html.matchAll(/<link\b[^>]*\bhref=(["'])(.*?)\1/gi)].map((m) => m[2]),
    ];
    for (const re of [...DEAD_SCRIPTS, ...DEAD_STYLES]) {
      const hit = refs.find((r) => re.test(r));
      if (hit) {
        leftovers.push(`${path.relative(DIST, file)} — ${hit}`);
        break;
      }
    }
  }
  if (leftovers.length) {
    console.log(`\n   ⚠ ${leftovers.length} page(s) still reference a removed asset:`);
    leftovers.slice(0, 8).forEach((l) => console.log(`       ${l}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ no page still references a removed asset');
  }
  console.log();
}

main();
