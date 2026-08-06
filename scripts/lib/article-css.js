'use strict';

/**
 * Typography for a blog article, shared by the German and English generators.
 *
 * It lived twice, copied between generate-blog-posts.js and
 * generate-en-blog-posts.js — the same arrangement that let the two blog
 * index pages drift until one of them still carried a hand-written header
 * from before lib/page-chrome.js existed. One copy, two callers.
 *
 * WHAT CHANGED AND WHY
 *
 * The previous version set body copy at 1.05rem in a 820px column. On a
 * desktop that renders ~17px text across roughly 95 characters per line —
 * small type on a long line, which is the combination that makes an article
 * tiring rather than merely dense. Both numbers moved:
 *
 *   font-size   1.05rem → 18px
 *   column      820px   → 720px     (~68 characters at that size)
 *
 * Note the unit. The first attempt used rem and measured 13.2px, not the
 * 18.4px intended: the scraped theme changes the root font-size, so rem here
 * resolves against roughly 11.5px rather than 16px. Every size below is in
 * px for that reason — the theme's root is not ours to rely on.
 *
 * Sizes are also set directly on p, li and td rather than inherited from the
 * container. An inherited value loses to any direct rule on the element, and
 * both the theme ("p, li { font-size: 16px }") and this repo's own
 * mobile-polish.js set one — so a font-size on .vm-post alone reached none of
 * the text it was meant to size.
 *
 * 66–75 characters is the range typographic practice has settled on, and it
 * is what the measure is now tuned to rather than to a round pixel value.
 *
 * The rest is what the old sheet simply did not style: the articles contain
 * tables, blockquotes, inline code and figures that were falling back to
 * browser defaults — visible on /blog/artikel-50-ki-inhalte-kennzeichnen/,
 * where a comparison table rendered as unruled rows of grey text.
 */

const ARTICLE_CSS = `
  .vm-post{
    /* 68ch at the body size, with a floor so the column does not collapse
       on a narrow phone before the padding does its job. */
    max-width:720px;margin:0 auto;padding:56px 22px 96px;
    color:#241417;
    font-size:18px;line-height:1.72;
    text-rendering:optimizeLegibility;
    -webkit-font-smoothing:antialiased;
  }
  .vm-post .vm-meta{color:#6b5f60;font-size:14px;margin-bottom:10px}
  .vm-post .vm-category{
    display:inline-block;background:#fbecee;color:#94152b;
    font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
    padding:5px 12px;border-radius:999px;margin-bottom:18px;
  }

  .vm-post h1{font-size:40px;line-height:1.15;letter-spacing:-.015em;margin:0 0 14px;font-weight:700}
  .vm-post h2{font-size:26px;line-height:1.25;margin:2.4em 0 .6em;font-weight:700;letter-spacing:-.01em}
  .vm-post h3{font-size:20px;line-height:1.3;margin:1.9em 0 .5em;font-weight:700}
  .vm-post h4{font-size:17px;margin:1.6em 0 .4em;font-weight:700}

  .vm-post p{margin:0 0 1.15em;font-size:18px;line-height:1.72}
  .vm-post ul,.vm-post ol{margin:0 0 1.3em;padding-left:1.35em}
  .vm-post li{margin-bottom:.5em;font-size:18px;line-height:1.72}
  .vm-post li::marker{color:#94152b}

  .vm-post a{color:#94152b;text-underline-offset:2px;text-decoration-thickness:1px}
  .vm-post a:hover{color:#700f2b}
  .vm-post strong{font-weight:700;color:#1a0f11}

  /* Tables. The articles use them for side-by-side comparisons and they had
     no styling at all — no rules, no header weight, no padding. */
  .vm-post table{
    width:100%;border-collapse:collapse;margin:1.6em 0;
    font-size:16px;line-height:1.55;
  }
  .vm-post thead th{
    text-align:left;font-weight:700;color:#241417;
    background:#f7f4f4;border-bottom:2px solid #e7dfe0;
    padding:11px 14px;
  }
  .vm-post td,.vm-post th{padding:12px 14px;border-bottom:1px solid #ece7e7;vertical-align:top;font-size:16px;line-height:1.55}
  .vm-post tbody tr:last-child td{border-bottom:none}

  .vm-post blockquote{
    margin:1.6em 0;padding:2px 0 2px 20px;
    border-left:3px solid #94152b;color:#4a4143;font-style:normal;
  }
  .vm-post blockquote p:last-child{margin-bottom:0}

  .vm-post code{
    background:#f4f1f1;border-radius:5px;padding:.14em .4em;
    font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  }
  .vm-post pre{
    background:#241417;color:#f4f1f1;border-radius:12px;
    padding:18px 20px;overflow-x:auto;margin:1.6em 0;font-size:15px;line-height:1.55;
  }
  .vm-post pre code{background:none;padding:0;color:inherit}

  .vm-post img{max-width:100%;height:auto;border-radius:12px;margin:1.6em 0}
  .vm-post figure{margin:1.6em 0}
  .vm-post figcaption{font-size:14px;color:#6b5f60;margin-top:.5em}
  .vm-post hr{border:none;border-top:1px solid #e7dfe0;margin:2.4em 0}

  .vm-post .vm-cta{
    margin-top:3.5em;padding:30px;background:#f8f9fc;
    border:1px solid #e7dfe0;border-radius:14px;text-align:center;
  }
  .vm-post .vm-cta a{
    display:inline-block;margin-top:12px;padding:13px 26px;
    /* Deepened vm-blue, not vm-blue: white on #66a3ce is 2.7:1 and fails
       WCAG 1.4.3. Same hue, 4.6:1. See scripts/fix-legacy-header.js. */
    background:linear-gradient(90deg,#3d7ba8,#94152b);
    color:#fff;border-radius:8px;text-decoration:none;font-weight:700;
  }
  .vm-post .vm-cta a:hover{background:linear-gradient(90deg,#94152b,#700f2b);color:#fff}

  .vm-post .vm-related{margin-top:3em;padding-top:1.6em;border-top:1px solid #e7dfe0}
  .vm-post .vm-related h3{margin-top:0}
  .vm-post .vm-related ul{list-style:none;padding:0}
  .vm-post .vm-related li{margin-bottom:.6em}

  /* On a phone the column padding does the work the max-width does on
     desktop, and the display sizes come down a step. Body copy stays at
     1.15rem — shrinking it is what made these articles hard to read. */
  @media (max-width:640px){
    .vm-post{padding:32px 18px 64px;font-size:17px;line-height:1.68}
    .vm-post p,.vm-post li{font-size:17px;line-height:1.68}
    .vm-post h1{font-size:30px}
    .vm-post h2{font-size:22px;margin-top:2em}
    .vm-post h3{font-size:18px}
    .vm-post table{font-size:15px}
    .vm-post td,.vm-post th{padding:10px 10px;font-size:15px}
  }
`;

module.exports = { ARTICLE_CSS };
