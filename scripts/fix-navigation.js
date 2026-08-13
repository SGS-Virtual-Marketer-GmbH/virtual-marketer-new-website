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
  { href: '/ki-loesungen/agenten/', icon: 'robot', label: 'KI-Agenten für Marketing &amp; Ads' },
  { href: '/ki-loesungen/coding-api/', icon: 'code', label: 'Coding-API &amp; MCP-Server' },
  { href: '/ki-loesungen/produktfotos-ki/', icon: 'camera', label: 'Product Staging: KI-Produktfotos' },
  { href: '/ki-loesungen/feed-veredelung/', icon: 'feed', label: 'KI Feed-Veredelung' },
  { href: '/ki-loesungen/texte-generieren/', icon: 'text', label: 'KI-Textgenerierung' },
  { href: '/ki-loesungen/bilder-generieren/', icon: 'image', label: 'KI-Bildgenerierung' },
  { href: '/ki-loesungen/videos-generieren/', icon: 'video', label: 'KI-Videogenerierung' },
  { href: '/ki-loesungen/seo-content/', icon: 'search', label: 'KI-SEO-Content' },
  { href: '/ki-loesungen/kampagnen-builder/', icon: 'campaign', label: 'KI-Kampagnen-Builder' },
  { href: '/ki-loesungen/interne-verlinkung/', icon: 'link', label: 'Interne Verlinkung' },
  { href: '/ki-loesungen/mail-generator/', icon: 'mail', label: 'KI-E-Mail-Generator' },
  { href: '/ki-loesungen/social-publisher/', icon: 'share', label: 'KI Social Publisher' },
  { href: '/ki-loesungen/bulk-texte/', icon: 'stack', label: 'KI Bulk-Generator' },
  { href: '/ki-loesungen/ki-dateien/', icon: 'file', label: 'Dateien &amp; Berichte' },
  { href: '/ki-loesungen/feed-optimierung/', icon: 'tune', label: 'Feed-Optimizer' },
  { href: '/ki-loesungen/chat-insights/', icon: 'chat', label: 'Chat-Insights' },
];

const SOLUTIONS_EN = [
  { href: '/en/solutions/ai-agents/', icon: 'robot', label: 'AI Agents for Marketing &amp; Ads' },
  { href: '/en/solutions/coding-api/', icon: 'code', label: 'Coding API &amp; MCP Server' },
  { href: '/en/solutions/ai-product-photos/', icon: 'camera', label: 'Product Staging: AI Product Photos' },
  { href: '/en/solutions/feed-enhance/', icon: 'feed', label: 'AI Feed Enhance' },
  { href: '/en/solutions/ai-text-generator/', icon: 'text', label: 'AI Text Generation' },
  { href: '/en/solutions/ai-image-generator/', icon: 'image', label: 'AI Image Generation' },
  { href: '/en/solutions/ai-video-generator/', icon: 'video', label: 'AI Video Generation' },
  { href: '/en/solutions/ai-seo-content/', icon: 'search', label: 'AI SEO Content' },
  { href: '/en/solutions/campaign-builder/', icon: 'campaign', label: 'AI Campaign Builder' },
  { href: '/en/solutions/internal-linking/', icon: 'link', label: 'Internal Linking' },
  { href: '/en/solutions/ai-email-generator/', icon: 'mail', label: 'AI Email Generator' },
  { href: '/en/solutions/social-publisher/', icon: 'share', label: 'AI Social Publisher' },
  { href: '/en/solutions/bulk-text-generator/', icon: 'stack', label: 'AI Bulk Generator' },
  { href: '/en/solutions/ai-files/', icon: 'file', label: 'Files &amp; Reports' },
  { href: '/en/solutions/feed-optimizer/', icon: 'tune', label: 'Feed Optimizer' },
  { href: '/en/solutions/chat-insights/', icon: 'chat', label: 'Chat Insights' },
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

/**
 * Inline SVG glyphs for the solutions menu, one per product area.
 *
 * Inline rather than an icon font or sprite sheet: the menu is injected into
 * ~170 already-built pages, and a font would mean another request plus a
 * flash of missing glyphs on a site that otherwise loads nothing external.
 * Single-path shapes drawn on a 24-grid with currentColor so they inherit
 * the link's hover state for free.
 */
const ICON_PATHS = {
  robot:   '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 14h.01M16 14h.01"/>',
  code:    '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  camera:  '<path d="M3 8h3l2-3h8l2 3h3v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  feed:    '<path d="M4 5h16M4 12h16M4 19h9"/>',
  text:    '<path d="M5 6h14M5 12h14M5 18h8"/>',
  image:   '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-6 6"/>',
  video:   '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3z"/>',
  search:  '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  campaign:'<path d="M4 10v4h4l6 4V6l-6 4H4z"/><path d="M18 9a4 4 0 010 6"/>',
  link:    '<path d="M10 14a4 4 0 006 0l3-3a4 4 0 10-6-6l-1 1"/><path d="M14 10a4 4 0 00-6 0l-3 3a4 4 0 106 6l1-1"/>',
  mail:    '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 8l9 6 9-6"/>',
  share:   '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.5 11l6-4M8.5 13l6 4"/>',
  stack:   '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 13l8 4 8-4"/>',
  file:    '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>',
  tune:    '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>',
  chat:    '<path d="M20 12a7 7 0 01-7 7H8l-4 3v-5a7 7 0 017-9h2a7 7 0 017 4z"/>',
  spark:   '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z"/>',
};

function svgIcon(key) {
  const d = ICON_PATHS[key] || ICON_PATHS.spark;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}

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
    position:absolute;top:calc(100% + 14px);left:50%;transform:translateX(-50%);
    width:min(820px,calc(100vw - 32px));
    background:#fff;border:1px solid #ece4e5;border-radius:18px;
    box-shadow:0 28px 68px rgba(36,20,23,.20);
    padding:18px;margin:0;z-index:99999;
  }
  .vm-solutions-grid{
    display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;
    margin:0;padding:0;list-style:none;
  }
  .vm-solutions-grid li{margin:0;padding:0;}
  /* Two classes in the selector on purpose. The theme styles these links via
     .main-navigation ul li li a (one class, four elements) and
     .main-navigation ul > li > a, both of which outrank a bare
     .vm-solutions-grid a. Class count is compared before element count, so
     scoping to the panel wins cleanly without resorting to !important. */
  .vm-solutions-panel .vm-solutions-grid a{
    display:flex;align-items:center;gap:11px;
    padding:10px 11px;border-radius:10px;
    color:#241417;text-decoration:none;
    /* The theme uppercases and nowraps its nav links. Inherited into a
       three-column grid that produced the overlap this panel was reported
       for: labels ran straight through their neighbours instead of wrapping.
       Both are reset here rather than fought with !important elsewhere. */
    text-transform:none;white-space:normal;
    font-size:13.5px;font-weight:500;line-height:1.3;letter-spacing:0;
  }
  .vm-solutions-panel .vm-solutions-grid a:hover{background:#fbecee;color:#94152b;}
  .vm-sol-ic{
    flex:0 0 auto;display:grid;place-items:center;
    width:32px;height:32px;border-radius:9px;
    background:#f6eff0;color:#94152b;
  }
  .vm-sol-ic svg{width:17px;height:17px;display:block;}
  .vm-solutions-panel .vm-solutions-grid a:hover .vm-sol-ic{background:#94152b;color:#fff;}
  .vm-sol-tx{min-width:0;}
  .vm-solutions-foot{
    margin:14px 0 0;padding-top:12px;border-top:1px solid #ece4e5;list-style:none;
  }
  .vm-solutions-panel .vm-solutions-foot a{
    display:inline-block;color:#94152b;font-weight:600;font-size:14px;
    text-decoration:none;padding:4px 12px;text-transform:none;
  }
  .vm-solutions-foot a:hover{text-decoration:underline;}

  /* --- Mobile: a real full-screen drawer -------------------------------
     Below 900px the panel used to render inline, which pushed the whole
     header open and buried the page under a 16-item list. It is now an
     overlay pinned to the viewport with its own header and scroll area, so
     it behaves like a drawer instead of an expanding accordion. */
  @media (max-width:900px){
    .vm-solutions-dd{position:static;}
    .vm-solutions-panel{
      position:fixed;inset:0;top:0;left:0;transform:none;
      width:100vw;height:100dvh;max-height:100dvh;
      border:0;border-radius:0;box-shadow:none;
      padding:calc(env(safe-area-inset-top) + 64px) 16px calc(env(safe-area-inset-bottom) + 24px);
      overflow-y:auto;-webkit-overflow-scrolling:touch;
      animation:vmDrawerIn .18s ease-out;
    }
    .vm-solutions-panel::before{
      content:attr(data-title);
      position:fixed;top:0;left:0;right:0;height:56px;
      display:flex;align-items:center;padding:0 16px;
      background:#fff;border-bottom:1px solid #ece4e5;
      font-weight:700;font-size:16px;color:#241417;
    }
    .vm-solutions-grid{grid-template-columns:1fr;gap:4px;}
    .vm-solutions-panel .vm-solutions-grid a{padding:13px 10px;font-size:15px;}
    .vm-sol-ic{width:36px;height:36px;}
    .vm-sol-ic svg{width:19px;height:19px;}
    .vm-solutions-foot a{font-size:15px;}
    /* Stop the page behind the drawer from scrolling with it. */
    html:has(.vm-solutions-dd[open]) body{overflow:hidden;}
  }
  @keyframes vmDrawerIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  /* The legacy theme already has a full-screen off-canvas menu, and it slides
     in with a transform. A transformed ancestor becomes the containing block
     for position:fixed, so the drawer above rendered *inside* it landed one
     viewport off-screen (measured at left:375 on a 375px viewport). Inside
     that wrapper the panel therefore renders inline and lets the theme's own
     drawer be the drawer — nesting a second full-screen overlay inside the
     first is the actual mistake. The fixed drawer still applies on the
     generated pages, whose header has no off-canvas container. */
  @media (max-width:900px){
    .mmenu-wrapper .vm-solutions-panel{
      position:static;width:auto;height:auto;max-height:none;
      padding:4px 0 0;overflow:visible;animation:none;
    }
    .mmenu-wrapper .vm-solutions-panel::before{display:none;}
    .mmenu-wrapper .vm-solutions-close{display:none;}
    .mmenu-wrapper .vm-solutions-grid a{padding:11px 8px;font-size:14px;}
  }
  .vm-solutions-close{display:none;}
  @media (max-width:900px){
    .vm-solutions-close{
      display:block;position:fixed;top:8px;right:10px;z-index:1;
      width:40px;height:40px;border:0;background:none;
      font-size:30px;line-height:1;color:#241417;cursor:pointer;
    }
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
  document.addEventListener('click', function(e){
    if(!e.target.closest('.vm-solutions-close')) return;
    var d = e.target.closest('details.vm-solutions-dd');
    if(d) d.removeAttribute('open');
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
  const items = list
    .map((s) => `        <li><a href="${s.href}"><span class="vm-sol-ic">${svgIcon(s.icon)}</span><span class="vm-sol-tx">${s.label}</span></a></li>`)
    .join('\n');
  return `<details class="vm-solutions-dd">
    <summary>${label}</summary>
    <div class="vm-solutions-panel" data-title="${label}">
      <button type="button" class="vm-solutions-close" aria-label="Menü schließen">&times;</button>
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

if (require.main === module) main();

// Reused by scripts/enhance-homepage.js so the homepage's solutions showcase
// uses the exact same icon set, labels and hrefs as the mega-menu — one
// source of truth instead of a second list to keep in sync.
module.exports = { SOLUTIONS, SOLUTIONS_EN, svgIcon };
