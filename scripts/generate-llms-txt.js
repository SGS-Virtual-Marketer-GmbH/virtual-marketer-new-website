#!/usr/bin/env node

/**
 * llms.txt Generator
 *
 * Writes /llms.txt — the emerging convention (llmstxt.org) for handing an
 * LLM a clean, structured map of a site instead of making it reverse-engineer
 * one from rendered HTML. Answer engines increasingly fetch it when deciding
 * what a domain is about and which URL to cite for a given question, which is
 * the GEO counterpart to what sitemap.xml does for classic search.
 *
 * Everything here is derived from the built pages' own <title> and meta
 * description rather than written by hand. Two reasons: the copy stays in
 * sync automatically on every build, and it cannot drift into claiming
 * something the site does not say — which matters for a product page, where
 * the approved wording lives in the app registry, not in this repo.
 *
 * Run at the very end of the pipeline, after the title and description
 * fixers, so it captures the final text rather than an intermediate state.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';

// Ordered: first matching section wins, so put the specific prefixes first.
const SECTIONS = [
  { title: 'KI-Lösungen (Produkte)', match: (u) => u.startsWith('/ki-loesungen/') && u !== '/ki-loesungen/' },
  { title: 'English — Solutions', match: (u) => u.startsWith('/en/solutions/') && u !== '/en/solutions/' },
  { title: 'English — Core pages', match: (u) => u.startsWith('/en/') && !u.startsWith('/en/blog/') },
  { title: 'English — Blog', match: (u) => u.startsWith('/en/blog/') && u !== '/en/blog/' },
  { title: 'Blog', match: (u) => u.startsWith('/blog/') && u !== '/blog/' },
  { title: 'Unternehmen & Rechtliches', match: () => true },
];

const EXCLUDE = ['/404.html', '/login/'];

function decodeEntities(s) {
  return s
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function findPages(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findPages(full, results);
    else if (entry.name === 'index.html') results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🤖 Generating llms.txt...\n');

  const pages = [];
  for (const file of findPages(DIST)) {
    const rel = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
    const url = rel ? `/${rel}/` : '/';
    if (EXCLUDE.includes(url)) continue;

    const html = fs.readFileSync(file, 'utf-8');
    const title = decodeEntities(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim());
    const desc = decodeEntities(
      ((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '').trim()
    );
    if (!title) continue;
    pages.push({ url, title, desc });
  }

  pages.sort((a, b) => a.url.localeCompare(b.url));

  const home = pages.find((p) => p.url === '/');
  const buckets = new Map(SECTIONS.map((s) => [s.title, []]));
  for (const p of pages) {
    if (p.url === '/') continue;
    const section = SECTIONS.find((s) => s.match(p.url));
    buckets.get(section.title).push(p);
  }

  const lines = [];
  lines.push('# Virtual Marketer');
  lines.push('');
  lines.push(`> ${home ? home.desc : 'KI-Marketinglösung aus Deutschland.'}`);
  lines.push('');
  lines.push(
    'Virtual Marketer ist eine KI-Marketingplattform der SGS Virtual Marketer GmbH. ' +
      'Diese Datei listet die kanonischen Seiten der Website mit ihrer jeweiligen ' +
      'Kurzbeschreibung. Die deutschsprachigen Seiten liegen unter der Wurzel, die ' +
      'englischen Entsprechungen unter /en/ (verknüpft über hreflang).'
  );
  lines.push('');
  lines.push(`- [Startseite](${BASE_URL}/): ${home ? home.desc : ''}`);
  lines.push('');

  for (const { title } of SECTIONS) {
    const items = buckets.get(title);
    if (!items.length) continue;
    lines.push(`## ${title}`);
    lines.push('');
    for (const p of items) {
      lines.push(`- [${p.title}](${BASE_URL}${p.url})${p.desc ? `: ${p.desc}` : ''}`);
    }
    lines.push('');
  }

  const out = lines.join('\n');
  fs.writeFileSync(path.join(DIST, 'llms.txt'), out);

  const counts = SECTIONS.map(({ title }) => `${buckets.get(title).length} ${title}`).filter((s) => !s.startsWith('0 '));
  console.log(`✅ llms.txt written — ${pages.length} pages`);
  counts.forEach((c) => console.log(`   • ${c}`));
  console.log('');
}

main();
