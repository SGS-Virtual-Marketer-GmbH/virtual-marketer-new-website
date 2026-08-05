#!/usr/bin/env node

/**
 * Replaces the Google Form on /modell-anfragen/ (and /en/request-custom-model/)
 * with the native widget in assets/model-request/.
 *
 * WHAT WAS THERE
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
 * NO-JAVASCRIPT PATH
 *
 * A <noscript> block with a mailto: link, not a hidden plain form. A plain
 * form would need a POST endpoint that accepts a full-page submit and
 * redirects — a second code path through the same validation, for a case that
 * is rare and has a perfectly good manual alternative. Saying "write to us"
 * is honest; a form that silently loses its branch logic is not.
 *
 * Runs after the page exists in dist/, so it edits rather than generates: the
 * surrounding copy on that page is the client's and is left alone.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const PAGES = [
  {
    url: '/modell-anfragen/',
    locale: 'de',
    heading: 'Modell-Anfrage',
    lede:
      'Beschreiben Sie, was Ihr Modell können soll. Je konkreter Ihre Beispiele, ' +
      'desto genauer der Vorschlag, den Sie von uns zurückbekommen.',
    nojs:
      'Für dieses Formular wird JavaScript benötigt. Schreiben Sie uns alternativ direkt an ' +
      '<a href="mailto:info@virtual-marketer.de?subject=Modell-Anfrage">info@virtual-marketer.de</a> — ' +
      'nennen Sie darin Ihre Domain, ob ein neues Modell entstehen oder ein bestehendes angepasst werden soll, ' +
      'und je ein Beispiel für idealen Input und Output.',
  },
  {
    url: '/en/request-custom-model/',
    locale: 'en',
    heading: 'Request a model',
    lede:
      'Describe what your model should do. The more concrete your examples, the more precise ' +
      'the proposal you get back from us.',
    nojs:
      'This form needs JavaScript. You can also write to us directly at ' +
      '<a href="mailto:info@virtual-marketer.de?subject=Custom model request">info@virtual-marketer.de</a> — ' +
      'tell us your domain, whether you need a new model or a change to an existing one, ' +
      'and one example each of an ideal input and output.',
  },
];

/** The Google Form embed, in any of the shapes the export produced. */
const IFRAME = /<iframe\b[^>]*docs\.google\.com\/forms\/[^>]*>[\s\S]*?<\/iframe>/gi;

function widgetHtml(page) {
  return `
<section class="vm-mr-section">
  <h2>${page.heading}</h2>
  <p class="vm-mr-lede">${page.lede}</p>
  <div data-vm-model-request data-locale="${page.locale}"></div>
  <noscript>
    <div class="vm-mr-nojs"><p>${page.nojs}</p></div>
  </noscript>
</section>`;
}

const SECTION_CSS = `<style id="vm-model-request-section">
  .vm-mr-section{max-width:760px;margin:0 auto;padding:8px 20px 64px;}
  .vm-mr-section h2{font-size:26px;margin:0 0 10px;color:#241417;}
  .vm-mr-lede{color:#4a4143;line-height:1.6;margin:0 0 28px;max-width:60ch;}
</style>`;

function copyAssets() {
  const src = path.join(ROOT, 'assets/model-request');
  const dest = path.join(DIST, 'assets/model-request');
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['model-request.css', 'model-request.js']) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
  }
}

function main() {
  console.log('\n🧾 Replacing the Google Form with the native model request...\n');

  copyAssets();

  let done = 0;
  const missing = [];

  for (const page of PAGES) {
    const file = path.join(DIST, page.url.replace(/^\/|\/$/g, ''), 'index.html');
    if (!fs.existsSync(file)) { missing.push(page.url); continue; }

    let html = fs.readFileSync(file, 'utf-8');
    if (html.includes('data-vm-model-request')) { done++; continue; }

    const hadIframe = IFRAME.test(html);
    IFRAME.lastIndex = 0;

    if (hadIframe) {
      // Replace the first embed, drop any further ones.
      let first = true;
      html = html.replace(IFRAME, () => {
        if (!first) return '';
        first = false;
        return widgetHtml(page);
      });
    } else {
      // No embed to replace (a regenerated page, or one already cleaned) —
      // append the widget before the footer rather than skipping the page.
      const anchor = html.search(/<footer\b/i);
      const at = anchor === -1 ? html.lastIndexOf('</body>') : anchor;
      if (at === -1) { missing.push(`${page.url} (no insertion point)`); continue; }
      html = html.slice(0, at) + widgetHtml(page) + '\n' + html.slice(at);
    }

    const head = html.search(/<\/head>/i);
    if (head !== -1 && !html.includes('vm-model-request-section')) {
      html =
        html.slice(0, head) +
        `<link rel="stylesheet" href="/assets/model-request/model-request.css">\n${SECTION_CSS}\n` +
        html.slice(head);
    }

    const bodyEnd = html.lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      html =
        html.slice(0, bodyEnd) +
        '<script defer src="/assets/model-request/model-request.js"></script>\n' +
        html.slice(bodyEnd);
    }

    fs.writeFileSync(file, html);
    done++;
    console.log(`   • ${page.url} — ${hadIframe ? 'Google Form replaced' : 'widget inserted'}`);
  }

  console.log(`\n✅ ${done} page(s) now use the native form`);
  if (missing.length) {
    console.log(`   ⚠ not found: ${missing.join(', ')}`);
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
