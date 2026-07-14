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
    description: 'Custom KI Modelle für E-Commerce, Retail, Universitäten. Text Generation, Interaktive Lösungen, CSS Price Comparison.',
    keywords: 'KI Lösungen, Custom AI, Marketing Automation, Deutschland',
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
    description: 'Impressum und Kontaktinformation von Virtual Marketer GmbH.',
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
 * Generate sitemap.xml
 */
function generateSitemap() {
  const baseUrl = 'https://virtual-marketer.de';
  const now = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '         xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  // Add pages
  Object.entries(pageMetadata).forEach(([path, meta]) => {
    const priority = path === '/' ? 1.0 : 0.8;
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${path}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    if (meta.image) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${baseUrl}${meta.image}</image:loc>\n`;
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  });

  xml += '</urlset>';

  return xml;
}

/**
 * Generate updated robots.txt with sitemap
 */
function generateRobotsTxt() {
  return `# Virtual Marketer - robots.txt
User-agent: *
Allow: /
Disallow: /wp-admin/
Disallow: /wp-login.php
Disallow: /wp-includes/
Disallow: /wp-content/plugins/
Disallow: /wp-json/

Crawl-delay: 0

Sitemap: https://virtual-marketer.de/sitemap.xml
Sitemap: https://virtual-marketer.de/sitemap_index.xml

# Google-specific
User-agent: Googlebot
Allow: /

User-agent: Googlebot-Image
Allow: /wp-content/uploads/

# Search engines
User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /
`;
}

/**
 * Generate sitemap index for Google News, Images, etc.
 */
function generateSitemapIndex() {
  const baseUrl = 'https://virtual-marketer.de';
  const now = new Date().toISOString().split('T')[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;
}

// Main execution
console.log('📋 Generating SEO metadata...\n');

// Create sitemaps
console.log('1️⃣  Creating sitemap.xml');
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), generateSitemap());
console.log('   ✓ sitemap.xml generated');

console.log('2️⃣  Creating sitemap_index.xml');
fs.writeFileSync(path.join(DIST, 'sitemap_index.xml'), generateSitemapIndex());
console.log('   ✓ sitemap_index.xml generated');

console.log('3️⃣  Updating robots.txt');
fs.writeFileSync(path.join(DIST, 'robots.txt'), generateRobotsTxt());
console.log('   ✓ robots.txt updated with sitemaps\n');

console.log('4️⃣  Injecting SEO headers into HTML pages\n');

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
  injection += `  <link rel="alternate" hreflang="de" href="https://virtual-marketer.de${pagePath}">\n`;
  injection += `  <link rel="alternate" hreflang="x-default" href="https://virtual-marketer.de${pagePath}">\n\n`;
  injection += '  <!-- Open Graph / Social Media -->\n';
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

console.log(`\n✅ SEO Optimization Complete!\n`);
console.log(`Updated ${updatedCount} pages with:`);
console.log('  • Meta descriptions');
console.log('  • Open Graph tags (Facebook, LinkedIn)');
console.log('  • Twitter Card metadata');
console.log('  • Schema.org structured data (Organization, Product, etc)');
console.log('  • Geo-targeting tags (Geo.placename, ICBM, etc)');
console.log('  • Canonical tags');
console.log('  • Hreflang tags');
console.log('  • Dynamic sitemaps\n');

console.log('📊 SEO Improvements:');
console.log('  ✓ Better Google/Bing indexing');
console.log('  ✓ Rich snippets in search results');
console.log('  ✓ Geo-targeted search results (Germany priority)');
console.log('  ✓ Social media preview cards (Twitter, FB, LinkedIn)');
console.log('  ✓ Mobile-friendly structured data\n');

console.log('🔗 Next: Submit sitemap to Google Search Console');
console.log('   https://search.google.com/search-console\n');
