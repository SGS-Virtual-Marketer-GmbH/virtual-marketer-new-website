#!/usr/bin/env node

/**
 * Weaves internal links into the blog prose — the site running its own
 * Linkinator on itself.
 *
 * WHY
 *
 * Measured before this existed: a representative legacy post
 * (der-schluessel-zum-erfolgreichen-targeting-…) had twelve <a> elements in
 * its article and not one of them was editorial. Two were the comment
 * anchor, one was "javascript:void(0)", and the rest were the Twitter /
 * Facebook / Pinterest / LinkedIn / Reddit share row. Ninety blog posts
 * discussing exactly the things this company sells, linking to none of them.
 *
 * That is a real cost twice over. For search, an article with no outbound
 * internal links passes no authority and gives no topical signal about what
 * the site considers related. For a reader, an article about feed
 * optimisation that never mentions we build a feed optimiser is a dead end.
 *
 * HOW IT MIRRORS THE PRODUCT
 *
 * Linkinator's approved description is: "builds a keyword→URL map from your
 * sitemap and injects internal links into any text". This does the same
 * thing on the same principle:
 *
 *   1. read dist/sitemap.xml — the real, shipped URL set, not a hand-list
 *   2. for each URL, read the page and take its <meta name="keywords">, which
 *      the feature-page generator already curates per page, plus its <title>
 *   3. match those keywords against the article prose and link the FIRST
 *      occurrence of each
 *
 * Deriving the map from the pages themselves is the point: add a feature
 * page tomorrow and it becomes a link target with no edit here.
 *
 * WHY THERE IS ALSO A CURATED ALIAS LIST
 *
 * The meta keywords are SEO phrases — "Google Shopping Feed optimieren KI",
 * "KI Agent Google Ads". They are what people type into a search box and
 * almost never what appears verbatim in a German sentence, so on their own
 * they matched almost nothing. ALIASES adds the short noun phrases that do
 * occur in prose ("interne Verlinkung", "Produktbeschreibungen"). Both
 * sources feed one map; the aliases are the only hand-maintained part and
 * they are per-target, so a wrong one is obvious and local.
 *
 * THE RULES, AND WHY EACH EXISTS
 *
 * Automatic linking goes wrong in specific, well-known ways. Each guard
 * below is one of them:
 *
 *  - Prose only. Only the article body is touched — not nav, sidebar,
 *    footer, or the "Aktuelle Beiträge" widget, all of which are full of
 *    tempting keyword text and are already navigation.
 *  - Never inside an existing <a>. Nested anchors are invalid HTML and the
 *    browser's error recovery for them is not something to rely on.
 *  - Never inside a heading. A linked H2 looks like a broken template, and
 *    Google treats heading text as a topic signal, not an anchor.
 *  - Never inside code/pre/script/style — or inside a tag's attributes,
 *    which is what a naive string replace on HTML does and why it corrupts
 *    documents.
 *  - First occurrence only, one link per target per post. Repeating the same
 *    anchor five times is the classic over-optimisation pattern.
 *  - No self-links.
 *  - Longest keyword wins. With "Produktbeschreibungen optimieren" and
 *    "Produktbeschreibungen" both live, the specific target should win the
 *    span, not whichever happened to be tried first.
 *  - A hard cap per post (MAX_LINKS_PER_POST). Past a handful, additional
 *    internal links dilute rather than help.
 *
 * The result is deterministic: same input, same links, so a rebuild does not
 * silently reshuffle the link graph.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const SITEMAP = path.join(DIST, 'sitemap.xml');

/** Past this, extra internal links stop helping and start diluting. */
const MAX_LINKS_PER_POST = 6;

/** Anchors shorter than this match too much to be safe ("KI", "SEO"). */
const MIN_KEYWORD_LENGTH = 9;

/**
 * Short noun phrases that actually occur in German marketing prose, keyed by
 * the target path. Hand-written, because the meta keywords are search
 * phrases rather than sentence fragments — see the header.
 *
 * Ordering within a target does not matter; the matcher sorts globally by
 * length. Keep these specific: a generic alias like "Marketing" would link
 * half the site to one page.
 */
const ALIASES = {
  '/ki-loesungen/agenten/': ['KI-Agenten', 'KI-Agent', 'autonome Agenten', 'Marketing-Automatisierung'],
  '/ki-loesungen/produktfotos-ki/': ['Product Staging', 'KI-Produktfotos', 'Produktfotos', 'virtuelle Anprobe', 'Produktbilder'],
  '/ki-loesungen/feed-veredelung/': ['Feed-Veredelung', 'Produktfeed', 'Google Shopping', 'Merchant Center'],
  '/ki-loesungen/feed-optimierung/': ['Feed-Optimierung', 'Shopping-Feed'],
  '/ki-loesungen/texte-generieren/': ['Produktbeschreibungen', 'Produkttexte'],
  '/ki-loesungen/bulk-texte/': ['Bulk-Generator', 'Massengenerierung'],
  '/ki-loesungen/bilder-generieren/': ['KI-Bildgenerator', 'Bildgenerierung', 'Bildgenerator'],
  '/ki-loesungen/videos-generieren/': ['KI-Videogenerator', 'Videogenerierung', 'Videogenerator', 'KI-Videos'],
  '/ki-loesungen/seo-content/': ['SEO-Content', 'Blogartikel', 'Content-Erstellung'],
  '/ki-loesungen/interne-verlinkung/': ['interne Verlinkung', 'interne Links', 'Linkinator'],
  '/ki-loesungen/kampagnen-builder/': ['Kampagnen-Builder', 'Werbekampagne', 'Marketingkampagne'],
  '/ki-loesungen/mail-generator/': ['E-Mail-Generator', 'Newsletter'],
  '/ki-loesungen/social-publisher': ['Social Publisher', 'LinkedIn-Beiträge'],
  '/ki-loesungen/coding-api/': ['Coding-API', 'MCP-Server'],
  '/ki-loesungen/chat-insights/': ['Chat-Insights', 'Chatbot-Analyse'],
  '/ki-loesungen/ki-dateien/': ['KI-Dateiablage'],
  '/modell-anfragen/': ['eigenes KI-Modell', 'individuelles KI-Modell'],
};

/**
 * What may be linked TO, and by which rule. Everything else is not a target.
 *
 * An allow-list rather than a block-list, because the first version of this
 * script used a block-list and the result was instructive: /management/ won
 * 44 of 174 links. Its curated keywords include "Virtual Marketer Team" —
 * which is the byline printed on every single article. The most-linked page
 * on the site became the staff page, via the author credit.
 *
 * The same run gave 29 links to the homepage and 27 to one blog post, whose
 * keywords are "Personalisierung, Datenschutz, DSGVO, EU AI Act". Those are
 * topic tags. They describe what a post is ABOUT, which is exactly why they
 * match everything and make terrible anchors.
 *
 * So targets are restricted to the pages a link is actually worth spending
 * on — the solution pages and the two conversion pages — and blog posts
 * qualify only through their title (see TITLE_MIN_LENGTH), never their tags.
 */
const TARGET_ALLOW = /^\/(ki-loesungen\/[^/]+\/|modell-anfragen\/|kontakt\/)$/;

/**
 * A blog post may be linked by its own title, which is specific enough to be
 * a fair anchor, but only if the title is long enough to be unambiguous.
 */
const TITLE_MIN_LENGTH = 24;

/**
 * No single page may absorb more than this many inbound links site-wide.
 * Without it one well-matched phrase quietly becomes the site's entire
 * internal link graph, which is both a bad reader experience and the pattern
 * search engines read as manipulation.
 */
const MAX_INBOUND_PER_TARGET = 12;

/** Elements whose text must never be turned into an anchor. */
const SKIP_TAGS = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'script', 'style', 'button', 'figcaption', 'textarea', 'select', 'option']);

/* -------------------------------------------------------------------------
   Reading the site
   ------------------------------------------------------------------------- */

function sitemapUrls() {
  if (!fs.existsSync(SITEMAP)) return [];
  const xml = fs.readFileSync(SITEMAP, 'utf-8');
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

function pathOf(url) {
  return url.replace(/^https?:\/\/[^/]+/, '') || '/';
}

function fileFor(urlPath) {
  const clean = urlPath.replace(/^\//, '').replace(/\/$/, '');
  const candidates = clean
    ? [path.join(DIST, clean, 'index.html'), path.join(DIST, clean + '.html')]
    : [path.join(DIST, 'index.html')];
  return candidates.find((f) => fs.existsSync(f)) || null;
}

function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * keyword -> target path, built from the shipped sitemap.
 */
function buildKeywordMap() {
  const map = new Map();
  const targets = new Set();

  const add = (kw, target) => {
    const k = decode(kw).trim();
    if (k.length < MIN_KEYWORD_LENGTH) return;
    // First target to claim a keyword keeps it. Ambiguous keywords linking
    // to different pages on different posts would look arbitrary.
    if (!map.has(k.toLowerCase())) map.set(k.toLowerCase(), { keyword: k, target });
  };

  for (const url of sitemapUrls()) {
    const p = pathOf(url);
    const file = fileFor(p);
    if (!file) continue;
    const html = fs.readFileSync(file, 'utf-8');

    if (TARGET_ALLOW.test(p)) {
      targets.add(p);
      // Curated per-page search phrases — see the header on why these alone
      // matched little, and why ALIASES exists alongside them.
      const kw = /<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i.exec(html);
      if (kw) for (const k of kw[1].split(',')) add(k, p);
      continue;
    }

    // Blog posts: title only, never the topic tags.
    if (/^\/blog\/[^/]+\/$/.test(p)) {
      const t = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
      if (!t) continue;
      const title = decode(t[1].replace(/<[^>]+>/g, '')).trim().replace(/^[„"']|[""']$/g, '');
      if (title.length >= TITLE_MIN_LENGTH) add(title, p);
    }
  }

  // Curated aliases last: the sitemap-derived phrases are the primary map,
  // and a target that is not in the sitemap must not become a link.
  for (const [target, list] of Object.entries(ALIASES)) {
    if (!targets.has(target)) continue;
    for (const a of list) add(a, target);
  }

  return map;
}

/* -------------------------------------------------------------------------
   Matching
   ------------------------------------------------------------------------- */

/**
 * German word boundary. \b is wrong here: it is defined on [A-Za-z0-9_], so
 * it treats "ä" as a boundary and happily matches "Anprobe" inside
 * "Voranprobe". Umlauts and ß are letters and must be excluded explicitly,
 * as must the hyphen, so "KI-Agenten" does not match inside
 * "Multi-KI-Agenten-Suite".
 */
const LETTER = 'A-Za-zÄÖÜäöüß0-9_\\-';

function keywordRegex(keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![${LETTER}])(${escaped})(?![${LETTER}])`, 'i');
}

/**
 * Splits HTML into tags and text runs, tracking which tags we are inside, so
 * a match can be tested for "is this actually prose".
 *
 * A real parser would be better, and would also mean a dependency and a
 * serialisation round-trip over 90 scraped WordPress documents whose markup
 * is not guaranteed well-formed. Scanning tags is enough here because the
 * only question asked is "am I inside one of ~13 element types", and the
 * answer only has to be conservative: when in doubt it declines to link.
 */
function linkify(html, { map, selfPath, budget, saturated }) {
  const used = new Set();
  const inserted = [];

  // Longest first — the specific keyword should win a contested span.
  const entries = [...map.values()].sort((a, b) => b.keyword.length - a.keyword.length);

  // Walk once per keyword, but only over prose runs. Recomputed each time
  // because an insertion shifts every later offset.
  for (const { keyword, target } of entries) {
    if (inserted.length >= budget) break;
    if (target === selfPath) continue;
    if (used.has(target)) continue;
    if (saturated.has(target)) continue;

    const re = keywordRegex(keyword);
    const stack = [];
    const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
    let last = 0;
    let m;
    let done = false;

    const consider = (textStart, textEnd) => {
      if (done) return;
      if (stack.some((t) => SKIP_TAGS.has(t))) return;
      const text = html.slice(textStart, textEnd);
      const hit = re.exec(text);
      if (!hit) return;

      const at = textStart + hit.index;
      const matched = hit[1];
      html =
        html.slice(0, at) +
        `<a href="${target}" class="vm-ilink">${matched}</a>` +
        html.slice(at + matched.length);
      used.add(target);
      inserted.push({ keyword: matched, target });
      done = true;
    };

    while ((m = tagRe.exec(html))) {
      if (m.index > last) consider(last, m.index);
      if (done) break;
      const name = m[1].toLowerCase();
      const selfClosing = m[2] === '/' || /^(br|img|input|meta|link|hr|source|path|circle|rect|area|col|embed|track|wbr)$/.test(name);
      if (!selfClosing) {
        if (m[0][1] === '/') {
          const i = stack.lastIndexOf(name);
          if (i !== -1) stack.splice(i, 1);
        } else {
          stack.push(name);
        }
      }
      last = tagRe.lastIndex;
    }
    if (!done && last < html.length) consider(last, html.length);
  }

  return { html, inserted };
}

/* -------------------------------------------------------------------------
   Locating the prose
   ------------------------------------------------------------------------- */

/**
 * Returns [start, end] of the article body, or null.
 *
 * Two shapes: the generated posts use <article> inside <main class="vm-post">
 * and the scraped ones use <div class="entry-content">. Both are matched by
 * counting opening and closing tags of the same name from the start offset,
 * because both contain nested elements of that same name.
 */
function articleRange(html) {
  const generated = /<main class="vm-post">[\s\S]*?(<article\b[^>]*>)/i.exec(html);
  if (generated) {
    const start = generated.index + generated[0].length - generated[1].length;
    const end = matchingClose(html, start, 'article');
    if (end !== -1) return [start, end];
  }

  const legacy = /<div class="entry-content"[^>]*>/i.exec(html);
  if (legacy) {
    const end = matchingClose(html, legacy.index, 'div');
    if (end !== -1) return [legacy.index, end];
  }

  return null;
}

function matchingClose(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[2] === '/') continue;
    if (m[1] === '/') {
      depth--;
      if (depth === 0) return re.lastIndex;
    } else depth++;
  }
  return -1;
}

/* -------------------------------------------------------------------------
   Main
   ------------------------------------------------------------------------- */

const LINK_CSS_ID = 'vm-ilink-style';
/* Underlined, not colour-only: the same accessibility rule the rest of the
   site follows, and these sit in running text where colour alone is exactly
   the failure axe flags. */
const LINK_CSS = `<style id="${LINK_CSS_ID}">.vm-ilink{color:#94152b;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}.vm-ilink:hover{color:#700f2b;text-decoration-thickness:2px}</style>`;

function main() {
  console.log('\n🔗 Weaving internal links into the blog...\n');

  const map = buildKeywordMap();
  if (!map.size) {
    console.log('   ⚠ no keyword map could be built (is dist/sitemap.xml present?)');
    return;
  }
  console.log(`   • keyword map: ${map.size} phrase(s) → ${new Set([...map.values()].map((v) => v.target)).size} target(s)`);

  const blogDir = path.join(DIST, 'blog');
  if (!fs.existsSync(blogDir)) return;

  let pages = 0;
  let links = 0;
  let noProse = 0;
  const byTarget = new Map();
  const saturated = new Set();

  // Sorted, so which posts get first claim on a target is stable across
  // rebuilds rather than dependent on directory order.
  for (const name of fs.readdirSync(blogDir).sort()) {
    const file = path.join(blogDir, name, 'index.html');
    if (!fs.existsSync(file)) continue;

    const html = fs.readFileSync(file, 'utf-8');
    const range = articleRange(html);
    if (!range) { noProse++; continue; }

    const [start, end] = range;
    const before = html.slice(0, start);
    const body = html.slice(start, end);
    const after = html.slice(end);

    const { html: linked, inserted } = linkify(body, {
      map,
      selfPath: `/blog/${name}/`,
      budget: MAX_LINKS_PER_POST,
      saturated,
    });
    if (!inserted.length) continue;

    let out = before + linked + after;
    if (!out.includes(LINK_CSS_ID)) {
      const headEnd = out.search(/<\/head>/i);
      if (headEnd !== -1) out = out.slice(0, headEnd) + LINK_CSS + '\n' + out.slice(headEnd);
    }

    fs.writeFileSync(file, out);
    pages++;
    links += inserted.length;
    for (const i of inserted) {
      const n = (byTarget.get(i.target) || 0) + 1;
      byTarget.set(i.target, n);
      if (n >= MAX_INBOUND_PER_TARGET) saturated.add(i.target);
    }
  }

  console.log(`✅ ${links} internal link(s) inserted across ${pages} post(s)`);
  for (const [t, n] of [...byTarget].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`   • ${t.padEnd(38)} ${n}`);
  }
  if (noProse) console.log(`   • ${noProse} post(s) had no recognisable article body`);

  // Nested anchors are the failure mode that would not show up visually
  // until a browser silently restructured the DOM around it.
  //
  // Checked against the ARTICLE ONLY, with <style>/<script>/comments removed.
  // Scanning the whole document reported all 44 generated posts as broken,
  // and every one was the same false positive: the injected page-chrome
  // stylesheet contains a CSS comment reading "…is a <details>/<summary>,
  // not an <a>…", and prose about a tag looks exactly like the tag. Narrowing
  // to the region this script actually edits removes the entire class.
  let nested = 0;
  for (const name of fs.readdirSync(blogDir)) {
    const file = path.join(blogDir, name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const h = fs.readFileSync(file, 'utf-8');
    const r = articleRange(h);
    if (!r) continue;
    const prose = h
      .slice(r[0], r[1])
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    if (/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<a\b/i.test(prose)) {
      nested++;
      console.log(`   ⚠ nested anchor in ${name}`);
    }
  }
  console.log(nested ? `   ⚠ ${nested} page(s) with nested anchors` : '   ✓ no nested anchors produced\n');
  if (nested) process.exitCode = 1;
}

main();
