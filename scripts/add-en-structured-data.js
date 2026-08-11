#!/usr/bin/env node

/**
 * English Structured Data
 *
 * Every German core page carries a JSON-LD graph (WebPage + BreadcrumbList +
 * WebSite + Organization) injected by scripts/seo-optimize.js, but nine of
 * their English counterparts shipped with no structured data at all — that
 * script's per-page table is keyed on the German paths, and the English
 * pages fall through its generic branch, which only writes canonical,
 * hreflang and og: tags.
 *
 * The gap matters more than it looks. Structured data is how a page states
 * what kind of thing it is in a form a machine does not have to guess at,
 * and it is disproportionately load-bearing for answer engines deciding
 * whether a page is a credible source for a question. Leaving the English
 * half of a bilingual site without it means the EN pages compete with one
 * hand tied behind their back, and it makes the two languages look like
 * different-quality properties to a crawler.
 *
 * The Organization and WebSite nodes are copied from the German graph rather
 * than re-stated, so the company facts (legal name, logo, founding date)
 * have exactly one source of truth. They keep the same @id as the German
 * nodes on purpose: it is one organisation and one website, described in two
 * languages, and reusing the @id is what tells a consumer that. Only
 * inLanguage and the page-level nodes differ.
 *
 * Run after scripts/seo-optimize.js, so the canonical/hreflang tags this
 * references are already in place.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const BASE_URL = 'https://virtual-marketer.de';
const LOGO = `${BASE_URL}/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png`;

// Page type + breadcrumb label per English path. CollectionPage for the
// solutions hub (it lists other pages), AboutPage for the team page, to
// mirror what the German /ki-loesungen/ and /management/ declare.
//
// /en/about/ was ProfilePage and is not one. Search Console flagged the
// German twin as a profile page missing the mandatory mainEntity field —
// mandatory because ProfilePage means a page about ONE person or
// organization and the markup has to say which. The team page names three
// people plus an extended team, so there is no single entity to point at.
// AboutPage is what it is, and needs no mainEntity.
const PAGES = {
  '/en/': { type: 'WebPage', crumb: 'Home' },
  '/en/solutions/': { type: 'CollectionPage', crumb: 'Solutions' },
  '/en/about/': { type: 'AboutPage', crumb: 'About' },
  '/en/demo/': { type: 'WebPage', crumb: 'Book a demo' },
  '/en/faqs/': { type: 'WebPage', crumb: 'FAQs' },
  '/en/contact/': { type: 'ContactPage', crumb: 'Contact' },
  '/en/request-custom-model/': { type: 'WebPage', crumb: 'Request a custom model' },
  '/en/legal-notice/': { type: 'WebPage', crumb: 'Legal notice' },
  '/en/privacy-policy/': { type: 'WebPage', crumb: 'Privacy policy' },
  '/en/terms-of-service/': { type: 'WebPage', crumb: 'Terms of service' },
};

function decodeEntities(s) {
  return s
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function graphFor(urlPath, { type, crumb }, title, description) {
  const url = `${BASE_URL}${urlPath}`;
  const isHome = urlPath === '/en/';

  const itemList = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/en/` }];
  if (!isHome) itemList.push({ '@type': 'ListItem', position: 2, name: crumb, item: url });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': type,
        '@id': `${url}#webpage`,
        url,
        name: title,
        description,
        inLanguage: 'en',
        isPartOf: { '@id': `${BASE_URL}/#website` },
        about: { '@id': `${BASE_URL}/#organization` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: itemList },
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        url: `${BASE_URL}/`,
        name: 'Virtual Marketer',
        description: 'Translating Ideas into Success',
        publisher: { '@id': `${BASE_URL}/#organization` },
        inLanguage: 'en',
      },
      {
        '@type': 'Organization',
        '@id': `${BASE_URL}/#organization`,
        name: 'Virtual Marketer',
        legalName: 'SGS Virtual Marketer GmbH',
        foundingDate: '2022',
        url: `${BASE_URL}/`,
        logo: {
          '@type': 'ImageObject',
          '@id': `${BASE_URL}/#/schema/logo/image/`,
          url: LOGO,
          contentUrl: LOGO,
          width: 500,
          height: 500,
          caption: 'SGS Virtual Marketer GmbH',
        },
        image: { '@id': `${BASE_URL}/#/schema/logo/image/` },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'Sales',
          email: 'info@virtual-marketer.de',
        },
      },
    ],
  };
}

function main() {
  console.log('\n🧩 Adding structured data to English pages...\n');

  let added = 0;
  let skipped = 0;

  for (const [urlPath, meta] of Object.entries(PAGES)) {
    const file = path.join(DIST, urlPath.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(file)) {
      console.log(`   – ${urlPath} — not built, skipped`);
      continue;
    }

    let html = fs.readFileSync(file, 'utf-8');
    if (/application\/ld\+json/i.test(html)) {
      skipped++;
      continue; // already has its own graph — don't compete with it
    }

    const title = decodeEntities(((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim());
    const description = decodeEntities(
      ((html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '').trim()
    );

    const json = JSON.stringify(graphFor(urlPath, meta, title, description), null, 2);
    const block = `\n  <script type="application/ld+json">\n${json}\n  </script>\n`;

    const headEnd = html.search(/<\/head>/i);
    if (headEnd === -1) continue;

    html = html.slice(0, headEnd) + block + html.slice(headEnd);
    fs.writeFileSync(file, html);
    console.log(`   • ${urlPath} — ${meta.type}`);
    added++;
  }

  console.log(`\n✅ ${added} English page(s) given a JSON-LD graph (${skipped} already had one)`);

  /*
   * Site-wide guard: a ProfilePage without mainEntity is a critical error.
   *
   * Google requires mainEntity on ProfilePage — it is the field that says
   * whose profile the page is — and without it the page is dropped from the
   * enhancement entirely. That is what Search Console reported here.
   *
   * The failure mode is what makes this worth a build check rather than a
   * one-off fix: nothing breaks visibly, the page renders fine, and the only
   * signal is an email from Search Console weeks later. Anyone reintroducing
   * ProfilePage should find out in the build instead.
   */
  const offenders = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(full, 'utf-8');
      if (!html.includes('ProfilePage')) continue;

      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        let data;
        try { data = JSON.parse(m[1]); } catch { continue; }
        const nodes = data['@graph'] || [data];
        for (const node of nodes) {
          if (node && node['@type'] === 'ProfilePage' && !node.mainEntity) {
            offenders.push('/' + path.relative(DIST, full).split(path.sep).join('/').replace(/index\.html$/, ''));
          }
        }
      }
    }
  })(DIST);

  if (offenders.length) {
    console.log(`   ⚠ ${offenders.length} page(s) declare ProfilePage without the required mainEntity:`);
    [...new Set(offenders)].slice(0, 5).forEach((p) => console.log(`       ${p}`));
    console.log('     Either give it a mainEntity, or use the type the page actually is');
    console.log('     (AboutPage for a team page, WebPage otherwise).');
    process.exitCode = 1;
  } else {
    console.log('   ✓ no ProfilePage ships without a mainEntity');
  }
  console.log('');
}

main();
