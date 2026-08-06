'use strict';

/**
 * Shared header/footer ("page chrome") CSS for every generated page.
 *
 * This exists because the same bug shipped twice. Four generators emit the
 * identical <header class="vm-header-simple"> markup — generate-blog-posts,
 * generate-en-blog-posts, generate-feature-pages and generate-contact-page —
 * but only the two blog generators ever included the CSS for it. The feature
 * pages and the contact page therefore rendered the header with no layout at
 * all: no max-width, no flex, no padding, so the logo sat jammed against the
 * top-left corner and the nav collapsed into a row of unstyled inline links.
 * The dropdown looked fine on those pages, which is what made it confusing —
 * scripts/fix-navigation.js injects .vm-solutions-dd separately, so half the
 * header was styled and half was not.
 *
 * Markup and styling now live in one place, so a generator cannot emit the
 * one without the other.
 *
 * The design deliberately mirrors the Elementor homepage header rather than
 * the older bare-links version: a white rounded bar floating over the page
 * background, which is what a visitor sees on / and therefore what they
 * expect on every subpage. Sticky, because these are long pages.
 */

// vm-red #94152b / vm-red-dark #700f2b / vm-blue #66a3ce — the real product
// CI colours from vm-customer-web-ui/tailwind.config.js, not a second palette.
const CHROME_CSS = `
  .vm-header-simple{
    position:sticky;top:0;z-index:9990;
    max-width:1140px;margin:16px auto 0;padding:14px 24px;
    display:flex;align-items:center;justify-content:space-between;gap:24px;
    background:#fff;border-radius:14px;
    box-shadow:0 6px 24px rgba(36,20,23,.10);
  }
  .vm-header-simple > a{display:flex;align-items:center;flex:0 0 auto}
  .vm-header-simple nav{display:flex;align-items:center;gap:28px;flex-wrap:wrap;justify-content:flex-end}
  .vm-header-simple nav a{color:#241417;text-decoration:none;font-weight:500;font-size:15px;white-space:nowrap}
  .vm-header-simple nav a:hover{color:#94152b}

  /* The solutions dropdown is a <details>/<summary>, not an <a>, so none of
     the rules above reach it. Left alone it falls back to the browser default
     and renders 16px/400 in grey beside 14px/500 in near-black — the one nav
     item that looks like it belongs to a different site. Values copied from
     the anchor rule above so the two cannot drift apart. */
  .vm-header-simple nav > details > summary{
    color:#241417;font-weight:500;font-size:15px;white-space:nowrap;
    cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:4px;
  }
  .vm-header-simple nav > details > summary::-webkit-details-marker{display:none}
  .vm-header-simple nav > details > summary:hover{color:#94152b}

  /* position:sticky is disabled by ANY ancestor that is a scroll container,
     and the scraped theme sets overflow-x:hidden on BOTH the root element
     and the body element.

     NOTE FOR ANYONE EDITING THIS COMMENT: do not write element names in
     angle brackets here. This text ends up inside a style block in the head
     of every generated page, and scripts/fix-nested-documents.js scans the
     raw HTML for a body tag followed by a root tag to find pasted-in
     documents. Angle-bracketed names in this comment read as real tags: an
     earlier revision wrote them out and the unwrapper treated everything
     from this comment to the end of the file as a nested document, stripping
     the real body tag's class="vm-static-blog" — which silently disabled
     every rule in this stylesheet. The unwrapper now masks style and script
     regions before scanning, but prose that looks like markup is a trap
     worth not re-laying.

     WHY THE OBVIOUS FIX DID NOT WORK

     The previous attempt here was overflow-x:hidden with overflow-y:visible
     on the body — keep clipping sideways, release the axis sticky needs. It
     reads correctly and it does nothing, because of a rule in the overflow
     spec: when one axis is "hidden" and the other is "visible", the visible
     one is coerced to "auto". A computed "auto" is a scroll container. So
     the declaration that was supposed to free the header is what pinned it.

     Measured on /blog/artikel-50-ki-inhalte-kennzeichnen/: computed
     overflow was "hidden auto" on both the root and the body, and at scrollY
     1500 the header sat at top:-1484 — i.e. it had scrolled away entirely.

     "clip" is the value that does what "hidden" was being asked to do here:
     it clips without creating a scroll container, so it does NOT coerce the
     other axis, and visible survives. Same measurement after the change:
     header at top:0, page still scrolls to 1500, and
     scrollWidth === clientWidth, so nothing escapes sideways either.

     The root element needs it too. Fixing only the body leaves the root
     computing "hidden auto", and the header's nearest scrollport is then
     still a box that never scrolls. Scoped with :has() so this reaches only
     the generated pages — the theme's own layout on the legacy pages
     genuinely relies on root clipping, and make-header-sticky.js solves
     those with position:fixed instead. */
  html:has(body.vm-static-blog){overflow-x:clip;overflow-y:visible}
  body.vm-static-blog{overflow-x:clip;overflow-y:visible}
  /* Login is the primary action in this bar — same gradient pill as the
     homepage header, so the two do not look like different sites. */
  .vm-header-simple nav a[href*="login.virtual-marketer.de"]{
    background:linear-gradient(90deg,#3d7ba8,#94152b);
    color:#fff;padding:11px 26px;border-radius:10px;font-weight:600;
  }
  .vm-header-simple nav a[href*="login.virtual-marketer.de"]:hover{
    background:linear-gradient(90deg,#94152b,#700f2b);color:#fff;
  }

  /* Below ~900px the six nav items no longer fit beside the logo, so the bar
     stacks: logo on its own line, nav wrapping under it, centred. Without
     this the nav overflowed the bar and pushed the page horizontally. */
  @media (max-width:900px){
    .vm-header-simple{
      flex-direction:column;align-items:stretch;gap:14px;
      margin:12px 12px 0;padding:14px 16px;
      /* Stays sticky on mobile as well — it was switched to static here,
         which meant the nav scrolled away exactly on the screens where
         getting back to it costs the most. */
    }
    .vm-header-simple > a{justify-content:center}
    .vm-header-simple nav{justify-content:center;gap:18px}
    .vm-header-simple nav a{font-size:14px}
    .vm-header-simple nav a[href*="login.virtual-marketer.de"]{padding:9px 20px}
  }

  .vm-footer-simple{max-width:1140px;margin:40px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px}
  .vm-footer-simple a{color:#6b7280}
`;

module.exports = { CHROME_CSS };
