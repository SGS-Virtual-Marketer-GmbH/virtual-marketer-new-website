#!/usr/bin/env node

/**
 * Makes the scraped JavaScript files actually executable in a browser.
 *
 * THE BUG
 *
 * Every script on the 54 scraped pages was served, returned 200, and was then
 * silently refused by the browser. Measured in the page, not inferred:
 *
 *     typeof jQuery             → "undefined"
 *     typeof elementorFrontend  → "undefined"
 *     typeof wp.i18n            → "undefined"
 *
 * with no console error, because a MIME refusal is reported as a network-panel
 * warning rather than a script error.
 *
 * The cause is the wget artifact this repo already knows about elsewhere: the
 * scrape kept the query string inside the filename, so the file on disk is
 * literally
 *
 *     wp-includes/js/jquery/jquery.min.js?ver=3.7.1
 *
 * Both servers derive the Content-Type from the file extension, and the
 * extension of that name is ".1", not ".js". So it goes out as
 * application/octet-stream — and because the site correctly sends
 * X-Content-Type-Options: nosniff, the browser is required to refuse to
 * execute it. Two things that are individually right combined into a page
 * whose JavaScript never ran.
 *
 * The stylesheets never had this problem, and the reason is instructive: the
 * scrape appended ".css" to them ("style.css?ver=7.0.1.css") because wget's
 * --adjust-extension covers text/css and text/html but not JavaScript. So the
 * fix here is not an invention, it is applying the convention the CSS files
 * already follow.
 *
 * WHY RENAME RATHER THAN CONFIGURE THE SERVERS
 *
 * A MIME override could be added to nginx and to server.js. That is two
 * places to keep in sync, in two different syntaxes, for a rule whose reason
 * is invisible at the point of configuration — and it would not help anyone
 * who serves dist/ with a third server. Renaming fixes it once, in the
 * artifact, for every possible host.
 *
 * Idempotent: a file that already ends in .js is left alone.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, results);
    else results.push(full);
  }
  return results;
}

function findTextFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findTextFiles(full, results);
    else if (/\.(html|css)(\?|$)/i.test(entry.name)) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🔧 Fixing the Content-Type of scraped scripts...\n');

  // Files whose name contains ".js?" but does not end in ".js".
  const renames = new Map(); // old basename fragment → new
  let renamed = 0;

  for (const file of walk(DIST)) {
    const base = path.basename(file);
    if (!/\.js\?/i.test(base)) continue;
    if (/\.js$/i.test(base)) continue; // already fixed

    const next = `${base}.js`;
    const target = path.join(path.dirname(file), next);
    if (fs.existsSync(target)) continue;

    fs.renameSync(file, target);
    renamed++;

    // References use the percent-encoded form, because a literal "?" in an
    // attribute would be parsed as the start of a real query string — see the
    // resolveThemeAsset() comment in generate-blog-posts.js.
    renames.set(base.replace(/\?/g, '%3F'), next.replace(/\?/g, '%3F'));
    renames.set(base, next);
  }

  if (!renames.size) {
    console.log('✅ nothing to fix — every script file already ends in .js\n');
    return;
  }

  // Rewrite every reference. Longest first, so "a.js?ver=1" is never rewritten
  // by a rule for "a.js" leaving a mangled tail.
  const keys = [...renames.keys()].sort((a, b) => b.length - a.length);
  let touchedFiles = 0;
  let rewrittenRefs = 0;

  for (const file of findTextFiles(DIST)) {
    let text = fs.readFileSync(file, 'utf-8');
    const before = text;
    for (const key of keys) {
      if (!text.includes(key)) continue;
      const parts = text.split(key);
      rewrittenRefs += parts.length - 1;
      text = parts.join(renames.get(key));
    }
    if (text !== before) {
      fs.writeFileSync(file, text);
      touchedFiles++;
    }
  }

  console.log(`✅ ${renamed} script file(s) renamed so their extension is .js`);
  console.log(`   • ${rewrittenRefs} reference(s) updated across ${touchedFiles} file(s)`);

  // Verify: no page still points at a name that would be served as
  // application/octet-stream.
  const stale = [];
  for (const file of findTextFiles(DIST)) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const m of text.matchAll(/\bsrc=(["'])([^"']*\.js(?:%3F|\?)[^"']*)\1/gi)) {
      if (!/\.js$/i.test(m[2])) {
        stale.push(`${path.relative(DIST, file)} — ${m[2]}`);
        break;
      }
    }
  }
  if (stale.length) {
    console.log(`\n   ⚠ ${stale.length} reference(s) would still be served as octet-stream:`);
    stale.slice(0, 6).forEach((s) => console.log(`       ${s}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ every script reference now ends in .js');
  }
  console.log();
}

main();
