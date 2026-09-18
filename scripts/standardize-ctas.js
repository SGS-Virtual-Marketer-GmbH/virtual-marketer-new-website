#!/usr/bin/env node

/**
 * CTA label standardisation + one repeated CTA on the long marketing pages.
 *
 * INVENTORY (measured against dist/, not the earlier audit)
 *
 * There are exactly three real destinations any CTA on this site points to:
 * a demo booking (/virtual-marketer-demo/, /en/demo/), the contact page
 * (/kontakt/, /en/contact/) and a custom-model request (/modell-anfragen/,
 * /en/request-custom-model/). Across every button-styled anchor pointing at
 * one of those (excluding icon-only UI controls that happen to share the
 * page's own URL as an href prefix — mmenu-close, back-to-top, and inline
 * body-copy links that mention a page in a sentence rather than acting as a
 * button) the labels are already ~95% consistent:
 *
 *   demo (DE): "Demo buchen"        — dominant on every blog post + most pages
 *   demo (EN): "Book a demo"
 *   model request (DE): "Modell anfragen"
 *   model request (EN): "Request a model"
 *   contact (DE/EN): "Kontakt" / "Contact" — already a single label each,
 *     nothing to standardise
 *
 * The outliers are seven specific buttons (see FIXES below), all on
 * /modell-anfragen/, /en/request-custom-model/ and /virtual-marketer-ai-
 * services/ — a mix of genuine synonyms ("Demo anfragen", "Jetzt Demo
 * buchen"), a different framing of the same action ("Kostenloses
 * Erstgespräch buchen", "Book a free first call", "Live-Demo ansehen"), and
 * one that doesn't describe the destination at all ("Kosten senken" on a
 * button that links to the demo page).
 *
 * Matched by BOTH the exact visible text AND the anchor's href — never by
 * text alone — so a generic phrase like "Mehr erfahren" ("Learn more"),
 * reused all over the site for unrelated links, is only ever touched on the
 * one button that actually points at a standardised destination.
 * href.includes('#') is excluded up front: the menu-close/back-to-top
 * controls reuse the current page's own URL with a `#` fragment as their
 * href, which would otherwise match "points at /modell-anfragen/" on that
 * page itself.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

const FIXES = [
  { href: '/virtual-marketer-demo/', from: 'Kostenloses Erstgespräch buchen', to: 'Demo buchen' },
  { href: '/virtual-marketer-demo/', from: 'Live-Demo ansehen', to: 'Demo buchen' },
  { href: '/virtual-marketer-demo/', from: 'Mehr erfahren', to: 'Demo buchen' },
  { href: '/virtual-marketer-demo/', from: 'Demo anfragen', to: 'Demo buchen' },
  { href: '/virtual-marketer-demo/', from: 'Kosten senken', to: 'Demo buchen' },
  { href: '/virtual-marketer-demo/', from: 'Jetzt Demo buchen', to: 'Demo buchen' },
  { href: '/en/demo/', from: 'Book a free first call', to: 'Book a demo' },
];

function hrefMatches(href, target) {
  return href === target || href === `https://virtual-marketer.de${target}`;
}

function standardizeLabels(html) {
  let changed = 0;
  const out = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs, inner) => {
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    if (!hrefMatch) return whole;
    const href = hrefMatch[1];
    if (href.includes('#')) return whole; // same-page control, not a CTA
    for (const fix of FIXES) {
      if (hrefMatches(href, fix.href) && inner.includes(fix.from)) {
        changed++;
        return `<a${attrs}>${inner.replace(fix.from, fix.to)}</a>`;
      }
    }
    return whole;
  });
  return { html: out, changed };
}

/**
 * Repeated CTA at scroll depth — homepage only.
 *
 * Scoped to exactly two pages (DE and EN homepage), not "every long page",
 * for a structural reason: this site's feature/solution pages are Elementor
 * exports, arbitrarily deeply nested (30+ top-level sections on the
 * homepage alone) with no reliable, generic "safe to insert a sibling here"
 * boundary a script can find without a real HTML parser and a per-page
 * visual check — this project's own CLAUDE.md says as much about building
 * feature pages "one at a time, end to end" for exactly this reason. The
 * homepage's FAQ heading (<h2 class="main-heading">, present on both
 * locales) is a boundary verified by hand against both pages' actual
 * output, not assumed to generalise to templates this script has not seen.
 * Other long pages are listed as follow-up work in the handoff note rather
 * than guessed at here.
 *
 * The block reuses the page's own existing hero CTA (href + label) instead
 * of inventing new copy — scripts/standardize-ctas.js's own label fix above
 * already guarantees that label is canonical.
 */
// Must identify the SPECIFIC "FAQ" heading, not just any <h2 class="main-
// heading"> — the homepage has several (one per solutions/industry
// section) before it ever reaches the FAQ. Matching on the heading's own
// text, not just its class, is what makes this land on the right one.
const FAQ_HEADING_RE =
  /<h2\b[^>]*\bclass=["'][^"']*\bmain-heading\b[^"']*["'][^>]*>(?:(?!<\/h2>)[\s\S])*?(?:H[äa]ufig gestellte Fragen|Frequently asked questions)(?:(?!<\/h2>)[\s\S])*?<\/h2>/i;
const HERO_CTA_RE = /<a\b[^>]*\bclass=["'][^"']*\bvm-home-cta-btn\b[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i;

// The FAQ <h2> itself sits inside a small "iheading2" widget wrapper
// (eyebrow span + heading, nothing else) — a first attempt inserted the CTA
// block right there, which visually wedged a 3-line card between the "FAQ's"
// eyebrow and its own heading. Fixed by walking back from the heading match
// to the start of the LAST preceding `elementor-widget-iheading2` wrapper
// div (the widget the heading itself lives in) and inserting before that
// whole widget instead, landing the block as a sibling above the FAQ
// section rather than inside its heading. Matched by class only (no
// hardcoded element id, in case a rebuild regenerates Elementor's ids) and
// only ever used once the FAQ text match above has already confirmed this
// is the right section.
const IHEADING_WIDGET_RE = /<div\b[^>]*\bclass=["'][^"']*\belementor-widget-iheading2\b[^"']*["'][^>]*>/gi;

function insertHomepageRepeatCta(html, isEnglish) {
  const heroCta = html.match(HERO_CTA_RE);
  const faqHeading = html.match(FAQ_HEADING_RE);
  if (!heroCta || !faqHeading) return { html, changed: false };

  let widgetStart = -1;
  for (const m of html.matchAll(IHEADING_WIDGET_RE)) {
    if (m.index < faqHeading.index) widgetStart = m.index;
    else break;
  }
  if (widgetStart === -1) return { html, changed: false };

  const href = heroCta[1];
  const label = heroCta[2].replace(/<[^>]*>/g, '').trim();
  const lede = isEnglish
    ? 'See it on your own data — book a short walkthrough.'
    : 'Sehen Sie es an Ihren eigenen Daten — in einer kurzen Live-Demo.';

  const block = `<div class="vm-repeat-cta"><p>${lede}</p><a class="vm-repeat-cta-btn" href="${href}">${label}</a></div>\n`;
  return { html: html.slice(0, widgetStart) + block + html.slice(widgetStart), changed: true };
}

function main() {
  console.log('\n🔗 Standardising CTA labels...\n');

  let labelsChanged = 0;
  let pagesWithLabelChanges = 0;
  let ctasAdded = 0;

  for (const file of findHtmlFiles(DIST)) {
    const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
    let html = fs.readFileSync(file, 'utf-8');
    const original = html;

    const labeled = standardizeLabels(html);
    html = labeled.html;
    if (labeled.changed) {
      labelsChanged += labeled.changed;
      pagesWithLabelChanges++;
    }

    if ((rel === '/index.html' || rel === '/en/index.html') && !html.includes('vm-repeat-cta')) {
      const isEnglish = rel === '/en/index.html';
      const withCta = insertHomepageRepeatCta(html, isEnglish);
      if (withCta.changed) {
        html = withCta.html;
        ctasAdded++;
      }
    }

    if (html !== original) fs.writeFileSync(file, html);
  }

  console.log(`✅ CTA labels standardised`);
  console.log(`   • ${labelsChanged} label(s) fixed across ${pagesWithLabelChanges} page(s)`);
  console.log(`   • ${ctasAdded} homepage(s) given a repeated CTA at the FAQ section\n`);
}

main();
