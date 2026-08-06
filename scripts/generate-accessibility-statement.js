#!/usr/bin/env node

/**
 * Erklärung zur Barrierefreiheit — /barrierefreiheit/ and /en/accessibility/.
 *
 * WHY THIS PAGE EXISTS
 *
 * The Barrierefreiheitsstärkungsgesetz has applied since 28 June 2025. It
 * covers services in electronic commerce offered to consumers, and the
 * decision to open this offering to consumers as well as businesses is what
 * brings this site inside it. The Impressum flagged this as a separate
 * requirement rather than folding it in, because it is a separate document
 * with its own mandatory contents.
 *
 * WHAT A CONFORMANCE STATEMENT HAS TO CONTAIN
 *
 * Following the structure the EU model statement established and German
 * practice under the BFSG follows: what it covers, the conformance status
 * against a named standard, what is *not* accessible and why, how the
 * assessment was made and when, a way to report a barrier, and the
 * enforcement route if that goes unanswered.
 *
 * "TEILWEISE KONFORM", AND WHY THAT IS THE HONEST ANSWER
 *
 * The temptation is to claim full conformance. It would be wrong here, and
 * declaring partial conformance with the gap named is both the legally safer
 * position and the useful one for a reader who actually needs to know.
 *
 * The known gap is real and documented in the code that chose not to fix it.
 * scripts/fix-a11y.js explains it: the theme uses <h6 class="title-box"> for
 * the small eyebrow label above a section heading, so an h2 is followed by an
 * h6 and the heading levels jump. The honest fix is that an eyebrow is not a
 * heading and should be a paragraph — but the theme styles it through the h6
 * selector, so changing the tag changes the design of the legacy pages. That
 * is a content decision rather than an attribute patch, and it was left
 * visible in the audit rather than papered over. A statement that claimed
 * full conformance while that is true would be a false statement.
 *
 * WHAT IS DELIBERATELY NOT CLAIMED
 *
 * No date for fixing the remaining barriers. A statement is allowed to say a
 * gap exists; inventing a deadline that nobody has committed to would be
 * worse than saying nothing. No accessibility certificate or audit-firm name
 * either — the assessment was a self-assessment and says so.
 *
 * THE MICROENTERPRISE EXEMPTION APPLIES, AND THE PAGE STAYS ANYWAY
 *
 * The BFSG exempts microenterprises — fewer than ten people and at most €2m
 * annual turnover — from the service obligations, and the client has
 * confirmed the exemption applies to SGS Virtual Marketer GmbH. So this page
 * is voluntary, not mandatory.
 *
 * It is published regardless, for two reasons. It is true: the conformance
 * work behind it was done, and a visitor who needs to know whether they can
 * use the site deserves the answer whether or not a statute compels it. And
 * the exemption is a moving target — it is tested against headcount and
 * turnover on an ongoing basis, so a company that grows past either
 * threshold acquires the obligation with no warning. Having the statement
 * already there is strictly better than discovering it is overdue.
 *
 * NOTHING ON THE PAGE DISCLOSES THE EXEMPTION OR THE COMPANY'S SIZE, AND
 * THAT IS DELIBERATE — it is the client's explicit instruction, and it is
 * also the right call commercially: headcount and turnover are not a
 * prospect's business, and a statement that opened by explaining why it did
 * not have to exist would undercut its own point. Do not add a sentence
 * along the lines of "as a microenterprise we are exempt, but…". The page
 * simply states what is true about the website.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CONTACT_MAIL = 'info@virtual-marketer.de';

/**
 * The enforcement body named by the BFSG for services.
 *
 * Named, not addressed — and that is what the law asks for. Anlage 3 Nr. 1
 * BFSGV requires the "Angabe der zuständigen Marktüberwachungsbehörde", which
 * is naming it; no provision of the BFSG or the BFSGV asks for a postal
 * address or a case-intake contact.
 *
 * It would also be the wrong thing to guess at. This is the one page whose
 * purpose is to give someone a working route to complain, so a plausible but
 * unverified address would defeat it more thoroughly than no address at all.
 */
const ENFORCEMENT_DE =
  'Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF)';
const ENFORCEMENT_EN =
  'Market Surveillance Authority of the German Federal States for the Accessibility of Products and Services (MLBF)';

/**
 * WHAT ANLAGE 3 NR. 1 BFSGV ACTUALLY ASKS FOR
 *
 * Checked against the legal text rather than assumed, because an earlier
 * version of this file carried the MLBF's postal address as an open item and
 * that was wrong — there is no address requirement anywhere in the BFSG.
 *
 *   1. a general description of the service                    — NOT YET HERE
 *   2. explanations needed to understand how the service works — NOT YET HERE
 *   3. how the accessibility requirements are met              — covered
 *   4. "Angabe der zuständigen Marktüberwachungsbehörde"       — covered
 *
 * Item 4 is satisfied by *naming* the authority. The wording is "Angabe",
 * and the Bundesfachstelle's own guidance reads it the same way; nothing
 * requires a postal address or a case-intake contact. The MLBF is named in
 * the enforcement section, so that item is closed.
 *
 * Items 1 and 2 are genuinely absent, and the reason is structural: this page
 * was modelled on the public-sector statement under Directive (EU) 2016/2102
 * and BITV 2.0, which is a conformance declaration about a website. Anlage 3
 * is a different document — it is about the *service*, and expects it to be
 * described. The two overlap on item 3 and diverge either side of it.
 *
 * That is not fixed here yet because it is a content decision about how the
 * offering is described, and because § 3 Abs. 3 Satz 1 BFSG exempts
 * microenterprises that provide services from the requirements, which is the
 * case here — so nothing is currently in breach. It matters the moment the
 * company outgrows the exemption.
 */
const OPEN_ITEMS = [
  'Anlage 3 Nr. 1 BFSGV items 1 and 2 (a general description of the service, and what a user needs to understand how it works) are not on this page — it follows the public-sector conformance template instead. Not a breach today: § 3 Abs. 3 S. 1 BFSG exempts microenterprise service providers. Add them if the company outgrows the exemption, or sooner if belt-and-braces is wanted.',
];

const CSS_ID = 'vm-a11y-statement-style';

/* Same CI and the same measure as the Impressum, so the two legal pages read
   as one pair rather than two designs. */
const CSS = `<style id="${CSS_ID}">
  .vm-legal{max-width:820px;margin:0 auto;padding:8px 0}
  .vm-legal .vm-legal-intro{
    font-size:17px;line-height:1.7;color:#4b5563;
    padding-bottom:18px;border-bottom:1px solid #e7dfe0;margin:0 0 8px;
  }
  .vm-legal h2{
    font-size:20px !important;font-weight:700;color:#241417;
    margin:38px 0 12px;line-height:1.35;
  }
  .vm-legal h2:first-of-type{margin-top:8px}
  .vm-legal p{margin:0 0 14px;line-height:1.8;color:#4b5563;font-size:16px}
  .vm-legal ul{margin:0 0 14px;padding-left:22px}
  .vm-legal li{line-height:1.8;color:#4b5563;font-size:16px;margin-bottom:6px}
  .vm-legal a{color:#94152b;text-decoration:underline;text-underline-offset:2px}
  .vm-legal a:hover{color:#700f2b}
  .vm-legal .vm-legal-card{
    background:#faf7f7;border:1px solid #e7dfe0;border-left:3px solid #94152b;
    border-radius:10px;padding:18px 20px;margin:0 0 14px;
  }
  .vm-legal .vm-legal-card p{margin:0;line-height:1.85}
  .vm-legal .vm-legal-card strong{color:#241417}
  .vm-legal .vm-status{font-weight:600;color:#241417}
  @media (max-width:1023px){
    /* scripts/mobile-polish.js clamps every h2 to a minimum of 23px below
       1024px with !important. Without a matching !important these headings
       would be larger on a phone than on a desktop. */
    .vm-legal h2{font-size:18px !important;margin-top:30px}
    .vm-legal .vm-legal-card{padding:16px}
  }
</style>`;

const PAGES = [
  {
    dir: 'barrierefreiheit',
    lang: 'de',
    title: 'Erklärung zur Barrierefreiheit',
    description:
      'Erklärung zur Barrierefreiheit nach dem Barrierefreiheitsstärkungsgesetz (BFSG) für virtual-marketer.de — Konformitätsstatus, bekannte Einschränkungen und Kontakt.',
    altHref: '/en/accessibility/',
    body: `
<p class="vm-legal-intro">Die SGS Virtual Marketer GmbH ist bemüht, ihre Website barrierefrei zugänglich zu machen. Diese Erklärung gilt für die Website <strong>virtual-marketer.de</strong> einschließlich aller Unterseiten und der englischsprachigen Fassung unter /en/. Rechtsgrundlage ist das Barrierefreiheitsstärkungsgesetz (BFSG), das seit dem 28. Juni 2025 gilt.</p>

<h2>Stand der Vereinbarkeit mit den Anforderungen</h2>
<p><span class="vm-status">Diese Website ist mit den Anforderungen teilweise vereinbar.</span> Als Maßstab dienen die Web Content Accessibility Guidelines (WCAG) 2.1 auf Konformitätsstufe AA sowie die harmonisierte europäische Norm EN 301 549.</p>
<p>„Teilweise vereinbar“ bedeutet: Die überwiegende Zahl der Anforderungen wird erfüllt, einzelne benannte Punkte jedoch nicht. Diese Punkte sind unten aufgeführt.</p>

<h2>Nicht barrierefreie Inhalte</h2>
<p>Die folgende Einschränkung ist uns bekannt:</p>
<ul>
  <li><strong>Reihenfolge der Überschriftenebenen (WCAG 1.3.1).</strong> Auf den aus dem früheren Content-Management-System übernommenen Seiten wird die kleine Auszeichnungszeile über einer Abschnittsüberschrift technisch als Überschrift sechster Ordnung ausgegeben. Dadurch folgt auf eine Überschrift zweiter Ordnung eine Überschrift sechster Ordnung, und die Ebenen springen. Für die Navigation per Überschriftenliste kann das irritierend sein. Der Inhalt selbst ist vollständig lesbar und mit der Tastatur erreichbar.</li>
</ul>
<p>Der Grund für die noch bestehende Einschränkung: Die Auszeichnungszeile ist inhaltlich keine Überschrift und müsste als Absatz ausgezeichnet werden. Das Layout dieser Altseiten wird jedoch über genau diese Überschriftenebene gestaltet, sodass eine Umstellung die Gestaltung dieser Seiten verändert. Die Umstellung ist vorgesehen; ein verbindliches Datum nennen wir hier bewusst nicht, solange keines feststeht.</p>

<h2>Was bereits umgesetzt ist</h2>
<ul>
  <li>Alle Seiten haben einen Hauptinhaltsbereich als Landmarke und eine eindeutige Hauptüberschrift.</li>
  <li>Bedienelemente, die nur aus einem Symbol bestehen, haben einen für Screenreader lesbaren Namen.</li>
  <li>Links im Fließtext sind zusätzlich zur Farbe unterstrichen, sind also nicht allein durch Farbe erkennbar (WCAG 1.4.1).</li>
  <li>Text erfüllt das Kontrastverhältnis von mindestens 4,5:1 gegenüber seinem Hintergrund, einschließlich der Beschriftung auf farbigen Schaltflächen (WCAG 1.4.3).</li>
  <li>Die Seiten sind responsiv und ohne horizontales Scrollen bis zu einer Breite von 320 Pixeln nutzbar.</li>
  <li>Die Website lädt keine externen Schriftarten, Skripte oder Tracker, die die Bedienung verzögern oder blockieren könnten.</li>
</ul>

<h2>Erstellung dieser Erklärung</h2>
<p>Diese Erklärung wurde am 6. August 2026 erstellt. Grundlage ist eine Selbstbewertung: eine automatisierte Prüfung aller Seiten der Website auf Kontrastverhältnisse, Überschriftenstruktur, Landmarken und zugängliche Namen von Bedienelementen, ergänzt durch manuelle Prüfungen im Browser auf Desktop- und Mobilgrößen. Eine Prüfung durch eine externe Stelle hat nicht stattgefunden.</p>

<h2>Barriere melden</h2>
<div class="vm-legal-card">
  <p>Ist Ihnen eine Barriere aufgefallen, oder benötigen Sie eine Information von dieser Website in einer zugänglichen Form? Schreiben Sie uns an <a href="mailto:${CONTACT_MAIL}?subject=Barrierefreiheit">${CONTACT_MAIL}</a>. Bitte nennen Sie die betroffene Seite und beschreiben Sie kurz, was nicht funktioniert hat. Wir antworten so schnell wie möglich und stellen den Inhalt auf Wunsch in einer anderen Form bereit.</p>
</div>
<p>Kontaktmöglichkeiten und die vollständigen Angaben zum Anbieter finden Sie im <a href="/impressum/">Impressum</a>.</p>

<h2>Durchsetzungsverfahren</h2>
<p>Wenn Sie auf Ihre Meldung keine zufriedenstellende Antwort erhalten, können Sie sich an die zuständige Marktüberwachungsbehörde wenden: die ${ENFORCEMENT_DE}. Sie überwacht die Einhaltung der Anforderungen des BFSG für Dienstleistungen und nimmt entsprechende Hinweise von Verbraucherinnen und Verbrauchern entgegen.</p>
`,
  },
  {
    dir: 'en/accessibility',
    lang: 'en',
    title: 'Accessibility Statement',
    description:
      'Accessibility statement under the German Accessibility Strengthening Act (BFSG) for virtual-marketer.de — conformance status, known limitations and how to report a barrier.',
    altHref: '/barrierefreiheit/',
    body: `
<p class="vm-legal-intro">SGS Virtual Marketer GmbH is committed to making its website accessible. This statement applies to <strong>virtual-marketer.de</strong>, including all sub-pages and the English version at /en/. It is made under the German Accessibility Strengthening Act (Barrierefreiheitsstärkungsgesetz, BFSG), which has applied since 28 June 2025.</p>

<h2>Conformance status</h2>
<p><span class="vm-status">This website is partially conformant.</span> The benchmark is the Web Content Accessibility Guidelines (WCAG) 2.1 at conformance level AA, together with the harmonised European standard EN 301 549.</p>
<p>"Partially conformant" means that the large majority of requirements are met, but that specific, named points are not. Those points are listed below.</p>

<h2>Non-accessible content</h2>
<p>We are aware of the following limitation:</p>
<ul>
  <li><strong>Heading level order (WCAG 1.3.1).</strong> On pages carried over from the previous content management system, the small label above a section heading is marked up as a sixth-level heading. A second-level heading is therefore followed by a sixth-level heading, and the levels jump. This can be confusing when navigating by heading list. The content itself is fully readable and reachable by keyboard.</li>
</ul>
<p>The reason it is still there: the label is not a heading in substance and should be marked up as a paragraph. The layout of these legacy pages, however, is styled through that very heading level, so changing it changes how those pages look. The change is planned; we deliberately do not state a date here while none has been fixed.</p>

<h2>What is already in place</h2>
<ul>
  <li>Every page has a main landmark and one unambiguous top-level heading.</li>
  <li>Controls consisting only of an icon carry a name that a screen reader can announce.</li>
  <li>Links in running text are underlined as well as coloured, so they are not identified by colour alone (WCAG 1.4.1).</li>
  <li>Text meets a contrast ratio of at least 4.5:1 against its background, including labels on coloured buttons (WCAG 1.4.3).</li>
  <li>Pages are responsive and usable without horizontal scrolling down to a width of 320 pixels.</li>
  <li>The site loads no external fonts, scripts or trackers that could delay or block interaction.</li>
</ul>

<h2>How this statement was prepared</h2>
<p>This statement was prepared on 6 August 2026. It is based on a self-assessment: an automated check of every page on the site for contrast ratios, heading structure, landmarks and accessible names of controls, supplemented by manual checks in the browser at desktop and mobile sizes. No external body has audited the site.</p>

<h2>Reporting a barrier</h2>
<div class="vm-legal-card">
  <p>Have you found a barrier, or do you need information from this website in an accessible form? Write to us at <a href="mailto:${CONTACT_MAIL}?subject=Accessibility">${CONTACT_MAIL}</a>. Please name the page concerned and describe briefly what did not work. We will reply as quickly as we can and will provide the content in another form on request.</p>
</div>
<p>Full provider details and further contact options are in the <a href="/en/legal-notice/">Legal Notice</a>.</p>

<h2>Enforcement procedure</h2>
<p>If you do not receive a satisfactory response to your report, you can contact the competent market surveillance authority: the ${ENFORCEMENT_EN}. It supervises compliance with the BFSG requirements for services and accepts reports from consumers.</p>
`,
  },
];

/**
 * Reuses the chrome the other generated pages use, so this page is not an
 * island with its own nav. generate-feature-pages.js guards its own main()
 * behind require.main, so importing it here builds nothing.
 */
const { header, footer, CHROME_CSS } = require('./generate-feature-pages');

function pageShell(page) {
  return `<!DOCTYPE html>
<html lang="${page.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title} | Virtual Marketer</title>
<meta name="description" content="${page.description}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://virtual-marketer.de/${page.dir}/">
<link rel="alternate" hreflang="de" href="https://virtual-marketer.de${page.lang === 'de' ? `/${page.dir}/` : page.altHref}">
<link rel="alternate" hreflang="en" href="https://virtual-marketer.de${page.lang === 'en' ? `/${page.dir}/` : page.altHref}">
<link rel="alternate" hreflang="x-default" href="https://virtual-marketer.de${page.lang === 'de' ? `/${page.dir}/` : page.altHref}">
<style>
  body{margin:0;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#241417;background:#fff}
  .vm-legal-page{max-width:1140px;margin:0 auto;padding:40px 20px 72px}
  .vm-legal-page h1{font-size:32px;line-height:1.25;margin:0 0 6px;color:#241417}
  .vm-legal-page .eyebrow{display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94152b;background:#fbecee;padding:5px 12px;border-radius:999px;margin-bottom:14px}
  @media (max-width:1023px){.vm-legal-page h1{font-size:26px}}
</style>
${CSS}
<style>${CHROME_CSS}</style>
</head>
<body class="vm-static-blog">
${header(page.lang)}
<main class="vm-legal-page">
  <span class="eyebrow">${page.lang === 'de' ? 'Barrierefreiheit' : 'Accessibility'}</span>
  <h1>${page.title}</h1>
  <div class="vm-legal">
${page.body}
  </div>
</main>
${footer(page.lang)}
</body>
</html>`;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/**
 * The legacy pages carry the WordPress theme's own footer, which the
 * generated-page footer above does not touch. A statement nobody can find
 * from the pages it describes is not much of a statement, so the link is
 * added next to the Impressum link that is already in that footer — the
 * place a reader looks for it.
 */
function linkFromLegacyFooters() {
  let added = 0;
  for (const file of findHtmlFiles(DIST)) {
    const rel = path.relative(DIST, file).split(path.sep).join('/');
    // The generated pages already have it from footer(); skip the two
    // statement pages themselves so neither links to itself.
    if (rel.startsWith('barrierefreiheit/') || rel.startsWith('en/accessibility/')) continue;

    const html = fs.readFileSync(file, 'utf-8');
    if (/href=["'][^"']*\/(barrierefreiheit|en\/accessibility)\//.test(html)) continue;

    const isEn = /^en\//.test(rel);
    const target = isEn ? '/en/accessibility/' : '/barrierefreiheit/';
    const label = isEn ? 'Accessibility' : 'Barrierefreiheit';

    // Anchored on the existing Impressum / Legal Notice link in the footer.
    const linkRe = isEn
      ? /(<a\b[^>]*href=["'][^"']*\/en\/legal-notice\/["'][^>]*>[^<]*<\/a>)/i
      : /(<a\b[^>]*href=["'][^"']*\/impressum\/["'][^>]*>[^<]*<\/a>)/i;
    if (!linkRe.test(html)) continue;

    let done = false;
    const next = html.replace(linkRe, (whole) => {
      if (done) return whole;
      done = true;
      return `${whole} <a href="${target}">${label}</a>`;
    });
    if (next !== html) {
      fs.writeFileSync(file, next);
      added++;
    }
  }
  return added;
}

function main() {
  console.log('\n♿ Generating the accessibility statement (BFSG)...\n');

  for (const page of PAGES) {
    const dir = path.join(DIST, ...page.dir.split('/'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), pageShell(page));
    console.log(`   ✓ /${page.dir}/`);
  }

  console.log(`   • ${linkFromLegacyFooters()} legacy page footer(s) now link the statement`);

  // The statement's own claims must be present, and its conformance status
  // must not silently become an overclaim.
  let failed = false;
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(DIST, ...page.dir.split('/'), 'index.html'), 'utf-8');
    const needs = page.lang === 'de'
      ? ['teilweise vereinbar', 'WCAG', 'EN 301 549', 'Durchsetzungsverfahren', CONTACT_MAIL]
      : ['partially conformant', 'WCAG', 'EN 301 549', 'Enforcement procedure', CONTACT_MAIL];
    for (const n of needs) {
      if (!html.includes(n)) {
        console.log(`   ✗ /${page.dir}/ is missing: ${n}`);
        failed = true;
      }
    }
    if (/vollständig (vereinbar|konform)|fully conformant/i.test(html)) {
      console.log(`   ✗ /${page.dir}/ claims full conformance — the heading-order gap is still open`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log('   ✓ both statements carry a status, a standard, a gap, a contact and an enforcement route');

  console.log('\n   Open items for the client:');
  OPEN_ITEMS.forEach((o) => console.log(`     • ${o}`));
  console.log('');
}

main();
