#!/usr/bin/env node

/**
 * Fills the length gaps scripts/fix-page-titles.js and
 * scripts/fix-meta-descriptions.js deliberately leave alone, plus the one
 * page whose whole indexability was in question: /login/.
 *
 * WHAT THE OTHER TWO SCRIPTS ALREADY OWN, AND WHY THIS ONE DOESN'T REDO IT:
 * fix-page-titles.js already shortens any <title> over its own MAX_TITLE
 * (65 chars, see lib/title-cleanup.js) wherever a topic-bearing clause
 * boundary exists, and explicitly reports the rest for a human. Measuring
 * dist/ directly (237 indexable pages) after that script has run finds:
 *
 *   - 10 titles still over 65 chars — exactly the ones its own header says
 *     it cannot fix mechanically (no viable clause boundary, or the split
 *     halves score equally and neither reads as a real search query).
 *   - 13 titles under 30 chars — nothing upstream ever pads a short title;
 *     this both undersells the page in the SERP and, for five blog posts,
 *     is a title that only used the "hook" half of a longer sentence
 *     because lib/title-cleanup.js's clause-picker correctly favours
 *     whichever half carries more topic vocabulary, not whichever is
 *     longer (see pickClause()'s own header) — a different, legitimate
 *     objective that just happens to produce a short result here.
 *   - 4 meta descriptions under 70 chars (fix-meta-descriptions.js only
 *     trims long ones and rewrites duplicates, never pads a short one).
 *
 * None of these 27 can be fixed by a general rule without either inventing
 * facts or keyword-stuffing — each is hand-reviewed below (CURATED_FIXES),
 * sourced only from copy already on that same page (its own <h1>, meta
 * description, or body text), never new claims. Every entry keeps that
 * page's existing brand-suffix convention (" - Virtual Marketer" on legacy
 * WordPress pages, " | Virtual Marketer" on generated ones — blog posts
 * carry no suffix at all, matching fix-page-titles.js's own convention).
 *
 * PAGINATION TITLES: separately, and mechanically (no hand-review needed —
 * this one's a plain rule already proven at /blog/page/2/, whose title is
 * "Blog – Seite 2 | Virtual Marketer"), any indexable .../page/N/ (N ≥ 2)
 * page missing a page-number marker in its title gets " – Seite N" (DE) or
 * " – page N" (EN) inserted before the brand suffix. This is what was left
 * undone on the blog CATEGORY archives specifically — /blog/kategorie/…/
 * and /en/blog/category/…/ paginate but, unlike /blog/page/N/, their
 * generator never varied the title per page, which is the direct cause of
 * 4 of the 5 duplicate-title groups the sweep found (Archiv ×4, Regulierung
 * & Compliance ×2, Use Cases ×4, AI Trends ×2). The fifth group — "SEO" on
 * both /blog/kategorie/seo/ and /en/blog/category/seo/ — is two page-ONE
 * archives in different languages that happen to translate to the same
 * short label; there is no page number to append, and giving the two
 * languages distinct wording is exactly what CURATED_FIXES already does for
 * both (they needed lengthening anyway, being under 30 chars).
 *
 * /login/: the sweep flagged a missing H1, but the prior step in this same
 * sweep (scripts/generate-sitemap.js) already answered the more basic
 * question — is this page indexable at all? No: it is a real, reachable
 * account-login gate, not indexable content, and generate-sitemap.js already
 * excludes it from sitemap.xml and no longer disallows crawling it in
 * robots.txt (so a crawler can actually reach the tag below). Coherent with
 * that, this script sets `noindex, follow` here instead of adding an H1 to a
 * page that was never meant to rank — inventing on-page heading copy for a
 * login form is the wrong fix for a page that should not be indexed in the
 * first place.
 *
 * Run right after fix-meta-descriptions.js (this needs its trimming and
 * duplicate-rewrite done first, so a title/description this script inspects
 * is already final) and before enrich-structured-data.js, whose breadcrumb
 * leaf names read the <title> this script may still shorten or lengthen.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function canonicalPath(html) {
  const m = html.match(/<link rel="canonical" href="https:\/\/virtual-marketer\.de(\/[^"]*)"/);
  return m ? m[1] : null;
}

function currentTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  return m ? decodeEntities(m[1]) : null;
}

function currentDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return m ? decodeEntities(m[1]) : null;
}

function setMeta(html, tagRe, value) {
  return html.replace(tagRe, (tag) => tag.replace(/content=(["'])[\s\S]*?\1/i, `content="${escapeAttr(value)}"`));
}

function applyTitle(html, newTitle) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(newTitle)}</title>`);
  next = setMeta(next, /<meta[^>]+property=["']og:title["'][^>]*>/i, newTitle);
  next = setMeta(next, /<meta[^>]+name=["']twitter:title["'][^>]*>/i, newTitle);
  return next;
}

function applyDescription(html, newDescription) {
  let next = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeAttr(newDescription)}">`);
  next = setMeta(next, /<meta[^>]+property=["']og:description["'][^>]*>/i, newDescription);
  next = setMeta(next, /<meta[^>]+name=["']twitter:description["'][^>]*>/i, newDescription);
  return next;
}

// --- Hand-reviewed fixes ---------------------------------------------------
//
// `old` is the exact current (decoded) text this was verified against —
// applied only if the page still carries it, so a page changed by an
// upstream script since this was written is left alone and reported rather
// than silently overwritten with stale copy. Every `title`/`description`
// below was drafted from that same page's own <h1>, existing meta
// description, or body copy — nothing here introduces a new claim.
const CURATED_FIXES = {
  // --- short titles (<30 chars) ---
  '/faqs/': {
    title: { old: 'FAQs - Virtual Marketer', new: 'FAQs zu Kosten & Onboarding - Virtual Marketer' },
  },
  '/kontakt/': {
    title: { old: 'Kontakt | Virtual Marketer', new: 'Kontaktformular & E-Mail | Virtual Marketer' },
  },
  '/en/contact/': {
    title: { old: 'Contact | Virtual Marketer', new: 'Contact Form & Email | Virtual Marketer' },
  },
  '/en/about/': {
    title: { old: 'About Us | Virtual Marketer', new: 'About Our Team | Virtual Marketer' },
  },
  '/impressum/': {
    title: { old: 'Impressum - Virtual Marketer', new: 'Impressum - SGS Virtual Marketer GmbH' },
    description: {
      old: 'Impressum und Kontaktinformation von SGS Virtual Marketer GmbH.',
      new: 'Impressum und Kontaktinformation von SGS Virtual Marketer GmbH: Anschrift, Geschäftsführung und Registereintrag.',
    },
  },
  '/management/': {
    title: { old: 'Management - Virtual Marketer', new: 'Management-Team - Virtual Marketer' },
  },
  '/blog/kategorie/seo/': {
    title: { old: 'SEO | Virtual Marketer Blog', new: 'SEO-Artikel & Analysen | Virtual Marketer Blog' },
  },
  '/en/blog/category/seo/': {
    title: { old: 'SEO | Virtual Marketer Blog', new: 'SEO Articles & Analysis | Virtual Marketer Blog' },
  },
  '/blog/der-schluessel-zum-erfolgreichen-targeting-ki-gestuetzte-kundenanalyse/': {
    title: { old: 'KI-gestützte Kundenanalyse', new: 'Erfolgreiches Targeting durch KI-gestützte Kundenanalyse' },
  },
  '/blog/maschinelles-lernen-verstehen-einfuehrung-grundlagen-und-praktische-anwendungen-im-taeglichen-leben/': {
    title: { old: 'Maschinelles Lernen verstehen', new: 'Maschinelles Lernen: Grundlagen und Anwendungen' },
  },
  '/en/blog/multimodale-ki-die-zukunft-des-verstaendnisses-von-text-bild-und-ton/': {
    title: { old: 'The Rise of Multimodal AI', new: 'Multimodal AI: Understanding Text, Image & Sound' },
  },
  '/en/blog/die-zukunft-der-marktforschung-ki-gesteuerte-insights-fuer-fortschrittliche-geschaeftsstrategien/': {
    title: { old: 'The Future of Market Research', new: 'The Future of Market Research: AI-Driven Insights' },
  },
  '/en/blog/revolution-im-e-mail-marketing-wie-ki-die-kundenkommunikation-optimiert/': {
    title: { old: 'Revolution in Email Marketing', new: 'Email Marketing: How AI Optimizes Communication' },
  },

  // --- titles still over 65 chars after fix-page-titles.js ---
  '/blog/vom-chaos-zur-effizienz-wie-automatisierte-lagerverwaltung-den-e-commerce-logistikbetrieb-revolutioniert/': {
    title: {
      old: 'Vom Chaos zur Effizienz: Wie automatisierte Lagerverwaltung den E-Commerce-Logistikbetrieb revolutioniert',
      new: 'Automatisierte Lagerverwaltung im E-Commerce',
    },
  },
  '/en/blog/vom-chaos-zur-effizienz-wie-automatisierte-lagerverwaltung-den-e-commerce-logistikbetrieb-revolutioniert/': {
    title: {
      old: 'From Chaos to Efficiency: How Automated Warehouse Management Is Revolutionizing E-Commerce Logistics',
      new: 'Automated Warehouse Management for E-Commerce',
    },
  },
  '/blog/ki-in-der-forschung-wie-kuenstliche-intelligenz-entdeckungen-und-innovationen-beschleunigt-die-macht-von-ki-in-der-forschung-neuartige-entdeckungen-und-bahnbrechende-innovationen-von/': {
    title: {
      old: 'KI in der Forschung: Wie künstliche Intelligenz Entdeckungen und Innovationen beschleunigt',
      new: 'KI in der Forschung: Beschleunigte Entdeckungen',
    },
  },
  '/en/blog/ki-in-der-forschung-wie-kuenstliche-intelligenz-entdeckungen-und-innovationen-beschleunigt-die-macht-von-ki-in-der-forschung-neuartige-entdeckungen-und-bahnbrechende-innovationen-von/': {
    title: {
      old: 'AI in Research: How Artificial Intelligence Accelerates Discoveries and Innovation',
      new: 'AI in Research: Accelerating Discoveries',
    },
  },
  '/blog/was-sagt-die-ki-technologie-ueber-die-effizienz-der-lagerhaltung-und-warenlieferung-aus/': {
    title: {
      old: 'Was sagt die KI-Technologie über die Effizienz der Lagerhaltung und Warenlieferung aus?',
      new: 'KI-Technologie: Effizienz in Lagerhaltung & Lieferung',
    },
  },
  '/en/blog/was-sagt-die-ki-technologie-ueber-die-effizienz-der-lagerhaltung-und-warenlieferung-aus/': {
    title: {
      old: 'What Does AI Technology Tell Us About the Efficiency of Warehousing and Goods Delivery?',
      new: 'AI Technology: Efficiency in Warehousing & Delivery',
    },
  },
  // The literal "I Suggest:" prefix is a leftover authoring artifact (the
  // same class of defect fix-page-titles.js already fixes for the post that
  // shipped five candidate headlines instead of one) — not part of the
  // headline, so dropped rather than trimmed.
  '/en/blog/ich-schlage-vor-effizienter-content-produktion-durch-ki-gestuetzte-automatisierung/': {
    title: {
      old: 'I Suggest: "Efficient Content Production Through AI-Powered Automation"',
      new: 'Efficient Content Production Through AI Automation',
    },
  },
  '/blog/was-ist-generative-ai-und-wie-unterscheidet-es-sich-von-anderen-kis/': {
    title: {
      old: 'Was ist generative AI und wie unterscheidet es sich von anderen KIs?',
      new: 'Was ist generative AI? Unterschiede zu anderen KIs',
    },
  },
  '/en/blog/was-ist-generative-ai-und-wie-unterscheidet-es-sich-von-anderen-kis/': {
    title: {
      old: 'What Is Generative AI and How Does It Differ From Other Types of AI?',
      new: 'What Is Generative AI? How It Differs From Other AI',
    },
  },
  '/blog/die-rolle-der-mathematischen-grundlagen-fuer-kuenstliche-intelligenz/': {
    title: {
      old: 'Die Rolle der mathematischen Grundlagen für Künstliche Intelligenz',
      new: 'Mathematische Grundlagen für Künstliche Intelligenz',
    },
  },

  // --- short meta descriptions (<70 chars) ---
  '/en/legal-notice/': {
    description: {
      old: 'Legal notice (Impressum) of SGS Virtual Marketer GmbH.',
      new: 'Legal notice (Impressum) of SGS Virtual Marketer GmbH, including company address and management.',
    },
  },
  '/en/demo/': {
    description: {
      old: 'Book a no-obligation demo and see Virtual Marketer live in action.',
      new: 'Book a no-obligation demo and see Virtual Marketer live in action — pick a time that works for you.',
    },
  },
  '/datenschutzerklaerung/': {
    description: {
      old: 'Datenschutzrichtlinien und Datenschutzerklärung von Virtual Marketer.',
      new: 'Datenschutzrichtlinien und Datenschutzerklärung von Virtual Marketer: wie wir personenbezogene Daten verarbeiten und schützen.',
    },
  },
};

// --- Pagination title suffix (mechanical, general) -------------------------

const PAGE_NUM_RE = /\/page\/(\d+)\/$/;
const HAS_PAGE_MARKER_RE = /\b(?:seite|page)\s*\d+\b/i;
const BRAND_SUFFIX_RE = /( [-–—|] Virtual Marketer.*)$/;

function withPaginationSuffix(title, pageNum, isEn) {
  if (HAS_PAGE_MARKER_RE.test(title)) return null; // already has one (e.g. /blog/page/N/)
  const marker = isEn ? `page ${pageNum}` : `Seite ${pageNum}`;
  const m = title.match(BRAND_SUFFIX_RE);
  if (m) {
    const cut = title.length - m[1].length;
    return `${title.slice(0, cut)} – ${marker}${m[1]}`;
  }
  return `${title} – ${marker}`;
}

function main() {
  console.log('\n📏 Fixing title/meta-description lengths and /login/ indexability...\n');

  const files = findHtmlFiles(DIST);

  let titlesFixed = 0;
  let descriptionsFixed = 0;
  let paginationFixed = 0;
  let loginFixed = 0;
  let skippedStale = 0;
  let filesTouched = 0;

  for (const file of files) {
    if (path.basename(file) === '404.html') continue;
    let html = fs.readFileSync(file, 'utf-8');
    let changed = false;

    const urlPath = canonicalPath(html);
    if (!urlPath) continue;

    // /login/: not real content — coherent with generate-sitemap.js already
    // excluding it from the sitemap and no longer disallowing it in
    // robots.txt, mark it noindex here so a crawler that reaches it (it is
    // no longer blocked from doing so) is told to drop it, rather than
    // giving it an H1 meant for indexable content.
    if (urlPath === '/login/') {
      const before = html;
      html = html.replace(
        /<meta name=['"]robots['"] content=['"]index, follow(.*?)['"] \/>/,
        `<meta name='robots' content='noindex, follow$1' />`
      );
      if (html !== before) {
        loginFixed++;
        changed = true;
      }
    }

    const isEn = /<html lang="en"/.test(html);
    const fix = CURATED_FIXES[urlPath];

    if (fix && fix.title) {
      const cur = currentTitle(html);
      if (cur === fix.title.old) {
        html = applyTitle(html, fix.title.new);
        titlesFixed++;
        changed = true;
      } else if (cur !== fix.title.new) {
        skippedStale++;
        console.log(`   ⚠ skipped title fix for ${urlPath} — page content changed since this was written`);
      }
    }

    if (fix && fix.description) {
      const cur = currentDescription(html);
      if (cur === fix.description.old) {
        html = applyDescription(html, fix.description.new);
        descriptionsFixed++;
        changed = true;
      } else if (cur !== fix.description.new) {
        skippedStale++;
        console.log(`   ⚠ skipped description fix for ${urlPath} — page content changed since this was written`);
      }
    }

    const pageMatch = urlPath.match(PAGE_NUM_RE);
    if (pageMatch) {
      const cur = currentTitle(html);
      if (cur) {
        const withSuffix = withPaginationSuffix(cur, pageMatch[1], isEn);
        if (withSuffix) {
          html = applyTitle(html, withSuffix);
          paginationFixed++;
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(file, html);
      filesTouched++;
    }
  }

  console.log(`✅ ${titlesFixed} title(s) fixed (short or still-over-65)`);
  console.log(`   • ${descriptionsFixed} meta description(s) lengthened`);
  console.log(`   • ${paginationFixed} pagination title(s) given a "Seite N"/"page N" suffix`);
  console.log(`   • ${loginFixed} page(s) (/login/) marked noindex`);
  if (skippedStale) console.log(`   • ${skippedStale} curated fix(es) skipped — page content no longer matched`);
  console.log(`   • ${filesTouched} file(s) touched\n`);
}

main();
