#!/usr/bin/env node

/**
 * Removes the last WordPress runtime leftovers and the files nothing uses.
 *
 * The site is static; no WordPress runs behind it. scripts/strip-wp-cruft.js
 * and scripts/strip-dead-assets.js already took the head plumbing and the
 * plugin bundles out of the markup. What is still there, measured on dist/:
 *
 *   - 55 pages load the Gutenberg client packages from wp-includes/js/dist
 *     (react, data, element, hooks, i18n, compose, keycodes, ...): up to 17
 *     script tags per page, plus their inline "-js-after" / "-js-translations"
 *     companions and comment-reply.js. Nothing on those pages calls them.
 *   - the emoji-styles inline <style> that WordPress prints for its emoji
 *     script (the script itself is long gone).
 *   - ~11 MB of plugin, theme and wp-includes files no page reaches any more.
 *
 * KEPT ON PURPOSE: the block-library / global-styles CSS (bundled stylesheets
 * still use its --wp--* variables) and everything in wp-content/uploads
 * (images may be linked from outside, and Google Images may hold them).
 *
 * Deleting is done by reachability, not by a list: a file inside
 * wp-content/plugins, wp-content/themes or wp-includes is only removed if its
 * file name appears in no surviving HTML/CSS/JS/JSON text, transitively
 * (a stylesheet that is itself unreachable does not keep its font alive).
 * File names are compared without the `?ver=` suffix, so two files that only
 * differ by version keep each other alive; that errs on the side of keeping.
 *
 * Runs late, after everything that could add a reference, and before
 * scripts/version-static-assets.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const ZONES = ['wp-content/plugins', 'wp-content/themes', 'wp-includes'];
const TEXT_EXT = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.webmanifest']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (f) => path.relative(DIST, f).split(path.sep).join('/');
const inZone = (r) => ZONES.some((z) => r.startsWith(z + '/'));
/** File name without directory and without the WordPress `?ver=` suffix. */
const keyOf = (r) => decodeURIComponent(path.posix.basename(r)).replace(/\?.*$/, '');

/* ---- 1. markup: Gutenberg scripts, their inline companions, emoji styles ---- */

const SCRIPT_SRC = /<script\b[^>]*\bsrc=["'][^"']*wp-includes\/[^"']*["'][^>]*>\s*<\/script>\s*/gi;
const SCRIPT_INLINE = /<script\b[^>]*\bid=["'](?:wp-[a-z0-9-]+-js-(?:after|before|extra|translations)|comment-reply-js[a-z-]*)["'][^>]*>[\s\S]*?<\/script>\s*/gi;
const EMOJI_STYLE = /<style\b[^>]*\bid=["']wp-emoji-styles-inline-css["'][^>]*>[\s\S]*?<\/style>\s*/gi;

function stripMarkup() {
  let pages = 0;
  let tags = 0;
  for (const file of walk(DIST)) {
    if (!file.endsWith('.html')) continue;
    const before = fs.readFileSync(file, 'utf-8');
    let after = before;
    for (const re of [SCRIPT_SRC, SCRIPT_INLINE, EMOJI_STYLE]) {
      after = after.replace(re, () => { tags++; return ''; });
    }
    if (after !== before) { fs.writeFileSync(file, after); pages++; }
  }
  return { pages, tags };
}

/* ---- 2. files: keep what is reachable from the rest of the site ---- */

function sweepFiles() {
  const files = walk(DIST).map((f) => ({ file: f, rel: rel(f) }));
  const candidates = files.filter((f) => inZone(f.rel));
  const roots = files.filter((f) => !inZone(f.rel) && TEXT_EXT.has(path.extname(f.rel).split('?')[0]));

  const read = (f) => {
    try { return decodeURIComponent(fs.readFileSync(f.file, 'utf-8')); }
    catch { return fs.readFileSync(f.file, 'utf-8'); }
  };
  let blob = roots.map(read).join('\n');

  const alive = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of candidates) {
      if (alive.has(c.rel)) continue;
      if (blob.includes(keyOf(c.rel))) {
        alive.add(c.rel);
        grew = true;
        if (/\.(css|js|json|svg)(\?|$)/i.test(c.rel)) blob += '\n' + read(c);
      }
    }
  }

  let removed = 0;
  let bytes = 0;
  for (const c of candidates) {
    if (alive.has(c.rel)) continue;
    bytes += fs.statSync(c.file).size;
    fs.rmSync(c.file);
    removed++;
  }

  // Empty directories left behind.
  const prune = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(path.join(dir, e.name));
    if (dir !== DIST && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  };
  for (const z of ZONES) if (fs.existsSync(path.join(DIST, z))) prune(path.join(DIST, z));

  return { removed, bytes };
}

function main() {
  console.log('\n🧹 Removing WordPress runtime leftovers and unreachable plugin/theme files...\n');
  const m = stripMarkup();
  console.log(`   ✓ ${m.tags} script/style tag(s) removed from ${m.pages} page(s)`);
  const s = sweepFiles();
  console.log(`   ✓ ${s.removed} unreachable file(s) deleted (${(s.bytes / 1024 / 1024).toFixed(1)} MB)\n`);
}

main();
