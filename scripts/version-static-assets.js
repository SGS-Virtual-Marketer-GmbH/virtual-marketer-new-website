#!/usr/bin/env node

/**
 * Content-versions the hand-written /assets/ scripts and stylesheets.
 *
 * THE BUG THIS FIXES
 *
 * docker/nginx.conf.template serves everything matching
 * `\.(css|js|woff2?|ttf|eot|svg|avif|ico)$` with:
 *
 *   Cache-Control: public, max-age=31536000, immutable
 *
 * `immutable` is a promise that the bytes at this URL will never change,
 * and browsers keep that promise seriously: they do not revalidate, not on
 * reload, not for a year. That is exactly right for the CSS bundles, whose
 * filenames already contain a content hash (`/assets/css/vm-<hash>.css` —
 * see bundle-css.js), so new content always means a new URL.
 *
 * It was wrong for everything else. These shipped under stable names:
 *
 *   /assets/contact-form/contact-form.js      /assets/search/search.js
 *   /assets/lead-magnet/newsletter-signup.js  /assets/search/search.css
 *   /assets/lead-magnet/whitepaper-form.js    /assets/booking-widget/*
 *   /assets/model-request/model-request.js    ...and their stylesheets
 *
 * So a returning visitor — anyone who loaded a page before the deploy —
 * kept the OLD script for up to a year, with no way to get the new one
 * short of a hard refresh they have no reason to perform. Every
 * client-side change was invisible to exactly the people who visit most
 * often. That already mattered: the contact form's new consent checkbox,
 * the newsletter signup widget and the accessibility repairs in those
 * widgets all live in these files, and the API now *requires* the consent
 * field the new contact-form.js sends — an old cached copy would post
 * without it and get a 400 it has no message for.
 *
 * THE FIX
 *
 * Append `?v=<first 10 of sha256(file)>` to every such reference. The
 * query string is part of the browser's cache key but not part of the path
 * nginx resolves (try_files matches on $uri, which excludes the query), so
 * nothing on disk is renamed and no server config changes. New bytes
 * produce a new URL; unchanged bytes keep the same one and stay cached.
 *
 * RUNS LAST, AFTER force-light-mode.js, because that step rewrites CSS
 * content — hashing before it would stamp a hash of bytes that no longer
 * ship.
 *
 * Idempotent: an existing `?v=` is stripped before rehashing, so a second
 * run over the same dist produces identical output.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist');

/**
 * NOTHING IS EXCLUDED — INCLUDING THE vm-<hash>.css BUNDLES.
 *
 * They look like they need no help: bundle-css.js names each one after a
 * hash of its contents, so new content means a new URL. That reasoning
 * only holds if nothing touches the file afterwards, and two steps do.
 * bundle-css.js runs at step 46, but normalize-brand-palette.js (72) and
 * force-light-mode.js (77) both rewrite `dist/assets/css/vm-*.css` IN
 * PLACE, long after the name was chosen — the bundles on disk right now
 * contain zero `light-dark()` calls precisely because step 77 stripped
 * them out of files already named.
 *
 * So the filename describes the bytes as they were at step 46, not the
 * bytes we ship. A change that lands only in one of those later steps — a
 * brand-palette tweak is the obvious one — leaves the pre-step-72 content
 * identical, keeps the old filename, and publishes different bytes at a
 * URL still promising `immutable, max-age=31536000`. Returning visitors
 * would hold the stale stylesheet for a year: exactly the failure this
 * script exists to prevent, which the exclusion had carved back out of it.
 *
 * Hashing them here costs one extra digest per bundle and makes the URL
 * describe what actually ships.
 */

/**
 * Matches a root-relative reference and any version query we previously
 * added.
 *
 * The leading delimiter is load-bearing, not decoration. Without it the
 * pattern also matches INSIDE a longer relative URL that merely contains
 * the sequence `/assets/` — the export has one,
 *
 *   ../wp-content/plugins/js_composer/assets/js/dist/js_composer_front.min.js%3Fver=6.7.0.js
 *
 * on /nutzungsbedingungen/, which resolves perfectly well and is not ours
 * to touch. Matching its tail as `/assets/js/dist/js_composer_front.min.js`
 * meant looking up a file that does not exist (harmless, reported as a
 * spurious "missing" warning) — but had a file by that name existed under
 * dist/assets, the rewrite would have spliced `?v=…` into the middle of
 * somebody else's URL and broken the page. So a match only counts when the
 * path starts right after a quote, an opening paren or whitespace.
 */
const REF = /(["'(\s])(\/assets\/[A-Za-z0-9_./-]+\.(?:js|css))(\?v=[0-9a-f]+)?/g;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🔖 Versioning static assets for cache-busting...\n');

  if (!fs.existsSync(DIST)) {
    console.log('   ⚠ dist/ not found — nothing to do\n');
    return;
  }

  /** assetPath -> `?v=hash`, or null when the file is not on disk. */
  const versions = new Map();
  const missing = new Set();

  function versionFor(assetPath) {
    if (versions.has(assetPath)) return versions.get(assetPath);
    const abs = path.join(DIST, assetPath.replace(/^\//, ''));
    let v = null;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      v = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 10);
    } else {
      missing.add(assetPath);
    }
    versions.set(assetPath, v);
    return v;
  }

  let pages = 0;
  let rewrites = 0;

  for (const file of findHtmlFiles(DIST)) {
    const before = fs.readFileSync(file, 'utf-8');
    const after = before.replace(REF, (whole, delim, assetPath) => {
      const v = versionFor(assetPath);
      if (!v) return whole; // unknown file: leave it exactly as it was
      rewrites++;
      return `${delim}${assetPath}?v=${v}`;
    });

    if (after !== before) {
      fs.writeFileSync(file, after);
      pages++;
    }
  }

  const stamped = [...versions.entries()].filter(([, v]) => v);
  console.log(`   ✓ ${rewrites} reference(s) across ${pages} page(s) stamped with a content version`);
  console.log(`   ✓ ${stamped.length} distinct asset(s) versioned:`);
  for (const [p, v] of stamped.sort()) console.log(`       ${p}?v=${v}`);

  if (missing.size) {
    console.log(`   ⚠ ${missing.size} reference(s) point at a file not in dist/ and were left unversioned:`);
    for (const p of missing) console.log(`       ${p}`);
  }
  console.log();
}

main();
