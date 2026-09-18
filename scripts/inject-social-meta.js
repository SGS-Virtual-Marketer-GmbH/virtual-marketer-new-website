#!/usr/bin/env node

/**
 * Completes the Open Graph / Twitter Card contract on every page, and adds
 * a share row to blog posts.
 *
 * WHY THIS EXISTS SEPARATELY FROM seo-optimize.js
 *
 * seo-optimize.js writes a full OG/Twitter block, but only for the ~10
 * pages in its hardcoded `pageMetadata` map; everything else (all 150 blog
 * posts, both blog archive trees, the 32 feature/solution pages, the 16
 * misc pages) falls through to its second, "lightweight" pass, which only
 * guarantees canonical + hreflang and a bare-minimum og:image fallback. By
 * the time this step runs — after generate-og-images.js has given every
 * page an absolute, correctly-sized image — the social-sharing sweep
 * found the gap was still real: 79 pages with no og:url/og:locale, 238
 * with no og:image:alt, ~90 with no working twitter:card, 0 with
 * og:site_name outside the hardcoded map. Rewriting seo-optimize.js's
 * pageMetadata table to cover 238 hand-authored entries was the wrong
 * shape of fix — everything this script adds is MECHANICALLY derivable
 * from tags the page already carries (canonical, og:title, og:image), so
 * one generic pass replaces what would otherwise be 150+ near-duplicate
 * dictionary entries.
 *
 * Idempotent by construction: every tag is inserted only if the exact
 * property is absent, and existing site content (seo-optimize.js's
 * curated title/description copy) is never overwritten — this step fills
 * gaps, it does not restate opinions. The one intentional exception is
 * twitter:card: pages that had "summary" (small-image) card type before
 * this sweep only had that value because they had no large image to
 * declare — now that every page has one (or already had a real hero),
 * "summary" is upgraded to "summary_large_image" so the actual card
 * matches the actual image.
 *
 * Runs after generate-og-images.js (needs the final og:image URL) and
 * generate-favicons.js, before generate-sitemap.js — and, importantly,
 * BEFORE enable-dark-mode.js: the share-row CSS added below is plain
 * light-mode hex on purpose, so that later step's mechanical light-dark()
 * pass covers it the same way it covers every other component's CSS
 * (verified against real output: enable-dark-mode.js already turns
 * `color:#94152b` into `color:#94152b;color:light-dark(#94152b,#ea6b81)`
 * elsewhere on these exact legal/FAQ pages, so this is the same brand-red
 * dark twin dark-mode users already see, not a special case for this row).
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';
const FALLBACK_IMAGE = `${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png`;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getAttr(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

/** Insert a tag right before </head> — used only when the tag is absent. */
function insertHead(html, tag) {
  return html.replace('</head>', `  ${tag}\n</head>`);
}

function main() {
  console.log('\n🔗 Completing Open Graph / Twitter Card metadata + blog share row...\n');

  const counters = {
    ogUrl: 0,
    ogLocale: 0,
    ogLocaleAlt: 0,
    ogSiteName: 0,
    ogType: 0,
    ogTitle: 0,
    ogDescription: 0,
    ogImageFallback: 0,
    ogImageDims: 0,
    ogImageAlt: 0,
    twitterCardAdded: 0,
    twitterCardUpgraded: 0,
    twitterTitle: 0,
    twitterDescription: 0,
    twitterImage: 0,
    description404: 0,
    shareRow: 0,
  };
  let pagesTouched = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;
    if (html.indexOf('</head>') === -1) continue;

    const rel = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
    const base = path.basename(file);
    const is404 = base === '404.html';
    const isEn = rel === 'en' || rel.startsWith('en/');
    const isBlogPost = /^(en\/)?blog\/[^/]+$/.test(rel === '.' ? '' : rel);

    // ---- 404: the one page with no meta description at all yet ----------
    if (is404 && !/<meta name="description"/.test(html)) {
      const p = html.match(/<p>([^<]*)<\/p>/);
      if (p) {
        html = insertHead(html, `<meta name="description" content="${escAttr(decodeEntities(p[1]))}">`);
        counters.description404++;
      }
    }

    // ---- canonical / path -------------------------------------------------
    const canonical = getAttr(html, /<link rel="canonical" href="https:\/\/virtual-marketer\.de(\/[^"]*)">/);
    const pagePath = canonical || (rel === '.' || rel === '' ? '/' : `/${rel}/`);
    const pageUrl = `${BASE_URL}${pagePath}`;

    // ---- title / description source ---------------------------------------
    let ogTitle = getAttr(html, /<meta property="og:title" content="([^"]*)">/);
    if (!ogTitle) {
      const t = html.match(/<title>([^<]*)<\/title>/);
      const raw = t ? decodeEntities(t[1]) : null;
      ogTitle = raw ? raw.replace(/\s*[|\-–—]\s*Virtual Marketer.*$/, '').trim() || raw : 'Virtual Marketer';
      html = insertHead(html, `<meta property="og:title" content="${escAttr(ogTitle)}">`);
      counters.ogTitle++;
    } else {
      ogTitle = decodeEntities(ogTitle);
    }

    let ogDescription = getAttr(html, /<meta property="og:description" content="([^"]*)">/);
    if (!ogDescription) {
      const d = getAttr(html, /<meta name="description" content="([^"]*)">/);
      ogDescription =
        d ||
        (isEn
          ? 'Virtual Marketer – AI marketing solution, built and run in Germany.'
          : 'Virtual Marketer – KI-Marketinglösung aus Deutschland.');
      html = insertHead(html, `<meta property="og:description" content="${escAttr(decodeEntities(ogDescription))}">`);
      counters.ogDescription++;
    } else {
      ogDescription = decodeEntities(ogDescription);
    }

    // ---- og:type ------------------------------------------------------------
    if (!/<meta property="og:type"/.test(html)) {
      const type = isBlogPost ? 'article' : 'website';
      html = insertHead(html, `<meta property="og:type" content="${type}">`);
      counters.ogType++;
    }

    // ---- og:url (skipped on the 404 — it is not a real, indexable route) ---
    if (!is404 && !/<meta property="og:url"/.test(html)) {
      html = insertHead(html, `<meta property="og:url" content="${escAttr(pageUrl)}">`);
      counters.ogUrl++;
    }

    // ---- og:site_name ---------------------------------------------------
    if (!/<meta property="og:site_name"/.test(html)) {
      html = insertHead(html, `<meta property="og:site_name" content="Virtual Marketer">`);
      counters.ogSiteName++;
    }

    // ---- og:locale + og:locale:alternate ----------------------------------
    if (!/<meta property="og:locale"/.test(html)) {
      html = insertHead(html, `<meta property="og:locale" content="${isEn ? 'en_US' : 'de_DE'}">`);
      counters.ogLocale++;
    }
    if (!/<meta property="og:locale:alternate"/.test(html)) {
      // Only claim an alternate locale if this page actually declares that
      // hreflang counterpart — otherwise there is nothing to point at.
      const hasCounterpart = isEn ? /hreflang="de"/.test(html) : /hreflang="en"/.test(html);
      if (hasCounterpart) {
        html = insertHead(html, `<meta property="og:locale:alternate" content="${isEn ? 'de_DE' : 'en_US'}">`);
        counters.ogLocaleAlt++;
      }
    }

    // ---- og:image safety net (should be unreachable after
    // generate-og-images.js, kept as a defensive fallback) ------------------
    if (!/<meta property="og:image" content="[^"]*"/.test(html)) {
      html = insertHead(html, `<meta property="og:image" content="${FALLBACK_IMAGE}">`);
      counters.ogImageFallback++;
    }

    const ogImageUrl = getAttr(html, /<meta property="og:image" content="([^"]*)">/);

    // ---- og:image:width/height ----------------------------------------------
    // The 206 pages generate-og-images.js rendered are genuinely 1200x630.
    // The 32 untouched feature/solution hero JPGs are not — reading their
    // real dimensions here beats repeating the false "1200x630" claim the
    // site used to make about a 790x751 homepage image.
    if (ogImageUrl && !/<meta property="og:image:width"/.test(html)) {
      let w = 1200;
      let h = 630;
      // sharp's metadata() is promise-only; this script is otherwise fully
      // synchronous (238 small string ops, no benefit from async here), so
      // dimensions are read with a tiny synchronous PNG/JPEG header parse
      // instead of spinning up a promise per file.
      const dims = readImageDimensions(ogImageUrl.startsWith(BASE_URL) ? path.join(DIST, ogImageUrl.slice(BASE_URL.length)) : null);
      if (dims) {
        w = dims.width;
        h = dims.height;
      }
      html = html.replace(
        /(<meta property="og:image" content="[^"]*">)/,
        `$1\n  <meta property="og:image:width" content="${w}">\n  <meta property="og:image:height" content="${h}">`
      );
      counters.ogImageDims++;
    }

    // ---- og:image:alt -------------------------------------------------------
    if (ogImageUrl && !/<meta property="og:image:alt"/.test(html)) {
      const alt = /Virtual Marketer/.test(ogTitle) ? ogTitle : `${ogTitle} – Virtual Marketer`;
      html = html.replace(
        /(<meta property="og:image:height" content="[^"]*">|<meta property="og:image" content="[^"]*">)/,
        `$1\n  <meta property="og:image:alt" content="${escAttr(alt)}">`
      );
      counters.ogImageAlt++;
    }

    // ---- twitter:card ---------------------------------------------------
    const twCardMatch = html.match(/<meta (?:name|property)="twitter:card" content="([^"]*)">/);
    if (!twCardMatch) {
      html = insertHead(html, `<meta name="twitter:card" content="summary_large_image">`);
      counters.twitterCardAdded++;
    } else if (twCardMatch[1] !== 'summary_large_image') {
      html = html.replace(/(<meta (?:name|property)="twitter:card" content=")[^"]*(")/, '$1summary_large_image$2');
      counters.twitterCardUpgraded++;
    }

    if (!is404 && !/(?:name|property)="twitter:url"/.test(html)) {
      html = insertHead(html, `<meta name="twitter:url" content="${escAttr(pageUrl)}">`);
    }
    if (!/(?:name|property)="twitter:title"/.test(html)) {
      html = insertHead(html, `<meta name="twitter:title" content="${escAttr(ogTitle)}">`);
      counters.twitterTitle++;
    }
    if (!/(?:name|property)="twitter:description"/.test(html)) {
      html = insertHead(html, `<meta name="twitter:description" content="${escAttr(ogDescription)}">`);
      counters.twitterDescription++;
    }
    if (!/(?:name|property)="twitter:image"/.test(html) && ogImageUrl) {
      html = insertHead(html, `<meta name="twitter:image" content="${escAttr(ogImageUrl)}">`);
      counters.twitterImage++;
    }

    // ---- share row (blog posts only) --------------------------------------
    if (isBlogPost && !html.includes('vm-share-row')) {
      const shared = buildShareRow(pageUrl, ogTitle, isEn);
      if (shared) {
        html = insertShareRow(html, shared);
        if (html !== before) counters.shareRow++;
      }
    }

    if (html !== before) {
      fs.writeFileSync(file, html);
      pagesTouched++;
    }
  }

  console.log(`✅ ${pagesTouched} page(s) updated`);
  Object.entries(counters)
    .filter(([, n]) => n > 0)
    .forEach(([k, n]) => console.log(`   • ${k.padEnd(20)} ${n}`));
  console.log('');
}

/** Minimal synchronous PNG/JPEG dimension reader — no async round-trip per file. */
function readImageDimensions(localPath) {
  if (!localPath || !fs.existsSync(localPath)) return null;
  try {
    const fd = fs.openSync(localPath, 'r');
    const buf = Buffer.alloc(32);
    fs.readSync(fd, buf, 0, 32, 0);
    if (buf.toString('ascii', 1, 4) === 'PNG' || (buf[0] === 0x89 && buf[1] === 0x50)) {
      fs.closeSync(fd);
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      // JPEG: scan markers for the first SOFn segment.
      const full = fs.readFileSync(localPath);
      fs.closeSync(fd);
      let offset = 2;
      while (offset < full.length) {
        if (full[offset] !== 0xff) break;
        const marker = full[offset + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: full.readUInt16BE(offset + 5), width: full.readUInt16BE(offset + 7) };
        }
        const segLen = full.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
      return null;
    }
    fs.closeSync(fd);
  } catch {
    return null;
  }
  return null;
}

// ---- share row --------------------------------------------------------------

const SHARE_ICONS = {
  linkedin:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 21h4V9H3v12zm7 0h4v-6.6c0-1.7.7-2.9 2.2-2.9 1.5 0 2.1 1.1 2.1 2.9V21h4v-7.3c0-3.5-1.9-5.2-4.4-5.2-2 0-2.9 1.1-3.4 1.9h.1V9h-4c.1 1.1 0 12 0 12z"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M18.9 3H21l-6.6 7.5L22 21h-6.4l-5-6.5-5.7 6.5H2.7l7-8L2 3h6.5l4.5 6 5.9-6zm-1.1 16.2h1.2L7.3 4.7H6l11.8 14.5z"/></svg>',
  whatsapp:
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.1a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 1 1 12 20.1zm4.4-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-1-1.1-1.4-1.7-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.3.2-.4.1-.2 0-.3 0-.4-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1-.1-.1-.2-.2-.4-.3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 1 0-1.4l3-3a3.5 3.5 0 1 1 5 5l-1.6 1.6a1 1 0 1 1-1.4-1.4l1.6-1.6a1.5 1.5 0 0 0-2-2l-3 3a1 1 0 0 1-1.6-.2zm2.8-2.8a1 1 0 0 1 0 1.4l-3 3a3.5 3.5 0 1 1-5-5l1.6-1.6a1 1 0 1 1 1.4 1.4l-1.6 1.6a1.5 1.5 0 0 0 2 2l3-3a1 1 0 0 1 1.6.2z"/></svg>',
};

const SHARE_COPY = {
  de: { label: 'Teilen', linkedin: 'Auf LinkedIn teilen', x: 'Auf X teilen', whatsapp: 'Per WhatsApp teilen', copy: 'Link kopieren', copied: 'Kopiert!' },
  en: { label: 'Share', linkedin: 'Share on LinkedIn', x: 'Share on X', whatsapp: 'Share via WhatsApp', copy: 'Copy link', copied: 'Copied!' },
};

function buildShareRow(pageUrl, title, isEn) {
  const t = SHARE_COPY[isEn ? 'en' : 'de'];
  const u = encodeURIComponent(pageUrl);
  const txt = encodeURIComponent(title);
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
  const x = `https://twitter.com/intent/tweet?url=${u}&text=${txt}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(title + ' ' + pageUrl)}`;

  return `
<style id="vm-share-css">
.vm-share-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:28px 0;padding:16px 0;border-top:1px solid #e7dfe0;border-bottom:1px solid #e7dfe0}
.vm-share-row .vm-share-label{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6b5f60;margin-right:4px}
.vm-share-row a,.vm-share-row button{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;background:#faf7f7;color:#94152b;border:1px solid #e7dfe0;text-decoration:none;cursor:pointer;font:inherit;transition:background .15s,color .15s}
.vm-share-row a:hover,.vm-share-row a:focus-visible,.vm-share-row button:hover,.vm-share-row button:focus-visible{background:#94152b;color:#fff;outline:none}
.vm-share-row a:focus-visible,.vm-share-row button:focus-visible{box-shadow:0 0 0 3px #a3cce9}
.vm-share-row .vm-share-status{font-size:13px;color:#66a3ce;min-height:1em}
</style>
<div class="vm-share-row vm-share-row-marker" role="group" aria-label="${escAttr(t.label)}">
  <span class="vm-share-label">${t.label}</span>
  <a href="${linkedin}" target="_blank" rel="noopener noreferrer" aria-label="${escAttr(t.linkedin)}">${SHARE_ICONS.linkedin}</a>
  <a href="${x}" target="_blank" rel="noopener noreferrer" aria-label="${escAttr(t.x)}">${SHARE_ICONS.x}</a>
  <a href="${whatsapp}" target="_blank" rel="noopener noreferrer" aria-label="${escAttr(t.whatsapp)}">${SHARE_ICONS.whatsapp}</a>
  <button type="button" class="vm-share-copy" data-url="${escAttr(pageUrl)}" data-copy-label="${escAttr(t.copy)}" data-copied-label="${escAttr(t.copied)}" aria-label="${escAttr(t.copy)}">${SHARE_ICONS.link}</button>
  <span class="vm-share-status" aria-live="polite"></span>
</div>
<script>
(function(){
  var btn = document.currentScript.previousElementSibling.querySelector('.vm-share-copy');
  var status = document.currentScript.previousElementSibling.querySelector('.vm-share-status');
  if (!btn) return;
  btn.addEventListener('click', function(){
    var url = btn.getAttribute('data-url');
    var done = function(){ if (status) { status.textContent = btn.getAttribute('data-copied-label'); setTimeout(function(){ status.textContent = ''; }, 2500); } };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function(){ fallbackCopy(url); done(); });
    } else {
      fallbackCopy(url);
      done();
    }
  });
  function fallbackCopy(text){
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
})();
</script>`.trim();
}

/** Anchors: right after the vm-meta byline (generated posts) or the
 * .entry-meta comment (legacy WP posts). Skips silently if neither
 * template marker is found, rather than guessing an insertion point. */
function insertShareRow(html, shareHtml) {
  const vmMetaEnd = html.match(/<div class="vm-meta">[\s\S]*?<\/div>/);
  if (vmMetaEnd) {
    const idx = html.indexOf(vmMetaEnd[0]) + vmMetaEnd[0].length;
    return html.slice(0, idx) + '\n' + shareHtml + html.slice(idx);
  }
  const marker = '<!-- .entry-meta -->';
  const markerIdx = html.indexOf(marker);
  if (markerIdx !== -1) {
    const idx = markerIdx + marker.length;
    return html.slice(0, idx) + '\n' + shareHtml + html.slice(idx);
  }
  return html; // no known template marker — leave the page untouched
}

main();
