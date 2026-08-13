#!/usr/bin/env node

/**
 * Builds /en/ as a translation of /, rather than as a second page.
 *
 * THE PROBLEM
 *
 * The two homepages had nothing to do with each other. The German one is the
 * real homepage — 41 KB, the hero, the industries strip, the use-case grid,
 * the four pillars, the "next steps" flow and the FAQ. The English one was a
 * 5 KB hand-written stub with different sections, different headings and a
 * different design, written when the English site was first stood up.
 *
 * A visitor who switched language did not get the same page in English; they
 * got a different, smaller company.
 *
 * WHY MIRROR INSTEAD OF WRITING A SECOND PAGE
 *
 * Because a second page drifts, and this one already had. Every change to the
 * German homepage — the CLS fix, the sticky header, the contrast pass, the
 * icon-font inlining — would need doing twice and would silently be done
 * once. Translating the built German page means the English page is the same
 * markup, the same CSS, the same fixes, by construction.
 *
 * It runs late, immediately before scripts/seo-optimize.js, so the German
 * page it copies has already been through every transform in the pipeline.
 * The head is then repointed at the English URLs and seo-optimize writes the
 * canonical and hreflang from its own map.
 *
 * ON THE TRANSLATION TABLE
 *
 * Longest-first replacement, and every entry is a whole visible string rather
 * than a word. Word-level substitution on German would wreck compounds and
 * would hit text inside attributes and class names; matching whole strings
 * that actually appear in the page is blunt but cannot corrupt the markup.
 *
 * Anything not in the table stays German and is reported at the end of the
 * run, so a new German section shows up as an untranslated string rather than
 * silently shipping.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/**
 * German path → English path, for every link on the homepage.
 *
 * The 16 solution pages are pulled from the feature registry rather than
 * listed here. A hand-kept copy of that list is exactly what went wrong in
 * inject-language-switcher.js, whose map still stops at 11 of the 16 — five
 * features were added after it was written and nobody went back. Deriving it
 * means a seventeenth feature is handled the day it is added.
 */
const { FEATURES } = require('./generate-feature-pages');
const { SOLUTIONS, SOLUTIONS_EN } = require('./fix-navigation');

const LINKS = {
  ...Object.fromEntries(
    FEATURES.map((f) => [`/ki-loesungen/${f.slug}/`, `/en/solutions/${f.slugEn}/`])
  ),
  '/ki-loesungen/': '/en/solutions/',
  '/blog/': '/en/blog/',
  '/modell-anfragen/': '/en/request-custom-model/',
  '/kontakt/': '/en/contact/',
  '/virtual-marketer-demo/': '/en/demo/',
  '/management/': '/en/about/',
  '/faqs/': '/en/faqs/',
  '/impressum/': '/en/legal-notice/',
  '/datenschutzerklaerung/': '/en/privacy-policy/',
  '/nutzungsbedingungen/': '/en/terms-of-service/',
  '/barrierefreiheit/': '/en/accessibility/',
  '/virtual-marketer-ai-services/': '/en/solutions/',
};

/**
 * Visible German strings → English. Applied longest-first so that a string
 * which contains another is translated before its own substring is.
 */
const COPY = {
  // Hero
  'Verlässlich. Automatisiert. Effizient.': 'Reliable. Automated. Efficient.',
  'Die KI-Marketinglösung aus Deutschland.': 'The AI marketing solution built in Germany.',
  'Demo buchen': 'Book a demo',

  // Industries
  'Angepasste Lösungen': 'Tailored solutions',
  'für jede Branche': 'for every industry',
  'Universitäten': 'Universities',

  // Use cases
  // These two are the second line of a two-part heading whose first line is
  // 'Virtual Marketer', so they have to read as a continuation of it.
  'Einsatzgebiete': 'in action',
  'Produktbeschreibungen': 'Product descriptions',
  'Blog Beiträge': 'Blog posts',
  'Kategorietexte (SEO)': 'Category copy (SEO)',
  'Kaufberatung': 'Buying advice',
  'Magazinbeiträge': 'Magazine articles',
  'Lernhilfen': 'Study aids',
  'HR Kommunikation': 'HR communications',
  'Kundenbetreuung': 'Customer care',

  // About
  'die richtige Lösung!': 'is the right fit.',
  'Der Virtual Marketer – Ihr datengetriebener, kundenzentrierter Marketingprofi.':
    'The Virtual Marketer — your data-driven, customer-centric marketing professional.',
  'Er arbeitet rund um die Uhr, spart Zeit und Kosten und verschafft Ihnen einen echten Wettbewerbsvorteil – durch Schnelligkeit, Flexibilität und höchste Individualisierung.':
    'It works around the clock, saves time and cost, and gives you a real competitive advantage — through speed, flexibility and the highest degree of customisation.',
  'Dabei denkt und handelt er konsequent aus Sicht Ihrer Kunden – über alle Touchpoints hinweg und jenseits menschlicher Skalierbarkeit.':
    'It thinks and acts consistently from your customers’ point of view — across every touchpoint, and beyond what a team could scale to.',
  'Ob Website-Texte, Shopping- und Suchanzeigen, Social Ads, Chatbots oder Voicebots:':
    'Whether website copy, shopping and search ads, social ads, chatbots or voicebots:',
  'Der Virtual Marketer agiert auf einer einheitlichen Datengrundlage – in Echtzeit und kanalübergreifend.':
    'the Virtual Marketer works from one single body of data — in real time and across every channel.',
  'API First - Flexibel': 'API first — flexible',
  'Unique Models - Einzigartig': 'Unique models — one of a kind',
  'German Solutions - Regional': 'German solutions — regional',
  'Nahtlose Integration - Individuell': 'Seamless integration — bespoke',
  'API Doku': 'API docs',

  // Next steps
  'Mit Ihren Daten': 'From your data',
  'und unserer KI zum Erfolg': 'and our AI to results',
  'Auto Analyse': 'Automatic analysis',
  'Extraktion & Datenaktivierung': 'Extraction & data activation',
  'Extraktion &amp; Datenaktivierung': 'Extraction &amp; data activation',
  'Flow-Setup & Client Testing': 'Flow setup & client testing',
  'Flow-Setup &amp; Client Testing': 'Flow setup &amp; client testing',

  // FAQ
  'Häufig gestellte Fragen': 'Frequently asked questions',
  'Woher weiß ich, ob der Virtual Marketer zu meinem Unternehmen passt?':
    'How do I know whether the Virtual Marketer fits my business?',
  'In Vorbereitung auf eine mögliche Zusammenarbeit evaluieren unsere Marketing & Data Science Experten das Potenzial für den Einsatz der Virtual Marketer KI bei den Prozessen in Ihrem Unternehmen und erarbeiten einen individuellen Vorschlag.':
    'Before any engagement, our marketing and data science specialists assess where Virtual Marketer AI could work in your processes and put together a proposal for your specific case.',
  'In Vorbereitung auf eine mögliche Zusammenarbeit evaluieren unsere Marketing &amp; Data Science Experten das Potenzial für den Einsatz der Virtual Marketer KI bei den Prozessen in Ihrem Unternehmen und erarbeiten einen individuellen Vorschlag.':
    'Before any engagement, our marketing and data science specialists assess where Virtual Marketer AI could work in your processes and put together a proposal for your specific case.',
  'Wie lange dauert das Onboarding?': 'How long does onboarding take?',
  'Auf Grund der hohen Nachfrage können wir aktuell keine Garantie für das Onboarding geben. In der Regel erfolgt das erste Meeting jedoch bereits 48h Stunden nach der Kontaktaufnahme. Das Einrichten der Custom Modelle ist nach Abschluss der Strategiephase zumeist innerhalb von 3-5 Werktagen durchgeführt. Das Erstellen von Custom Konnektoren kann je nach Komplexität der Schnittstelle von diesen Werten abweichen.':
    'Demand is high, so we cannot currently guarantee a date. As a rule the first meeting happens within 48 hours of you getting in touch. Setting up the custom models usually takes 3–5 working days once the strategy phase is complete. Building custom connectors can take longer, depending on how complex the interface is.',
  'Mit welchen Kosten muss ich rechnen?': 'What should I expect it to cost?',
  'Der Virtual Marketer wird individuell auf Ihr Unternehmen zugeschnitten &#8211; von der Anzahl der Custom KI Modelle über das monatliche Wörterkontingent bis zu den inkludierten Sitzungen mit unseren KI Strategie Coaches. Da sich die Kosten nach Ihrem konkreten Bedarf richten, erstellen wir Ihnen gerne ein individuelles Angebot. Buchen Sie hierzu einfach eine unverbindliche Demo oder kontaktieren Sie uns direkt.':
    'The Virtual Marketer is tailored to your business &#8211; from the number of custom AI models and the monthly word allowance to the sessions included with our AI strategy coaches. Because the cost follows what you actually need, we will put together an individual quote. Book a no-obligation demo or contact us directly.',

  // Navigation and chrome
  'Lösungen': 'Solutions',
  'Modell anfragen': 'Request a model',
  'Kontakt': 'Contact',
  'Alle Lösungen im Überblick': 'All solutions at a glance',
  'Menü öffnen': 'Open menu',
  'Menü schließen': 'Close menu',
  'Seitenleiste schließen': 'Close sidebar',
  'Nach oben springen': 'Back to top',
  'Datenschutzerklärung': 'Privacy Policy',
  'Impressum': 'Legal Notice',
  'Nutzungsbedingungen': 'Terms of Service',
  'Barrierefreiheit': 'Accessibility',
  'Aktuelle Beiträge': 'Recent posts',
  'Kategorien': 'Categories',

  // Solutions menu items
  'KI-Produktfotos': 'AI product photos',
  // Listed in full, not as "KI-Agenten" plus a leftover: longest-first
  // ordering means this is consumed before the shorter entry below can
  // strand "für Marketing & Ads" in German.
  'KI-Agenten für Marketing &amp; Ads': 'AI agents for marketing &amp; ads',
  'KI-Agenten für Marketing & Ads': 'AI agents for marketing & ads',
  'Über uns': 'About us',
  'KI-Agenten': 'AI agents',
  'Coding-API': 'Coding API',
  'Feed-Veredelung': 'Feed Enhance',
  'Texte generieren': 'Text generator',
  'Bilder generieren': 'Image generator',
  'Videos generieren': 'Video generator',
  'SEO-Content': 'SEO content',
  'Kampagnen-Builder': 'Campaign Builder',
  'Interne Verlinkung': 'Internal linking',
  'KI-E-Mail-Generator': 'AI email generator',
  'KI Social Publisher': 'AI Social Publisher',
  'KI Bulk-Generator': 'AI bulk generator',
  'Dateien & Berichte': 'Files & reports',
  'Dateien &amp; Berichte': 'Files &amp; reports',
  'Feed-Optimizer': 'Feed Optimizer',
  'Chat-Insights': 'Chat Insights',

  // scripts/enhance-homepage.js — the solutions showcase and its two CTAs.
  // The count is baked into the heading at build time (FEATURES.length), so
  // this key has to match that exact number rather than being a template.
  [`Diese ${FEATURES.length} Werkzeuge sind heute bei unseren Kunden im Einsatz`]:
    `These ${FEATURES.length} tools are running at customers today`,
  'Unsere L&ouml;sungen': 'Our Solutions',
  'Von Produktfotos bis Kampagnen &#8211; jedes Werkzeug l&auml;sst sich einzeln oder zusammen einsetzen, mit Ihren eigenen KI-Modellen.':
    'From product photos to campaigns &#8211; every tool works on its own or together, with your own AI models.',
  'Alle L&ouml;sungen im &Uuml;berblick &rarr;': 'All solutions at a glance &rarr;',
  'Sehen Sie, welches Werkzeug zu Ihnen passt': 'See which tool fits your business',
  'Ein kostenloses, unverbindliches Erstgespr&auml;ch &#8211; 15 Minuten, direkt mit unserem Team.':
    'A free, no-obligation first call &#8211; 15 minutes, directly with our team.',
  'Bereit f&uuml;r den ersten Schritt?': 'Ready for the first step?',
  'Buchen Sie ein unverbindliches Erstgespr&auml;ch &#8211; 15 Minuten, keine Verpflichtung.':
    'Book a no-obligation first call &#8211; 15 minutes, no commitment.',
  'Oder schreiben Sie uns direkt:': 'Or write to us directly:',
};

// The showcase's 16 cards reuse the mega-menu's own labels (SOLUTIONS) and
// the product pages' own taglines (FEATURES) rather than a third hand-kept
// copy of either — this is the exact drift inject-language-switcher.js's
// stale slug list already showed the cost of. SOLUTIONS_EN and each
// feature's .en.tagline are the approved English wording; reusing them here
// means the showcase cannot say something different in English than the
// pages it links to already say.
SOLUTIONS.forEach((s, i) => {
  const en = SOLUTIONS_EN[i];
  if (en && !(s.label in COPY)) COPY[s.label] = en.label;
});
FEATURES.forEach((f) => {
  if (!(f.de.tagline in COPY)) COPY[f.de.tagline] = f.en.tagline;
});

const TITLE = 'AI Marketing Solutions from Germany';
const DESCRIPTION =
  'Reliable, automated, efficient: custom AI models for product copy, ads, images, video and customer communication. Built and run in Germany.';

function translate(html) {
  const untouched = [];
  let out = html;

  // Longest first: "Lösungen" is a substring of "Alle Lösungen im Überblick".
  for (const de of Object.keys(COPY).sort((a, b) => b.length - a.length)) {
    out = out.split(de).join(COPY[de]);
  }

  // Links. Longest first for the same reason ("/" would match everything, so
  // it is not in the table at all — the logo link is handled separately).
  for (const de of Object.keys(LINKS).sort((a, b) => b.length - a.length)) {
    out = out.split(`href="${de}"`).join(`href="${LINKS[de]}"`);
    out = out.split(`href="https://virtual-marketer.de${de}"`).join(`href="${LINKS[de]}"`);
  }
  // The logo and any bare root link point at the English home.
  out = out.replace(/href="\/"/g, 'href="/en/"');
  out = out.replace(/href="https:\/\/virtual-marketer\.de\/"/g, 'href="/en/"');

  /*
   * Relative asset paths have to become absolute.
   *
   * The scraped markup carries src="wp-content/uploads/…" with no leading
   * slash. On the German page that sits at / and resolves correctly. The
   * mirrored page sits at /en/, where the same string resolves to
   * /en/wp-content/… and 404s — which is how the hero illustration went
   * missing on the English homepage and nowhere else.
   */
  out = out.replace(
    /\b(src|href|srcset|content)="(?!https?:|\/\/|\/|#|data:|mailto:|tel:)((?:wp-content|wp-includes|assets|product-pages)\/[^"]*)"/g,
    (whole, attr, rel) => `${attr}="/${rel}"`
  );

  return { out, untouched };
}

function main() {
  console.log('\n🌍 Mirroring the German homepage into English...\n');

  const source = path.join(DIST, 'index.html');
  if (!fs.existsSync(source)) {
    console.log('   ⚠ dist/index.html not found — skipped');
    process.exitCode = 1;
    return;
  }

  let html = fs.readFileSync(source, 'utf-8');
  const before = html.length;

  ({ out: html } = translate(html));

  // Head: language, title, description. canonical and hreflang are left to
  // scripts/seo-optimize.js, which strips and rewrites them from its own map
  // — writing them here would only be overwritten a step later.
  html = html.replace(/<html([^>]*)\slang=["'][^"']*["']/i, '<html$1 lang="en"');
  if (!/<html[^>]*\slang=/i.test(html)) html = html.replace(/<html/i, '<html lang="en"');
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${TITLE} | Virtual Marketer</title>`);
  html = html.replace(
    /<meta[^>]+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${DESCRIPTION}">`
  );

  const outDir = path.join(DIST, 'en');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  console.log(`   ✓ /en/ rebuilt from / (${(before / 1024).toFixed(0)} KB source)`);

  // Anything German left in the visible body is a section the table does not
  // know about. Reported rather than guessed at.
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const visible = [...body.matchAll(/>([^<>]{4,})</g)]
    .map((m) => m[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Umlauts and the sharp s are the cheapest reliable signal; so are a few
  // very common German function words that cannot appear in the English copy.
  const germanish = [...new Set(visible.filter((t) =>
    /[äöüßÄÖÜ]/.test(t) || /\b(und|oder|der|die|das|für|mit|Ihre|Ihrem|nicht|werden)\b/.test(t)
  ))];

  if (germanish.length) {
    console.log(`   ⚠ ${germanish.length} string(s) still read as German — add them to COPY:`);
    germanish.slice(0, 8).forEach((t) => console.log(`       ${t.slice(0, 90)}`));
  } else {
    console.log('   ✓ no German left in the visible body');
  }

  // The mirror is worthless if it silently produced the old stub again.
  const deHeads = (fs.readFileSync(source, 'utf-8').match(/<h[12]\b/gi) || []).length;
  const enHeads = (html.match(/<h[12]\b/gi) || []).length;
  if (enHeads !== deHeads) {
    console.log(`   ⚠ heading count differs: DE ${deHeads}, EN ${enHeads}`);
    process.exitCode = 1;
  } else {
    console.log(`   ✓ same structure as the German page (${enHeads} h1/h2)\n`);
  }
}

main();
