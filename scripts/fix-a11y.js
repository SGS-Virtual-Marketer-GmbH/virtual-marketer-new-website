#!/usr/bin/env node

/**
 * Accessibility repairs on the scraped markup.
 *
 * Four defects, each reported by Lighthouse against the built homepage and
 * each fixed by adding an attribute rather than by restructuring — the markup
 * is a WordPress export and rewriting its DOM would break the theme CSS that
 * targets it.
 *
 *  1. Icon-only links with no accessible name. The mobile-menu close, the
 *     side-panel close and the back-to-top button are <a> elements whose only
 *     content is an icon font glyph. A screen reader announces "link" and
 *     nothing else. Given aria-label.
 *
 *  2. The burger <button> is empty — its three bars are drawn with CSS
 *     pseudo-elements, so there is no text to announce at all. Same fix.
 *
 *  3. role="tab" without role="tablist". The accordion widget marks its
 *     triggers as tabs but their container carries no tablist role, which
 *     makes the ARIA contract invalid: assistive technology is told these are
 *     tabs and then cannot find the tab set they belong to. The container
 *     gets the missing role.
 *
 *  4. No main landmark. "Skip to content" and landmark navigation both rely
 *     on it. The theme's content wrapper is given role="main" rather than
 *     being renamed to <main>, because the wrapper's id and classes are load-
 *     bearing for layout.
 *
 * NOT FIXED HERE, AND DELIBERATELY
 *
 * heading-order: the pages use <h6 class="title-box"> for eyebrow labels
 * above section headings, so an h2 is followed by an h6 and the level jumps.
 * The honest fix is that an eyebrow is not a heading and should be a <p>, but
 * the theme styles it through the h6 selector, so changing the tag changes
 * the design. That is a content decision, not an attribute patch, and it is
 * left visible in the audit rather than papered over.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const MARKER = 'data-vm-a11y';

/** Icon-only controls → the label a screen reader should announce. */
const LABELS = [
  [/class=["'][^"']*\bmmenu-close\b[^"']*["']/i, 'Menü schließen', 'Close menu'],
  [/class=["'][^"']*\bside-panel-close\b[^"']*["']/i, 'Seitenleiste schließen', 'Close sidebar'],
  [/id=["']back-to-top["']/i, 'Nach oben springen', 'Back to top'],
  [/class=["'][^"']*\bmmenu-toggle\b[^"']*["']/i, 'Menü öffnen', 'Open menu'],
];

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n♿ Accessibility repairs...\n');

  let pages = 0;
  const fixed = { labels: 0, burger: 0, tablist: 0, main: 0 };

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    const original = html;
    const isEnglish = /\/en\//.test(file.split(path.sep).join('/')) || /<html[^>]+lang=["']en/i.test(html);

    // 1 + 2 — name the icon-only controls.
    html = html.replace(/<(a|button)\b([^>]*)>/gi, (tag, el, attrs) => {
      if (/\baria-label=/i.test(attrs)) return tag;
      const hit = LABELS.find(([re]) => re.test(attrs));
      if (!hit) return tag;
      fixed.labels++;
      return `<${el}${attrs} aria-label="${isEnglish ? hit[2] : hit[1]}">`;
    });

    // The burger button itself carries no class — it is the <button> inside
    // #mmenu-toggle. Matched by position rather than by attribute.
    html = html.replace(
      /(<div\b[^>]*id=["']mmenu-toggle["'][^>]*>\s*)<button(\s*)>/gi,
      (whole, prefix) => {
        fixed.burger++;
        return `${prefix}<button aria-label="${isEnglish ? 'Open menu' : 'Menü öffnen'}" aria-expanded="false">`;
      }
    );

    // 3 — give the accordion's trigger container the tablist role its
    // children's role="tab" requires.
    if (/role=["']tab["']/i.test(html) && !/role=["']tablist["']/i.test(html)) {
      const before = html;
      // The container is .ot-acc-wrapper — read off the built page, not
      // guessed. A first attempt matched ".ot-accordion", which is the
      // Elementor *widget* class ("elementor-widget-ot-accordions-with-icon")
      // and does not exist as a plain class anywhere, so it silently fixed
      // nothing and the build reported "0 accordion containers".
      html = html.replace(
        /<div\b([^>]*class=["'][^"']*\bot-acc-wrapper\b[^"']*["'][^>]*)>/gi,
        (tag, attrs) => (/role=/i.test(attrs) ? tag : `<div${attrs} role="tablist">`)
      );
      if (html !== before) fixed.tablist++;
    }

    // 4 — a main landmark, if the document has none.
    if (!/<main\b/i.test(html) && !/role=["']main["']/i.test(html)) {
      const before = html;
      // The theme's content wrapper, in the order we prefer to mark it.
      for (const re of [
        /<div\b([^>]*id=["']content["'][^>]*)>/i,
        /<div\b([^>]*class=["'][^"']*\bsite-content\b[^"']*["'][^>]*)>/i,
        /<div\b([^>]*class=["'][^"']*\bcontent-inner\b[^"']*["'][^>]*)>/i,
      ]) {
        if (re.test(html)) {
          html = html.replace(re, (tag, attrs) => `<div${attrs} role="main" ${MARKER}>`);
          break;
        }
      }
      if (html !== before) fixed.main++;
    }

    if (html !== original) {
      fs.writeFileSync(file, html);
      pages++;
    }
  }

  console.log(`✅ ${pages} page(s) updated`);
  console.log(`   • ${fixed.labels} icon-only control(s) given an aria-label`);
  console.log(`   • ${fixed.burger} burger button(s) named`);
  console.log(`   • ${fixed.tablist} accordion container(s) given role="tablist"`);
  console.log(`   • ${fixed.main} page(s) given a main landmark`);

  const stillMissing = findHtmlFiles(DIST).filter((f) => {
    const h = fs.readFileSync(f, 'utf-8');
    return !/<main\b/i.test(h) && !/role=["']main["']/i.test(h);
  });
  if (stillMissing.length) {
    console.log(`   ⚠ ${stillMissing.length} page(s) still have no main landmark:`);
    stillMissing.slice(0, 5).forEach((f) => console.log(`       ${path.relative(DIST, f)}`));
  } else {
    console.log('   ✓ every page has a main landmark');
  }
  console.log();
}

main();
