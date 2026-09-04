#!/usr/bin/env node

/**
 * Machine-readable dates for the blog's visible bylines.
 *
 * Every post this project generates already SHOWS a date and author — the
 * `vm-meta` block under the H1 (`<span>7. Juli 2026</span> · <span>Virtual
 * Marketer Team</span>`) — but as plain spans, invisible to anything that
 * parses markup for freshness signals. The legacy WordPress posts have a
 * proper `<time>` element from the old theme; the generated posts should
 * too. So this step upgrades vm-meta in place:
 *
 *   1. wraps the displayed date in `<time datetime="...">`, with the ISO
 *      date taken from the page's own BlogPosting JSON-LD so the visible
 *      and machine-readable dates cannot disagree, and
 *   2. appends "Aktualisiert am …" / "Updated …" — only when dateModified
 *      is actually later than datePublished; a fake freshness stamp is the
 *      kind of E-E-A-T signal that backfires.
 *
 * Deliberately NOT a new author block: the page already names its author
 * visibly, and no human author is invented for machine-assisted editorial
 * content. Posts that already contain a <time> element (the legacy ones)
 * are left alone.
 *
 * Runs after enrich-structured-data.js (it reads the BlogPosting JSON-LD).
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(iso, lang) {
  const m = iso && iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = (lang === 'en' ? MONTHS_EN : MONTHS_DE)[Number(mo) - 1];
  return lang === 'en' ? `${Number(d)} ${month} ${y}` : `${Number(d)}. ${month} ${y}`;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n✍️  Upgrading blog bylines to semantic <time> markup...\n');

  let upgraded = 0;
  let withUpdated = 0;
  let alreadySemantic = 0;

  for (const file of findHtmlFiles(DIST)) {
    const rel = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
    if (!/^(en\/)?blog\/[^/]+$/.test(rel)) continue;

    let html = fs.readFileSync(file, 'utf-8');

    // Remove artifacts of this script's earlier injected-byline approach,
    // in case it runs over a dist that was processed by that version.
    html = html
      .replace(/\n?<p class="vm-byline">[\s\S]*?<\/p>/g, '')
      .replace(/<style id="vm-byline-css">[\s\S]*?<\/style>\n?/g, '');

    if (/<time[\s>]/i.test(html)) {
      if (html !== fs.readFileSync(file, 'utf-8')) fs.writeFileSync(file, html);
      alreadySemantic++;
      continue;
    }

    const ld = html.match(/<script type="application\/ld\+json"[^>]*>({[^<]*"BlogPosting"[^<]*})<\/script>/);
    if (!ld) continue;
    let meta;
    try {
      meta = JSON.parse(ld[1]);
    } catch {
      continue;
    }
    if (!meta.datePublished) continue;

    const lang = rel.startsWith('en/') ? 'en' : 'de';
    const sep = lang === 'en' ? ' &middot; ' : ' · ';

    const modifiedIso =
      meta.dateModified && meta.dateModified > meta.datePublished ? meta.dateModified : null;

    const next = html.replace(
      /(<div class="vm-meta">\s*)<span>([^<]+)<\/span>([\s\S]*?)(<\/div>)/,
      (_, open, dateText, rest, close) => {
        let inner = `<span><time datetime="${meta.datePublished}">${dateText}</time></span>${rest}`;
        if (modifiedIso) {
          const label = lang === 'en' ? 'Updated' : 'Aktualisiert am';
          inner = inner.replace(
            /\s*$/,
            `${sep}<span>${label} <time datetime="${modifiedIso}">${formatDate(modifiedIso, lang)}</time></span>\n    `
          );
          withUpdated++;
        }
        return open + inner + close;
      }
    );

    if (next !== html) {
      fs.writeFileSync(file, next);
      upgraded++;
    }
  }

  console.log(`✅ ${upgraded} post(s) upgraded to <time> markup (${withUpdated} with a real updated-date)`);
  console.log(`   • ${alreadySemantic} post(s) already had semantic dates — untouched\n`);
}

main();
