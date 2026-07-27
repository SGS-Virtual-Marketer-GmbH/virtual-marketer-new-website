#!/usr/bin/env node

/**
 * SEO & Geo Optimization Script
 * Adds modern SEO best practices to static site
 *
 * Includes:
 * - Structured data (Schema.org JSON-LD)
 * - Open Graph & Twitter cards
 * - Geo-targeting meta tags
 * - Sitemap with priorities
 * - robots.txt with sitemaps
 * - Canonical tags
 * - Hreflang for multi-language (if applicable)
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

// International setup: virtual-marketer.de is the canonical/default site
// (German). English lives at /en/... on this SAME domain — virtual-marketer.ai
// was never registered/DNS-configured, so pointing hreflang at it would be a
// dead link forever (see the architecture note in generate-feature-pages.js
// and generate-en-pages.js). This script runs near the end of the build
// pipeline and previously overwrote the correct same-domain hreflang that
// generate-feature-pages.js/inject-language-switcher.js had already set on
// these exact pages with a hardcoded pointer to that dead domain — fixed by
// reusing the same DE->EN path map those scripts use. Pages with no EN
// counterpart (e.g. /virtual-marketer-ai-services/) simply get no
// hreflang="en" line instead of a fabricated dead one.
const DE_TO_EN = {
  '/': '/en/',
  '/ki-loesungen/': '/en/solutions/',
  '/impressum/': '/en/legal-notice/',
  '/datenschutzerklaerung/': '/en/privacy-policy/',
  '/nutzungsbedingungen/': '/en/terms-of-service/',
  '/faqs/': '/en/faqs/',
  '/management/': '/en/about/',
  '/modell-anfragen/': '/en/request-custom-model/',
  '/virtual-marketer-demo/': '/en/demo/',
  '/kontakt/': '/en/contact/',
};

function hreflangBlock(pagePath) {
  const de = `https://virtual-marketer.de${pagePath}`;
  const en = DE_TO_EN[pagePath] ? `https://virtual-marketer.de${DE_TO_EN[pagePath]}` : null;
  let out = `  <link rel="alternate" hreflang="de" href="${de}">\n`;
  if (en) out += `  <link rel="alternate" hreflang="en" href="${en}">\n`;
  out += `  <link rel="alternate" hreflang="x-default" href="${de}">\n`;
  return out;
}

console.log('\n🔍 SEO & Geo Optimization\n');
console.log('='.repeat(60));

// Page metadata database
const pageMetadata = {
  '/': {
    title: 'Virtual Marketer - KI-Marketinglösung aus Deutschland',
    description: 'Automatisierte Marketing-Lösungen mit Custom KI Modellen. Produktbeschreibungen, Blog, Ads & mehr - Made in Germany.',
    keywords: 'KI Marketing, Generative AI, Custom Modelle, Marketing Automation, Deutschland',
    image: '/wp-content/uploads/2023/01/home17-lllustration.png',
    type: 'website',
    geo: { country: 'DE', city: 'Germany', latitude: 51.1657, longitude: 10.4515 }
  },
  '/ki-loesungen/': {
    title: 'KI-Lösungen für Marketing | Virtual Marketer',
    description: 'KI-Agenten, Coding-API, Produktfotos, Feed-Veredelung, Text-, Bild- & Videogenerierung und mehr — alle Virtual Marketer KI-Lösungen im Überblick.',
    keywords: 'KI Lösungen, KI Agenten, Produktfotos KI, Feed Optimierung, Custom AI, Marketing Automation, Deutschland',
    type: 'product',
    geo: { country: 'DE' }
  },
  '/blog/': {
    title: 'Blog | Virtual Marketer - KI & Marketing Insights',
    description: 'Erfahren Sie alles über KI, Machine Learning und moderne Marketingstrategien. Artikel, Tipps und Best Practices.',
    keywords: 'KI Blog, Artificial Intelligence, Marketing, Generative AI',
    type: 'blog',
    geo: { country: 'DE' }
  },
  '/virtual-marketer-ai-services/': {
    title: 'AI Services | Virtual Marketer',
    description: 'Interaktive KI-Services für Unternehmen. Chatbots, Voicebots, NLP und Custom AI Modelle.',
    keywords: 'AI Services, Chatbots, NLP, Custom Modelle',
    type: 'product',
    geo: { country: 'DE' }
  },
  '/management/': {
    title: 'Über uns | Virtual Marketer Management & Team',
    description: 'Lernen Sie das Team von Virtual Marketer kennen. Innovative Köpfe hinter der KI-Marketinglösung.',
    keywords: 'Virtual Marketer Team, Management, Gründer',
    type: 'profile',
    geo: { country: 'DE' }
  },
  '/datenschutzerklaerung/': {
    title: 'Datenschutzerklärung | Virtual Marketer',
    description: 'Datenschutzrichtlinien und Datenschutzerklärung von Virtual Marketer.',
    keywords: 'Datenschutz, Privacy Policy, GDPR',
    type: 'policy',
    geo: { country: 'DE' }
  },
  '/impressum/': {
    title: 'Impressum | Virtual Marketer',
    description: 'Impressum und Kontaktinformation von SGS Virtual Marketer GmbH.',
    keywords: 'Impressum, Kontakt, Rechtliche Informationen',
    type: 'policy',
    geo: { country: 'DE' }
  },
  '/faqs/': {
    title: 'Häufig gestellte Fragen (FAQ) | Virtual Marketer',
    description: 'Antworten auf häufige Fragen zu Virtual Marketer: Passt die KI-Lösung zu Ihrem Unternehmen, Onboarding-Dauer, Kosten und Pakete.',
    keywords: 'FAQ, Häufige Fragen, Virtual Marketer, KI Marketing',
    type: 'website',
    geo: { country: 'DE' }
  },
  '/modell-anfragen/': {
    title: 'Custom KI-Modell anfragen | Virtual Marketer',
    description: 'Fordern Sie ein individuelles KI-Modell für Ihr Unternehmen an. Maßgeschneiderte Marketing-Automatisierung von Virtual Marketer.',
    keywords: 'Custom KI Modell, Modell anfragen, KI Individuallösung',
    type: 'product',
    geo: { country: 'DE' }
  },
  '/virtual-marketer-demo/': {
    title: 'Demo buchen | Virtual Marketer',
    description: 'Buchen Sie eine unverbindliche Demo und erleben Sie Virtual Marketer live in Aktion — Ihre KI-Marketinglösung aus Deutschland.',
    keywords: 'Demo buchen, Virtual Marketer testen, KI Marketing Demo',
    type: 'website',
    geo: { country: 'DE' }
  },
  '/nutzungsbedingungen/': {
    title: 'Nutzungsbedingungen | Virtual Marketer',
    description: 'Nutzungsbedingungen für die Verwendung der Virtual Marketer Plattform und Services.',
    keywords: 'Nutzungsbedingungen, AGB, Virtual Marketer',
    type: 'policy',
    geo: { country: 'DE' }
  }
};

/**
 * Generate JSON-LD structured data
 */
function generateStructuredData(path, meta) {
  const baseUrl = 'https://virtual-marketer.de';
  const url = `${baseUrl}${path}`;

  // Organization schema (for all pages)
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Virtual Marketer',
    'legalName': 'SGS Virtual Marketer GmbH',
    'foundingDate': '2022',
    'url': baseUrl,
    'logo': `${baseUrl}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png`,
    'description': 'KI-Marketinglösung für automatisierte Content-Generierung',
    'sameAs': [
      'https://www.linkedin.com/company/virtual-marketer',
      'https://twitter.com/virtual_marketer',
      'https://www.instagram.com/virtualmarketer'
    ],
    'contact': {
      '@type': 'ContactPoint',
      'telephone': '+49-xxx-xxxxxxx',
      'contactType': 'Sales',
      'email': 'info@virtual-marketer.de'
    },
    'areaServed': {
      '@type': 'Country',
      'name': 'Germany'
    },
    'geo': {
      '@type': 'GeoShape',
      'box': '47.270111 5.865474 55.099161 15.043611'
    }
  };

  let pageSchema = { '@context': 'https://schema.org' };

  // Page-specific schema
  if (meta.type === 'website') {
    pageSchema = {
      ...pageSchema,
      '@type': 'WebSite',
      'name': meta.title,
      'description': meta.description,
      'url': url,
      'image': meta.image ? `${baseUrl}${meta.image}` : null,
      'potentialAction': {
        '@type': 'SearchAction',
        'target': {
          '@type': 'EntryPoint',
          'urlTemplate': `${baseUrl}/?s={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    };
  } else if (meta.type === 'product') {
    pageSchema = {
      ...pageSchema,
      '@type': 'Product',
      'name': meta.title,
      'description': meta.description,
      'url': url,
      'image': meta.image ? `${baseUrl}${meta.image}` : null,
      'brand': { '@type': 'Brand', 'name': 'Virtual Marketer' },
      'offers': {
        '@type': 'AggregateOffer',
        'priceCurrency': 'EUR',
        'availability': 'https://schema.org/InStock'
      }
    };
  } else if (meta.type === 'blog') {
    pageSchema = {
      ...pageSchema,
      '@type': 'CollectionPage',
      'name': meta.title,
      'description': meta.description,
      'url': url
    };
  } else if (meta.type === 'profile') {
    pageSchema = {
      ...pageSchema,
      '@type': 'ProfilePage',
      'name': meta.title,
      'description': meta.description,
      'url': url
    };
  }

  return [orgSchema, pageSchema];
}

/**
 * Generate Open Graph tags
 */
function generateOpenGraph(path, meta) {
  const baseUrl = 'https://virtual-marketer.de';
  const url = `${baseUrl}${path}`;

  return `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${meta.type || 'website'}">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${meta.title}">
    <meta property="og:description" content="${meta.description}">
    <meta property="og:image" content="${meta.image ? baseUrl + meta.image : baseUrl + '/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png'}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="de_DE">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${url}">
    <meta property="twitter:title" content="${meta.title}">
    <meta property="twitter:description" content="${meta.description}">
    <meta property="twitter:image" content="${meta.image ? baseUrl + meta.image : baseUrl + '/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png'}">
    <meta property="twitter:creator" content="@virtual_marketer">
  `.trim();
}

/**
 * Generate geo-targeting meta tags
 */
function generateGeoTags(meta) {
  if (!meta.geo) return '';

  return `
    <!-- Geo Targeting -->
    <meta name="geo.placename" content="${meta.geo.city || 'Germany'}">
    <meta name="geo.country" content="${meta.geo.country}">
    ${meta.geo.latitude ? `<meta name="ICBM" content="${meta.geo.latitude}, ${meta.geo.longitude}">` : ''}
    ${meta.geo.latitude ? `<meta name="geo.position" content="${meta.geo.latitude};${meta.geo.longitude}">` : ''}
    <meta name="distribution" content="global">
  `.trim();
}

/**
 * Strip legacy WordPress/Yoast tags that would otherwise duplicate what we
 * inject below (canonical, hreflang, og:*, twitter:*, description/keywords
 * meta) — Yoast's originals are relative-path or otherwise stale, and
 * leaving both in produces invalid duplicate meta the crawler has to guess
 * between. Only operates within <head>, so it can't touch body content
 * (e.g. the language-switcher widget's <a hreflang="de"> links).
 */
function stripLegacyHeadTags(html) {
  const headEndIdx = html.indexOf('</head>');
  if (headEndIdx === -1) return html;

  let head = html.substring(0, headEndIdx);
  const rest = html.substring(headEndIdx);

  head = head.replace(/<link[^>]*rel=["']canonical["'][^>]*>\s*/gi, '');
  head = head.replace(/<link[^>]*rel=["']alternate["'][^>]*hreflang=[^>]*>\s*/gi, '');
  head = head.replace(/<link[^>]*hreflang=[^>]*rel=["']alternate["'][^>]*>\s*/gi, '');
  head = head.replace(/<meta[^>]*(?:property|name)=["'](?:og|twitter):[a-zA-Z:_]+["'][^>]*>\s*/gi, '');
  head = head.replace(/<meta[^>]*name=["']description["'][^>]*>\s*/gi, '');
  head = head.replace(/<meta[^>]*name=["']keywords["'][^>]*>\s*/gi, '');

  return head + rest;
}

function findAllHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findAllHtmlFiles(full, results);
    else if (entry.name === 'index.html') results.push(full);
  }
  return results;
}

// Main execution
console.log('📋 Generating SEO metadata...\n');

console.log('1️⃣  Injecting SEO headers into known pages\n');

// Update HTML files with SEO metadata
let updatedCount = 0;
Object.entries(pageMetadata).forEach(([pagePath, meta]) => {
  const htmlPath = pagePath === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, pagePath.replace(/\/$/, '/index.html'));

  if (!fs.existsSync(htmlPath)) {
    console.log(`   ⚠ ${pagePath} - HTML file not found (skipped)`);
    return;
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');
  html = stripLegacyHeadTags(html);

  // Inject meta tags
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) {
    console.log(`   ⚠ ${pagePath} - No </head> tag found`);
    return;
  }

  const ogTags = generateOpenGraph(pagePath, meta);
  const geoTags = generateGeoTags(meta);
  const structuredData = generateStructuredData(pagePath, meta);

  let injection = '\n\n  <!-- SEO Meta Tags -->\n';
  injection += `  <meta name="description" content="${meta.description}">\n`;
  injection += `  <meta name="keywords" content="${meta.keywords || ''}">\n`;
  injection += `  <meta name="theme-color" content="#1a202c">\n`;
  injection += `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n`;
  injection += `  <link rel="canonical" href="https://virtual-marketer.de${pagePath}">\n`;
  injection += hreflangBlock(pagePath);
  injection += '\n  <!-- Open Graph / Social Media -->\n';
  injection += ogTags + '\n\n';
  injection += '  <!-- Geo Targeting -->\n';
  injection += geoTags + '\n\n';
  injection += '  <!-- Structured Data (JSON-LD) -->\n';
  injection += structuredData.map(schema =>
    `  <script type="application/ld+json">\n  ${JSON.stringify(schema, null, 2)}\n  </script>`
  ).join('\n') + '\n';

  const newHtml = html.substring(0, headEnd) + injection + html.substring(headEnd);
  fs.writeFileSync(htmlPath, newHtml);

  updatedCount++;
  console.log(`   ✓ ${pagePath.padEnd(40)} - Optimized`);
});

// Every other page (legacy blog posts, tag/category/author archives, etc.)
// isn't in the hardcoded pageMetadata map above, but still needs a
// canonical + hreflang set — otherwise it ships with only Yoast's stale
// relative canonical and no international tags at all. Reuses whatever
// <title>/<meta description> the page already has rather than requiring
// per-page copy.
console.log('\n2️⃣  Adding canonical/hreflang to remaining pages\n');

const knownPaths = new Set(Object.keys(pageMetadata).map(p =>
  p === '/' ? path.join(DIST, 'index.html') : path.join(DIST, p.replace(/\/$/, '/index.html'))
));

let lightweightCount = 0;
for (const file of findAllHtmlFiles(DIST)) {
  if (knownPaths.has(file)) continue; // already fully handled above

  let html = fs.readFileSync(file, 'utf-8');
  if (/rel=["']canonical["']/.test(html) && /hreflang=["']x-default["']/.test(html)) {
    continue; // already has its own canonical + hreflang (new blog posts, etc)
  }

  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) continue;

  const relDir = path.relative(DIST, path.dirname(file)).split(path.sep).join('/');
  const pagePath = relDir ? `/${relDir}/` : '/';

  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  const title = titleMatch ? titleMatch[1].trim() : 'Virtual Marketer';
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1] : 'Virtual Marketer - KI-Marketinglösung aus Deutschland.';
  const hasOgImage = /property=["']og:image["']/i.test(html);

  html = stripLegacyHeadTags(html);
  const newHeadEnd = html.indexOf('</head>');

  let injection = '\n\n  <!-- SEO: canonical + hreflang (auto) -->\n';
  injection += `  <meta name="description" content="${description}">\n`;
  injection += `  <link rel="canonical" href="https://virtual-marketer.de${pagePath}">\n`;
  injection += hreflangBlock(pagePath);
  if (!hasOgImage) {
    injection += `  <meta property="og:type" content="article">\n`;
    injection += `  <meta property="og:title" content="${title}">\n`;
    injection += `  <meta property="og:description" content="${description}">\n`;
    injection += `  <meta property="og:image" content="https://virtual-marketer.de/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png">\n`;
  }

  html = html.substring(0, newHeadEnd) + injection + html.substring(newHeadEnd);
  fs.writeFileSync(file, html);
  lightweightCount++;
}
console.log(`   ✓ Added canonical/hreflang to ${lightweightCount} additional page(s)\n`);

console.log(`\n✅ SEO Optimization Complete!\n`);
console.log(`Updated ${updatedCount + lightweightCount} pages with:`);
console.log('  • Meta descriptions');
console.log('  • Open Graph tags (Facebook, LinkedIn)');
console.log('  • Twitter Card metadata');
console.log('  • Schema.org structured data (Organization, Product, etc) on key pages');
console.log('  • Geo-targeting tags (Geo.placename, ICBM, etc)');
console.log('  • Canonical tags');
console.log('  • Hreflang tags\n');

console.log('📊 SEO Improvements:');
console.log('  ✓ Better Google/Bing indexing');
console.log('  ✓ Rich snippets in search results');
console.log('  ✓ Geo-targeted search results (Germany priority)');
console.log('  ✓ Social media preview cards (Twitter, FB, LinkedIn)');
console.log('  ✓ Mobile-friendly structured data\n');

console.log('🔗 Next: Submit sitemap to Google Search Console');
console.log('   https://search.google.com/search-console\n');
