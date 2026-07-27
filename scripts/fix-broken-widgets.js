#!/usr/bin/env node

/**
 * Broken Widget / Dead Embed Cleanup
 *
 * Findings from a full-site audit (broken-embeds, security, and
 * link-integrity passes) that don't belong in fix-broken-links.js (that
 * script is scoped to dead hrefs; these are dead/insecure *widgets* and
 * WordPress-scrape debris `<link>` tags):
 *
 * 1. Homepage hero iframe pointed at https://sales-agent.virtual-marketer.de/
 *    — confirmed live as a DANGLING CNAME (CNAME -> ghs.googlehosted.com,
 *    unclaimed, returns Google's generic 404). Anyone who registers a
 *    Google Cloud/Firebase project and verifies that custom domain could
 *    serve arbitrary content inside this iframe on every visitor's
 *    homepage — a real subdomain-takeover exposure, not just a cosmetic
 *    broken box. Removed entirely (not sandboxed — there is no legitimate
 *    service behind it today).
 * 2. /virtual-marketer-demo/'s WordPress "wpcal" booking-calendar widget
 *    never resolves past its loading spinner: its AJAX config points at
 *    https://virtual-marketer.de/wp-admin/admin-ajax.php, a WordPress admin
 *    backend that doesn't exist on this static site. Replaced with a real
 *    booking widget (see scripts/inject-booking-widget.js) once the backend
 *    ships; until then, or as a fallback if that script hasn't run, this
 *    file removes the dead spinner/scripts so visitors don't wait on
 *    something that will never load.
 * 3. Blog comment forms (44 pages) post to /wp-comments-post.php, a PHP
 *    handler that doesn't exist on a static site (confirmed live 405).
 *    Neutralized in place — same minimal-attribute-only approach already
 *    used for the "Simple Likes" buttons in fix-broken-links.js — rather
 *    than restructuring the surrounding (imperfectly-nested) legacy HTML.
 * 4. WordPress search widgets (68 pages) submit to a relative
 *    "../index.html" which silently ignores the query and just re-renders
 *    the homepage — always "succeeds", never searches anything. Hidden
 *    (not removed) since some pages rely on it for layout spacing.
 * 5. WordPress scrape debris `<link>` tags (pingback/xmlrpc, RSS feed
 *    autodiscovery, wp-json oembed) on pages fix-broken-links.js doesn't
 *    reach — all point at endpoints that don't exist on the static site.
 * 6. dist/faqs/index.html has a live, visible gradient section still using
 *    the retired purple/cyan palette (#00DEFF/#7141B1) via a scraped
 *    Elementor per-post CSS file — overridden here rather than hand-edited
 *    (that CSS file is WordPress-scrape output, not something to hand-tune)
 *    with the real vm-blue/vm-red gradient.
 * 7. One stray theme-demo link (`http://localhost/engitech/contacts/`) on
 *    /faqs/ — leftover from the "Engitech" WordPress theme's own demo
 *    content, unreachable from any real browser. Repointed to the site's
 *    standard mailto contact address.
 * 8. ~190 internal `http://virtual-marketer.de/...` references (self-hosted
 *    logo image + a couple of link tags) upgraded to https — the site is
 *    HTTPS-only, plain-http internal links/assets are stray scrape debris.
 * 9. dist/index.html loads 2 font stylesheets and the header logo via an
 *    ABSOLUTE `https://virtual-marketer.de/wp-content/...` URL instead of a
 *    relative path (every other page already uses relative paths for the
 *    same files). Same-domain in real production, so it "works" there by
 *    accident — but it means these specific requests are never actually
 *    self-hosted from wherever the page is being served (fails in local
 *    dev, in a not-yet-DNS-pointed staging environment, offline, etc.), and
 *    defeats the whole point of self-hosting these assets. Rewritten to
 *    relative paths, matching every other page.
 *
 * Run after scripts/fix-broken-links.js, before scripts/generate-404.js.
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

const HERO_TRUST_PANEL = `<div class="vm-hero-trust">
  <ul>
    <li>Made in Germany &mdash; DSGVO-konform von Grund auf</li>
    <li>Custom-KI-Modelle statt Standard-Prompts von der Stange</li>
    <li>Bereits in 11 Lösungen produktiv im Einsatz</li>
  </ul>
</div>
<style>
  .vm-hero-trust{background:linear-gradient(160deg,#fff,#fbecee);border:1px solid #e7dfe0;border-radius:14px;padding:28px 26px;}
  .vm-hero-trust ul{list-style:none;margin:0;padding:0;}
  .vm-hero-trust li{position:relative;padding-left:26px;margin-bottom:14px;font-weight:600;color:#241417;font-size:15px;}
  .vm-hero-trust li:last-child{margin-bottom:0;}
  .vm-hero-trust li::before{content:"\\2713";position:absolute;left:0;top:0;color:#94152b;font-weight:700;}
</style>`;

function main() {
  console.log('\n🧹 Cleaning up broken/dead widgets and scrape debris...\n');

  const files = findHtmlFiles(DIST);
  let salesAgentRemoved = 0;
  let commentFormsDisabled = 0;
  let searchWidgetsHidden = 0;
  let pingbackStripped = 0;
  let feedLinksStripped = 0;
  let oembedStripped = 0;
  let wpJsonDiscoveryStripped = 0;
  let strayLinkFixed = 0;
  let faqsGradientFixed = 0;
  let httpUpgraded = 0;
  let absoluteAssetUrlsFixed = 0;
  let filesChanged = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    // 1. Sales-agent iframe (homepage only, one occurrence)
    html = html.replace(
      /<iframe\s+src="https:\/\/sales-agent\.virtual-marketer\.de\/"[\s\S]*?<\/iframe>/,
      () => { salesAgentRemoved++; return HERO_TRUST_PANEL; }
    );

    // 3. Blog comment forms -> neutralize the POST target, keep the markup
    html = html.replace(
      /<form action="https:\/\/virtual-marketer\.de\/wp-comments-post\.php" method="post" id="commentform" class="comment-form">/g,
      () => {
        commentFormsDisabled++;
        return '<form action="javascript:void(0)" method="post" id="commentform" class="comment-form" onsubmit="return false" aria-disabled="true">';
      }
    );

    // 4. WordPress search widgets -> hide (they don't search anything)
    html = html.replace(
      /<form role="search" method="get" class="search-form" action="\.\.\/index\.html" >/g,
      () => { searchWidgetsHidden++; return '<form role="search" method="get" class="search-form" action="javascript:void(0)" onsubmit="return false" style="display:none" aria-hidden="true">'; }
    );

    // 5. WP scrape-debris <link> tags
    html = html.replace(/<link rel="pingback" href="https:\/\/virtual-marketer\.de\/xmlrpc\.php">\s*/g, () => { pingbackStripped++; return ''; });
    html = html.replace(/<link rel="alternate" type="application\/rss\+xml" title="Virtual Marketer[^"]*" href="https:\/\/virtual-marketer\.de\/(?:feed|comments\/feed)\/" \/>\s*/g, () => { feedLinksStripped++; return ''; });
    html = html.replace(/<link rel="alternate" title="oEmbed \(XML\)" type="text\/xml\+oembed" href="https:\/\/virtual-marketer\.de\/wp-json\/oembed\/1\.0\/embed[^"]*" \/>\s*/g, () => { oembedStripped++; return ''; });
    html = html.replace(/<link rel="https:\/\/api\.w\.org\/" href="https:\/\/virtual-marketer\.de\/wp-json\/" \/>\s*/g, () => { wpJsonDiscoveryStripped++; return ''; });

    // 6. Retired purple/cyan gradient still live on /faqs/ — the legacy DE
    // page specifically (dist/faqs/index.html), not dist/en/faqs/index.html
    // (a clean self-generated page that never had this issue).
    if (file === path.join(DIST, 'faqs', 'index.html') && html.includes('</head>')) {
      const override = '<style>.elementor-1390 .elementor-element.elementor-element-52e7c11{background-image:linear-gradient(80deg,var(--vm-blue,#66a3ce) 0%,var(--vm-red,#94152b) 100%) !important;}</style>\n</head>';
      if (!html.includes('elementor-element-52e7c11{background-image:linear-gradient(80deg,var(--vm-blue')) {
        html = html.replace('</head>', override);
        faqsGradientFixed++;
      }
    }

    // 7. Stray dead theme-demo link
    html = html.replace(/href="http:\/\/localhost\/engitech\/contacts\/"/g, () => { strayLinkFixed++; return 'href="mailto:info@virtual-marketer.de"'; });

    // 8. Internal http:// -> https://
    const httpMatches = html.match(/http:\/\/virtual-marketer\.de\//g);
    if (httpMatches) {
      httpUpgraded += httpMatches.length;
      html = html.replace(/http:\/\/virtual-marketer\.de\//g, 'https://virtual-marketer.de/');
    }

    // 9. Absolute same-domain asset URLs -> relative (self-hosting only
    // actually holds if the browser fetches these from wherever THIS page
    // is served, not by hardcoding the production hostname). Also resolves
    // the real on-disk filename if the naive relative path doesn't exist:
    // these 2 links were missing their `?ver=...` suffix entirely, which
    // wget's scrape bakes into the literal on-disk filename (the same class
    // of bug fixed elsewhere in this project via resolveThemeAsset()/the
    // %3F-encoding convention — see generate-en-pages.js's comment on it).
    html = html.replace(/https:\/\/virtual-marketer\.de(\/wp-content\/[^"'\s]*)/g, (match, relPath) => {
      absoluteAssetUrlsFixed++;
      const onDisk = path.join(DIST, relPath);
      if (fs.existsSync(onDisk)) return relPath;
      const dir = path.dirname(onDisk);
      const base = path.basename(relPath);
      if (!fs.existsSync(dir)) return relPath;
      const real = fs.readdirSync(dir).find((f) => f.startsWith(`${base}?`));
      if (!real) return relPath; // no better match found — leave as-is rather than guess
      return path.dirname(relPath) + '/' + real.replace(/\?/g, '%3F');
    });

    if (html !== before) {
      fs.writeFileSync(file, html);
      filesChanged++;
    }
  }

  console.log(`  ✓ Removed dangling-CNAME sales-agent iframe: ${salesAgentRemoved} occurrence(s)`);
  console.log(`  ✓ Disabled dead blog comment-form POST target on ${commentFormsDisabled} page(s)`);
  console.log(`  ✓ Hidden non-functional search widget on ${searchWidgetsHidden} page(s)`);
  console.log(`  ✓ Stripped pingback/feed/oembed/wp-json scrape debris: ${pingbackStripped + feedLinksStripped + oembedStripped + wpJsonDiscoveryStripped} link(s)`);
  console.log(`  ✓ Fixed stray dead theme-demo link: ${strayLinkFixed} occurrence(s)`);
  console.log(`  ✓ Overrode retired purple/cyan gradient on /faqs/: ${faqsGradientFixed} page(s)`);
  console.log(`  ✓ Upgraded internal http:// -> https://: ${httpUpgraded} occurrence(s)`);
  console.log(`  ✓ Rewrote absolute same-domain asset URLs to relative: ${absoluteAssetUrlsFixed} occurrence(s)`);
  console.log(`  ✓ ${filesChanged} file(s) changed\n`);
}

main();
