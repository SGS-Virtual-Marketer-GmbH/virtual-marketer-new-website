'use strict';

/**
 * Everything the blog archive needs: which posts exist, which are published
 * yet, and the markup for a searchable, filterable, paginated index.
 *
 * WHY THIS IS A LIBRARY AND NOT INLINE IN THE GENERATOR
 *
 * Three separate problems converged on the archive page and each had been
 * solved partially, in a different place:
 *
 *  1. Four manifests, one of them read. blog-posts.json (14 posts) was the
 *     only file generate-blog-posts.js loaded. blog-posts-2024.json,
 *     -2025.json and -2026.json — 41 further posts, all with their content
 *     files already written — were never built. That is the bulk of the
 *     blog simply missing from the site.
 *
 *  2. Forty-four legacy posts, orphaned. The WordPress export's own posts
 *     live in dist/blog/<slug>/ and are in the sitemap, but the generated
 *     archive listed only manifest posts, so nothing on the site linked to
 *     them. A page reachable only through the sitemap is, for a reader,
 *     not reachable. They are harvested from their own built HTML rather
 *     than duplicated into a manifest — the HTML is the source of truth for
 *     a scraped post, and a second copy would drift.
 *
 *  3. Eleven posts dated in the future. blog-posts.json runs to 20 October
 *     2026 on an exact weekly cadence — those are the "one per week going
 *     forward" posts, written ahead. They were being published immediately,
 *     so on 4 August a reader saw an article dated 20 October. Posts are now
 *     held until their date. See splitByDate().
 *
 * PUBLISHING FUTURE POSTS
 *
 * The site is static, so a scheduled post appears when the site is next
 * built and deployed — nothing releases it on its own. A weekly rebuild is
 * what turns the queue into an actual weekly cadence. The build prints what
 * is being held back and when the next one is due, so this is visible rather
 * than something to remember.
 */

const fs = require('fs');
const path = require('path');
const { cleanTitle } = require('./title-cleanup');

const ROOT = path.join(__dirname, '../..');

/** Manifests, oldest first. All are merged; none is more authoritative. */
const MANIFESTS = [
  'blog-posts-2024.json',
  'blog-posts-2025.json',
  'blog-posts-2026.json',
  'blog-posts.json',
];

/** Posts per archive page. */
const PER_PAGE = 12;

/** Category → URL slug, for the real per-category pages. */
const CATEGORY_SLUGS = {
  'AI-Trends': 'ai-trends',
  'SEO': 'seo',
  'Regulierung & Compliance': 'regulierung-compliance',
  'Use Cases': 'use-cases',
  'Bildung': 'bildung',
  'Archiv': 'archiv',
};

function categorySlug(category) {
  return (
    CATEGORY_SLUGS[category] ||
    category
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c]))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

/** Merge every manifest. Throws on a duplicate slug or a missing body file. */
function loadManifests() {
  const posts = [];
  const seen = new Map();

  for (const file of MANIFESTS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
    const list = Array.isArray(parsed) ? parsed : parsed.posts;

    for (const post of list) {
      // A duplicate slug would silently overwrite one post's page with
      // another's — the kind of loss that shows up as "an article vanished"
      // months later. Fail at build time instead.
      if (seen.has(post.slug)) {
        throw new Error(
          `Duplicate blog slug "${post.slug}" in ${file} and ${seen.get(post.slug)}`
        );
      }
      seen.set(post.slug, file);

      const body = path.join(ROOT, 'content/blog', post.contentFile);
      if (!fs.existsSync(body)) {
        throw new Error(`Blog post "${post.slug}" (${file}) has no body: ${post.contentFile}`);
      }
      posts.push({ ...post, source: 'manifest' });
    }
  }

  return posts;
}

/**
 * Reads the legacy WordPress posts already sitting in dist/blog/.
 *
 * Deliberately tolerant: a legacy post missing a description or a date is
 * listed with what it has rather than dropped. Dropping it would put it back
 * in the orphaned state this function exists to end.
 */
function harvestLegacy(distBlogDir, knownSlugs) {
  if (!fs.existsSync(distBlogDir)) return [];
  const out = [];

  for (const name of fs.readdirSync(distBlogDir)) {
    if (knownSlugs.has(name)) continue;
    const file = path.join(distBlogDir, name, 'index.html');
    if (!fs.existsSync(file)) continue;

    const html = fs.readFileSync(file, 'utf-8');
    const title = (/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1];
    if (!title) continue;

    // Four sources, tried in order. One would not be enough: this runs at
    // step 5 of the pipeline and scripts/fix-meta-descriptions.js does not
    // run until step 29, so at harvest time a scraped post may still have no
    // <meta name="description"> at all — which is how the archive first
    // rendered every legacy card with an empty summary under its title.
    // Reordering the pipeline to fix that would put the SEO passes before the
    // pages they operate on exist, so the harvest falls back instead.
    const description = firstOf(html, [
      /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i,
      /<meta\s+property=["']og:description["']\s+content=["']([^"']*)["']/i,
      /"description"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    ]) || firstParagraph(html);
    // JSON-LD datePublished is the reliable one; the visible <time> is
    // localised German ("März 20, 2024") and not worth parsing.
    const date =
      (/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html) || [])[1] ||
      (/datetime=["'](\d{4}-\d{2}-\d{2})/.exec(html) || [])[1] ||
      '';

    out.push({
      // Cleaned with the same rules scripts/fix-page-titles.js applies to the
      // <title> tag later in the build — without this the archive card and
      // the page it links to disagreed, and one card carried 472 characters
      // of the author's five candidate headlines.
      title: cleanTitle(decodeEntities(title.replace(/\s*[-–|]\s*Virtual Marketer\s*$/i, '').trim())),
      slug: name,
      date,
      category: 'Archiv',
      description: decodeEntities(description),
      keywords: '',
      source: 'legacy',
    });
  }

  return out;
}

function firstOf(html, patterns) {
  for (const re of patterns) {
    const hit = re.exec(html);
    if (hit && hit[1] && hit[1].trim()) return hit[1].trim();
  }
  return '';
}

/**
 * Last-resort summary: the first paragraph of the post that reads like prose.
 *
 * The scraped pages open with theme furniture — a tagline in the header, a
 * preloader, a breadcrumb — so the literal first <p> is usually "The first
 * German Virtual Marketing Assistant …", identical on every post. Requiring
 * 80 characters and a sentence-ending full stop skips those without needing
 * to know which theme element produced them.
 */
function firstParagraph(html) {
  const body = html.slice(Math.max(0, html.indexOf('<article')));
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    if (text.length >= 80 && /[.!?]/.test(text)) {
      return text.length > 200 ? text.slice(0, 197).replace(/\s+\S*$/, '') + '…' : text;
    }
  }
  return '';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, '’');
}

/**
 * Splits into what may be published today and what is still scheduled.
 *
 * `today` is passed in rather than read from the clock so the caller decides,
 * and so this is testable. Comparison is on the ISO date string: both sides
 * are YYYY-MM-DD, so lexical order is chronological order, and no timezone
 * can move a post across midnight.
 */
function splitByDate(posts, today) {
  const published = [];
  const scheduled = [];
  for (const p of posts) {
    if (p.date && p.date > today) scheduled.push(p);
    else published.push(p);
  }
  const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
  published.sort(byDateDesc);
  scheduled.sort((a, b) => a.date.localeCompare(b.date));
  return { published, scheduled };
}

/* -------------------------------------------------------------------------
   Archive UI
   ------------------------------------------------------------------------- */

const ARCHIVE_CSS = `
  .vm-blog-tools{margin:24px 0 8px}
  .vm-blog-search{position:relative;display:block}
  .vm-blog-search input{
    width:100%;box-sizing:border-box;font-size:16px;
    padding:13px 16px 13px 44px;border:1px solid #e5e7eb;border-radius:12px;
    background:#fff;color:#111827;outline:none;
  }
  .vm-blog-search input:focus{border-color:#66a3ce;box-shadow:0 0 0 3px rgba(102,163,206,.18)}
  .vm-blog-search svg{position:absolute;left:15px;top:50%;transform:translateY(-50%);
    width:18px;height:18px;fill:none;stroke:#9ca3af;stroke-width:2}
  .vm-blog-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
  .vm-blog-chips a,.vm-blog-chips button{
    font:inherit;font-size:14px;font-weight:600;cursor:pointer;
    padding:7px 14px;border-radius:999px;border:1px solid #e5e7eb;
    background:#fff;color:#4b5563;text-decoration:none;
  }
  .vm-blog-chips a:hover,.vm-blog-chips button:hover{border-color:#94152b;color:#94152b}
  .vm-blog-chips .is-active{background:#94152b;border-color:#94152b;color:#fff}
  .vm-blog-count{color:#6b7280;font-size:14px;margin:16px 0 0}

  .vm-post{border-bottom:1px solid #e5e7eb;padding:24px 0}
  .vm-post .vm-cat{display:inline-block;background:#fbecee;color:#94152b;font-size:12px;
    font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:8px}
  .vm-post h2{font-size:1.4rem;margin:0 0 8px}
  .vm-post h2 a{color:#111827;text-decoration:none}
  .vm-post h2 a:hover{color:#94152b}
  .vm-post .vm-date{color:#6b7280;font-size:14px;margin-bottom:8px}
  .vm-post p{color:#374151;line-height:1.6;margin:0 0 10px}
  .vm-post .vm-more{color:#94152b;font-weight:600;text-decoration:none}

  .vm-pagination{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:32px 0 8px}
  .vm-pagination a,.vm-pagination span{
    min-width:42px;min-height:42px;display:inline-flex;align-items:center;justify-content:center;
    padding:0 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;
    color:#4b5563;text-decoration:none;font-weight:600;
  }
  .vm-pagination a:hover{border-color:#94152b;color:#94152b}
  .vm-pagination .is-current{background:#94152b;border-color:#94152b;color:#fff}
  .vm-empty{padding:40px 0;color:#6b7280}
`;

/**
 * Per-language strings and URL shapes.
 *
 * The German and English blogs are separate corpora (55 manifest posts vs 58
 * translations of the legacy set) with separate URL trees, but the archive
 * behaviour is identical. Parameterising here keeps one implementation of
 * search, filtering and pagination instead of two that drift.
 */
const LANGS = {
  de: {
    base: '/blog/',
    catBase: '/blog/kategorie/',
    all: 'Alle',
    searchPlaceholder: 'Beiträge durchsuchen …',
    searchLabel: 'Beiträge durchsuchen',
    more: 'Weiterlesen',
    prev: 'Zurück',
    next: 'Weiter',
    navLabel: 'Seitennavigation',
    one: '1 Beitrag',
    manySuffix: 'Beiträge',
    empty: 'Keine Beiträge gefunden. Andere Schreibweise oder Kategorie „Alle“ versuchen.',
    noJs:
      'Suche und Filter brauchen JavaScript. Ohne JavaScript funktionieren die ' +
      'Kategorie-Links und die Seitennavigation unten weiterhin.',
  },
  en: {
    base: '/en/blog/',
    catBase: '/en/blog/category/',
    all: 'All',
    searchPlaceholder: 'Search posts …',
    searchLabel: 'Search posts',
    more: 'Read more',
    prev: 'Previous',
    next: 'Next',
    navLabel: 'Pagination',
    one: '1 post',
    manySuffix: 'posts',
    empty: 'No posts found. Try a different spelling, or the \u201cAll\u201d category.',
    noJs:
      'Search and filtering need JavaScript. Without it, the category links and ' +
      'the pagination below still work.',
  },
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function postCard(p, formatDate, lang = 'de') {
  const L = LANGS[lang];
  return `      <article class="vm-post">
        <span class="vm-cat">${esc(p.category)}</span>
        <h2><a href="${L.base}${p.slug}/">${esc(p.title)}</a></h2>
        <div class="vm-date">${p.date ? formatDate(p.date) : ''}</div>
        <p>${esc(p.description)}</p>
        <a class="vm-more" href="${L.base}${p.slug}/">${L.more} &rarr;</a>
      </article>`;
}

/**
 * Search + category chips.
 *
 * The chips are real links to real category pages, not buttons. That is the
 * point: a crawler follows them and a reader without JavaScript still gets a
 * filtered list. The script below upgrades them to instant in-page filtering
 * and rewrites the address bar, so with JavaScript they behave like an app
 * and without it they behave like a website. Neither mode is a degraded
 * version of the other.
 */
function toolsHtml({ categories, activeCategory, lang = 'de' }) {
  const L = LANGS[lang];
  const chip = (label, href, active) =>
    `<a href="${href}" data-cat="${esc(label)}"${active ? ' class="is-active"' : ''}>${esc(label)}</a>`;

  return `  <div class="vm-blog-tools">
    <label class="vm-blog-search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" id="vm-blog-q" placeholder="${L.searchPlaceholder}" autocomplete="off"
             aria-label="${L.searchLabel}" aria-describedby="vm-blog-nojs">
    </label>
    <div class="vm-blog-chips" role="list">
      ${chip(L.all, L.base, !activeCategory)}
      ${categories.map((c) => chip(c.label, `${L.catBase}${c.slug}/`, c.label === activeCategory)).join('\n      ')}
    </div>
    <noscript><p class="vm-blog-count" id="vm-blog-nojs">${L.noJs}</p></noscript>
    <p class="vm-blog-count" id="vm-blog-count" hidden></p>
  </div>
  <div id="vm-blog-results" hidden></div>
  <div id="vm-blog-static">`;
}

function paginationHtml(page, totalPages, hrefFor, lang = 'de') {
  const L = LANGS[lang];
  if (totalPages <= 1) return '';
  const items = [];
  if (page > 1) items.push(`<a rel="prev" href="${hrefFor(page - 1)}">&larr; ${L.prev}</a>`);

  // Windowed, so 5 pages and 50 pages both render a usable control.
  const window = new Set([1, totalPages, page, page - 1, page + 1]);
  let last = 0;
  for (let n = 1; n <= totalPages; n++) {
    if (!window.has(n)) continue;
    if (n - last > 1) items.push('<span aria-hidden="true">…</span>');
    items.push(
      n === page
        ? `<span class="is-current" aria-current="page">${n}</span>`
        : `<a href="${hrefFor(n)}">${n}</a>`
    );
    last = n;
  }
  if (page < totalPages) items.push(`<a rel="next" href="${hrefFor(page + 1)}">${L.next} &rarr;</a>`);

  return `  <nav class="vm-pagination" aria-label="${L.navLabel}">\n    ${items.join('\n    ')}\n  </nav>`;
}

/**
 * The client-side search/filter.
 *
 * Reads a JSON index embedded in the page rather than fetching one: the site
 * is served from a CDN-less container and a second request for ~30KB costs
 * more than inlining it, and it keeps search working on a page opened from
 * cache with no network.
 *
 * Matching is deliberately plain substring over title, description, category
 * and keywords, accent- and case-folded. No fuzzy ranking: with 99 posts a
 * reader typing "AI Act" wants the posts containing "AI Act", and a scoring
 * function would mostly be a source of surprising order.
 */
function searchScript(indexJson, lang = 'de') {
  const L = LANGS[lang];
  return `<script id="vm-blog-index" type="application/json">${indexJson}</script>
<script>
(function(){
  var dataEl = document.getElementById('vm-blog-index');
  var q = document.getElementById('vm-blog-q');
  var chips = document.querySelector('.vm-blog-chips');
  var results = document.getElementById('vm-blog-results');
  var staticList = document.getElementById('vm-blog-static');
  var count = document.getElementById('vm-blog-count');
  if (!dataEl || !q || !results || !staticList) return;
  // Note the pagination control lives INSIDE #vm-blog-static, so hiding the
  // static list hides it too. That is deliberate: while filtered results are
  // on screen the pager describes a different set of posts, and leaving it
  // visible would offer page 2 of a list nobody is looking at.

  var posts = JSON.parse(dataEl.textContent);
  // pageCat is what THIS page was rendered for; activeCat is what the reader
  // has since selected. They start equal and diverge once a chip is clicked.
  var pageCat = (document.querySelector('.vm-blog-chips .is-active') || {}).dataset;
  pageCat = pageCat ? pageCat.cat : '${L.all}';
  var activeCat = pageCat;

  function fold(s){
    return (s || '').toLowerCase()
      .replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss')
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  posts.forEach(function(p){ p._h = fold([p.t, p.d, p.c, p.k].join(' ')); });

  // The index holds raw text (see the generators for why), so anything going
  // into innerHTML is escaped here.
  function h(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function card(p){
    return '<article class="vm-post">' +
      '<span class="vm-cat">' + h(p.c) + '</span>' +
      '<h2><a href="${L.base}' + encodeURIComponent(p.s) + '/">' + h(p.t) + '</a></h2>' +
      '<div class="vm-date">' + h(p.f || '') + '</div>' +
      '<p>' + h(p.d) + '</p>' +
      '<a class="vm-more" href="${L.base}' + p.s + '/">${L.more} &rarr;</a>' +
      '</article>';
  }

  function render(){
    var term = fold(q.value);
    var terms = term ? term.split(' ') : [];
    // With no query and the page's own category still selected, the
    // server-rendered list already IS the answer — and it is paginated,
    // which the JS list is not. Replacing it would silently drop pagination:
    // /blog/kategorie/archiv/ would show all 44 posts at once while its own
    // page 2 still existed and disagreed. Hand back to the static list.
    if (!terms.length && activeCat === pageCat) {
      results.hidden = true; staticList.hidden = false; count.hidden = true;
      return;
    }
    var hits = posts.filter(function(p){
      if (activeCat !== '${L.all}' && p.c !== activeCat) return false;
      return terms.every(function(t){ return p._h.indexOf(t) !== -1; });
    });
    results.innerHTML = hits.length
      ? hits.map(card).join('')
      : '<p class="vm-empty">${L.empty}</p>';
    results.hidden = false;
    staticList.hidden = true;
    count.textContent = hits.length === 1 ? '${L.one}' : hits.length + ' ${L.manySuffix}';
    count.hidden = false;
  }

  var t;
  q.addEventListener('input', function(){ clearTimeout(t); t = setTimeout(render, 120); });

  if (chips) {
    chips.addEventListener('click', function(e){
      var a = e.target.closest('a[data-cat]');
      if (!a) return;
      // Only intercept when we can do the job in-page. Ctrl/cmd-click, or a
      // middle click, must keep opening the real category page in a new tab.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      activeCat = a.dataset.cat;
      Array.prototype.forEach.call(chips.querySelectorAll('a'), function(x){
        x.classList.toggle('is-active', x === a);
      });
      history.replaceState(null, '', a.getAttribute('href'));
      render();
    });
  }

  render();
})();
</script>`;
}

module.exports = {
  PER_PAGE,
  MANIFESTS,
  categorySlug,
  loadManifests,
  harvestLegacy,
  splitByDate,
  ARCHIVE_CSS,
  esc,
  postCard,
  toolsHtml,
  paginationHtml,
  searchScript,
};
