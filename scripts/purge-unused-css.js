#!/usr/bin/env node

/**
 * Drops CSS rules that cannot match anything on the specific page(s) that
 * load a given bundle — not "anywhere on the site."
 *
 * THE BUG THIS REPLACES
 *
 * The previous version of this step (still the right shape for HOW to
 * decide a selector is dead — see "HOW UNUSED IS DECIDED" below, mostly
 * unchanged) decided whether a class was "used" by scanning every HTML page
 * in the whole built site. That is safe but far too generous: kontakt/ and
 * every /ki-loesungen/* feature page share ONE bundle
 * (dist/assets/css/vm-a80b91e97a.css, confirmed by grep — 179 of ~230
 * pages link it) that also has to satisfy plenty of Elementor-heavy pages
 * elsewhere. A site-wide "is this class used somewhere" scan keeps every
 * rule any of those 179 pages needs, so kontakt's own copy of the bundle —
 * which uses almost none of that Elementor vocabulary — measured 96%
 * unused in Lighthouse's per-page coverage audit. That audit is measured
 * per PAGE LOAD, not per file: what matters is what a given page's own
 * markup actually uses, not what the site as a whole uses.
 *
 * THE FIX: PURGE PER PAGE, NOT PER FILE
 *
 * A bundle is no longer purged once and shipped identically to every page
 * that links it. Instead, for every (page, bundle-it-links) pair, a purge
 * is computed scoped to THAT PAGE's own class/id tokens, and the result is
 * written to a file named by a hash of ITS OWN CONTENT
 * (dist/assets/css/vm-<hash10>.css, the same naming bundle-css.js already
 * uses). Pages whose markup needs the exact same subset — the sixteen
 * /ki-loesungen/* pages built from one template, for instance — naturally
 * purge down to identical bytes and end up sharing one small file again;
 * pages that need a genuinely different subset get their own. This is
 * "content-hash dedup," not a filename decided in advance, so it costs
 * nothing when pages happen to agree and produces a safely modest number
 * of variants when they don't.
 *
 * The other half of "scoped to that page" is what counts as USED. A
 * page's own `class=`/`id=` attributes are read from THAT page's markup
 * only — no longer from the whole site. Anything that can only be added by
 * JavaScript at runtime is a different question and stays answered the way
 * it always was: globally. See the safelist section below for why.
 *
 * HOW "UNUSED" IS DECIDED (per rule, unchanged from before)
 *
 * A naive purge tool checks a page against its own DOM and deletes whatever
 * a rule's selector does not match. That is wrong here in a specific way:
 * some classes only ever exist because JavaScript adds them — the mobile
 * menu's open state, an accordion's active item, a scroll listener's
 * ".is-stuck" — and never appear in the static HTML a scanner reads.
 * Purging those would silently break interactions this project spent real
 * effort getting right. So the bar for removal is much higher than "not on
 * this page's markup":
 *
 *   1. A selector survives if its class/id is EITHER present in the
 *      specific page's own markup, OR anywhere in the EXPLICIT SAFELIST
 *      below, OR added by any classList.add/remove/toggle/contains call or
 *      any quoted hyphenated token in ANY shipped JS file or inline
 *      <script> block ANYWHERE on the site — that check stays site-wide on
 *      purpose (see next section).
 *   2. A selector is removed only if the check is unambiguous: no pseudo-
 *      class, no pseudo-element, no attribute selector, nothing containing
 *      `:`, `[`, `*` or `~` survives to be evaluated at all.
 *   3. @font-face, @keyframes, @page and @supports conditions are copied
 *      through untouched; only plain style rules, at the top level or one
 *      level inside @media, are candidates.
 *   4. A rule with several comma-separated selectors loses only the
 *      individual selectors that fail the check.
 *
 * WHY THE JS/SCRIPT SCAN STAYS SITE-WIDE WHILE THE HTML SCAN DOES NOT
 *
 * This pipeline injects some markup (inject-search.js, consolidate-fonts.js,
 * enable-dark-mode.js, inject-enhance.js) AFTER this step runs — a
 * page-scoped scan of THAT page's own <script> text still sees whatever
 * inline script already sits on the page at purge time, but cannot see
 * classes a not-yet-injected widget will add later. Search-widget CSS
 * lives in its own file outside this script's scope entirely
 * (assets/search/search.css, never touched here) so that specific case
 * doesn't arise, but the general risk — a class a later step's JS toggles,
 * with nothing in today's markup naming it — is exactly why the JS-driven
 * half of the used-token set stays a site-wide, over-inclusive net rather
 * than being scoped down along with the HTML half.
 *
 * EXPLICIT SAFELIST
 *
 * On top of the automatic JS scan, these are kept unconditionally because
 * they are either JS-applied states this codebase is known to rely on, or
 * form/validation states no static scan will ever see in rest markup:
 *
 *   - `is-stuck`        — set by the theme's own scroll listener
 *                          (engitech scripts.js) on the sticky header once
 *                          it sticks; never present in static markup.
 *   - `is-active`, `active`, `open`, `show`, `shown`, `collapsed`,
 *     `collapsing`, `expanded`, `selected`, `checked`, `disabled` — the
 *     generic JS-toggled states used across the theme's menu, accordion
 *     and tab widgets (Bootstrap-derived naming, engitech scripts.js).
 *   - `is-invalid`, `is-valid`, `was-validated`, `focused` — form
 *     validation/focus states, applied by browser :invalid-driven scripts
 *     or the theme's own form JS, never present until a visitor interacts.
 *   - `current-menu-item`, `current_page_item` — WordPress nav-menu
 *     classes applied server-side per request based on the current URL;
 *     a static build can catch the variant it happened to render but not
 *     every page's own "current" state on every OTHER page's copy of a
 *     shared nav.
 *   - anything starting with `vm-search` or `mmenu` — the search overlay
 *     and mobile off-canvas menu, both driven by JS adding/removing
 *     modifier classes on top of a base class already in static markup.
 *
 * This list is deliberately short: it exists for classes the automatic
 * scans cannot be trusted to catch, not as a second, looser purge rule.
 *
 * SCOPE: only dist/assets/css/*.css. Page-level <style> blocks
 * (mobile-polish.js, hoist-critical-css.js's inlined fonts/enhance/
 * critical-bg, the homepage sections) are hand-scoped already and are
 * never touched here.
 *
 * Runs immediately after scripts/bundle-css.js, same as before.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '../dist');
const CSS_DIR = path.join(DIST, 'assets/css');

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Explicit safelist — see the header comment for why each entry is here.
// ---------------------------------------------------------------------------

const SAFELIST_EXACT = new Set([
  'is-stuck',
  'is-active', 'active', 'open', 'show', 'shown', 'collapsed', 'collapsing', 'expanded',
  'selected', 'checked', 'disabled',
  'is-invalid', 'is-valid', 'was-validated', 'focused',
  'current-menu-item', 'current_page_item',
]);
const SAFELIST_PREFIXES = ['vm-search', 'mmenu'];

function isSafelisted(token) {
  if (SAFELIST_EXACT.has(token)) return true;
  return SAFELIST_PREFIXES.some((p) => token.startsWith(p));
}

// ---------------------------------------------------------------------------
// Token collection
// ---------------------------------------------------------------------------

const HYPHENATED_TOKEN = /['"]([a-zA-Z][\w-]*(?:-[\w]+)+)['"]/g;

/**
 * A quoted string holding SEVERAL space-separated names, e.g.
 * `className = 'vm-card vm-card--wide'` or `addClass('a b')`.
 * HYPHENATED_TOKEN cannot see these — it anchors on the quotes, so a value
 * containing a space matches nothing at all and every name in it looked
 * unused. Split and harvest each one instead.
 */
const QUOTED_STRING = /['"]([^'"\n]{2,120})['"]/g;

/** Adds each space-separated hyphenated name inside a quoted string. */
function addTokensFromQuoted(text, into) {
  for (const m of text.matchAll(QUOTED_STRING)) {
    if (!m[1].includes(' ')) continue; // the single-token case is already covered
    for (const part of m[1].trim().split(/\s+/)) {
      if (/^[a-zA-Z][\w-]*-[\w-]+$/.test(part)) into.add(part);
    }
  }
}

/**
 * Every class name that could ever be added by JS, site-wide —
 * over-inclusive by design.
 *
 * Over-inclusive is the whole point: a name kept by mistake costs a few
 * bytes, a name dropped by mistake is a visibly broken page that nobody
 * notices until a user hits the one state that needed it. The scans below
 * therefore always err towards keeping.
 */
function collectGlobalJsClasses() {
  const classes = new Set();

  for (const file of walk(DIST).filter((f) => f.endsWith('.js'))) {
    const js = fs.readFileSync(file, 'utf-8');
    for (const m of js.matchAll(HYPHENATED_TOKEN)) classes.add(m[1]);
    for (const m of js.matchAll(/\bclassList\.(?:add|remove|toggle|contains)\(\s*['"]([^'"]+)['"]/g)) {
      // A classList call may itself carry several names.
      for (const part of m[1].trim().split(/\s+/)) if (part) classes.add(part);
    }
    addTokensFromQuoted(js, classes);
  }

  // Inline <script> blocks in HTML can do the same (jQuery .addClass, etc.)
  // — the theme's sticky-header script is exactly this case.
  for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf-8');
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      for (const t of m[1].matchAll(HYPHENATED_TOKEN)) classes.add(t[1]);
      addTokensFromQuoted(m[1], classes);
    }
  }

  return classes;
}

/**
 * Every element id that could ever exist at runtime, site-wide.
 *
 * Ids used to get none of this. Classes were checked against this global
 * scan AND a safelist, while an id selector was judged purely on whether
 * the id appeared in that one page's static markup — so a rule for an
 * element JS creates or renames at runtime (a dialog, a toast, an
 * injected widget) was "provably dead" on every page and deleted
 * everywhere. Nothing in the current output depends on that gap, but it
 * is luck, not design: the asymmetry had no reason behind it.
 */
function collectGlobalJsIds() {
  const ids = new Set();
  const ID_CALL = /\b(?:getElementById|querySelector|querySelectorAll|closest|matches)\(\s*['"]#?([A-Za-z][\w-]*)['"]/g;
  const ID_ASSIGN = /\b(?:\.id\s*=\s*|id:\s*|setAttribute\(\s*['"]id['"]\s*,\s*)['"]([A-Za-z][\w-]*)['"]/g;

  const harvest = (text) => {
    for (const m of text.matchAll(ID_CALL)) ids.add(m[1]);
    for (const m of text.matchAll(ID_ASSIGN)) ids.add(m[1]);
  };

  for (const file of walk(DIST).filter((f) => f.endsWith('.js'))) {
    harvest(fs.readFileSync(file, 'utf-8'));
  }
  for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf-8');
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) harvest(m[1]);
  }

  return ids;
}

/** This one page's own class=/id= attribute tokens — NOT site-wide. */
function collectPageTokens(html) {
  const classes = new Set();
  const ids = new Set();
  for (const m of html.matchAll(/\bclass=["']([^"']+)["']/gi)) {
    for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  }
  for (const m of html.matchAll(/\bid=["']([^"']+)["']/gi)) {
    if (m[1]) ids.add(m[1]);
  }
  return { classes, ids };
}

// ---------------------------------------------------------------------------
// CSS parsing / purging — same shape as the previous version, parameterized
// by a per-page `used` set instead of a single site-wide one.
// ---------------------------------------------------------------------------

function splitTopLevel(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
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
      out.push({ kind: 'opaque', text: whole });
    } else {
      out.push({ kind: 'style', selector: head, body: css.slice(open + 1, j - 1) });
    }
    i = j;
  }
  return out;
}

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

function isProvablyDead(selector, used) {
  if (/[:[*~]/.test(selector)) return false;
  if (/^::/.test(selector) || selector.includes('::')) return false;

  const classTokens = selector.match(/\.[A-Za-z0-9_-]+/g) || [];
  const idTokens = selector.match(/#[A-Za-z0-9_-]+/g) || [];
  if (!classTokens.length && !idTokens.length) return false;

  for (const t of classTokens) {
    const name = t.slice(1);
    if (!used.classes.has(name) && !isSafelisted(name)) return true;
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

// ---------------------------------------------------------------------------
// Per-page href rewriting with content-hash dedup
// ---------------------------------------------------------------------------

const HREF_RE = /\/assets\/css\/vm-[0-9a-f]+\.css/g;

function contentHash(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function main() {
  console.log('\n🧹 Purging unused CSS, scoped per page...\n');

  if (!fs.existsSync(CSS_DIR)) {
    console.log('   ⚠ dist/assets/css not found — skipped');
    return;
  }

  const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
  const globalJsClasses = collectGlobalJsClasses();
  const globalJsIds = collectGlobalJsIds();
  console.log(`   • ${globalJsClasses.size} class name(s) seen in JS/inline <script> site-wide (always kept)`);
  console.log(`   • ${globalJsIds.size} element id(s) seen in JS/inline <script> site-wide (always kept)`);

  const bundleCache = new Map(); // original href -> original CSS text
  function readBundle(href) {
    if (bundleCache.has(href)) return bundleCache.get(href);
    const abs = path.join(DIST, href.replace(/^\//, ''));
    let text = null;
    try {
      text = fs.readFileSync(abs, 'utf-8');
    } catch {
      text = null;
    }
    bundleCache.set(href, text);
    return text;
  }

  const writtenByHash = new Map(); // hash -> href already on disk this run
  const stillReferenced = new Set(); // hrefs any page ends up pointing at
  const stats = { selectorsDropped: 0, rulesTrimmed: 0, bytesDropped: 0 };
  let totalBefore = 0;
  let totalAfter = 0;
  let pagesChanged = 0;

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf-8');
    const hrefs = [...new Set((html.match(HREF_RE) || []))];
    if (!hrefs.length) continue;

    const { classes: pageClasses, ids: pageIds } = collectPageTokens(html);
    const used = {
      classes: new Set([...pageClasses, ...globalJsClasses]),
      ids: new Set([...pageIds, ...globalJsIds]),
    };

    let out = html;
    let pageTouched = false;

    for (const href of hrefs) {
      const original = readBundle(href);
      if (original === null) continue; // not one of our bundles (already-purged ref elsewhere, or missing)

      totalBefore += original.length;
      const purged = purgeCss(original, used, stats);
      totalAfter += purged.length;

      const hash = contentHash(purged);
      const newHref = `/assets/css/vm-${hash}.css`;

      if (!writtenByHash.has(hash)) {
        const abs = path.join(DIST, newHref.replace(/^\//, ''));
        if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf-8') !== purged) {
          fs.writeFileSync(abs, purged);
        }
        writtenByHash.set(hash, newHref);
      }
      stillReferenced.add(newHref);

      if (newHref !== href) {
        out = out.split(href).join(newHref);
        pageTouched = true;
      } else {
        stillReferenced.add(href);
      }
    }

    if (pageTouched) {
      fs.writeFileSync(file, out);
      pagesChanged++;
    }
  }

  // Garbage-collect original (pre-purge) bundle files nothing points at
  // anymore. Two-pass by construction (every page above was already
  // rewritten before this runs), so this can never delete a file a page
  // still needs.
  //
  // Scoped to `vm-<hex>.css` directly inside CSS_DIR — i.e. exactly the
  // files bundle-css.js and this script create, and nothing else.
  //
  // It used to walk CSS_DIR recursively and key on path.basename(), which
  // made it an unlink of "any .css under assets/css I can't account for".
  // Two ways that bites: a file in a subdirectory collapsed to its bare
  // name, so `assets/css/vendor/foo.css` was tested as the unrelated href
  // `/assets/css/foo.css`, missed, and deleted; and any stylesheet put
  // there by another step, or referenced from CSS rather than from a page,
  // was deleted for not appearing in a page href. Neither fires today only
  // because that directory happens to be flat and to hold nothing but
  // these bundles — which is a property of the current pipeline, not
  // something this script should depend on.
  const GENERATED_BUNDLE = /^vm-[0-9a-f]+\.css$/;
  let removed = 0;
  for (const name of fs.readdirSync(CSS_DIR)) {
    if (!GENERATED_BUNDLE.test(name)) continue;
    const full = path.join(CSS_DIR, name);
    if (!fs.statSync(full).isFile()) continue;
    if (!stillReferenced.has(`/assets/css/${name}`)) {
      fs.unlinkSync(full);
      removed++;
    }
  }

  const savedKb = ((totalBefore - totalAfter) / 1024).toFixed(1);
  console.log(`   • ${stats.selectorsDropped} selector(s) removed, ${stats.rulesTrimmed} rule(s) partially trimmed`);
  console.log(`   • ${pagesChanged} page(s) repointed at a smaller, page-scoped bundle`);
  console.log(`   • ${writtenByHash.size} distinct purged bundle(s) on disk, ${removed} orphaned pre-purge file(s) removed`);
  console.log(`✅ ${savedKb} KB removed across all (page, bundle) pairs evaluated (${(totalBefore / 1024).toFixed(0)} KB → ${(totalAfter / 1024).toFixed(0)} KB, summed per reference)\n`);
}

main();
