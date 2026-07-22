#!/usr/bin/env node

/**
 * English Site — Core Pages
 *
 * Builds the English-language core of the site under /en/ on the SAME
 * domain (virtual-marketer.de/en/...) — see the architecture note at the
 * top of generate-feature-pages.js for why: virtual-marketer.ai was never
 * registered/DNS-configured, so a path prefix on the live domain ships
 * real, reachable content today instead of hreflang tags pointing at a
 * domain that 404s forever.
 *
 * Scope of this pass: homepage, solutions hub, legal notice, privacy
 * policy, terms of service, FAQ, about, request-a-model and demo-booking
 * pages. NOT included: English translations of the 56 blog posts (14 new
 * + 42 legacy) — that is a separate, much larger content project and is
 * deliberately out of scope here rather than silently skipped without
 * mention (see the PR description).
 *
 * Legal pages preserve the exact facts of their German originals (company
 * name, address, managing directors, sub-processors, the data-residency
 * clause) — translated, not reworded or reinterpreted.
 *
 * Run after scripts/build.js (creates dist/), before
 * scripts/generate-feature-pages.js (which links its cards into the
 * /en/solutions/ hub this script creates).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = 'https://virtual-marketer.de';
const LOGO = '/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png';

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

function header() {
  return `<header class="vm-header-simple">
  <a href="/en/"><img src="${LOGO}" alt="Virtual Marketer" style="height:40px;width:auto;max-width:none"></a>
  <nav>
    <a href="/en/solutions/">Solutions</a>
    <a href="/blog/">Blog</a>
    <a href="http://api.virtual-marketer.de/documentation/">API</a>
    <a href="/en/request-custom-model/">Request a model</a>
    <a href="https://login.virtual-marketer.de/">Login</a>
  </nav>
</header>`;
}

function footer() {
  return `<footer style="max-width:1140px;margin:64px auto 0;padding:24px 20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:14px;">
  &copy; 2026 SGS Virtual Marketer GmbH &middot;
  <a href="/en/privacy-policy/">Privacy Policy</a> &middot;
  <a href="/en/legal-notice/">Legal Notice</a> &middot;
  <a href="/en/terms-of-service/">Terms of Service</a>
</footer>`;
}

const BASE_CSS = `
  :root{
    --vm-red:#94152b; --vm-red-dark:#700f2b; --vm-blue:#66a3ce; --vm-blue-light:#a3cce9;
    --vm-gray-100:#f4f1f1; --vm-gray-200:#e7dfe0; --vm-gray-500:#6b5f60; --vm-gray-900:#241417;
  }
  .vm-en *{box-sizing:border-box;}
  .vm-en{max-width:900px;margin:0 auto;padding:48px 20px 96px;color:var(--vm-gray-900);line-height:1.65;font-size:16px;}
  .vm-en h1{font-size:36px;line-height:1.15;margin:0 0 12px;letter-spacing:-.01em;}
  .vm-en h2{font-size:22px;margin:40px 0 14px;}
  .vm-en h3{font-size:17px;margin:26px 0 8px;}
  .vm-en p{margin:0 0 14px;color:#4a4143;}
  .vm-en ul,.vm-en ol{margin:0 0 14px;padding-left:22px;color:#4a4143;}
  .vm-en li{margin-bottom:6px;}
  .vm-en a{color:var(--vm-red);}
  .vm-en .eyebrow{display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--vm-red);background:#fbecee;padding:5px 12px;border-radius:999px;margin-bottom:16px;}
  .vm-en .lede{font-size:18px;color:#4a4143;max-width:62ch;}
  .vm-en .btn{display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:13px 26px;border-radius:8px;text-decoration:none;background:var(--vm-red);color:#fff;margin-top:8px;}
  .vm-en .btn:hover{background:var(--vm-red-dark);}
  .vm-en .card{background:#fff;border:1px solid var(--vm-gray-200);border-radius:14px;padding:22px;margin-bottom:14px;}
  .vm-en .fact{background:var(--vm-gray-100);border-radius:10px;padding:16px 18px;font-size:15px;}
`;

function pageShell({ titleTag, description, keywords, path: urlPath, bodyHtml, jsonLd }) {
  const url = `${BASE_URL}${urlPath}`;
  const dePath = urlPath.replace(/^\/en/, '') || '/';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleTag} | Virtual Marketer</title>
<meta name="description" content="${description}">
${keywords ? `<meta name="keywords" content="${keywords}">\n` : ''}<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="de" href="${BASE_URL}${dePath}">
<link rel="alternate" hreflang="x-default" href="${BASE_URL}${dePath}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="Virtual Marketer">
<meta property="og:title" content="${titleTag}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n` : ''}<link rel="stylesheet" href="/${THEME_CSS.bootstrap}">
<link rel="stylesheet" href="/${THEME_CSS.fontAwesome}">
<link rel="stylesheet" href="/${THEME_CSS.style}">
<style>${BASE_CSS}</style>
</head>
<body class="vm-static-blog">
${header()}
<main class="vm-en">
${bodyHtml}
</main>
${footer()}
</body>
</html>`;
}

function write(urlPath, html) {
  const outDir = path.join(DIST, ...urlPath.split('/').filter(Boolean));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

function main() {
  console.log('\n🇬🇧 Generating English core pages...\n');

  // Homepage — clean, purpose-built page (not a translation of the legacy
  // Elementor homepage export, which is WordPress-plugin markup that can't
  // be meaningfully "translated" by editing HTML; same approach already
  // used for the DE feature pages).
  write('/en/', pageShell({
    titleTag: 'Virtual Marketer — AI Marketing Solutions from Germany',
    description: 'Custom AI models for product descriptions, product photos, AI agents, coding and more — reliable, automated, efficient. Made in Germany.',
    keywords: 'AI marketing, generative AI, custom AI models, marketing automation, Germany',
    path: '/en/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Virtual Marketer',
      legalName: 'SGS Virtual Marketer GmbH',
      foundingDate: '2022',
      url: `${BASE_URL}/en/`,
      logo: `${BASE_URL}${LOGO}`,
    },
    bodyHtml: `
<span class="eyebrow">Made in Germany</span>
<h1>Reliable. Automated. Efficient. The AI marketing solution from Germany.</h1>
<p class="lede">Virtual Marketer trains custom AI models on your brand voice and puts them to work across product descriptions, product photography, marketing campaigns, coding and autonomous AI agents.</p>
<a class="btn" href="/virtual-marketer-demo/">Book a demo</a>

<h2>What Virtual Marketer does</h2>
<div class="card"><strong>AI Agents</strong> — specialist virtual employees for analytics, Google Ads, Meta Ads, SEO and customer care. <a href="/en/solutions/ai-agents/">Learn more &rarr;</a></div>
<div class="card"><strong>AI Product Photos &amp; Virtual Try-On</strong> — professional on-model shots and product videos from a single photo. <a href="/en/solutions/ai-product-photos/">Learn more &rarr;</a></div>
<div class="card"><strong>Coding API &amp; MCP Server</strong> — Virtual Marketer Senior &amp; Junior in your IDE, one flat balance. <a href="/en/solutions/coding-api/">Learn more &rarr;</a></div>
<div class="card"><strong>AI Feed Enhance</strong> — enrich and publish shopping feeds for Google, Meta and Bing. <a href="/en/solutions/feed-enhance/">Learn more &rarr;</a></div>
<p><a href="/en/solutions/">See all 11 AI solutions &rarr;</a></p>

<h2>Why Virtual Marketer</h2>
<ul>
  <li><strong>API-first &amp; flexible</strong> — every product is usable programmatically, not locked behind a single UI.</li>
  <li><strong>Unique, brand-trained models</strong> — not a generic prompt wrapper; your own AI models learn your brand voice.</li>
  <li><strong>German company</strong> — SGS Virtual Marketer GmbH, founded 2022, based in Bad Homburg, Germany.</li>
  <li><strong>Seamless integration</strong> — connects to your existing tools, ad platforms and data sources.</li>
</ul>

<h2>Ready to see it in action?</h2>
<p>Book a free, no-obligation demo and see Virtual Marketer live.</p>
<a class="btn" href="/virtual-marketer-demo/">Book a demo</a>`,
  }));

  // Solutions hub — the feature-page grid gets injected here by
  // generate-feature-pages.js (looks for <h2 id="vmaf-heading-en">).
  write('/en/solutions/', pageShell({
    titleTag: 'AI Solutions | Virtual Marketer',
    description: 'AI agents, coding API, product photos, feed enrichment, text/image/video generation and more — all Virtual Marketer AI solutions at a glance.',
    keywords: 'AI solutions, AI agents, AI product photos, feed optimization, custom AI, marketing automation',
    path: '/en/solutions/',
    bodyHtml: `
<span class="eyebrow">AI Solutions</span>
<h1>Custom AI Solutions</h1>
<p class="lede">Every Virtual Marketer product below is real and shipped today. Pick a solution to see who it's for, what it costs to solve the problem manually, and a live interactive demo.</p>
<h2 id="vmaf-heading-en">All Solutions</h2>`,
  }));

  // Legal Notice — facts must exactly match dist/impressum/ (company name,
  // address, managing directors, contact). This is a translation of those
  // facts, not new content.
  write('/en/legal-notice/', pageShell({
    titleTag: 'Legal Notice',
    description: 'Legal notice (Impressum) of SGS Virtual Marketer GmbH.',
    path: '/en/legal-notice/',
    bodyHtml: `
<span class="eyebrow">Legal Notice</span>
<h1>Legal Notice</h1>
<h2>Service Provider</h2>
<p class="fact">SGS Virtual Marketer GmbH<br>
Frankfurter Landstr. 50<br>
61352 Bad Homburg, Germany<br><br>
Represented by managing directors Jens Göckus and Lisa Stamminger</p>

<h2>Contact</h2>
<p>Email: <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a></p>

<h2>Liability Disclaimer</h2>
<p>The content of this website has been prepared with care and to the best of our knowledge. It is provided for informational purposes only and does not constitute a legally binding commitment, except where legally mandated information is concerned (e.g. this legal notice, the privacy policy, terms of service, or mandatory consumer disclosures). We reserve the right to change or remove content in whole or in part, provided that any contractual obligations remain unaffected. All offers are subject to change and non-binding.</p>

<p><em>This page is a translation of the German-language legal notice at <a href="/impressum/">/impressum/</a>, which remains the authoritative version for legal purposes.</em></p>`,
  }));

  // Privacy Policy — same substantive disclosures as the German original:
  // controller identity, AI sub-processors (a GDPR disclosure requirement,
  // not marketing copy — the CLAUDE.md "never name the AI vendor" rule
  // applies to product/feature marketing, not to this legally required
  // processor disclosure), the EU AI Act compliance statement, and the
  // data-residency clause added to the German page in this same project.
  write('/en/privacy-policy/', pageShell({
    titleTag: 'Privacy Policy',
    description: 'Privacy policy of SGS Virtual Marketer GmbH — what data we process, where it is stored, and your rights under the GDPR.',
    path: '/en/privacy-policy/',
    bodyHtml: `
<span class="eyebrow">Privacy Policy</span>
<h1>Privacy Policy</h1>
<p class="lede">This page explains what personal data Virtual Marketer processes, why, and what rights you have under the GDPR. It is a translation of the authoritative German-language <a href="/datenschutzerklaerung/">Datenschutzerklärung</a>.</p>

<h2>Controller</h2>
<p class="fact">SGS Virtual Marketer GmbH<br>Frankfurter Landstr. 50<br>61352 Bad Homburg, Germany<br>Email: <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a></p>

<h2>What data we process</h2>
<p>We process personal data you provide directly (e.g. via contact forms, demo bookings or account registration), technical data generated by using our website and products (e.g. server logs, cookies), and data you submit to our AI products for processing on your behalf (e.g. product data for text/image generation).</p>

<h2>AI processing &amp; sub-processors</h2>
<p>SGS Virtual Marketer GmbH is committed to complying with the requirements of the EU AI Act in the development, provision and operation of its AI-as-a-Service (AIaaS) solutions. Computation for SGS Virtual Marketer GmbH's software solutions runs on servers leased from <strong>Strato AG</strong>, which provides the necessary computing resources.</p>
<p>For model development and the operation of our AIaaS solutions, we may additionally use cloud services from <strong>Microsoft Azure</strong>, <strong>Google Cloud</strong>, <strong>OpenAI</strong> and <strong>HuggingFace</strong> to ensure optimal computing performance and scalability.</p>

<h2>Storage and processing location</h2>
<p>The exact storage and processing location of personal data is determined individually per contractual agreement. Upon request and by separate agreement, SGS Virtual Marketer GmbH will process and store customer data exclusively in Germany or in other data centers within the EU/EEA. Absent such a separate agreement, SGS Virtual Marketer GmbH selects a cost-efficient processing location; any transfers to third countries are always carried out in accordance with legal requirements (including Standard Contractual Clauses under Art. 46 GDPR).</p>

<h2>Your rights under the GDPR</h2>
<ul>
  <li>Right of access to your personal data (Art. 15 GDPR)</li>
  <li>Right to rectification of inaccurate data (Art. 16 GDPR)</li>
  <li>Right to erasure (Art. 17 GDPR)</li>
  <li>Right to restriction of processing (Art. 18 GDPR)</li>
  <li>Right to data portability (Art. 20 GDPR)</li>
  <li>Right to object to processing (Art. 21 GDPR)</li>
  <li>Right to lodge a complaint with a supervisory authority</li>
</ul>

<h2>Contact</h2>
<p>For any privacy-related request, contact us at <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a>.</p>

<p><em>This page is a translation of the German-language privacy policy at <a href="/datenschutzerklaerung/">/datenschutzerklaerung/</a>, which remains the authoritative version for legal purposes.</em></p>`,
  }));

  // Terms of Service
  write('/en/terms-of-service/', pageShell({
    titleTag: 'Terms of Service',
    description: 'Terms of service for using the Virtual Marketer platform and services.',
    path: '/en/terms-of-service/',
    bodyHtml: `
<span class="eyebrow">Terms of Service</span>
<h1>Terms of Service</h1>
<p class="lede">These terms govern the use of the Virtual Marketer platform and services offered by SGS Virtual Marketer GmbH ("we", "us").</p>

<h2>Scope</h2>
<p>These terms apply to all services provided by SGS Virtual Marketer GmbH, including but not limited to AI text, image and video generation, AI agents, the coding API, and feed enrichment tools.</p>

<h2>Usage</h2>
<p>Access to paid features is billed according to the word/usage budget associated with your plan. You are responsible for reviewing AI-generated output before publishing it, and for ensuring your use of our services complies with applicable law.</p>

<h2>Availability</h2>
<p>We aim for high availability but do not guarantee uninterrupted access. Scheduled maintenance will be communicated where reasonably possible.</p>

<h2>Liability</h2>
<p>Our liability is limited to the extent permitted by applicable German law. We are not liable for indirect damages arising from the use of AI-generated content that was not reviewed before publication.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of the Federal Republic of Germany.</p>

<p><em>This page is a translation of the German-language terms at <a href="/nutzungsbedingungen/">/nutzungsbedingungen/</a>, which remains the authoritative version for legal purposes.</em></p>`,
  }));

  // FAQ
  write('/en/faqs/', pageShell({
    titleTag: 'Frequently Asked Questions',
    description: 'Answers to common questions about Virtual Marketer: fit for your business, onboarding time, and pricing.',
    path: '/en/faqs/',
    bodyHtml: `
<span class="eyebrow">FAQ</span>
<h1>Frequently Asked Questions</h1>

<h3>How do I know if Virtual Marketer is a fit for my business?</h3>
<p>Virtual Marketer is built for companies that need AI-generated marketing content, imagery, or automation at scale — from single product descriptions to full campaigns. Book a demo and we'll walk through your specific use case together.</p>

<h3>How long does onboarding take?</h3>
<p>Most customers are generating their first content within the same session as their demo. Custom-trained brand models and more complex integrations (feed sources, agent connectors) typically take a few days to set up properly.</p>

<h3>What does it cost?</h3>
<p>Virtual Marketer is tailored to your business &#8211; from the number of custom AI models to your monthly word allowance and included strategy coaching sessions. Since cost depends on your specific needs, we're happy to put together an individual offer. Simply book a no-obligation demo or contact us directly.</p>

<h3>Where is my data stored?</h3>
<p>The exact storage and processing location is contractually configurable &#8211; on request, we process and store data exclusively in Germany or elsewhere in the EU/EEA. See our <a href="/en/privacy-policy/">Privacy Policy</a> for details.</p>

<h3>Do you name which AI models power your products?</h3>
<p>We use Virtual Marketer product language throughout &#8211; our two model tiers are Virtual Marketer Senior and Virtual Marketer Junior. This lets us optimize and swap underlying technology over time without disrupting how you use the product.</p>`,
  }));

  // About / Management
  write('/en/about/', pageShell({
    titleTag: 'About Us',
    description: 'Meet the team behind Virtual Marketer — the AI marketing solution from Germany.',
    path: '/en/about/',
    bodyHtml: `
<span class="eyebrow">About Us</span>
<h1>About Virtual Marketer</h1>
<p class="lede">Virtual Marketer was founded in 2022 (registered 2023) on the belief that digital marketing processes can be decisively improved through intelligent automation. We build custom AI models for the German and European market, and have steadily expanded from text generation into a full AI marketing suite.</p>

<h2>Our journey</h2>
<p><strong>Getting started: text generation &amp; conversion.</strong> We began with AI-powered product description optimization and conversion-rate improvements &#8211; the foundation for an efficient digital presence.</p>
<p><strong>Going deeper: technical SEO.</strong> We then built advanced technical SEO tooling to further maximize the visibility and performance of digital content.</p>
<p><strong>Interactive engagement: chat &amp; search.</strong> We laid the groundwork for interactive customer experiences with intelligent chat assistants and powerful product search.</p>
<p><strong>Personalization: recommendation engines.</strong> Smart recommendation systems enabled deeper personalization to address customer needs precisely.</p>
<p><strong>Shaping the future: AI agents &amp; voice bots.</strong> We're now building highly capable AI agents and advanced voice bots that help businesses shape their digital future and strengthen their market position.</p>

<h2>Management</h2>
<div class="card"><strong>Jens Göckus</strong> &mdash; CTO / CEO. A passionate software developer who has built countless AI applications beyond Virtual Marketer, and a specialist in microservice architecture, web applications, databases and cloud technologies (particularly AWS).</div>
<div class="card"><strong>Lisa Stamminger</strong> &mdash; CEO and Head of People and Design.</div>

<p><em>This page reflects the same company facts as the German-language <a href="/management/">Management page</a>.</em></p>`,
  }));

  // Request a custom model
  write('/en/request-custom-model/', pageShell({
    titleTag: 'Request a Custom AI Model',
    description: 'Request a new AI model or a modification to an existing one from the Virtual Marketer data science team.',
    path: '/en/request-custom-model/',
    bodyHtml: `
<span class="eyebrow">Custom Models</span>
<h1>Request a Custom AI Model</h1>
<p class="lede">Please describe the AI model you'd like us to build or modify below. If you need additional support, you can <a href="/virtual-marketer-demo/">book a call here</a> or reach us at <a href="mailto:info@virtual-marketer.de">info@virtual-marketer.de</a>.</p>

<h2>Two ways we can help</h2>
<h3>1. Request a new model</h3>
<p>Have a specific requirement or problem you'd like to solve with AI? Our team can build custom AI models tailored precisely to your needs &#8211; whether that's customer behavior, product forecasting, or process optimization.</p>
<h3>2. Adjust an existing model</h3>
<p>Already have AI models in production that could be optimized or adapted for new requirements? Our experienced data scientists can review, tune and extend existing models to make sure they keep delivering maximum value for your business.</p>

<p>Book your free strategy call today and let's discuss your goals.</p>
<a class="btn" href="/virtual-marketer-demo/">Book a demo</a>`,
  }));

  // Demo booking landing
  write('/en/demo/', pageShell({
    titleTag: 'Book a Demo',
    description: 'Book a no-obligation demo and see Virtual Marketer live in action.',
    path: '/en/demo/',
    bodyHtml: `
<span class="eyebrow">Demo</span>
<h1>Book a Demo</h1>
<p class="lede">See Virtual Marketer live &#8211; your AI marketing solution from Germany. Reach out and we'll set up a time that works for you.</p>
<a class="btn" href="mailto:info@virtual-marketer.de">Contact us to schedule</a>`,
  }));

  console.log('  ✓ /en/ (homepage)');
  console.log('  ✓ /en/solutions/ (hub)');
  console.log('  ✓ /en/legal-notice/');
  console.log('  ✓ /en/privacy-policy/');
  console.log('  ✓ /en/terms-of-service/');
  console.log('  ✓ /en/faqs/');
  console.log('  ✓ /en/about/');
  console.log('  ✓ /en/request-custom-model/');
  console.log('  ✓ /en/demo/');
  console.log('\n✅ English core pages generated (blog post translation not included — see script header)\n');
}

main();
