#!/usr/bin/env node

/**
 * Darkens the theme's button gradients until white text on them is legible.
 *
 * THE DEFECT
 *
 * The site's buttons are painted with a brand gradient that runs from the
 * brand red to the brand blue, and their label is white. White on the red end
 * is 8.8:1 and fine. White on the blue end is not:
 *
 *     #66B4DB   2.3:1     header "Login" button        (post-5598.css)
 *     #68A1CC   2.7:1     hero CTA                     (post-5668.css)
 *     #A4CEE8   1.7:1     CTA hover state              (post-5668.css)
 *     #E49BA7   2.2:1     CTA hover state              (post-5668.css)
 *
 * WCAG 1.4.3 asks for 4.5:1 at these sizes (16px, and bold does not lower the
 * bar until 18.66px). So roughly the right-hand half of the site's primary
 * call to action has label text that is somewhere between hard and impossible
 * to read — worst on the hover state, which is exactly when the user has
 * committed to clicking it.
 *
 * WHY COMPUTE RATHER THAN HAND-PICK
 *
 * Hand-picking replacement hexes means the next person who adds a gradient
 * has to know to check it, and Elementor writes these files from the page
 * builder, so new ones appear without anyone editing CSS. This walks every
 * gradient on a button rule, measures each colour stop against white, and
 * darkens the ones that fail — scaling the RGB triple toward black, which
 * holds the hue exactly and only moves lightness. The brand colours survive
 * as recognisably themselves; they just stop being pastel.
 *
 * Stops that already pass are left byte-for-byte alone, so a rebuild after
 * this has run is a no-op.
 *
 * SCOPE
 *
 * Only gradients belonging to a selector that names a button class. A
 * gradient behind a hero image or a decorative panel carries no text and is
 * not this rule's business; darkening it would be a design change with no
 * accessibility argument behind it.
 *
 * Runs before scripts/bundle-css.js, so the bundles are built from the fixed
 * files rather than needing a second pass.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/** White text is what sits on these gradients. */
const TEXT = [255, 255, 255];

/** WCAG AA for body-size text. The buttons are 16px, so the large-text 3:1 does not apply. */
const TARGET = 4.5;

/** Selectors whose backgrounds carry a label. */
const BUTTON_SELECTOR = /\.elementor-button|\.octf-btn|\bbtn\b/i;

const relLum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0').toUpperCase()).join('');

const parseHex = (s) => {
  const h = s.slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

/**
 * Scales `rgb` toward black until white text on it reaches TARGET.
 *
 * Multiplying the triple is a pure lightness move in the sense that matters
 * here: the ratios between the channels are preserved, so the hue is
 * unchanged. (It does raise saturation slightly, which reads as the colour
 * getting *more* itself, not less — the right direction for a brand colour.)
 */
function darkenToPass(rgb) {
  if (contrast(TEXT, rgb) >= TARGET) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const candidate = rgb.map((c) => c * mid);
    if (contrast(TEXT, candidate) >= TARGET) lo = mid;
    else hi = mid;
  }
  // lo is the lightest scale that still passes; keep the colour as light as
  // the criterion allows so the change is the smallest one that works.
  //
  // Rounding to whole channel values can push the result back below the
  // target by a hundredth — the search runs on floats, the output is eight
  // bits — so step down until the colour that actually ships passes.
  let out = rgb.map((c) => Math.round(c * lo));
  while (contrast(TEXT, out) < TARGET && out.some((c) => c > 0)) {
    out = out.map((c) => Math.max(0, c - 1));
  }
  return out;
}

/** The colour stops of every gradient in a declaration block. */
function gradientStops(body) {
  const stops = [];
  for (const g of body.matchAll(/(?:linear|radial)-gradient\(([^()]*)\)/gi)) {
    for (const m of g[1].matchAll(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi)) stops.push(m[0]);
  }
  return stops;
}

/**
 * Splits a stylesheet into `{ selector, body }` chunks. Deliberately crude —
 * it only needs to answer "does this declaration block belong to a button",
 * and these are minified Elementor files with no nested at-rules inside the
 * rules we care about.
 */
function eachRule(css, visit) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) { out += css.slice(i); break; }
    const close = css.indexOf('}', open);
    if (close === -1) { out += css.slice(i); break; }

    const selector = css.slice(i, open);
    const body = css.slice(open + 1, close);
    out += selector + '{' + visit(selector, body) + '}';
    i = close + 1;
  }
  return out;
}

function fixCss(css, report) {
  return eachRule(css, (selector, body) => {
    if (!BUTTON_SELECTOR.test(selector)) return body;
    if (!/linear-gradient|radial-gradient/i.test(body)) return body;

    return body.replace(/(linear-gradient|radial-gradient)\(([^()]*)\)/gi, (whole, kind, args) => {
      const fixedArgs = args.replace(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi, (colour) => {
        const rgb = parseHex(colour);
        const darker = darkenToPass(rgb);
        if (!darker) return colour;
        report.push({
          from: colour.toUpperCase(),
          to: hex(darker),
          was: +contrast(TEXT, rgb).toFixed(2),
          now: +contrast(TEXT, darker).toFixed(2),
          selector: selector.trim().split(',')[0].slice(-60),
        });
        return hex(darker);
      });
      return `${kind}(${fixedArgs})`;
    });
  });
}

function findFiles(dir, exts, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, exts, results);
    else if (exts.some((e) => entry.name.toLowerCase().includes(e))) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🎨 Raising button-gradient contrast...\n');

  const report = [];
  let files = 0;

  // Stylesheets. The WordPress export keeps its query string in the filename,
  // so match on ".css" appearing anywhere rather than on the extension.
  for (const file of findFiles(DIST, ['.css'])) {
    const original = fs.readFileSync(file, 'utf-8');
    const fixed = fixCss(original, report);
    if (fixed !== original) {
      fs.writeFileSync(file, fixed);
      files++;
    }
  }

  // Inline <style> blocks in the pages.
  for (const file of findFiles(DIST, ['.html'])) {
    const original = fs.readFileSync(file, 'utf-8');
    const fixed = original.replace(
      /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (whole, open, css, close) => open + fixCss(css, report) + close
    );
    if (fixed !== original) {
      fs.writeFileSync(file, fixed);
      files++;
    }
  }

  const distinct = new Map();
  for (const r of report) if (!distinct.has(r.from)) distinct.set(r.from, r);

  console.log(`✅ ${report.length} gradient stop(s) darkened across ${files} file(s)`);
  for (const r of distinct.values()) {
    console.log(`   • ${r.from} → ${r.to}   white text ${r.was}:1 → ${r.now}:1`);
  }
  if (!report.length) console.log('   ✓ every button gradient already passes');

  // Nothing on a button may still fail.
  const leftovers = [];
  for (const file of findFiles(DIST, ['.css'])) {
    eachRule(fs.readFileSync(file, 'utf-8'), (selector, body) => {
      if (BUTTON_SELECTOR.test(selector)) {
        // Only the gradient's own stops. A `color:#fff` in the same block is
        // the label, not the backdrop, and reading it as a stop is how the
        // first version of this check reported the text colour as a failure.
        for (const stop of gradientStops(body)) {
          if (contrast(TEXT, parseHex(stop)) < TARGET) {
            leftovers.push(`${path.relative(DIST, file)} ${stop}`);
          }
        }
      }
      return body;
    });
  }
  if (leftovers.length) {
    console.log(`   ⚠ ${leftovers.length} button gradient stop(s) still fail:`);
    leftovers.slice(0, 5).forEach((l) => console.log(`       ${l}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ white text passes 4.5:1 on every button gradient stop\n');
  }
}

main();
