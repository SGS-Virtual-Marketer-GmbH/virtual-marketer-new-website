#!/usr/bin/env node

/**
 * Two visual defects in the scraped theme header, on the 53 pages that still
 * use it (the demo page, the legacy blog posts and the legal pages).
 *
 *  1. "Lösungen" sits 44px shorter than its neighbours. Measured in the
 *     browser: the <summary> that opens the solutions panel computes to
 *     height 55px while the sibling <a> elements are 99px, so the label rides
 *     high against a nav bar sized for the taller items. This is the same
 *     class of bug already fixed for the generated pages' header — the
 *     <summary> is a flex item that sizes to its content instead of filling
 *     the row — but that fix was scoped to .vm-header-simple and never
 *     reached this variant.
 *
 *  2. The call to action is #43BAFF, a bright cyan that appears nowhere in
 *     the brand. The real palette is vm-red #94152b / vm-blue #66a3ce, from
 *     vm-customer-web-ui/tailwind.config.js — the same gradient the generated
 *     pages already use for their Login pill, so the two headers stop looking
 *     like two different companies.
 *
 * Both are CSS-only. The header markup is left alone deliberately: it carries
 * the theme's off-canvas drawer, which — since the Content-Type fix in
 * scripts/fix-script-mime.js — actually works for the first time. Replacing
 * the header wholesale would trade one visual defect for a lost feature.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const MARKER = 'vm-legacy-header-fix';

const CSS = `<style id="${MARKER}">
  /* 1 — make the solutions <summary> look like the links beside it.
     The theme styles its nav anchors and has no rule at all for a <summary>,
     so that one item falls through to the browser default: 16px/700 in grey
     beside the theme's own type.

     Only layout is set here. Typography is copied from a real sibling anchor
     at runtime, by the script below — see the comment there for why hardcoding
     it was wrong. */
  #site-header .main-navigation > ul > li > details > summary {
    padding: 10px 11px;
    display: flex;
    align-items: center;
    cursor: pointer;
    /* Defaults for any variant not named below. Explicit rather than
       inherited: a <summary> with no rule renders 16px/700 in the browser's
       grey, which is a visible mismatch on every variant. */
    font-family: "DM Sans", sans-serif;
    font-size: 13.5px;
    font-weight: 500;
    color: #241417;
  }
  /* The two header variants do not share nav typography, and this is the
     whole reason the first fix looked right on one page and wrong on the
     other: the values were read off the demo page and applied everywhere.
     .header-overlay is the homepage; .header-static is everything else. */
  #site-header.header-overlay .main-navigation > ul > li > details > summary {
    font-size: 18px;
    color: #0a1636;
  }
  #site-header.header-static .main-navigation > ul > li > details > summary {
    font-size: 13.5px;
    color: #241417;
  }
  #site-header .main-navigation > ul > li > details > summary:hover { color: #94152b; }
  #site-header .main-navigation > ul > li > details { display: flex; align-items: center; }
  #site-header .main-navigation > ul > li { align-items: stretch; }

  /* 2 — the call to action, in the brand's own colours.
     Specificity: .octf-btn.octf-btn-primary is two classes, so prefixing with
     the #site-header id wins without !important. */
  #site-header .octf-btn.octf-btn-primary,
  #site-header a.octf-btn-primary {
    background: linear-gradient(90deg, #66a3ce, #94152b);
    border-color: transparent;
    color: #fff;
  }
  #site-header .octf-btn.octf-btn-primary:hover,
  #site-header a.octf-btn-primary:hover {
    background: linear-gradient(90deg, #94152b, #700f2b);
    color: #fff;
  }

  /* 3 — keep the top bar's tagline clear of the language switcher.
     The switcher is position:fixed in the top-right corner, so it floats over
     whatever is underneath it — and what is underneath, on these pages, is
     the last words of "…Trained exclusively for you". Reserving the width of
     the pill is enough; the text then ends before it rather than under it. */
  #site-header .header-topbar,
  #site-header > .header-desktop .elementor-top-section:first-child {
    padding-right: 104px;
  }
</style>
<script>
/**
 * Vertically aligns the solutions <summary> with the nav links beside it.
 *
 * Measured rather than hardcoded: the theme lays its anchors out below the
 * top of their own <li>, by an amount that is neither round nor stated in the
 * markup, and it differs between the two header variants.
 *
 * Typography is NOT set here, though it was for one revision. Copying the
 * sibling anchor's computed font and colour onto the summary produced an
 * element that measured perfectly — 116x55, 18px, navy — and rendered
 * nothing: a fresh headless capture showed the label simply absent. Rather
 * than keep a mechanism whose failure mode is invisible text, the typography
 * moved to the stylesheet above, per header variant, where what it does can
 * be read off the rule.
 */
(function () {
  function align() {
    var nav = document.querySelector('#site-header .main-navigation > ul');
    if (!nav) return;
    var summary = nav.querySelector('li > details > summary');
    if (!summary) return;

    var ref = null;
    for (var i = 0; i < nav.children.length; i++) {
      var a = nav.children[i].querySelector(':scope > a');
      if (a) { ref = a; break; }
    }
    if (!ref) return;

    // Only the vertical offset is set here. Copying the sibling's typography
    // at runtime was tried and reverted: it measured correctly in the DOM —
    // 18px, navy, right box — and painted nothing at all in a fresh render,
    // and the styles now live in CSS where their effect is inspectable.
    summary.style.position = 'relative';
    summary.style.top = '0px';

    // Centres, not top edges. Comparing tops was the first attempt and it
    // reported a delta of 0 while the label was visibly 31px high: the two
    // boxes do start at the same y, but they have different heights and
    // padding, so aligning their tops does not align the text inside them.
    var mid = function (el) {
      var r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    };
    var delta = Math.round(mid(ref) - mid(summary));
    if (delta) summary.style.top = delta + 'px';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', align);
  else align();
  // Fonts arriving late change the anchors' metrics, so measure again once
  // everything has settled.
  window.addEventListener('load', align);
  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(align, 150); }, { passive: true });
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
  console.log('\n🎨 Fixing the legacy theme header...\n');

  let injected = 0;
  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    if (!html.includes('id="site-header"')) continue;
    if (html.includes(MARKER)) continue;

    const at = html.lastIndexOf('</body>');
    if (at === -1) continue;
    html = html.slice(0, at) + CSS + '\n' + html.slice(at);
    fs.writeFileSync(file, html);
    injected++;
  }

  console.log(`✅ ${injected} legacy-header page(s) fixed`);
  console.log('   • solutions menu item aligned with its neighbours');
  console.log('   • call to action recoloured to vm-blue → vm-red\n');
}

main();
