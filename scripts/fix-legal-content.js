#!/usr/bin/env node

/**
 * Legal/Brand Content Corrections
 *
 * Two site-wide fact fixes, both against the legacy WordPress scrape that
 * build.js copies as-is (so they must be patched post-copy, same pattern as
 * fix-shortlinks.js):
 *
 * 1. Legal entity name — the correct name is "SGS Virtual Marketer GmbH"
 *    (confirmed on the Impressum page itself), but the legacy Yoast
 *    JSON-LD Organization schema baked into every scraped page, plus a
 *    couple of spots in body copy (e.g. Nutzungsbedingungen), still say the
 *    bare "Virtual Marketer GmbH" (missing "SGS"). Global fix with a
 *    negative lookbehind so already-correct "SGS Virtual Marketer GmbH"
 *    instances are left untouched.
 *
 * 2. Fabricated pricing — the homepage FAQ accordion ("Mit welchen Kosten
 *    muss ich rechnen?") states concrete invented tiers (600€/Monat,
 *    ab 50€/Monat). No pricing tiers exist yet, so this is factually wrong,
 *    not just outdated — replaced with an honest "individuelles Angebot"
 *    answer.
 *
 * Run after scripts/inject-language-switcher.js (so newly-injected content
 * is covered too), before scripts/generate-404.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const FABRICATED_PRICING = 'Der Virtual Marketer ist in verschiedenen Paketen buchbar. In jedem Paket ist mindestens 1 Custom KI Produkt enthalten und ein monatliches Wörterkontingent. Je nach Paket unterscheiden sich das Wortkontingent, die Anzahl Custom KI Modelle und inkludierten Sitzungen mit unseren KI Strategie Coaches. Enterprise Lösungen beginnen bei 600€ /Monat. Für kleine Unternehmen bieten wir Einsteigerpakete mit eingeschränktem Funktionsumfang ab 50€ im Monat an.';

const HONEST_PRICING = 'Der Virtual Marketer wird individuell auf Ihr Unternehmen zugeschnitten &#8211; von der Anzahl der Custom KI Modelle über das monatliche Wörterkontingent bis zu den inkludierten Sitzungen mit unseren KI Strategie Coaches. Da sich die Kosten nach Ihrem konkreten Bedarf richten, erstellen wir Ihnen gerne ein individuelles Angebot. Buchen Sie hierzu einfach eine unverbindliche Demo oder kontaktieren Sie uns direkt.';

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n📝 Fixing legal name & fabricated pricing claims...\n');

  const files = findHtmlFiles(DIST);
  let nameFixCount = 0;
  let nameFixFiles = 0;
  let pricingFixFiles = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    html = html.replace(/(?<!SGS )Virtual Marketer GmbH/g, () => {
      nameFixCount++;
      return 'SGS Virtual Marketer GmbH';
    });

    if (html.includes(FABRICATED_PRICING)) {
      html = html.split(FABRICATED_PRICING).join(HONEST_PRICING);
      pricingFixFiles++;
    }

    if (html !== before) {
      fs.writeFileSync(file, html);
      if (html !== before && before.match(/(?<!SGS )Virtual Marketer GmbH/)) nameFixFiles++;
    }
  }

  console.log(`  ✓ Legal name: fixed ${nameFixCount} occurrence(s) across ${nameFixFiles} file(s)`);
  console.log(`  ✓ Pricing claim: replaced fabricated figures in ${pricingFixFiles} file(s)\n`);
}

main();
