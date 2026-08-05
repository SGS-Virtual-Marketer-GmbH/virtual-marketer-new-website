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
     The first attempt here assumed a height problem and set height:100%.
     Measured afterwards, the boxes were already the same 55px — what differs
     is the type. The theme styles its nav anchors but has no rule for a
     <summary>, so that one item falls back to the browser default and renders
     16px/700 in grey next to 13.5px/500 in near-black:

         a        13.5px  weight 500  #241417  padding 10px 11px
         summary  16px    weight 700  #6d6d6d  padding 10px 0

     Matching all four is the fix. Sizes are copied from the anchors rather
     than invented, so a future theme change moves both together. */
  #site-header .main-navigation > ul > li > details > summary {
    font-size: 13.5px;
    font-weight: 500;
    line-height: 17.55px;
    color: #241417;
    padding: 10px 11px;
    display: flex;
    align-items: center;
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
 * Vertically aligns the solutions <summary> with the sibling nav links.
 *
 * Measured rather than hardcoded, because the offset is neither a round
 * number nor stated anywhere in the markup. The theme lays its nav anchors
 * out 61px below the top of their own <li> — the anchor's box actually
 * extends past the bottom of its parent — while the <summary>, for which the
 * theme has no rule at all, sits flush at the top. Writing "top: 61px" here
 * would fix today's build and drift silently the first time the theme's
 * padding changes.
 *
 * So: read one real anchor's offset and apply the same to the summary. With
 * no anchor to compare against, this does nothing.
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
