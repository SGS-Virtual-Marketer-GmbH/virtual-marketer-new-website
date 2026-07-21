#!/usr/bin/env node

/**
 * Feature Landing Pages
 *
 * Dedicated marketing/demo pages for real, shipped Virtual Marketer product
 * features — built one at a time (see CLAUDE.md), sourced from
 * vm-customer-web-ui's feature-catalog.md / appRegistry.ts, never invented.
 *
 * Brand: real product CI colors (vm-red #94152b / vm-blue #66a3ce), not the
 * ad-hoc purple/cyan the old "AI Features" showcase used.
 *
 * Demos are scripted/simulated (no backend calls) — deliberate per CLAUDE.md,
 * not a shortcut: safe, no load, fully controllable animation.
 *
 * Run after scripts/build.js (so /ki-loesungen/index.html exists to link
 * from), before scripts/fix-legal-content.js, so its global name-fix pass
 * also covers these generated pages.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = 'https://virtual-marketer.de';
const EN_BASE_URL = 'https://virtual-marketer.ai';

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

const HEADER = `<header class="vm-header-simple">
  <a href="/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/ki-loesungen/">Lösungen</a>
    <a href="/blog/">Blog</a>
    <a href="http://api.virtual-marketer.de/documentation/">API</a>
    <a href="/modell-anfragen/">Modell anfragen</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>`;

const FOOTER = `<footer style="max-width:1140px;margin:64px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> &middot;
  <a href="/impressum/">Impressum</a>
</footer>`;

/**
 * Feature page registry — one entry built and verified before the next is
 * added (see CLAUDE.md "build one feature page at a time").
 */
const FEATURES = [
  {
    slug: 'produktfotos-ki',
    seo: {
      title: 'KI-Produktfotos & virtuelle Anprobe (Virtual Try-On)',
      description: 'Produktfotos, On-Model-Bilder und Videos in Minuten statt Wochen — mit KI, ohne Fotostudio. Für Fashion, Retail und E-Commerce.',
      keywords: 'KI Produktfotos, Produktbilder mit KI erstellen, virtuelle Anprobe, Virtual Try-On, KI Produktfotografie, On-Model Bilder KI',
    },
    heroImage: '/product-pages/staging-hero.jpg',
    eyebrow: 'KI Produktfotos &amp; Virtual Try-On',
    tagline: 'Dein digitales Fotostudio.',
    intro: 'VM Product Staging macht aus einem einfachen Produktfoto professionelle On-Model-Aufnahmen, Lifestyle-Szenen und Produktvideos &#8211; in Minuten statt Wochen, zu einem Bruchteil der Kosten eines klassischen Shootings.',
    audiences: [
      { label: 'Fashion &amp; Apparel E-Commerce', detail: 'Laufend neue Kollektionen, ohne für jede ein Shooting zu buchen.' },
      { label: 'Retail-Marken mit wechselndem Sortiment', detail: 'Konsistente Bildsprache über hunderte SKUs hinweg.' },
      { label: 'Agenturen mit mehreren Kunden', detail: 'Ein Werkzeug für Bildproduktion über alle Konten hinweg.' },
    ],
    impact: {
      heading: 'Was das für Ihr Budget bedeutet',
      note: 'Branchenvergleich, kein Virtual-Marketer-spezifisches Versprechen &#8211; die tatsächlichen Kosten hängen von Umfang und Anzahl der Bilder ab.',
      cards: [
        { value: '&euro;50&ndash;150', label: 'pro fertigem Bild', sub: 'klassisches Fotoshooting mit Model, Studio &amp; Postproduktion' },
        { value: '&euro;3&ndash;12', label: 'pro fertigem Bild', sub: 'vergleichbares KI-generiertes Ergebnis, laut Branchenbenchmarks' },
        { value: '+20&ndash;40%', label: 'Conversion-Potenzial', sub: 'beim Umstieg von Flat-Lay- auf On-Model-Darstellung' },
      ],
      compliance: 'Ab 2. August 2026 verlangt der EU AI Act eine maschinenlesbare Kennzeichnung KI-generierter Bilder &#8211; Virtual Marketer kennzeichnet automatisch korrekt.',
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
        `<div class="demo-upload-zone">${icon('upload')}<p>Produktfoto hier ablegen &#8211; ein Smartphone-Foto genügt.</p></div>`,
        `<p style="color:#d8c5c4;margin-bottom:20px;">Model aus der Galerie wählen:</p>
        <div class="demo-swatches">
          ${['A', 'B', 'C', 'D'].map((m, i) => `<div class="demo-model${i === 0 ? ' selected' : ''}" data-model="${i}">${m}</div>`).join('\n          ')}
        </div>`,
        `<p style="color:#d8c5c4;margin-bottom:20px;">Szene wählen:</p>
        <div class="demo-swatches">
          ${[
            { name: 'Studio', gradient: 'linear-gradient(135deg,#f4eeec,#e2d3d6)' },
            { name: 'Straße', gradient: 'linear-gradient(135deg,#dce8f0,#a3cce9)' },
            { name: 'Café', gradient: 'linear-gradient(135deg,#f0e4d8,#d9bfa0)' },
          ].map((s, i) => `<div class="demo-scene${i === 0 ? ' selected' : ''}" data-scene="${i}" style="background:${s.gradient}">${s.name}</div>`).join('\n          ')}
        </div>`,
        `<img class="demo-result-img" src="/product-pages/staging-hero.jpg" alt="Generiertes Ergebnisbeispiel">
        <p class="demo-caption">So sieht ein fertiges Ergebnis aus &#8211; in Minuten statt Wochen generiert.</p>`,
      ],
    },
  },
  {
    slug: 'agenten',
    seo: {
      title: 'KI-Agenten für Marketing, Ads & SEO — autonome virtuelle Mitarbeiter',
      description: 'Spezialisierte KI-Agenten für Analytics, Google Ads, Meta Ads, SEO und Kundenservice — per Chat, Webhook oder Zeitplan im Einsatz.',
      keywords: 'KI Agenten Marketing, autonome KI Mitarbeiter, KI Agent Google Ads, Marketing Automatisierung KI, virtueller Mitarbeiter KI, KI Agent SEO',
    },
    heroIcon: 'agent',
    heroCaption: 'Virtual Marketer Agents 2.0',
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
        `<p style="color:#d8c5c4;margin-bottom:20px;">Spezialisten aus dem Katalog:</p>
        <div class="demo-swatches">
          ${['Analytics', 'Google Ads', 'SEO', 'Support'].map((m, i) => `<div class="demo-chip${i === 1 ? ' selected' : ''}">${m}</div>`).join('\n          ')}
        </div>`,
        `<div class="demo-chat-bubble user">Wie liefen unsere Google Ads diese Woche?</div>
        <div class="demo-chat-bubble">Analysiere Kampagnendaten &#8230;</div>`,
        `<div class="demo-chat-bubble">3 Kampagnen liegen unter dem Ziel-ROAS. Vorschlag: Budget von „Sommer-Sale&#8220; um 15% erhöhen, „Restposten&#8220; pausieren.</div>
        <div class="demo-chip selected" style="margin-top:8px;">Änderung übernehmen</div>`,
      ],
    },
  },
  {
    slug: 'coding-api',
    seo: {
      title: 'Coding-API & MCP-Server — Virtual Marketer Senior & Junior für dein IDE',
      description: 'OpenAI- und Anthropic-kompatible Coding-API mit zwei Modellstufen. Nutzbar in Cursor, Cline, aider & Co. — eine Basis-URL, ein Guthaben.',
      keywords: 'OpenAI kompatible API, KI Coding API, Cursor eigenes Modell, Coding Assistent API, MCP Server, KI für Entwickler',
    },
    heroIcon: 'code',
    heroCaption: 'Coding API & MCP',
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
        `<div class="demo-code-block">base_url = "https://api.virtual-marketer.de/v1"<br>api_key = "vmk_&#8230;"</div>`,
        `<p style="color:#d8c5c4;margin-bottom:20px;">Modell wählen:</p>
        <div class="demo-swatches">
          <div class="demo-chip selected">virtual-marketer-senior</div>
          <div class="demo-chip">virtual-marketer-junior</div>
        </div>`,
        `<div class="demo-code-block">$ curl .../chat/completions -d '{"model":"virtual-marketer-senior", ...}'<br>&gt; „Hier ist die korrigierte Funktion &#8230;&#8221;</div>`,
      ],
    },
  },
  {
    slug: 'feed-veredelung',
    seo: {
      title: 'KI Feed-Optimierung für Google Shopping, Meta & Bing',
      description: 'Produktfeeds importieren, mit KI anreichern und als validierten, stets aktuellen Feed für Google, Meta und Bing veröffentlichen.',
      keywords: 'Google Shopping Feed optimieren KI, Produktfeed anreichern, Feed Management KI, Merchant Center Feed KI, Shopping Feed Software',
    },
    heroImage: '/product-pages/feedenhance-hero.jpg',
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
        `<p style="color:#d8c5c4;">XML, CSV, TSV oder JSON &#8211; Format wird automatisch erkannt.</p>`,
        `<p style="color:#d8c5c4;margin-bottom:12px;">Fehlende Attribute werden ergänzt:</p>
        <div class="demo-chip">Farbe: &#8212; &rarr; Farbe: Marineblau</div><br>
        <div class="demo-chip">Material: &#8212; &rarr; Material: Baumwolle</div>`,
        `<p style="color:#d8c5c4;">Titel optimiert: „Herren T-Shirt&#8220; &rarr; „Herren T-Shirt Marineblau, Baumwolle, Gr. S&#8211;XL&#8220;</p>`,
      ],
    },
  },
  {
    slug: 'texte-generieren',
    seo: {
      title: 'KI-Texte für Produktbeschreibungen — einzeln oder im Bulk',
      description: 'Produktbeschreibungen mit deinen markentrainierten KI-Modellen generieren — einzeln oder für hunderte Zeilen per CSV/Excel.',
      keywords: 'Produktbeschreibungen KI generieren, KI Texter Bulk, CSV Produkttexte KI, Produkttexte automatisch schreiben',
    },
    heroIcon: 'text',
    heroCaption: 'Text Generator',
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
        `<p style="color:#d8c5c4;">VM-Modell wählen &#8211; Ihre Markenstimme ist bereits trainiert.</p>`,
        `<div class="demo-upload-zone">${icon('upload')}<p>CSV mit Produktdaten hier ablegen.</p></div>`,
        `<p style="color:#d8c5c4;">3 von 3 Zeilen fertig &#8211; Testzeile geprüft, Batch abgeschlossen.</p>`,
      ],
    },
  },
  {
    slug: 'bilder-generieren',
    seo: {
      title: 'KI-Bildgenerator für Marketing & Produktbilder',
      description: 'Marketing-Visuals aus Text oder Referenzbildern erstellen — mit deinen markentrainierten Virtual-Marketer-Modellen.',
      keywords: 'KI Bildgenerator Marketing, Produktbilder mit KI erstellen, KI Bilder für Unternehmen, Marketing Visuals KI',
    },
    heroIcon: 'picture',
    heroCaption: 'Image Generator',
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
        `<div class="demo-code-block" style="color:#f4ece9;">„Produktfoto eines Sneakers auf hellem Studiohintergrund, weiches Licht, Frontalansicht&#8220;</div>`,
        `<div class="demo-swatches"><div class="demo-chip selected">1:1</div><div class="demo-chip">16:9</div><div class="demo-chip">9:16</div></div>`,
        `<div class="hero-visual" style="border-radius:12px;min-height:160px;"><div class="hero-visual-icon">${icon('picture')}</div></div>
        <p class="demo-caption">Illustrativ &#8211; das generierte Bild erscheint hier in voller Auflösung.</p>`,
      ],
    },
  },
  {
    slug: 'videos-generieren',
    seo: {
      title: 'KI-Videogenerator für Marketing-Clips',
      description: 'Marketing-Videos aus Text, Bildern oder durch Verlängern bestehender Clips generieren — für jeden Kanal.',
      keywords: 'KI Video generieren Marketing, KI Videogenerator, Marketing Video KI Tool, KI Werbevideo erstellen',
    },
    heroIcon: 'play',
    heroCaption: 'Video Generator',
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
        `<div class="demo-swatches">
          <div class="demo-chip selected">Schnell</div><div class="demo-chip">Referenzen</div><div class="demo-chip">Frames</div><div class="demo-chip">Verlängern</div>
        </div>`,
        `<div class="demo-code-block" style="color:#f4ece9;">„Produkt dreht sich langsam vor neutralem Hintergrund, weiches Studiolicht&#8220;</div>`,
        `<div class="hero-visual" style="border-radius:12px;min-height:160px;"><div class="hero-visual-icon">${icon('play')}</div></div>
        <p class="demo-caption">Illustrativ &#8211; das fertige Video erscheint hier zum Download.</p>`,
      ],
    },
  },
  {
    slug: 'seo-content',
    seo: {
      title: 'KI-SEO-Content aus deiner Sitemap — Blogartikel automatisch',
      description: 'Themen direkt aus deiner Sitemap, vollständige Artikel inklusive Hero-Bildern — kontextbewusst statt generisch.',
      keywords: 'KI SEO Content Generator, Blogartikel automatisch erstellen KI, KI Content aus Sitemap, SEO Text Generator',
    },
    heroIcon: 'seo',
    heroCaption: 'Content Generator',
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
        `<div class="demo-code-block">virtual-marketer.de/sitemap.xml</div>`,
        `<p style="color:#d8c5c4;">Liest Seiteninhalt, extrahiert Thema und Kontext &#8230;</p>`,
        `<p style="color:#d8c5c4;text-align:left;max-width:360px;margin:0 auto;">H1: Titel<br>H2: Einführung<br>H2: Hauptargument<br>H2: Fazit &amp; CTA</p>`,
      ],
    },
  },
  {
    slug: 'kampagnen-builder',
    seo: {
      title: 'KI-Kampagnen-Builder — von der Idee zu fertigen Assets',
      description: 'Konzepte, Skripte, Videos, Banner und PDFs in einem geführten 4-Schritte-Workflow — konsistent mit deiner Markenidentität.',
      keywords: 'KI Marketingkampagne erstellen, KI Kampagnen Generator, Creative Automation KI, KI Werbekampagne automatisch',
    },
    heroIcon: 'megaphone',
    heroCaption: 'Campaign Builder',
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
        `<div class="demo-code-block">Ziel: Sommer-Kollektion bewerben, Zielgruppe 20&ndash;35, Kanal Instagram</div>`,
        `<div class="demo-swatches"><div class="demo-chip selected">Konzept A: „Sommerfrische&#8220;</div><div class="demo-chip">Konzept B: „Stadtlook&#8220;</div></div>`,
        `<p style="color:#d8c5c4;text-align:left;max-width:360px;margin:0 auto;">Szene 1: Produkt in Nahaufnahme &#8211; „Der Sommer ruft.&#8220;<br>Szene 2: Lifestyle-Moment &#8211; „Bereit für alles.&#8220;</p>`,
        `<div class="demo-swatches"><div class="demo-chip">Video 9:16</div><div class="demo-chip">Banner</div><div class="demo-chip">PDF</div></div>`,
      ],
    },
  },
  {
    slug: 'interne-verlinkung',
    seo: {
      title: 'Interne Verlinkung automatisch — KI-Linkinator für SEO',
      description: 'Keyword→URL-Karte aus deiner Sitemap, automatisch in jeden Text eingewoben — einzeln oder im Bulk, CMS-unabhängig.',
      keywords: 'interne Verlinkung Tool, automatische interne Links SEO, SEO interne Verlinkung Software, Linkinator SEO',
    },
    heroIcon: 'link',
    heroCaption: 'Linkinator',
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
  {
    slug: 'mail-generator',
    seo: {
      title: 'KI-E-Mail-Generator — erstellen und über dein eigenes SMTP versenden',
      description: 'Marketing-E-Mail generieren, in der Vorschau prüfen und direkt über dein eigenes SMTP versenden — alles an einem Ort (Beta).',
      keywords: 'KI E-Mail Marketing Text generieren, Newsletter KI Texter, Marketing Email KI Generator deutsch',
    },
    heroIcon: 'mail',
    heroCaption: 'Mail Generator (Beta)',
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

function pageShell(f) {
  const url = `${BASE_URL}/ki-loesungen/${f.slug}/`;
  const heroAbs = f.heroImage ? `${BASE_URL}${f.heroImage}` : `${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: f.seo.title,
    description: f.seo.description,
    image: heroAbs,
    brand: { '@type': 'Brand', name: 'Virtual Marketer' },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
  };

  // Only Product Staging and Feed Enhance have real hero photography today
  // (see feature-catalog.md's "Demo images available today" table). Rather
  // than fabricate a fake product photo for the others, pages without one
  // get an honest abstract visual — an icon on a brand-color gradient.
  const heroVisualHtml = f.heroImage
    ? `<div class="hero-image"><img src="${f.heroImage}" alt="${f.seo.title}" loading="eager"></div>`
    : `<div class="hero-image hero-visual"><div class="hero-visual-icon">${icon(f.heroIcon || 'agent')}</div>${f.heroCaption ? `<span class="hero-visual-caption">${f.heroCaption}</span>` : ''}</div>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${f.seo.title} | Virtual Marketer</title>
<meta name="description" content="${f.seo.description}">
<meta name="keywords" content="${f.seo.keywords}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<link rel="alternate" hreflang="en" href="${EN_BASE_URL}/ki-loesungen/${f.slug}/">
<link rel="alternate" hreflang="x-default" href="${url}">

<meta property="og:type" content="product">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="${f.seo.title}">
<meta property="og:description" content="${f.seo.description}">
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
  }
</style>
</head>
<body class="vm-static-blog">
${HEADER}
<main class="vm-fp">
  <section class="hero" style="margin-top:44px;">
    <div>
      <span class="eyebrow">${f.eyebrow}</span>
      <h1>${f.seo.title}</h1>
      <p class="tagline">${f.tagline}</p>
      <p class="intro">${f.intro}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/virtual-marketer-demo/">Demo buchen</a>
        ${f.demo ? '<a class="btn btn-ghost" href="#demo">Live-Demo ansehen</a>' : ''}
      </div>
    </div>
    ${heroVisualHtml}
  </section>

  <section aria-labelledby="audience-h">
    <p class="section-label">Für wen</p>
    <h2 class="section-title" id="audience-h">Für wen sich das lohnt</h2>
    <div class="audience-grid">
      ${f.audiences.map((a) => `<div class="audience-card"><b>${a.label}</b><span>${a.detail}</span></div>`).join('\n      ')}
    </div>
  </section>

  ${f.impact ? `<section aria-labelledby="impact-h">
    <p class="section-label">Business Impact</p>
    <h2 class="section-title" id="impact-h">${f.impact.heading}</h2>
    <p class="impact-note">${f.impact.note}</p>
    <div class="impact-cards">
      ${f.impact.cards.map((c) => `<div class="impact-card"><div class="value">${c.value}</div><div class="label">${c.label}</div><div class="sub">${c.sub}</div></div>`).join('\n      ')}
    </div>
    <div class="impact-compliance">${icon('check')}<span>${f.impact.compliance}</span></div>
  </section>` : ''}

  ${f.demo ? `<section id="demo" aria-labelledby="demo-h">
    <p class="section-label">Live-Demo</p>
    <h2 id="demo-h">So funktioniert's &#8211; zum Ausprobieren</h2>
    <div class="demo">
      <div class="demo-steps" role="tablist">
        ${f.demo.steps.map((s, i) => `<button class="demo-step-btn${i === 0 ? ' active' : ''}" data-step="${i}" role="tab">${icon(s.icon)}<span>${s.label}</span></button>`).join('\n        ')}
      </div>
      <div class="demo-stage">
        ${f.demo.panels.map((p, i) => `<div class="demo-panel${i === 0 ? ' active' : ''}" data-panel="${i}">${p}</div>`).join('\n        ')}
      </div>
      <div class="demo-nav">
        <button class="secondary" id="demo-prev" disabled>Zurück</button>
        <button id="demo-next">Weiter</button>
      </div>
    </div>
  </section>` : ''}

  <section aria-labelledby="value-h">
    <p class="section-label">Ihr Mehrwert</p>
    <h2 class="section-title" id="value-h">Was Sie davon haben</h2>
    <div class="value-grid">
      ${f.valueBullets.map((v) => `<div class="value-item">${icon('check')}<span>${v}</span></div>`).join('\n      ')}
    </div>
  </section>

  <section aria-labelledby="how-h">
    <p class="section-label">Ablauf</p>
    <h2 class="section-title" id="how-h">So funktioniert's</h2>
    <ol class="how-list">
      ${f.howTo.map((s) => `<li>${s}</li>`).join('\n      ')}
    </ol>
  </section>

  <section aria-labelledby="faq-h">
    <p class="section-label">FAQ</p>
    <h2 class="section-title" id="faq-h">Häufige Fragen</h2>
    <div class="faq-list">
      ${f.faq.map((item) => `<div class="faq-item"><p class="q">${item.q}</p><p class="a">${item.a}</p></div>`).join('\n      ')}
    </div>
  </section>
</main>
${FOOTER}

<script>
(function(){
  var steps = document.querySelectorAll('.demo-step-btn');
  var panels = document.querySelectorAll('.demo-panel');
  var prevBtn = document.getElementById('demo-prev');
  var nextBtn = document.getElementById('demo-next');
  var current = 0;

  function show(i){
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function(b, idx){ b.classList.toggle('active', idx === current); });
    panels.forEach(function(p){ p.classList.toggle('active', Number(p.dataset.panel) === current); });
    prevBtn.disabled = current === 0;
    nextBtn.textContent = current === steps.length - 1 ? 'Von vorn' : 'Weiter';
  }
  steps.forEach(function(b, idx){ b.addEventListener('click', function(){ show(idx); }); });
  prevBtn.addEventListener('click', function(){ show(current - 1); });
  nextBtn.addEventListener('click', function(){ show(current === steps.length - 1 ? 0 : current + 1); });

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
</body>
</html>`;
}

function main() {
  console.log('\n🖼️  Generating feature landing pages...\n');

  const assetSrc = path.join(ROOT, 'assets/product-pages');
  const assetDist = path.join(DIST, 'product-pages');
  fs.mkdirSync(assetDist, { recursive: true });
  for (const file of fs.readdirSync(assetSrc)) {
    fs.copyFileSync(path.join(assetSrc, file), path.join(assetDist, file));
  }

  for (const f of FEATURES) {
    const outDir = path.join(DIST, 'ki-loesungen', f.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), pageShell(f));
    console.log(`  ✓ /ki-loesungen/${f.slug}/`);
  }

  // Link all feature pages from the /ki-loesungen/ hub as a proper grid —
  // this replaces the earlier single-card version now that enough pages
  // exist to warrant a real section instead of one callout.
  const hubPath = path.join(DIST, 'ki-loesungen', 'index.html');
  if (fs.existsSync(hubPath)) {
    let hub = fs.readFileSync(hubPath, 'utf-8');
    const marker = '<h2 id="vmaf-heading">';
    if (hub.includes(marker)) {
      const cards = FEATURES.map((f) => `
        <a class="vm-fp-callout-card" href="/ki-loesungen/${f.slug}/">
          <strong>${f.eyebrow}</strong>
          <span>${f.tagline}</span>
        </a>`).join('');
      const section = `
<section class="vm-fp-callout" style="max-width:1140px;margin:48px auto;padding:0 20px;">
  <style>
    .vm-fp-callout-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;}
    .vm-fp-callout-card{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid #e7dfe0;border-left:4px solid #94152b;border-radius:12px;padding:18px 20px;text-decoration:none;color:#241417;transition:transform .15s ease,box-shadow .15s ease;}
    .vm-fp-callout-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(36,20,23,.1);}
    .vm-fp-callout-card strong{font-size:15px;}
    .vm-fp-callout-card span{color:#6b5f60;font-size:13px;}
  </style>
  <h3 style="font-size:20px;margin-bottom:18px;">Alle KI-Lösungen im Überblick</h3>
  <div class="vm-fp-callout-grid">
  ${cards}
  </div>
</section>
`;
      // Replace a previously-injected single-card section from an earlier
      // build if present, otherwise inject fresh before the legacy showcase.
      hub = hub.includes('vm-fp-callout')
        ? hub.replace(/<section class="vm-fp-callout"[\s\S]*?<\/section>\s*/, section)
        : hub.replace(marker, section + marker);
      fs.writeFileSync(hubPath, hub);
      console.log(`  ✓ Linked ${FEATURES.length} page(s) from /ki-loesungen/ hub`);
    }
  }

  console.log(`\n✅ ${FEATURES.length} feature page(s) generated\n`);
}

main();
