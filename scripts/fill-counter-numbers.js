#!/usr/bin/env node

/**
 * Fills in the step numbers the theme's counter widget leaves empty.
 *
 * The "Mit Ihren Daten und unserer KI zum Erfolg" strip is built from the
 * theme's `icounter3` widget, which ships this markup per step:
 *
 *   <span class="num" data-to="1" data-time="100"></span>
 *   <span>.</span>
 *   <h6>Auto Analyse</h6>
 *
 * The number is deliberately absent from the HTML: on WordPress a script
 * counts it up from zero to `data-to` when the widget scrolls into view.
 * That script does not run here — this is a static export, and the
 * theme's elementor.js is not wired up — so the span stays empty forever
 * and the separator beside it does not.
 *
 * What visitors see is a stray 45px period floating to the left of each
 * label: ". Auto Analyse" instead of "1. Auto Analyse". It reads as a
 * rendering glitch, which is roughly what it is, and it removes the one
 * thing the strip is trying to communicate — that these are three ordered
 * steps rather than three unrelated features.
 *
 * Writing the number into the HTML fixes it without adding JavaScript.
 * The count-up was decoration; the number is the content, and content
 * belongs in the markup. If the theme's script is ever restored it will
 * simply animate from zero over a value that is already correct, so this
 * stays compatible rather than conflicting.
 *
 * Only empty spans are touched, so the step is idempotent and cannot
 * overwrite a number that is already there.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

/** An empty `.num` span carrying the value it was supposed to count to. */
const EMPTY_COUNTER = /(<span\b[^>]*\bclass=["'][^"']*\bnum\b[^"']*["'][^>]*\bdata-to=["'](\d+)["'][^>]*>)(\s*)(<\/span>)/gi;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function main() {
  console.log('\n🔢 Filling in empty counter numbers...\n');

  if (!fs.existsSync(DIST)) {
    console.log('   ⚠ dist/ not found — nothing to do\n');
    return;
  }

  let pages = 0;
  let filled = 0;

  for (const file of walk(DIST)) {
    const before = fs.readFileSync(file, 'utf-8');
    if (!before.includes('data-to=')) continue;
    const after = before.replace(EMPTY_COUNTER, (whole, open, value, gap, close) => {
      filled++;
      return `${open}${value}${close}`;
    });
    if (after !== before) {
      fs.writeFileSync(file, after);
      pages++;
    }
  }

  console.log(`   ✓ ${filled} counter(s) given their number across ${pages} page(s)`);
  console.log();
}

main();
