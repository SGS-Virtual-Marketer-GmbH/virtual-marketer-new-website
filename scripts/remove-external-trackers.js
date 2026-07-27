#!/usr/bin/env node

/**
 * External Tracker / Cookie-Consent Removal
 *
 * The site owner has decided to remove ALL external tracking/analytics
 * scripts. Since that removes the only reason a cookie-consent mechanism
 * was needed, the Complianz cookie-consent banner goes with it. Everything
 * else the site depends on (Tailwind CSS, Font Awesome, Google Fonts, etc.)
 * is already self-hosted/baked in — see scripts/fix-external-cdn-assets.js —
 * so this leaves no external tracking/consent surface behind.
 *
 * Four things removed from the ~75 legacy WordPress-scraped pages (the
 * ~60 self-generated feature/EN/new-blog pages never had any of this):
 *
 * 1. Google Tag Manager: two inline "gtm4wp.com" comment-wrapped script
 *    blocks per page (an early dataLayer init + the classic GTM loader
 *    snippet), the GTM <noscript><iframe> right after <body>, and the
 *    WooCommerce Analytics `window._wca` init tied to the same stack.
 * 2. Jetpack Stats: `data-service="jetpack-statistics"` script tags (they
 *    use type="text/plain" + data-cmplz-src, a Complianz consent-gating
 *    pattern — inert without Complianz's own JS, but removed anyway since
 *    Complianz itself is being removed too), plus their `_stq`/`wpstats`
 *    inline init scripts and the `<style>img#wpstats{display:none}</style>`
 *    tag that exists solely to hide the Jetpack stats pixel.
 * 3. Cloudflare Turnstile: the loader script, the WooCommerce integration
 *    script, and the inline render script (44 blog pages) — all tied to
 *    the blog comment form's spam protection, and that form no longer
 *    submits anywhere (see scripts/fix-broken-widgets.js item 3).
 * 4. Complianz cookie-consent banner (wordpress.org/plugins/complianz-gdpr):
 *    its stylesheet <link id='cmplz-general-css'>, the `.cmplz-hidden`
 *    inline style tag, the `data-cmplz=1` body attribute, the full banner
 *    markup (`<!-- Consent Management powered by Complianz -->` through the
 *    `#cmplz-manage-consent` toggle button — verified div-for-div balanced
 *    across index.html/faqs/login/a blog post before writing this regex),
 *    its config `<script id="cmplz-cookiebanner-js-extra">` (the inline
 *    `var complianz = {...}` object), and its main
 *    `<script id="cmplz-cookiebanner-js">` + `-js-after` handler script.
 *
 * Not removed (out of scope / flagged instead, see task report):
 * - secure.gravatar.com blog-author-avatar image hotlinks: an external
 *   image load, not a tracker or cookie — not named in the removal
 *   instruction, left in place pending explicit confirmation.
 * - Outbound social links (linkedin/twitter/facebook/pinterest/instagram/
 *   reddit): plain <a href> navigation/share links a visitor can click,
 *   not auto-loaded resources — left untouched.
 *
 * Run after scripts/fix-broken-widgets.js, before scripts/generate-404.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

// Removes a balanced div (or any element) starting at `startIdx` (which must
// point at the FIRST character of the opening tag, e.g. `<div ...`), matching
// nested open/close tags of the given tag name until depth returns to 0.
// Returns the index just past the closing tag, or -1 if unbalanced.
function findBalancedTagEnd(html, startIdx, tagName) {
  const re = new RegExp(`<${tagName}\\b|</${tagName}>`, 'g');
  re.lastIndex = startIdx;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) return re.lastIndex;
    } else {
      depth++;
    }
  }
  return -1;
}

function main() {
  console.log('\n🍪 Removing external trackers and cookie-consent banner...\n');

  const files = findHtmlFiles(DIST);

  let gtmDatalayerInitStripped = 0;
  let wcaStripped = 0;
  let gtmLoaderStripped = 0;
  let gtmNoscriptStripped = 0;
  let jetpackStatsScriptsStripped = 0;
  let jetpackStatsInlineStripped = 0;
  let wpstatsStyleStripped = 0;
  let turnstileLoaderStripped = 0;
  let turnstileWooStripped = 0;
  let turnstileRenderStripped = 0;
  let cmplzCssLinkStripped = 0;
  let cmplzHiddenStyleStripped = 0;
  let cmplzBodyAttrStripped = 0;
  let cmplzBannerMarkupStripped = 0;
  let cmplzConfigScriptStripped = 0;
  let cmplzJsScriptsStripped = 0;
  let filesChanged = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    // --- 1. Google Tag Manager -------------------------------------------

    // 1a. First "gtm4wp.com" comment block: the dataLayer_name/dataLayer
    // init, wrapped in its own comment pair.
    html = html.replace(
      /<!-- Google Tag Manager for WordPress by gtm4wp\.com -->\s*<script data-cfasync="false" data-pagespeed-no-defer>\s*var gtm4wp_datalayer_name = "dataLayer";\s*var dataLayer = dataLayer \|\| \[\];\s*<\/script>\s*<!-- End Google Tag Manager for WordPress by gtm4wp\.com -->/,
      () => { gtmDatalayerInitStripped++; return ''; }
    );

    // 1b. WooCommerce Analytics init tied to the same stack.
    html = html.replace(
      /<script>window\._wca = window\._wca \|\| \[\];<\/script>/,
      () => { wcaStripped++; return ''; }
    );

    // 1c. Second "gtm4wp.com" comment block: dataLayer_content push + the
    // classic GTM loader IIFE.
    html = html.replace(
      /<!-- Google Tag Manager for WordPress by gtm4wp\.com -->\s*(?:<!-- GTM Container placement set to automatic -->\s*)?<script data-cfasync="false" data-pagespeed-no-defer>[\s\S]*?dataLayer_content[\s\S]*?<\/script>\s*<script data-cfasync="false" data-pagespeed-no-defer>[\s\S]*?GTM-T4MJ9WSF[\s\S]*?<\/script>\s*<!-- End Google Tag Manager for WordPress by gtm4wp\.com -->/,
      () => { gtmLoaderStripped++; return ''; }
    );

    // 1d. GTM <noscript><iframe> right after <body>.
    html = html.replace(
      /<!-- Google Tag Manager \(noscript\) -->\s*<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-T4MJ9WSF"[^>]*><\/iframe><\/noscript>\s*<!-- End Google Tag Manager \(noscript\) -->/,
      () => { gtmNoscriptStripped++; return ''; }
    );

    // Stray standalone "<!-- GTM Container placement set to automatic -->"
    // comment that sometimes sits right after <body>, outside the noscript
    // comment pair above (harmless, but scrape debris tied to the same GTM
    // integration).
    html = html.replace(/<!-- GTM Container placement set to automatic -->\s*/g, '');

    // --- 2. Jetpack Stats --------------------------------------------------

    const jetpackStatsMatches = html.match(
      /<script type="text\/plain" data-service="jetpack-statistics"[^>]*data-cmplz-src="https:\/\/stats\.wp\.com\/[^"]*"[^>]*><\/script>\s*/g
    );
    if (jetpackStatsMatches) {
      jetpackStatsScriptsStripped += jetpackStatsMatches.length;
      html = html.replace(
        /<script type="text\/plain" data-service="jetpack-statistics"[^>]*data-cmplz-src="https:\/\/stats\.wp\.com\/[^"]*"[^>]*><\/script>\s*/g,
        ''
      );
    }

    // Jetpack's inline "_stq" view/click-tracker init script that precedes
    // the jetpack-stats-js tag.
    html = html.replace(
      /<script id="jetpack-stats-js-before">[\s\S]*?_stq[\s\S]*?<\/script>\s*/,
      () => { jetpackStatsInlineStripped++; return ''; }
    );

    // The <style> tag that exists solely to hide the Jetpack stats pixel.
    html = html.replace(
      /\s*<style>img#wpstats\{display:none\}<\/style>\s*/,
      () => { wpstatsStyleStripped++; return '\n'; }
    );

    // --- 3. Cloudflare Turnstile --------------------------------------------

    html = html.replace(
      /<script data-wp-strategy="defer" id="cfturnstile-js" src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=auto"><\/script>\s*/,
      () => { turnstileLoaderStripped++; return ''; }
    );
    html = html.replace(
      /<script data-wp-strategy="defer" defer id="cfturnstile-woo-js-js" src="[^"]*simple-cloudflare-turnstile\/js\/integrations\/woocommerce\.js[^"]*"><\/script>\s*/,
      () => { turnstileWooStripped++; return ''; }
    );
    html = html.replace(
      /<script id="cfturnstile-render-js-after">[\s\S]*?<\/script>\s*/,
      () => { turnstileRenderStripped++; return ''; }
    );

    // --- 4. Complianz cookie-consent banner --------------------------------

    // 4a. Stylesheet link.
    html = html.replace(
      /<link rel='stylesheet' id='cmplz-general-css' href='[^']*cookieblocker\.min\.css[^']*' media='all' \/>\s*/,
      () => { cmplzCssLinkStripped++; return ''; }
    );

    // 4b. `.cmplz-hidden { display: none !important; }` inline style tag.
    html = html.replace(
      /\s*<style>\.cmplz-hidden \{\s*display: none !important;\s*\}<\/style>\s*/,
      () => { cmplzHiddenStyleStripped++; return '\n'; }
    );

    // 4c. `data-cmplz=1` attribute on <body>. Global: a handful of pages
    // (e.g. management/, virtual-marketer-ai-services/) are malformed
    // WordPress-scrape merges of two whole documents into one file (see
    // scripts/build.js's note on shortlink-format duplicates) and so carry
    // two <body> tags, each with its own data-cmplz=1.
    html = html.replace(
      / data-cmplz=1/g,
      () => { cmplzBodyAttrStripped++; return ''; }
    );

    // 4d. Full banner markup: from the "Consent Management powered by
    // Complianz" comment through the balanced end of the
    // #cmplz-cookiebanner-container div, then the sibling
    // #cmplz-manage-consent div that immediately follows it. Verified
    // div-for-div balanced (10746-11474 bytes depending on page) across
    // index.html, faqs/, login/, and a legacy blog post before writing
    // this — walking tag depth rather than a fixed-length regex so the
    // boundary can't silently drift on a page with slightly different
    // banner content.
    {
      const commentMarker = '<!-- Consent Management powered by Complianz | GDPR/CCPA Cookie Consent https://wordpress.org/plugins/complianz-gdpr -->';
      const startIdx = html.indexOf(commentMarker);
      if (startIdx !== -1) {
        const containerMarker = '<div id="cmplz-cookiebanner-container">';
        const containerIdx = html.indexOf(containerMarker, startIdx);
        const containerEnd = containerIdx !== -1 ? findBalancedTagEnd(html, containerIdx, 'div') : -1;
        if (containerEnd !== -1) {
          const manageMarker = '<div id="cmplz-manage-consent"';
          const manageIdx = html.indexOf(manageMarker, containerEnd);
          // Only proceed if the manage-consent div starts shortly after the
          // container closes (just whitespace in between) — otherwise this
          // page's structure doesn't match what was verified and we leave
          // it alone rather than guess.
          if (manageIdx !== -1 && /^\s*$/.test(html.slice(containerEnd, manageIdx))) {
            const manageEnd = findBalancedTagEnd(html, manageIdx, 'div');
            if (manageEnd !== -1) {
              html = html.slice(0, startIdx) + html.slice(manageEnd);
              cmplzBannerMarkupStripped++;
            }
          }
        }
      }
    }

    // 4e. Config script: `<script id="cmplz-cookiebanner-js-extra">` with
    // the inline `var complianz = {...};` object.
    html = html.replace(
      /<script id="cmplz-cookiebanner-js-extra">[\s\S]*?<\/script>\s*/,
      () => { cmplzConfigScriptStripped++; return ''; }
    );

    // 4f. Main JS + its "-js-after" handler script.
    const cmplzJsMatches = html.match(
      /<script defer id="cmplz-cookiebanner-js" src="[^"]*complianz\.min\.js[^"]*"><\/script>\s*<script id="cmplz-cookiebanner-js-after">[\s\S]*?<\/script>\s*/
    );
    if (cmplzJsMatches) {
      cmplzJsScriptsStripped++;
      html = html.replace(
        /<script defer id="cmplz-cookiebanner-js" src="[^"]*complianz\.min\.js[^"]*"><\/script>\s*<script id="cmplz-cookiebanner-js-after">[\s\S]*?<\/script>\s*/,
        ''
      );
    }

    if (html !== before) {
      fs.writeFileSync(file, html);
      filesChanged++;
    }
  }

  console.log(`  ✓ Stripped GTM dataLayer init block: ${gtmDatalayerInitStripped} page(s)`);
  console.log(`  ✓ Stripped WooCommerce Analytics (_wca) init: ${wcaStripped} page(s)`);
  console.log(`  ✓ Stripped GTM loader block: ${gtmLoaderStripped} page(s)`);
  console.log(`  ✓ Stripped GTM <noscript> iframe: ${gtmNoscriptStripped} page(s)`);
  console.log(`  ✓ Stripped Jetpack Stats script tag(s): ${jetpackStatsScriptsStripped}`);
  console.log(`  ✓ Stripped Jetpack Stats inline _stq init: ${jetpackStatsInlineStripped} page(s)`);
  console.log(`  ✓ Stripped #wpstats hiding <style>: ${wpstatsStyleStripped} page(s)`);
  console.log(`  ✓ Stripped Cloudflare Turnstile loader script: ${turnstileLoaderStripped} page(s)`);
  console.log(`  ✓ Stripped Cloudflare Turnstile WooCommerce integration script: ${turnstileWooStripped} page(s)`);
  console.log(`  ✓ Stripped Cloudflare Turnstile inline render script: ${turnstileRenderStripped} page(s)`);
  console.log(`  ✓ Stripped Complianz stylesheet <link>: ${cmplzCssLinkStripped} page(s)`);
  console.log(`  ✓ Stripped Complianz .cmplz-hidden <style>: ${cmplzHiddenStyleStripped} page(s)`);
  console.log(`  ✓ Stripped data-cmplz body attribute: ${cmplzBodyAttrStripped} page(s)`);
  console.log(`  ✓ Stripped full Complianz banner markup: ${cmplzBannerMarkupStripped} page(s)`);
  console.log(`  ✓ Stripped Complianz config script: ${cmplzConfigScriptStripped} page(s)`);
  console.log(`  ✓ Stripped Complianz main JS + handler script: ${cmplzJsScriptsStripped} page(s)`);
  console.log(`  ✓ ${filesChanged} file(s) changed\n`);
}

main();
