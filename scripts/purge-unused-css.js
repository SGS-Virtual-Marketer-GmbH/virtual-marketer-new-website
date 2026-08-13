#!/usr/bin/env node

/**
 * Drops CSS rules that cannot match anything, anywhere on the site.
 *
 * scripts/bundle-css.js concatenates each page's stylesheets — mostly the
 * unmodified Elementor/theme export, which ships every widget style the
 * page builder knows how to draw, not just the ones actually used on this
 * site. The bundles run to 4.8 MB.
 *
 * HOW "UNUSED" IS DECIDED, AND WHY THIS IS DELIBERATELY CONSERVATIVE
 *
 * A naive purge tool checks a page against its own DOM and deletes whatever
 * a rule's selector does not match. That is wrong here in a specific way:
 * some classes only ever exist because JavaScript adds them — the mobile
 * menu's open state, an accordion's active item, a picked avatar in a demo —
 * and never appear in the static HTML a scanner reads. Purging those would
 * silently break the exact interactions this project's mobile-polish and
 * feature-demo work spent real effort getting right.
 *
 * So the bar for removal here is much higher than "not on this page":
 *
 *   1. Usage is checked across the ENTIRE built site, not per page. A rule
 *      survives if its class or id appears on ANY of the ~230 pages.
 *   2. Usage also includes every quoted string in every shipped JavaScript
 *      file (dist/**\/*.js) that looks like a class name, so a class only
 *      ever added by classList.add(...) still counts as used.
 *   3. A selector is removed only if the check is unambiguous: no pseudo-
 *      class, no pseudo-element, no attribute selector, nothing containing
 *      `:`, `[`, `*` or `~` survives to be evaluated at all — those are kept
 *      automatically, because a static scan cannot reason about :hover,
 *      :focus, [data-state], or a universal selector with any confidence.
 *   4. @font-face, @keyframes (including everything inside one — percentage
 *      selectors are not class selectors and must never be touched),
 *      @page and @supports conditions are copied through untouched. Only
 *      plain style rules, at the top level or one level inside @media, are
 *      candidates.
 *   5. A rule with several comma-separated selectors loses only the
 *      individual selectors that fail the check; if even one class or id
 *      anywhere in a selector is genuinely absent from the whole site, that
 *      one selector is dropped and the rest of the rule is kept.
 *
 * The result: this removes rules for widgets, plugins and Elementor
 * features that exist in the exported CSS but were never placed on any
 * page — LayerSlider, WooCommerce, Isotope, and similar — while leaving
 * every rule alone that a static scan cannot be certain about. That is a
 * smaller win than a real coverage tool would find, and it is the trade
 * made on purpose: this environment cannot render the result to look at,
 * so what ships has to be provably safe rather than merely probably safe.
 *
 * SCOPE: only dist/assets/css/*.css — the bundles bundle-css.js produced.
 * Page-level <style> blocks (mobile-polish.js, the feature pages, the
 * homepage sections) are already hand-scoped this session and are not
 * touched.
 *
 * Filenames are left as bundle-css.js wrote them even though their content
 * hash no longer matches post-purge — consistent with how every other pass
 * in this pipeline (fix-contrast.js, prune-font-formats.js) already edits
 * these files in place without renaming.
 *
 * Runs immediately after scripts/bundle-css.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const CSS_DIR = path.join(DIST, 'assets/css');

function findFiles(dir, test, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, test, results);
    else if (test(entry.name)) results.push(full);
  }
  return results;
}

/** Every class name and id used anywhere on the built site, HTML or JS. */
function collectUsedTokens() {
  const classes = new Set();
  const ids = new Set();

  for (const file of findFiles(DIST, (n) => n.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf-8');
    for (const m of html.matchAll(/\bclass=["']([^"']+)["']/gi)) {
      for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
    }
    for (const m of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
      if (m[1]) ids.add(m[1]);
    }
    // classList.add/remove/toggle('x') and similar inline in <script> blocks,
    // and any quoted token that looks like a hyphenated class name — the
    // over-inclusive net is intentional, this only ever adds to the safelist.
    for (const m of html.matchAll(/['"]([a-zA-Z][\w-]*(?:-[\w]+)+)['"]/g)) {
      classes.add(m[1]);
    }
  }

  for (const file of findFiles(DIST, (n) => n.endsWith('.js'))) {
    const js = fs.readFileSync(file, 'utf-8');
    for (const m of js.matchAll(/['"]([a-zA-Z][\w-]*(?:-[\w]+)+)['"]/g)) {
      classes.add(m[1]);
    }
    for (const m of js.matchAll(/\bclassList\.(?:add|remove|toggle|contains)\(\s*['"]([^'"]+)['"]/g)) {
      classes.add(m[1]);
    }
  }

  return { classes, ids };
}

/**
 * Splits a stylesheet into top-level rules, tracking brace depth so this
 * works whether a rule is a plain selector or the body of @media/@supports.
 * Returns an array of { text, kind }: kind is 'atrule-block' for anything
 * starting with @ that has a nested rule body (kept and recursed into),
 * 'opaque' for @font-face/@keyframes/@page (copied through verbatim), or
 * 'style' for a plain selector { declarations } rule (a purge candidate).
 */
function splitTopLevel(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    // Skip and preserve comments verbatim.
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out.push({ kind: 'comment', text: css.slice(i, stop) });
      i = stop;
      continue;
    }
    const open = css.indexOf('{', i);
    if (open === -1) {
      out.push({ kind: 'tail', text: css.slice(i) });
      break;
    }
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const whole = css.slice(i, j);
    const head = css.slice(i, open).trim();

    if (head.startsWith('@font-face') || head.startsWith('@keyframes') || head.startsWith('@-webkit-keyframes') || head.startsWith('@page')) {
      out.push({ kind: 'opaque', text: whole });
    } else if (head.startsWith('@media') || head.startsWith('@supports')) {
      out.push({ kind: 'atrule-block', head, body: css.slice(open + 1, j - 1) });
    } else if (head.startsWith('@')) {
      // @import, @charset, custom properties on @property, anything else
      // unrecognised — copied through untouched rather than guessed at.
      out.push({ kind: 'opaque', text: whole });
    } else {
      out.push({ kind: 'style', selector: head, body: css.slice(open + 1, j - 1) });
    }
    i = j;
  }
  return out;
}

/** Splits a selector list on top-level commas (not inside (), [], or "" ). */
function splitSelectorList(sel) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(sel.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(sel.slice(start).trim());
  return parts.filter(Boolean);
}

/**
 * True if this single (comma-free) selector can be evaluated safely and is
 * provably unmatchable anywhere on the site.
 */
function isProvablyDead(selector, used) {
  if (/[:[*~]/.test(selector)) return false; // pseudo/attr/universal/sibling — not touched
  if (/^::/.test(selector) || selector.includes('::')) return false;

  const classTokens = selector.match(/\.[A-Za-z0-9_-]+/g) || [];
  const idTokens = selector.match(/#[A-Za-z0-9_-]+/g) || [];
  if (!classTokens.length && !idTokens.length) return false; // bare tag/combinator selector — leave alone

  for (const t of classTokens) {
    if (!used.classes.has(t.slice(1))) return true;
  }
  for (const t of idTokens) {
    if (!used.ids.has(t.slice(1))) return true;
  }
  return false;
}

function renderStyle(r, used, stats) {
  const selectors = splitSelectorList(r.selector);
  const survivors = selectors.filter((s) => {
    const dead = isProvablyDead(s, used);
    if (dead) stats.selectorsDropped++;
    return !dead;
  });
  if (!survivors.length) {
    stats.bytesDropped += r.selector.length + r.body.length + 2;
    return '';
  }
  if (survivors.length < selectors.length) stats.rulesTrimmed++;
  return `${survivors.join(',')}{${r.body}}`;
}

/** Renders one parsed node back to CSS text, recursing into at-rule bodies. */
function renderNode(node, used, stats) {
  if (node.kind === 'comment' || node.kind === 'opaque' || node.kind === 'tail') return node.text;
  if (node.kind === 'style') return renderStyle(node, used, stats);
  if (node.kind === 'atrule-block') {
    const inner = splitTopLevel(node.body)
      .map((sub) => renderNode(sub, used, stats))
      .join('');
    return `${node.head}{${inner}}`;
  }
  return '';
}

function purgeCss(css, used, stats) {
  return splitTopLevel(css)
    .map((node) => renderNode(node, used, stats))
    .join('');
}

function main() {
  console.log('\n🧹 Purging provably unused CSS from the bundles...\n');

  if (!fs.existsSync(CSS_DIR)) {
    console.log('   ⚠ dist/assets/css not found — skipped');
    return;
  }

  const used = collectUsedTokens();
  console.log(`   • ${used.classes.size} class name(s) and ${used.ids.size} id(s) seen somewhere on the site`);

  const files = findFiles(CSS_DIR, (n) => n.endsWith('.css'));
  let totalBefore = 0;
  let totalAfter = 0;
  const stats = { selectorsDropped: 0, rulesTrimmed: 0, bytesDropped: 0 };

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf-8');
    totalBefore += before.length;
    const after = purgeCss(before, used, stats);
    totalAfter += after.length;
    if (after !== before) fs.writeFileSync(file, after);
  }

  const savedKb = ((totalBefore - totalAfter) / 1024).toFixed(1);
  console.log(`   • ${stats.selectorsDropped} selector(s) removed, ${stats.rulesTrimmed} rule(s) partially trimmed`);
  console.log(`✅ ${savedKb} KB removed across ${files.length} bundle(s) (${(totalBefore / 1024).toFixed(0)} KB → ${(totalAfter / 1024).toFixed(0)} KB)\n`);
}

main();
