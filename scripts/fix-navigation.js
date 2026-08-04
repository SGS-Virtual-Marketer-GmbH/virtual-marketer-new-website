#!/usr/bin/env node

/**
 * Site-wide "Lösungen" navigation fix
 *
 * Two different, both broken, "Lösungen" nav experiences existed side by
 * side across the site:
 *
 * - 76 legacy WordPress-scraped pages carry a stale 3-item dropdown
 *   ("Text Generation" -> api.virtual-marketer.de, "Interaktive Lösungen"
 *   -> /virtual-marketer-ai-services/, "CSS Price Comparison" ->
 *   shopping.virtual-marketer.de) that predates the current 11-page
 *   feature lineup entirely and doesn't link to a single one of them.
 * - The 26 pages this project generates itself (14 new blog posts, the
 *   blog index, and all 11 feature pages under /ki-loesungen/) use a
 *   flat "Lösungen" link with NO dropdown at all — no way to discover
 *   any of the other feature pages without first going back to the hub.
 *
 * Both are replaced here with the same self-contained <details>/<summary>
 * dropdown listing all 11 real feature pages. Deliberately NOT reusing
 * the WordPress theme's own menu JS/CSS (elementor-header.js,
 * header-mobile.js) — those aren't loaded consistently across both page
 * families, so a dependency-free native <details> element (tap-friendly
 * on mobile, keyboard-accessible, no JS required) is what actually works
 * identically everywhere.
 *
 * Run after scripts/generate-feature-pages.js (so the 11 pages it creates
 * already exist to patch) and scripts/inject-language-switcher.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const SOLUTIONS = [
  { href: '/ki-loesungen/agenten/', label: 'KI-Agenten für Marketing &amp; Ads' },
  { href: '/ki-loesungen/coding-api/', label: 'Coding-API &amp; MCP-Server' },
  { href: '/ki-loesungen/produktfotos-ki/', label: 'KI-Produktfotos &amp; Virtual Try-On' },
  { href: '/ki-loesungen/feed-veredelung/', label: 'KI Feed-Veredelung' },
  { href: '/ki-loesungen/texte-generieren/', label: 'KI-Textgenerierung' },
  { href: '/ki-loesungen/bilder-generieren/', label: 'KI-Bildgenerierung' },
  { href: '/ki-loesungen/videos-generieren/', label: 'KI-Videogenerierung' },
  { href: '/ki-loesungen/seo-content/', label: 'KI-SEO-Content' },
  { href: '/ki-loesungen/kampagnen-builder/', label: 'KI-Kampagnen-Builder' },
  { href: '/ki-loesungen/interne-verlinkung/', label: 'Interne Verlinkung' },
  { href: '/ki-loesungen/mail-generator/', label: 'KI-E-Mail-Generator' },
  { href: '/ki-loesungen/social-publisher/', label: 'KI Social Publisher' },
  { href: '/ki-loesungen/bulk-texte/', label: 'KI Bulk-Generator' },
  { href: '/ki-loesungen/ki-dateien/', label: 'Dateien &amp; Berichte' },
  { href: '/ki-loesungen/feed-optimierung/', label: 'Feed-Optimizer' },
  { href: '/ki-loesungen/chat-insights/', label: 'Chat-Insights' },
];

const SOLUTIONS_EN = [
  { href: '/en/solutions/ai-agents/', label: 'AI Agents for Marketing &amp; Ads' },
  { href: '/en/solutions/coding-api/', label: 'Coding API &amp; MCP Server' },
  { href: '/en/solutions/ai-product-photos/', label: 'AI Product Photos &amp; Virtual Try-On' },
  { href: '/en/solutions/feed-enhance/', label: 'AI Feed Enhance' },
  { href: '/en/solutions/ai-text-generator/', label: 'AI Text Generation' },
  { href: '/en/solutions/ai-image-generator/', label: 'AI Image Generation' },
  { href: '/en/solutions/ai-video-generator/', label: 'AI Video Generation' },
  { href: '/en/solutions/ai-seo-content/', label: 'AI SEO Content' },
  { href: '/en/solutions/campaign-builder/', label: 'AI Campaign Builder' },
  { href: '/en/solutions/internal-linking/', label: 'Internal Linking' },
  { href: '/en/solutions/ai-email-generator/', label: 'AI Email Generator' },
  { href: '/en/solutions/social-publisher/', label: 'AI Social Publisher' },
  { href: '/en/solutions/bulk-text-generator/', label: 'AI Bulk Generator' },
  { href: '/en/solutions/ai-files/', label: 'Files &amp; Reports' },
  { href: '/en/solutions/feed-optimizer/', label: 'Feed Optimizer' },
  { href: '/en/solutions/chat-insights/', label: 'Chat Insights' },
];

/**
 * Solutions menu, as an app-drawer style panel.
 *
 * It began as a single vertical <ul>. With sixteen solutions that produced a
 * ~780px column of links running most of the way down the viewport — visually
 * overwhelming, impossible to scan, and on shorter screens it simply ran off
 * the bottom. The list is now a three-column grid in a wide panel anchored
 * under the nav, so the whole product range is visible at once and reads as a
 * launcher rather than a scrolling menu.
 *
 * Two alignment details that were wrong before:
 *
 *  - The <summary> was `display:inline-flex` inside a nav whose siblings are
 *    plain <a> elements, so it sat on a different baseline and the label rode
 *    visibly higher than "Blog" and "API". It now matches the siblings' box
 *    exactly (same line-height, same vertical padding) and centres itself in
 *    the flex row.
 *  - The theme underlines the item because it treats the nav's descendant as
 *    a current-menu link; that decoration is explicitly cleared so the label
 *    is not the only underlined thing in the bar.
 *
 * <details> stays the mechanism — it works with no JavaScript and is
 * keyboard-accessible for free. The small script only adds what <details>
 * cannot do on its own: close when clicking elsewhere or pressing Escape.
 */
const DROPDOWN_STYLE = `<style>
  .vm-solutions-dd{position:relative;display:inline-flex;align-items:center;font-family:inherit;}
  /* Vertical alignment with the sibling nav links.
     The theme's menu anchors are 55px tall (10px padding + 35px line-height)
     while a bare <summary> is only as tall as its text, so with both boxes
     starting at the same y the label sat 11px above "Blog" and "API".
     Stretching the wrapper to the flex row's height and centring inside it
     matches whatever the theme happens to use, instead of hardcoding this
     theme's padding and breaking again the next time it changes. */
  .vm-solutions-menu-item{align-self:stretch;display:flex;align-items:center;}
  .vm-solutions-dd{align-self:stretch;}
  /* align-self:stretch above computes correctly but the theme's flex row still
     leaves the item at its content height, so the summary is matched to the
     sibling anchors' box directly: they are line-height 35px inside 10px
     vertical padding. Scoped to .vm-solutions-menu-item — the wrapper used
     only when replacing the legacy theme nav — so it cannot leak into
     .vm-header-simple, where the generated pages set their own metrics. */
  .vm-solutions-menu-item > .vm-solutions-dd > summary{padding:10px 0;line-height:35px;}
  .vm-solutions-dd > summary{
    cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;
    color:inherit;font:inherit;line-height:inherit;text-decoration:none;
  }
  .vm-solutions-dd > summary::-webkit-details-marker{display:none;}
  .vm-solutions-dd > summary::marker{content:'';}
  /* Chevron as a rotating box rather than a text glyph, so it cannot shift
     the label's baseline the way a "▾" character does. */
  .vm-solutions-dd > summary::after{
    content:'';width:7px;height:7px;flex:0 0 auto;
    border-right:2px solid currentColor;border-bottom:2px solid currentColor;
    transform:translateY(-2px) rotate(45deg);transition:transform .18s ease;
  }
  .vm-solutions-dd[open] > summary::after{transform:translateY(1px) rotate(-135deg);}
  .vm-solutions-dd > summary,
  .vm-solutions-dd > summary:hover{text-decoration:none;border-bottom:0;box-shadow:none;}

  .vm-solutions-panel{
    position:absolute;top:calc(100% + 16px);left:50%;transform:translateX(-50%);
    width:min(760px,calc(100vw - 32px));
    background:#fff;border:1px solid #ece4e5;border-radius:16px;
    box-shadow:0 24px 60px rgba(36,20,23,.18);
    padding:18px;margin:0;z-index:99999;
  }
  .vm-solutions-grid{
    display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;
    margin:0;padding:0;list-style:none;
  }
  .vm-solutions-grid a{
    display:block;padding:11px 12px;border-radius:9px;
    color:#241417;text-decoration:none;font-size:14px;font-weight:500;line-height:1.35;
  }
  .vm-solutions-grid a:hover{background:#fbecee;color:#94152b;}
  .vm-solutions-foot{
    margin:14px 0 0;padding-top:12px;border-top:1px solid #ece4e5;list-style:none;
  }
  .vm-solutions-foot a{
    display:inline-block;color:#94152b;font-weight:600;font-size:14px;text-decoration:none;padding:4px 12px;
  }
  .vm-solutions-foot a:hover{text-decoration:underline;}

  @media (max-width:900px){
    .vm-solutions-dd{display:block;width:100%;}
    .vm-solutions-panel{
      position:static;transform:none;width:auto;
      box-shadow:none;border:0;border-radius:0;padding:6px 0 0;
    }
    .vm-solutions-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
    .vm-solutions-grid a{font-size:13px;padding:9px 8px;}
  }
  @media (max-width:520px){
    .vm-solutions-grid{grid-template-columns:1fr;}
  }
</style>
<script>
(function(){
  // <details> has no concept of "dismiss" — without this the panel stays open
  // until the summary is clicked again, which feels broken next to every other
  // menu on the web.
  document.addEventListener('click', function(e){
    document.querySelectorAll('details.vm-solutions-dd[open]').forEach(function(d){
      if(!d.contains(e.target)) d.removeAttribute('open');
    });
  });
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    document.querySelectorAll('details.vm-solutions-dd[open]').forEach(function(d){
      d.removeAttribute('open');
    });
  });
})();
</script>`;

function buildDropdown(lang) {
  const list = lang === 'en' ? SOLUTIONS_EN : SOLUTIONS;
  const label = lang === 'en' ? 'Solutions' : 'Lösungen';
  const allHref = lang === 'en' ? '/en/solutions/' : '/ki-loesungen/';
  const allLabel = lang === 'en' ? 'All solutions at a glance &rarr;' : 'Alle Lösungen im Überblick &rarr;';
  const items = list.map((s) => `        <li><a href="${s.href}">${s.label}</a></li>`).join('\n');
  return `<details class="vm-solutions-dd">
    <summary>${label}</summary>
    <div class="vm-solutions-panel">
      <ul class="vm-solutions-grid">
${items}
      </ul>
      <ul class="vm-solutions-foot"><li><a href="${allHref}">${allLabel}</a></li></ul>
    </div>
  </details>${DROPDOWN_STYLE}`;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

// Matches both the desktop nav's <li id="menu-item-58027" class="...">
// and the mobile nav clone's <li class="...menu-item-58027"> (no id attr,
// same class list) — anchoring on the class substring instead of a
// specific attribute so both variants are caught. The inner <a> varies
// too: absolute vs. relative href (https://virtual-marketer.de/ki-loesungen/
// on some pages, /ki-loesungen/ on others) and an extra aria-current="page"
// on the hub page's own self-link — matched loosely on both counts.
const LEGACY_BLOCK = /<li[^>]*\bmenu-item-58027\b[^>]*><a href="[^"]*\/ki-loesungen\/"[^>]*>Lösungen<\/a>\s*<ul class="sub-menu">[\s\S]*?<\/ul>\s*<\/li>/g;
const SIMPLE_LINK = /<a href="[^"]*\/ki-loesungen\/"[^>]*>Lösungen<\/a>/;
const SIMPLE_LINK_EN = /<a href="[^"]*\/en\/solutions\/"[^>]*>Solutions<\/a>/;

function main() {
  console.log('\n🧭 Unifying solutions navigation across all pages...\n');

  const dropdown = buildDropdown('de');
  const dropdownEn = buildDropdown('en');
  const legacyReplacement = `<li class="menu-item vm-solutions-menu-item">${dropdown}</li>`;

  let legacyFixed = 0;
  let simpleFixed = 0;
  let simpleFixedEn = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    if (html.includes('menu-item-58027')) {
      html = html.replace(LEGACY_BLOCK, legacyReplacement);
      legacyFixed++;
    } else if (SIMPLE_LINK_EN.test(html)) {
      html = html.replace(SIMPLE_LINK_EN, dropdownEn);
      simpleFixedEn++;
    } else if (SIMPLE_LINK.test(html)) {
      html = html.replace(SIMPLE_LINK, dropdown);
      simpleFixed++;
    }

    if (html !== before) fs.writeFileSync(file, html);
  }

  console.log(`  ✓ Replaced stale legacy dropdown on ${legacyFixed} page(s)`);
  console.log(`  ✓ Added missing DE dropdown to ${simpleFixed} page(s)`);
  console.log(`  ✓ Added missing EN dropdown to ${simpleFixedEn} page(s)\n`);
}

main();
