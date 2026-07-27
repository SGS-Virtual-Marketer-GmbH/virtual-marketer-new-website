#!/usr/bin/env node

/**
 * Removes the last two runtime-loaded third-party CDN dependencies on the
 * site: the Tailwind Play CDN script (cdn.tailwindcss.com) and the Feather
 * Icons CDN script (unpkg.com/feather-icons), both left over from the two
 * hand-built pages that predate the WordPress theme (virtual-marketer-ai-
 * services and management). Site-wide requirement is zero externally-loaded
 * libraries at runtime — everything must be self-hosted from our own domain.
 *
 * These two pages are raw WordPress-scrape source files (see SOURCE in
 * scripts/build.js), copied verbatim into dist/ by build.js — there's no
 * generator script to patch upstream, so this runs as a post-build text
 * transform over dist/, following the same convention as fix-broken-links.js
 * and fix-navigation.js.
 *
 * Tailwind: cdn.tailwindcss.com is the Play/browser build, meant for
 * prototyping only, and pulls the full JIT compiler + default theme over
 * the network on every page load. Replaced with a small locally-hosted,
 * purged stylesheet built from tailwind.config.js + assets/tailwind-
 * services/input.css (see `npm run build:tailwind`), covering exactly the
 * utility classes these two pages use.
 *
 * Feather Icons: unpkg.com/feather-icons pulls the entire ~280-icon library
 * over the network just to render the 26 icons virtual-marketer-ai-services
 * actually references via data-feather="...". Replaced with static inline
 * <svg> markup for just those 26 icons (scripts/lib/feather-icons-subset.js),
 * matching the class/attribute output feather.replace() used to produce.
 *
 * Run after scripts/optimize.js would be too late (optimize.js minifies/
 * inlines assets) — this runs earlier in the pipeline, alongside the other
 * fix-*.js content-repair scripts, before optimize.js does its pass.
 */

const fs = require('fs');
const path = require('path');
const { ICONS, featherSvg } = require('./lib/feather-icons-subset');

const DIST = path.join(__dirname, '../dist');
const TAILWIND_OUTPUT_SRC = path.join(__dirname, '../assets/tailwind-services/output.css');
const TAILWIND_DEST_REL = '/assets/tailwind-services/output.css';

const TARGETS = [
  path.join(DIST, 'virtual-marketer-ai-services/index.html'),
  path.join(DIST, 'management/index.html'),
];

function copyTailwindCss() {
  if (!fs.existsSync(TAILWIND_OUTPUT_SRC)) {
    throw new Error(
      `Missing ${TAILWIND_OUTPUT_SRC} — run "npm run build:tailwind" first (or it should run automatically before this script).`
    );
  }
  const destPath = path.join(DIST, 'assets/tailwind-services/output.css');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(TAILWIND_OUTPUT_SRC, destPath);
  return destPath;
}

function replaceTailwindCdn(html) {
  const before = html;
  html = html.replace(
    /\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*\n/,
    `\n    <link rel="stylesheet" href="${TAILWIND_DEST_REL}">\n`
  );
  return { html, changed: html !== before };
}

function replaceFeatherCdn(html) {
  let changed = false;

  // Drop the CDN <script> tag entirely (no local runtime replacement needed —
  // the <i data-feather> placeholders below are swapped for static <svg>s).
  const withoutScriptTag = html.replace(
    /\s*<script src="https:\/\/unpkg\.com\/feather-icons"><\/script>\s*\n/,
    '\n'
  );
  if (withoutScriptTag !== html) changed = true;
  html = withoutScriptTag;

  // Replace every <i data-feather="name" class="...">...</i> placeholder
  // with the equivalent static <svg>, preserving the class attribute so
  // existing Tailwind sizing/color utilities (w-8 h-8 text-blue-500, etc.)
  // keep working unchanged.
  let iconsReplaced = 0;
  const missing = new Set();
  html = html.replace(
    /<i\s+data-feather="([a-z0-9-]+)"(?:\s+class="([^"]*)")?\s*><\/i>/g,
    (match, name, className) => {
      const svg = featherSvg(name, className || '');
      if (!svg) {
        missing.add(name);
        return match;
      }
      iconsReplaced++;
      changed = true;
      return svg;
    }
  );
  if (missing.size > 0) {
    throw new Error(`Unknown feather icon name(s) referenced in HTML, not in scripts/lib/feather-icons-subset.js: ${[...missing].join(', ')}`);
  }

  // Remove the now-dead feather.replace() runtime call.
  const withoutReplaceCall = html.replace(
    /\s*\/\/ Initialize Feather Icons\s*\n\s*feather\.replace\(\);\s*\n/,
    '\n'
  );
  if (withoutReplaceCall !== html) changed = true;
  html = withoutReplaceCall;

  return { html, changed, iconsReplaced };
}

function main() {
  console.log('\n🎨 Removing external CDN dependencies (Tailwind Play CDN, Feather Icons CDN)...\n');

  copyTailwindCss();
  console.log('  ✓ Copied compiled Tailwind CSS into dist/assets/tailwind-services/output.css');

  let tailwindFixed = 0;
  let featherFixed = 0;
  let totalIcons = 0;

  for (const file of TARGETS) {
    if (!fs.existsSync(file)) {
      console.warn(`  ! Skipping missing file: ${file}`);
      continue;
    }
    let html = fs.readFileSync(file, 'utf-8');

    const tw = replaceTailwindCdn(html);
    html = tw.html;
    if (tw.changed) tailwindFixed++;

    const feather = replaceFeatherCdn(html);
    html = feather.html;
    if (feather.changed) featherFixed++;
    totalIcons += feather.iconsReplaced || 0;

    fs.writeFileSync(file, html);
  }

  console.log(`  ✓ Replaced Tailwind CDN <script> with local <link> on ${tailwindFixed} page(s)`);
  console.log(`  ✓ Replaced Feather CDN <script> + ${totalIcons} data-feather icon(s) with static SVG on ${featherFixed} page(s)`);
  console.log(`  ✓ ${Object.keys(ICONS).length} icon(s) available in the local subset\n`);
}

main();
