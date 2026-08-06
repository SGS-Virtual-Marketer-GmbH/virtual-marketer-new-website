#!/usr/bin/env node

/**
 * Builds the body of /modell-anfragen/ and /en/request-custom-model/.
 *
 * WHAT WAS THERE — THE FORM
 *
 *     <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSf…/viewform?embedded=true"
 *             width="1000" height="3000">
 *
 * Three separate problems in one tag. It is a 3000px iframe, so the page has a
 * scrollbar inside a scrollbar and no chance of working on a phone. It is
 * Google's typography and Google's buttons in the middle of a Virtual Marketer
 * page. And it sends every applicant's domain, feed URLs and example product
 * copy — their catalogue data and their tone of voice — to a processor the
 * privacy policy does not list, on a site that states it embeds no
 * third-party services.
 *
 * The replacement carries every field of the original, both branches, and
 * posts to /api/model-requests with the same double opt-in the contact form
 * uses. See assets/model-request/model-request.js for the field list and
 * backend/src/routes/model-requests.js for the validation.
 *
 * WHAT WAS THERE — THE PAGE AROUND IT
 *
 * Everything else on the German page was still the raw WordPress export:
 * Elementor section/column/widget wrappers nested six deep around unstyled
 * default typography, a spacer widget doing the job of a margin, and the
 * explanation of what the two services actually are sitting *below* the form
 * rather than above it — so the page asked you to fill in a form before it
 * told you what you were asking for. The English page had the right order but
 * plain body copy, and its form section sat outside the main landmark.
 *
 * So this now renders the whole body for both locales from one layout: lede,
 * three facts, the two routes as cards, the form, and a booking CTA for people
 * who would rather talk first. Same structure in both languages, so the pages
 * cannot drift apart again.
 *
 * THE COPY IS THE CLIENT'S, WITH TWO EXCEPTIONS
 *
 * The wording is the existing page's, trimmed of the exclamation marks and
 * re-ordered — not rewritten. Two things did change, and deliberately:
 *
 *   • "Fordern Sie noch heute Ihr kostenloses Strategie-Erstgespräch an
 *     unter." — a sentence that ends mid-preposition with a full stop, then a
 *     link. It is a typo, and it is fixed.
 *
 *   • The three-fact strip is new. Each fact is something the page already
 *     claims or the company already does; nothing here is invented. The
 *     hosting line follows the actual policy — location is contractually
 *     agreeable, EU or Germany on request — and is not phrased as an
 *     unconditional guarantee.
 *
 * HEADING ORDER
 *
 * h1 (page header) → h2 → h3 h3 → h2 → h2. No level is skipped, which is what
 * Lighthouse was reporting on this page — together with the footer's empty h6,
 * which scripts/fix-a11y.js removes.
 *
 * NO-JAVASCRIPT PATH
 *
 * A <noscript> block with a mailto: link, not a hidden plain form. A plain
 * form would need a POST endpoint that accepts a full-page submit and
 * redirects — a second code path through the same validation, for a case that
 * is rare and has a perfectly good manual alternative. Saying "write to us"
 * is honest; a form that silently loses its branch logic is not.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PAGES = [
  {
    url: '/modell-anfragen/',
    locale: 'de',
    demo: '/virtual-marketer-demo/',
    lede:
      'Beschreiben Sie, was Ihr KI-Modell können soll. Wir melden uns mit einer ' +
      'Einschätzung zu Machbarkeit, Aufwand und Datenbedarf zurück — bevor Sie sich ' +
      'auf irgendetwas festlegen.',
    facts: [
      ['Kostenloses Erstgespräch', 'Wir schätzen Machbarkeit und Aufwand ein, bevor Kosten entstehen.'],
      ['Neu oder bestehend', 'Wir entwickeln ein Modell von Grund auf — oder passen ein vorhandenes an.'],
      ['Hosting nach Absprache', 'Speicher- und Verarbeitungsort lassen sich vertraglich festlegen, auf Wunsch EU oder Deutschland.'],
    ],
    routesHeading: 'Zwei Wege zu Ihrem Modell',
    routes: [
      {
        h: 'Neues KI-Modell entwickeln',
        p:
          'Sie haben eine konkrete Anforderung oder ein Problem, das Sie mit künstlicher ' +
          'Intelligenz lösen möchten? Unser Data-Science-Team entwickelt maßgeschneiderte ' +
          'Modelle, die auf Ihre Bedürfnisse zugeschnitten sind — ob Kundenverhalten, ' +
          'Produktvorhersagen oder Prozessoptimierung.',
      },
      {
        h: 'Bestehendes Modell anpassen',
        p:
          'Sie setzen bereits KI-Modelle ein, die optimiert oder an neue Anforderungen ' +
          'angepasst werden sollen? Unsere Data Scientists prüfen, optimieren und erweitern ' +
          'vorhandene Modelle, damit sie weiterhin den vollen Nutzen für Ihr Unternehmen bringen.',
      },
    ],
    formHeading: 'Modell-Anfrage',
    formLede:
      'Je konkreter Ihre Beispiele, desto genauer der Vorschlag, den Sie zurückbekommen. ' +
      'Sie brauchen rund fünf Minuten.',
    nojs:
      'Für dieses Formular wird JavaScript benötigt. Schreiben Sie uns alternativ direkt an ' +
      '<a href="mailto:info@virtual-marketer.de?subject=Modell-Anfrage">info@virtual-marketer.de</a> — ' +
      'nennen Sie darin Ihre Domain, ob ein neues Modell entstehen oder ein bestehendes angepasst werden soll, ' +
      'und je ein Beispiel für idealen Input und Output.',
    ctaHeading: 'Lieber erst sprechen?',
    ctaBody:
      'Wenn Sie noch nicht wissen, ob sich Ihr Vorhaben mit einem eigenen Modell lösen lässt, ' +
      'klären wir das im kostenlosen Strategie-Erstgespräch — ohne dass Sie vorher ein Formular ausfüllen.',
    ctaBtn: 'Kostenloses Erstgespräch buchen',
    mailLine: 'Oder schreiben Sie uns an',
  },
  {
    url: '/en/request-custom-model/',
    locale: 'en',
    demo: '/en/demo/',
    eyebrow: 'Custom Models',
    h1: 'Request a Custom AI Model',
    lede:
      'Describe what your AI model should do. We come back with an assessment of ' +
      'feasibility, effort and the data it would need — before you commit to anything.',
    facts: [
      ['Free first call', 'We assess feasibility and effort before any cost is involved.'],
      ['New or existing', 'We build a model from scratch — or adapt one you already run.'],
      ['Hosting by agreement', 'Where your data is stored and processed can be set contractually, in the EU or Germany on request.'],
    ],
    routesHeading: 'Two ways we can help',
    routes: [
      {
        h: 'Request a new model',
        p:
          'Have a specific requirement or problem you would like to solve with AI? Our data ' +
          'science team builds custom models tailored precisely to your needs — whether that is ' +
          'customer behaviour, product forecasting or process optimisation.',
      },
      {
        h: 'Adjust an existing model',
        p:
          'Already running AI models that could be optimised or adapted to new requirements? ' +
          'Our data scientists review, tune and extend existing models so they keep delivering ' +
          'their full value to your business.',
      },
    ],
    formHeading: 'Request a model',
    formLede:
      'The more concrete your examples, the more precise the proposal you get back. ' +
      'It takes about five minutes.',
    nojs:
      'This form needs JavaScript. You can also write to us directly at ' +
      '<a href="mailto:info@virtual-marketer.de?subject=Custom model request">info@virtual-marketer.de</a> — ' +
      'tell us your domain, whether you need a new model or a change to an existing one, ' +
      'and one example each of an ideal input and output.',
    ctaHeading: 'Would you rather talk first?',
    ctaBtn: 'Book a free first call',
    ctaBody:
      'If you are not yet sure whether your problem needs a model of its own, we will work ' +
      'that out in a free strategy call — no form to fill in first.',
    mailLine: 'Or write to us at',
  },
];

/** The Google Form embed, in any of the shapes the export produced. */
const IFRAME = /<iframe\b[^>]*docs\.google\.com\/forms\/[^>]*>[\s\S]*?<\/iframe>/gi;

/* ------------------------------------------------------------------ layout */

function renderBody(p) {
  const facts = p.facts
    .map(([term, def]) => `      <li><strong>${term}</strong><span>${def}</span></li>`)
    .join('\n');

  const routes = p.routes
    .map(
      (r, i) => `      <article class="vm-mr-card">
        <span class="vm-mr-num" aria-hidden="true">${i + 1}</span>
        <h3>${r.h}</h3>
        <p>${r.p}</p>
      </article>`
    )
    .join('\n');

  return `<div class="vm-mr-page">
  <div class="vm-mr-wrap">

    <p class="vm-mr-intro">${p.lede}</p>

    <ul class="vm-mr-facts">
${facts}
    </ul>

    <h2>${p.routesHeading}</h2>
    <div class="vm-mr-cards">
${routes}
    </div>

    <section class="vm-mr-section" id="anfrage">
      <h2>${p.formHeading}</h2>
      <p class="vm-mr-lede">${p.formLede}</p>
      <div data-vm-model-request data-locale="${p.locale}"></div>
      <noscript>
        <div class="vm-mr-nojs"><p>${p.nojs}</p></div>
      </noscript>
    </section>

    <aside class="vm-mr-cta">
      <h2>${p.ctaHeading}</h2>
      <p>${p.ctaBody}</p>
      <a class="vm-mr-cta-btn" href="${p.demo}">${p.ctaBtn}</a>
      <p class="vm-mr-cta-alt">${p.mailLine} <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a></p>
    </aside>

  </div>
</div>`;
}

/**
 * The h2 rule carries !important on purpose. scripts/mobile-polish.js sets
 * `h2{font-size:clamp(23px,6.4vw,32px) !important}` below 1024px, so without
 * a matching !important the headings on this page would be *larger* on a
 * phone than on a desktop. Answering one !important with another is the
 * narrow fix; the alternative is unpicking the global clamp, which every
 * legacy page relies on.
 */
const SECTION_CSS = `<style id="vm-model-request-section">
  .vm-mr-page{
    --vm-red:#94152b; --vm-red-dark:#700f2b; --vm-blue:#66a3ce;
    --vm-ink:#241417; --vm-body:#4a4143; --vm-line:#e7dfe0; --vm-tint:#faf7f7;
    padding:14px 20px 72px;
    color:var(--vm-body);
  }
  .vm-mr-wrap{max-width:820px;margin:0 auto}

  .vm-mr-page h2{
    font-size:24px !important;line-height:1.3;font-weight:700;
    color:var(--vm-ink);margin:52px 0 16px;
  }
  .vm-mr-page h3{font-size:18px;line-height:1.35;font-weight:700;color:var(--vm-ink);margin:0 0 8px}
  .vm-mr-page p{line-height:1.68;margin:0 0 16px}

  .vm-mr-intro{font-size:19px;line-height:1.6;color:var(--vm-ink);margin:0 0 30px;max-width:64ch}

  /* Three facts, as a definition-ish strip rather than a bullet list: each is
     a claim plus its qualification, and the qualification is what keeps the
     claim honest, so the two must not be separable. */
  .vm-mr-facts{
    list-style:none;margin:0;padding:0;
    display:grid;gap:14px;grid-template-columns:repeat(3,1fr);
  }
  .vm-mr-facts li{
    background:var(--vm-tint);border:1px solid var(--vm-line);border-radius:12px;
    padding:16px 18px;border-top:3px solid var(--vm-red);
  }
  .vm-mr-facts strong{display:block;color:var(--vm-ink);font-size:15px;margin-bottom:5px}
  .vm-mr-facts span{display:block;font-size:14px;line-height:1.5}

  .vm-mr-cards{display:grid;gap:18px;grid-template-columns:1fr 1fr}
  .vm-mr-card{
    position:relative;background:#fff;border:1px solid var(--vm-line);
    border-radius:14px;padding:24px 24px 8px;
  }
  .vm-mr-num{
    display:inline-flex;align-items:center;justify-content:center;
    width:30px;height:30px;border-radius:999px;margin-bottom:12px;
    background:var(--vm-red);color:#fff;font-weight:700;font-size:15px;
  }
  .vm-mr-card p{font-size:15px}

  .vm-mr-section{margin-top:56px}
  .vm-mr-lede{color:var(--vm-body);margin:0 0 28px;max-width:60ch}

  .vm-mr-cta{
    margin-top:56px;padding:30px 30px 26px;border-radius:16px;
    background:var(--vm-tint);border:1px solid var(--vm-line);
  }
  .vm-mr-cta h2{margin-top:0 !important}
  .vm-mr-cta p{max-width:60ch}
  .vm-mr-cta-btn{
    display:inline-block;margin-top:6px;padding:14px 28px;border-radius:10px;
    /* Deepened vm-blue: white on vm-blue itself is 2.7:1 and fails WCAG
       1.4.3. See scripts/fix-legacy-header.js. */
    background:linear-gradient(90deg,#3d7ba8,var(--vm-red));
    color:#fff;font-weight:600;text-decoration:none;
  }
  .vm-mr-cta-btn:hover{background:linear-gradient(90deg,var(--vm-red),var(--vm-red-dark));color:#fff}
  .vm-mr-cta-alt{margin:16px 0 0;font-size:14px}

  @media (max-width:860px){
    .vm-mr-facts{grid-template-columns:1fr}
    .vm-mr-cards{grid-template-columns:1fr}
    .vm-mr-page h2{font-size:21px !important;margin-top:40px}
    .vm-mr-intro{font-size:17px}
  }
</style>`;

/* ------------------------------------------------------------- replacement */

/** Finds the close of the element opened at `open`, counting nesting. */
function matchingClose(html, open, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi');
  re.lastIndex = open;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else {
      depth++;
    }
  }
  return -1;
}

/**
 * Replaces the page's content region with `body`.
 *
 * German page: the Elementor wrapper div, which holds everything between the
 * page header and the footer.
 *
 * English page: the contents of <main class="vm-en">, plus the form section
 * that generate-en-pages.js left sitting *after* the closing </main> — that
 * section was outside the main landmark, so a screen reader skipping to the
 * main content skipped the form the page exists for. The h1 and its eyebrow
 * are kept; they are the page's heading, not part of the body.
 */
function replaceBody(html, body) {
  const elementor = html.search(/<div\b[^>]*data-elementor-type=["']wp-page["'][^>]*>/i);
  if (elementor !== -1) {
    const end = matchingClose(html, elementor, 'div');
    if (end === -1) return null;
    return html.slice(0, elementor) + body + html.slice(end);
  }

  const main = html.search(/<main\b[^>]*class=["'][^"']*\bvm-en\b[^"']*["'][^>]*>/i);
  if (main !== -1) {
    const end = matchingClose(html, main, 'main');
    if (end === -1) return null;

    const inner = html.slice(main, end);
    const head =
      (inner.match(/<span class="eyebrow">[\s\S]*?<\/span>/i) || [''])[0] +
      '\n' +
      (inner.match(/<h1\b[\s\S]*?<\/h1>/i) || [''])[0];

    // Anything the previous run appended after </main>, form section included.
    let tail = html.slice(end);
    tail = tail.replace(/\s*<section class="vm-mr-section">[\s\S]*?<\/section>/i, '');

    return (
      html.slice(0, main) +
      `<main class="vm-en">\n${head}\n${body}\n</main>` +
      tail
    );
  }

  return null;
}

function copyAssets() {
  const src = path.join(ROOT, 'assets/model-request');
  const dest = path.join(DIST, 'assets/model-request');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['model-request.css', 'model-request.js']) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
}

function main() {
  console.log('\n🧾 Building the model-request pages...\n');

  copyAssets();

  let done = 0;
  const problems = [];

  for (const page of PAGES) {
    const file = path.join(DIST, page.url.replace(/^\/|\/$/g, ''), 'index.html');
    if (!fs.existsSync(file)) { problems.push(`${page.url} — page not found`); continue; }

    let html = fs.readFileSync(file, 'utf-8');
    const hadIframe = IFRAME.test(html);
    IFRAME.lastIndex = 0;

    const next = replaceBody(html, renderBody(page));
    if (next === null) { problems.push(`${page.url} — no content region to replace`); continue; }
    html = next;

    const head = html.search(/<\/head>/i);
    if (head !== -1 && !html.includes('vm-model-request-section')) {
      html =
        html.slice(0, head) +
        `<link rel="stylesheet" href="/assets/model-request/model-request.css">\n${SECTION_CSS}\n` +
        html.slice(head);
    }

    if (!html.includes('/assets/model-request/model-request.js')) {
      const bodyEnd = html.lastIndexOf('</body>');
      if (bodyEnd !== -1) {
        html =
          html.slice(0, bodyEnd) +
          '<script defer src="/assets/model-request/model-request.js"></script>\n' +
          html.slice(bodyEnd);
      }
    }

    fs.writeFileSync(file, html);
    done++;
    console.log(`   • ${page.url} — body rebuilt${hadIframe ? ', Google Form removed' : ''}`);
  }

  console.log(`\n✅ ${done} model-request page(s) built`);
  if (problems.length) {
    problems.forEach((p) => console.log(`   ⚠ ${p}`));
    process.exitCode = 1;
  }

  // The form must be present, and the heading levels must not skip.
  for (const page of PAGES) {
    const file = path.join(DIST, page.url.replace(/^\/|\/$/g, ''), 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf-8');

    if (!html.includes('data-vm-model-request')) {
      console.log(`   ⚠ ${page.url} lost its form widget`);
      process.exitCode = 1;
    }

    const levels = [...html.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)]
      .filter((m) => m[2].replace(/<[^>]*>/g, '').trim())
      .map((m) => +m[1][1]);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) {
        console.log(`   ⚠ ${page.url} skips h${levels[i - 1]} → h${levels[i]}`);
        process.exitCode = 1;
        break;
      }
    }
  }

  // Nothing anywhere should still embed a Google Form.
  const leftovers = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(full, 'utf-8');
      if (/docs\.google\.com\/forms/i.test(html)) leftovers.push(path.relative(DIST, full));
    }
  })(DIST);

  if (leftovers.length) {
    console.log(`   ⚠ ${leftovers.length} page(s) still embed a Google Form:`);
    leftovers.slice(0, 5).forEach((f) => console.log(`       ${f}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ no page embeds a Google Form any more\n');
  }
}

main();
