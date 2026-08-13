#!/usr/bin/env node

/**
 * Homepage conversion pass: a real solutions showcase, and CTAs that ask.
 *
 * WHAT WAS WRONG
 *
 * The homepage's only concrete mention of what Virtual Marketer actually
 * does was a horizontally scrolling ticker of twelve generic capability
 * words — "Produktbeschreibungen", "Newslettering", "Kaufberatung" — with no
 * link, no product name, nothing a visitor could click through to. The real
 * 16-product catalogue lived one click away at /ki-loesungen/, but the
 * homepage never pointed at it or named a single product. A visitor who
 * landed here and wanted to know "what do I actually get" had to guess or
 * leave.
 *
 * And in a page built from seven Elementor sections, the only call to action
 * was one "Demo buchen" button in the hero. Everything below it — the
 * industries, the use-case ticker, the 13,000-word About narrative, the
 * onboarding steps, the FAQ — ended with nothing to do next. The FAQ in
 * particular is where marketing-psychology sequencing says a page should be
 * strongest: it is the last-objection-handling section, and this one
 * answered "what does it cost" and then handed the visitor straight to the
 * footer.
 *
 * WHAT THIS ADDS, AND WHY THESE TWO PLACEMENTS
 *
 * 1. A solutions showcase, inserted between "Industries" (who it's for) and
 *    the use-case ticker (which now reads as reinforcement of concrete tools
 *    just shown, rather than the only concrete thing on the page before the
 *    About narrative). Sixteen cards — icon, product name, one-line
 *    tagline, linked to the real product page — reusing the SOLUTIONS array
 *    from fix-navigation.js (same icons, same labels, same hrefs as the
 *    mega-menu, so there is one source of truth for "what are our
 *    products") and the taglines already written for the product pages
 *    (scripts/generate-feature-pages.js) rather than new copy invented here.
 *    No new images: icon-only cards keep this out of the homepage's LCP
 *    path, which the CLS/performance passes already fought hard to protect.
 *
 * 2. A closing CTA after the FAQ, before the footer — the section that was
 *    previously letting a persuaded visitor fall through to the footer with
 *    nothing to do.
 *
 * A THIRD CTA, DELIBERATELY NOT ADDED HERE
 *
 * The hero itself is untouched. It already has the page's primary CTA, it
 * is the highest-value section on the page, and it was not what either
 * defect report was about. Changing it is a separate, more consequential
 * decision than adding sections below the fold.
 *
 * CTA LABEL STAYS "Demo buchen" EVERYWHERE
 *
 * Consistency over novelty: the header, the hero and the footer all already
 * say "Demo buchen", so every new CTA on this page uses the same label
 * rather than a synonym ("Erstgespräch buchen", "Termin vereinbaren") that
 * would make a returning visitor wonder if it is a different offer. The
 * psychological lever used at each new placement is the surrounding
 * microcopy instead — specificity ("15 Minuten") and risk reversal
 * ("kostenlos, unverbindlich") — which is where that kind of framing
 * actually works, rather than in the label of a button a visitor already
 * recognises.
 *
 * WHY THIS RUNS AS ITS OWN STEP AND NOT INSIDE mobile-polish.js ETC.
 *
 * It edits page content, not layout defects, and it is homepage-specific —
 * every other homepage-adjacent script in this pipeline (fix-navigation.js,
 * fix-broken-widgets.js) is a site-wide defect fix applied everywhere it
 * matches, not a one-page content addition. Keeping this separate means the
 * next person looking for "what changed on the homepage" finds one file.
 *
 * DE ONLY BY DESIGN
 *
 * This writes German markup into dist/index.html and nothing else.
 * scripts/mirror-en-homepage.js runs after this step and builds /en/ by
 * translating the built German page — its COPY table has this file's new
 * strings added at the bottom, so /en/ picks up the same sections in
 * English by construction rather than by a second hand-written copy that
 * could drift. Anything that fails to translate is reported loudly by that
 * script's own germanish-string check, so a forgotten string here cannot
 * ship silently untranslated.
 *
 * Run after generate-feature-pages.js (for FEATURES and its taglines) and
 * fix-navigation.js (for SOLUTIONS/svgIcon), before mirror-en-homepage.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const HOME = path.join(DIST, 'index.html');

const { FEATURES } = require('./generate-feature-pages');
const { SOLUTIONS, svgIcon } = require('./fix-navigation');

/** SOLUTIONS carries icon/label/href; FEATURES carries the tagline. Same 16 slugs. */
function mergedSolutions() {
  const bySlug = new Map(FEATURES.map((f) => [f.slug, f]));
  return SOLUTIONS.map((s) => {
    const slug = (s.href.match(/\/ki-loesungen\/([^/]+)\//) || [])[1];
    const f = bySlug.get(slug);
    return { ...s, tagline: f ? f.de.tagline : '' };
  });
}

const MARKER = 'vm-home-solutions';

const CSS = `<style id="${MARKER}-style">
  /* Both top-level sections declare these independently rather than once on
     a shared ancestor: .vm-home-solutions and .vm-home-cta are siblings in
     the page, not nested, and a CSS custom property set on one is invisible
     to the other — a real bug this had, caught by measuring the CTA button
     background in the browser rather than trusting the source at a glance
     (it computed to transparent: the button existed, matched the layout,
     and was invisible). Redeclaring costs nothing at this scale and keeps
     each block readable on its own. */
  .vm-home-solutions, .vm-home-cta{
    --vm-red:#94152b; --vm-red-dark:#700f2b; --vm-blue:#3d7ba8;
    --vm-ink:#241417; --vm-body:#4a4143; --vm-line:#e7dfe0; --vm-tint:#faf7f7;
  }
  .vm-home-solutions{
    max-width:1200px;margin:0 auto;padding:88px 20px 64px;
  }
  .vm-home-solutions .eyebrow{
    display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.06em;
    text-transform:uppercase;color:var(--vm-red);background:#fbecee;
    padding:5px 14px;border-radius:999px;margin-bottom:16px;
    font-family:"DM Sans",sans-serif;
  }
  .vm-home-solutions h2{
    font-family:"Outfit",sans-serif;font-size:36px;line-height:1.2;font-weight:600;
    color:var(--vm-ink);margin:0 0 12px;max-width:26ch;
  }
  .vm-home-solutions .vm-home-sol-sub{
    font-family:"DM Sans",sans-serif;font-size:17px;line-height:1.6;color:var(--vm-body);
    max-width:62ch;margin:0 0 40px;
  }
  .vm-home-sol-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
  .vm-home-sol-card{
    display:flex;flex-direction:column;gap:10px;background:#fff;
    border:1px solid var(--vm-line);border-radius:14px;padding:20px 20px 22px;
    text-decoration:none;color:inherit;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;
  }
  .vm-home-sol-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(36,20,23,.10);border-color:var(--vm-red);}
  .vm-home-sol-ic{
    width:42px;height:42px;border-radius:10px;flex:0 0 auto;
    display:flex;align-items:center;justify-content:center;
    background:var(--vm-tint);color:var(--vm-red);
  }
  .vm-home-sol-ic svg{width:20px;height:20px;}
  .vm-home-sol-card strong{
    font-family:"DM Sans",sans-serif;font-size:15.5px;font-weight:700;color:var(--vm-ink);line-height:1.35;
  }
  .vm-home-sol-card span{
    font-family:"DM Sans",sans-serif;font-size:13.5px;line-height:1.5;color:var(--vm-body);
  }
  .vm-home-sol-foot{margin:28px 0 0;text-align:center;}
  .vm-home-sol-foot a{
    font-family:"DM Sans",sans-serif;font-weight:700;font-size:15px;color:var(--vm-red);text-decoration:none;
  }
  .vm-home-sol-foot a:hover{color:var(--vm-red-dark);text-decoration:underline;}

  /* --- Shared CTA band, used after the showcase and after the FAQ -------- */
  .vm-home-cta{
    max-width:1200px;margin:0 auto;padding:0 20px 88px;text-align:center;
  }
  .vm-home-cta.vm-home-cta-closing{padding-top:64px;padding-bottom:96px;}
  .vm-home-cta h3{
    font-family:"Outfit",sans-serif;font-size:26px;font-weight:600;color:var(--vm-ink);
    margin:0 0 8px;
  }
  .vm-home-cta p{
    font-family:"DM Sans",sans-serif;font-size:15.5px;color:var(--vm-body);
    margin:0 0 22px;
  }
  .vm-home-cta-btn{
    display:inline-block;padding:14px 32px;border-radius:10px;
    background:var(--vm-red);color:#fff;font-family:"DM Sans",sans-serif;
    font-weight:700;font-size:16px;text-decoration:none;
  }
  .vm-home-cta-btn:hover{background:var(--vm-red-dark);color:#fff;}
  .vm-home-cta-alt{
    display:block;margin-top:14px;font-family:"DM Sans",sans-serif;font-size:14px;color:var(--vm-body);
  }
  .vm-home-cta-alt a{color:var(--vm-red);text-decoration:underline;text-underline-offset:2px;}

  @media (max-width:980px){
    .vm-home-sol-grid{grid-template-columns:repeat(2,1fr);}
  }
  @media (max-width:640px){
    .vm-home-solutions{padding:56px 15px 40px;}
    .vm-home-solutions h2{font-size:27px !important;}
    .vm-home-cta{padding-left:15px;padding-right:15px;}
  }
</style>`;

function solutionsSection() {
  const items = mergedSolutions();
  const cards = items
    .map(
      (s) => `      <a class="vm-home-sol-card" href="${s.href}">
        <span class="vm-home-sol-ic">${svgIcon(s.icon)}</span>
        <strong>${s.label}</strong>
        <span>${s.tagline}</span>
      </a>`
    )
    .join('\n');

  return `
<section class="${MARKER}" aria-labelledby="vm-home-sol-h">
  <span class="eyebrow">Unsere L&ouml;sungen</span>
  <h2 id="vm-home-sol-h">Diese ${items.length} Werkzeuge sind heute bei unseren Kunden im Einsatz</h2>
  <p class="vm-home-sol-sub">Von Produktfotos bis Kampagnen &#8211; jedes Werkzeug l&auml;sst sich einzeln oder zusammen einsetzen, mit Ihren eigenen KI-Modellen.</p>
  <div class="vm-home-sol-grid">
${cards}
  </div>
  <p class="vm-home-sol-foot"><a href="/ki-loesungen/">Alle L&ouml;sungen im &Uuml;berblick &rarr;</a></p>
</section>`;
}

function midCta() {
  return `
<section class="vm-home-cta" aria-labelledby="vm-home-cta1-h">
  <h3 id="vm-home-cta1-h">Sehen Sie, welches Werkzeug zu Ihnen passt</h3>
  <p>Ein kostenloses, unverbindliches Erstgespr&auml;ch &#8211; 15 Minuten, direkt mit unserem Team.</p>
  <a class="vm-home-cta-btn" href="/virtual-marketer-demo/">Demo buchen</a>
</section>`;
}

function closingCta() {
  return `
<section class="vm-home-cta vm-home-cta-closing" aria-labelledby="vm-home-cta2-h">
  <h3 id="vm-home-cta2-h">Bereit f&uuml;r den ersten Schritt?</h3>
  <p>Buchen Sie ein unverbindliches Erstgespr&auml;ch &#8211; 15 Minuten, keine Verpflichtung.</p>
  <a class="vm-home-cta-btn" href="/virtual-marketer-demo/">Demo buchen</a>
  <span class="vm-home-cta-alt">Oder schreiben Sie uns direkt: <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a></span>
</section>`;
}

function main() {
  console.log('\n🏠 Enhancing the homepage: solutions showcase + CTAs...\n');

  if (!fs.existsSync(HOME)) {
    console.log('   ⚠ dist/index.html not found — skipped');
    process.exitCode = 1;
    return;
  }

  let html = fs.readFileSync(HOME, 'utf-8');
  const original = html;

  if (html.includes(MARKER)) {
    console.log('   – already present, skipped (idempotent)');
    return;
  }

  // 1 + 2 — showcase and its CTA, inserted before the Use Cases ticker.
  const useCasesAnchor = 'elementor-element-2823952d';
  const useCasesIdx = html.indexOf(useCasesAnchor);
  if (useCasesIdx === -1) {
    console.log('   ⚠ could not find the Use Cases section anchor — homepage structure changed, skipped');
    process.exitCode = 1;
    return;
  }
  const sectionOpenStart = html.lastIndexOf('<section', useCasesIdx);
  html = html.slice(0, sectionOpenStart) + CSS + solutionsSection() + midCta() + '\n' + html.slice(sectionOpenStart);

  // 3 — closing CTA, right before the content wrapper closes.
  const contentCloseAnchor = '</div><!-- #content -->';
  if (!html.includes(contentCloseAnchor)) {
    console.log('   ⚠ could not find the content-close anchor — closing CTA skipped');
    process.exitCode = 1;
  } else {
    html = html.replace(contentCloseAnchor, closingCta() + '\n' + contentCloseAnchor);
  }

  if (html === original) {
    console.log('   ⚠ no change made');
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(HOME, html);

  const solCount = mergedSolutions().length;
  console.log(`   ✓ solutions showcase inserted (${solCount} products, linked to /ki-loesungen/)`);
  console.log('   ✓ CTA added after the showcase');
  console.log('   ✓ closing CTA added after the FAQ, before the footer');
  console.log('');
}

main();
