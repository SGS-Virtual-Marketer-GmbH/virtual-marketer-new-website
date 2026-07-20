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

const ROOT = path.join(__dirname, '..');
const DIST_BLOG = path.join(ROOT, 'dist/blog');
const CONTENT_DIR = path.join(ROOT, 'content/blog');
const POSTS_JSON = path.join(ROOT, 'blog-posts.json');
const BASE_URL = 'https://virtual-marketer.de';
// See the matching comment in scripts/seo-optimize.js: virtual-marketer.ai
// is the (not yet built) English counterpart site. hreflang="en" here
// points at it in advance; harmless until that site exists, but it must
// reciprocally link back to virtual-marketer.de once it does.
const EN_BASE_URL = 'https://virtual-marketer.ai';

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
<link rel="alternate" hreflang="en" href="${EN_BASE_URL}/blog/${slug}/">
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
  .vm-post .vm-category{display:inline-block;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:16px}
  .vm-post h1{font-size:2.1rem;line-height:1.25;margin-bottom:12px}
  .vm-post h2{font-size:1.5rem;margin-top:2.2em}
  .vm-post h3{font-size:1.2rem;margin-top:1.6em}
  .vm-post p{line-height:1.75;font-size:1.05rem;color:#1f2937}
  .vm-post ul,.vm-post ol{line-height:1.75;font-size:1.05rem;color:#1f2937;padding-left:1.4em}
  .vm-post a{color:#4338ca}
  .vm-post .vm-cta{margin-top:56px;padding:28px;background:#f8f9fc;border-radius:12px;text-align:center}
  .vm-post .vm-cta a{display:inline-block;margin-top:12px;padding:12px 24px;background:linear-gradient(90deg,#2fb6d9,#a8195e);color:#fff;border-radius:6px;text-decoration:none;font-weight:600}
  .vm-post .vm-related{margin-top:40px}
  .vm-post .vm-related ul{list-style:none;padding:0}
  .vm-post .vm-related li{margin-bottom:8px}
  .vm-header-simple{max-width:1140px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;justify-content:space-between}
  .vm-header-simple nav a{margin-left:24px;color:#1f2937;text-decoration:none;font-weight:500}
  .vm-footer-simple{max-width:1140px;margin:40px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px}
</style>
</head>
<body class="vm-static-blog">

<header class="vm-header-simple">
  <a href="/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/ki-loesungen/">Lösungen</a>
    <a href="/blog/">Blog</a>
    <a href="http://api.virtual-marketer.de/documentation/">API</a>
    <a href="/modell-anfragen/">Modell anfragen</a>
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
  &copy; 2026 Virtual Marketer GmbH &middot;
  <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> &middot;
  <a href="/impressum/">Impressum</a>
</footer>

</body>
</html>
`;
}

function generateArchive(posts) {
  const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const cards = sorted
    .map(
      (p) => `
      <article style="border-bottom:1px solid #e5e7eb;padding:24px 0;">
        <span style="display:inline-block;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:8px">${p.category}</span>
        <h2 style="font-size:1.4rem;margin:0 0 8px;"><a href="/blog/${p.slug}/" style="color:#111827;text-decoration:none;">${p.title}</a></h2>
        <div style="color:#6b7280;font-size:14px;margin-bottom:8px;">${formatDateDE(p.date)}</div>
        <p style="color:#374151;line-height:1.6;">${p.description}</p>
        <a href="/blog/${p.slug}/" style="color:#4338ca;font-weight:600;">Weiterlesen &rarr;</a>
      </article>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog | Virtual Marketer - KI &amp; Marketing Insights</title>
<meta name="description" content="Erfahren Sie alles über KI, Machine Learning und moderne Marketingstrategien. Artikel, Tipps und Best Practices von Virtual Marketer.">
<link rel="canonical" href="${BASE_URL}/blog/">
<link rel="alternate" hreflang="de" href="${BASE_URL}/blog/">
<link rel="alternate" hreflang="en" href="${EN_BASE_URL}/blog/">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}/blog/">
<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Virtual Marketer Blog',
    url: `${BASE_URL}/blog/`,
    inLanguage: 'de',
  })}</script>
</head>
<body>
<header class="vm-header-simple" style="max-width:1140px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;justify-content:space-between;">
  <a href="/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/ki-loesungen/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Lösungen</a>
    <a href="/blog/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Blog</a>
    <a href="http://api.virtual-marketer.de/documentation/" style="margin-left:24px;color:#1f2937;text-decoration:none;">API</a>
    <a href="/modell-anfragen/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Modell anfragen</a>
    <a href="https://login.virtual-marketer.de/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Login</a>
  </nav>
</header>
<main style="max-width:820px;margin:0 auto;padding:20px;">
  <h1>Virtual Marketer Blog</h1>
  <p style="color:#6b7280;">KI, Machine Learning und moderne Marketingstrategien &mdash; Artikel, Tipps und Best Practices.</p>
  ${cards}
</main>
<footer style="max-width:1140px;margin:40px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
  &copy; 2026 Virtual Marketer GmbH &middot;
  <a href="/datenschutzerklaerung/">Datenschutzerklärung</a> &middot;
  <a href="/impressum/">Impressum</a>
</footer>
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(POSTS_JSON)) {
    console.error('blog-posts.json not found');
    process.exit(1);
  }
  const { posts } = JSON.parse(fs.readFileSync(POSTS_JSON, 'utf-8'));

  console.log(`\n📝 Generating ${posts.length} blog posts...\n`);

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
    console.log(`  ✓ /blog/${post.slug}/`);
  });

  fs.writeFileSync(path.join(DIST_BLOG, 'index.html'), generateArchive(posts));
  console.log('  ✓ /blog/ (archive updated)');

  console.log(`\n✅ ${posts.length} blog posts generated.\n`);
}

main();
