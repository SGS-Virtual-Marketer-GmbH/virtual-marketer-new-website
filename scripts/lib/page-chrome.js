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
  /* Login is the primary action in this bar — same gradient pill as the
     homepage header, so the two do not look like different sites. */
  .vm-header-simple nav a[href*="login.virtual-marketer.de"]{
    background:linear-gradient(90deg,#66a3ce,#94152b);
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
