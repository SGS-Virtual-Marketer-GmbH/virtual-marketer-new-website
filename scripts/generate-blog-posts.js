#!/usr/bin/env node

/**
 * Blog Post Generator
 *
 * Reads blog-posts.json (metadata) + content/blog/<file>.html (body HTML)
 * and generates static dist/blog/<slug>/index.html pages plus an updated
 * dist/blog/index.html archive.
 *
 * Run after scripts/build.js, before scripts/generate-sitemap.js:
 *   node scripts/build.js && node scripts/generate-blog-posts.js && node scripts/generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const { CHROME_CSS } = require('./lib/page-chrome');
const BI = require('./lib/blog-index');

const ROOT = path.join(__dirname, '..');
const DIST_BLOG = path.join(ROOT, 'dist/blog');
const CONTENT_DIR = path.join(ROOT, 'content/blog');
const POSTS_JSON = path.join(ROOT, 'blog-posts.json');
const BASE_URL = 'https://virtual-marketer.de';
// All 14 posts here have a real English translation now (see
// blog-posts-en.json / generate-en-blog-posts.js), so each page gets a
// same-domain hreflang="en" pointing at its /en/blog/<slug>/ counterpart —
// never the never-registered virtual-marketer.ai domain (see
// scripts/seo-optimize.js's comment for the full rationale on why that
// domain must never appear in hreflang tags). The 44 older legacy-template
// blog posts get their hreflang="en" wired separately via
// scripts/seo-optimize.js's DE_TO_EN map, since they're not generated here.

const CATEGORY_LABELS = {
  'AI-Trends': 'AI-Trends',
  'SEO': 'SEO',
  'Regulierung & Compliance': 'Regulierung & Compliance',
  'Use Cases': 'Use Cases',
  'Bildung': 'Bildung',
};

// The scraped WordPress theme CSS files keep their version query string
// baked into the on-disk filename (e.g. "style.css?ver=7.0.1.css" — a wget
// artifact, not a real query string). Hardcoding that suffix here previously
// caused these 15 generated pages (14 posts + the /blog/ archive) to
// reference a non-existent plain "style.css" and silently render with zero
// theme CSS. Resolving the real filename from disk means this keeps working
// even if a future re-scrape bumps the theme version.
function resolveThemeAsset(cleanRelPath) {
  const dir = path.dirname(path.join(ROOT, 'dist', cleanRelPath));
  const base = path.basename(cleanRelPath);
  if (!fs.existsSync(dir)) return cleanRelPath;
  const match = fs.readdirSync(dir).find(f => f === base || f.startsWith(`${base}?`));
  const resolved = match ? path.join(path.dirname(cleanRelPath), match) : cleanRelPath;
  // The "?" here is a literal character in the on-disk filename (a wget
  // artifact), not a query-string separator — it must be percent-encoded
  // in the href/src attribute or the browser (and server.js) will treat
  // everything after it as a real query string and 404. This matches how
  // the original WordPress export itself encodes these same references
  // (e.g. src="...jquery.min.js%3Fver=3.7.1").
  return resolved.replace(/\?/g, '%3F');
}

const THEME_CSS = {
  bootstrap: resolveThemeAsset('wp-content/themes/engitech/css/bootstrap.css'),
  fontAwesome: resolveThemeAsset('wp-content/themes/engitech/css/font-awesome.min.css'),
  style: resolveThemeAsset('wp-content/themes/engitech/style.css'),
};

function formatDateDE(dateStr) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}

function pageShell({ title, description, keywords, slug, date, updated, category, bodyContent, relatedPosts }) {
  const url = `${BASE_URL}/blog/${slug}/`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: date,
    dateModified: updated || date,
    author: { '@type': 'Organization', name: 'Virtual Marketer' },
    publisher: {
      '@type': 'Organization',
      name: 'Virtual Marketer',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'de',
  };

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | Virtual Marketer</title>
<meta name="description" content="${description}">
<meta name="keywords" content="${keywords}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<link rel="alternate" hreflang="en" href="${BASE_URL}/en/blog/${slug}/">
<link rel="alternate" hreflang="x-default" href="${url}">

<meta property="og:type" content="article">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png">
<meta property="article:published_time" content="${date}">
<meta property="article:modified_time" content="${updated || date}">
<meta name="twitter:card" content="summary_large_image">

<meta name="geo.placename" content="Germany">
<meta name="geo.country" content="DE">
<meta name="ICBM" content="51.1657, 10.4515">

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.fontAwesome}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<style>
  .vm-post{max-width:820px;margin:0 auto;padding:48px 20px 80px}
  .vm-post .vm-meta{color:#6b7280;font-size:14px;margin-bottom:8px}
  .vm-post .vm-category{display:inline-block;background:#fbecee;color:#94152b;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:16px}
  .vm-post h1{font-size:2.1rem;line-height:1.25;margin-bottom:12px}
  .vm-post h2{font-size:1.5rem;margin-top:2.2em}
  .vm-post h3{font-size:1.2rem;margin-top:1.6em}
  .vm-post p{line-height:1.75;font-size:1.05rem;color:#1f2937}
  .vm-post ul,.vm-post ol{line-height:1.75;font-size:1.05rem;color:#1f2937;padding-left:1.4em}
  .vm-post a{color:#94152b}
  .vm-post .vm-cta{margin-top:56px;padding:28px;background:#f8f9fc;border-radius:12px;text-align:center}
  .vm-post .vm-cta a{display:inline-block;margin-top:12px;padding:12px 24px;background:linear-gradient(90deg,#66a3ce,#94152b);color:#fff;border-radius:6px;text-decoration:none;font-weight:600}
  .vm-post .vm-related{margin-top:40px}
  .vm-post .vm-related ul{list-style:none;padding:0}
  .vm-post .vm-related li{margin-bottom:8px}
  ${CHROME_CSS}
</style>
</head>
<body class="vm-static-blog">

<header class="vm-header-simple">
  <a href="/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/ki-loesungen/">Lösungen</a>
    <a href="/blog/">Blog</a>
    <a href="https://api.virtual-marketer.de/documentation/">API</a>
    <a href="/modell-anfragen/">Modell anfragen</a>
    <a href="/kontakt/">Kontakt</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>

<main class="vm-post">
  <article>
    <span class="vm-category">${category}</span>
    <h1>${title}</h1>
    <div class="vm-meta">
      <span>${formatDateDE(date)}</span> · <span>Virtual Marketer Team</span>
    </div>

    ${bodyContent}

    <div class="vm-cta">
      <strong>Bereit für KI-Marketinglösungen?</strong>
      <p>Erfahren Sie in einer unverbindlichen Demo, wie Virtual Marketer Ihr Marketing automatisiert.</p>
      <a href="/virtual-marketer-demo/">Demo buchen</a>
    </div>

    <div class="vm-related">
      <h3>Weitere Artikel</h3>
      <ul>
        ${relatedPosts.map((p) => `<li><a href="/blog/${p.slug}/">${p.title}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </article>
</main>

<footer class="vm-footer-simple">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> &middot;
  <a href="/impressum/">Impressum</a>
</footer>

</body>
</html>
`;
}

/**
 * One archive page: /blog/, /blog/page/N/ or /blog/kategorie/<slug>/.
 *
 * `pagePosts` is what this page lists; `allPosts` is the full corpus that
 * gets embedded for client-side search. They differ on every page but the
 * single-page case, and conflating them was the trap here — search has to see
 * posts that are not on the current page, or it only ever finds twelve.
 */
function generateArchive({ pagePosts, allPosts, categories, activeCategory, page, totalPages, urlPath, hrefFor }) {
  const cards = pagePosts.map((p) => BI.postCard(p, formatDateDE)).join('\n');

  const canonical = `${BASE_URL}${urlPath}`;
  const title = activeCategory
    ? `${activeCategory} | Virtual Marketer Blog`
    : page > 1
      ? `Blog – Seite ${page} | Virtual Marketer`
      : 'Blog | Virtual Marketer - KI &amp; Marketing Insights';
  const description = activeCategory
    ? `Alle Beiträge zum Thema ${activeCategory} — Artikel, Analysen und Praxisbeispiele von Virtual Marketer.`
    : 'Erfahren Sie alles über KI, Machine Learning und moderne Marketingstrategien. Artikel, Tipps und Best Practices von Virtual Marketer.';

  // The search index is a compact shape ({t,s,d,c,k,f}) rather than the full
  // post objects: it is inlined into every archive page, so the difference
  // between 30KB and 90KB is paid on each of them.
  const indexJson = JSON.stringify(
    allPosts.map((p) => ({
      // Raw, NOT HTML-escaped. These values are compared against
      // element.dataset.cat, which the DOM hands back with entities already
      // decoded — so an escaped "Regulierung &amp; Compliance" here would
      // never equal the "Regulierung & Compliance" the chip reports, and
      // that one category would silently filter to zero results. Escaping
      // happens at the point of use, in the client's card() helper.
      t: p.title,
      s: p.slug,
      d: p.description,
      c: p.category,
      k: p.keywords || '',
      f: p.date ? formatDateDE(p.date) : '',
    }))
  ).replace(/</g, '\\u003c');

  // Only page 1 of the unfiltered archive is hreflang-linked to /en/blog/.
  // Deeper pages have no English counterpart at the same offset — the two
  // blogs hold different numbers of posts — and pointing page 3 at the
  // English index would be a false equivalence.
  const hreflang =
    page === 1 && !activeCategory
      ? `<link rel="alternate" hreflang="de" href="${BASE_URL}/blog/">
<link rel="alternate" hreflang="en" href="${BASE_URL}/en/blog/">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}/blog/">`
      : '';

  const prevNext = [
    page > 1 ? `<link rel="prev" href="${BASE_URL}${hrefFor(page - 1)}">` : '',
    page < totalPages ? `<link rel="next" href="${BASE_URL}${hrefFor(page + 1)}">` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
${hreflang}
${prevNext}
<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<style>
  ${CHROME_CSS}
  ${BI.ARCHIVE_CSS}
</style>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: activeCategory ? `${activeCategory} — Virtual Marketer Blog` : 'Virtual Marketer Blog',
    url: canonical,
    inLanguage: 'de',
  })}</script>
</head>
<body>
<!-- Header markup and styling both come from lib/page-chrome.js. This page
     used to carry a hand-written copy with inline styles that predated that
     module: a flex row with fixed 24px link margins and no wrapping rule, and
     no CHROME_CSS in the head at all. Inline styles outrank the class rules,
     so on a 375px screen the six links wrapped straight across the logo and
     the two overlapped. Every other generated page already used the shared
     chrome; this one was the last holdout. -->
<header class="vm-header-simple">
  <a href="/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/ki-loesungen/">Lösungen</a>
    <a href="/blog/">Blog</a>
    <a href="https://api.virtual-marketer.de/documentation/">API</a>
    <a href="/modell-anfragen/">Modell anfragen</a>
    <a href="/kontakt/">Kontakt</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>
<main style="max-width:820px;margin:0 auto;padding:20px;">
  <h1>${activeCategory ? BI.esc(activeCategory) : 'Virtual Marketer Blog'}</h1>
  <p style="color:#6b7280;">${
    activeCategory
      ? `Alle Beiträge in der Kategorie &bdquo;${BI.esc(activeCategory)}&ldquo;.`
      : 'KI, Machine Learning und moderne Marketingstrategien &mdash; Artikel, Tipps und Best Practices.'
  }</p>
${BI.toolsHtml({ categories, activeCategory, basePath: urlPath })}
${cards}
${BI.paginationHtml(page, totalPages, hrefFor)}
  </div>
</main>
<footer style="max-width:1140px;margin:40px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> &middot;
  <a href="/impressum/">Impressum</a>
</footer>
${BI.searchScript(indexJson)}
</body>
</html>
`;
}

/** Today as YYYY-MM-DD, in Europe/Berlin — where the company publishes from. */
function today() {
  if (process.env.VM_BUILD_DATE) return process.env.VM_BUILD_DATE; // for tests
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function writePage(urlPath, html) {
  const dir = path.join(ROOT, 'dist', urlPath.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

function main() {
  const now = today();
  const manifestPosts = BI.loadManifests();
  const { published, scheduled } = BI.splitByDate(manifestPosts, now);

  console.log(`\n📝 Blog: ${manifestPosts.length} post(s) in ${BI.MANIFESTS.length} manifest(s)\n`);

  const posts = published;

  posts.forEach((post, idx) => {
    const contentPath = path.join(CONTENT_DIR, post.contentFile);
    if (!fs.existsSync(contentPath)) {
      console.warn(`  ⚠ Missing content file for "${post.slug}": ${post.contentFile}`);
      return;
    }
    const bodyContent = fs.readFileSync(contentPath, 'utf-8');

    const related = posts
      .filter((p) => p.slug !== post.slug)
      .sort(() => 0.5 - ((idx * 7 + post.slug.length) % 10) / 10) // deterministic pseudo-shuffle
      .slice(0, 3);

    const html = pageShell({
      title: post.title,
      description: post.description,
      keywords: post.keywords,
      slug: post.slug,
      date: post.date,
      updated: post.updated,
      category: post.category,
      bodyContent,
      relatedPosts: related,
    });

    const outDir = path.join(DIST_BLOG, post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
  });
  console.log(`  ✓ ${posts.length} post page(s) written`);

  // A scheduled post exists on disk as content but has no page and is in no
  // index, so nothing links to it and nothing can find it early.
  if (scheduled.length) {
    console.log(`  ⏳ ${scheduled.length} post(s) scheduled — next: ${scheduled[0].date} (${scheduled[0].slug})`);
    console.log('     They publish on the first build on or after their date.');
  }

  // The legacy WordPress posts are already in dist/ from build.js. They are
  // listed here so the archive covers the whole blog; without this they stay
  // reachable only through the sitemap.
  const legacy = BI.harvestLegacy(DIST_BLOG, new Set(manifestPosts.map((p) => p.slug)));
  const all = [...posts, ...legacy].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  console.log(`  ✓ ${legacy.length} legacy post(s) harvested into the archive`);

  const categories = [...new Set(all.map((p) => p.category))]
    .sort()
    .map((label) => ({ label, slug: BI.categorySlug(label) }));

  // --- Paginated main archive ---------------------------------------------
  // Wiped first, not merged into. The WordPress export ships its own
  // /blog/page/1/ — a second copy of the archive under a different URL, and
  // exactly the duplicate-content page prune-thin-archives.js used to delete
  // before this generator claimed the directory. Removing the tree means a
  // page that stops existing (say the post count drops below a page
  // boundary) also stops being served, instead of lingering as a stale
  // orphan that only the sitemap remembers.
  for (const stale of ['page', 'kategorie']) {
    fs.rmSync(path.join(DIST_BLOG, stale), { recursive: true, force: true });
  }

  const totalPages = Math.max(1, Math.ceil(all.length / BI.PER_PAGE));
  const hrefFor = (n) => (n === 1 ? '/blog/' : `/blog/page/${n}/`);

  for (let page = 1; page <= totalPages; page++) {
    const urlPath = hrefFor(page);
    writePage(
      urlPath,
      generateArchive({
        pagePosts: all.slice((page - 1) * BI.PER_PAGE, page * BI.PER_PAGE),
        allPosts: all,
        categories,
        activeCategory: null,
        page,
        totalPages,
        urlPath,
        hrefFor,
      })
    );
  }
  console.log(`  ✓ /blog/ + ${totalPages - 1} paginated page(s), ${BI.PER_PAGE} posts each`);

  // --- Category pages ------------------------------------------------------
  // Real pages, not just chips: the chips link here, so a crawler can reach
  // every category listing and a reader without JavaScript still gets one.
  for (const cat of categories) {
    const catPosts = all.filter((p) => p.category === cat.label);
    const catPages = Math.max(1, Math.ceil(catPosts.length / BI.PER_PAGE));
    const catHref = (n) =>
      n === 1 ? `/blog/kategorie/${cat.slug}/` : `/blog/kategorie/${cat.slug}/page/${n}/`;

    for (let page = 1; page <= catPages; page++) {
      const urlPath = catHref(page);
      writePage(
        urlPath,
        generateArchive({
          pagePosts: catPosts.slice((page - 1) * BI.PER_PAGE, page * BI.PER_PAGE),
          allPosts: all,
          categories,
          activeCategory: cat.label,
          page,
          totalPages: catPages,
          urlPath,
          hrefFor: catHref,
        })
      );
    }
  }
  console.log(`  ✓ ${categories.length} category page(s): ${categories.map((c) => c.label).join(', ')}`);

  console.log(`\n✅ Blog built — ${all.length} post(s) listed, ${scheduled.length} scheduled.\n`);
}

main();
