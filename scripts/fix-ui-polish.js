#!/usr/bin/env node

/**
 * Four small, unrelated defects that all live in the built output.
 *
 * ── 1. OFF-PALETTE BUTTON GRADIENTS ──────────────────────────────────
 *
 * Three button gradients come from the original theme and use colours
 * that are near the brand but not of it:
 *
 *   #921127 → #4A7C9A      #910F28 → #477D98      #92122D → #507B9C
 *
 * The brand is vm-red #94152b / vm-red-dark #700f2b and vm-blue #66a3ce
 * (vm-customer-web-ui/tailwind.config.js). Those reds are each a shade or
 * two off #94152b — close enough to look like a mistake rather than a
 * choice when placed beside a correct one — and the blues are a
 * desaturated slate that appears nowhere in the palette.
 *
 * They are rewritten to #94152b → #700f2b, which is not merely "a brand
 * pair" but the exact gradient the site already uses on its other button
 * (`linear-gradient(80deg,#94152b 0%,#700f2b …)`), so the two stop
 * disagreeing.
 *
 * Deliberately NOT mapped to red→vm-blue, which would be the literal
 * palette reading: #66a3ce against the white button label gives a
 * contrast ratio of about 2.6:1, well under the 4.5:1 these labels need.
 * Red→dark-red keeps both ends dark and the label readable, which is the
 * point of the button.
 *
 * ── 2. HEADING LEVELS ────────────────────────────────────────────────
 *
 * Four of the homepage's widgets emit headings several levels below their
 * section's `h2`: the FAQ questions are `h5`, and the counter labels, the
 * industry pills and the sector cards are `h6`. The outline therefore
 * jumps h2→h5 and h2→h6.
 *
 * Each already carries `aria-level="3" role="heading"`, so assistive
 * technology is told the truth; it is the HTML outline — what search
 * engines read — that disagrees with it. Promoting the tags to `h3` makes
 * the markup say what the ARIA already claims, after which the
 * `aria-level`/`role` pair is redundant and is dropped.
 *
 * SCOPE, deliberately narrow. 268 headings across the site carry that same
 * `aria-level="3"`, most of them blog-card titles in listings. They are NOT
 * promoted here. The reason is styling, not principle: 58 distinct CSS
 * selectors reach `h6` and 38 reach `h5`, spread across theme components
 * (`.contact-info`, `.recent-news`, `.roadmap-item`, `.post-nav`, the
 * author bio) whose rendering nobody has measured. Retagging them wholesale
 * would silently resize headings on templates this change never looked at.
 * The ones promoted are the four the homepage review actually reported and
 * whose typography was measured in the browser first. The rest keep correct
 * ARIA, so assistive technology is unaffected — only their outline is still
 * imperfect, and fixing it needs its own measured pass.
 *
 * Even for these four it is not a bare tag swap: a global
 * `h3{font-size:30px}` rule exists and these labels are 18–26px. So every
 * selector that reached them BY TAG is rewritten to the new tag, and each
 * component gets an explicit rule pinning the typography it has today —
 * measured from the rendered page, not guessed:
 *
 *   pills        Outfit  20px/24px w500 #171151
 *   counters     DM Sans 18px/29px w500 #fff
 *   accordion    Outfit  26px/34px w500 #fff
 *   sector cards Outfit  25px/34px w600 #fff
 *
 * ── 3. DUPLICATE SVG GRADIENT IDS ────────────────────────────────────
 *
 * An inlined icon is repeated four times, and each copy brings its own
 * `<linearGradient id="paint0_linear_38_10087">`. Four elements then share
 * one id, which is invalid HTML, and every `url(#paint0_linear_38_10087)`
 * in the page resolves to whichever copy the browser saw first. It renders
 * acceptably today only because the four copies are identical — the moment
 * one icon is recoloured, three others change with it.
 *
 * Fixed per `<svg>` block: a block containing an id that is duplicated in
 * the page gets its ids suffixed, and the references INSIDE THAT SAME
 * BLOCK are updated with them. Scoping to the block is what makes this
 * safe — an SVG's `url(#…)` always points into its own defs, so no
 * cross-references can be broken.
 *
 * ── 4. TAP TARGETS ───────────────────────────────────────────────────
 *
 * The footer's legal links render 18–20px tall, under the 24px minimum
 * (WCAG 2.5.8). Padding takes them to 26px without moving anything: they
 * sit on their own row, so the extra height is absorbed by space that was
 * already empty.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

const GRADIENT_FIXES = [
  [/#921127/gi, '#94152b'],
  [/#910F28/gi, '#94152b'],
  [/#92122D/gi, '#94152b'],
  [/#4A7C9A/gi, '#700f2b'],
  [/#477D98/gi, '#700f2b'],
  [/#507B9C/gi, '#700f2b'],
];

/**
 * The three components to promote, each matched as a whole element —
 * opening tag through its own closer. Headings cannot nest, so a
 * non-greedy body pairs each closer with the tag that opened it, and a
 * heading outside these patterns is untouched by construction.
 *
 * Each pattern is anchored on the structure AROUND the heading, because
 * two of the three carry no class of their own:
 *
 *   accordion  the `ot-acc-item__title` class on the h5 itself
 *   counters   the `.num` + `.` spans that always precede the label
 *   pills      the `li.indus-title` that always wraps it
 */
const PROMOTIONS = [
  {
    what: 'FAQ question',
    // groups: attrs, body
    re: /<h5\b([^>]*)\bclass=(["'][^"']*\bot-acc-item__title\b[^"']*["'])([^>]*)>([\s\S]*?)<\/h5>/gi,
    build: (m) => `<h3${attrs(`${m[1]} class=${m[2]} ${m[3]}`)}>${m[4]}</h3>`,
  },
  {
    what: 'sector card',
    re: /<h6\b([^>]*)\bclass=(["'][^"']*\btitle-box\b[^"']*["'])([^>]*)>([\s\S]*?)<\/h6>/gi,
    build: (m) => `<h3${attrs(`${m[1]} class=${m[2]} ${m[3]}`)}>${m[4]}</h3>`,
  },
  {
    what: 'counter label',
    // groups: the .num / "." spans that identify the widget, attrs, body
    re: /(<span\b[^>]*\bclass=["'][^"']*\bnum\b[^"']*["'][^>]*>[\s\S]{0,40}?<\/span>\s*<span>\.<\/span>\s*)<h6\b([^>]*)>([\s\S]*?)<\/h6>/gi,
    build: (m) => `${m[1]}<h3${attrs(m[2])}>${m[3]}</h3>`,
  },
  {
    what: 'industry pill',
    // groups: the wrapping li, attrs, body
    re: /(<li\b[^>]*\bclass=["'][^"']*\bindus-title\b[^"']*["'][^>]*>\s*)<h6\b([^>]*)>([\s\S]*?)<\/h6>/gi,
    build: (m) => `${m[1]}<h3${attrs(m[2])}>${m[3]}</h3>`,
  },
];

/** Normalise an attribute string, dropping the now-redundant ARIA. */
function attrs(raw) {
  const kept = raw.replace(ARIA_NOW_REDUNDANT, '').replace(/\s+/g, ' ').trim();
  return kept ? ` ${kept}` : '';
}

/** Once the tag says level 3, saying it again in ARIA is noise. */
const ARIA_NOW_REDUNDANT = /\s*\b(?:aria-level=["']3["']|role=["']heading["'])/gi;

/**
 * Selectors that reach these components by TAG rather than by class have
 * to follow the tag. Keyed on the component's own class so a selector
 * belonging to some other widget's h6 is never rewritten.
 */
const SELECTOR_KEYS = /ot-counter3|industries-marquee-content|indus-title|elementor-repeater-item-|ot-acc-item__title/;

const PRESERVE_CSS = [
  '/* vm: typography pinned after h5/h6 -> h3 promotion (scripts/fix-ui-polish.js) */',
  'li.indus-title h3{font-family:"Outfit",sans-serif;font-size:20px;font-weight:500;line-height:24px;margin:0;color:#171151;}',
  '.ot-counter3 h3{font-family:"DM Sans",sans-serif;font-size:18px;font-weight:500;line-height:29px;margin:4px 0 0;color:#fff;}',
  'h3.ot-acc-item__title{font-family:"Outfit",sans-serif;font-size:26px;font-weight:500;line-height:34px;margin:0;color:#fff;}',
  'h3.title-box{font-family:"Outfit",sans-serif;font-size:25px;font-weight:600;line-height:34px;margin:0 0 10px;color:#fff;}',
  '/* vm: footer legal links reach the 24px minimum target size */',
  'a.title-link{display:inline-block;padding:3px 0;}',
].join('');

const CSS_MARKER = 'typography pinned after h5/h6';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const SVG_BLOCK = /<svg\b[\s\S]*?<\/svg>/gi;

/**
 * Give each repeated-id `<svg>` block its own id namespace.
 *
 * Ids are counted from inside SVG blocks only, never from the whole
 * document. Scanning the document would be both wider than the fix and
 * wrong: the inlined `enhance.css` contains a comment quoting the literal
 * text `<style id="vm-enhance-inline">`, which a document-wide scan reads
 * as a second element with that id and reports as a duplicate that does
 * not exist.
 */
function uniquifySvgIds(html) {
  const counts = new Map();
  for (const svg of html.match(SVG_BLOCK) || []) {
    for (const m of svg.matchAll(/\bid="([^"]+)"/g)) {
      counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
  }
  const duped = new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id));
  if (!duped.size) return { html, renamed: 0 };

  let renamed = 0;
  let block = 0;
  const out = html.replace(SVG_BLOCK, (svg) => {
    block++;
    let changed = svg;
    for (const id of duped) {
      if (!changed.includes(`id="${id}"`)) continue;
      const fresh = `${id}__vm${block}`;
      changed = changed
        .split(`id="${id}"`).join(`id="${fresh}"`)
        .split(`url(#${id})`).join(`url(#${fresh})`)
        .split(`href="#${id}"`).join(`href="#${fresh}"`);
      renamed++;
    }
    return changed;
  });
  return { html: out, renamed };
}

/**
 * Rewrites `h5`/`h6` to `h3` inside selectors that belong to a promoted
 * component, leaving every other selector alone.
 *
 * Works on the selector text only — never on declarations — so a value
 * that happens to contain the letters is safe. In HTML files it descends
 * into `<style>` blocks, which is where hoist-critical-css puts a copy of
 * exactly these rules.
 */
function retagSelectors(text, isHtml) {
  const rewriteCss = (css) =>
    css.replace(/(^|[}])([^{}]+)\{/g, (whole, sep, selectorList) => {
      const out = selectorList
        .split(',')
        .map((sel) => (SELECTOR_KEYS.test(sel) ? sel.replace(/\bh[56]\b/g, 'h3') : sel))
        .join(',');
      return `${sep}${out}{`;
    });

  if (!isHtml) return rewriteCss(text);
  return text.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (w, open, css, close) => `${open}${rewriteCss(css)}${close}`);
}

function main() {
  console.log('\n✨ UI polish: brand gradients, heading levels, SVG ids, tap targets...\n');

  if (!fs.existsSync(DIST)) {
    console.log('   ⚠ dist/ not found — nothing to do\n');
    return;
  }

  const files = walk(DIST);
  const byKind = new Map();
  let gradientFiles = 0;
  let promoted = 0;
  let promotedPages = 0;
  let svgRenamed = 0;
  let svgPages = 0;
  let cssPatched = 0;
  let bundles = 0;

  for (const file of files) {
    const isCss = /\.css$/i.test(file);
    const isHtml = /\.html$/i.test(file);
    if (!isCss && !isHtml) continue;

    const before = fs.readFileSync(file, 'utf-8');
    let after = before;

    // 1. brand gradients (both CSS files and inline <style> in pages)
    let gradientHit = false;
    for (const [re, to] of GRADIENT_FIXES) {
      if (re.test(after)) gradientHit = true;
      after = after.replace(re, to);
    }
    if (gradientHit) gradientFiles++;

    if (isHtml) {
      // 2. heading promotion
      const beforePromote = after;
      for (const p of PROMOTIONS) {
        after = after.replace(p.re, (...m) => {
          promoted++;
          byKind.set(p.what, (byKind.get(p.what) || 0) + 1);
          return p.build(m);
        });
      }
      if (after !== beforePromote) promotedPages++;

      // 3. duplicate svg ids
      const res = uniquifySvgIds(after);
      if (res.renamed) {
        after = res.html;
        svgRenamed += res.renamed;
        svgPages++;
      }
    }

    // 2b. selectors that reached the promoted headings by tag
    const beforeSel = after;
    after = retagSelectors(after, isHtml);
    if (after !== beforeSel) cssPatched++;

    if (after !== before) fs.writeFileSync(file, after);
  }

  // 4 + 2c. pin typography and tap targets in every generated bundle
  const cssDir = path.join(DIST, 'assets', 'css');
  if (fs.existsSync(cssDir)) {
    for (const name of fs.readdirSync(cssDir)) {
      if (!/^vm-[0-9a-f]+\.css$/.test(name)) continue;
      const full = path.join(cssDir, name);
      const css = fs.readFileSync(full, 'utf-8');
      if (css.includes(CSS_MARKER)) continue;
      fs.writeFileSync(full, css + PRESERVE_CSS);
      bundles++;
    }
  }

  console.log(`   ✓ brand gradients normalised in ${gradientFiles} file(s)`);
  console.log(`   ✓ ${promoted} heading(s) promoted to h3 across ${promotedPages} page(s); ${cssPatched} stylesheet(s) re-selected`);
  for (const [what, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`       ${n}× ${what}`);
  }
  console.log(`   ✓ ${svgRenamed} duplicate SVG id group(s) namespaced across ${svgPages} page(s)`);
  console.log(`   ✓ typography + tap-target rules appended to ${bundles} bundle(s)`);
  console.log();
}

main();
