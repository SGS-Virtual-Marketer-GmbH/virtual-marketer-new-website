#!/usr/bin/env node

/**
 * Automatic dark theme via CSS light-dark().
 *
 * The site's markup hardcodes its light palette in thousands of
 * declarations across the Elementor bundles and forty-odd generated page
 * styles — a classic dark-mode dead end if approached selector by
 * selector. This step instead maps the PALETTE mechanically: every color
 * declaration gets a light-dark() twin whose dark value is derived in HSL
 * (hue preserved, lightness flipped into the dark band), so brand tints
 * stay in the brand's world instead of going generic gray.
 *
 * Each matching declaration is DUPLICATED, not replaced:
 *
 *     background:#fff;background:light-dark(#fff,#131518)
 *
 * Modern browsers use the later declaration and resolve it against the
 * visitor's OS scheme (color-scheme: light dark is set in enhance.css);
 * anything too old for light-dark() drops the invalid declaration and
 * keeps today's light value — the site can never end up unstyled.
 *
 * WHY CONTEXT-AWARE: the same hex means opposite things in different
 * properties. #fff as a background must turn dark; #fff as button text on
 * a vm-red fill must stay white. So the mapping depends on the property:
 *
 *   background(-color):  light colors (L ≥ .75) → dark surface, same hue
 *   color:               dark colors (L ≤ .5)   → light text, same hue
 *                        (saturated accents keep saturation and only
 *                        lift lightness, so red stays readable red)
 *   border*:             light grays (L ≥ .7)   → dark border
 *   --custom-props:      whole-value light hexes → dark surface twin
 *                        (the generated pages theme via --vm-gray-*);
 *                        dark-valued props are left alone — they may be
 *                        backgrounds that are already correct on dark.
 *
 * Shadows are untouched (already translucent black), images are never
 * filtered. Idempotent by reconstruction: previously added twins are
 * stripped before re-applying, so re-runs rebuild instead of stacking.
 *
 * Runs after consolidate-fonts.js, before inject-enhance.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

// ---- color math ----------------------------------------------------------

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hsl(hex) {
  return rgbToHsl(...hexToRgb(hex));
}

const surfaceDark = (hex) => {
  const [h, s, l] = hsl(hex);
  return hslToHex(h, Math.min(s, 0.3), 0.09 + (1 - l) * 0.09);
};
const textLight = (hex) => {
  const [h, s, l] = hsl(hex);
  if (s < 0.15) return hslToHex(h, s, 0.86 - l * 0.15);
  return hslToHex(h, s, Math.max(0.62, 1 - l));
};
const borderDark = (hex) => {
  const [h, s, l] = hsl(hex);
  return hslToHex(h, Math.min(s, 0.25), 0.16 + (1 - l) * 0.1);
};

// ---- declaration transforms ----------------------------------------------

const HEX_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const WHITE_RGBA = /rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*([\d.]+)\s*)?\)/g;

function mapValue(value, prop) {
  let changed = false;
  let out = value.replace(HEX_RE, (hex) => {
    const [, , l] = hsl(hex);
    let mapped = null;
    if (/^background/.test(prop) && l >= 0.75) mapped = surfaceDark(hex);
    else if (prop === 'color' && l <= 0.5) mapped = textLight(hex);
    else if (/^border/.test(prop) && l >= 0.7) mapped = borderDark(hex);
    if (!mapped) return hex;
    changed = true;
    return `light-dark(${hex},${mapped})`;
  });
  if (/^background/.test(prop)) {
    out = out.replace(WHITE_RGBA, (m, alpha) => {
      changed = true;
      const a = alpha !== undefined ? `,${alpha}` : ',1';
      return `light-dark(rgba(255,255,255${a}),rgba(19,21,24${a}))`;
    });
  }
  return changed ? out : null;
}

const PROPS = /(?:^|[;{])\s*(color|background|background-color|border(?:-(?:top|right|bottom|left))?(?:-color)?)\s*:([^;{}]+)/g;
const CUSTOM_PROP = /(?:^|[;{])\s*(--[\w-]+)\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\s*(?=[;}])/g;

// Twins this script added on a previous run — stripped before re-applying,
// which is what makes the step idempotent. The site's own CSS never uses
// light-dark(), so this can only ever remove our own additions.
const OWN_TWIN = /;(?:color|background|background-color|border(?:-(?:top|right|bottom|left))?(?:-color)?|--[\w-]+):[^;{}]*light-dark\([^{}]*?(?=[;}])/g;

function themeCssText(css, varMap) {
  let additions = 0;
  let next = css.replace(OWN_TWIN, '');
  next = next.replace(PROPS, (decl, prop, value) => {
    if (value.includes('light-dark(')) return decl;
    let dark = mapValue(value, prop);
    // color:var(--x) where --x holds a dark hex: the definition is left
    // alone (a dark custom prop may legitimately be a dark background),
    // so dark-text uses are resolved and twinned here at the use site.
    if (!dark && prop === 'color') {
      const v = value.match(/^\s*var\((--[\w-]+)\)\s*$/);
      const resolved = v && varMap.get(v[1]);
      if (resolved) {
        const [, , l] = hsl(resolved);
        if (l <= 0.5) dark = `light-dark(var(${v[1]}),${textLight(resolved)})`;
      }
    }
    if (!dark) return decl;
    additions++;
    return `${decl};${prop}:${dark.trim()}`;
  });
  next = next.replace(CUSTOM_PROP, (decl, name, hex) => {
    const [, , l] = hsl(hex);
    if (l < 0.75) return decl;
    additions++;
    return `${decl};${name}:light-dark(${hex},${surfaceDark(hex)})`;
  });
  return { next, additions };
}

// ---- file walk ------------------------------------------------------------

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🌗 Enabling automatic dark theme (light-dark() palette mapping)...\n');

  let files = 0;
  let decls = 0;

  const targets = walk(DIST).filter((f) => /\.css$/.test(f) || f.includes('.css?') || f.endsWith('.html'));

  // Global custom-property map (name → original hex), collected before any
  // transformation so use-site resolution works across files (a var defined
  // in a bundle, used in an inline style, or vice versa).
  const varMap = new Map();
  for (const f of targets) {
    const text = fs.readFileSync(f, 'utf-8');
    for (const m of text.matchAll(/(--[\w-]+)\s*:\s*(#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\s*[;}]/g)) {
      varMap.set(m[1], m[2]);
    }
  }

  for (const f of targets) {
    const isHtml = f.endsWith('.html');
    const text = fs.readFileSync(f, 'utf-8');
    let next;
    let additions = 0;

    if (!isHtml) {
      ({ next, additions } = themeCssText(text, varMap));
    } else {
      next = text.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, css, close) => {
        const r = themeCssText(css, varMap);
        additions += r.additions;
        return open + r.next + close;
      });
    }

    if (next !== text) {
      fs.writeFileSync(f, next);
      files++;
      decls += additions;
    }
  }

  console.log(`✅ ${decls} declaration(s) themed across ${files} file(s)\n`);
}

main();
