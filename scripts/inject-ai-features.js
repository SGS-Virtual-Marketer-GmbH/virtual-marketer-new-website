#!/usr/bin/env node

/**
 * AI Features Showcase Injector
 *
 * Adds a new, self-contained "AI-Features im Überblick" section — six
 * feature cards plus a live-preview text-generator widget — to:
 *   - the homepage (dist/index.html)
 *   - the main product page (dist/ki-loesungen/index.html)
 *
 * This is additive: it does not touch any existing content, just appends
 * the new section before </body> and copies its CSS/JS into dist/assets/.
 * Idempotent — re-running (e.g. on every `npm run build`) replaces the
 * previously-injected block instead of duplicating it, keyed by HTML
 * comment markers.
 *
 * Run after scripts/build.js (which wipes and regenerates dist/ from the
 * WordPress export), before scripts/seo-optimize.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS_SRC = path.join(ROOT, 'assets/ai-features');
const ASSETS_DIST = path.join(DIST, 'assets');

const START_MARKER = '<!-- vmaf:start -->';
const END_MARKER = '<!-- vmaf:end -->';

const FEATURES = [
  {
    icon: 'fa-pencil-alt',
    title: 'KI-Textgenerierung',
    body: 'Produktbeschreibungen, Blogartikel, Google- und Facebook-Anzeigen — automatisch erstellt, in Ihrem Markenton, ohne Duplicate Content.',
    href: '/ki-loesungen/#text-generation',
  },
  {
    icon: 'fa-comments',
    title: 'Chatbots & Voicebots',
    body: 'Kundenservice, der nie schläft. Rund um die Uhr Anfragen beantworten und nahtlos an Ihr Team übergeben, wenn es komplex wird.',
    href: '/virtual-marketer-ai-services/',
  },
  {
    icon: 'fa-search',
    title: 'Intelligente Produktsuche',
    body: 'Semantische Suche versteht, was Kunden meinen — nicht nur, was sie tippen. Weniger Zero-Result-Suchen, mehr gefundene Produkte.',
    href: '/blog/neural-search-ranking-ecommerce/',
  },
  {
    icon: 'fa-user-shield',
    title: 'Echtzeit-Personalisierung',
    body: 'Individuelle Angebote und Empfehlungen in Millisekunden — aufgebaut auf Erste-Partei-Daten, DSGVO-konform von Grund auf.',
    href: '/blog/personalisierung-vs-datenschutz-gdpr-2026/',
  },
  {
    icon: 'fa-robot',
    title: 'Agentic Kampagnen',
    body: 'KI-Agenten überwachen Ihre Kampagnen, verschieben Budgets und optimieren Anzeigen — mit klaren Leitplanken, die Sie festlegen.',
    href: '/blog/agentic-ai-marketing-kampagnen/',
  },
  {
    icon: 'fa-images',
    title: 'Multimodale KI',
    body: 'Text, Bild und Video zusammengedacht: Visual Search, automatische Bildverschlagwortung und Content-Varianten für jeden Kanal.',
    href: '/blog/multimodale-ki-im-einzelhandel/',
  },
];

function featureCard(f) {
  return `
      <div class="vmaf-card">
        <div class="vmaf-card-icon"><i class="fas ${f.icon}" aria-hidden="true"></i></div>
        <h3>${f.title}</h3>
        <p>${f.body}</p>
        <a class="vmaf-card-link" href="${f.href}">Mehr erfahren &rarr;</a>
      </div>`;
}

function buildSection() {
  return `${START_MARKER}
<section class="vmaf-section" id="ai-features" aria-labelledby="vmaf-heading">
  <div class="vmaf-inner">
    <div class="vmaf-header">
      <span class="vmaf-eyebrow">KI-Features</span>
      <h2 id="vmaf-heading">Eine Plattform, sechs KI-Fähigkeiten</h2>
      <p>Alle Funktionen sind für Ihr Unternehmen individuell trainierbar — kein Standardmodell von der Stange, sondern ein Custom-KI-Modell, das Ihre Marke versteht.</p>
    </div>

    <div class="vmaf-grid">${FEATURES.map(featureCard).join('')}
    </div>

    <div class="vmaf-demo">
      <div class="vmaf-demo-intro">
        <span class="vmaf-eyebrow">Live-Vorschau</span>
        <h3>Probieren Sie es selbst aus</h3>
        <p>Geben Sie einen Produktnamen ein und sehen Sie, wie eine KI-generierte Beschreibung klingen kann. Diese Vorschau läuft direkt in Ihrem Browser als Beispiel — die echte Lösung arbeitet mit Ihren tatsächlichen Produktdaten und Ihrer Markenstimme.</p>
        <a class="vmaf-demo-cta" href="/virtual-marketer-demo/">Echte Demo mit Ihren Produkten buchen</a>
      </div>
      <div>
        <form id="vmaf-demo-form" class="vmaf-demo-form">
          <label for="vmaf-product-name">Produktname</label>
          <input type="text" id="vmaf-product-name" placeholder="z. B. Merino Wanderjacke" maxlength="60">

          <label for="vmaf-product-kind">Produktart</label>
          <select id="vmaf-product-kind">
            <option value="mode">Mode &amp; Bekleidung</option>
            <option value="technik">Technik &amp; Elektronik</option>
            <option value="haushalt">Haushalt &amp; Wohnen</option>
            <option value="beauty">Beauty &amp; Pflege</option>
            <option value="sonstiges">Sonstiges</option>
          </select>

          <label for="vmaf-product-tone">Tonalität</label>
          <select id="vmaf-product-tone">
            <option value="sachlich">Sachlich</option>
            <option value="emotional">Emotional</option>
            <option value="werblich">Werblich</option>
          </select>

          <button type="submit">Text generieren</button>
        </form>
        <div id="vmaf-demo-output" class="vmaf-demo-output">
          <span class="vmaf-placeholder">Ihre generierte Produktbeschreibung erscheint hier …</span>
        </div>
        <p class="vmaf-demo-disclaimer">Illustrative Vorschau · kein Login erforderlich · für Ihre echten Produkte nutzen Sie die vollständige Plattform</p>
      </div>
    </div>
  </div>
</section>
<link rel="stylesheet" href="/assets/ai-features.css">
<script src="/assets/ai-features.js" defer></script>
${END_MARKER}`;
}

function injectInto(filePath, section) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ ${filePath} not found, skipping`);
    return false;
  }
  let html = fs.readFileSync(filePath, 'utf-8');

  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx !== -1 && endIdx !== -1) {
    html = html.slice(0, startIdx) + section + html.slice(endIdx + END_MARKER.length);
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', `${section}\n</body>`);
  } else {
    html += section;
  }

  fs.writeFileSync(filePath, html);
  return true;
}

function main() {
  console.log('\n🎨 Injecting AI Features showcase...\n');

  fs.mkdirSync(ASSETS_DIST, { recursive: true });
  fs.copyFileSync(path.join(ASSETS_SRC, 'ai-features.css'), path.join(ASSETS_DIST, 'ai-features.css'));
  fs.copyFileSync(path.join(ASSETS_SRC, 'ai-features.js'), path.join(ASSETS_DIST, 'ai-features.js'));
  console.log('  ✓ Copied ai-features.css / ai-features.js to dist/assets/');

  const section = buildSection();
  const targets = [path.join(DIST, 'index.html'), path.join(DIST, 'ki-loesungen/index.html')];

  targets.forEach((t) => {
    if (injectInto(t, section)) {
      console.log(`  ✓ Injected into ${path.relative(DIST, t)}`);
    }
  });

  console.log('\n✅ AI Features showcase added.\n');
}

main();
