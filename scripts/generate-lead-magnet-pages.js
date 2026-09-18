#!/usr/bin/env node

/**
 * Whitepaper lead magnet: landing pages (DE + EN) + the real PDF + a cover
 * hero image.
 *
 * WHY THIS RUNS EARLY IN THE PIPELINE (right after generate-contact-page.js,
 * NOT late alongside inject-newsletter-signup.js)
 *
 * generate-sitemap.js, internal-links.js, enrich-structured-data.js (breadcrumbs),
 * generate-og-images.js and fix-meta-descriptions.js all walk dist/ once, early,
 * and never revisit pages created after they ran. A landing page built late
 * would be real and reachable but invisible to every one of those passes —
 * no sitemap entry, no auto-generated OG card, no breadcrumb pass. So this
 * script is positioned like generate-contact-page.js / generate-feature-pages.js:
 * a page-generating step, early, before the SEO/sitemap/OG sweep. It still
 * runs BEFORE inject-newsletter-signup.js (which links to these URLs and
 * would otherwise 404-guard against a page that doesn't exist yet).
 *
 * ONE OG CARD MECHANISM, NOT TWO
 *
 * generate-og-images.js (further down the pipeline) unconditionally replaces
 * any existing og:image on every page it walks with its own auto-rendered
 * 1200x630 title card (brand colors, Outfit, the real page title) — see its
 * own header comment ("insert-or-replace", no skip condition). Rather than
 * fight that with a second, one-off OG template, this script leans on it:
 * the landing pages just need *a* valid og:image present as a safe fallback
 * (in case this step ever runs standalone, without the later OG pass), and
 * the sitewide mechanism supplies the real, consistent card. What this
 * script DOES build itself is the portrait HERO image on the landing page —
 * that's not something the sitewide OG step produces at all.
 *
 * THE GATING DECISION (content-hashed filenames + a committed manifest)
 *
 * This script and backend/src/routes/whitepaper.js are both owned by this
 * agent in this sweep, so the gate is real end to end: each PDF is written
 * as `<slug>.<locale>.<hash>.pdf`, where <hash> is a content hash (see
 * "HASH STABILITY" below — deliberately NOT a hash of the compiled PDF
 * bytes). Nobody can guess that filename from the slug alone, so the only
 * way to reach a PDF is through the confirm-link flow that already proved
 * the requester's email.
 *
 * The filename -> current-file mapping is written to a manifest,
 * backend/src/generated/whitepaper-manifest.json, committed into the repo
 * under backend/src/ rather than under dist/. That placement is required,
 * not incidental: deploy-service.yaml runs `web` (this static site) and
 * `api` (backend/) as two separate sidecar containers in the same Cloud Run
 * service, and backend/Dockerfile only ever COPYs backend/src and
 * package.json into the api image — it never sees dist/ at all, no shared
 * volume exists between the two containers, and the two are built and
 * deployed independently. A manifest written only into dist/ would be
 * unreachable from the running API process. Writing it under backend/src/
 * instead lets whitepaper.js `require()` it directly, exactly like any
 * other source file, with no runtime dependency on the sibling container.
 * The alternative of an env var/build-arg baked into the api image was
 * rejected: that would mean re-tagging and redeploying the api image on
 * every whitepaper content change even though nothing about its own code
 * changed, whereas committing the manifest as a plain source file means a
 * whitepaper content update is an ordinary commit touching both a
 * generated dist/ artifact and a generated backend/ artifact together,
 * reviewable as a diff like anything else.
 *
 * robots.txt (scripts/generate-sitemap.js) and nginx (docker/nginx.conf.
 * template) both keep /downloads/ out of search independently — see their
 * own comments — so even a leaked or shared link doesn't get indexed and
 * cannibalise the landing page's own ranking.
 *
 * TWO PDFs, NOT ONE — WHY
 *
 * backend/src/routes/whitepaper.js now keys the manifest by slug AND
 * locale and resolves record.locale at confirm time, so a DE requester and
 * an EN requester get two different, single-language files. This script
 * renders each locale's chapters/cover/ToC from that locale's own content
 * file only — no bilingual divider page, no cross-language bleed.
 *
 * HASH STABILITY (why the hash is of the HTML+CSS *inputs*, not the PDF)
 *
 * Chrome's CDP `Page.printToPDF` (what puppeteer-core's page.pdf() calls)
 * embeds a `/CreationDate` (and a `/ModDate`, and — via poppler's pdfunite,
 * which merges the two per-locale render passes below — a fresh `/ID`)
 * into every PDF it writes, all derived from wall-clock time at render
 * time. Hashing the finished PDF bytes would therefore produce a new
 * filename on every single rebuild even when not one word of the
 * whitepaper changed — silently breaking every download link already
 * emailed to a confirmed subscriber, exactly the failure mode this gate
 * exists to prevent elsewhere. Hashing the deterministic *source* instead
 * (this locale's content HTML + the shared print.css) sidesteps that
 * entirely: identical content always hashes identically, regardless of
 * what Chrome stamps into the binary. Proven empirically by running the
 * render twice in a row and diffing the resulting filenames/hashes — see
 * scratchpad/sweep/B8-whitepaper-gate-done.md.
 *
 * Because the filename itself now carries the hash, "did the content
 * change" and "does the current output already exist" are the same
 * question — needsRender()'s separate `.hash` sidecar file (still used
 * below for the cover images, which are unaffected by this defect) is not
 * needed for the PDFs any more: renderPdfForLocale() just checks whether
 * `<slug>.<locale>.<hash>.pdf` already exists in dist/downloads/, and
 * deletes any other `<slug>.<locale>.*.pdf` it finds afterwards so stale,
 * superseded PDFs never accumulate there across rebuilds.
 *
 * WHY PUPPETEER-CORE, NOT THE PLAIN CLI
 *
 * See content/whitepaper/print.css's own header comment: real running
 * headers/footers/page numbers need `page.pdf({displayHeaderFooter,
 * headerTemplate, footerTemplate})`, a DevTools Protocol feature the plain
 * `google-chrome --headless=new --print-to-pdf` flag does not expose at
 * all. puppeteer-core (already present in node_modules; not a new
 * dependency) drives the *same* installed Chrome binary
 * (/usr/bin/google-chrome) over CDP to get that. If puppeteer-core is ever
 * unavailable, this script falls back to the plain CLI for a single-pass,
 * header/footer-less PDF rather than failing the whole build — documented
 * degradation, not a silent one.
 *
 * TWO-PASS RENDER, MERGED WITH pdfunite
 *
 * The cover + table of contents should not carry a running header/footer
 * (there is nothing yet to run "along" — no chapter title, no meaningful
 * page number). Puppeteer's header/footer templates apply uniformly to
 * every page of a single page.pdf() call with no per-page override. So this
 * renders TWO separate PDFs — (a) cover+ToC, no header/footer; (b) the
 * full chapter content, WITH header/footer — and glues them together with
 * `pdfunite` (poppler-utils, confirmed present alongside pdftoppm/pdftocairo,
 * already used elsewhere in this project's tooling for PDF work). The plain-
 * CLI fallback does not attempt this split — one pass, no header/footer, on
 * the whole combined document.
 *
 * IDEMPOTENCE FOR THE BINARY OUTPUTS
 *
 * HTML landing pages are deterministic string templates — rewriting them is
 * naturally idempotent. The PDF and PNG renders are comparatively expensive
 * and Chrome does not promise byte-identical output run to run (embedded
 * timestamps, etc.), so each binary output is guarded by a content hash of
 * its OWN inputs (this script's relevant source strings) stored in a
 * sidecar `.hash` file next to it in dist/ — unchanged inputs skip the
 * render entirely, which is what makes "second run = 0 changes" true for
 * this script in practice, not just in the deterministic-HTML sense.
 *
 * Run after generate-contact-page.js and before inject-language-switcher.js
 * (so that pass's DE_TO_EN map — and everything downstream of it — sees
 * these two pages like any other page pair), and well before
 * inject-newsletter-signup.js (which links to these exact URLs).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { CHROME_CSS } = require('./lib/page-chrome');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = 'https://virtual-marketer.de';
const LOGO = '/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png';
const CHROME_BIN = '/usr/bin/google-chrome';

const CONTENT_DIR = path.join(ROOT, 'content/whitepaper');
const FORM_ASSET_SRC = path.join(ROOT, 'assets/lead-magnet');
const DIST_ASSETS = path.join(DIST, 'assets/lead-magnet');
const IMAGES_DIR = path.join(DIST_ASSETS, 'images');
const DOWNLOADS_DIR = path.join(DIST, 'downloads');

const SLUG = 'agentic-marketing-2026';
// Committed into backend/src/ (not dist/) on purpose — see the header
// comment above ("THE GATING DECISION") for why the API container can only
// ever reach a manifest that lives inside its own image.
const MANIFEST_PATH = path.join(ROOT, 'backend/src/generated/whitepaper-manifest.json');
const LANDING_PATH = { de: `/whitepaper/${SLUG}/`, en: `/en/whitepaper/${SLUG}/` };
const HREFLANG = { de: LANDING_PATH.de, en: LANDING_PATH.en };

// ---- small shared helpers -------------------------------------------------

function resolveThemeAsset(cleanRelPath) {
  const dir = path.dirname(path.join(DIST, cleanRelPath));
  const base = path.basename(cleanRelPath);
  if (!fs.existsSync(dir)) return cleanRelPath;
  const match = fs.readdirSync(dir).find((f) => f === base || f.startsWith(`${base}?`));
  const resolved = match ? path.join(path.dirname(cleanRelPath), match) : cleanRelPath;
  return resolved.replace(/\?/g, '%3F');
}

const THEME_CSS = {
  bootstrap: resolveThemeAsset('wp-content/themes/engitech/css/bootstrap.css'),
  fontAwesome: resolveThemeAsset('wp-content/themes/engitech/css/font-awesome.min.css'),
  style: resolveThemeAsset('wp-content/themes/engitech/style.css'),
};

function write(urlPath, html) {
  const outDir = path.join(DIST, ...urlPath.split('/').filter(Boolean));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

function hashOf(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/** Skip an expensive binary render when its sidecar hash file already
 * matches — the idempotence mechanism described in the header comment. */
function needsRender(outputFile, hashFile, currentHash) {
  if (!fs.existsSync(outputFile) || !fs.existsSync(hashFile)) return true;
  return fs.readFileSync(hashFile, 'utf-8').trim() !== currentHash;
}

function extractBetween(html, startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  const e = html.indexOf(endMarker);
  if (s === -1 || e === -1) throw new Error(`markers not found: ${startMarker} / ${endMarker}`);
  return html.slice(s + startMarker.length, e).trim();
}

// ---- landing page content --------------------------------------------------

const COPY = {
  de: {
    lang: 'de',
    eyebrow: 'Kostenloses Whitepaper',
    title: 'Agentic Marketing 2026',
    titleTag: 'Agentic Marketing 2026 — Whitepaper',
    metaDescription: 'Kostenloses Whitepaper: Ein praktischer Leitfaden zu KI-Agenten im Marketing-Alltag — was sie heute wirklich tun, wo die Freigabe liegt, und wie ein realistischer Einstieg aussieht. Ohne erfundene Zahlen.',
    heroSub: 'Ein praktischer Leitfaden zu KI-Agenten im Marketing-Alltag &mdash; was sie heute wirklich tun, wo die Freigabe liegt, und wie ein realistischer Einstieg aussieht.',
    whatsInside: 'Was Sie erwartet',
    chapters: [
      'Warum Agenten jetzt zählen',
      'Was ein Agent wirklich ist (und was nicht)',
      'Vier Agenten, die Marketing-Teams heute nutzen',
      'Konnektoren und das Freigabe-Netz',
      'Ein realistischer Einstieg: die ersten 90 Tage',
      'Wann Agenten nicht die richtige Wahl sind',
      'Daten, Kontrolle und Compliance',
      'Nächste Schritte',
    ],
    credibilityH: 'Warum dieser Leitfaden anders ist',
    credibilityP1: 'Dieses Whitepaper beschreibt ausschließlich Funktionen, die in Virtual Marketer heute real existieren und genutzt werden &mdash; keine Roadmap, keine Ankündigung. Jedes Beispiel, jeder Mechanismus (etwa das &bdquo;Read-back&ldquo; vor jedem Versand) ist wörtlich aus der tatsächlichen Produktoberfläche entnommen.',
    credibilityP2: 'Es enthält bewusst keine erfundenen Kennzahlen, Studien oder Fallzahlen. Wo eine Aussage nicht belegbar wäre, wurde sie qualitativ formuliert oder weggelassen &mdash; auch wenn das weniger beeindruckend klingt als eine erfundene Prozentzahl.',
    formHeading: 'Whitepaper jetzt herunterladen',
    formSub: 'Kostenlos, als PDF. Wir senden Ihnen einen Bestätigungslink per E-Mail.',
    breadcrumbHome: 'Startseite',
    breadcrumbBlog: 'Whitepaper',
  },
  en: {
    lang: 'en',
    eyebrow: 'Free whitepaper',
    title: 'Agentic Marketing 2026',
    titleTag: 'Agentic Marketing 2026 — Whitepaper',
    metaDescription: 'Free whitepaper: a practical guide to AI agents in everyday marketing work — what they actually do today, where approval sits, and what a realistic rollout looks like. No invented numbers.',
    heroSub: 'A practical guide to AI agents in everyday marketing work &mdash; what they actually do today, where approval sits, and what a realistic rollout looks like.',
    whatsInside: "What's inside",
    chapters: [
      'Why agents matter now',
      "What an agent actually is (and isn't)",
      'Four agents marketing teams use today',
      'Connectors and the approval net',
      'A realistic start: the first 90 days',
      'When agents are not the right choice',
      'Data, control and compliance',
      'Next steps',
    ],
    credibilityH: 'Why this guide is different',
    credibilityP1: 'This whitepaper describes only capabilities that exist and are in real use in Virtual Marketer today &mdash; no roadmap, no announcement. Every example and mechanism (such as the &ldquo;read-back&rdquo; step before anything is sent) is taken verbatim from the actual product interface.',
    credibilityP2: "It deliberately contains no invented statistics, studies or case numbers. Where a claim couldn't be substantiated, it was phrased qualitatively instead, or left out entirely — even where a made-up percentage would have sounded more impressive.",
    formHeading: 'Download the whitepaper',
    formSub: 'Free, as a PDF. We’ll email you a confirmation link.',
    breadcrumbHome: 'Home',
    breadcrumbBlog: 'Whitepaper',
  },
};

// The --vm-* custom properties used to be declared in a plain :root{} block.
// See scripts/generate-contact-page.js's identical comment for the full
// mechanism: scripts/reserve-layout-space.js (off-limits — another agent is
// actively working in it) gives every var(--name) usage in the same
// stylesheet a literal fallback whenever :root defines that name literally,
// and scripts/enable-dark-mode.js's hex-wrapping regex then wraps that
// fallback's hex in a light-dark() call that never fires (the var IS
// defined, so the browser never falls back to it) — silently killing the
// dark-mode twin for every var()-based colour on this page. That is why the
// whitepaper landing page measured 11 color-contrast failures at once,
// including a background/foreground pair that both resolved to the SAME
// stuck light-mode value in dark mode (.vm-wp-landing's inherited text
// colour, #241417, against the dark-mode page background #171717 — 1.01:1,
// functionally invisible text). Scoping the custom properties to the
// page's own wrapper class instead of :root (the same pattern already used
// by assets/lead-magnet/*.css and assets/contact-form/contact-form.css)
// keeps them out of reserve-layout-space.js's :root scan entirely — they
// still inherit to every descendant — so enable-dark-mode.js's normal
// var-resolution path derives a correct, live light-dark() pair instead.
const BASE_CSS = `
  .vm-wp-landing *{box-sizing:border-box;}
  .vm-wp-landing{
    --vm-red:#94152b; --vm-red-dark:#700f2b; --vm-blue:#66a3ce; --vm-blue-light:#a3cce9;
    --vm-gray-100:#f4f1f1; --vm-gray-200:#e7dfe0; --vm-gray-500:#6b5f60; --vm-gray-900:#241417;
    max-width:1140px;margin:0 auto;padding:48px 20px 96px;color:var(--vm-gray-900);line-height:1.65;font-size:16px;
  }
  .vm-wp-hero{display:flex;gap:48px;align-items:flex-start;flex-wrap:wrap;margin-bottom:56px;}
  .vm-wp-hero-text{flex:1 1 420px;min-width:0;}
  .vm-wp-hero-image{flex:0 0 auto;width:280px;max-width:100%;}
  .vm-wp-hero-image img{width:100%;height:auto;border-radius:16px;box-shadow:0 20px 50px -20px rgba(36,20,23,.35);display:block;}
  .vm-wp-landing h1{font-size:38px;line-height:1.15;margin:0 0 14px;letter-spacing:-.01em;}
  .vm-wp-landing p{margin:0 0 14px;color:#4a4143;}
  .vm-wp-landing a{color:var(--vm-red);}
  .vm-wp-landing .eyebrow{display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vm-red);background:#fbecee;padding:5px 12px;border-radius:999px;margin-bottom:16px;}
  .vm-wp-landing .lede{font-size:18px;color:#4a4143;max-width:56ch;}
  .vm-wp-landing .cta-inline{display:inline-block;margin-top:8px;font-weight:700;padding:13px 26px;border-radius:8px;background:var(--vm-red);color:#fff;text-decoration:none;}
  .vm-wp-landing .cta-inline:hover{background:var(--vm-red-dark);}
  .vm-wp-body{display:flex;gap:48px;flex-wrap:wrap;align-items:flex-start;}
  .vm-wp-toc{flex:1 1 380px;min-width:0;}
  .vm-wp-toc h2{font-size:22px;margin:0 0 16px;}
  .vm-wp-toc ol{list-style:none;padding:0;margin:0;counter-reset:wptoc;}
  .vm-wp-toc li{counter-increment:wptoc;display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--vm-gray-200);font-size:15.5px;}
  .vm-wp-toc li::before{content:counter(wptoc,decimal-leading-zero);color:var(--vm-blue);font-weight:700;font-size:13px;flex:0 0 auto;padding-top:2px;}
  .vm-wp-form-col{flex:0 0 360px;max-width:100%;position:sticky;top:24px;}
  .vm-wp-credibility{max-width:760px;margin:56px 0 8px;padding:26px 28px;border:1px solid var(--vm-gray-200);border-radius:14px;background:var(--vm-gray-100); background:light-dark(var(--vm-gray-100),#1b1515);}
  .vm-wp-credibility h2{font-size:19px;margin:0 0 10px;}
  .vm-wp-credibility p{font-size:14.5px;margin-bottom:10px;}
  @media (max-width:760px){
    .vm-wp-form-col{position:static;flex:1 1 100%;}
  }
`;

function header() {
  return `<header class="vm-header-simple">
  <a href="/"><img src="${LOGO}" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/ki-loesungen/">Lösungen</a>
    <a href="/blog/">Blog</a>
    <a href="https://api.virtual-marketer.de/documentation/">API</a>
    <a href="/modell-anfragen/">Modell anfragen</a>
    <a href="/kontakt/">Kontakt</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>`;
}

function headerEn() {
  return `<header class="vm-header-simple">
  <a href="/en/"><img src="${LOGO}" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/en/ai-solutions/">Solutions</a>
    <a href="/en/blog/">Blog</a>
    <a href="https://api.virtual-marketer.de/documentation/">API</a>
    <a href="/en/request-model/">Request a model</a>
    <a href="/en/contact/">Contact</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>`;
}

function footer(locale) {
  const privacy = locale === 'en' ? '/en/privacy-policy/' : '/datenschutzerklaerung/';
  const impressum = locale === 'en' ? '/en/imprint/' : '/impressum/';
  const privacyLabel = locale === 'en' ? 'Privacy Policy' : 'Datenschutzerklärung';
  const impressumLabel = locale === 'en' ? 'Imprint' : 'Impressum';
  // Same defect and same fix as scripts/generate-contact-page.js's footer():
  // these two <a> are bare children of <footer>, outside both the sitewide
  // p/li underline rule (scripts/fix-a11y.js) and this page's own
  // `.vm-wp-landing a` colour rule (scoped to <main>), so they render in the
  // WordPress theme's own base link colour with no non-colour cue at all —
  // an inline style wins over every external/theme rule and fixes both at
  // once, also missing its light-dark() twin here (color:#6b7280 alone).
  const linkStyle = 'color:#6b7280;color:light-dark(#6b7280,#c5c8ce);text-decoration:underline;text-underline-offset:2px;';
  return `<footer style="max-width:1140px;margin:64px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;color:light-dark(#6b7280,#c5c8ce);font-size:14px;">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="${privacy}" style="${linkStyle}">${privacyLabel}</a> &middot;
  <a href="${impressum}" style="${linkStyle}">${impressumLabel}</a>
</footer>`;
}

function pageShell({ locale, bodyHtml }) {
  const c = COPY[locale];
  const urlPath = LANDING_PATH[locale];
  const url = `${BASE_URL}${urlPath}`;
  const otherLocale = locale === 'de' ? 'en' : 'de';
  const ogLocale = locale === 'de' ? 'de_DE' : 'en_US';
  const coverImage = `${BASE_URL}/assets/lead-magnet/images/whitepaper-cover-${locale}.png`;
  const homeUrl = locale === 'de' ? BASE_URL : `${BASE_URL}/en`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: c.breadcrumbHome, item: `${homeUrl}/` },
        { '@type': 'ListItem', position: 2, name: c.breadcrumbBlog, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: c.title,
      description: c.metaDescription,
      image: coverImage,
      url,
      inLanguage: locale,
      isAccessibleForFree: true,
      publisher: { '@type': 'Organization', name: 'SGS Virtual Marketer GmbH', url: BASE_URL },
      author: { '@type': 'Organization', name: 'SGS Virtual Marketer GmbH', url: BASE_URL },
      dateModified: '2026-09-15',
    },
  ];

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${c.titleTag} | Virtual Marketer</title>
<meta name="description" content="${c.metaDescription}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${BASE_URL}${HREFLANG.de}">
<link rel="alternate" hreflang="en" href="${BASE_URL}${HREFLANG.en}">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}${HREFLANG.de}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${ogLocale}">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="${c.titleTag}">
<meta property="og:description" content="${c.metaDescription}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${coverImage}">
<meta name="twitter:card" content="summary_large_image">
${jsonLd.map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`).join('\n')}
<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.fontAwesome}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<link rel="stylesheet" href="/assets/lead-magnet/whitepaper-form.css">
<style>${BASE_CSS}${CHROME_CSS}</style>
</head>
<body class="vm-static-blog">
${locale === 'en' ? headerEn() : header()}
<main class="vm-wp-landing">
${bodyHtml}
</main>
${footer(locale)}
<script src="/assets/lead-magnet/whitepaper-form.js" defer></script>
</body>
</html>`;
}

function bodyFor(locale) {
  const c = COPY[locale];
  const chaptersHtml = c.chapters.map((t) => `<li>${t}</li>`).join('\n      ');
  return `
<span class="eyebrow">${c.eyebrow}</span>
<div class="vm-wp-hero">
  <div class="vm-wp-hero-text">
    <h1>${c.title}</h1>
    <p class="lede">${c.heroSub}</p>
    <a class="cta-inline" href="#vm-whitepaper-form">${c.formHeading}</a>
  </div>
  <div class="vm-wp-hero-image">
    <img src="/assets/lead-magnet/images/whitepaper-cover-${locale}.png" alt="${c.title}" width="280" height="373" loading="lazy">
  </div>
</div>

<div class="vm-wp-body">
  <div class="vm-wp-toc">
    <h2>${c.whatsInside}</h2>
    <ol>
      ${chaptersHtml}
    </ol>

    <div class="vm-wp-credibility">
      <h2>${c.credibilityH}</h2>
      <p>${c.credibilityP1}</p>
      <p>${c.credibilityP2}</p>
    </div>
  </div>

  <div class="vm-wp-form-col">
    <div id="vm-whitepaper-form" data-locale="${locale}" data-slug="${SLUG}">
      <h3>${c.formHeading}</h3>
      <p class="vm-nl-sub">${c.formSub}</p>
    </div>
  </div>
</div>`;
}

function generateLandingPages() {
  write(LANDING_PATH.de, pageShell({ locale: 'de', bodyHtml: bodyFor('de') }));
  write(LANDING_PATH.en, pageShell({ locale: 'en', bodyHtml: bodyFor('en') }));
  console.log(`  ✓ ${LANDING_PATH.de}`);
  console.log(`  ✓ ${LANDING_PATH.en}`);
}

function copyFormAssets() {
  fs.mkdirSync(DIST_ASSETS, { recursive: true });
  fs.copyFileSync(path.join(FORM_ASSET_SRC, 'whitepaper-form.css'), path.join(DIST_ASSETS, 'whitepaper-form.css'));
  fs.copyFileSync(path.join(FORM_ASSET_SRC, 'whitepaper-form.js'), path.join(DIST_ASSETS, 'whitepaper-form.js'));
  console.log('  ✓ Copied whitepaper-form.css / whitepaper-form.js to dist/assets/lead-magnet/');
}

// ---- cover hero image (puppeteer screenshot) ------------------------------

function renderCoverImages(puppeteer) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const templatePath = path.join(CONTENT_DIR, 'cover-template.html');
  const templateSrc = fs.readFileSync(templatePath, 'utf-8');

  return (async () => {
    for (const locale of ['de', 'en']) {
      const outFile = path.join(IMAGES_DIR, `whitepaper-cover-${locale}.png`);
      const hashFile = `${outFile}.hash`;
      const currentHash = hashOf(`${templateSrc}::${locale}`);
      if (!needsRender(outFile, hashFile, currentHash)) {
        console.log(`  ↷ Cover image (${locale}) unchanged, skipped`);
        continue;
      }
      if (!puppeteer) {
        console.log(`  ⚠ puppeteer-core unavailable — cannot render cover image (${locale}), skipping`);
        continue;
      }
      const browser = await puppeteer.launch({ executablePath: CHROME_BIN, headless: 'new', args: ['--no-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600 });
        await page.goto(`file://${templatePath}?locale=${locale}`, { waitUntil: 'networkidle0' });
        await page.screenshot({ path: outFile, type: 'png' });
        fs.writeFileSync(hashFile, currentHash);
        console.log(`  ✓ Rendered cover image: dist/assets/lead-magnet/images/whitepaper-cover-${locale}.png`);
      } finally {
        await browser.close();
      }
    }
  })();
}

// ---- PDF -------------------------------------------------------------------

const LOCALE_HTML_TITLE = { de: 'Cover', en: 'Cover' };
const CHAPTERS_TITLE = { de: 'Kapitel', en: 'Chapters' };

/** Single-language cover+ToC / chapters HTML for one locale's own content
 * file only — no divider page, no other locale's text (defect 2 fix). */
function buildPdfParts(locale) {
  const src = fs.readFileSync(path.join(CONTENT_DIR, `${SLUG}.${locale}.html`), 'utf-8');
  const cover = extractBetween(src, '<!-- WP:COVER:START -->', '<!-- WP:COVER:END -->');
  const toc = extractBetween(src, '<!-- WP:TOC:START -->', '<!-- WP:TOC:END -->');
  const chapters = extractBetween(src, '<!-- WP:CHAPTERS:START -->', '<!-- WP:CHAPTERS:END -->');

  const coverTocHtml = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><title>${LOCALE_HTML_TITLE[locale]}</title><link rel="stylesheet" href="print.css"></head>
<body>
${cover}
${toc}
</body>
</html>`;

  const chaptersHtml = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><title>${CHAPTERS_TITLE[locale]}</title><link rel="stylesheet" href="print.css"></head>
<body>
${chapters}
</body>
</html>`;

  return { coverTocHtml, chaptersHtml, sourceForHash: src };
}

/** Content hash of this locale's deterministic inputs (source HTML + the
 * shared print.css) — see the header comment ("HASH STABILITY") for why
 * this is NOT a hash of the compiled PDF bytes: Chrome stamps a fresh
 * /CreationDate, /ModDate and (via pdfunite) /ID into every render, which
 * would make a byte-hash churn the filename on every rebuild regardless of
 * whether the whitepaper's actual content changed. */
function contentHashForLocale(sourceForHash, printCss) {
  return hashOf(`${SLUG}::${sourceForHash}::${printCss}`).slice(0, 12);
}

const HEADER_TEMPLATE = `<div style="font-family:'Outfit','Segoe UI',Arial,sans-serif;font-size:8px;color:#9a8f91;width:100%;padding:0 20mm;text-align:right;">Virtual Marketer &middot; Agentic Marketing 2026</div>`;
const FOOTER_TEMPLATE = `<div style="font-family:'Outfit','Segoe UI',Arial,sans-serif;font-size:8px;color:#9a8f91;width:100%;padding:0 20mm;display:flex;justify-content:space-between;">
  <span>&copy; SGS Virtual Marketer GmbH</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

async function renderPdfWithPuppeteer(puppeteer, coverTocHtml, chaptersHtml, outPath) {
  const tmpCoverToc = path.join(CONTENT_DIR, `.tmp-cover-toc-${path.basename(outPath)}.html`);
  const tmpChapters = path.join(CONTENT_DIR, `.tmp-chapters-${path.basename(outPath)}.html`);
  const tmpCoverPdf = path.join(CONTENT_DIR, `.tmp-cover-toc-${path.basename(outPath)}.pdf`);
  const tmpChaptersPdf = path.join(CONTENT_DIR, `.tmp-chapters-${path.basename(outPath)}.pdf`);
  fs.writeFileSync(tmpCoverToc, coverTocHtml);
  fs.writeFileSync(tmpChapters, chaptersHtml);

  const browser = await puppeteer.launch({ executablePath: CHROME_BIN, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page1 = await browser.newPage();
    await page1.goto(`file://${tmpCoverToc}`, { waitUntil: 'networkidle0' });
    await page1.pdf({
      path: tmpCoverPdf, format: 'A4', printBackground: true,
      displayHeaderFooter: false, margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const page2 = await browser.newPage();
    await page2.goto(`file://${tmpChapters}`, { waitUntil: 'networkidle0' });
    await page2.pdf({
      path: tmpChaptersPdf, format: 'A4', printBackground: true,
      displayHeaderFooter: true, headerTemplate: HEADER_TEMPLATE, footerTemplate: FOOTER_TEMPLATE,
      margin: { top: '18mm', bottom: '16mm', left: '20mm', right: '20mm' },
    });
  } finally {
    await browser.close();
  }

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  execFileSync('pdfunite', [tmpCoverPdf, tmpChaptersPdf, outPath]);

  for (const f of [tmpCoverToc, tmpChapters, tmpCoverPdf, tmpChaptersPdf]) {
    try { fs.unlinkSync(f); } catch (_e) { /* best effort cleanup */ }
  }
}

function renderPdfWithPlainCli(locale, coverTocHtml, chaptersHtml, outPath) {
  // Documented degradation (see header comment): single pass, no running
  // header/footer/page numbers, on the whole combined document.
  const combined = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><title>Agentic Marketing 2026</title><link rel="stylesheet" href="print.css"></head>
<body>
${coverTocHtml.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '')}
${chaptersHtml.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '')}
</body>
</html>`;
  const tmpFile = path.join(CONTENT_DIR, `.tmp-combined-${path.basename(outPath)}.html`);
  fs.writeFileSync(tmpFile, combined);
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  execFileSync(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--print-to-pdf=${outPath}`, '--no-pdf-header-footer',
    `file://${tmpFile}`,
  ]);
  fs.unlinkSync(tmpFile);
}

/** Removes every other `<slug>.<locale>.*.pdf` in dist/downloads/ once the
 * current one is in place, so a content change (new hash, new filename)
 * doesn't leave the previous hash's file sitting there forever — and
 * removes the pre-fix single bilingual `<slug>.pdf` (and its old sidecar
 * `.hash` file) if either is still present from before this defect fix. */
function cleanupStalePdfs(locale, keepFilename) {
  const prefix = `${SLUG}.${locale}.`;
  if (fs.existsSync(DOWNLOADS_DIR)) {
    for (const f of fs.readdirSync(DOWNLOADS_DIR)) {
      if (f.startsWith(prefix) && f.endsWith('.pdf') && f !== keepFilename) {
        fs.unlinkSync(path.join(DOWNLOADS_DIR, f));
        console.log(`  🧹 Removed stale dist/downloads/${f}`);
      }
    }
  }
  for (const legacyName of [`${SLUG}.pdf`, `${SLUG}.pdf.hash`]) {
    const legacyPath = path.join(DOWNLOADS_DIR, legacyName);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
      console.log(`  🧹 Removed legacy dist/downloads/${legacyName} (pre-fix bilingual PDF)`);
    }
  }
}

async function renderPdfForLocale(puppeteer, printCss, locale) {
  const { coverTocHtml, chaptersHtml, sourceForHash } = buildPdfParts(locale);
  const hash = contentHashForLocale(sourceForHash, printCss);
  const filename = `${SLUG}.${locale}.${hash}.pdf`;
  const outPath = path.join(DOWNLOADS_DIR, filename);
  const urlPath = `/downloads/${filename}`;

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

  // The hash is embedded in the filename itself, so "does this exact file
  // already exist" IS the idempotence check — unchanged content always
  // resolves to the same filename and is skipped without invoking Chrome.
  if (fs.existsSync(outPath)) {
    console.log(`  ↷ Whitepaper PDF (${locale}) unchanged, skipped: ${filename}`);
  } else if (puppeteer) {
    await renderPdfWithPuppeteer(puppeteer, coverTocHtml, chaptersHtml, outPath);
    console.log(`  ✓ Rendered dist/downloads/${filename} (puppeteer-core: running header/footer, page numbers)`);
  } else {
    console.log(`  ⚠ puppeteer-core unavailable — falling back to plain CLI for (${locale})`);
    renderPdfWithPlainCli(locale, coverTocHtml, chaptersHtml, outPath);
    console.log(`  ✓ Rendered dist/downloads/${filename} (plain CLI fallback)`);
  }

  cleanupStalePdfs(locale, filename);
  return { locale, filename, path: urlPath, hash };
}

function writeManifest(entries) {
  const manifest = {
    [SLUG]: {
      de: { path: entries.de.path, filename: entries.de.filename, hash: entries.de.hash },
      en: { path: entries.en.path, filename: entries.en.filename, hash: entries.en.hash },
    },
  };
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('  ✓ Wrote backend/src/generated/whitepaper-manifest.json');
}

async function renderPdf(puppeteer) {
  const printCss = fs.readFileSync(path.join(CONTENT_DIR, 'print.css'), 'utf-8');
  const de = await renderPdfForLocale(puppeteer, printCss, 'de');
  const en = await renderPdfForLocale(puppeteer, printCss, 'en');
  writeManifest({ de, en });
}

// ---- main ------------------------------------------------------------------

async function main() {
  console.log('\n📄 Generating whitepaper landing pages, cover image and PDF...\n');

  let puppeteer = null;
  try {
    puppeteer = require('puppeteer-core');
  } catch (_e) {
    puppeteer = null;
  }

  copyFormAssets();
  generateLandingPages();
  await renderCoverImages(puppeteer);
  await renderPdf(puppeteer);

  console.log('\n✅ Whitepaper lead magnet generated\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
