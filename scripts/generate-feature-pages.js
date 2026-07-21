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
        { key: 'upload', label: 'Foto hochladen', icon: 'upload' },
        { key: 'model', label: 'Model wählen', icon: 'model' },
        { key: 'scene', label: 'Szene wählen', icon: 'scene' },
        { key: 'result', label: 'Ergebnis', icon: 'result' },
      ],
      models: ['A', 'B', 'C', 'D'],
      scenes: [
        { name: 'Studio', gradient: 'linear-gradient(135deg,#f4eeec,#e2d3d6)' },
        { name: 'Straße', gradient: 'linear-gradient(135deg,#dce8f0,#a3cce9)' },
        { name: 'Café', gradient: 'linear-gradient(135deg,#f0e4d8,#d9bfa0)' },
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
  };
  return `<svg viewBox="0 0 24 24" class="${className}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
}

function pageShell(f) {
  const url = `${BASE_URL}/ki-loesungen/${f.slug}/`;
  const heroAbs = `${BASE_URL}${f.heroImage}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: f.seo.title,
    description: f.seo.description,
    image: heroAbs,
    brand: { '@type': 'Brand', name: 'Virtual Marketer' },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
  };

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

  .vm-fp .section-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vm-gray-500);margin-bottom:10px;}
  .vm-fp h2.section-title{font-size:27px;margin:0 0 28px;}

  .vm-fp .audience-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  .vm-fp .audience-card{background:#fff;border:1px solid var(--vm-gray-200);border-radius:14px;padding:22px;}
  .vm-fp .audience-card b{display:block;font-size:40px;margin-bottom:8px;color:var(--vm-gray-900);}
  .vm-fp .audience-card span{font-size:15px;color:var(--vm-gray-500);line-height:1.5;}

  .vm-fp .impact-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;}
  .vm-fp .impact-card{background:linear-gradient(160deg,#fff,#fbecee);border:1px solid #f2d9dc;border-radius:14px;padding:22px;text-align:center;}
  .vm-fp .impact-card .value{font-size:114px;font-weight:800;color:var(--vm-red);font-variant-numeric:tabular-nums;}
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
        <a class="btn btn-ghost" href="#demo">Live-Demo ansehen</a>
      </div>
    </div>
    <div class="hero-image"><img src="${f.heroImage}" alt="${f.seo.title}" loading="eager"></div>
  </section>

  <section aria-labelledby="audience-h">
    <p class="section-label">Für wen</p>
    <h2 class="section-title" id="audience-h">Für wen sich das lohnt</h2>
    <div class="audience-grid">
      ${f.audiences.map((a) => `<div class="audience-card"><b>${a.label}</b><span>${a.detail}</span></div>`).join('\n      ')}
    </div>
  </section>

  <section aria-labelledby="impact-h">
    <p class="section-label">Business Impact</p>
    <h2 class="section-title" id="impact-h">${f.impact.heading}</h2>
    <p class="impact-note">${f.impact.note}</p>
    <div class="impact-cards">
      ${f.impact.cards.map((c) => `<div class="impact-card"><div class="value">${c.value}</div><div class="label">${c.label}</div><div class="sub">${c.sub}</div></div>`).join('\n      ')}
    </div>
    <div class="impact-compliance">${icon('check')}<span>${f.impact.compliance}</span></div>
  </section>

  <section id="demo" aria-labelledby="demo-h">
    <p class="section-label">Live-Demo</p>
    <h2 id="demo-h">So funktioniert's &#8211; zum Ausprobieren</h2>
    <div class="demo">
      <div class="demo-steps" role="tablist">
        ${f.demo.steps.map((s, i) => `<button class="demo-step-btn${i === 0 ? ' active' : ''}" data-step="${i}" role="tab">${icon(s.icon)}<span>${s.label}</span></button>`).join('\n        ')}
      </div>
      <div class="demo-stage">
        <div class="demo-panel active" data-panel="0">
          <div class="demo-upload-zone">${icon('upload')}<p>Produktfoto hier ablegen &#8211; ein Smartphone-Foto genügt.</p></div>
        </div>
        <div class="demo-panel" data-panel="1">
          <p style="color:#d8c5c4;margin-bottom:20px;">Model aus der Galerie wählen:</p>
          <div class="demo-swatches">
            ${f.demo.models.map((m, i) => `<div class="demo-model${i === 0 ? ' selected' : ''}" data-model="${i}">${m}</div>`).join('\n            ')}
          </div>
        </div>
        <div class="demo-panel" data-panel="2">
          <p style="color:#d8c5c4;margin-bottom:20px;">Szene wählen:</p>
          <div class="demo-swatches">
            ${f.demo.scenes.map((s, i) => `<div class="demo-scene${i === 0 ? ' selected' : ''}" data-scene="${i}" style="background:${s.gradient}">${s.name}</div>`).join('\n            ')}
          </div>
        </div>
        <div class="demo-panel" data-panel="3">
          <img class="demo-result-img" src="${f.heroImage}" alt="Generiertes Ergebnisbeispiel">
          <p class="demo-caption">So sieht ein fertiges Ergebnis aus &#8211; in Minuten statt Wochen generiert.</p>
        </div>
      </div>
      <div class="demo-nav">
        <button class="secondary" id="demo-prev" disabled>Zurück</button>
        <button id="demo-next">Weiter</button>
      </div>
    </div>
  </section>

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

  // Link the new page from the /ki-loesungen/ hub — a single tasteful
  // callout in the real brand colors, not a full hub redesign yet (pages
  // are built one at a time; the hub gets its own pass once several
  // feature pages exist).
  const hubPath = path.join(DIST, 'ki-loesungen', 'index.html');
  if (fs.existsSync(hubPath)) {
    let hub = fs.readFileSync(hubPath, 'utf-8');
    const marker = '<h2 id="vmaf-heading">';
    if (hub.includes(marker) && !hub.includes('vm-fp-callout')) {
      const callouts = FEATURES.map((f) => `
        <a class="vm-fp-callout-card" href="/ki-loesungen/${f.slug}/">
          <span class="vm-fp-callout-badge">Neu</span>
          <strong>${f.eyebrow}</strong>
          <span>${f.tagline}</span>
        </a>`).join('');
      const callout = `
<section class="vm-fp-callout" style="max-width:1140px;margin:48px auto;padding:0 20px;">
  <style>
    .vm-fp-callout-card{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid #e7dfe0;border-left:4px solid #94152b;border-radius:12px;padding:20px 22px;text-decoration:none;color:#241417;max-width:420px;transition:transform .15s ease,box-shadow .15s ease;}
    .vm-fp-callout-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(36,20,23,.1);}
    .vm-fp-callout-badge{display:inline-block;background:#66a3ce;color:#fff;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;width:fit-content;}
    .vm-fp-callout-card strong{font-size:17px;}
    .vm-fp-callout-card span:last-child{color:#6b5f60;font-size:14px;}
  </style>
  ${callouts}
</section>
`;
      hub = hub.replace(marker, callout + marker);
      fs.writeFileSync(hubPath, hub);
      console.log('  ✓ Linked from /ki-loesungen/ hub');
    }
  }

  console.log(`\n✅ ${FEATURES.length} feature page(s) generated\n`);
}

main();
