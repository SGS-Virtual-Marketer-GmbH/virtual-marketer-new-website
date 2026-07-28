#!/usr/bin/env node

/**
 * English Blog Post Generator
 *
 * Reads blog-posts-en.json (translated metadata + body for all 58 real
 * German blog posts — see that file's own header) and generates
 * dist/en/blog/<slug>/index.html pages plus dist/en/blog/index.html, the
 * English mirror of scripts/generate-blog-posts.js's output.
 *
 * This existing precisely because scripts/generate-blog-posts.js's header
 * comment (and generate-en-pages.js's) used to say the English blog was
 * "deliberately out of scope" — that scope was expanded on explicit
 * request; every post here is a faithful translation of the real,
 * already-published German article (see blog-posts-en.json's own header
 * for exactly how the translations were produced), not new content.
 *
 * Run after scripts/generate-blog-posts.js (needs the DE posts already
 * built, both for hreflang back-references and hreflang forward wiring —
 * see the fix in that script adding hreflang="en" once this script exists)
 * and before scripts/inject-language-switcher.js (so the switcher can find
 * these new pages).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DIST_EN_BLOG = path.join(DIST, 'en/blog');
const POSTS_EN_JSON = path.join(ROOT, 'blog-posts-en.json');
const BASE_URL = 'https://virtual-marketer.de';

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

function formatDateEN(dateStr) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}

function pageShell({ titleEN, descriptionEN, keywordsEN, slug, dateISO, categoryEN, bodyHtmlEN, relatedPosts }) {
  const url = `${BASE_URL}/en/blog/${slug}/`;
  const dePath = `/blog/${slug}/`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: titleEN,
    description: descriptionEN,
    datePublished: dateISO,
    dateModified: dateISO,
    author: { '@type': 'Organization', name: 'Virtual Marketer' },
    publisher: {
      '@type': 'Organization',
      name: 'Virtual Marketer',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'en',
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleEN} | Virtual Marketer</title>
<meta name="description" content="${descriptionEN}">
<meta name="keywords" content="${keywordsEN}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="de" href="${BASE_URL}${dePath}">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}${dePath}">

<meta property="og:type" content="article">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="${titleEN}">
<meta property="og:description" content="${descriptionEN}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png">
<meta property="article:published_time" content="${dateISO}">
<meta name="twitter:card" content="summary_large_image">

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
  .vm-header-simple{max-width:1140px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;justify-content:space-between}
  .vm-header-simple nav a{margin-left:24px;color:#1f2937;text-decoration:none;font-weight:500}
  .vm-footer-simple{max-width:1140px;margin:40px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px}
</style>
</head>
<body class="vm-static-blog">

<header class="vm-header-simple">
  <a href="/en/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/en/solutions/">Solutions</a>
    <a href="/en/blog/">Blog</a>
    <a href="https://api.virtual-marketer.de/documentation/">API</a>
    <a href="/en/request-custom-model/">Request a model</a>
    <a href="/en/contact/">Contact</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>

<main class="vm-post">
  <article>
    <span class="vm-category">${categoryEN}</span>
    <h1>${titleEN}</h1>
    <div class="vm-meta">
      <span>${formatDateEN(dateISO)}</span> &middot; <span>Virtual Marketer Team</span>
    </div>

    ${bodyHtmlEN}

    <div class="vm-cta">
      <strong>Ready for AI marketing solutions?</strong>
      <p>See in a no-obligation demo how Virtual Marketer automates your marketing.</p>
      <a href="/en/demo/">Book a demo</a>
    </div>

    <div class="vm-related">
      <h3>More articles</h3>
      <ul>
        ${relatedPosts.map((p) => `<li><a href="/en/blog/${p.slug}/">${p.titleEN}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </article>
</main>

<footer class="vm-footer-simple">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="/en/privacy-policy/">Privacy Policy</a> &middot;
  <a href="/en/legal-notice/">Legal Notice</a>
</footer>

</body>
</html>
`;
}

function generateArchive(posts) {
  const sorted = [...posts].sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
  const cards = sorted
    .map(
      (p) => `
      <article style="border-bottom:1px solid #e5e7eb;padding:24px 0;">
        <span style="display:inline-block;background:#fbecee;color:#94152b;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;margin-bottom:8px">${p.categoryEN}</span>
        <h2 style="font-size:1.4rem;margin:0 0 8px;"><a href="/en/blog/${p.slug}/" style="color:#111827;text-decoration:none;">${p.titleEN}</a></h2>
        <div style="color:#6b7280;font-size:14px;margin-bottom:8px;">${formatDateEN(p.dateISO)}</div>
        <p style="color:#374151;line-height:1.6;">${p.descriptionEN}</p>
        <a href="/en/blog/${p.slug}/" style="color:#94152b;font-weight:600;">Read more &rarr;</a>
      </article>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog | Virtual Marketer - AI &amp; Marketing Insights</title>
<meta name="description" content="Everything about AI, machine learning and modern marketing strategy. Articles, tips and best practices from Virtual Marketer.">
<link rel="canonical" href="${BASE_URL}/en/blog/">
<link rel="alternate" hreflang="en" href="${BASE_URL}/en/blog/">
<link rel="alternate" hreflang="de" href="${BASE_URL}/blog/">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}/blog/">
<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Virtual Marketer Blog',
    url: `${BASE_URL}/en/blog/`,
    inLanguage: 'en',
  })}</script>
</head>
<body>
<header class="vm-header-simple" style="max-width:1140px;margin:0 auto;padding:24px 20px;display:flex;align-items:center;justify-content:space-between;">
  <a href="/en/"><img src="/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/en/solutions/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Solutions</a>
    <a href="/en/blog/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Blog</a>
    <a href="https://api.virtual-marketer.de/documentation/" style="margin-left:24px;color:#1f2937;text-decoration:none;">API</a>
    <a href="/en/request-custom-model/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Request a model</a>
    <a href="/en/contact/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Contact</a>
    <a href="https://login.virtual-marketer.de/" style="margin-left:24px;color:#1f2937;text-decoration:none;">Login</a>
  </nav>
</header>
<main style="max-width:820px;margin:0 auto;padding:20px;">
  <h1>Virtual Marketer Blog</h1>
  <p style="color:#6b7280;">AI, machine learning and modern marketing strategy &mdash; articles, tips and best practices.</p>
  ${cards}
</main>
<footer style="max-width:1140px;margin:40px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="/en/privacy-policy/">Privacy Policy</a> &middot;
  <a href="/en/legal-notice/">Legal Notice</a>
</footer>
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(POSTS_EN_JSON)) {
    console.warn('\n⚠ blog-posts-en.json not found — skipping English blog generation\n');
    return;
  }
  const { posts } = JSON.parse(fs.readFileSync(POSTS_EN_JSON, 'utf-8'));

  console.log(`\n📝 Generating ${posts.length} English blog posts...\n`);

  posts.forEach((post, idx) => {
    const related = posts
      .filter((p) => p.slug !== post.slug)
      .sort(() => 0.5 - ((idx * 7 + post.slug.length) % 10) / 10)
      .slice(0, 3);

    const html = pageShell({ ...post, relatedPosts: related });

    const outDir = path.join(DIST_EN_BLOG, post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
  });

  fs.writeFileSync(path.join(DIST_EN_BLOG, 'index.html'), generateArchive(posts));

  console.log(`  ✓ ${posts.length} posts + /en/blog/ archive\n`);
}

main();
