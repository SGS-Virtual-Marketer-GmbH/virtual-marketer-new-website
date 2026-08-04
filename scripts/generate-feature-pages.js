#!/usr/bin/env node

/**
 * Feature Landing Pages (DE + EN)
 *
 * Dedicated marketing/demo pages for real, shipped Virtual Marketer product
 * features — built one at a time (see CLAUDE.md), sourced from
 * vm-customer-web-ui's feature-catalog.md / appRegistry.ts, never invented.
 * Each feature's German content plus its `en` sibling (pulled from
 * appRegistry.ts's own `page.en` copy where that maps directly — tagline,
 * intro, valueBullets, howTo, faq — with the SEO/audience/impact research
 * sections translated from the German original) are rendered from ONE
 * shared template, so DE and EN pages never structurally drift apart.
 *
 * URL scheme: German pages live at /ki-loesungen/{slug}/ (existing).
 * English pages live at /en/solutions/{slug}/, on the SAME domain — not
 * the virtual-marketer.ai domain referenced in earlier hreflang comments.
 * That domain was never registered/DNS-configured in this project, so
 * pointing hreflang at it would advertise URLs that 404 forever. A path
 * prefix on the existing, already-live domain ships real, reachable
 * content today and can be 301-redirected to a future virtual-marketer.ai
 * later without touching a single byte of content.
 *
 * Brand: real product CI colors (vm-red #94152b / vm-blue #66a3ce), not the
 * ad-hoc purple/cyan the old "AI Features" showcase used.
 *
 * Demos are scripted/simulated (no backend calls) — deliberate per CLAUDE.md,
 * not a shortcut: safe, no load, fully controllable animation.
 *
 * Run after scripts/build.js (so /ki-loesungen/index.html and /en/index.html
 * exist to link from), before scripts/fix-legal-content.js, so its global
 * name-fix pass also covers these generated pages.
 */

const fs = require('fs');
const path = require('path');
const { DEMO_STYLE, DEMO_ENGINE_JS, buildDemo } = require('./feature-demos.js');
const { CHROME_CSS } = require('./lib/page-chrome');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = 'https://virtual-marketer.de';

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

const UI = {
  de: {
    nav: { solutions: 'Lösungen', blog: 'Blog', api: 'API', request: 'Modell anfragen', contact: 'Kontakt', login: 'Login' },
    demoBook: 'Demo buchen', liveDemo: 'Live-Demo ansehen',
    forWhom: 'Für wen', forWhomTitle: 'Für wen sich das lohnt',
    impactLabel: 'Business Impact',
    liveDemoLabel: 'Live-Demo', liveDemoTitle: 'So funktioniert’s &#8211; zum Ausprobieren',
    productDemoLabel: 'Produkt-Demo', productDemoTitle: 'So sieht es im Produkt aus',
    productDemoNote: 'Simulierte Vorschau mit Beispieldaten &#8211; keine echten Konten oder Server-Aufrufe.',
    back: 'Zurück', next: 'Weiter', restart: 'Von vorn',
    valueLabel: 'Ihr Mehrwert', valueTitle: 'Was Sie davon haben',
    howLabel: 'Ablauf', howTitle: 'So funktioniert’s',
    faqLabel: 'FAQ', faqTitle: 'Häufige Fragen',
    footerLinks: { privacy: 'Datenschutzerklärung', privacyHref: '/datenschutzerklaerung/', legal: 'Impressum', legalHref: '/impressum/' },
    allSolutions: 'Alle KI-Lösungen im Überblick',
    tryonLabel: 'Virtuelle Anprobe', tryonTitle: 'Ein Modell, beliebig viele Outfits',
    tryonIntro: 'Ein einziges Referenzfoto Ihres Fit-Modells genügt. Jedes weitere Kleidungsstück wird darauf angewandt &#8211; gleiche Person, gleiche Pose, gleiches Licht. Für wenige Cent pro Bild statt eines Shootings.',
    tryonBase: 'Referenzfoto', tryonNote: 'Illustratives Beispiel &#8211; alle Aufnahmen sind KI-generiert.',
  },
  en: {
    nav: { solutions: 'Solutions', blog: 'Blog', api: 'API', request: 'Request a model', contact: 'Contact', login: 'Login' },
    demoBook: 'Book a demo', liveDemo: 'Try the live demo',
    forWhom: 'Who it’s for', forWhomTitle: 'Who this is built for',
    impactLabel: 'Business impact',
    liveDemoLabel: 'Live demo', liveDemoTitle: 'How it works &#8211; try it yourself',
    productDemoLabel: 'Product demo', productDemoTitle: 'Inside the product',
    productDemoNote: 'Simulated preview with example data &#8211; no real accounts or server calls.',
    back: 'Back', next: 'Next', restart: 'Start over',
    valueLabel: 'Business value', valueTitle: 'What you get',
    howLabel: 'How it works', howTitle: 'How it works',
    faqLabel: 'FAQ', faqTitle: 'Frequently asked questions',
    footerLinks: { privacy: 'Privacy Policy', privacyHref: '/en/privacy-policy/', legal: 'Legal Notice', legalHref: '/en/legal-notice/' },
    allSolutions: 'All AI solutions at a glance',
    tryonLabel: 'Virtual try-on', tryonTitle: 'One model, any number of outfits',
    tryonIntro: 'A single reference photo of your fit model is enough. Every further garment is applied to it &#8211; same person, same pose, same lighting. For a few cents per image instead of a photo shoot.',
    tryonBase: 'Reference photo', tryonNote: 'Illustrative example &#8211; every shot here is AI-generated.',
  },
};

function header(lang) {
  const t = UI[lang].nav;
  const home = lang === 'en' ? '/en/' : '/';
  const solutions = lang === 'en' ? '/en/solutions/' : '/ki-loesungen/';
  // All 58 posts now have a real English translation (see
  // blog-posts-en.json / generate-en-blog-posts.js), so the EN nav links to
  // the real /en/blog/ archive instead of falling back to the German one.
  const blog = lang === 'en' ? '/en/blog/' : '/blog/';
  const request = lang === 'en' ? '/en/request-custom-model/' : '/modell-anfragen/';
  const contact = lang === 'en' ? '/en/contact/' : '/kontakt/';
  return `<header class="vm-header-simple">
  <a href="${home}"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="${solutions}">${t.solutions}</a>
    <a href="${blog}">${t.blog}</a>
    <a href="https://api.virtual-marketer.de/documentation/">${t.api}</a>
    <a href="${request}">${t.request}</a>
    <a href="${contact}">${t.contact}</a>
    <a href="https://login.virtual-marketer.de/">${t.login}</a>
  </nav>
</header>`;
}

function footer(lang) {
  const f = UI[lang].footerLinks;
  return `<footer style="max-width:1140px;margin:64px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="${f.privacyHref}">${f.privacy}</a> &middot;
  <a href="${f.legalHref}">${f.legal}</a>
</footer>`;
}

/**
 * Feature page registry — one entry built and verified before the next is
 * added (see CLAUDE.md "build one feature page at a time"). Each entry's
 * `de` and `en` blocks share the same shape.
 */
const FEATURES = [
  {
    slug: 'produktfotos-ki',
    demoView: 'staging',
    slugEn: 'ai-product-photos',
    heroImage: '/product-pages/staging-hero.jpg',
    de: {
      seo: {
        title: 'KI-Produktfotos & virtuelle Anprobe (Virtual Try-On)',
        description: 'Produktfotos, On-Model-Bilder und Videos in Minuten statt Wochen — mit KI, ohne Fotostudio. Für Fashion, Retail und E-Commerce.',
        keywords: 'KI Produktfotos, Produktbilder mit KI erstellen, virtuelle Anprobe, Virtual Try-On, KI Produktfotografie, On-Model Bilder KI',
      },
      eyebrow: 'KI Produktfotos &amp; Virtual Try-On',
      tagline: 'Dein digitales Fotostudio.',
      intro: 'VM Product Staging macht aus einem einfachen Produktfoto professionelle On-Model-Aufnahmen, Lifestyle-Szenen und Produktvideos &#8211; in Minuten statt Wochen, für wenige Cent pro Bild statt eines Shootings.',
      audiences: [
        { label: 'Fashion &amp; Apparel E-Commerce', detail: 'Laufend neue Kollektionen, ohne für jede ein Shooting zu buchen.' },
        { label: 'Retail-Marken mit wechselndem Sortiment', detail: 'Konsistente Bildsprache über hunderte SKUs hinweg.' },
        { label: 'Agenturen mit mehreren Kunden', detail: 'Ein Werkzeug für Bildproduktion über alle Konten hinweg.' },
      ],
      impact: {
        heading: 'Was das für Ihr Budget bedeutet',
        note: 'Die Shooting-Kosten sind ein Branchenvergleich; der Bildpreis ist unserer. Die tatsächlichen Kosten hängen von Umfang und Anzahl der Bilder ab.',
        cards: [
          { value: '&euro;50&ndash;150', label: 'pro fertigem Bild', sub: 'klassisches Fotoshooting mit Model, Studio &amp; Postproduktion' },
          { value: 'wenige Cent', label: 'pro fertigem Bild', sub: 'mit Virtual Marketer &#8211; deutlich unter einem Euro pro Bild' },
          { value: '+20&ndash;40%', label: 'Conversion-Potenzial', sub: 'beim Umstieg von Flat-Lay- auf On-Model-Darstellung' },
        ],
        // Describes what the product does, not whether that is legally sufficient —
        // the second is a conclusion for a lawyer, not a claim for a landing page.
        compliance: 'Der EU AI Act verlangt eine maschinenlesbare Kennzeichnung KI-generierter Bilder. Virtual Marketer schreibt sie in jedes erzeugte Bild: die IPTC-Kennung &#8222;Digital Source Type: trainedAlgorithmicMedia&#8220; &#8211; automatisch, nicht abschaltbar, zus&auml;tzlich zum optionalen sichtbaren Wasserzeichen.',
      },
      valueBullets: [
        'Teure Fotoshootings ersetzen: vom Rohfoto zum E-Commerce-Bild in Minuten',
        'Konsistente virtuelle Models für den gesamten Katalog wiederverwendbar',
        'Anprobe für Fashion UND Szenen-Inszenierung für jedes andere Produkt',
        'Ein Klick macht aus jedem Bild ein aufmerksamkeitsstarkes Produktvideo',
        'Mehrere Perspektiven, Formate und Qualitätsstufen für jeden Kanal',
      ],
      howTo: [
        'Produktfoto hochladen &#8211; Bügel- oder Smartphone-Aufnahme genügt. VM erkennt Name und Produkttyp automatisch.',
        'Model aus der Galerie wählen oder mit einfachen Optionen selbst zusammenstellen (Alter, Figur, Hautton, Ausdruck).',
        'Szene wählen &#8211; Studio, Straße, Café u.v.m. &#8211; oder eigene Szene beschreiben.',
        'Formate und Perspektiven festlegen, generieren. Ergebnisse verfeinern, favorisieren, herunterladen.',
        'Mit „Animieren&#8220; wird jedes Bild zum Produktvideo (Gehen, Drehen, Detail-Schwenk u.a.).',
      ],
      faq: [
        { q: 'Welche Fotos brauche ich?', a: 'Ein klares Produktfoto genügt. Ein zweites Foto der Rückseite verbessert Rückansichten.' },
        { q: 'Sieht mein Produkt exakt richtig aus?', a: 'Die Engine ist angewiesen, Farben, Materialien, Logos und Proportionen originalgetreu zu erhalten. Vor Veröffentlichung prüfen &#8211; Neugenerierung ist ein Klick.' },
        { q: 'Wie wird abgerechnet?', a: 'Bilder zählen je 1.000 Wörter (höhere Auflösungen mehr), Videos 1.000 Wörter pro Sekunde &#8211; dasselbe Wort-Budget wie alle anderen VM-Tools.' },
        { q: 'Für wen lohnt sich das?', a: 'Für alle, die regelmäßig neue Produktbilder brauchen &#8211; von Fashion-Shops mit häufigen Kollektionswechseln bis zu Agenturen, die mehrere Kataloge gleichzeitig betreuen.' },
      ],
      demo: {
        steps: [
          { label: 'Foto hochladen', icon: 'upload' },
          { label: 'Model wählen', icon: 'model' },
          { label: 'Szene wählen', icon: 'scene' },
          { label: 'Ergebnis', icon: 'result' },
        ],
        panels: [
          (icon) => `<div class="demo-upload-zone">${icon('upload')}<p>Produktfoto hier ablegen &#8211; ein Smartphone-Foto genügt.</p></div>`,
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Model aus der Galerie wählen:</p>
        ${modelGallery()}`,
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Szene wählen:</p>
        ${sceneChooser(['Studio', 'Straße', 'Café'])}`,
          () => `${demoResult('Generiertes Ergebnisbeispiel')}
        <p class="demo-caption">So sieht ein fertiges Ergebnis aus &#8211; in Minuten statt Wochen generiert.</p>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Product Photos & Virtual Try-On',
        description: 'Product photos, on-model shots and videos in minutes instead of weeks — with AI, no photo studio needed. For fashion, retail and e-commerce.',
        keywords: 'AI product photography, AI product photo generator, virtual try-on, on-model images AI, product photos AI',
      },
      eyebrow: 'AI Product Photos &amp; Virtual Try-On',
      tagline: 'Your digital photo studio.',
      intro: 'VM Product Staging turns a simple product photo into professional on-model shots, lifestyle scenes and product videos &#8211; in minutes instead of weeks, for a few cents per image instead of a photo shoot.',
      audiences: [
        { label: 'Fashion &amp; apparel e-commerce', detail: 'New collections constantly, without booking a shoot for every drop.' },
        { label: 'Retail brands with a changing catalog', detail: 'Consistent visuals across hundreds of SKUs.' },
        { label: 'Agencies with multiple clients', detail: 'One tool for image production across every account.' },
      ],
      impact: {
        heading: 'What that means for your budget',
        note: 'The shoot cost is an industry comparison; the per-image price is ours. Actual cost depends on scope and image count.',
        cards: [
          { value: '&euro;50&ndash;150', label: 'per finished image', sub: 'traditional photo shoot with model, studio &amp; post-production' },
          { value: 'a few cents', label: 'per finished image', sub: 'with Virtual Marketer &#8211; well under one euro per image' },
          { value: '+20&ndash;40%', label: 'conversion potential', sub: 'moving from flat-lay to on-model imagery' },
        ],
        // Mirrors the German string above. It used to read "Virtual Marketer
        // labels correctly by default" — an assertion that the product meets
        // a legal standard, which is not ours to make and, until the product
        // repo's 2026-08-04 fix, was not even true: the image path stripped
        // metadata rather than writing it. The German half was corrected
        // there; this one was missed, so the overclaim stayed live in
        // English only. State what the product does and leave the legal
        // conclusion to a lawyer.
        compliance: 'The EU AI Act requires machine-readable labeling of AI-generated images. Virtual Marketer writes it into every generated image: the IPTC tag &#8220;Digital Source Type: trainedAlgorithmicMedia&#8221; &#8211; automatic, not switchable, in addition to the optional visible watermark.',
      },
      valueBullets: [
        'Replace expensive photo shoots: from raw photo to e-commerce-ready imagery in minutes',
        'Consistent virtual models you can reuse across your whole catalog',
        'Try-on for fashion AND scene placement for any other product',
        'One click turns any image into a scroll-stopping product video',
        'Multiple perspectives, formats and quality levels for every channel',
      ],
      howTo: [
        'Upload a product photo &#8211; a hanger or smartphone shot is enough. VM recognizes name and product type automatically.',
        'Pick a model from the gallery or build your own with simple choices (age, body, skin tone, expression).',
        'Choose a scene &#8211; studio, street, café and more &#8211; or describe your own.',
        'Select formats and perspectives, then generate. Refine, favorite and download your shots.',
        'Press “Animate” on any image to create a product video (walk, turn, detail pan and more).',
      ],
      faq: [
        { q: 'What photos do I need?', a: 'One clear photo of the product is enough. A second back-view photo improves back perspectives.' },
        { q: 'Will my product look exactly right?', a: 'The engine is instructed to preserve colors, materials, logos and proportions faithfully. Always review before publishing &#8211; regeneration is one click.' },
        { q: 'How is usage billed?', a: 'Images count 1,000 words each (higher resolutions more), videos 1,000 words per second &#8211; the same word budget as all other VM tools.' },
        { q: 'Who is this worth it for?', a: 'Anyone who regularly needs new product imagery &#8211; from fashion shops with frequent collection changes to agencies running several catalogs at once.' },
      ],
      demo: {
        steps: [
          { label: 'Upload photo', icon: 'upload' },
          { label: 'Pick a model', icon: 'model' },
          { label: 'Pick a scene', icon: 'scene' },
          { label: 'Result', icon: 'result' },
        ],
        panels: [
          (icon) => `<div class="demo-upload-zone">${icon('upload')}<p>Drop a product photo here &#8211; a smartphone shot is enough.</p></div>`,
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Choose a model from the gallery:</p>
        ${modelGallery()}`,
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Choose a scene:</p>
        ${sceneChooser(['Studio', 'Street', 'Café'])}`,
          () => `${demoResult('Generated result example')}
        <p class="demo-caption">This is what a finished result looks like &#8211; generated in minutes instead of weeks.</p>`,
        ],
      },
    },
  },
  {
    slug: 'agenten',
    heroImage: '/product-pages/agents2-hero.jpg',
    demoView: 'agents2',
    slugEn: 'ai-agents',
    heroIcon: 'agent',
    heroCaption: 'Virtual Marketer Agents 2.0',
    de: {
      seo: {
        title: 'KI-Agenten für Marketing, Ads & SEO — autonome virtuelle Mitarbeiter',
        description: 'Spezialisierte KI-Agenten für Analytics, Google Ads, Meta Ads, SEO und Kundenservice — per Chat, Webhook oder Zeitplan im Einsatz.',
        keywords: 'KI Agenten Marketing, autonome KI Mitarbeiter, KI Agent Google Ads, Marketing Automatisierung KI, virtueller Mitarbeiter KI, KI Agent SEO',
      },
      eyebrow: 'KI-Agenten &amp; Automatisierung',
      tagline: 'Ihr virtuelles Team, rund um die Uhr im Einsatz.',
      intro: 'Virtual Marketer Agents 2.0 sind spezialisierte virtuelle Mitarbeiter, die nicht nur Fragen beantworten &#8211; sie verbinden sich mit Ihren Werkzeugen, führen die Analyse durch und übernehmen die von Ihnen freigegebenen Aktionen. Einmal einrichten, dann im Chat ansprechen, per Webhook aus jedem System beauftragen oder nach Zeitplan arbeiten lassen.',
      audiences: [
        { label: 'Marketing-Teams mit mehreren Ad-Konten', detail: 'Analytics, Google Ads und Meta Ads im Blick behalten, ohne täglich manuell nachzuschauen.' },
        { label: 'Agenturen mit vielen Kundenkonten', detail: 'Ein Agent pro Spezialgebiet, wiederverwendbar über alle Konten hinweg.' },
        { label: 'Teams ohne eigene Datenanalyse', detail: 'Auswertung und Handlungsvorschläge, ohne einen Data Analyst einzustellen.' },
      ],
      impact: {
        heading: 'Warum das jetzt relevant ist',
        note: 'Branchenzahlen zur Kategorie insgesamt, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '$201,9&nbsp;Mrd.', label: 'prognostiziertes Agentic-AI-Budget 2026', sub: 'weltweit, laut Gartner &#8211; die Kategorie wächst extrem schnell' },
          { value: '2,8', label: 'Agenten pro Marketing-Team', sub: 'bereits im Schnitt im Einsatz, laut Gartner (2026)' },
          { value: '1 Webhook', label: 'statt mehrerer Einzeltools', sub: 'ein Agent bündelt Analyse, Entscheidung und Aktion in einem Aufruf' },
        ],
        compliance: 'Optionale Zwei-Faktor-Sicherheit schützt sensible Aktionen wie Kampagnenänderungen zusätzlich ab.',
      },
      valueBullets: [
        'Spezialisten ab Werk: Analytics, Google Ads, Meta Ads, SEO und Kundenservice',
        'Eigene Werkzeuge verbinden &#8211; Analytics, Werbeplattformen, Sichtbarkeitsdaten, E-Mail, Messaging und Ihre Automatisierungs-Flows',
        'Mit einem Agenten chatten oder ihn von überall mit einem einzigen Webhook-Aufruf auslösen',
        'Wiederkehrende Arbeit planen: morgendliche Performance-Zusammenfassung, nächtliches Konto-Audit, Posteingang-Triage',
        'Optionale Zwei-Faktor-Sicherheit &#8211; aktivieren Sie sie, um sensible Aktionen mit einem Einmalcode zu schützen',
      ],
      howTo: [
        'Fügen Sie einen Agenten aus dem Katalog hinzu &#8211; jeder kennt seine Aufgabe bereits.',
        'Verbinden Sie unter Konnektoren die benötigten Werkzeuge. Ihre Zugangsdaten werden verschlüsselt und nie wieder angezeigt.',
        'Aktivieren Sie optional die Zwei-Faktor-Sicherheit (Google oder Microsoft Authenticator) für zusätzlichen Schutz &#8211; oder nutzen Sie Ihre Agenten sofort.',
        'Chatten Sie mit dem Agenten oder kopieren Sie seinen Aufgaben-Webhook in n8n, einen Cronjob oder Ihre eigene App.',
        'Optional einen Zeitplan und eine wiederkehrende Aufgabe festlegen und den Agenten selbstständig arbeiten lassen.',
      ],
      faq: [
        { q: 'Was kann ein Agent tatsächlich tun?', a: 'Er kann Daten aus jedem verbundenen Werkzeug lesen und analysieren, E-Mails und Nachrichten verfassen und senden, Ihre Automatisierungs-Flows auslösen und &#8211; wenn Sie es ausdrücklich verlangen &#8211; Änderungen vornehmen, etwa eine Kampagne anpassen. Er teilt immer genau mit, was er geändert hat.' },
        { q: 'Welche Werkzeuge kann ich verbinden?', a: 'Analytics, Werbeplattformen, Such-Sichtbarkeitsdaten, Händler- und Shopping-Daten, E-Mail (Senden und Lesen), Telegram sowie Ihre n8n- oder Activepieces-Workflows.' },
        { q: 'Wie löse ich einen Agenten aus einem anderen System aus?', a: 'Jeder Agent hat einen privaten Aufgaben-Webhook. Senden Sie eine kurze Anweisung, und er erledigt die Arbeit und liefert das Ergebnis zurück.' },
        { q: 'Ist es sicher?', a: 'Ja. Ihre Konnektor-Zugangsdaten werden verschlüsselt gespeichert und nach dem Speichern nie wieder angezeigt. Die Zwei-Faktor-Sicherheit ist optional.' },
      ],
      demo: {
        steps: [
          { label: 'Agent wählen', icon: 'agent' },
          { label: 'Frage stellen', icon: 'text' },
          { label: 'Antwort & Vorschlag', icon: 'result' },
        ],
        panels: [
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Spezialisten aus dem Katalog:</p>
        <div class="demo-swatches">
          ${['Analytics', 'Google Ads', 'SEO', 'Support'].map((m, i) => `<div class="demo-chip${i === 1 ? ' selected' : ''}">${m}</div>`).join('\n          ')}
        </div>`,
          () => `<div class="demo-chat-bubble user">Wie liefen unsere Google Ads diese Woche?</div>
        <div class="demo-chat-bubble">Analysiere Kampagnendaten &#8230;</div>`,
          () => `<div class="demo-chat-bubble">3 Kampagnen liegen unter dem Ziel-ROAS. Vorschlag: Budget von „Sommer-Sale&#8220; um 15% erhöhen, „Restposten&#8220; pausieren.</div>
        <div class="demo-chip selected" style="margin-top:8px;">Änderung übernehmen</div>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Agents for Marketing, Ads & SEO — Autonomous Virtual Employees',
        description: 'Specialist AI agents for analytics, Google Ads, Meta Ads, SEO and customer care — via chat, webhook or schedule.',
        keywords: 'AI marketing agents, autonomous AI employees, AI agent Google Ads, marketing automation AI, virtual employee AI, AI agent SEO',
      },
      eyebrow: 'AI Agents &amp; Automation',
      tagline: 'Your virtual team, on call around the clock.',
      intro: 'Virtual Marketer Agents 2.0 are specialist virtual employees that don’t just answer questions &#8211; they connect to your tools, do the analysis, and take the actions you approve. Set one up once, then talk to it in chat, hand it a task from any system via webhook, or let it run on a schedule while you sleep.',
      audiences: [
        { label: 'Marketing teams with multiple ad accounts', detail: 'Keep an eye on analytics, Google Ads and Meta Ads without checking manually every day.' },
        { label: 'Agencies with many client accounts', detail: 'One agent per specialty, reusable across every account.' },
        { label: 'Teams without in-house data analysis', detail: 'Get analysis and action proposals without hiring a data analyst.' },
      ],
      impact: {
        heading: 'Why this matters right now',
        note: 'Industry figures for the category as a whole, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '$201.9B', label: 'projected 2026 agentic AI spend', sub: 'worldwide, per Gartner &#8211; the category is growing extremely fast' },
          { value: '2.8', label: 'agents per marketing team', sub: 'already running on average, per Gartner (2026)' },
          { value: '1 webhook', label: 'instead of several point tools', sub: 'one agent bundles analysis, decision and action in a single call' },
        ],
        compliance: 'Optional two-factor security adds extra protection for sensitive actions like campaign changes.',
      },
      valueBullets: [
        'Specialists out of the box: analytics, Google Ads, Meta Ads, SEO and customer care',
        'Connect your own tools &#8211; analytics, ad platforms, visibility data, email, messaging and your automation flows',
        'Talk to an agent in chat, or trigger it from anywhere with a single webhook call',
        'Schedule recurring work: a morning performance summary, an overnight account audit, inbox triage',
        'Optional two-factor security &#8211; turn it on to protect sensitive actions with a one-time code',
      ],
      howTo: [
        'Add an agent from the catalogue &#8211; each one already knows its job.',
        'Connect the tools it needs under Connectors. Your credentials are encrypted and never shown again.',
        'Optionally turn on two-factor security (Google or Microsoft Authenticator) for extra protection &#8211; or start using your agents right away.',
        'Chat with the agent, or copy its task webhook into n8n, a cron job or your own app.',
        'Optionally set a schedule and a recurring task, and let the agent work on its own.',
      ],
      faq: [
        { q: 'What can an agent actually do?', a: 'It can read and analyse data from any tool you connect, draft and send emails and messages, trigger your automation flows, and &#8211; when you explicitly ask &#8211; make changes like adjusting a campaign. It always tells you exactly what it changed.' },
        { q: 'Which tools can I connect?', a: 'Analytics, ad platforms, search-visibility data, merchant and shopping data, email (sending and reading), Telegram, and your n8n or Activepieces workflows.' },
        { q: 'How do I trigger an agent from another system?', a: 'Every agent has a private task webhook. Send it a short instruction and it does the work and returns the result.' },
        { q: 'Is it secure?', a: 'Yes. Your connector credentials are encrypted at rest and never displayed again after saving. Two-factor security is optional.' },
      ],
      demo: {
        steps: [
          { label: 'Pick an agent', icon: 'agent' },
          { label: 'Ask a question', icon: 'text' },
          { label: 'Answer & proposal', icon: 'result' },
        ],
        panels: [
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Specialists from the catalogue:</p>
        <div class="demo-swatches">
          ${['Analytics', 'Google Ads', 'SEO', 'Support'].map((m, i) => `<div class="demo-chip${i === 1 ? ' selected' : ''}">${m}</div>`).join('\n          ')}
        </div>`,
          () => `<div class="demo-chat-bubble user">How did our Google Ads perform this week?</div>
        <div class="demo-chat-bubble">Analysing campaign data &#8230;</div>`,
          () => `<div class="demo-chat-bubble">3 campaigns are below target ROAS. Suggestion: increase “Summer Sale” budget by 15%, pause “Clearance”.</div>
        <div class="demo-chip selected" style="margin-top:8px;">Apply change</div>`,
        ],
      },
    },
  },
  {
    slug: 'coding-api',
    heroImage: '/product-pages/coding-hero.jpg',
    demoView: 'coding',
    slugEn: 'coding-api',
    heroIcon: 'code',
    heroCaption: 'Coding API & MCP',
    de: {
      seo: {
        title: 'Coding-API & MCP-Server — Virtual Marketer Senior & Junior für dein IDE',
        description: 'OpenAI- und Anthropic-kompatible Coding-API mit zwei Modellstufen. Nutzbar in Cursor, Cline, aider & Co. — eine Basis-URL, ein Guthaben.',
        keywords: 'OpenAI kompatible API, KI Coding API, Cursor eigenes Modell, Coding Assistent API, MCP Server, KI für Entwickler',
      },
      eyebrow: 'Coding-API &amp; MCP-Server',
      tagline: 'Virtual Marketer, direkt in deinem Editor.',
      intro: 'Die Coding-API stellt zwei entwicklergerechte Modelle bereit &#8211; Virtual Marketer Senior und Virtual Marketer Junior &#8211; hinter einem standardisierten, OpenAI-kompatiblen Endpunkt. Richte ein beliebiges Coding-Werkzeug mit „OpenAI-kompatiblem&#8220; Anbieter darauf aus und erhalte sauberen, korrekten Code mit Streaming und vollem Tool-/Function-Calling &#8211; abgerechnet über dasselbe Guthaben wie alles andere.',
      audiences: [
        { label: 'Interne Entwickler-Teams', detail: 'Ein Guthaben für Coding und alle anderen VM-Tools, statt separater IDE-Abos.' },
        { label: 'Digitalagenturen mit eigener Entwicklung', detail: 'Ein Endpunkt für alle Projekte und Kunden, egal welches Tool das Team nutzt.' },
        { label: 'Technische Gründer', detail: 'IDE-Kosten konsolidieren, ohne auf Modellqualität zu verzichten.' },
      ],
      impact: {
        heading: 'Was das gegenüber separaten IDE-Abos spart',
        note: 'Branchenvergleich zu marktüblichen Coding-Assistenten, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '&euro;20&ndash;39', label: 'pro Entwickler/Monat', sub: 'typische Kosten für Cursor oder GitHub Copilot Pro+ allein' },
          { value: '1 Guthaben', label: 'für alles', sub: 'Coding zählt zum selben Wort-Budget wie alle anderen VM-Tools' },
          { value: '2 Stufen', label: 'Senior &amp; Junior', sub: 'Architektur &amp; harte Probleme vs. schnelle, günstige Änderungen' },
        ],
        compliance: 'Funktioniert mit jedem Tool, das eine OpenAI-kompatible Basis-URL akzeptiert &#8211; Cursor, Cline, Windsurf, Zed, aider und mehr.',
      },
      valueBullets: [
        'Zwei Stufen: Senior für Architektur und harte Probleme, Junior für schnelle, hochvolumige Änderungen',
        'Funktioniert mit den Werkzeugen, die Sie bereits nutzen &#8211; IDE-Assistenten, Agenten, die OpenAI-SDKs, curl und CI-Skripte',
        'Standard-OpenAI-Chat-Completions-Protokoll: Streaming und Tool-/Function-Calling inklusive',
        'Mit hauseigenem System-Prompt für sauberes, produktionsreifes Programmieren optimiert',
        'Ein Schlüssel, eine Basis-URL &#8211; kopieren, einfügen, fertig',
      ],
      howTo: [
        'Öffnen Sie die Coding-API-Seite und kopieren Sie Basis-URL und API-Schlüssel.',
        'Wählen Sie im Werkzeug den „OpenAI-kompatiblen&#8220; Anbieter und fügen Sie Basis-URL und Schlüssel ein.',
        'Setzen Sie das Modell auf virtual-marketer-senior oder virtual-marketer-junior.',
        'Loslegen &#8211; oder auf der Seite „Live testen&#8220; nutzen, um mit einem Klick eine erste Anfrage zu senden.',
      ],
      faq: [
        { q: 'Mit welchen Werkzeugen funktioniert es?', a: 'Mit allem, das eine eigene OpenAI-Basis-URL und einen Schlüssel erlaubt &#8211; gängige IDE-Assistenten und Agenten, aider, die offiziellen OpenAI-SDKs, curl und eigene Skripte.' },
        { q: 'Was sind Senior und Junior?', a: 'Senior ist das Top-Reasoning-Modell für Architektur, knifflige Bugs und große Refactorings; Junior ist eine schnellere, kosteneffiziente Stufe für schnelle Änderungen und Aufrufe in großer Menge.' },
        { q: 'Werden Streaming und Tools unterstützt?', a: 'Ja. Setze stream: true für Token-Streaming und übergib die Standardfelder tools / tool_choice für Function-Calling &#8211; genau wie bei der OpenAI-API.' },
        { q: 'Wie wird abgerechnet?', a: 'Die Nutzung wird über dein Virtual-Marketer-Wortguthaben abgerechnet, wie bei jedem anderen Produkt.' },
      ],
      demo: {
        steps: [
          { label: 'Basis-URL kopieren', icon: 'link' },
          { label: 'Modell wählen', icon: 'code' },
          { label: 'Anfrage senden', icon: 'terminal' },
        ],
        panels: [
          () => `<div class="demo-code-block">base_url = "https://api.virtual-marketer.de/v1"<br>api_key = "vmk_&#8230;"</div>`,
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Modell wählen:</p>
        <div class="demo-swatches">
          <div class="demo-chip selected">virtual-marketer-senior</div>
          <div class="demo-chip">virtual-marketer-junior</div>
        </div>`,
          () => `<div class="demo-code-block">$ curl .../chat/completions -d '{"model":"virtual-marketer-senior", ...}'<br>&gt; „Hier ist die korrigierte Funktion &#8230;&#8221;</div>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'Coding API & MCP Server — Virtual Marketer Senior & Junior for Your IDE',
        description: 'OpenAI- and Anthropic-compatible coding API with two model tiers. Works with Cursor, Cline, aider and more — one base URL, one balance.',
        keywords: 'OpenAI compatible API, AI coding API, Cursor custom model, coding assistant API, MCP server, AI for developers',
      },
      eyebrow: 'Coding API &amp; MCP Server',
      tagline: 'Virtual Marketer, right inside your editor.',
      intro: 'The Coding API gives you two developer-grade models &#8211; Virtual Marketer Senior and Virtual Marketer Junior &#8211; behind a standard, OpenAI-compatible endpoint. Point any coding tool that supports a custom OpenAI provider at it and you get clean, correct code with streaming and full tool/function calling, billed to the same balance as everything else.',
      audiences: [
        { label: 'In-house developer teams', detail: 'One balance for coding and every other VM tool, instead of separate IDE subscriptions.' },
        { label: 'Digital agencies with their own dev team', detail: 'One endpoint for every project and client, whatever tool the team uses.' },
        { label: 'Technical founders', detail: 'Consolidate IDE costs without giving up model quality.' },
      ],
      impact: {
        heading: 'What this saves versus separate IDE subscriptions',
        note: 'Industry comparison against common coding assistants, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '&euro;20&ndash;39', label: 'per developer/month', sub: 'typical cost for Cursor or GitHub Copilot Pro+ alone' },
          { value: '1 balance', label: 'for everything', sub: 'coding counts against the same word budget as every other VM tool' },
          { value: '2 tiers', label: 'Senior &amp; Junior', sub: 'architecture &amp; hard problems vs. fast, cheap edits' },
        ],
        compliance: 'Works with any tool that accepts an OpenAI-compatible base URL &#8211; Cursor, Cline, Windsurf, Zed, aider and more.',
      },
      valueBullets: [
        'Two tiers: Senior for architecture and hard problems, Junior for fast, high-volume edits',
        'Works with the tools you already use &#8211; IDE assistants, agents, the OpenAI SDKs, curl and CI scripts',
        'Standard OpenAI Chat Completions protocol: streaming and tool/function calling included',
        'Tuned with a house system prompt for clean, production-grade software development',
        'One key, one base URL &#8211; copy, paste, done',
      ],
      howTo: [
        'Open the Coding API page and copy your base URL and API key.',
        'In your tool, choose the ‘OpenAI-compatible’ provider and paste the base URL and key.',
        'Set the model to virtual-marketer-senior or virtual-marketer-junior.',
        'Start coding &#8211; or hit ‘Try it live’ on the page to send a first request in one click.',
      ],
      faq: [
        { q: 'Which tools does it work with?', a: 'Anything that lets you set a custom OpenAI base URL and key &#8211; popular IDE assistants and agents, aider, the official OpenAI SDKs, curl, and your own scripts.' },
        { q: 'What are Senior and Junior?', a: 'Senior is the top-tier reasoning model for architecture, tricky bugs and large refactors; Junior is a faster, cost-efficient tier for quick edits and high-volume calls.' },
        { q: 'Does it support streaming and tools?', a: 'Yes. Set stream: true for token streaming, and pass the standard tools / tool_choice fields for function calling &#8211; exactly like the OpenAI API.' },
        { q: 'How is it billed?', a: 'Usage counts against your Virtual Marketer word balance, the same as every other product.' },
      ],
      demo: {
        steps: [
          { label: 'Copy base URL', icon: 'link' },
          { label: 'Pick a model', icon: 'code' },
          { label: 'Send a request', icon: 'terminal' },
        ],
        panels: [
          () => `<div class="demo-code-block">base_url = "https://api.virtual-marketer.de/v1"<br>api_key = "vmk_&#8230;"</div>`,
          () => `<p style="color:#d8c5c4;margin-bottom:20px;">Pick a model:</p>
        <div class="demo-swatches">
          <div class="demo-chip selected">virtual-marketer-senior</div>
          <div class="demo-chip">virtual-marketer-junior</div>
        </div>`,
          () => `<div class="demo-code-block">$ curl .../chat/completions -d '{"model":"virtual-marketer-senior", ...}'<br>&gt; “Here is the corrected function &#8230;”</div>`,
        ],
      },
    },
  },
  {
    slug: 'feed-veredelung',
    demoView: 'feedEnhance',
    slugEn: 'feed-enhance',
    heroImage: '/product-pages/feedenhance-hero.jpg',
    de: {
      seo: {
        title: 'KI Feed-Optimierung für Google Shopping, Meta & Bing',
        description: 'Produktfeeds importieren, mit KI anreichern und als validierten, stets aktuellen Feed für Google, Meta und Bing veröffentlichen.',
        keywords: 'Google Shopping Feed optimieren KI, Produktfeed anreichern, Feed Management KI, Merchant Center Feed KI, Shopping Feed Software',
      },
      eyebrow: 'KI Feed-Veredelung',
      tagline: 'Perfekte Produktfeeds, im Autopilot.',
      intro: 'VM Feed Enhance importiert Ihre Produktfeeds, bereinigt und veredelt sie mit dem VM Product Enhancer und veröffentlicht einen stets aktuellen, validierten Google-Shopping-Feed unter einer festen URL.',
      audiences: [
        { label: 'E-Commerce-Teams mit Shopping-Feeds', detail: 'Google, Meta und Bing Shopping aus einer Quelle pflegen statt drei separaten Exporten.' },
        { label: 'Agenturen mit mehreren Merchant-Center-Konten', detail: 'Ein Werkzeug für alle Kundenfeeds, mit klaren Regeln pro Konto.' },
        { label: 'Händler mit häufigen Feed-Ablehnungen', detail: 'Eingebaute Validierung findet Probleme, bevor Google sie findet.' },
      ],
      impact: {
        heading: 'Was vergleichbare Feed-Tools kosten',
        note: 'Branchenvergleich zu Channable/DataFeedWatch, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '&euro;59&ndash;239', label: 'pro Monat', sub: 'typische Preisspanne vergleichbarer Feed-Tools wie Channable oder DataFeedWatch' },
          { value: '18.08.2026', label: 'Content-API-Abschaltung', sub: 'Google stellt die alte Shopping-Content-API ab &#8211; die Merchant-API-Migration wird jetzt nötig' },
          { value: 'nur Änderungen', label: 'KI-Kosten minimal', sub: 'KI läuft nur bei neuen oder geänderten Produkten, nicht bei jedem Update erneut' },
        ],
        compliance: 'Eingebaute Validierung prüft gängige Ablehnungsgründe, bevor Google sie findet.',
      },
      valueBullets: [
        'Mehrere Quellen zu einem sauberen Katalog zusammenführen',
        'Regeln und Feld-Transformationen wie im Profi-Feed-Tool &#8211; mit Live-Vorher/Nachher-Vorschau',
        'AI befüllt fehlende Attribute (Farbe, Material, Geschlecht&#8230;) aus Texten und sogar aus Produktbildern',
        'Optimierte Titel und Beschreibungen nach Googles Best Practices',
        'Läuft nach Zeitplan &#8211; AI bearbeitet nur neue oder geänderte Produkte, Kosten bleiben minimal',
      ],
      howTo: [
        'Feed-Quelle(n) hinzufügen &#8211; XML, CSV, TSV oder JSON &#8211; und erkannte Felder prüfen.',
        'Flow bauen: Felder zuordnen, Regeln anlegen (z.B. Ausverkauftes ausschließen), AI-Schritte einsetzen, wo Daten fehlen.',
        'Jeden Schritt in der Vorschau prüfen: Änderungen an echten Produkten sehen, bevor sie live gehen.',
        'Zeitplan wählen und die feste Feed-URL im Google Merchant Center hinterlegen. Fertig.',
      ],
      faq: [
        { q: 'Welche Formate kann ich importieren?', a: 'Google Shopping XML (RSS/Atom), CSV, TSV und JSON. Das Format wird automatisch erkannt.' },
        { q: 'Läuft AI bei jedem Update über den ganzen Katalog?', a: 'Nein. Ergebnisse werden pro Produkt gecacht &#8211; AI läuft nur für neue Produkte oder bei geänderten Daten.' },
        { q: 'Kann ich eigene VM-Modelle nutzen?', a: 'Ja. In jedem AI-Schritt wählst du den VM Product Enhancer (Standard) oder eines deiner eigenen Virtual-Marketer-Modelle.' },
      ],
      demo: {
        steps: [
          { label: 'Feed-Quelle', icon: 'feed' },
          { label: 'KI-Anreicherung', icon: 'text' },
          { label: 'Vorschau', icon: 'result' },
        ],
        panels: [
          () => `<p style="color:#d8c5c4;">XML, CSV, TSV oder JSON &#8211; Format wird automatisch erkannt.</p>`,
          () => `<p style="color:#d8c5c4;margin-bottom:12px;">Fehlende Attribute werden ergänzt:</p>
        <div class="demo-chip">Farbe: &#8212; &rarr; Farbe: Marineblau</div><br>
        <div class="demo-chip">Material: &#8212; &rarr; Material: Baumwolle</div>`,
          () => `<p style="color:#d8c5c4;">Titel optimiert: „Herren T-Shirt&#8220; &rarr; „Herren T-Shirt Marineblau, Baumwolle, Gr. S&#8211;XL&#8220;</p>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Feed Enhance for Google Shopping, Meta & Bing',
        description: 'Import product feeds, enrich them with AI, and publish a validated, always-fresh feed for Google, Meta and Bing.',
        keywords: 'Google Shopping feed AI optimizer, product feed enrichment, feed management AI, Merchant Center feed AI, shopping feed software',
      },
      eyebrow: 'AI Feed Enhance',
      tagline: 'Perfect product feeds, on autopilot.',
      intro: 'VM Feed Enhance imports your product feeds, cleans and enriches them with the VM Product Enhancer and publishes an always-fresh, validated Google Shopping feed under a permanent URL.',
      audiences: [
        { label: 'E-commerce teams running shopping feeds', detail: 'Maintain Google, Meta and Bing Shopping from one source instead of three separate exports.' },
        { label: 'Agencies with multiple Merchant Center accounts', detail: 'One tool for every client feed, with clear rules per account.' },
        { label: 'Merchants with frequent feed disapprovals', detail: 'Built-in validation catches problems before Google does.' },
      ],
      impact: {
        heading: 'What comparable feed tools cost',
        note: 'Industry comparison to Channable/DataFeedWatch, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '&euro;59&ndash;239', label: 'per month', sub: 'typical price range for comparable feed tools like Channable or DataFeedWatch' },
          { value: 'Aug 18, 2026', label: 'Content API shutdown', sub: 'Google is retiring the old Shopping Content API &#8211; the Merchant API migration is now urgent' },
          { value: 'changes only', label: 'AI costs stay minimal', sub: 'AI only runs for new or changed products, not on every update' },
        ],
        compliance: 'Built-in validation catches common disapproval causes before Google does.',
      },
      valueBullets: [
        'Merge multiple sources into one clean catalog',
        'Rules and field transformations like a professional feed tool &#8211; with live before/after preview',
        'AI fills missing attributes (color, material, gender...) from texts and even from product images',
        'Optimized titles and descriptions following Google’s best practices',
        'Runs on your schedule &#8211; AI only touches new or changed products, keeping costs minimal',
      ],
      howTo: [
        'Add your feed source(s) &#8211; XML, CSV, TSV or JSON &#8211; and preview the detected fields.',
        'Build your flow: map fields, add rules (e.g. exclude out-of-stock), and drop in AI steps where data is missing or weak.',
        'Preview every step: see exactly what changes on real products before you commit.',
        'Choose a schedule and copy your permanent feed URL into Google Merchant Center. Done.',
      ],
      faq: [
        { q: 'Which formats can I import?', a: 'Google Shopping XML (RSS/Atom), CSV, TSV and JSON. The format is detected automatically.' },
        { q: 'Does AI run on my whole catalog on every update?', a: 'No. Results are cached per product &#8211; AI only runs for new products or when the underlying data changed.' },
        { q: 'Can I use my own trained VM models?', a: 'Yes. Every AI step lets you pick the VM Product Enhancer (default) or any of your custom Virtual Marketer models.' },
      ],
      demo: {
        steps: [
          { label: 'Feed source', icon: 'feed' },
          { label: 'AI enrichment', icon: 'text' },
          { label: 'Preview', icon: 'result' },
        ],
        panels: [
          () => `<p style="color:#d8c5c4;">XML, CSV, TSV or JSON &#8211; format detected automatically.</p>`,
          () => `<p style="color:#d8c5c4;margin-bottom:12px;">Missing attributes get filled in:</p>
        <div class="demo-chip">Color: &#8212; &rarr; Color: Navy</div><br>
        <div class="demo-chip">Material: &#8212; &rarr; Material: Cotton</div>`,
          () => `<p style="color:#d8c5c4;">Title optimized: “Men’s T-Shirt” &rarr; “Men’s T-Shirt Navy, Cotton, Size S&#8211;XL”</p>`,
        ],
      },
    },
  },
  {
    slug: 'texte-generieren',
    heroImage: '/product-pages/single-hero.jpg',
    demoView: 'single',
    slugEn: 'ai-text-generator',
    heroIcon: 'text',
    heroCaption: 'Text Generator',
    de: {
      seo: {
        title: 'KI-Texte für Produktbeschreibungen — einzeln oder im Bulk',
        description: 'Produktbeschreibungen mit deinen markentrainierten KI-Modellen generieren — einzeln oder für hunderte Zeilen per CSV/Excel.',
        keywords: 'Produktbeschreibungen KI generieren, KI Texter Bulk, CSV Produkttexte KI, Produkttexte automatisch schreiben',
      },
      eyebrow: 'KI-Textgenerierung',
      tagline: 'Ein perfekter Text nach dem anderen &#8211; oder hunderte auf einmal.',
      intro: 'Der Einzel-Generator erstellt individuelle Texte mit Ihren markentrainierten Virtual-Marketer-Modellen. Der Bulk-Generator skaliert das auf hunderte Zeilen: CSV oder Excel hochladen, Spalten zuordnen, Texte für jede Zeile generieren &#8211; mit Fortschritt, Wiederholungen und CSV-Export.',
      audiences: [
        { label: 'Shops mit großem Produktkatalog', detail: 'Hunderte Beschreibungen in einem Durchlauf statt einzeln von Hand.' },
        { label: 'Content-Teams', detail: 'Kategorietexte und Snippets in der eigenen Markenstimme.' },
        { label: 'Agenturen', detail: 'Text-Content für mehrere Kunden mit jeweils eigenem Modell.' },
      ],
      impact: {
        heading: 'Was Bulk-Verarbeitung wirklich bringt',
        note: 'Branchenzahlen, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '100+', label: 'Texte pro Durchlauf', sub: 'Bulk-Verarbeitung mit Spalten-Mapping für jedes Dateiformat' },
          { value: '3&ndash;5%', label: 'Fehlerquote unkontrollierter KI-Texte', sub: 'laut Branchendaten &#8211; deshalb: Testzeile vor dem Volllauf prüfen' },
          { value: '1 Markenstimme', label: 'statt Standardtexten', sub: 'in jedem Modell trainiert, statt generischer KI-Ausgabe' },
        ],
        compliance: 'Fehlgeschlagene Zeilen werden markiert und können einzeln wiederholt werden &#8211; ganze Batches müssen nie neu laufen.',
      },
      valueBullets: [
        'Deine Markensprache, in jedem Modell trainiert',
        'Hunderte Texte pro Durchlauf statt einzeln',
        'Spalten-Mapping für jedes Dateiformat',
        'Sicher: einzelne Zeilen testen vor dem Volllauf',
        'Sofort HTML- oder Reintext-Ausgabe, Kopieren oder Download',
      ],
      howTo: [
        'VM-Modell wählen.',
        'Einzeltext: Eingabe einfügen und generieren. Oder: CSV/XLSX hochladen und Spalten zuordnen.',
        'Bei Bulk: Testzeile ausführen, dann den ganzen Batch starten.',
        'Ergebnisse prüfen, kopieren, herunterladen oder als CSV exportieren.',
      ],
      faq: [
        { q: 'Welche Modelle kann ich nutzen?', a: 'Alle Textmodelle Ihres Virtual-Marketer-Plans.' },
        { q: 'Was passiert bei Fehlern im Bulk-Modus?', a: 'Fehlgeschlagene Zeilen werden markiert und können einzeln wiederholt werden.' },
      ],
      demo: {
        steps: [
          { label: 'Modell wählen', icon: 'text' },
          { label: 'CSV hochladen', icon: 'upload' },
          { label: 'Ergebnisse', icon: 'result' },
        ],
        panels: [
          () => `<p style="color:#d8c5c4;">VM-Modell wählen &#8211; Ihre Markenstimme ist bereits trainiert.</p>`,
          (icon) => `<div class="demo-upload-zone">${icon('upload')}<p>CSV mit Produktdaten hier ablegen.</p></div>`,
          () => `<p style="color:#d8c5c4;">3 von 3 Zeilen fertig &#8211; Testzeile geprüft, Batch abgeschlossen.</p>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Text Generator for Product Descriptions — Single or Bulk',
        description: 'Generate product descriptions with your brand-trained AI models — one at a time or for hundreds of rows via CSV/Excel.',
        keywords: 'AI product description generator, bulk AI copywriter, CSV product text AI, automatic product copy generator',
      },
      eyebrow: 'AI Text Generation',
      tagline: 'One perfect text at a time &#8211; or hundreds at once.',
      intro: 'The Single Generator creates individual texts with your brand-trained Virtual Marketer models. The Bulk Generator scales that to hundreds of rows: upload a CSV or Excel file, map your columns, and generate texts for every row &#8211; with progress tracking, retries and CSV export.',
      audiences: [
        { label: 'Shops with a large product catalog', detail: 'Hundreds of descriptions in one run instead of writing them by hand.' },
        { label: 'Content teams', detail: 'Category texts and snippets in your own brand voice.' },
        { label: 'Agencies', detail: 'Text content for multiple clients, each with their own model.' },
      ],
      impact: {
        heading: 'What bulk processing actually gets you',
        note: 'Industry figures, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '100+', label: 'texts per run', sub: 'bulk processing with column mapping for any file layout' },
          { value: '3&ndash;5%', label: 'error rate in unsupervised AI copy', sub: 'per industry data &#8211; which is why a test row before the full run matters' },
          { value: '1 brand voice', label: 'instead of generic copy', sub: 'trained into every model, instead of generic AI output' },
        ],
        compliance: 'Failed rows are marked and can be retried individually &#8211; whole batches never need to rerun.',
      },
      valueBullets: [
        'Your brand voice, trained into every model',
        'Instant HTML or plain text output',
        'Copy or download in one click',
        'Hundreds of texts per batch',
        'Column mapping for any file layout',
        'Safe: test single rows before the full run',
      ],
      howTo: [
        'Pick one of your VM models.',
        'Single text: paste the input and generate. Or: upload CSV/XLSX and map your columns.',
        'For bulk: run a test row, then start the batch.',
        'Review, copy, download or export results as CSV.',
      ],
      faq: [
        { q: 'Which models can I use?', a: 'All text models included in your Virtual Marketer plan.' },
        { q: 'What happens on errors in bulk mode?', a: 'Failed rows are marked and can be retried individually.' },
      ],
      demo: {
        steps: [
          { label: 'Pick a model', icon: 'text' },
          { label: 'Upload CSV', icon: 'upload' },
          { label: 'Results', icon: 'result' },
        ],
        panels: [
          () => `<p style="color:#d8c5c4;">Pick a VM model &#8211; your brand voice is already trained in.</p>`,
          (icon) => `<div class="demo-upload-zone">${icon('upload')}<p>Drop a CSV with product data here.</p></div>`,
          () => `<p style="color:#d8c5c4;">3 of 3 rows done &#8211; test row checked, batch complete.</p>`,
        ],
      },
    },
  },
  {
    slug: 'bilder-generieren',
    heroImage: '/product-pages/image-hero.jpg',
    demoView: 'image',
    slugEn: 'ai-image-generator',
    heroIcon: 'picture',
    heroCaption: 'Image Generator',
    de: {
      seo: {
        title: 'KI-Bildgenerator für Marketing & Produktbilder',
        description: 'Marketing-Visuals aus Text oder Referenzbildern erstellen — mit deinen markentrainierten Virtual-Marketer-Modellen.',
        keywords: 'KI Bildgenerator Marketing, Produktbilder mit KI erstellen, KI Bilder für Unternehmen, Marketing Visuals KI',
      },
      eyebrow: 'KI-Bildgenerierung',
      tagline: 'Bilder, die verkaufen.',
      intro: 'Der Bild-Generator erstellt Marketing-Visuals aus einer Beschreibung &#8211; optional geführt von Referenzbildern für Stil oder Produkttreue.',
      audiences: [
        { label: 'Kleine Marketing-Teams', detail: 'Marketing-Bilder erstellen, ohne eine eigene Grafik-Abteilung zu brauchen.' },
        { label: 'E-Commerce-Shops', detail: 'Produktvisuals für Anzeigen und Kategorie-Seiten in mehreren Formaten.' },
        { label: 'Agenturen', detail: 'Hoher Bildbedarf pro Kunde, konsistent im jeweiligen Markenstil.' },
      ],
      impact: {
        heading: 'Wie verbreitet KI-Bildgenerierung schon ist',
        note: 'Branchenzahl, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '95%', label: 'deutscher Agenturen', sub: 'nutzen laut BVDW-Studie bereits generative KI in der Kreation' },
          { value: '1.000 Wörter', label: 'pro Bild', sub: 'gleiches Wort-Budget wie alle anderen VM-Tools' },
          { value: 'mehrere Formate', label: 'pro Kanal', sub: 'verschiedene Seitenverhältnisse in einem Schritt' },
        ],
        compliance: 'Referenzbilder steuern Stil und Produkttreue &#8211; für konsistente Markenbilder statt Zufallsergebnisse.',
      },
      valueBullets: [
        'Mehrere Formate für jeden Kanal',
        'Referenzbilder für konsistenten Stil',
        'Download in voller Auflösung',
      ],
      howTo: [
        'Bild beschreiben.',
        'Optional Referenzbilder hinzufügen.',
        'Format wählen und generieren.',
      ],
      faq: [
        { q: 'Wie wird abgerechnet?', a: '1.000 Wörter pro Bild.' },
      ],
      demo: {
        steps: [
          { label: 'Beschreibung', icon: 'text' },
          { label: 'Format wählen', icon: 'scene' },
          { label: 'Ergebnis', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-code-block" style="color:#f4ece9;">„Produktfoto eines Sneakers auf hellem Studiohintergrund, weiches Licht, Frontalansicht&#8220;</div>`,
          () => `<div class="demo-swatches"><div class="demo-chip selected">1:1</div><div class="demo-chip">16:9</div><div class="demo-chip">9:16</div></div>`,
          (icon) => `<div class="hero-visual" style="border-radius:12px;min-height:160px;"><div class="hero-visual-icon">${icon('picture')}</div></div>
        <p class="demo-caption">Illustrativ &#8211; das generierte Bild erscheint hier in voller Auflösung.</p>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Image Generator for Marketing & Product Visuals',
        description: 'Create marketing visuals from text or reference images — with your brand-trained Virtual Marketer models.',
        keywords: 'AI image generator marketing, AI product photo generator, AI images for business, marketing visuals AI',
      },
      eyebrow: 'AI Image Generation',
      tagline: 'Pictures that sell.',
      intro: 'The Image Generator creates marketing visuals from a description &#8211; optionally guided by reference images for style or product fidelity.',
      audiences: [
        { label: 'Small marketing teams', detail: 'Create marketing images without needing an in-house design department.' },
        { label: 'E-commerce shops', detail: 'Product visuals for ads and category pages in multiple formats.' },
        { label: 'Agencies', detail: 'High image volume per client, consistent with each brand’s style.' },
      ],
      impact: {
        heading: 'How widespread AI image generation already is',
        note: 'Industry figure, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '95%', label: 'of German agencies', sub: 'already use generative AI in creative work, per a BVDW study' },
          { value: '1,000 words', label: 'per image', sub: 'same word budget as every other VM tool' },
          { value: 'multiple formats', label: 'per channel', sub: 'different aspect ratios in one step' },
        ],
        compliance: 'Reference images control style and product fidelity &#8211; for consistent brand imagery instead of random results.',
      },
      valueBullets: [
        'Multiple aspect ratios for every channel',
        'Reference images for consistent style',
        'Full-resolution download',
      ],
      howTo: [
        'Describe the image.',
        'Optionally add reference images.',
        'Pick a format and generate.',
      ],
      faq: [
        { q: 'How is it billed?', a: '1,000 words per image.' },
      ],
      demo: {
        steps: [
          { label: 'Description', icon: 'text' },
          { label: 'Pick a format', icon: 'scene' },
          { label: 'Result', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-code-block" style="color:#f4ece9;">“Product photo of a sneaker on a bright studio background, soft light, front view”</div>`,
          () => `<div class="demo-swatches"><div class="demo-chip selected">1:1</div><div class="demo-chip">16:9</div><div class="demo-chip">9:16</div></div>`,
          (icon) => `<div class="hero-visual" style="border-radius:12px;min-height:160px;"><div class="hero-visual-icon">${icon('picture')}</div></div>
        <p class="demo-caption">Illustrative &#8211; the generated image appears here in full resolution.</p>`,
        ],
      },
    },
  },
  {
    slug: 'videos-generieren',
    heroImage: '/product-pages/video-hero.jpg',
    demoView: 'video',
    slugEn: 'ai-video-generator',
    heroIcon: 'play',
    heroCaption: 'Video Generator',
    de: {
      seo: {
        title: 'KI-Videogenerator für Marketing-Clips',
        description: 'Marketing-Videos aus Text, Bildern oder durch Verlängern bestehender Clips generieren — für jeden Kanal.',
        keywords: 'KI Video generieren Marketing, KI Videogenerator, Marketing Video KI Tool, KI Werbevideo erstellen',
      },
      eyebrow: 'KI-Videogenerierung',
      tagline: 'Bewegtbild für dein Marketing.',
      intro: 'Kurze Marketing-Videos aus einem Prompt erstellen, Referenzbilder animieren, Start-/Endframes steuern oder bestehende Clips verlängern.',
      audiences: [
        { label: 'Social- &amp; Performance-Marketer', detail: 'Short-Form-Ads schnell produzieren, ohne Videoteam.' },
        { label: 'Kleine Teams ohne Videoproduktion', detail: 'Vom Prompt zum fertigen Clip in einem Werkzeug.' },
        { label: 'Agenturen', detail: 'Hoher Short-Form-Content-Bedarf über mehrere Kunden hinweg.' },
      ],
      impact: {
        heading: 'Wie schnell der Markt wächst',
        note: 'Branchenschätzung zur Gesamtkategorie, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '&#36;716&ndash;946&nbsp;Mio.', label: 'Marktvolumen 2025&ndash;2026', sub: 'weltweiter Markt für KI-Videogenerierung, laut Branchenschätzungen' },
          { value: '4 Modi', label: 'für volle Kontrolle', sub: 'Schnell, Referenzen, Start-/Endframes, Verlängern' },
          { value: '3 Formate', label: '16:9, 9:16, 1:1', sub: 'direkt für jeden Kanal, ohne Nachbearbeitung' },
        ],
        compliance: 'Cloud-gehostete Ergebnisse sind sofort teilbar &#8211; kein separater Download-Umweg.',
      },
      valueBullets: [
        'Vier Generierungsmodi für volle Kontrolle',
        '16:9, 9:16 und 1:1 Ausgabe',
        'Cloud-gehostete Ergebnisse, sofort teilbar',
      ],
      howTo: [
        'Modus wählen (Schnell, Referenzen, Frames, Verlängern).',
        'Prompt und/oder Bilder hinzufügen.',
        'Generieren und herunterladen.',
      ],
      faq: [
        { q: 'Wie wird abgerechnet?', a: '1.000 Wörter pro Videosekunde.' },
      ],
      demo: {
        steps: [
          { label: 'Modus wählen', icon: 'play' },
          { label: 'Prompt & Bilder', icon: 'text' },
          { label: 'Ergebnis', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-swatches">
          <div class="demo-chip selected">Schnell</div><div class="demo-chip">Referenzen</div><div class="demo-chip">Frames</div><div class="demo-chip">Verlängern</div>
        </div>`,
          () => `<div class="demo-code-block" style="color:#f4ece9;">„Produkt dreht sich langsam vor neutralem Hintergrund, weiches Studiolicht&#8220;</div>`,
          (icon) => `<div class="hero-visual" style="border-radius:12px;min-height:160px;"><div class="hero-visual-icon">${icon('play')}</div></div>
        <p class="demo-caption">Illustrativ &#8211; das fertige Video erscheint hier zum Download.</p>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Video Generator for Marketing Clips',
        description: 'Generate marketing videos from text, images, or by extending existing clips — for every channel.',
        keywords: 'AI video generator marketing, AI marketing video tool, AI ad video generator, text to video marketing',
      },
      eyebrow: 'AI Video Generation',
      tagline: 'Motion for your marketing.',
      intro: 'Create short marketing videos from a prompt, animate reference images, control first/last frames or extend existing clips.',
      audiences: [
        { label: 'Social &amp; performance marketers', detail: 'Produce short-form ads fast, without a video team.' },
        { label: 'Small teams without video production', detail: 'From prompt to finished clip in one tool.' },
        { label: 'Agencies', detail: 'High short-form content demand across multiple clients.' },
      ],
      impact: {
        heading: 'How fast this market is growing',
        note: 'Industry estimate for the category as a whole, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '$716&ndash;946M', label: 'market size 2025&ndash;2026', sub: 'global AI video generation market, per industry estimates' },
          { value: '4 modes', label: 'for full control', sub: 'Fast, references, first/last frames, extend' },
          { value: '3 formats', label: '16:9, 9:16, 1:1', sub: 'ready for every channel, no post-processing' },
        ],
        compliance: 'Cloud-hosted results are ready to share instantly &#8211; no separate download detour.',
      },
      valueBullets: [
        'Four generation modes for full control',
        '16:9, 9:16 and 1:1 output',
        'Cloud-hosted results, ready to share',
      ],
      howTo: [
        'Pick a mode (fast, references, frames, extend).',
        'Add prompt and/or images.',
        'Generate and download.',
      ],
      faq: [
        { q: 'How is it billed?', a: '1,000 words per video second.' },
      ],
      demo: {
        steps: [
          { label: 'Pick a mode', icon: 'play' },
          { label: 'Prompt & images', icon: 'text' },
          { label: 'Result', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-swatches">
          <div class="demo-chip selected">Fast</div><div class="demo-chip">References</div><div class="demo-chip">Frames</div><div class="demo-chip">Extend</div>
        </div>`,
          () => `<div class="demo-code-block" style="color:#f4ece9;">“Product slowly rotating against a neutral background, soft studio light”</div>`,
          (icon) => `<div class="hero-visual" style="border-radius:12px;min-height:160px;"><div class="hero-visual-icon">${icon('play')}</div></div>
        <p class="demo-caption">Illustrative &#8211; the finished video appears here for download.</p>`,
        ],
      },
    },
  },
  {
    slug: 'seo-content',
    heroImage: '/product-pages/content-hero.jpg',
    demoView: 'content',
    slugEn: 'ai-seo-content',
    heroIcon: 'seo',
    heroCaption: 'Content Generator',
    de: {
      seo: {
        title: 'KI-SEO-Content aus deiner Sitemap — Blogartikel automatisch',
        description: 'Themen direkt aus deiner Sitemap, vollständige Artikel inklusive Hero-Bildern — kontextbewusst statt generisch.',
        keywords: 'KI SEO Content Generator, Blogartikel automatisch erstellen KI, KI Content aus Sitemap, SEO Text Generator',
      },
      eyebrow: 'KI-SEO-Content',
      tagline: 'Content, der rankt.',
      intro: 'Der Content-Generator liest Themen aus Ihren Sitemap-Quellen, extrahiert Seitenkontext und schreibt vollständige Artikel &#8211; optional mit generierten Hero-Bildern.',
      audiences: [
        { label: 'Inhouse-SEO-Teams', detail: 'Content-Produktion ohne Agentur-Budget skalieren.' },
        { label: 'Content-Marketer mit großem Themenplan', detail: 'Artikel direkt aus der eigenen Seitenstruktur, statt aus dem Nichts.' },
        { label: 'Shops mit vielen Kategorien', detail: 'Laufend neue Kategorietexte, kontextbewusst statt generisch.' },
      ],
      impact: {
        heading: 'Was das für Ihre Content-Produktion bedeutet',
        note: 'Branchenvergleiche zu KI-gestützter Redaktion, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: 'bis 70%', label: 'schnellere Content-Produktion', sub: 'laut Branchenvergleichen für KI-gestützte Redaktionsprozesse' },
          { value: '&minus;45%', label: 'Redaktionskosten', sub: 'laut Branchenvergleichen, bei vergleichbarer Qualität' },
          { value: 'echter Kontext', label: 'statt generischer Prompts', sub: 'Themen und Seiteninhalt kommen direkt aus Ihrer eigenen Sitemap' },
        ],
        compliance: 'Hero-Bilder werden optional automatisch mitgeneriert &#8211; kein separater Bild-Workflow nötig.',
      },
      valueBullets: [
        'Themen direkt aus Ihrer Seitenstruktur',
        'Kontextbewusstes Schreiben aus echten Seiteninhalten',
        'Hero-Bilder inklusive',
      ],
      howTo: [
        'Sitemap-Quellen in den Einstellungen konfigurieren.',
        'Themen auswählen.',
        'Artikel und Bilder generieren.',
      ],
      faq: [
        { q: 'Woher kommen die Themen?', a: 'Aus den Sitemap-Quellen, die Sie in den Einstellungen konfigurieren.' },
      ],
      demo: {
        steps: [
          { label: 'URL eingeben', icon: 'link' },
          { label: 'Kontext lesen', icon: 'seo' },
          { label: 'Artikel-Outline', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-code-block">virtual-marketer.de/sitemap.xml</div>`,
          () => `<p style="color:#d8c5c4;">Liest Seiteninhalt, extrahiert Thema und Kontext &#8230;</p>`,
          () => `<p style="color:#d8c5c4;text-align:left;max-width:360px;margin:0 auto;">H1: Titel<br>H2: Einführung<br>H2: Hauptargument<br>H2: Fazit &amp; CTA</p>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI SEO Content From Your Sitemap — Blog Articles, Automatically',
        description: 'Topics straight from your sitemap, complete articles including hero images — context-aware, not generic.',
        keywords: 'AI SEO content generator, automatic blog article generator AI, AI content from sitemap, SEO text generator',
      },
      eyebrow: 'AI SEO Content',
      tagline: 'Content that ranks.',
      intro: 'The Content Generator reads topics from your sitemap sources, extracts page context and writes complete articles &#8211; optionally with generated hero images.',
      audiences: [
        { label: 'In-house SEO teams', detail: 'Scale content production without an agency budget.' },
        { label: 'Content marketers with a big topic backlog', detail: 'Articles grounded in your own site structure, not written from nothing.' },
        { label: 'Shops with many categories', detail: 'A steady stream of new category copy, context-aware instead of generic.' },
      ],
      impact: {
        heading: 'What this means for your content production',
        note: 'Industry comparisons for AI-assisted editorial work, not a Virtual Marketer-specific promise.',
        cards: [
          { value: 'up to 70%', label: 'faster content production', sub: 'per industry comparisons for AI-assisted editorial processes' },
          { value: '&minus;45%', label: 'editorial cost', sub: 'per industry comparisons, at comparable quality' },
          { value: 'real context', label: 'instead of generic prompts', sub: 'topics and page content come straight from your own sitemap' },
        ],
        compliance: 'Hero images can be generated automatically &#8211; no separate image workflow needed.',
      },
      valueBullets: [
        'Topics straight from your site structure',
        'Context-aware writing from real page content',
        'Hero images included',
      ],
      howTo: [
        'Configure sitemap sources in Settings.',
        'Pick topics.',
        'Generate articles and images.',
      ],
      faq: [
        { q: 'Where do topics come from?', a: 'From the sitemap sources you configure in Settings.' },
      ],
      demo: {
        steps: [
          { label: 'Enter a URL', icon: 'link' },
          { label: 'Read context', icon: 'seo' },
          { label: 'Article outline', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-code-block">virtual-marketer.de/sitemap.xml</div>`,
          () => `<p style="color:#d8c5c4;">Reading page content, extracting topic and context &#8230;</p>`,
          () => `<p style="color:#d8c5c4;text-align:left;max-width:360px;margin:0 auto;">H1: Title<br>H2: Introduction<br>H2: Main argument<br>H2: Conclusion &amp; CTA</p>`,
        ],
      },
    },
  },
  {
    slug: 'kampagnen-builder',
    heroImage: '/product-pages/campaign-hero.jpg',
    demoView: 'campaign',
    slugEn: 'campaign-builder',
    heroIcon: 'megaphone',
    heroCaption: 'Campaign Builder',
    de: {
      seo: {
        title: 'KI-Kampagnen-Builder — von der Idee zu fertigen Assets',
        description: 'Konzepte, Skripte, Videos, Banner und PDFs in einem geführten 4-Schritte-Workflow — konsistent mit deiner Markenidentität.',
        keywords: 'KI Marketingkampagne erstellen, KI Kampagnen Generator, Creative Automation KI, KI Werbekampagne automatisch',
      },
      eyebrow: 'KI-Kampagnen-Builder',
      tagline: 'Die komplette Kampagne in vier Schritten.',
      intro: 'Der Campaign Builder führt vom Briefing zu fertigen Assets: Konzepte, Skripte, Szenenbilder, Videos, Banner und PDF-Dokumente &#8211; konsistent mit Ihrer Markenidentität.',
      audiences: [
        { label: 'Gründer &amp; Marketing-Manager', detail: 'Kampagnen ohne Agentur-Anbindung produzieren.' },
        { label: 'Agenturen', detail: 'Schneller pitchen &#8211; vom Briefing zu fertigen Assets in einem Workflow.' },
        { label: 'Teams mit knappem Kreativ-Budget', detail: 'Konzept bis Asset, ohne mehrere Freelancer zu koordinieren.' },
      ],
      impact: {
        heading: 'Warum das eine reale, wachsende Kategorie ist',
        note: 'Marktbeobachtung zur Kategorie „Creative Automation&#8220;, kein Virtual-Marketer-spezifisches Versprechen.',
        cards: [
          { value: '4 Schritte', label: 'statt Wochen', sub: 'Briefing, Konzept, Skript, fertige Assets &#8211; ein geführter Workflow' },
          { value: 'Video, Banner, PDF', label: 'Ausgabeformate', sub: 'aus einem Briefing, konsistent mit Ihrer Markenidentität' },
          { value: 'reale Kategorie', label: '„Creative Automation&#8220;', sub: 'mit Anbietern wie Omneky, AdCreative.ai und Adobe GenStudio' },
        ],
        compliance: 'Markenfarben, Logos und Charaktere sind einmal hinterlegt und fließen automatisch in jedes Asset ein.',
      },
      valueBullets: [
        'Geführter 4-Schritte-Workflow',
        'Konzepte zur Auswahl, Skripte zum Verfeinern',
        'Video-, Banner-, Carousel- und PDF-Ausgabe',
        'Markenfarben, Logos und Charaktere integriert',
      ],
      howTo: [
        'Kampagnenziel beschreiben.',
        'Konzept wählen.',
        'Skript verfeinern.',
        'Alle Assets produzieren und exportieren.',
      ],
      faq: [
        { q: 'Kann ich Einstellungen wiederverwenden?', a: 'Ja &#8211; Markenidentität, Charaktere und Feeds liegen in den Kampagnen-Einstellungen.' },
      ],
      demo: {
        steps: [
          { label: 'Briefing', icon: 'text' },
          { label: 'Konzept', icon: 'megaphone' },
          { label: 'Skript', icon: 'seo' },
          { label: 'Assets', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-code-block">Ziel: Sommer-Kollektion bewerben, Zielgruppe 20&ndash;35, Kanal Instagram</div>`,
          () => `<div class="demo-swatches"><div class="demo-chip selected">Konzept A: „Sommerfrische&#8220;</div><div class="demo-chip">Konzept B: „Stadtlook&#8220;</div></div>`,
          () => `<p style="color:#d8c5c4;text-align:left;max-width:360px;margin:0 auto;">Szene 1: Produkt in Nahaufnahme &#8211; „Der Sommer ruft.&#8220;<br>Szene 2: Lifestyle-Moment &#8211; „Bereit für alles.&#8220;</p>`,
          () => `<div class="demo-swatches"><div class="demo-chip">Video 9:16</div><div class="demo-chip">Banner</div><div class="demo-chip">PDF</div></div>`,
        ],
      },
    },
    en: {
      seo: {
        title: 'AI Campaign Builder — From Idea to Finished Assets',
        description: 'Concepts, scripts, videos, banners and PDFs in a guided 4-step workflow — consistent with your brand identity.',
        keywords: 'AI campaign generator, AI marketing campaign builder, creative automation AI, AI ad campaign generator',
      },
      eyebrow: 'AI Campaign Builder',
      tagline: 'A full campaign in four steps.',
      intro: 'The Campaign Builder guides you from briefing to finished assets: concepts, scripts, scene images, videos, banners and PDF documents &#8211; consistent with your brand identity.',
      audiences: [
        { label: 'Founders &amp; marketing managers', detail: 'Produce campaigns without an agency relationship.' },
        { label: 'Agencies', detail: 'Pitch faster &#8211; from briefing to finished assets in one workflow.' },
        { label: 'Teams on a tight creative budget', detail: 'Concept to asset, without coordinating several freelancers.' },
      ],
      impact: {
        heading: 'Why this is a real, growing category',
        note: 'Market observation on the “creative automation” category, not a Virtual Marketer-specific promise.',
        cards: [
          { value: '4 steps', label: 'instead of weeks', sub: 'briefing, concept, script, finished assets &#8211; a guided workflow' },
          { value: 'Video, banner, PDF', label: 'output formats', sub: 'from one briefing, consistent with your brand identity' },
          { value: 'real category', label: '“Creative automation”', sub: 'with players like Omneky, AdCreative.ai and Adobe GenStudio' },
        ],
        compliance: 'Brand colors, logos and characters are stored once and flow into every asset automatically.',
      },
      valueBullets: [
        'Guided 4-step workflow',
        'Concepts to choose from, scripts to refine',
        'Video, banner, carousel and PDF output',
        'Brand colors, logos and characters built in',
      ],
      howTo: [
        'Describe your campaign goal.',
        'Pick a concept.',
        'Refine the script.',
        'Produce all assets and export.',
      ],
      faq: [
        { q: 'Can I reuse settings?', a: 'Yes &#8211; brand identity, characters and feeds are stored in your campaign settings.' },
      ],
      demo: {
        steps: [
          { label: 'Brief', icon: 'text' },
          { label: 'Concept', icon: 'megaphone' },
          { label: 'Script', icon: 'seo' },
          { label: 'Assets', icon: 'result' },
        ],
        panels: [
          () => `<div class="demo-code-block">Goal: promote summer collection, audience 20&ndash;35, channel Instagram</div>`,
          () => `<div class="demo-swatches"><div class="demo-chip selected">Concept A: “Summer Fresh”</div><div class="demo-chip">Concept B: “City Look”</div></div>`,
          () => `<p style="color:#d8c5c4;text-align:left;max-width:360px;margin:0 auto;">Scene 1: product close-up &#8211; “Summer is calling.”<br>Scene 2: lifestyle moment &#8211; “Ready for anything.”</p>`,
          () => `<div class="demo-swatches"><div class="demo-chip">Video 9:16</div><div class="demo-chip">Banner</div><div class="demo-chip">PDF</div></div>`,
        ],
      },
    },
  },
  {
    slug: 'interne-verlinkung',
    heroImage: '/product-pages/linkinator-hero.jpg',
    demoView: 'linkinator',
    slugEn: 'internal-linking',
    heroIcon: 'link',
    heroCaption: 'Linkinator',
    de: {
      seo: {
        title: 'Interne Verlinkung automatisch — KI-Linkinator für SEO',
        description: 'Keyword→URL-Karte aus deiner Sitemap, automatisch in jeden Text eingewoben — einzeln oder im Bulk, CMS-unabhängig.',
        keywords: 'interne Verlinkung Tool, automatische interne Links SEO, SEO interne Verlinkung Software, Linkinator SEO',
      },
      eyebrow: 'Interne Verlinkung',
      tagline: 'Interne Verlinkung im Autopilot.',
      intro: 'Der Linkinator baut eine Keyword&rarr;URL-Karte aus Ihrer Sitemap und fügt interne Links in beliebige Texte ein &#8211; einzeln oder im Batch, unabhängig vom verwendeten CMS.',
      audiences: [
        { label: 'Inhouse-SEOs', detail: 'Interne Verlinkung über große Content-Bibliotheken hinweg, ohne manuelle Link-Suche.' },
        { label: 'Agenturen', detail: 'Mehrere Kunden-Websites mit einer Keyword-Karte pro Kunde betreuen.' },
      ],
      valueBullets: [
        'Keyword-Karte aus Ihrer echten Website',
        'Einzel- und CSV-Batch-Modus',
        'SEO-Boost ohne manuelle Handarbeit',
        'Funktioniert unabhängig vom CMS &#8211; sitemap-basiert statt an ein System gebunden',
      ],
      howTo: [
        'Link-Karte aus der Sitemap erstellen.',
        'Text einfügen oder CSV hochladen.',
        'Links einfügen, prüfen, exportieren.',
      ],
      faq: [
        { q: 'Wo liegt die Karte?', a: 'Lokal in Ihrem Browser &#8211; jederzeit neu aufbaubar.' },
        { q: 'Funktioniert das mit jedem CMS?', a: 'Ja &#8211; die Karte basiert auf Ihrer Sitemap, nicht auf einem bestimmten System wie WordPress.' },
      ],
    },
    en: {
      seo: {
        title: 'Automatic Internal Linking — AI Linkinator for SEO',
        description: 'A keyword→URL map built from your sitemap, woven automatically into any text — single or bulk, CMS-independent.',
        keywords: 'internal linking tool, automatic internal links SEO, SEO internal linking software, internal link builder AI',
      },
      eyebrow: 'Internal Linking',
      tagline: 'Internal linking on autopilot.',
      intro: 'The Linkinator builds a keyword&rarr;URL map from your sitemap and injects internal links into any text &#8211; single or in bulk, independent of the CMS you use.',
      audiences: [
        { label: 'In-house SEOs', detail: 'Internal linking across large content libraries, without manual link-hunting.' },
        { label: 'Agencies', detail: 'Manage several client sites with one keyword map per client.' },
      ],
      valueBullets: [
        'Keyword map from your real site',
        'Single and CSV bulk mode',
        'SEO boost without manual work',
        'Works independent of your CMS &#8211; sitemap-based rather than tied to one system',
      ],
      howTo: [
        'Build the link map from your sitemap.',
        'Paste text or upload CSV.',
        'Inject links, review, export.',
      ],
      faq: [
        { q: 'Where is the map stored?', a: 'Locally in your browser &#8211; rebuild anytime.' },
        { q: 'Does this work with any CMS?', a: 'Yes &#8211; the map is built from your sitemap, not tied to a specific system like WordPress.' },
      ],
    },
  },
  {
    slug: 'mail-generator',
    heroImage: '/product-pages/email-hero.jpg',
    demoView: 'mail',
    slugEn: 'ai-email-generator',
    heroIcon: 'mail',
    heroCaption: 'Mail Generator (Beta)',
    de: {
      seo: {
        title: 'KI-E-Mail-Generator — erstellen und über dein eigenes SMTP versenden',
        description: 'Marketing-E-Mail generieren, in der Vorschau prüfen und direkt über dein eigenes SMTP versenden — alles an einem Ort (Beta).',
        keywords: 'KI E-Mail Marketing Text generieren, Newsletter KI Texter, Marketing Email KI Generator deutsch',
      },
      eyebrow: 'KI-E-Mail-Generator (Beta)',
      tagline: 'Von der Idee in die Inbox.',
      intro: 'Generieren Sie eine Marketing-E-Mail mit Ihrem VM-Mail-Modell, prüfen Sie sie in der Vorschau und versenden Sie sie über Ihr eigenes SMTP &#8211; alles an einem Ort.',
      audiences: [
        { label: 'Kleine Marketing-Teams', detail: 'E-Mail-Texte ohne eigene ESP-KI erstellen.' },
        { label: 'Solo-Marketer', detail: 'Vorhandene SMTP-Infrastruktur und Absender-Reputation weiter nutzen, statt zu wechseln.' },
      ],
      valueBullets: [
        'Markenkonforme E-Mail-Texte',
        'Live-Vorschau',
        'Versand über Ihr eigenes SMTP &#8211; kein Umweg über einen separaten ESP',
      ],
      howTo: [
        'SMTP in den Einstellungen konfigurieren.',
        'Mail beschreiben und generieren.',
        'Vorschau prüfen und senden.',
      ],
      faq: [
        { q: 'Beta?', a: 'Ja &#8211; Feedback gern an info@virtual-marketer.de.' },
      ],
    },
    en: {
      seo: {
        title: 'AI Email Generator — Write and Send via Your Own SMTP',
        description: 'Generate a marketing email, preview it and send it through your own SMTP — all in one place (Beta).',
        keywords: 'AI email marketing generator, AI newsletter writer, AI marketing email tool',
      },
      eyebrow: 'AI Email Generator (Beta)',
      tagline: 'From idea to inbox.',
      intro: 'Generate a marketing email with your VM mail model, preview it and send it through your own SMTP &#8211; all in one place.',
      audiences: [
        { label: 'Small marketing teams', detail: 'Create email copy without a dedicated ESP AI feature.' },
        { label: 'Solo marketers', detail: 'Keep using your existing SMTP infrastructure and sender reputation instead of switching.' },
      ],
      valueBullets: [
        'On-brand email copy',
        'Live preview',
        'Sends via your own SMTP &#8211; no detour through a separate ESP',
      ],
      howTo: [
        'Configure SMTP in Settings.',
        'Describe the email and generate.',
        'Preview and send.',
      ],
      faq: [
        { q: 'Beta?', a: 'Yes &#8211; feedback welcome at info@virtual-marketer.de.' },
      ],
    },
  },
  {
    slug: 'social-publisher',
    slugEn: 'social-publisher',
    heroImage: '/product-pages/social-hero.jpg',
    demoView: 'socialPublisher',
    de: {
      seo: {
        title: 'KI Social Publisher — LinkedIn-Beiträge planen & autonom veröffentlichen',
        description: 'Persona-gesteuerte LinkedIn-Beiträge nach festem Zeitplan oder durch autonomes Themen-Scanning — standardmäßig mit menschlicher Freigabe.',
        keywords: 'LinkedIn Beiträge automatisch posten, Social Media KI Tool, LinkedIn Automatisierung, KI Social Media Planer, Social Posts KI generieren',
      },
      eyebrow: 'KI Social Publisher',
      tagline: 'Deine LinkedIn-Präsenz im Autopilot.',
      intro: 'VM Social Publisher erstellt eine konsistente Persona für deine Marke und schreibt und illustriert LinkedIn-Beiträge nach festem Zeitplan oder durch autonomes Scannen deiner Themen-Nische &#8211; immer mit deinem Referenzbild für visuelle Konsistenz und standardmäßig mit Freigabe-Pflicht.',
      audiences: [
        { label: 'Marketing-Teams ohne Zeit fürs tägliche Posten', detail: 'Regelmäßige, markenkonforme Beiträge, ohne jeden Tag selbst zu texten.' },
        { label: 'Gründer:innen &amp; Personal Brands', detail: 'Sichtbar bleiben auf LinkedIn, während das Tagesgeschäft läuft.' },
        { label: 'Agenturen', detail: 'Eine Persona pro Kunde, Freigabe-Workflow inklusive.' },
      ],
      valueBullets: [
        'Wiederverwendbare Personas: Name, Hintergrundinfo, Referenzbild und Wahl des Textmodells',
        'Feste wöchentliche Zeitfenster oder autonomes stündliches Themen-Scanning mit Relevanz-Schwelle',
        'Optionale Beschränkung auf ein aktives Zeitfenster nach Wochentag und Stunde',
        'Auto-Publish ist standardmäßig aus &#8211; Beiträge warten auf deine Freigabe',
        'Ein Klick für „Jetzt generieren&#8220; und „Jetzt veröffentlichen&#8220; zur manuellen Kontrolle',
        'Optionales sichtbares Wasserzeichen auf generierten Bildern',
      ],
      howTo: [
        'LinkedIn einmalig unter Einstellungen &rarr; Konnektoren &rarr; Zugriff verbinden.',
        'Persona erstellen &#8211; Name, Hintergrundinfo und Referenzbild festlegen (oder aus deinem LinkedIn-Profil importieren).',
        'Zeitplan erstellen: feste Zeiten oder autonomes Scanning, optional mit aktivem Zeitfenster.',
        'Generierte Beiträge im Tab „Beiträge&#8220; oder unter Einstellungen &rarr; Konnektoren &rarr; Freigaben prüfen und veröffentlichen.',
      ],
      faq: [
        { q: 'Werden Beiträge automatisch veröffentlicht?', a: 'Nur wenn du Auto-Publish für einen Zeitplan aktivierst. Standardmäßig wartet jeder generierte Beitrag auf deine Freigabe.' },
        { q: 'Kann ich auch manuell posten?', a: 'Ja &#8211; nutze „Jetzt generieren&#8220; mit einer Persona und optionalem Thema, dann „Jetzt veröffentlichen&#8220;, wenn du bereit bist.' },
        { q: 'Welche Plattformen werden unterstützt?', a: 'Aktuell LinkedIn; weitere Plattformen sind geplant.' },
      ],
    },
    en: {
      seo: {
        title: 'AI Social Publisher — Schedule & Autonomously Publish LinkedIn Posts',
        description: 'Persona-driven LinkedIn posts on a fixed schedule or via autonomous topic scanning — with human approval built in by default.',
        keywords: 'auto post LinkedIn AI, social media AI tool, LinkedIn automation, AI social media scheduler, generate social posts AI',
      },
      eyebrow: 'AI Social Publisher',
      tagline: 'Your LinkedIn presence, on autopilot.',
      intro: 'VM Social Publisher creates a consistent persona for your brand, then writes and illustrates LinkedIn posts on a fixed schedule or by autonomously scanning your topic niche &#8211; always with your reference image for visual consistency, and approval-gated by default.',
      audiences: [
        { label: 'Marketing teams without time to post daily', detail: 'Regular, on-brand posts without writing them yourself every day.' },
        { label: 'Founders &amp; personal brands', detail: 'Stay visible on LinkedIn while the day-to-day business runs.' },
        { label: 'Agencies', detail: 'One persona per client, approval workflow included.' },
      ],
      valueBullets: [
        'Reusable personas: name, background info, reference image and choice of text model',
        'Fixed weekly time slots, or autonomous hourly topic scanning with a relevance threshold',
        'Optional active-window gating by weekday and hour',
        'Auto-publish is off by default &#8211; posts wait for your approval',
        "One-click 'Generate now' and 'Publish now' for manual control anytime",
        'Optional visible watermark on generated images',
      ],
      howTo: [
        'Connect LinkedIn once in Settings &rarr; Connectors &rarr; Access.',
        'Create a persona &#8211; give it a name, background info and a reference image (or import from your LinkedIn profile).',
        'Create a schedule: fixed times or autonomous scanning, plus an optional active window.',
        'Review generated posts in the Posts tab or in Settings &rarr; Connectors &rarr; Approvals, then publish.',
      ],
      faq: [
        { q: 'Do posts publish automatically?', a: 'Only if you turn on Auto-publish for a schedule. By default, every generated post waits for your approval.' },
        { q: 'Can I post manually too?', a: "Yes &#8211; use 'Generate now' with any persona and an optional topic, then 'Publish now' when you're ready." },
        { q: 'Which platforms are supported?', a: 'LinkedIn today; more platforms are planned.' },
      ],
    },
  },
  {
    slug: 'bulk-texte',
    slugEn: 'bulk-text-generator',
    heroImage: '/product-pages/bulk-hero.jpg',
    demoView: 'bulk',
    de: {
      seo: {
        title: 'Produkttexte in Masse generieren — KI Bulk-Generator für CSV & Excel',
        description: 'Hunderte Produkttexte in einem Durchlauf: CSV oder Excel hochladen, Spalten zuordnen, generieren, als CSV exportieren — in deiner Markensprache.',
        keywords: 'Produkttexte in Masse generieren, Bulk KI Texte, CSV Produktbeschreibungen KI, Produkttexte automatisch erstellen, Excel Texte generieren',
      },
      eyebrow: 'KI Bulk-Generator',
      tagline: 'Content-Produktion skalieren.',
      intro: 'CSV- oder Excel-Datei hochladen, Spalten zuordnen und Texte für jede Zeile generieren &#8211; mit Fortschritt, Wiederholungen und CSV-Export.',
      audiences: [
        { label: 'Shops mit großem Sortiment', detail: 'Hunderte Produktbeschreibungen pro Durchlauf statt einzeln von Hand.' },
        { label: 'Marktplatz-Händler', detail: 'Ein Dateiformat rein, fertige Texte als CSV zurück in jedes System.' },
        { label: 'Agenturen mit Katalog-Projekten', detail: 'Kundenkataloge in der jeweiligen Markensprache abarbeiten.' },
      ],
      valueBullets: [
        'Hunderte Texte pro Durchlauf',
        'Spalten-Mapping für jedes Dateiformat',
        'Sicher: einzelne Zeilen testen vor dem Volllauf',
      ],
      howTo: [
        'CSV/XLSX hochladen.',
        'Eingabespalten zuordnen.',
        'Testzeile ausführen, dann Batch starten.',
        'Ergebnisse als CSV exportieren.',
      ],
      faq: [
        { q: 'Was passiert bei Fehlern?', a: 'Fehlgeschlagene Zeilen werden markiert und können einzeln wiederholt werden.' },
      ],
    },
    en: {
      seo: {
        title: 'AI Bulk Text Generator — Product Copy for Whole Spreadsheets',
        description: 'Hundreds of product texts in one batch: upload CSV or Excel, map your columns, generate, export as CSV — in your brand voice.',
        keywords: 'bulk product descriptions AI, CSV product copy generator, batch AI text generation, generate product texts from spreadsheet',
      },
      eyebrow: 'AI Bulk Generator',
      tagline: 'Scale your content production.',
      intro: 'Upload a CSV or Excel file, map your columns, and generate texts for every row &#8211; with progress tracking, retries and CSV export.',
      audiences: [
        { label: 'Shops with large catalogs', detail: 'Hundreds of product descriptions per batch instead of one by one.' },
        { label: 'Marketplace sellers', detail: 'One file format in, finished texts back out as CSV for any system.' },
        { label: 'Agencies with catalog projects', detail: 'Work through client catalogs in each client&rsquo;s brand voice.' },
      ],
      valueBullets: [
        'Hundreds of texts per batch',
        'Column mapping for any file layout',
        'Safe: test single rows before the full run',
      ],
      howTo: [
        'Upload CSV/XLSX.',
        'Map the input columns.',
        'Run a test row, then start the batch.',
        'Export results as CSV.',
      ],
      faq: [
        { q: 'What happens on errors?', a: 'Failed rows are marked and can be retried individually.' },
      ],
    },
  },
  {
    slug: 'ki-dateien',
    slugEn: 'ai-files',
    heroImage: '/product-pages/files-hero.jpg',
    demoView: 'files',
    de: {
      seo: {
        title: 'KI-Dateiablage — Berichte & Präsentationen Ihrer KI-Agenten an einem Ort',
        description: 'Alles, was Ihre virtuellen Mitarbeiter erstellen — Berichte, Präsentationen, Notizen — durchsuchbar an einem Ort, inkl. Vollbild-Präsentationsmodus.',
        keywords: 'KI Berichte Ablage, KI Agent Ergebnisse verwalten, automatische Reports KI, KI Präsentationen erstellen, Dokumente KI Agenten',
      },
      eyebrow: 'Dateien &amp; Berichte',
      tagline: 'Jeder Bericht, einen Klick entfernt.',
      intro: 'Die Dateien-Ansicht sammelt alles, was Ihre virtuellen Mitarbeiter produzieren &#8211; Berichte, Präsentationen und Notizen &#8211; in einer durchsuchbaren Ablage. Ordner durchstöbern, Berichte formatiert lesen, Präsentationen im Vollbild-Folienmodus abspielen und eigene Notizen direkt neben den Agenten-Ergebnissen führen.',
      audiences: [
        { label: 'Teams mit laufenden KI-Agenten', detail: 'Morgendliche Reports und Audits landen automatisch sortiert in der Ablage.' },
        { label: 'Führungskräfte', detail: 'Agenten-Präsentationen direkt im Vollbild vorführen, ohne Umweg über andere Tools.' },
        { label: 'Agenturen', detail: 'Arbeitsergebnisse pro Konto gebündelt, jederzeit als Download teilbar.' },
      ],
      valueBullets: [
        'Alle Agenten-Ergebnisse an einem Ort: Berichte, Präsentationen, Notizen und mehr',
        'Ordnerbaum und Typ-Filter &#8211; jedes Dokument in Sekunden gefunden',
        'Eine Suche über Ihre Dateien UND Ihre generierten Produktbilder',
        'Präsentationsmodus: Vollbild-Folien mit Tastatur-Navigation',
        'Eigene Markdown-Notizen schreiben und bearbeiten, alles jederzeit herunterladen',
      ],
      howTo: [
        'Dateien öffnen &#8211; alles, was Ihre Agenten gespeichert haben, ist bereits da.',
        'Ordnerbaum durchstöbern oder nach Typ filtern (Berichte, Präsentationen, Notizen).',
        'Datei anklicken zum Lesen; Präsentationen lassen sich im Vollbild abspielen.',
        'Die Suche findet Dateien und generierte Bilder in einem Durchgang.',
        'Mit „Neue Notiz&#8220; eigene Notizen anlegen &#8211; sie liegen direkt neben den Agenten-Dateien.',
      ],
      faq: [
        { q: 'Woher kommen die Dateien?', a: 'Ihre Virtual-Marketer-Agenten speichern ihre Arbeitsergebnisse &#8211; Berichte, Präsentationen, Notizen &#8211; automatisch hier. Eigene Notizen können Sie zusätzlich anlegen und bearbeiten.' },
        { q: 'Kann ich Dateien herunterladen?', a: 'Ja, jede Datei lässt sich mit einem Klick herunterladen. Außerdem können Sie Dateien umbenennen, zwischen Ordnern verschieben und Überflüssiges löschen.' },
        { q: 'Was deckt die Suche ab?', a: 'Ein Suchfeld durchsucht Ihre Dateiablage und die mit VM Product Staging generierten Produktbilder &#8211; die Ergebnisse erscheinen nebeneinander.' },
      ],
    },
    en: {
      seo: {
        title: 'AI Files — Your AI Agents&rsquo; Reports & Presentations in One Place',
        description: 'Everything your virtual employees produce — reports, presentations, notes — searchable in one library, incl. full-screen presentation mode.',
        keywords: 'AI agent reports library, manage AI agent output, automatic AI reports, AI presentations, AI agent documents',
      },
      eyebrow: 'Files &amp; Reports',
      tagline: 'Every report, one click away.',
      intro: 'The Files view collects everything your virtual employees produce &#8211; reports, presentations and notes &#8211; in one searchable library. Browse folders, read reports with rich formatting, play presentations in full-screen slide mode and keep your own notes right next to the agent output.',
      audiences: [
        { label: 'Teams running AI agents', detail: 'Morning reports and audits land in the library automatically, already organized.' },
        { label: 'Executives', detail: 'Play agent-built presentations full-screen, no detour through other tools.' },
        { label: 'Agencies', detail: 'Deliverables bundled per account, downloadable and shareable anytime.' },
      ],
      valueBullets: [
        'All agent output in one place: reports, presentations, notes and more',
        'Folder tree and type filters to find any document in seconds',
        'One search across your files AND your generated product images',
        'Presentation mode: full-screen slides with keyboard navigation',
        'Write and edit your own markdown notes, download everything anytime',
      ],
      howTo: [
        'Open Files &#8211; everything your agents have saved is already there.',
        'Browse the folder tree or filter by type (reports, presentations, notes).',
        'Click a file to read it; presentations can be played full-screen.',
        'Use the search box to search files and generated images at once.',
        "Create your own notes with 'New note' &#8211; they live alongside the agent files.",
      ],
      faq: [
        { q: 'Where do the files come from?', a: 'Your Virtual Marketer agents save their work results &#8211; reports, presentations, notes &#8211; here automatically. You can also create and edit your own notes.' },
        { q: 'Can I download files?', a: 'Yes, every file can be downloaded with one click. You can also rename files, move them between folders and delete what you no longer need.' },
        { q: 'What does the search cover?', a: 'One search box covers your file library and the product images generated with VM Product Staging &#8211; results are shown side by side.' },
      ],
    },
  },
  {
    slug: 'feed-optimierung',
    slugEn: 'feed-optimizer',
    heroImage: '/product-pages/feedopt-hero.jpg',
    demoView: 'feed',
    de: {
      seo: {
        title: 'Feed-Optimizer — Produktbeschreibungen aus dem Shopping-Feed im Batch verbessern',
        description: 'Shopping-Feed laden, Produkte filtern, Beschreibungen im Batch mit Ihren VM-Modellen neu schreiben und als CSV exportieren.',
        keywords: 'Produktbeschreibungen optimieren KI, Shopping Feed Beschreibungen verbessern, Feed Texte KI, Google Shopping Feed optimieren',
      },
      eyebrow: 'Feed-Optimierung',
      tagline: 'Bessere Beschreibungen, schnell.',
      intro: 'Der Feed-Optimizer lädt deinen Shopping-Feed, filtert Produkte und schreibt Beschreibungen im Batch mit deinen VM-Modellen um.',
      audiences: [
        { label: 'Shops mit bestehendem Google-Shopping-Feed', detail: 'Schwache Herstellertexte gezielt neu schreiben, ohne das Feed-Setup anzufassen.' },
        { label: 'E-Commerce-Teams', detail: 'Nach Kategorie oder Marke filtern und genau die Produkte verbessern, die es brauchen.' },
      ],
      valueBullets: [
        'Filter nach Kategorie, Marke, Verfügbarkeit u.m.',
        'Batch-Verarbeitung mit Fortschritt und Abbruch',
        'CSV-Export der neuen Beschreibungen',
      ],
      howTo: [
        'Feed-URL in den Einstellungen hinterlegen.',
        'Produkte laden und filtern.',
        'Zeilen auswählen und verarbeiten.',
        'CSV herunterladen.',
      ],
      faq: [
        { q: 'Volles Feed-Management gewünscht?', a: 'Nutze VM Feed Enhance für Import, Regeln, AI-Veredelung und einen gehosteten Ausgabe-Feed.' },
      ],
    },
    en: {
      seo: {
        title: 'Feed Optimizer — Batch-Improve Product Descriptions from Your Shopping Feed',
        description: 'Load your shopping feed, filter products, rewrite their descriptions in batches with your VM models and export as CSV.',
        keywords: 'optimize product descriptions AI, improve shopping feed descriptions, feed copy AI, optimize Google Shopping feed',
      },
      eyebrow: 'Feed Optimization',
      tagline: 'Better descriptions, fast.',
      intro: 'The Feed Optimizer loads your shopping feed, lets you filter products and rewrites their descriptions in batches with your VM models.',
      audiences: [
        { label: 'Shops with an existing Google Shopping feed', detail: 'Rewrite weak manufacturer copy without touching your feed setup.' },
        { label: 'E-commerce teams', detail: 'Filter by category or brand and improve exactly the products that need it.' },
      ],
      valueBullets: [
        'Filter by category, brand, availability and more',
        'Batch processing with progress and cancel',
        'CSV export of the new descriptions',
      ],
      howTo: [
        'Set your feed URL in Settings.',
        'Load and filter products.',
        'Select rows and process.',
        'Download the CSV.',
      ],
      faq: [
        { q: 'Need full feed management?', a: 'Use VM Feed Enhance for import, rules, AI enrichment and a hosted output feed.' },
      ],
    },
  },
  {
    slug: 'chat-insights',
    slugEn: 'chat-insights',
    heroImage: '/product-pages/qaagent-hero.jpg',
    demoView: 'agent',
    de: {
      seo: {
        title: 'Chat-Insights — Kundengespräche Ihres Chat-Agenten analysieren',
        description: 'Session-Protokolle Ihres Chat-Agenten mit Stimmungs- und Themenanalyse — sehen, was Kunden wirklich fragen, und Lücken in Katalog & Content erkennen.',
        keywords: 'Chatbot Analyse, Chat Auswertung KI, Kundenfragen analysieren, Sentiment Analyse Chatbot, Chatbot Insights',
      },
      eyebrow: 'Chat-Insights',
      tagline: 'Wissen, was Kunden fragen.',
      intro: 'Der Agent-Viewer lädt die Session-Logs deines Chat-Agenten und analysiert Stimmung und Themen &#8211; du siehst, was Kunden wirklich wollen.',
      audiences: [
        { label: 'Shops mit Virtual-Marketer-Chat-Agent', detail: 'Aus echten Kundengesprächen lernen, statt zu raten.' },
        { label: 'Produkt- &amp; Content-Teams', detail: 'Häufige Fragen zeigen, welche Infos auf Produktseiten fehlen.' },
      ],
      valueBullets: [
        'Vollständige Gesprächsprotokolle',
        'Stimmungs- &amp; Themenanalyse',
        'Lücken in Katalog und Content erkennen',
      ],
      howTo: [
        'Viewer öffnen.',
        'Session auswählen.',
        'Analyse lesen.',
      ],
      faq: [
        { q: 'Woher kommen die Sessions?', a: 'Aus deinem Virtual-Marketer-Chat-Agent-Deployment.' },
      ],
    },
    en: {
      seo: {
        title: 'Chat Insights — Analyze Your Chat Agent&rsquo;s Customer Conversations',
        description: 'Your chat agent&rsquo;s session logs with sentiment and topic analysis — see what customers really ask and spot gaps in catalog & content.',
        keywords: 'chatbot analytics, AI chat analysis, analyze customer questions, chatbot sentiment analysis, chatbot insights',
      },
      eyebrow: 'Chat Insights',
      tagline: 'Know what your customers ask.',
      intro: 'The Agent Viewer pulls your chat agent session logs and analyzes sentiment and topics so you see what customers really want.',
      audiences: [
        { label: 'Shops running the Virtual Marketer chat agent', detail: 'Learn from real customer conversations instead of guessing.' },
        { label: 'Product &amp; content teams', detail: 'Frequent questions reveal what information your product pages are missing.' },
      ],
      valueBullets: [
        'Full session transcripts',
        'Sentiment &amp; topic analysis',
        'Spot gaps in your catalog and content',
      ],
      howTo: [
        'Open the viewer.',
        'Pick a session.',
        'Read the analysis.',
      ],
      faq: [
        { q: 'Where do sessions come from?', a: 'From your Virtual Marketer chat agent deployment.' },
      ],
    },
  },
];

function icon(name, className = '') {
  const icons = {
    upload: '<path d="M12 3v12m0-12 4 4m-4-4-4 4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>',
    model: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>',
    scene: '<path d="M4 17 9 9l4 5 3-3 4 6H4Z"/><circle cx="8" cy="7" r="1.3"/>',
    result: '<path d="m5 12 4.5 4.5L19 7"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    code: '<path d="m9 18-6-6 6-6"/><path d="m15 6 6 6-6 6"/>',
    feed: '<rect x="4" y="5" width="16" height="4" rx="1"/><rect x="4" y="11" width="16" height="4" rx="1"/><rect x="4" y="17" width="10" height="3" rx="1"/>',
    text: '<path d="M5 5h14M5 10h14M5 15h9"/>',
    picture: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5-9 9"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3V9z"/>',
    seo: '<circle cx="10" cy="10" r="6"/><path d="m21 21-5.5-5.5"/>',
    megaphone: '<path d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5l-4 4H4a1 1 0 0 0-1 1Z"/><path d="M15 8a4 4 0 0 1 0 8"/><path d="M18 5a8 8 0 0 1 0 14"/>',
    link: '<path d="M9 12a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1"/><path d="M15 12a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 6 8 7 8-7"/>',
    agent: '<rect x="5" y="7" width="14" height="11" rx="2"/><circle cx="9.5" cy="12.5" r="1.2"/><circle cx="14.5" cy="12.5" r="1.2"/><path d="M12 3v4"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M12 15h5"/>',
  };
  return `<svg viewBox="0 0 24 24" class="${className}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
}

/**
 * Photographic scene shot for a feature, by convention
 * assets/product-pages/<slug>-scene.jpg (see scripts/generate-ai-images.js).
 * Resolved by looking on disk rather than listing filenames in each FEATURES
 * entry, so adding an image to that folder is all it takes to light one up.
 */
// The six-model cast used by the try-on demo. Ids match the filenames written
// by scripts/generate-ai-images.js, so the gallery, the hover poses and the
// model x scene result matrix all resolve from one list.
const TRYON_CAST = [
  { id: 'ruby',  name: 'Ruby' },
  { id: 'nadia', name: 'Nadia' },
  { id: 'kai',   name: 'Kai' },
  { id: 'marco', name: 'Marco' },
  { id: 'lena',  name: 'Lena' },
  { id: 'amara', name: 'Amara' },
];
const TRYON_SCENE_IDS = ['studio', 'street', 'cafe'];

const hasAsset = (rel) => fs.existsSync(path.join(ROOT, 'assets', rel.replace(/^\//, '')));

/** Models that have a full base frame plus all three scene variants. */
function availableCast() {
  return TRYON_CAST.filter(
    (m) => hasAsset(`/product-pages/model-${m.id}-base.jpg`) &&
           TRYON_SCENE_IDS.every((sc) => hasAsset(`/product-pages/model-${m.id}-${sc}.jpg`))
  );
}

/**
 * Model gallery for the demo's "choose a model" step.
 *
 * Two behaviours the earlier version lacked:
 *
 *  - Hovering a model swaps in a posed frame of the SAME person in the SAME
 *    outfit against the SAME backdrop, generated image-to-image from the base
 *    so only the body position differs. A hover that changed the face or the
 *    clothes would read as a glitch rather than as the model moving.
 *  - The choice is now real. The result step reads the selected model and the
 *    selected scene and shows that exact combination, which is why the cast
 *    and the scene ids are one shared list rather than two that can drift.
 */
function modelGallery() {
  const cast = availableCast();
  if (!cast.length) {
    return `<div class="demo-swatches">${['A', 'B', 'C', 'D']
      .map((m, i) => `<div class="demo-model${i === 0 ? ' selected' : ''}" data-model="${i}">${m}</div>`)
      .join('')}</div>`;
  }
  return `<div class="demo-swatches demo-model-gallery">
          ${cast
            .map((m, i) => {
              const pose = hasAsset(`/product-pages/model-${m.id}-pose.jpg`)
                ? `/product-pages/model-${m.id}-pose.jpg`
                : `/product-pages/model-${m.id}-base.jpg`;
              return `<button type="button" class="demo-model${i === 0 ? ' selected' : ''}" data-model="${i}" data-model-id="${m.id}" aria-label="${m.name}" aria-pressed="${i === 0}">
            <span class="demo-model-frame">
              <img class="is-base" src="/product-pages/model-${m.id}-base.jpg" alt="" loading="lazy" decoding="async">
              <img class="is-pose" src="${pose}" alt="" loading="lazy" decoding="async">
            </span>
            <span class="demo-model-name">${m.name}</span>
          </button>`;
            })
            .join('\n          ')}
        </div>`;
}

/** Scene step: real backdrops, and the id the result matrix is keyed on. */
function sceneChooser(labels) {
  const files = ['demo-scene-studio', 'demo-scene-street', 'demo-scene-cafe'];
  if (!files.every((f) => hasAsset(`/product-pages/${f}.jpg`))) {
    const gradients = [
      'linear-gradient(135deg,#f4eeec,#e2d3d6)',
      'linear-gradient(135deg,#dce8f0,#a3cce9)',
      'linear-gradient(135deg,#f0e4d8,#d9bfa0)',
    ];
    return `<div class="demo-swatches">${labels
      .map((n, i) => `<div class="demo-scene${i === 0 ? ' selected' : ''}" data-scene="${i}" style="background:${gradients[i]}">${n}</div>`)
      .join('')}</div>`;
  }
  return `<div class="demo-swatches demo-scene-gallery">
          ${labels
            .map(
              (name, i) => `<button type="button" class="demo-scene${i === 0 ? ' selected' : ''}" data-scene="${i}" data-scene-id="${TRYON_SCENE_IDS[i]}" aria-pressed="${i === 0}">
            <picture><source srcset="/product-pages/${files[i]}.webp" type="image/webp"><img src="/product-pages/${files[i]}.jpg" alt="" loading="lazy" decoding="async"></picture>
            <span>${name}</span>
          </button>`
            )
            .join('\n          ')}
        </div>`;
}

/**
 * Result step. Renders the full model x scene matrix and reveals exactly one
 * frame, rather than fetching on demand: every combination is a static file
 * already in the page's asset set, so switching is instant and works with no
 * network round-trip and no loading state to design around.
 */
function demoResult(alt) {
  const cast = availableCast();
  if (!cast.length) {
    return hasAsset('/product-pages/demo-result.jpg')
      ? `<img class="demo-result-img" src="/product-pages/demo-result.jpg" alt="${alt}" loading="lazy">`
      : `<img class="demo-result-img" src="/product-pages/staging-hero.jpg" alt="${alt}">`;
  }
  const frames = cast
    .flatMap((m) =>
      TRYON_SCENE_IDS.map(
        (sc) => `<img class="demo-result-frame" data-model-id="${m.id}" data-scene-id="${sc}"
              src="/product-pages/model-${m.id}-${sc}.jpg" alt="${alt}" loading="lazy" decoding="async">`
      )
    )
    .join('\n            ');
  return `<div class="demo-result-stage" data-active-model="${cast[0].id}" data-active-scene="studio">
            ${frames}
          </div>`;
}

function sceneImageFor(f) {
  const rel = `/product-pages/${f.slug}-scene.jpg`;
  return fs.existsSync(path.join(ROOT, 'assets', rel.replace(/^\//, ''))) ? rel : null;
}

/**
 * The photograph is deliberately NOT its own titled section.
 *
 * It first shipped under a heading ("So sieht der Alltag damit aus"), which
 * announced the picture as a thing in its own right and made it read like a
 * stock-photo interlude bolted onto the page. A real product page just has
 * photography in it — the image belongs to the section it sits in rather than
 * interrupting the argument to present itself.
 *
 * So it renders as a full-bleed band with no label and no heading, directly
 * after the audience grid, where it illustrates who the feature is for
 * without narrating that that is what it is doing. The flat-vector hero
 * stays: the illustration explains the mechanism, the photograph supplies the
 * context, and neither needs a caption to say so.
 */
function sceneSection(f, lang) {
  const src = sceneImageFor(f);
  if (!src) return '';
  const c = f[lang];
  return `
  <figure class="vm-scene-figure">
    <picture>
      <source srcset="${src.replace(/\.jpg$/, '.webp')}" type="image/webp">
      <img src="${src}" alt="${c.tagline}" loading="lazy" decoding="async" width="1600" height="900">
    </picture>
  </figure>`;
}

/**
 * Virtual try-on strip: one reference shot plus the same model in three
 * outfits. The images are generated image-to-image from the reference so the
 * person really is identical across the row — that consistency is the claim
 * the section is making, so a set of four unrelated models would undercut
 * exactly the point it exists to demonstrate.
 */
function tryonSection(f, lang) {
  if (f.slug !== 'produktfotos-ki') return '';
  const base = path.join(ROOT, 'assets/product-pages/tryon-base.jpg');
  if (!fs.existsSync(base)) return '';
  const t = UI[lang];
  const looks = [1, 2, 3].filter((n) => fs.existsSync(path.join(ROOT, `assets/product-pages/tryon-look-${n}.jpg`)));
  const shot = (src, caption, isBase) => `
        <figure class="vm-tryon-shot${isBase ? ' is-base' : ''}">
          <picture>
            <source srcset="${src.replace(/\.jpg$/, '.webp')}" type="image/webp">
            <img src="${src}" alt="${caption}" loading="lazy" decoding="async">
          </picture>
          <figcaption>${caption}</figcaption>
        </figure>`;
  return `
  <section class="vm-tryon" aria-labelledby="tryon-h">
    <p class="section-label">${t.tryonLabel}</p>
    <h2 class="section-title" id="tryon-h">${t.tryonTitle}</h2>
    <p class="impact-note">${t.tryonIntro}</p>
    <div class="vm-tryon-row">
      ${shot('/product-pages/tryon-base.jpg', t.tryonBase, true)}
      ${looks.map((n) => shot(`/product-pages/tryon-look-${n}.jpg`, `Look ${n}`, false)).join('\n      ')}
    </div>
    <p class="vm-tryon-note">${t.tryonNote}</p>
  </section>`;
}

function pagePath(f, lang) {
  return lang === 'en' ? `/en/solutions/${f.slugEn}/` : `/ki-loesungen/${f.slug}/`;
}

// All 16 heroes are now 16:9 flat-vector illustrations (staging-hero.jpg was
// the one real photo, replaced to match the rest — see CLAUDE.md history).
const PORTRAIT_HEROES = new Set();

function pageShell(f, lang) {
  const c = f[lang];
  const t = UI[lang];
  // Auto-playing product-UI animation (ported from the product repo's /tools/*
  // demo engine — see scripts/feature-demos.js). Complements the interactive
  // step-through wizard (c.demo): the wizard explains the flow, this one shows
  // the product working.
  const animDemo = f.demoView ? buildDemo(f.demoView, lang) : null;
  const animSteps = animDemo ? JSON.stringify(animDemo.steps).replace(/</g, '\\u003c') : null;
  const url = `${BASE_URL}${pagePath(f, lang)}`;
  const altUrl = `${BASE_URL}${pagePath(f, lang === 'en' ? 'de' : 'en')}`;
  const heroAbs = f.heroImage ? `${BASE_URL}${f.heroImage}` : `${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: c.seo.title,
    description: c.seo.description,
    image: heroAbs,
    brand: { '@type': 'Brand', name: 'Virtual Marketer' },
    // No `offers`/AggregateOffer: Virtual Marketer doesn't publish fixed
    // pricing for any of these — every engagement is an individually
    // quoted B2B contract (see the "individuelles Angebot" homepage copy).
    // A fake EUR AggregateOffer with availability "InStock" would claim
    // purchasable, priced, in-stock retail goods that don't exist.
  };

  // All 16 products now ship real hero artwork (synced from the product
  // repo's public/product-pages). Most are 16:9 landscape illustrations —
  // show those at their natural ratio instead of cover-cropping into the
  // default 4:5 portrait frame, which zoomed them into an unrecognizable
  // center blob. Only the Product Staging hero is a genuine portrait shot.
  const isPortraitHero = PORTRAIT_HEROES.has(f.heroImage);
  const heroVisualHtml = f.heroImage
    ? `<div class="hero-image"${isPortraitHero ? '' : ' style="aspect-ratio:16/9;align-self:center;"'}><img src="${f.heroImage}" alt="${c.seo.title}" loading="eager"></div>`
    : `<div class="hero-image hero-visual"><div class="hero-visual-icon">${icon(f.heroIcon || 'agent')}</div>${f.heroCaption ? `<span class="hero-visual-caption">${f.heroCaption}</span>` : ''}</div>`;

  const demoBookHref = lang === 'en' ? '/en/demo/' : '/virtual-marketer-demo/';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${c.seo.title} | Virtual Marketer</title>
<meta name="description" content="${c.seo.description}">
<meta name="keywords" content="${c.seo.keywords}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${lang === 'de' ? url : altUrl}">
<link rel="alternate" hreflang="en" href="${lang === 'en' ? url : altUrl}">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}${pagePath(f, 'de')}">

<meta property="og:type" content="product">
<meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_US'}">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="${c.seo.title}">
<meta property="og:description" content="${c.seo.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${heroAbs}">
<meta name="twitter:card" content="summary_large_image">

<meta name="geo.placename" content="Germany">
<meta name="geo.country" content="DE">
<meta name="ICBM" content="51.1657, 10.4515">

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.fontAwesome}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<style>
  :root{
    --vm-red:#94152b; --vm-red-dark:#700f2b; --vm-blue:#66a3ce; --vm-blue-light:#a3cce9;
    --vm-gray-100:#f4f1f1; --vm-gray-200:#e7dfe0; --vm-gray-500:#6b5f60; --vm-gray-900:#241417;
  }
  .vm-fp *{box-sizing:border-box;}
  /* All sizing below is in px, not rem: the WordPress theme resets
     html{font-size} to 12px (not the usual 16px), and rem always resolves
     against the document root regardless of nesting, so rem values here
     would silently render 25% smaller than intended. */
  .vm-fp{max-width:1140px;margin:0 auto;padding:0 20px 96px;color:var(--vm-gray-900);}
  .vm-fp section{margin-top:72px;}
  .vm-fp h1,.vm-fp h2,.vm-fp h3{font-family:inherit;}
  .vm-fp .eyebrow{display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vm-red);background:#fbecee;padding:5px 12px;border-radius:999px;margin-bottom:16px;}
  .vm-fp .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;margin-top:36px;}
  .vm-fp .hero h1{font-size:40px;line-height:1.15;margin:0 0 16px;letter-spacing:-.01em;}
  .vm-fp .hero .tagline{color:var(--vm-blue);font-weight:700;font-size:18px;margin-bottom:14px;}
  .vm-fp .hero p.intro{font-size:17px;line-height:1.7;color:#4a4143;max-width:52ch;}
  .vm-fp .hero-cta{display:flex;gap:14px;margin-top:28px;flex-wrap:wrap;}
  .vm-fp .btn{display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:13px 26px;border-radius:8px;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease;}
  .vm-fp .btn-primary{background:var(--vm-red);color:#fff;box-shadow:0 2px 8px rgba(148,21,43,.25);}
  .vm-fp .btn-primary:hover{background:var(--vm-red-dark);transform:translateY(-2px);}
  .vm-fp .btn-ghost{background:transparent;color:var(--vm-gray-900);border:1.5px solid var(--vm-gray-200);}
  .vm-fp .btn-ghost:hover{border-color:var(--vm-red);color:var(--vm-red);}
  .vm-fp .hero-image{border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(36,20,23,.14);aspect-ratio:4/5;}
  .vm-fp .hero-image img{width:100%;height:100%;object-fit:cover;display:block;}
  .vm-fp .hero-visual{background:linear-gradient(150deg,var(--vm-blue) 0%,var(--vm-red) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;}
  .vm-fp .hero-visual-icon{width:96px;height:96px;flex-shrink:0;border-radius:50%;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;}
  .vm-fp .hero-visual-icon svg{width:44px;height:44px;color:#fff;}
  .vm-fp .hero-visual-caption{color:#fff;font-weight:700;font-size:14px;background:rgba(0,0,0,.18);padding:6px 14px;border-radius:999px;}

  .vm-fp .section-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vm-gray-500);margin-bottom:10px;}
  .vm-fp h2.section-title{font-size:27px;margin:0 0 28px;}

  .vm-fp .audience-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  .vm-fp .audience-card{background:#fff;border:1px solid var(--vm-gray-200);border-radius:14px;padding:22px;}
  .vm-fp .audience-card b{display:block;font-size:16px;margin-bottom:8px;color:var(--vm-gray-900);}
  .vm-fp .audience-card span{font-size:15px;color:var(--vm-gray-500);line-height:1.5;}

  .vm-fp .impact-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;}
  .vm-fp .impact-card{background:linear-gradient(160deg,#fff,#fbecee);border:1px solid #f2d9dc;border-radius:14px;padding:22px;text-align:center;}
  .vm-fp .impact-card .value{font-size:30px;font-weight:800;color:var(--vm-red);font-variant-numeric:tabular-nums;}
  .vm-fp .impact-card .label{font-size:14px;font-weight:600;margin-top:2px;}
  .vm-fp .impact-card .sub{font-size:13px;color:var(--vm-gray-500);margin-top:8px;line-height:1.4;}
  .vm-fp .impact-note{font-size:13px;color:var(--vm-gray-500);margin-bottom:20px;}
  .vm-fp .impact-compliance{display:flex;gap:12px;align-items:flex-start;background:var(--vm-gray-100);border-radius:12px;padding:16px 18px;font-size:14px;color:var(--vm-gray-900);}
  .vm-fp .impact-compliance svg{width:20px;height:20px;color:var(--vm-blue);flex-shrink:0;margin-top:2px;}

  .vm-fp .value-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;}
  .vm-fp .value-item{display:flex;gap:12px;align-items:flex-start;font-size:16px;line-height:1.5;}
  .vm-fp .value-item svg{width:19px;height:19px;color:var(--vm-red);flex-shrink:0;margin-top:2px;}

  .vm-fp .how-list{counter-reset:step;list-style:none;padding:0;margin:0;max-width:640px;}
  .vm-fp .how-list li{position:relative;padding-left:44px;margin-bottom:22px;font-size:16px;line-height:1.55;}
  .vm-fp .how-list li::before{counter-increment:step;content:counter(step);position:absolute;left:0;top:-1px;width:28px;height:28px;border-radius:50%;background:var(--vm-blue);color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;}

  .vm-fp .faq-list{display:grid;gap:12px;max-width:760px;}
  .vm-fp .faq-item{background:var(--vm-gray-100);border:1px solid var(--vm-gray-200);border-radius:12px;padding:18px 20px;}
  .vm-fp .faq-item p.q{font-weight:700;margin:0 0 6px;}
  .vm-fp .faq-item p.a{margin:0;color:#5a5052;font-size:15px;line-height:1.55;}

  /* Interactive demo */
  .vm-fp .demo{background:var(--vm-gray-900);border-radius:20px;padding:36px;color:#f4ece9;}
  .vm-fp .demo .section-label{color:#d8c5c4;}
  .vm-fp .demo h2{color:#fff;}
  .vm-fp .demo-steps{display:flex;gap:8px;margin-bottom:28px;flex-wrap:wrap;}
  .vm-fp .demo-step-btn{flex:1;min-width:120px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 10px;color:#d8c5c4;font-size:14px;font-weight:600;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:background .2s,color .2s,border-color .2s;}
  .vm-fp .demo-step-btn svg{width:20px;height:20px;}
  .vm-fp .demo-step-btn.active{background:var(--vm-red);border-color:var(--vm-red);color:#fff;}
  .vm-fp .demo-stage{background:#1a0f11;border-radius:14px;min-height:340px;display:flex;align-items:center;justify-content:center;padding:32px;position:relative;overflow:hidden;}
  .vm-fp .demo-panel{display:none;width:100%;text-align:center;animation:vmfade .4s ease;}
  .vm-fp .demo-panel.active{display:block;}
  @keyframes vmfade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
  .vm-fp .demo-upload-zone{border:2px dashed rgba(255,255,255,.25);border-radius:14px;padding:48px 24px;color:#d8c5c4;}
  .vm-fp .demo-upload-zone svg{width:40px;height:40px;margin:0 auto 12px;color:var(--vm-blue-light);}
  .vm-fp .demo-swatches{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
  .vm-fp .demo-model{width:76px;height:76px;border-radius:50%;border:2px solid transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;background:linear-gradient(150deg,var(--vm-blue),var(--vm-red));transition:transform .15s,border-color .15s;}
  .vm-fp .demo-model.selected{border-color:#fff;transform:scale(1.08);}
  .vm-fp .demo-scene{width:120px;height:84px;border-radius:10px;cursor:pointer;display:flex;align-items:flex-end;padding:8px;color:#241417;font-weight:700;font-size:13px;border:2px solid transparent;transition:transform .15s,border-color .15s;}
  .vm-fp .demo-scene.selected{border-color:#fff;transform:scale(1.05);}
  .vm-fp .demo-result-img{max-width:280px;width:100%;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.4);}
  .vm-fp .demo-caption{margin-top:16px;color:#d8c5c4;font-size:14px;}
  .vm-fp .demo-chip{display:inline-block;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:8px 16px;margin:4px;font-size:13px;color:#d8c5c4;}
  .vm-fp .demo-chip.selected{background:var(--vm-red);border-color:var(--vm-red);color:#fff;}
  .vm-fp .demo-chat-bubble{background:rgba(255,255,255,.08);border-radius:12px;padding:14px 18px;max-width:420px;margin:0 auto 12px;text-align:left;font-size:14px;color:#f4ece9;}
  .vm-fp .demo-chat-bubble.user{background:var(--vm-blue);color:#fff;margin-left:auto;margin-right:0;}
  .vm-fp .demo-code-block{background:#0d0709;border-radius:10px;padding:16px;text-align:left;font-family:ui-monospace,"SF Mono",Consolas,monospace;font-size:12.5px;color:#7de3c8;overflow-x:auto;}
  .vm-fp .demo-nav{display:flex;justify-content:center;gap:12px;margin-top:24px;}
  .vm-fp .demo-nav button{background:var(--vm-red);color:#fff;border:none;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;}
  .vm-fp .demo-nav button:disabled{opacity:.35;cursor:default;}
  .vm-fp .demo-nav button.secondary{background:transparent;border:1px solid rgba(255,255,255,.25);color:#fff;}

  @media (prefers-reduced-motion: reduce){
    .vm-fp .demo-panel{animation:none;}
    .vm-fp *{transition:none !important;}
  }

  @media (max-width:860px){
    .vm-fp .hero{grid-template-columns:1fr;gap:28px;}
    .vm-fp .hero-image{order:-1;aspect-ratio:16/10;}
    .vm-fp .audience-grid,.vm-fp .impact-cards{grid-template-columns:1fr;}
    .vm-fp .value-grid{grid-template-columns:1fr;}
    .vm-fp .demo{padding:22px;}
    .vm-fp .demo-step-btn{min-width:80px;font-size:12px;}
    .vm-fp .vmd-stage{padding:16px;}
  }
${animDemo ? DEMO_STYLE : ''}

  /* --- Photographic scene + virtual try-on -------------------------------
     Both sit alongside the flat-vector hero rather than replacing it: the
     illustration explains the mechanism, the photograph shows the situation
     the feature is actually used in. */
  .vm-fp .vm-scene-figure{margin:8px 0 56px;border-radius:18px;overflow:hidden;}
  .vm-fp .vm-scene-figure img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;}

  .vm-fp .vm-tryon-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:22px;align-items:start;}
  .vm-fp .vm-tryon-shot{margin:0;}
  .vm-fp .vm-tryon-shot picture{display:block;border-radius:14px;overflow:hidden;background:var(--vm-gray-100);box-shadow:0 6px 20px rgba(36,20,23,.10);}
  .vm-fp .vm-tryon-shot img{display:block;width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;object-position:center top;}
  .vm-fp .vm-tryon-shot figcaption{margin-top:10px;font-size:14px;font-weight:600;color:var(--vm-gray-900);text-align:center;}
  /* The reference shot is the input, the rest are outputs — the accent ring
     and label make that read at a glance instead of looking like four
     interchangeable photos. */
  .vm-fp .vm-tryon-shot.is-base picture{outline:2px solid var(--vm-red);outline-offset:3px;}
  .vm-fp .vm-tryon-shot.is-base figcaption{color:var(--vm-red);}
  .vm-fp .vm-tryon-note{margin-top:18px;font-size:14px;color:var(--vm-gray-600,#6b7280);}
  @media (max-width:780px){
    .vm-fp .vm-tryon-row{grid-template-columns:repeat(2,1fr);gap:12px;}
  }

  /* Panels slide-and-fade instead of hard-cutting, and the active step
     button shows a progress bar that drains over the autoplay interval so
     the advance is anticipated rather than sudden. Both are suppressed under
     prefers-reduced-motion. */
  .vm-fp .demo-panel{opacity:0;transform:translateY(6px);transition:opacity .35s ease,transform .35s ease;}
  .vm-fp .demo-panel.active{opacity:1;transform:none;}
  .vm-fp .demo-step-btn{position:relative;overflow:hidden;}
  .vm-fp .demo-step-btn::after{
    content:'';position:absolute;left:0;bottom:0;height:2px;width:100%;
    background:rgba(255,255,255,.85);transform:scaleX(0);transform-origin:left;
  }
  .vm-fp.is-autoplaying .demo-step-btn.active::after{
    animation:vmStepProgress 2.6s linear forwards;
  }
  @keyframes vmStepProgress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @media (prefers-reduced-motion:reduce){
    .vm-fp .demo-panel{transition:none;transform:none;}
    .vm-fp.is-autoplaying .demo-step-btn.active::after{animation:none;}
  }

  /* Real photography in the demo's picker steps, replacing lettered circles
     and CSS gradients. Buttons rather than divs so they are focusable and
     announce themselves — they are genuine controls. */
  .vm-fp .demo-model-gallery{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;}
  .vm-fp .demo-model-gallery .demo-model{
    padding:0;border:0;background:none;cursor:pointer;
    display:flex;flex-direction:column;align-items:center;gap:8px;
  }
  .vm-fp .demo-model-frame{
    position:relative;display:block;width:92px;height:92px;border-radius:50%;
    overflow:hidden;background:#efe7e8;
    outline:2px solid transparent;outline-offset:3px;
    transition:outline-color .18s ease,transform .18s ease;
  }
  .vm-fp .demo-model-frame img{
    position:absolute;inset:0;width:100%;height:100%;
    object-fit:cover;object-position:center 12%;
    transition:opacity .28s ease;
  }
  /* Hover swaps to the posed frame of the same person. Both images are
     stacked and cross-faded rather than swapping src, so there is no flicker
     and no second network request mid-interaction. */
  .vm-fp .demo-model-frame .is-pose{opacity:0;}
  .vm-fp .demo-model:hover .demo-model-frame .is-pose,
  .vm-fp .demo-model:focus-visible .demo-model-frame .is-pose{opacity:1;}
  .vm-fp .demo-model:hover .demo-model-frame .is-base,
  .vm-fp .demo-model:focus-visible .demo-model-frame .is-base{opacity:0;}
  .vm-fp .demo-model:hover .demo-model-frame{transform:translateY(-3px);}
  .vm-fp .demo-model.selected .demo-model-frame{outline-color:#fff;}
  .vm-fp .demo-model-name{font-size:13px;font-weight:600;color:#d8c5c4;}
  .vm-fp .demo-model.selected .demo-model-name{color:#fff;}

  .vm-fp .demo-scene-gallery{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;}
  .vm-fp .demo-scene-gallery .demo-scene{
    width:180px;padding:0;border:0;border-radius:12px;overflow:hidden;background:none;
    cursor:pointer;outline:2px solid transparent;outline-offset:3px;
    transition:outline-color .15s ease,transform .15s ease;
  }
  .vm-fp .demo-scene-gallery .demo-scene img{width:100%;height:108px;object-fit:cover;display:block;}
  .vm-fp .demo-scene-gallery .demo-scene span{
    display:block;padding:8px 10px;font-size:13px;font-weight:600;color:#fff;
    background:rgba(36,20,23,.55);
  }
  .vm-fp .demo-scene-gallery .demo-scene:hover{transform:translateY(-2px);}
  .vm-fp .demo-scene-gallery .demo-scene.selected{outline-color:#fff;}

  /* Result matrix: every model x scene frame is present, exactly one shown. */
  .vm-fp .demo-result-stage{
    position:relative;width:100%;max-width:520px;margin:0 auto;
    aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:#1b1113;
  }
  .vm-fp .demo-result-frame{
    position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    opacity:0;transform:scale(1.015);
    transition:opacity .45s ease,transform .45s ease;
  }
  .vm-fp .demo-result-frame.is-active{opacity:1;transform:none;}
  @media (max-width:560px){
    .vm-fp .demo-model-frame{width:74px;height:74px;}
    .vm-fp .demo-scene-gallery .demo-scene{width:calc(50% - 7px);}
  }

${CHROME_CSS}
</style>
</head>
<body class="vm-static-blog">
${header(lang)}
<main class="vm-fp">
  <section class="hero" style="margin-top:44px;">
    <div>
      <span class="eyebrow">${c.eyebrow}</span>
      <h1>${c.seo.title}</h1>
      <p class="tagline">${c.tagline}</p>
      <p class="intro">${c.intro}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="${demoBookHref}">${t.demoBook}</a>
        ${c.demo ? `<a class="btn btn-ghost" href="#demo">${t.liveDemo}</a>` : animDemo ? `<a class="btn btn-ghost" href="#produkt-demo">${t.liveDemo}</a>` : ''}
      </div>
    </div>
    ${heroVisualHtml}
  </section>

  <section aria-labelledby="audience-h">
    <p class="section-label">${t.forWhom}</p>
    <h2 class="section-title" id="audience-h">${t.forWhomTitle}</h2>
    <div class="audience-grid">
      ${c.audiences.map((a) => `<div class="audience-card"><b>${a.label}</b><span>${a.detail}</span></div>`).join('\n      ')}
    </div>
  </section>
${tryonSection(f, lang)}
${sceneSection(f, lang)}

  ${c.impact ? `<section aria-labelledby="impact-h">
    <p class="section-label">${t.impactLabel}</p>
    <h2 class="section-title" id="impact-h">${c.impact.heading}</h2>
    <p class="impact-note">${c.impact.note}</p>
    <div class="impact-cards">
      ${c.impact.cards.map((cd) => `<div class="impact-card"><div class="value">${cd.value}</div><div class="label">${cd.label}</div><div class="sub">${cd.sub}</div></div>`).join('\n      ')}
    </div>
    <div class="impact-compliance">${icon('check')}<span>${c.impact.compliance}</span></div>
  </section>` : ''}

  ${c.demo ? `<section id="demo" aria-labelledby="demo-h">
    <p class="section-label">${t.liveDemoLabel}</p>
    <h2 id="demo-h">${t.liveDemoTitle}</h2>
    <div class="demo">
      <div class="demo-steps" role="tablist">
        ${c.demo.steps.map((s, i) => `<button class="demo-step-btn${i === 0 ? ' active' : ''}" data-step="${i}" role="tab">${icon(s.icon)}<span>${s.label}</span></button>`).join('\n        ')}
      </div>
      <div class="demo-stage">
        ${c.demo.panels.map((p, i) => `<div class="demo-panel${i === 0 ? ' active' : ''}" data-panel="${i}">${p(icon)}</div>`).join('\n        ')}
      </div>
      <div class="demo-nav">
        <button class="secondary" id="demo-prev" disabled>${t.back}</button>
        <button id="demo-next">${t.next}</button>
      </div>
    </div>
  </section>` : ''}

  ${animDemo ? `<section id="produkt-demo" aria-labelledby="pdemo-h">
    <p class="section-label">${t.productDemoLabel}</p>
    <h2 class="section-title" id="pdemo-h">${t.productDemoTitle}</h2>
    <div class="vmd-window">
      <div class="vmd-titlebar"><span class="vmd-dot"></span><span class="vmd-dot"></span><span class="vmd-dot"></span><span class="vmd-titletext">${animDemo.title}</span></div>
      <div class="vmd-stage" id="vmdemo">${animDemo.html}</div>
    </div>
    <p class="vmd-demonote">${t.productDemoNote}</p>
  </section>` : ''}

  <section aria-labelledby="value-h">
    <p class="section-label">${t.valueLabel}</p>
    <h2 class="section-title" id="value-h">${t.valueTitle}</h2>
    <div class="value-grid">
      ${c.valueBullets.map((v) => `<div class="value-item">${icon('check')}<span>${v}</span></div>`).join('\n      ')}
    </div>
  </section>

  <section aria-labelledby="how-h">
    <p class="section-label">${t.howLabel}</p>
    <h2 class="section-title" id="how-h">${t.howTitle}</h2>
    <ol class="how-list">
      ${c.howTo.map((s) => `<li>${s}</li>`).join('\n      ')}
    </ol>
  </section>

  <section aria-labelledby="faq-h">
    <p class="section-label">${t.faqLabel}</p>
    <h2 class="section-title" id="faq-h">${t.faqTitle}</h2>
    <div class="faq-list">
      ${c.faq.map((item) => `<div class="faq-item"><p class="q">${item.q}</p><p class="a">${item.a}</p></div>`).join('\n      ')}
    </div>
  </section>
</main>
${footer(lang)}
<script>
(function(){
  // Ties the two picker steps to the result matrix. Every combination is
  // already in the DOM as a static image, so this only toggles which one is
  // visible — no fetch, no loading state, instant switching.
  document.querySelectorAll('.vm-fp').forEach(function(root){
    var stage = root.querySelector('.demo-result-stage');
    if(!stage) return;

    function show(){
      var m = stage.getAttribute('data-active-model');
      var s = stage.getAttribute('data-active-scene');
      var match = stage.querySelector('.demo-result-frame[data-model-id="'+m+'"][data-scene-id="'+s+'"]');
      stage.querySelectorAll('.demo-result-frame').forEach(function(f){
        f.classList.toggle('is-active', f === match);
      });
    }

    function bind(sel, attr, target){
      root.querySelectorAll(sel).forEach(function(btn){
        btn.addEventListener('click', function(){
          root.querySelectorAll(sel).forEach(function(b){
            b.classList.toggle('selected', b === btn);
            if(b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
          });
          var v = btn.getAttribute(attr);
          if(v) stage.setAttribute(target, v);
          show();
        });
      });
    }

    bind('.demo-model-gallery .demo-model', 'data-model-id', 'data-active-model');
    bind('.demo-scene-gallery .demo-scene', 'data-scene-id', 'data-active-scene');
    show();
  });
})();
</script>


<script>
(function(){
  var root = document.querySelector('.vm-fp') || document;
  var steps = document.querySelectorAll('.demo-step-btn');
  var panels = document.querySelectorAll('.demo-panel');
  var prevBtn = document.getElementById('demo-prev');
  var nextBtn = document.getElementById('demo-next');
  if (!prevBtn || !nextBtn) return; // page has no step-through wizard
  var current = 0;

  function show(i){
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function(b, idx){ b.classList.toggle('active', idx === current); });
    panels.forEach(function(p){ p.classList.toggle('active', Number(p.dataset.panel) === current); });
    prevBtn.disabled = current === 0;
    nextBtn.textContent = current === steps.length - 1 ? ${JSON.stringify('__RESTART__')} : ${JSON.stringify('__NEXT__')};
  }
  steps.forEach(function(b, idx){ b.addEventListener('click', function(){ stopAuto(); show(idx); }); });
  prevBtn.addEventListener('click', function(){ stopAuto(); show(current - 1); });
  nextBtn.addEventListener('click', function(){ stopAuto(); show(current === steps.length - 1 ? 0 : current + 1); });

  // --- Auto-advance ------------------------------------------------------
  // The wizard sat on step 1 until someone clicked, so most visitors never
  // saw the payoff — the interesting part is the last panel. It now plays
  // itself once it scrolls into view, which turns a static screenshot into a
  // demonstration without demanding interaction first.
  //
  // Three deliberate limits: it only runs while actually visible (an
  // IntersectionObserver, so it is not burning timers off-screen), it stops
  // permanently at the first click or keypress because a visitor who has
  // taken control should not have the panel yanked out from under them, and
  // it respects prefers-reduced-motion by not starting at all.
  var timer = null;
  var stopped = false;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stopAuto(){
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    root.classList.remove('is-autoplaying');
  }
  function startAuto(){
    if (stopped || reduced || timer) return;
    root.classList.add('is-autoplaying');
    timer = setInterval(function(){
      if (stopped) return;
      show(current === steps.length - 1 ? 0 : current + 1);
    }, 2600);
  }

  var demoSection = prevBtn.closest('section') || prevBtn.parentElement;

  // Visibility is checked by geometry, not solely by IntersectionObserver.
  // IO is the tidier API, but it silently never fires in environments that
  // do not composite frames (embedded webviews, headless panes) — verified
  // here: a plain interval ticked while an observer on the same element
  // reported nothing at all. Relying on it alone would mean the demo quietly
  // never plays for some real visitors, and would be untestable besides.
  function inView(){
    if (!demoSection) return false;
    var r = demoSection.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return r.height > 0 && visible / Math.min(r.height, vh) > 0.35;
  }
  function sync(){
    if (stopped) return;
    if (inView()) startAuto();
    else if (timer) { clearInterval(timer); timer = null; root.classList.remove('is-autoplaying'); }
  }

  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  if (demoSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(sync, { threshold: 0.35 }).observe(demoSection);
  }
  sync();

  ['pointerdown', 'keydown'].forEach(function(ev){
    demoSection && demoSection.addEventListener(ev, stopAuto, { once: true });
  });

  document.querySelectorAll('.demo-model').forEach(function(el){
    el.addEventListener('click', function(){
      document.querySelectorAll('.demo-model').forEach(function(m){ m.classList.remove('selected'); });
      el.classList.add('selected');
    });
  });
  document.querySelectorAll('.demo-scene').forEach(function(el){
    el.addEventListener('click', function(){
      document.querySelectorAll('.demo-scene').forEach(function(s){ s.classList.remove('selected'); });
      el.classList.add('selected');
    });
  });
})();
</script>
${animDemo ? `<script>${DEMO_ENGINE_JS}vmDemo('vmdemo', ${animSteps}, ${animDemo.loopPause || 3800});</script>` : ''}
</body>
</html>`.replace(/"__RESTART__"/, JSON.stringify(t.restart)).replace(/"__NEXT__"/, JSON.stringify(t.next));
}

function hubCard(f, lang) {
  const c = f[lang];
  return `
        <a class="vm-fp-callout-card" href="${pagePath(f, lang)}">
          <img src="${f.heroImage}" alt="" loading="lazy">
          <span class="vm-fp-callout-body">
            <strong>${c.eyebrow}</strong>
            <span>${c.tagline}</span>
          </span>
        </a>`;
}

function hubGridSection(lang, { withHeading = true, inline = false } = {}) {
  const cards = FEATURES.map((f) => hubCard(f, lang)).join('');
  // `inline`: rendered inside an already width-constrained container (the
  // clean DE hub's <main>) — no own max-width/outer margins there.
  const sectionStyle = inline ? 'margin:24px 0 0;' : 'max-width:1140px;margin:48px auto;padding:0 20px;';
  return `
<section class="vm-fp-callout" style="${sectionStyle}">
  <style>
    .vm-fp-callout-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px;}
    .vm-fp-callout-card{display:flex;flex-direction:column;background:#fff;border:1px solid #e7dfe0;border-radius:14px;overflow:hidden;text-decoration:none;color:#241417;transition:transform .15s ease,box-shadow .15s ease;box-shadow:0 2px 10px rgba(36,20,23,.05);}
    .vm-fp-callout-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(36,20,23,.13);}
    .vm-fp-callout-card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;border-bottom:1px solid #f0e9ea;}
    .vm-fp-callout-body{display:flex;flex-direction:column;gap:5px;padding:16px 18px 18px;}
    .vm-fp-callout-card strong{font-size:15px;line-height:1.35;}
    .vm-fp-callout-body span{color:#6b5f60;font-size:13px;}
  </style>
  ${withHeading ? `<h3 style="font-size:20px;margin-bottom:18px;">${UI[lang].allSolutions}</h3>` : ''}
  <div class="vm-fp-callout-grid">
  ${cards}
  </div>
</section>
`;
}

function injectHubGrid(lang) {
  const hubPath = lang === 'en' ? path.join(DIST, 'en', 'solutions', 'index.html') : path.join(DIST, 'ki-loesungen', 'index.html');
  if (!fs.existsSync(hubPath)) return false;
  let hub = fs.readFileSync(hubPath, 'utf-8');
  const marker = lang === 'en' ? '<h2 id="vmaf-heading-en">' : '<h2 id="vmaf-heading">';
  const anchor = hub.includes(marker) ? marker : (hub.includes('</main>') ? '</main>' : null);
  if (!anchor) return false;

  const section = hubGridSection(lang);
  hub = hub.includes('vm-fp-callout')
    ? hub.replace(/<section class="vm-fp-callout"[\s\S]*?<\/section>\s*/, section)
    : hub.replace(anchor, section + anchor);
  fs.writeFileSync(hubPath, hub);
  return true;
}

/**
 * Clean, purpose-built DE solutions hub. The WordPress export at
 * /ki-loesungen/ is the legacy dark Elementor page ("Individuelle KI
 * Lösungen") — visually a different site than the feature pages, and the
 * only place the solutions grid could live there was the dark pre-footer
 * area, where it looked bolted-on. This replaces the export with the same
 * kind of clean, hand-built page the EN hub (/en/solutions/, see
 * generate-en-pages.js) already is, keeping the URL, the H1 topic and the
 * legacy page's core message (custom-trained models → /modell-anfragen/).
 * Runs before injectHubGrid('de'), which fills the marker with the grid.
 */
function renderDeHub() {
  const url = `${BASE_URL}/ki-loesungen/`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Individuelle KI-Lösungen',
    description: 'Alle Virtual-Marketer-KI-Lösungen im Überblick: Agenten, Produktfotos, Feeds, Texte, Bilder, Videos, Kampagnen und mehr.',
    url,
    isPartOf: { '@type': 'WebSite', name: 'Virtual Marketer', url: BASE_URL },
  };
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Individuelle KI-Lösungen — alle Virtual-Marketer-Produkte | Virtual Marketer</title>
<meta name="description" content="Alle KI-Lösungen von Virtual Marketer im Überblick: KI-Agenten, Produktfotos, Feed-Veredelung, Text-, Bild- und Videogenerierung, Kampagnen-Builder und individuelle KI-Modelle.">
<meta name="keywords" content="KI Lösungen, individuelle KI Modelle, KI Marketing Tools, KI Agenten, KI Produktfotos, Feed Optimierung, KI Texte">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<link rel="alternate" hreflang="en" href="${BASE_URL}/en/solutions/">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="Individuelle KI-Lösungen — alle Virtual-Marketer-Produkte">
<meta property="og:description" content="Alle KI-Lösungen von Virtual Marketer im Überblick — jede mit Live-Demo.">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<meta name="geo.placename" content="Germany">
<meta name="geo.country" content="DE">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.fontAwesome}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<style>
  :root{
    --vm-red:#94152b; --vm-red-dark:#700f2b; --vm-blue:#66a3ce; --vm-blue-light:#a3cce9;
    --vm-gray-100:#f4f1f1; --vm-gray-200:#e7dfe0; --vm-gray-500:#6b5f60; --vm-gray-900:#241417;
  }
  .vm-hub *{box-sizing:border-box;}
  .vm-hub{max-width:1140px;margin:0 auto;padding:48px 20px 96px;color:var(--vm-gray-900);line-height:1.65;font-size:16px;}
  .vm-hub h1{font-size:38px;line-height:1.15;margin:0 0 12px;letter-spacing:-.01em;}
  .vm-hub h2{font-size:24px;margin:56px 0 8px;}
  .vm-hub p{margin:0 0 14px;color:#4a4143;}
  .vm-hub a{color:var(--vm-red);}
  .vm-hub .eyebrow{display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vm-red);background:#fbecee;padding:5px 12px;border-radius:999px;margin-bottom:16px;}
  .vm-hub .lede{font-size:18px;color:#4a4143;max-width:68ch;}
  .vm-hub .btn{display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:13px 26px;border-radius:8px;text-decoration:none;background:var(--vm-red);color:#fff;margin:8px 12px 0 0;}
  .vm-hub .btn:hover{background:var(--vm-red-dark);}
  .vm-hub .btn-ghost{background:transparent;color:var(--vm-gray-900);border:1.5px solid var(--vm-gray-200);}
  .vm-hub .btn-ghost:hover{border-color:var(--vm-red);color:var(--vm-red);}
  .vm-hub .custom-panel{background:var(--vm-gray-100);border:1px solid var(--vm-gray-200);border-radius:16px;padding:28px 30px;margin-top:18px;}
${CHROME_CSS}
</style>
</head>
<body class="vm-static-blog">
${header('de')}
<main class="vm-hub">
  <span class="eyebrow">KI-Lösungen</span>
  <h1>Individuelle KI-Lösungen</h1>
  <p class="lede">Jedes Virtual-Marketer-Produkt auf dieser Seite ist real und heute im Einsatz. Wählen Sie eine Lösung, um zu sehen, für wen sie gedacht ist, wie sie funktioniert &#8211; und wie sie im Produkt aussieht, mit Live-Demo direkt auf der Seite.</p>

  <h2>Alle KI-Lösungen im Überblick</h2>
  <p>Jede Karte führt zur ausführlichen Produktseite mit animierter Live-Demo.</p>
${hubGridSection('de', { withHeading: false, inline: true })}
  <h2>Individuelle KI-Modelle für Ihre Marke</h2>
  <p>Hinter vielen dieser Lösungen stehen individuell trainierte Virtual-Marketer-Modelle: KI, die Ihre Markensprache, Ihre Produkte und Ihre Zielgruppe kennt &#8211; statt generischer Texte von der Stange. Wir trainieren Ihr Modell auf Ihren Daten und stellen es in allen Werkzeugen bereit.</p>
  <div class="custom-panel">
    <strong>Ihr eigenes KI-Modell anfragen</strong>
    <p style="margin:8px 0 4px;">Beschreiben Sie Ihren Anwendungsfall &#8211; wir melden uns mit einem Vorschlag für Ihr individuelles Modell.</p>
    <a class="btn" href="/modell-anfragen/">Modell anfragen</a>
    <a class="btn btn-ghost" href="/virtual-marketer-demo/">Demo buchen</a>
  </div>
</main>
${footer('de')}
</body>
</html>`;
}

function main() {
  console.log('\n🖼️  Generating feature landing pages (DE + EN)...\n');

  const assetSrc = path.join(ROOT, 'assets/product-pages');
  const assetDist = path.join(DIST, 'product-pages');
  fs.mkdirSync(assetDist, { recursive: true });
  for (const file of fs.readdirSync(assetSrc)) {
    fs.copyFileSync(path.join(assetSrc, file), path.join(assetDist, file));
  }

  for (const f of FEATURES) {
    for (const lang of ['de', 'en']) {
      const outDir = path.join(DIST, ...pagePath(f, lang).split('/').filter(Boolean));
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), pageShell(f, lang));
    }
    console.log(`  ✓ /ki-loesungen/${f.slug}/ + /en/solutions/${f.slugEn}/`);
  }

  // Replace the legacy Elementor export at /ki-loesungen/ with the clean,
  // purpose-built DE hub — grid already embedded, so no injection needed
  // there. The EN hub still gets its grid injected at the marker.
  fs.writeFileSync(path.join(DIST, 'ki-loesungen', 'index.html'), renderDeHub());
  console.log(`  ✓ /ki-loesungen/ (clean DE hub with ${FEATURES.length}-card grid, replaces Elementor export)`);
  const enLinked = injectHubGrid('en');
  console.log(`  ✓ Linked ${FEATURES.length} page(s) from EN hub${enLinked ? '' : ' (hub not found, skipped)'}`);

  console.log(`\n✅ ${FEATURES.length * 2} feature page(s) generated (${FEATURES.length} DE + ${FEATURES.length} EN)\n`);
}

main();
