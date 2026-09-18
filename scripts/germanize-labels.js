#!/usr/bin/env node

/**
 * Translates the English labels the original WordPress site left on the
 * GERMAN pages.
 *
 * The scrape these pages are built from (scripts/build.js SOURCE) carries
 * a handful of section eyebrows and list items in English even though the
 * page around them is German and `<html lang="de">`:
 *
 *   <span class="stitle-dots">Industries</span>   → Branchen
 *   <span class="stitle-dots">Use Cases</span>    → Einsatzgebiete
 *   <span class="stitle-dots">About us</span>     → Über uns
 *   <span class="stitle-dots">Next Steps</span>   → Nächste Schritte
 *   <span class="stitle-dots">FAQ's</span>        → FAQ
 *   Unique Models - Einzigartig                   → Eigene Modelle – einzigartig
 *   German Solutions - Regional                   → Deutsche Lösungen – regional
 *   Flow-Setup & Client Testing                   → Flow-Setup & Kundentests
 *
 * "FAQ's" is also wrong in English — the apostrophe makes it a possessive,
 * not a plural — so neither language wanted it.
 *
 * The hyphens in the two list items are replaced with en dashes at the same
 * time: German typography sets an apposition with "–", and the surrounding
 * bullets already do.
 *
 * WHY THIS RUNS LATE, AND WHY IT SKIPS /en/
 *
 * scripts/mirror-en-homepage.js (step 53) builds the English homepage by
 * mapping German source strings to English ones, and several of its keys
 * are the very strings above — it maps 'Unique Models - Einzigartig' to
 * 'Unique models — one of a kind'. Rewriting them earlier would leave
 * those keys unmatched and the English page half-German.
 *
 * So this runs after the mirror exists, and skips everything under /en/ —
 * those pages are supposed to be in English, and "Industries" there is
 * correct, not a defect. Matching is on exact strings inside the specific
 * elements that carry them, never a bare document-wide find/replace, so a
 * word like "Industries" occurring in prose is untouched.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

/** Eyebrow labels: `<span class="stitle-dots">…</span>`. */
const EYEBROWS = new Map([
  ['Industries', 'Branchen'],
  ['Use Cases', 'Einsatzgebiete'],
  ['About us', 'Über uns'],
  ['Next Steps', 'Nächste Schritte'],
  ["FAQ's", 'FAQ'],
  ['FAQ&#8217;s', 'FAQ'],
]);

/** Whole-element text, matched inside the tag that holds it. */
const TEXTS = new Map([
  ['Unique Models - Einzigartig', 'Eigene Modelle – einzigartig'],
  ['German Solutions - Regional', 'Deutsche Lösungen – regional'],
  ['API First - Flexibel', 'API First – flexibel'],
  ['Nahtlose Integration - Individuell', 'Nahtlose Integration – individuell'],
  ['Flow-Setup & Client Testing', 'Flow-Setup & Kundentests'],
  ['Flow-Setup &amp; Client Testing', 'Flow-Setup &amp; Kundentests'],
  ["FAQ's", 'FAQs'],
  ['FAQ&#8217;s', 'FAQs'],
]);

/**
 * The one label that is wrong in English too.
 *
 * "FAQ's" is a possessive, not a plural, so it is a typo in both languages
 * rather than a translation gap — which is why the English pages are not
 * simply skipped for it.
 */
const ENGLISH_FIXES = new Map([
  ["FAQ's", 'FAQs'],
  ['FAQ&#8217;s', 'FAQs'],
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** True for pages that are meant to be English. */
function isEnglish(file) {
  const rel = path.relative(DIST, file).split(path.sep);
  return rel[0] === 'en';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  console.log('\n🇩🇪 Translating English labels left on German pages...\n');

  if (!fs.existsSync(DIST)) {
    console.log('   ⚠ dist/ not found — nothing to do\n');
    return;
  }

  let pages = 0;
  let swaps = 0;
  const seen = new Map();

  for (const file of walk(DIST)) {
    const before = fs.readFileSync(file, 'utf-8');
    let after = before;

    if (isEnglish(file)) {
      for (const [wrong, right] of ENGLISH_FIXES) {
        const re = new RegExp(
          `(<span class="stitle-dots">|<(?:h[1-6]|span)\\b[^>]*>)\\s*${escapeRe(wrong)}\\s*(</(?:h[1-6]|span)>)`,
          'g'
        );
        after = after.replace(re, (whole, open, close) => {
          swaps++;
          seen.set(wrong, (seen.get(wrong) || 0) + 1);
          return `${open}${right}${close}`;
        });
      }
      if (after !== before) {
        fs.writeFileSync(file, after);
        pages++;
      }
      continue;
    }

    for (const [en, de] of EYEBROWS) {
      const re = new RegExp(`(<span class="stitle-dots">)${escapeRe(en)}(</span>)`, 'g');
      after = after.replace(re, (whole, open, close) => {
        swaps++;
        seen.set(en, (seen.get(en) || 0) + 1);
        return `${open}${de}${close}`;
      });
    }

    // Inside a heading or the icon-list's text span — never bare prose.
    for (const [en, de] of TEXTS) {
      const re = new RegExp(`(<(?:h[1-6]|span)\\b[^>]*>)\\s*${escapeRe(en)}\\s*(</(?:h[1-6]|span)>)`, 'g');
      after = after.replace(re, (whole, open, close) => {
        swaps++;
        seen.set(en, (seen.get(en) || 0) + 1);
        return `${open}${de}${close}`;
      });
    }

    if (after !== before) {
      fs.writeFileSync(file, after);
      pages++;
    }
  }

  console.log(`   ✓ ${swaps} label(s) corrected across ${pages} page(s)`);
  for (const [en, n] of [...seen].sort((a, b) => b[1] - a[1])) {
    console.log(`       ${n}× "${en}"`);
  }
  console.log();
}

main();
