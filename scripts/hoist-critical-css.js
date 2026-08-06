#!/usr/bin/env node

/**
 * Moves this repo's injected <style> blocks from the end of <body> into <head>.
 *
 * WHAT THIS FIXES
 *
 * The homepage scored CLS 0.321 on mobile — three times the failing
 * threshold — with 0.212 of it attributed to a single element, the header
 * logo, and the rest to a button widget. Neither is animated and neither
 * loads late; the shift is caused by WHERE their styles are.
 *
 * Every pipeline step that restyles the scraped pages (make-header-sticky,
 * fix-legacy-header, mobile-polish) appends its snippet just before
 * </body>, because that is the one insertion point guaranteed to exist in a
 * WordPress export. On the homepage that puts those rules at byte ~131,000
 * of a 152,000-byte document: the browser has already parsed the whole page
 * and painted a header at the theme's original size before it reaches the
 * rules that shrink the logo to 34px, fix the header to the viewport and
 * resize the buttons. Then it relayouts, and everything below moves.
 *
 * The scripts in those snippets genuinely belong at the end of the body —
 * they query the DOM. The CSS does not. Splitting them is the whole fix:
 * the rules are applied before first paint, so there is nothing to correct
 * afterwards.
 *
 * WHY A SEPARATE STEP RATHER THAN FIXING EACH INJECTOR
 *
 * Three scripts had the bug and the next one to be written would have had
 * it too — appending before </body> is the obvious thing to do and nothing
 * about it announces the cost. Hoisting centrally means a new injector can
 * keep using the easy insertion point and still end up correct.
 *
 * ORDER
 *
 * Blocks are inserted immediately before </head>, in the order they
 * appeared in the body. That keeps them after every theme stylesheet, which
 * is what they rely on to win the cascade, and preserves their order
 * relative to each other (mobile-polish deliberately overrides
 * fix-legacy-header in places).
 *
 * Only blocks with an id starting "vm-" are touched — those are ours. A
 * theme or plugin style block late in the body is left exactly where it is;
 * moving someone else's CSS across the cascade is how you fix a metric and
 * break a page.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

/** <style id="vm-..."> ... </style>, non-greedy, id in either quote style. */
const VM_STYLE = /<style\b[^>]*\bid=["'](vm-[^"']*)["'][^>]*>[\s\S]*?<\/style>/gi;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function hoist(html) {
  const headEnd = html.search(/<\/head>/i);
  if (headEnd === -1) return null;

  const moved = [];
  let changed = false;

  // Walk matches once, keeping only those that start after </head>. Rebuilt
  // rather than replaced in place so the offsets stay valid while cutting.
  const body = html.slice(headEnd);
  const newBody = body.replace(VM_STYLE, (block, id) => {
    moved.push({ id, block });
    changed = true;
    return '';
  });

  if (!changed) return null;

  return (
    html.slice(0, headEnd) +
    moved.map((m) => m.block).join('\n') +
    '\n' +
    newBody
  );
}

function main() {
  console.log('\n⬆️  Hoisting injected CSS into <head>...\n');

  let pages = 0;
  let blocks = 0;
  const byId = new Map();

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const out = hoist(html);
    if (!out) continue;

    // Count what moved, for the summary.
    const before = (html.match(VM_STYLE) || []).length;
    VM_STYLE.lastIndex = 0;
    const headEnd = html.search(/<\/head>/i);
    const inBody = (html.slice(headEnd).match(VM_STYLE) || []).length;
    VM_STYLE.lastIndex = 0;
    void before;

    for (const m of html.slice(headEnd).matchAll(VM_STYLE)) {
      byId.set(m[1], (byId.get(m[1]) || 0) + 1);
    }

    fs.writeFileSync(file, out);
    pages++;
    blocks += inBody;
  }

  console.log(`✅ ${blocks} style block(s) moved into <head> across ${pages} page(s)`);
  for (const [id, n] of [...byId].sort((a, b) => b[1] - a[1])) {
    console.log(`   • ${id} — ${n} page(s)`);
  }

  // Nothing of ours should be left below </head>: a block that stays behind
  // is a layout shift that no longer shows up anywhere except the score.
  const leftovers = [];
  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    const headEnd = html.search(/<\/head>/i);
    if (headEnd === -1) continue;
    if (VM_STYLE.test(html.slice(headEnd))) leftovers.push(path.relative(DIST, file));
    VM_STYLE.lastIndex = 0;
  }
  if (leftovers.length) {
    console.log(`   ⚠ ${leftovers.length} page(s) still carry a vm-* style block in the body:`);
    leftovers.slice(0, 5).forEach((f) => console.log(`       ${f}`));
    process.exitCode = 1;
  } else {
    console.log('   ✓ no vm-* style block is left below </head>\n');
  }
}

main();
