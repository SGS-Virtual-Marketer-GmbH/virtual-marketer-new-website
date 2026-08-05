#!/usr/bin/env node

/**
 * Sticky header for the legacy/Elementor pages.
 *
 * The generated pages (feature, blog, contact) get stickiness from
 * scripts/lib/page-chrome.js. The scraped WordPress pages — the homepage
 * among them — do not: their #site-header is `position: absolute` overlaying
 * the hero, so it scrolls away with the page and never comes back.
 *
 * position: sticky is not usable here. An ancestor with a clipping overflow
 * disables it, and this theme sets `overflow: hidden` on <body> (checked in
 * the browser, not assumed — it is why the obvious one-line fix silently does
 * nothing). position: fixed is unaffected by ancestor overflow, so that is
 * what this uses.
 *
 * The header is already an overlay sitting above the hero, so fixing it in
 * place costs no layout shift and needs no padding compensation on <body>:
 * the page was always designed with content starting underneath it.
 *
 * One thing fixed positioning does change: once you scroll past the hero the
 * bar floats over ordinary page content. The theme's own inner white bar
 * keeps the links legible, and a soft shadow is faded in past the fold so the
 * header reads as a layer above the content rather than part of it.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const MARKER = 'vm-sticky-header';

const SNIPPET = `<style id="${MARKER}">
  /* Fixed, not sticky — see scripts/make-header-sticky.js for why. */
  #site-header.site-header{
    position:fixed;top:0;left:0;right:0;width:100%;
    z-index:9995;
    transition:box-shadow .2s ease,background-color .2s ease;
  }
  #site-header.site-header.vm-scrolled{
    box-shadow:0 8px 28px rgba(36,20,23,.12);
    backdrop-filter:saturate(1.1) blur(2px);
  }
  /* The admin bar / preloader can briefly offset the top on legacy pages. */
  body.admin-bar #site-header.site-header{top:32px;}
</style>
<script>
(function(){
  var h = document.getElementById('site-header');
  if(!h) return;
  // Only decorate once the page has actually moved, so the header stays flat
  // and transparent over the hero where the design intends it to be.
  var onScroll = function(){
    if(window.scrollY > 24) h.classList.add('vm-scrolled');
    else h.classList.remove('vm-scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  /**
   * Give the page back the space the header used to occupy.
   *
   * Only for .header-static. The homepage's .header-overlay was always an
   * overlay — its hero is drawn to start underneath the bar, so reserving
   * space there would push the whole design down by the header's height.
   * .header-static was not: those pages were laid out with the header in
   * normal flow, so taking it out of flow slid every one of them up
   * underneath it. On /modell-anfragen/ that put the h1 behind the nav.
   *
   * Measured rather than hardcoded — the bar is 146px on pages that carry the
   * dark top strip and 96px on those that do not, and it changes again at the
   * mobile breakpoint.
   */
  if (h.classList.contains('header-static')) {
    var pad = function(){
      document.body.style.paddingTop = h.offsetHeight + 'px';
    };
    pad();
    window.addEventListener('load', pad);
    var t;
    window.addEventListener('resize', function(){
      clearTimeout(t); t = setTimeout(pad, 150);
    }, { passive:true });
  }
})();
</script>`;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n📌 Making the legacy header sticky...\n');

  let injected = 0;
  let skipped = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');

    // Generated pages use .vm-header-simple and already stick on their own.
    if (!html.includes('id="site-header"')) { skipped++; continue; }
    if (html.includes(MARKER)) { skipped++; continue; }

    const bodyClose = html.lastIndexOf('</body>');
    if (bodyClose === -1) { skipped++; continue; }

    html = html.slice(0, bodyClose) + SNIPPET + '\n' + html.slice(bodyClose);
    fs.writeFileSync(file, html);
    injected++;
  }

  console.log(`✅ Sticky header added to ${injected} legacy page(s) (${skipped} skipped — generated pages stick via page-chrome.js)\n`);
}

main();
