#!/usr/bin/env node

/**
 * Technical SEO audit of the built site (dist/).
 *
 * Google Search Console reports problems weeks after they ship, one URL
 * at a time, and only for what Googlebot happened to crawl. This checks the
 * whole build at once, before it is deployed, against the invariants that
 * Search Console's indexing reasons come from:
 *
 *   noindex / robots-blocked / 404 / "alternate page with canonical" /
 *   "duplicate" / "crawled, currently not indexed" / "discovered, currently
 *   not indexed"
 *
 * The last two are Google's own quality verdicts and cannot be checked
 * directly. What can be checked are their known causes: thin pages, pages
 * that are near-copies of another page, pages nothing links to, and pages
 * whose canonical, sitemap entry and hreflang cluster contradict each other.
 *
 * Zero dependencies, on purpose: the project has none at runtime, and an
 * audit that needs an install step is an audit that stops being run.
 *
 * Usage:
 *   node scripts/audit-seo.js                 summary, 5 examples per finding
 *   node scripts/audit-seo.js --verbose       every example
 *   node scripts/audit-seo.js --json=out.json machine-readable report
 *   node scripts/audit-seo.js --strict        exit 1 if any ERROR-level finding
 *
 * Severity:
 *   error  Search Console will report it, or a crawler cannot use the page
 *   warn   costs ranking or clicks, or is inconsistent
 *   info   worth knowing, no action forced
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const ORIGIN = 'https://virtual-marketer.de';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const STRICT = args.includes('--strict');
const JSON_OUT = (args.find((a) => a.startsWith('--json=')) || '').slice(7);
const EXAMPLES = VERBOSE ? Infinity : 5;

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const findings = new Map(); // id -> { sev, title, items: [] }

function report(id, sev, title, item) {
  if (!findings.has(id)) findings.set(id, { sev, title, items: [] });
  findings.get(id).items.push(item);
}

// ---------------------------------------------------------------------------
// Parsing helpers (regex based, see header)
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '–', mdash: '—', hellip: '…' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m));
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  }
  return out;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
}

function visibleText(html) {
  const body = html.replace(/<head\b[\s\S]*?<\/head>/i, '');
  return decode(
    body
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function urlOfFile(file) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel;
}

// ---------------------------------------------------------------------------
// Server behaviour the audit has to know about (docker/nginx.conf.template)
// ---------------------------------------------------------------------------

/** Paths nginx answers with a redirect. A link to one costs a hop. */
const SERVER_REDIRECTS = [
  [/^\/home\/?$/, '/'],
  [/^\/(author|tag|category)\//, '/blog/'],
];
/** Paths that exist at runtime but not as files (API sidecar, gone stubs). */
const RUNTIME_PATHS = [/^\/api\//, /^\/wp-admin\//, /^\/wp-json\//, /^\/wp-login\.php$/, /^\/xmlrpc\.php$/];

function robotsRules() {
  const file = path.join(DIST, 'robots.txt');
  if (!fs.existsSync(file)) return { disallow: [], sitemaps: [], exists: false };
  const lines = fs.readFileSync(file, 'utf-8').split('\n').map((l) => l.trim());
  const disallow = [];
  const sitemaps = [];
  let star = false;
  for (const l of lines) {
    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase();
    if (k === 'user-agent') star = m[2].trim() === '*';
    else if (k === 'disallow' && star && m[2].trim()) disallow.push(m[2].trim());
    else if (k === 'sitemap') sitemaps.push(m[2].trim());
  }
  return { disallow, sitemaps, exists: true };
}

// ---------------------------------------------------------------------------
// Load every page
// ---------------------------------------------------------------------------

const allFiles = walk(DIST);
const fileSet = new Set(allFiles.map((f) => '/' + path.relative(DIST, f).split(path.sep).join('/')));

/** Does this site path resolve to something the server would serve? */
function resolves(p) {
  try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
  if (RUNTIME_PATHS.some((r) => r.test(p))) return { ok: true, kind: 'runtime' };
  if (fileSet.has(p)) return { ok: true, kind: 'file' };
  if (p.endsWith('/') && fileSet.has(p + 'index.html')) return { ok: true, kind: 'page' };
  if (!p.endsWith('/') && fileSet.has(p + '/index.html')) return { ok: true, kind: 'page-needs-slash' };
  for (const [re, to] of SERVER_REDIRECTS) if (re.test(p)) return { ok: true, kind: 'redirect', to };
  return { ok: false };
}

const pages = [];
for (const file of allFiles) {
  if (!file.endsWith('.html')) continue;
  const url = urlOfFile(file);
  if (url === '/404.html') continue;
  const html = fs.readFileSync(file, 'utf-8');
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const metas = tags(head, 'meta').map(attrs);
  const metaBy = (key, val) => metas.filter((m) => (m[key] || '').toLowerCase() === val);
  const links = tags(head, 'link').map(attrs);
  const titleM = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const robots = (metaBy('name', 'robots')[0] || {}).content || '';

  const ld = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const nodes = Array.isArray(j) ? j : j['@graph'] ? j['@graph'] : [j];
      ld.push(...nodes);
    } catch (e) {
      ld.push({ __invalid: e.message });
    }
  }

  const text = visibleText(html);
  pages.push({
    file,
    url,
    html,
    head,
    title: titleM ? decode(titleM[1]).replace(/\s+/g, ' ').trim() : '',
    description: ((metaBy('name', 'description')[0] || {}).content || '').trim(),
    robots: robots.toLowerCase(),
    canonicals: links.filter((l) => (l.rel || '').toLowerCase() === 'canonical').map((l) => l.href),
    hreflangs: links.filter((l) => (l.rel || '').toLowerCase() === 'alternate' && l.hreflang).map((l) => ({ lang: l.hreflang, href: l.href })),
    og: Object.fromEntries(metas.filter((m) => (m.property || '').startsWith('og:')).map((m) => [m.property, m.content])),
    twitterCard: ((metaBy('name', 'twitter:card')[0] || metaBy('property', 'twitter:card')[0]) || {}).content,
    viewport: !!metaBy('name', 'viewport').length,
    lang: (html.match(/<html[^>]*\blang=["']([^"']+)["']/i) || [])[1] || '',
    ld,
    text,
    words: text ? text.split(' ').length : 0,
  });
}

const byUrl = new Map(pages.map((p) => [p.url, p]));
const isNoindex = (p) => /\bnoindex\b/.test(p.robots);
const indexable = pages.filter((p) => !isNoindex(p));

// ---------------------------------------------------------------------------
// Per-page checks
// ---------------------------------------------------------------------------

const titles = new Map();
const descs = new Map();
const bodies = new Map();

for (const p of pages) {
  const at = p.url;

  // ---- title -------------------------------------------------------------
  if (!p.title) report('title-missing', 'error', 'Page has no <title>', at);
  else {
    if (p.title.length > 65) report('title-long', 'warn', 'Title over 65 characters (truncated in results)', `${at}  (${p.title.length})`);
    if (p.title.length < 25) report('title-short', 'warn', 'Title under 25 characters (wastes the strongest ranking text)', `${at}  "${p.title}"`);
    if (!isNoindex(p)) {
      if (!titles.has(p.title)) titles.set(p.title, []);
      titles.get(p.title).push(at);
    }
  }

  // ---- description --------------------------------------------------------
  if (!p.description) report('desc-missing', 'error', 'Page has no meta description', at);
  else {
    const n = decode(p.description).length;
    if (n > 165) report('desc-long', 'warn', 'Meta description over 165 characters (truncated)', `${at}  (${n})`);
    if (n < 70) report('desc-short', 'warn', 'Meta description under 70 characters', `${at}  (${n})`);
    if (!isNoindex(p)) {
      if (!descs.has(p.description)) descs.set(p.description, []);
      descs.get(p.description).push(at);
    }
  }

  // ---- canonical ----------------------------------------------------------
  if (p.canonicals.length === 0) {
    if (!isNoindex(p)) report('canonical-missing', 'error', 'Indexable page has no canonical', at);
  } else {
    if (p.canonicals.length > 1) report('canonical-multiple', 'error', 'More than one canonical tag (Google ignores all of them)', `${at}  (${p.canonicals.length})`);
    const c = p.canonicals[0];
    if (!/^https:\/\/virtual-marketer\.de\//.test(c)) report('canonical-origin', 'error', 'Canonical is not an absolute https://virtual-marketer.de URL', `${at} -> ${c}`);
    else {
      const cp = c.slice(ORIGIN.length);
      if (cp !== at && !isNoindex(p)) report('canonical-not-self', 'warn', 'Canonical points to a different URL (page will be reported as "alternate page with canonical")', `${at} -> ${cp}`);
      if (!resolves(cp.split(/[?#]/)[0]).ok) report('canonical-dead', 'error', 'Canonical target does not exist', `${at} -> ${cp}`);
    }
  }

  // ---- robots / language / viewport --------------------------------------
  if (!p.viewport) report('viewport-missing', 'error', 'No viewport meta (mobile-first indexing)', at);
  const isEn = at.startsWith('/en/') || at === '/en/';
  if (isEn && !/^en/i.test(p.lang)) report('lang-mismatch', 'warn', 'Page under /en/ is not lang="en"', `${at} (lang="${p.lang}")`);
  if (!isEn && !/^de/i.test(p.lang)) report('lang-mismatch', 'warn', 'German page is not lang="de"', `${at} (lang="${p.lang}")`);

  // ---- headings -----------------------------------------------------------
  const body = (p.html.match(/<body[\s\S]*<\/body>/i) || [p.html])[0].replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
  const h1 = (body.match(/<h1\b/gi) || []).length;
  if (h1 === 0 && !isNoindex(p)) report('h1-missing', 'error', 'No <h1>', at);
  if (h1 > 1) report('h1-multiple', 'warn', 'More than one <h1>', `${at}  (${h1})`);
  const levels = [...body.matchAll(/<h([1-6])\b/gi)].map((m) => +m[1]);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) { report('heading-skip', 'info', 'Heading level skips (h2 to h4 etc.)', `${at}  (h${levels[i - 1]} to h${levels[i]})`); break; }
  }

  // ---- social / open graph -------------------------------------------------
  if (!isNoindex(p)) {
    for (const k of ['og:title', 'og:description', 'og:image', 'og:url']) {
      if (!p.og[k]) report('og-missing', 'warn', 'Open Graph tag missing (weak link previews)', `${at}  ${k}`);
    }
    if (!p.twitterCard) report('twitter-missing', 'info', 'No twitter:card', at);
    const img = p.og['og:image'];
    if (img && img.startsWith(ORIGIN) && !resolves(img.slice(ORIGIN.length).split(/[?#]/)[0]).ok) {
      report('og-image-dead', 'error', 'og:image file does not exist', `${at} -> ${img}`);
    }
  }

  // ---- structured data ------------------------------------------------------
  const types = new Set();
  for (const n of p.ld) {
    if (n.__invalid) { report('ld-invalid', 'error', 'JSON-LD block is not valid JSON', `${at}  ${n.__invalid}`); continue; }
    [].concat(n['@type'] || []).forEach((t) => types.add(t));
  }
  if (!isNoindex(p)) {
    if (at === '/' && !types.has('Organization')) report('ld-org-missing', 'warn', 'Homepage has no Organization structured data', at);
    if (at === '/' && !types.has('WebSite')) report('ld-website-missing', 'warn', 'Homepage has no WebSite structured data', at);
    if (at !== '/' && at !== '/en/' && !types.has('BreadcrumbList')) report('ld-breadcrumb-missing', 'info', 'No BreadcrumbList structured data', at);
    if (/^\/(en\/)?blog\/[^/]+\/$/.test(at) && !/\/blog\/(category|page)\//.test(at)) {
      const art = p.ld.find((n) => [].concat(n['@type'] || []).some((t) => /Article|BlogPosting/.test(t)));
      if (!art) report('ld-article-missing', 'warn', 'Blog post has no Article/BlogPosting structured data', at);
      else for (const f of ['headline', 'datePublished', 'dateModified', 'author', 'image', 'publisher']) {
        if (!art[f]) report('ld-article-field', 'warn', 'Article structured data lacks a field Google needs for rich results', `${at}  ${f}`);
      }
    }
  }

  // ---- images ---------------------------------------------------------------
  for (const tag of tags(body, 'img')) {
    const a = attrs(tag);
    const src = a.src || a['data-src'] || '';
    if (!('alt' in a)) report('img-alt-missing', 'warn', '<img> without an alt attribute', `${at}  ${src.slice(0, 70)}`);
    if (!a.width || !a.height) report('img-dims-missing', 'info', '<img> without width/height (layout shift)', `${at}  ${src.slice(0, 70)}`);
  }

  // ---- thin content -----------------------------------------------------------
  if (!isNoindex(p) && p.words < 150 && !/^\/(en\/)?(login|kontakt|contact|modell-anfragen|request-custom-model)\//.test(at)) {
    report('thin', 'warn', 'Indexable page with under 150 words of text ("crawled, currently not indexed" candidate)', `${at}  (${p.words} words)`);
  }

  // ---- duplicate bodies ---------------------------------------------------------
  if (!isNoindex(p) && p.words >= 60) {
    const key = p.text.slice(0, 4000);
    if (!bodies.has(key)) bodies.set(key, []);
    bodies.get(key).push(at);
  }

  // ---- copy rules ----------------------------------------------------------------
  const dashes = (p.text.match(/[–—]/g) || []).length;
  if (dashes) report('long-dash', 'warn', 'En/em dash in visible text (house rule: never in outward-facing copy)', `${at}  (${dashes})`);
  if (/[–—]/.test(p.title + p.description)) report('long-dash-meta', 'warn', 'En/em dash in title or meta description', at);
}

// A DE page and its EN counterpart may legitimately share a title/description (brand names, identical text on untranslated pages): that pair is not a duplicate.
const isLangPair = (urls) => urls.length === 2 && urls.filter((u) => u.startsWith('/en/')).length === 1;
for (const [t, urls] of titles) if (urls.length > 1 && !isLangPair(urls)) report('title-duplicate', 'warn', 'Same <title> on several indexable pages', `"${t.slice(0, 60)}"  x${urls.length}: ${urls.slice(0, 3).join(', ')}`);
for (const [d, urls] of descs) if (urls.length > 1 && !isLangPair(urls)) report('desc-duplicate', 'warn', 'Same meta description on several indexable pages', `"${decode(d).slice(0, 50)}"  x${urls.length}: ${urls.slice(0, 3).join(', ')}`);
for (const [, urls] of bodies) if (urls.length > 1) report('body-duplicate', 'error', 'Indexable pages with identical body text ("duplicate, Google chose a different canonical")', urls.join('  ='));

// ---------------------------------------------------------------------------
// hreflang: targets exist, are reciprocal, are self-referencing
// ---------------------------------------------------------------------------

for (const p of pages) {
  if (!p.hreflangs.length) continue;
  const langs = p.hreflangs.map((h) => h.lang);
  if (!p.hreflangs.some((h) => h.href === ORIGIN + p.url)) report('hreflang-no-self', 'error', 'hreflang cluster does not include the page itself', p.url);
  if (!langs.includes('x-default')) report('hreflang-no-default', 'info', 'hreflang cluster has no x-default', p.url);
  for (const h of p.hreflangs) {
    if (!h.href.startsWith(ORIGIN)) { report('hreflang-origin', 'error', 'hreflang target is not on this origin', `${p.url} -> ${h.href}`); continue; }
    const tp = h.href.slice(ORIGIN.length);
    const target = byUrl.get(tp);
    if (!target) { report('hreflang-dead', 'error', 'hreflang points to a page that does not exist', `${p.url} -> ${tp}`); continue; }
    if (tp === p.url) continue;
    if (!target.hreflangs.some((x) => x.href === ORIGIN + p.url)) {
      report('hreflang-not-reciprocal', 'error', 'hreflang is not reciprocal (Google ignores the whole cluster)', `${p.url} -> ${tp} does not link back`);
    }
    if (isNoindex(target)) report('hreflang-to-noindex', 'error', 'hreflang points to a noindex page', `${p.url} -> ${tp}`);
  }
}

// ---------------------------------------------------------------------------
// Internal links, assets, orphans
// ---------------------------------------------------------------------------

const rules = robotsRules();
const inbound = new Map(pages.map((p) => [p.url, new Set()]));

for (const p of pages) {
  const body = (p.html.match(/<body[\s\S]*<\/body>/i) || [p.html])[0].replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');

  for (const m of body.matchAll(/<a\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const raw = (a.href || '').trim();
    if (!raw || /^(mailto:|tel:|javascript:|#|data:)/i.test(raw)) continue;
    if (/["'>\s]/.test(raw) && (!/^[a-z][a-z0-9+.-]*:/i.test(raw) || /^https?:\/\/(www\.)?virtual-marketer\.de/i.test(raw))) { report('link-malformed', 'error', 'Link href contains stray markup characters (crawled as a 404)', `${p.url}  href=${JSON.stringify(raw.slice(0, 60))}`); continue; }
    let target = raw;
    if (/^https?:\/\//i.test(raw)) {
      if (/^http:\/\/(www\.)?virtual-marketer\.de/i.test(raw)) report('link-http', 'warn', 'Internal link uses http:// (extra redirect)', `${p.url} -> ${raw}`);
      if (!/^https?:\/\/(www\.)?virtual-marketer\.de/i.test(raw)) continue;
      target = raw.replace(/^https?:\/\/(www\.)?virtual-marketer\.de/i, '') || '/';
    } else if (!raw.startsWith('/')) {
      try { target = new URL(raw, ORIGIN + p.url).pathname; } catch { continue; }
    }
    const clean = target.split(/[?#]/)[0] || '/';
    const r = resolves(clean);
    if (!r.ok) { report('link-broken', 'error', 'Internal link to a page or file that does not exist', `${p.url} -> ${clean}`); continue; }
    if (r.kind === 'redirect') report('link-to-redirect', 'warn', 'Internal link points at a URL nginx redirects', `${p.url} -> ${clean}  (to ${r.to})`);
    if (r.kind === 'page-needs-slash') report('link-no-slash', 'warn', 'Internal link lacks the trailing slash (301 hop)', `${p.url} -> ${clean}`);
    const asPage = r.kind === 'page' ? clean : r.kind === 'page-needs-slash' ? clean + '/' : null;
    if (asPage && asPage !== p.url && inbound.has(asPage)) {
      inbound.get(asPage).add(p.url);
    }
    const rel = (a.rel || '').toLowerCase();
    if (/nofollow/.test(rel) && asPage) report('link-nofollow-internal', 'warn', 'Internal link carries rel=nofollow (wastes link equity)', `${p.url} -> ${clean}`);
  }

  // Assets Googlebot must be able to fetch in order to render the page.
  const assetRefs = [];
  for (const t of tags(p.html, 'link')) { const a = attrs(t); if (a.href && /stylesheet|preload|icon/i.test(a.rel || '')) assetRefs.push(a.href); }
  for (const t of tags(p.html, 'script')) { const a = attrs(t); if (a.src) assetRefs.push(a.src); }
  for (const ref of assetRefs) {
    const ap = ref.replace(/^https:\/\/virtual-marketer\.de/, '');
    if (!ap.startsWith('/')) continue;
    const clean = ap.split(/[?#]/)[0];
    if (!resolves(clean).ok) report('asset-broken', 'error', 'CSS/JS/icon referenced by the page does not exist', `${p.url} -> ${clean}`);
    const blocked = rules.disallow.find((d) => clean.startsWith(d));
    if (blocked) report('asset-robots-blocked', 'error', 'CSS/JS needed to render the page is blocked by robots.txt (Googlebot renders it unstyled)', `${p.url} -> ${clean}  (Disallow: ${blocked})`);
  }
  for (const m of p.html.matchAll(/\b(?:src|href)=["'](http:\/\/[^"']+)["']/gi)) {
    if (!/^http:\/\/(www\.)?virtual-marketer\.de/i.test(m[1]) && /\.(?:css|js|png|jpe?g|webp|avif|svg|woff2?)(?:\?|$)/i.test(m[1])) {
      report('mixed-content', 'error', 'http:// sub-resource on an https page', `${p.url} -> ${m[1].slice(0, 80)}`);
    }
  }
}

for (const p of indexable) {
  if (p.url === '/') continue;
  if (inbound.get(p.url).size === 0) report('orphan', 'error', 'Indexable page that no other page links to ("discovered, currently not indexed" candidate)', p.url);
  else if (inbound.get(p.url).size === 1) report('weakly-linked', 'info', 'Indexable page linked from a single page', `${p.url}  (from ${[...inbound.get(p.url)][0]})`);
}

// ---------------------------------------------------------------------------
// Sitemap and robots.txt
// ---------------------------------------------------------------------------

const smFile = path.join(DIST, 'sitemap.xml');
const sitemapUrls = [];
if (!fs.existsSync(smFile)) report('sitemap-missing', 'error', 'sitemap.xml does not exist', '/sitemap.xml');
else {
  const xml = fs.readFileSync(smFile, 'utf-8');
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const lastmod = (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1];
    if (loc) sitemapUrls.push({ loc: decode(loc), lastmod, hasAlt: /xhtml:link/.test(m[1]) });
  }
  const seen = new Set();
  for (const s of sitemapUrls) {
    if (seen.has(s.loc)) report('sitemap-duplicate', 'warn', 'URL listed twice in the sitemap', s.loc);
    seen.add(s.loc);
    if (!s.loc.startsWith(ORIGIN + '/')) { report('sitemap-origin', 'error', 'Sitemap URL is not on https://virtual-marketer.de', s.loc); continue; }
    const sp = s.loc.slice(ORIGIN.length);
    const pg = byUrl.get(sp);
    if (!pg) { report('sitemap-dead', 'error', 'Sitemap lists a URL that does not exist ("404" in Search Console)', sp); continue; }
    if (isNoindex(pg)) report('sitemap-noindex', 'error', 'Sitemap lists a noindex page (contradictory signal)', sp);
    if (pg.canonicals[0] && pg.canonicals[0] !== s.loc) report('sitemap-canonical-mismatch', 'error', 'Sitemap URL differs from the page canonical', `${sp} vs ${pg.canonicals[0]}`);
    if (s.lastmod && !/^\d{4}-\d{2}-\d{2}/.test(s.lastmod)) report('sitemap-lastmod', 'warn', 'lastmod is not an ISO date', `${sp}  ${s.lastmod}`);
  }
  const listed = new Set(sitemapUrls.map((s) => s.loc));
  for (const p of indexable) {
    if (!listed.has(ORIGIN + p.url)) report('sitemap-missing-page', 'warn', 'Indexable page is not in the sitemap', p.url);
  }
  if (!sitemapUrls.some((s) => s.hasAlt) && pages.some((p) => p.hreflangs.length)) {
    report('sitemap-no-hreflang', 'info', 'Sitemap carries no xhtml:link alternates (hreflang is only in page heads)', `${pages.filter((p) => p.hreflangs.length).length} pages have hreflang`);
  }
}

if (!rules.exists) report('robots-missing', 'error', 'robots.txt does not exist', '/robots.txt');
else if (!rules.sitemaps.length) report('robots-no-sitemap', 'warn', 'robots.txt has no Sitemap: line', '/robots.txt');
else for (const s of rules.sitemaps) if (!s.startsWith(ORIGIN + '/')) report('robots-sitemap-origin', 'warn', 'robots.txt Sitemap: line is not on this origin', s);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const order = { error: 0, warn: 1, info: 2 };
const sorted = [...findings.entries()].sort((a, b) => order[a[1].sev] - order[b[1].sev] || b[1].items.length - a[1].items.length);
const mark = { error: 'ERROR', warn: 'warn ', info: 'info ' };

console.log('\nSEO audit of dist/');
console.log(`  ${pages.length} pages, ${indexable.length} indexable, ${sitemapUrls.length} in sitemap.xml\n`);

let errors = 0;
let warns = 0;
for (const [id, f] of sorted) {
  const n = f.items.length;
  if (f.sev === 'error') errors += n;
  if (f.sev === 'warn') warns += n;
  console.log(`${mark[f.sev]}  ${String(n).padStart(4)}  ${id}: ${f.title}`);
  for (const it of f.items.slice(0, EXAMPLES)) console.log(`              ${it}`);
  if (n > EXAMPLES) console.log(`              ... and ${n - EXAMPLES} more (use --verbose)`);
}
if (!sorted.length) console.log('  Nothing found.');
console.log(`\n  ${errors} error(s), ${warns} warning(s)\n`);

if (JSON_OUT) {
  const obj = { generatedAt: new Date().toISOString(), pages: pages.length, indexable: indexable.length, findings: Object.fromEntries(sorted.map(([id, f]) => [id, f])) };
  fs.writeFileSync(JSON_OUT, JSON.stringify(obj, null, 2));
  console.log(`  report written to ${JSON_OUT}\n`);
}

if (STRICT && errors > 0) process.exit(1);
