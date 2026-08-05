#!/usr/bin/env node

/**
 * Broken Widget / Dead Embed Cleanup
 *
 * Findings from a full-site audit (broken-embeds, security, and
 * link-integrity passes) that don't belong in fix-broken-links.js (that
 * script is scoped to dead hrefs; these are dead/insecure *widgets* and
 * WordPress-scrape debris `<link>` tags):
 *
 * 1. Homepage hero iframe pointed at https://sales-agent.virtual-marketer.de/
 *    — confirmed live as a DANGLING CNAME (CNAME -> ghs.googlehosted.com,
 *    unclaimed, returns Google's generic 404). Anyone who registers a
 *    Google Cloud/Firebase project and verifies that custom domain could
 *    serve arbitrary content inside this iframe on every visitor's
 *    homepage — a real subdomain-takeover exposure, not just a cosmetic
 *    broken box. Removed entirely (not sandboxed — there is no legitimate
 *    service behind it today).
 * 2. /virtual-marketer-demo/'s WordPress "wpcal" booking-calendar widget
 *    never resolves past its loading spinner: its AJAX config points at
 *    https://virtual-marketer.de/wp-admin/admin-ajax.php, a WordPress admin
 *    backend that doesn't exist on this static site. Replaced with a real
 *    booking widget (see scripts/inject-booking-widget.js) once the backend
 *    ships; until then, or as a fallback if that script hasn't run, this
 *    file removes the dead spinner/scripts so visitors don't wait on
 *    something that will never load.
 * 3. Blog comment forms (44 pages) post to /wp-comments-post.php, a PHP
 *    handler that doesn't exist on a static site (confirmed live 405).
 *    Neutralized in place — same minimal-attribute-only approach already
 *    used for the "Simple Likes" buttons in fix-broken-links.js — rather
 *    than restructuring the surrounding (imperfectly-nested) legacy HTML.
 * 4. WordPress search widgets (68 pages) submit to a relative
 *    "../index.html" which silently ignores the query and just re-renders
 *    the homepage — always "succeeds", never searches anything. Hidden
 *    (not removed) since some pages rely on it for layout spacing.
 * 5. WordPress scrape debris `<link>` tags (pingback/xmlrpc, RSS feed
 *    autodiscovery, wp-json oembed) on pages fix-broken-links.js doesn't
 *    reach — all point at endpoints that don't exist on the static site.
 * 6. dist/faqs/index.html has a live, visible gradient section still using
 *    the retired purple/cyan palette (#00DEFF/#7141B1) via a scraped
 *    Elementor per-post CSS file — overridden here rather than hand-edited
 *    (that CSS file is WordPress-scrape output, not something to hand-tune)
 *    with the real vm-blue/vm-red gradient.
 * 7. One stray theme-demo link (`http://localhost/engitech/contacts/`) on
 *    /faqs/ — leftover from the "Engitech" WordPress theme's own demo
 *    content, unreachable from any real browser. Repointed to the site's
 *    standard mailto contact address.
 * 8. ~190 internal `http://virtual-marketer.de/...` references (self-hosted
 *    logo image + a couple of link tags) upgraded to https — the site is
 *    HTTPS-only, plain-http internal links/assets are stray scrape debris.
 * 9. dist/index.html loads 2 font stylesheets and the header logo via an
 *    ABSOLUTE `https://virtual-marketer.de/wp-content/...` URL instead of a
 *    relative path (every other page already uses relative paths for the
 *    same files). Same-domain in real production, so it "works" there by
 *    accident — but it means these specific requests are never actually
 *    self-hosted from wherever the page is being served (fails in local
 *    dev, in a not-yet-DNS-pointed staging environment, offline, etc.), and
 *    defeats the whole point of self-hosting these assets. Rewritten to
 *    relative paths, matching every other page.
 * 10. Yoast's auto-generated Organization JSON-LD on every legacy page
 *    points its `logo.url`/`logo.contentUrl` at a stale, non-existent path
 *    (`http:\/\/virtual-marketer.de\/wp-content\/uploads\/2022\/11\/VM-Logo-bunt-2-2.png`
 *    — that `2022/11` directory doesn't exist anywhere in dist/, and it's
 *    plain http:// besides). This escaped-slash JSON string form wasn't
 *    caught by finding #8's plain http:// upgrade (which looks for literal
 *    `/` characters, not `\/`). Repointed at the real, current, self-hosted
 *    logo used everywhere else on the site.
 * 11. dist/faqs/index.html carries three sibling widgets of completely
 *    unedited "Engitech" WordPress theme demo content, unique to this one
 *    page: a "// support center" heading, a 3-column "support box" section
 *    with broken images hotlinked from the theme vendor's own S3 bucket
 *    (engitech.s3.amazonaws.com) and generic non-Virtual-Marketer copy
 *    ("Entrust full-cycle implementation of your software product..."),
 *    and a fake "client logos" carousel whose images link out to the
 *    theme's own author page on ThemeForest. None of this is real Virtual
 *    Marketer content — removed entirely rather than invented a
 *    replacement, using a small stack-based tag matcher (findElement()
 *    below) since these three elements are deeply nested inside other
 *    legitimate page structure and a naive line-range delete would have
 *    corrupted the surrounding HTML.
 *
 * Run after scripts/fix-broken-links.js, before scripts/generate-404.js.
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

// Finds the full outer span [start, end) of the nearest ancestor
// <tagName> of the first occurrence of `needle`, by walking forward and
// tracking open/close depth of that same tag name until it returns to 0.
// Used for removing specific widgets that are siblings deep inside
// otherwise-legitimate nested markup, where a naive line/string range
// would risk deleting someone else's closing tag.
function findElement(html, needle, tagName) {
  const needleIdx = html.indexOf(needle);
  if (needleIdx === -1) return null;
  const tagStart = html.lastIndexOf(`<${tagName}`, needleIdx);
  if (tagStart === -1) return null;
  const openRe = new RegExp(`<${tagName}(?:\\s|>)`, 'g');
  const closeRe = new RegExp(`</${tagName}>`, 'g');
  let depth = 0;
  let pos = tagStart;
  for (let guard = 0; guard < 100000; guard++) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const om = openRe.exec(html);
    const cm = closeRe.exec(html);
    if (!cm) return null; // unbalanced — caller must not blindly trust a null-check-free result
    if (om && om.index < cm.index) {
      depth++;
      pos = om.index + om[0].length;
    } else {
      depth--;
      pos = cm.index + cm[0].length;
      if (depth === 0) return { start: tagStart, end: pos };
    }
  }
  return null; // guard tripped — pathological input, bail rather than loop forever
}

// The homepage hero used to embed a sales-agent iframe from a subdomain that
// no longer resolves. It was first replaced with a "trust panel" of bullet
// points, but that box was not wanted — it competed with the hero headline and
// left the page looking like two unrelated halves. The iframe is now simply
// removed and the hero's right-hand column with it, so the headline gets the
// full width it was designed for (see collapseHeroColumns below).
const HERO_RIGHT_COLUMN_ID = '4af6b60b';  // Elementor inner column that held the iframe
const HERO_LEFT_COLUMN_ID = '75ecdf67';   // its sibling, holding the headline + CTA

/**
 * Removes an element and everything nested inside it by counting opening and
 * closing tags, so the whole column goes rather than stopping at the first
 * </div> several levels too early.
 */
function removeBalancedDiv(html, openRe) {
  const start = html.search(openRe);
  if (start === -1) return html;
  const scan = /<div\b|<\/div>/gi;
  scan.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = scan.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + html.slice(m.index + m[0].length);
  }
  return html; // unbalanced markup — leave it alone rather than truncate the page
}

// Removing the sibling column is not enough on its own: Elementor writes a
// hard per-element width into wp-content/uploads/elementor/css/post-5668.css
// (`.elementor-element-75ecdf67 { width: 41.581% }` above 768px), which keeps
// the headline in a ~500px gutter with the other half of the row left blank.
// The class swap to elementor-col-100 loses to that rule on specificity, so
// the width is overridden explicitly. !important rather than a longer
// selector because the generated file is regenerated by Elementor and its
// selector shape is not ours to depend on.
const HERO_FULL_WIDTH_CSS = `<style id="vm-hero-fullwidth">
  @media (min-width:768px){
    .elementor-5668 .elementor-element.elementor-element-75ecdf67{width:100%!important;}
  }
</style>`;

/** Drops the emptied hero column and widens its sibling to the full row. */
function collapseHeroColumns(html) {
  const before = html;
  html = removeBalancedDiv(
    html,
    new RegExp(`<div class="elementor-column elementor-col-50 elementor-inner-column[^"]*elementor-element-${HERO_RIGHT_COLUMN_ID}[^"]*"`)
  );
  if (html === before) return html;
  html = html.replace(
    new RegExp(`(<div class="elementor-column )elementor-col-50( elementor-inner-column[^"]*elementor-element-${HERO_LEFT_COLUMN_ID})`),
    '$1elementor-col-100$2'
  );
  const headEnd = html.search(/<\/head>/i);
  if (headEnd !== -1 && !html.includes('id="vm-hero-fullwidth"')) {
    html = html.slice(0, headEnd) + HERO_FULL_WIDTH_CSS + '\n' + html.slice(headEnd);
  }
  return html;
}

// Real FAQ content for /faqs/, replacing 10 items of unedited Engitech
// theme demo Q&A (generic web-agency/SEO-consultant questions, several
// answers literally identical "Google has said for years that the most
// important single factor..." filler text). These 10 answers only state
// facts already established and verified elsewhere in this project: no
// fixed/published pricing (see the "individuelles Angebot" homepage copy),
// the data-residency policy (see datenschutzerklaerung), the real count and
// nature of the 16 solutions (see dist/ki-loesungen/), the real booking
// widget's actual hours, and the real contact channels (contact form +
// email — no phone number is published anywhere on the real site, so none
// is invented here either). Onboarding duration and price are deliberately
// left non-specific ("depends on scope, discussed in the demo") rather
// than inventing numbers that were never provided.
const REAL_FAQS = [
  { q: 'Passt Virtual Marketer zu meinem Unternehmen?', a: 'Virtual Marketer eignet sich für Unternehmen jeder Größe, die Marketing-Prozesse mit KI automatisieren möchten – von der Produktbeschreibung bis zur Kampagnensteuerung. In einem unverbindlichen Demo-Gespräch prüfen wir gemeinsam, welche unserer Lösungen zu Ihren Zielen und Ihrer Datenbasis passen.' },
  { q: 'Wie lange dauert das Onboarding?', a: 'Die Onboarding-Dauer hängt vom Umfang ab – von einzelnen Lösungen bis zur vollständigen Integration in Ihre bestehenden Systeme. Den konkreten Zeitplan für Ihr Unternehmen besprechen wir im Erstgespräch nach der Demo.' },
  { q: 'Was kostet Virtual Marketer?', a: 'Wir bieten keine Standardpakete zu Festpreisen, sondern erstellen für jedes Unternehmen ein individuelles Angebot – abhängig von den gewählten Lösungen, dem Datenvolumen und dem Integrationsaufwand.' },
  { q: 'Welche KI-Lösungen bietet Virtual Marketer an?', a: 'Aktuell 16 Lösungen entlang der gesamten Marketing-Wertschöpfungskette – u. a. KI-Agenten, Coding-API, Produktfotos &amp; Virtual Try-On, Feed-Veredelung sowie Text-, Bild- und Videogenerierung. Alle Lösungen im Überblick finden Sie unter „Lösungen" in der Navigation.' },
  { q: 'Was ist ein Custom-KI-Modell und wie unterscheidet es sich von einem generischen Chatbot?', a: 'Statt eines generischen KI-Modells trainieren wir ein individuelles Modell auf Ihre Markenstimme, Ihre Produktdaten und Ihre Tonalität – kein Prompt-Wrapper, sondern ein System, das Ihr Unternehmen tatsächlich versteht.' },
  { q: 'Wo werden meine Daten gespeichert und verarbeitet?', a: 'Der genaue Speicherort wird individuell vertraglich festgelegt. Auf Wunsch verarbeiten wir Ihre Daten ausschließlich in Deutschland oder anderen EU-Rechenzentren; ohne gesonderte Vereinbarung wählen wir einen kosteneffizienten Standort. Details finden Sie in unserer Datenschutzerklärung.' },
  { q: 'Ist Virtual Marketer DSGVO-konform?', a: 'Ja. Wir verarbeiten personenbezogene Daten ausschließlich auf Basis der DSGVO und des EU AI Act, mit vertraglich geregelten Auftragsverarbeitern. Details, inklusive der eingesetzten Unterauftragsverarbeiter, finden Sie in unserer Datenschutzerklärung.' },
  { q: 'Wie kann ich eine Demo buchen?', a: 'Über unseren Buchungskalender wählen Sie direkt einen freien Termin (Montag bis Freitag, 14:00–20:00 Uhr) – die Bestätigung erfolgt per E-Mail-Link. Alternativ erreichen Sie uns über unser Kontaktformular oder per E-Mail.' },
  { q: 'Bietet Virtual Marketer eine API für Entwickler?', a: 'Ja, unsere Coding-API bindet Virtual Marketer Senior und Virtual Marketer Junior direkt in Ihre bestehenden Entwicklungsprozesse ein – mit einem einheitlichen Guthabenmodell statt komplexer Tarifstruktur.' },
  { q: 'Wie erreiche ich den Kundensupport?', a: 'Am schnellsten über unser Kontaktformular oder per E-Mail an info@virtual-marketer.de. Wir melden uns zeitnah zurück.' },
];

function main() {
  console.log('\n🧹 Cleaning up broken/dead widgets and scrape debris...\n');

  const files = findHtmlFiles(DIST);
  let salesAgentRemoved = 0;
  let commentFormsDisabled = 0;
  let searchWidgetsHidden = 0;
  let pingbackStripped = 0;
  let feedLinksStripped = 0;
  let oembedStripped = 0;
  let wpJsonDiscoveryStripped = 0;
  let strayLinkFixed = 0;
  let faqsGradientFixed = 0;
  let httpUpgraded = 0;
  let absoluteAssetUrlsFixed = 0;
  let staleLogoJsonLdFixed = 0;
  let faqsThemeDemoRemoved = 0;
  let faqsRealContentApplied = 0;
  let filesChanged = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf-8');
    const before = html;

    // 1. Sales-agent iframe (homepage only, one occurrence)
    const beforeHero = html;
    html = html.replace(
      /<iframe\s+src="https:\/\/sales-agent\.virtual-marketer\.de\/"[\s\S]*?<\/iframe>/,
      () => { salesAgentRemoved++; return ''; }
    );
    if (html !== beforeHero) html = collapseHeroColumns(html);

    // 3. Blog comment forms -> neutralize the POST target, keep the markup
    html = html.replace(
      /<form action="https:\/\/virtual-marketer\.de\/wp-comments-post\.php" method="post" id="commentform" class="comment-form">/g,
      () => {
        commentFormsDisabled++;
        return '<form action="javascript:void(0)" method="post" id="commentform" class="comment-form" onsubmit="return false" aria-disabled="true">';
      }
    );

    // 4. WordPress search widgets -> hide (they don't search anything)
    html = html.replace(
      /<form role="search" method="get" class="search-form" action="\.\.\/index\.html" >/g,
      () => { searchWidgetsHidden++; return '<form role="search" method="get" class="search-form" action="javascript:void(0)" onsubmit="return false" style="display:none" aria-hidden="true">'; }
    );

    // 5. WP scrape-debris <link> tags
    html = html.replace(/<link rel="pingback" href="https:\/\/virtual-marketer\.de\/xmlrpc\.php">\s*/g, () => { pingbackStripped++; return ''; });
    html = html.replace(/<link rel="alternate" type="application\/rss\+xml" title="Virtual Marketer[^"]*" href="https:\/\/virtual-marketer\.de\/(?:feed|comments\/feed)\/" \/>\s*/g, () => { feedLinksStripped++; return ''; });
    html = html.replace(/<link rel="alternate" title="oEmbed \(XML\)" type="text\/xml\+oembed" href="https:\/\/virtual-marketer\.de\/wp-json\/oembed\/1\.0\/embed[^"]*" \/>\s*/g, () => { oembedStripped++; return ''; });
    html = html.replace(/<link rel="https:\/\/api\.w\.org\/" href="https:\/\/virtual-marketer\.de\/wp-json\/" \/>\s*/g, () => { wpJsonDiscoveryStripped++; return ''; });

    // 6. Retired purple/cyan gradient still live on /faqs/ — the legacy DE
    // page specifically (dist/faqs/index.html), not dist/en/faqs/index.html
    // (a clean self-generated page that never had this issue).
    if (file === path.join(DIST, 'faqs', 'index.html') && html.includes('</head>')) {
      const override = '<style>.elementor-1390 .elementor-element.elementor-element-52e7c11{background-image:linear-gradient(80deg,var(--vm-blue,#66a3ce) 0%,var(--vm-red,#94152b) 100%) !important;}</style>\n</head>';
      if (!html.includes('elementor-element-52e7c11{background-image:linear-gradient(80deg,var(--vm-blue')) {
        html = html.replace('</head>', override);
        faqsGradientFixed++;
      }
    }

    // 7. Stray dead theme-demo link
    html = html.replace(/href="http:\/\/localhost\/engitech\/contacts\/"/g, () => { strayLinkFixed++; return 'href="mailto:info@virtual-marketer.de"'; });

    // 8. Internal http:// -> https://
    const httpMatches = html.match(/http:\/\/virtual-marketer\.de\//g);
    if (httpMatches) {
      httpUpgraded += httpMatches.length;
      html = html.replace(/http:\/\/virtual-marketer\.de\//g, 'https://virtual-marketer.de/');
    }

    // 9. Absolute same-domain asset URLs -> relative (self-hosting only
    // actually holds if the browser fetches these from wherever THIS page
    // is served, not by hardcoding the production hostname). Also resolves
    // the real on-disk filename if the naive relative path doesn't exist:
    // these 2 links were missing their `?ver=...` suffix entirely, which
    // wget's scrape bakes into the literal on-disk filename (the same class
    // of bug fixed elsewhere in this project via resolveThemeAsset()/the
    // %3F-encoding convention — see generate-en-pages.js's comment on it).
    html = html.replace(/https:\/\/virtual-marketer\.de(\/wp-content\/[^"'\s]*)/g, (match, relPath) => {
      absoluteAssetUrlsFixed++;
      const onDisk = path.join(DIST, relPath);
      if (fs.existsSync(onDisk)) return relPath;
      const dir = path.dirname(onDisk);
      const base = path.basename(relPath);
      if (!fs.existsSync(dir)) return relPath;
      const real = fs.readdirSync(dir).find((f) => f.startsWith(`${base}?`));
      if (!real) return relPath; // no better match found — leave as-is rather than guess
      return path.dirname(relPath) + '/' + real.replace(/\?/g, '%3F');
    });

    // 10. Stale/broken logo URL in Yoast's escaped-JSON-LD Organization schema
    const staleLogoMatches = html.match(/http:\\\/\\\/virtual-marketer\.de\\\/wp-content\\\/uploads\\\/2022\\\/11\\\/VM-Logo-bunt-2-2\.png/g);
    if (staleLogoMatches) {
      staleLogoJsonLdFixed += staleLogoMatches.length;
      html = html.replace(
        /http:\\\/\\\/virtual-marketer\.de\\\/wp-content\\\/uploads\\\/2022\\\/11\\\/VM-Logo-bunt-2-2\.png/g,
        'https:\\/\\/virtual-marketer.de\\/wp-content\\/uploads\\/2023\\/04\\/cropped-Virtual-Marketer-Logo-128x128-New.png'
      );
    }

    // 11b. Same broken-image family as #11 also leaked into /faqs/'s Yoast
    // JSON-LD (thumbnailUrl / primaryImage ImageObject), independent of the
    // <img> tags removed by #11 — fixed regardless of whether #11's element
    // match succeeds, since this is a separate string, not nested inside it.
    const staleThumbMatches = html.match(/https:\\\/\\\/engitech\.s3\.amazonaws\.com\\\/images\\\/support1\.jpg/g);
    if (staleThumbMatches) {
      staleLogoJsonLdFixed += staleThumbMatches.length;
      html = html.replace(
        /https:\\\/\\\/engitech\.s3\.amazonaws\.com\\\/images\\\/support1\.jpg/g,
        'https:\\/\\/virtual-marketer.de\\/wp-content\\/uploads\\/2023\\/04\\/cropped-Virtual-Marketer-Logo-128x128-New.png'
      );
    }

    // 11. /faqs/ only: three sibling widgets of unedited Engitech theme
    // demo content (see header comment for what each one is).
    if (file === path.join(DIST, 'faqs', 'index.html')) {
      const heading = findElement(html, 'elementor-element-adf2a06', 'div');
      const supportSection = findElement(html, 'elementor-element-36b4f39', 'section');
      const carousel = findElement(html, 'elementor-element-efb4aef', 'div');
      if (heading && supportSection && carousel && heading.start < supportSection.start && supportSection.start < carousel.start) {
        // Remove as one contiguous span (heading start -> carousel end) —
        // verified these three are contiguous siblings separated only by
        // whitespace, so this can't clip into unrelated surrounding markup.
        html = html.slice(0, heading.start) + html.slice(carousel.end);
        faqsThemeDemoRemoved++;
      }

      // 12. The 10 accordion Q&As themselves are also unedited theme demo
      // content (generic web-agency/SEO questions, several answers are
      // literally identical filler text) — replace with REAL_FAQS above,
      // in document order, preserving the exact wrapper markup so the
      // existing accordion CSS/JS keeps working unchanged.
      let faqIdx = 0;
      const accItemRe = /<div class="acc-item">\s*<span class="acc-toggle" data-default="(yes)?">[^<]*?\s*<i class="down[^>]*><\/i><i class="up[^>]*><\/i><\/span>\s*<div class="acc-content">\s*(?:<p>)?.*?(?:<\/p>)?\s*<\/div>\s*<\/div>/gs;
      const newHtml = html.replace(accItemRe, (match, isDefault) => {
        if (faqIdx >= REAL_FAQS.length) return match; // more matches than real content — leave extras untouched rather than guess
        const { q, a } = REAL_FAQS[faqIdx++];
        faqsRealContentApplied++;
        return `<div class="acc-item">\n\t\t\t\t<span class="acc-toggle" data-default="${isDefault || ''}">${q} <i class="down flaticon-download-arrow"></i><i class="up flaticon-up-arrow"></i></span>\n\t\t\t\t<div class="acc-content">\n\t\t\t\t\t<p>${a}</p>\t\t\t\t</div>\n\t\t\t</div>`;
      });
      if (faqIdx === REAL_FAQS.length) html = newHtml; // only commit if we replaced exactly the expected count — a partial match means the page structure shifted and blind replacement could be wrong
    }

    if (html !== before) {
      fs.writeFileSync(file, html);
      filesChanged++;
    }
  }

  console.log(`  ✓ Removed dangling-CNAME sales-agent iframe: ${salesAgentRemoved} occurrence(s)`);
  console.log(`  ✓ Disabled dead blog comment-form POST target on ${commentFormsDisabled} page(s)`);
  console.log(`  ✓ Hidden non-functional search widget on ${searchWidgetsHidden} page(s)`);
  console.log(`  ✓ Stripped pingback/feed/oembed/wp-json scrape debris: ${pingbackStripped + feedLinksStripped + oembedStripped + wpJsonDiscoveryStripped} link(s)`);
  console.log(`  ✓ Fixed stray dead theme-demo link: ${strayLinkFixed} occurrence(s)`);
  console.log(`  ✓ Overrode retired purple/cyan gradient on /faqs/: ${faqsGradientFixed} page(s)`);
  console.log(`  ✓ Upgraded internal http:// -> https://: ${httpUpgraded} occurrence(s)`);
  console.log(`  ✓ Rewrote absolute same-domain asset URLs to relative: ${absoluteAssetUrlsFixed} occurrence(s)`);
  console.log(`  ✓ Fixed stale/broken logo URL in Organization JSON-LD: ${staleLogoJsonLdFixed} occurrence(s)`);
  console.log(`  ✓ Removed unedited Engitech theme demo content from /faqs/: ${faqsThemeDemoRemoved} page(s)`);
  console.log(`  ✓ Replaced unedited FAQ questions/answers with real content: ${faqsRealContentApplied} item(s)`);
  console.log(`  ✓ ${filesChanged} file(s) changed\n`);
}

main();
