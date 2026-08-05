#!/usr/bin/env node

/**
 * Makes external scripts non-render-blocking.
 *
 * The scraped pages load every script synchronously from <head>, so the
 * browser stops parsing until each one has been fetched and executed. After
 * the dead libraries were removed, this was what was left of the critical
 * path — Lighthouse attributes 908 ms to jQuery and 458 ms to jQuery Migrate
 * on a throttled mobile connection, on a page that renders nothing with them.
 *
 * WHY defer IS SAFE HERE, WHICH IS NOT A GIVEN
 *
 * Deferring a script that an inline script depends on breaks the page: the
 * inline block runs at parse time, the deferred one has not executed yet, and
 * `jQuery is not defined` is thrown before anything renders. That failure is
 * the reason "just add defer" is bad general advice.
 *
 * It does not apply here, and that was checked rather than assumed. Across
 * the built pages the inline scripts are:
 *
 *     21 inline blocks on the homepage
 *      0 that reference jQuery or $
 *     18 plain configuration assignments (elementorFrontendConfig, kirki, …)
 *      3 JSON-LD
 *
 * A configuration assignment is exactly the case defer handles correctly:
 * inline code runs during parsing, deferred code runs after parsing, so the
 * config is always in place before the script that reads it. The check is
 * re-run per page below, and any page that does have an inline jQuery
 * dependency is skipped rather than broken.
 *
 * Execution order between deferred scripts is preserved by the spec, so
 * jQuery still runs before the plugins that need it.
 *
 * NOT DEFERRED
 *
 *   Anything already marked async or defer.
 *   Scripts with type="module" (deferred by definition).
 *   JSON-LD and other non-JavaScript types.
 *   Our own booking widget and the inline behaviour scripts injected by
 *   mobile-polish.js — they are inline and already run at the right time.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/**
 * Scripts that must keep running synchronously, because an inline block
 * later in the page calls into them while the parser is still going.
 *
 * There is exactly one such chain, and it was found by the guard below
 * rather than guessed: every scraped page carries
 *
 *     wp.i18n.setLocaleData( { 'text directionltr': [ 'ltr' ] } );
 *
 * as an inline block, which needs wp-i18n — and wp-i18n needs wp-hooks.
 * Both are about 5 KB. Exempting them costs almost nothing and keeps the
 * 86 KB of jQuery, which is the actual expense, deferred.
 */
const KEEP_SYNC = [/\/dist\/hooks(\.min)?\.js/i, /\/dist\/i18n(\.min)?\.js/i];

/**
 * Does any inline script on this page need a library at parse time?
 *
 * Narrowed to the libraries that are actually deferred. `wp.` used to be in
 * here and matched the wp-i18n line above, which took all 54 pages out of
 * the optimisation to protect a 5 KB file — the guard was doing its job and
 * the response to it was wrong. Exempting that chain is the fix; widening
 * the blast radius was not.
 *
 * A false positive still costs a page its defer, which is the safe direction.
 */
const NEEDS_LIB_AT_PARSE = /\bjQuery\b|\$\s*\(|\belementorFrontend\./;

function inlineBlocksNeedingLibs(html) {
  const blocks = [...html.matchAll(/<script\b(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)];
  return blocks.filter(([, attrs, body]) => {
    // JSON-LD and other data blocks are not executed.
    if (/type=["'](application\/(ld\+json|json)|text\/template)["']/i.test(attrs)) return false;
    return NEEDS_LIB_AT_PARSE.test(body);
  }).length;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n⚡ Deferring render-blocking scripts...\n');

  let pages = 0;
  let deferred = 0;
  const skipped = [];

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');

    const risky = inlineBlocksNeedingLibs(html);
    if (risky > 0) {
      skipped.push(`${path.relative(DIST, file)} (${risky} inline block(s) use a library at parse time)`);
      continue;
    }

    let count = 0;
    let kept = 0;
    const out = html.replace(/<script\b([^>]*\bsrc=[^>]*)>/gi, (tag, attrs) => {
      if (/\b(defer|async)\b/i.test(attrs)) return tag;
      if (/type=["']module["']/i.test(attrs)) return tag;
      const src = (/\bsrc=["']([^"']+)["']/i.exec(attrs) || [])[1] || '';
      if (KEEP_SYNC.some((re) => re.test(src))) { kept++; return tag; }
      // Only plain JavaScript. A type we do not recognise is left alone.
      const type = (/type=["']([^"']+)["']/i.exec(attrs) || [])[1];
      if (type && !/^(text\/javascript|application\/javascript)$/i.test(type)) return tag;
      count++;
      return `<script defer${attrs}>`;
    });

    if (count) {
      fs.writeFileSync(file, out);
      pages++;
      deferred += count;
    }
  }

  console.log(`✅ ${deferred} script tag(s) deferred across ${pages} page(s)`);
  if (skipped.length) {
    console.log(`   • ${skipped.length} page(s) skipped — an inline script there needs a library while parsing:`);
    skipped.slice(0, 6).forEach((s) => console.log(`       ${s}`));
  } else {
    console.log('   • no page had an inline script depending on a library at parse time');
  }
  console.log();
}

main();
