#!/usr/bin/env node

/**
 * Replaces the scraped WordPress Impressum with a complete, current one, and
 * styles it in the brand's own CI instead of the theme's default body copy.
 *
 * WHAT WAS MISSING, AND WHY IT MATTERS
 *
 * The exported page carried three sections: the company, one email address,
 * and a disclaimer. Against § 5 DDG and § 18 MStV that is short of several
 * mandatory items, two of them seriously:
 *
 *  - NO COMMERCIAL REGISTER ENTRY. § 5 Abs. 1 Nr. 4 DDG and § 35a GmbHG
 *    require the register court and number for a GmbH. Simply absent.
 *
 *  - NO § 18 Abs. 2 MStV RESPONSIBLE PERSON. The site publishes ~90 blog
 *    articles, which makes it journalistic-editorial, and that provision
 *    requires a named natural person with an address. A GmbH cannot hold
 *    press-law responsibility, so naming the company does not satisfy it.
 *    Nobody was named at all.
 *
 * WHAT IS DELIBERATELY *NOT* HERE
 *
 * No link to the EU ODR platform. Nearly every German Impressum template
 * still carries one, and it is now wrong: the platform ceased operation on
 * 20 July 2025 when Regulation (EU) 2024/3228 repealed the ODR Regulation.
 * There is no successor. Linking a dead platform is not merely obsolete, it
 * is arguably itself misleading under § 5 UWG. The § 36 VSBG statement below
 * is the part that survives, and it IS required here because the offering is
 * to be open to consumers as well as businesses.
 *
 * No "§ 5 TMG" citation either. The TMG was repealed on 14 May 2024 and
 * replaced by the DDG; a TMG reference dates the page instantly.
 *
 * No Stammkapital. Stating it is optional, but doing so triggers a further
 * duty to disclose any outstanding contributions — a trap with no upside.
 *
 * FACTS THAT ARE STILL OPEN
 *
 * Anything not verified is omitted rather than guessed. In particular there
 * is no VAT identification number and no telephone number below, because
 * neither could be confirmed — a fabricated USt-IdNr. in an Impressum would
 * be considerably worse than an absent one. § 27a UStG requires the VAT ID
 * only if one exists, and the ECJ (C-298/07) settled that a telephone number
 * is not mandatory where a second fast contact channel exists, which the
 * contact form provides. Both are listed in OPEN_ITEMS below and reported at
 * build time so they cannot be quietly forgotten.
 *
 * The register data was verified against two independent public sources
 * (North Data, openregister.de) but NOT against handelsregister.de itself,
 * which is behind a query form. It is flagged for confirmation.
 *
 * This is a structured compliance pass, not legal advice. A Fachanwalt
 * should sign it off before it is relied on.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/** Verified via two independent public sources; confirm against the register. */
const REGISTER_COURT = 'Amtsgericht Bad Homburg v. d. Höhe';
const REGISTER_NUMBER = 'HRB 16253';

/** Reported at the end of the run — facts the page needs and does not have. */
const OPEN_ITEMS = [
  'USt-IdNr. (§ 27a UStG) — omitted, not fabricated. Supply it from the BZSt letter, or confirm none exists. Never publish the Steuernummer.',
  'Telefonnummer — omitted. Not mandatory (EuGH C-298/07) since the contact form exists, but list it if one is used for customer contact.',
  `${REGISTER_NUMBER} / ${REGISTER_COURT} — confirm against handelsregister.de; verified only via secondary sources.`,
  'BFSG: the offering is to be open to consumers, so an "Erklärung zur Barrierefreiheit" page is required separately (not in the Impressum).',
];

const CSS_ID = 'vm-impressum-style';

/* vm-red #94152b / vm-red-dark #700f2b / vm-blue #66a3ce / #a3cce9 — the real
   product CI from vm-customer-web-ui/tailwind.config.js. */
const CSS = `<style id="${CSS_ID}">
  .vm-legal{max-width:820px;margin:0 auto;padding:8px 0 8px}
  .vm-legal .vm-legal-intro{
    border-left:3px solid #94152b;background:#faf7f8;
    padding:14px 18px;border-radius:0 10px 10px 0;margin:0 0 34px;
    color:#4b5563;font-size:15px;line-height:1.7;
  }
  .vm-legal h2{
    font-size:20px;line-height:1.3;margin:38px 0 14px;color:#241417;
    padding-bottom:9px;border-bottom:1px solid #ececf0;font-weight:700;
  }
  .vm-legal h2:first-of-type{margin-top:8px}
  .vm-legal p{margin:0 0 14px;line-height:1.8;color:#4b5563;font-size:16px}
  .vm-legal a{color:#94152b;text-decoration:underline;text-underline-offset:2px}
  .vm-legal a:hover{color:#700f2b}

  /* The address, the register entry and the named responsible person are the
     parts a reader is actually looking for and the parts an authority checks.
     Boxed so they are findable at a glance instead of being three paragraphs
     of body copy among nine. */
  .vm-legal .vm-legal-card{
    background:#fff;border:1px solid #e9e6e7;border-radius:12px;
    padding:20px 22px;margin:0 0 16px;
    box-shadow:0 1px 2px rgba(36,20,23,.04);
  }
  .vm-legal .vm-legal-card p{margin:0;line-height:1.85}
  .vm-legal .vm-legal-card strong{color:#241417}
  .vm-legal dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:8px 20px}
  .vm-legal dt{color:#6b7280;font-size:14px;white-space:nowrap}
  .vm-legal dd{margin:0;color:#241417;font-weight:600;font-size:15px}

  @media (max-width:640px){
    /* !important only because it is answering one: mobile-polish.js sets
       h2{font-size:clamp(23px,6.4vw,32px) !important} for every h2 below
       1024px, which is right for a marketing page's section headings and
       wrong here — it rendered these headings LARGER on mobile (24px) than
       on desktop (20px). Matching the flag is the narrow way to opt this one
       page out without weakening that rule everywhere else. */
    .vm-legal h2{font-size:18px !important;margin-top:30px}
    .vm-legal dl{grid-template-columns:1fr;gap:2px 0}
    .vm-legal dd{margin-bottom:10px}
    .vm-legal .vm-legal-card{padding:16px 16px}
  }
</style>`;

const BODY = `<div class="vm-legal">
<p class="vm-legal-intro">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG) und § 18 Abs. 2 Medienstaatsvertrag (MStV).</p>

<h2>Diensteanbieter</h2>
<div class="vm-legal-card">
<p><strong>SGS Virtual Marketer GmbH</strong><br>
Frankfurter Landstr. 50<br>
61352 Bad Homburg v. d. Höhe<br>
Deutschland</p>
</div>
<p>Vertreten durch die Geschäftsführer Jens Göckus und Lisa Stamminger.</p>

<h2>Registereintrag</h2>
<div class="vm-legal-card">
<dl>
<dt>Registergericht</dt><dd>${REGISTER_COURT}</dd>
<dt>Registernummer</dt><dd>${REGISTER_NUMBER}</dd>
</dl>
</div>

<h2>Kontakt</h2>
<p>E-Mail: <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a><br>
Kontaktformular: <a href="/kontakt/">virtual-marketer.de/kontakt</a></p>

<h2>Verantwortlich für journalistisch-redaktionelle Inhalte</h2>
<div class="vm-legal-card">
<p>Verantwortlich gemäß § 18 Abs. 2 MStV:<br>
<strong>Jens Göckus</strong><br>
Frankfurter Landstr. 50<br>
61352 Bad Homburg v. d. Höhe<br>
Deutschland</p>
</div>

<h2>Haftung für Inhalte</h2>
<p>Die Inhalte dieses Onlineangebotes wurden sorgfältig und nach unserem aktuellen Kenntnisstand erstellt, dienen jedoch nur der Information und entfalten keine rechtlich bindende Wirkung, sofern es sich nicht um gesetzlich verpflichtende Informationen (z.&nbsp;B. das Impressum, die Datenschutzerklärung, AGB oder verpflichtende Belehrungen von Verbrauchern) handelt. Wir behalten uns vor, die Inhalte vollständig oder teilweise zu ändern oder zu löschen, soweit vertragliche Verpflichtungen unberührt bleiben. Alle Angebote sind freibleibend und unverbindlich.</p>

<h2>Haftung für Links</h2>
<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte können wir keine Gewähr übernehmen; verantwortlich ist stets der jeweilige Anbieter oder Betreiber der verlinkten Seiten. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft; rechtswidrige Inhalte waren zu diesem Zeitpunkt nicht erkennbar. Eine allgemeine Verpflichtung zur Überwachung der übermittelten oder gespeicherten fremden Informationen besteht nach Artikel 8 der Verordnung (EU) 2022/2065 (Digital Services Act) nicht. Sobald uns Rechtsverletzungen bekannt werden, entfernen wir die betreffenden Links unverzüglich.</p>

<h2>Urheberrecht</h2>
<p>Die durch den Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der vorherigen schriftlichen Zustimmung der SGS Virtual Marketer GmbH. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet und als solche gekennzeichnet. Sollten Sie dennoch auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis; bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Inhalte umgehend.</p>

<h2>Verbraucherstreitbeilegung</h2>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Verbraucherstreitbeilegungsgesetz).</p>
</div>`;

/**
 * Replaces the content of the element opened at `start`, by counting nested
 * opening and closing tags of the same name.
 */
function replaceElementContent(html, openTagRe, tag, replacement) {
  const open = openTagRe.exec(html);
  if (!open) return null;
  const contentStart = open.index + open[0].length;

  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  re.lastIndex = contentStart;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[2] === '/') continue;
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        return html.slice(0, contentStart) + replacement + html.slice(m.index);
      }
    } else depth++;
  }
  return null;
}

function main() {
  console.log('\n⚖️  Rewriting the Impressum...\n');

  const file = path.join(DIST, 'impressum/index.html');
  if (!fs.existsSync(file)) {
    console.log('   ⚠ dist/impressum/index.html not found — skipped');
    return;
  }

  let html = fs.readFileSync(file, 'utf-8');

  // The scraped page wraps its Elementor content in .inner-post, inside the
  // <article> that also carries the <h1>. Replacing the inner-post content
  // keeps the theme's heading, breadcrumb and page furniture intact.
  const out = replaceElementContent(html, /<div class="inner-post">/i, 'div', '\n' + BODY + '\n');
  if (!out) {
    console.log('   ⚠ could not locate .inner-post — Impressum NOT rewritten');
    process.exitCode = 1;
    return;
  }
  html = out;

  if (!html.includes(CSS_ID)) {
    const headEnd = html.search(/<\/head>/i);
    if (headEnd !== -1) html = html.slice(0, headEnd) + CSS + '\n' + html.slice(headEnd);
  }

  fs.writeFileSync(file, html);

  const required = [
    ['Registereintrag', REGISTER_NUMBER],
    ['§ 18 MStV responsible person', 'Jens Göckus'],
    ['§ 36 VSBG statement', 'Verbraucherschlichtungsstelle'],
    ['DSA link liability', '2022/2065'],
    ['Urheberrecht', 'Urheberrecht'],
  ];
  const missing = required.filter(([, needle]) => !html.includes(needle));

  console.log('✅ Impressum rewritten and styled in CI');
  for (const [label] of required) {
    console.log(`   ${missing.some(([l]) => l === label) ? '✗' : '✓'} ${label}`);
  }

  // The two errors this page is most likely to acquire back, both of which
  // look like diligence and are the opposite.
  if (/ec\.europa\.eu\/consumers\/odr|ODR-Plattform/i.test(html)) {
    console.log('   ✗ links the EU ODR platform — shut down 20 July 2025, must not be linked');
    process.exitCode = 1;
  } else {
    console.log('   ✓ no EU ODR link (platform shut down 20 July 2025)');
  }
  if (/§\s*5\s*TMG|Telemediengesetz/i.test(html)) {
    console.log('   ✗ cites the TMG — repealed 14 May 2024, superseded by the DDG');
    process.exitCode = 1;
  } else {
    console.log('   ✓ cites the DDG, not the repealed TMG');
  }

  if (missing.length) {
    console.log(`   ⚠ ${missing.length} required section(s) missing`);
    process.exitCode = 1;
  }

  console.log('\n   Still required from the client:');
  OPEN_ITEMS.forEach((i) => console.log(`     • ${i}`));
  console.log();
}

main();
