#!/usr/bin/env node

/**
 * Skip link ("Zum Inhalt springen" / "Skip to content")
 *
 * The first focusable element on every page, landing on that page's main
 * content landmark. Without it, a keyboard user has to tab through the
 * header/nav (six links plus a language switcher, on most pages) before
 * reaching anything the page is actually about — every time, on every page.
 * Visually hidden until it receives focus (assets/enhance/enhance.css's
 * .vm-skip-link), so sighted mouse users never see it.
 *
 * scripts/fix-a11y.js already guarantees every page has a landmark (a real
 * <main> from the theme, or a role="main" wrapper it adds itself where the
 * theme has none) — verified against dist/: 232 pages with a real <main>,
 * 6 with the role="main" fallback, 238 total, zero missing. What's missing
 * is an id to link to: 47 of those <main>s already carry id="main" (left
 * alone here — no reason to rename a working anchor), the rest carry none.
 * This adds id="main-content" wherever there isn't already an id, then
 * points the skip link at whichever id the page turns out to have.
 *
 * Run after scripts/fix-a11y.js (needs its landmark guarantee) and anywhere
 * before scripts/inject-enhance.js (needs .vm-skip-link's CSS, which lives
 * there) — in practice, right next to fix-a11y.js in the build script list.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const MARKER = 'vm-skip-link';

const LANDMARK_RE = /<main\b([^>]*)>|<div\b([^>]*\brole=["']main["'][^>]*)>/i;
const BODY_RE = /<body\b[^>]*>/i;

/**
 * A same-length stand-in for html with every <script>, <style> and comment
 * blanked out — used only to decide WHERE to match, never to build output,
 * so indices still point at the real markup underneath.
 *
 * Not a theoretical concern: one page in this build carries a CSS comment
 * that reads "The theme hides <body> itself (anti-flash-of-unstyled-
 * content), not just #page…" — genuine documentation prose, not markup. The
 * first pass of this script matched that "<body>" as if it were the real
 * tag and spliced the skip link into the middle of the comment, breaking
 * both the comment and the <style> block it lived in. Masking comments and
 * style/script bodies out before matching means a sentence that happens to
 * contain "<body>" or "<main>" can no longer be mistaken for one.
 */
function maskNonMarkup(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, (m) => ' '.repeat(m.length));
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
  console.log('\n⏭️  Adding the skip link...\n');

  let added = 0;
  let idsGiven = 0;
  let noLandmark = 0;

  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    if (html.includes(MARKER)) continue;

    const isEnglish = /\/en\//.test(file.split(path.sep).join('/')) || /<html[^>]+lang=["']en/i.test(html);
    const label = isEnglish ? 'Skip to content' : 'Zum Inhalt springen';

    let masked = maskNonMarkup(html);
    const match = masked.match(LANDMARK_RE);
    if (!match) {
      // Covered by fix-a11y.js today (0 pages missing a landmark as of this
      // writing) — guarded rather than assumed, so a future page that slips
      // through is skipped cleanly instead of getting a skip link with
      // nowhere to land.
      noLandmark++;
      continue;
    }

    const attrs = match[1] !== undefined ? match[1] : match[2];
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    let targetId = idMatch && idMatch[1];

    if (!targetId) {
      targetId = 'main-content';
      // Append id="…" just before the tag's closing ">" rather than
      // `.replace(attrs, …)`: attrs is empty for a bare `<main>`, and
      // String.replace with an empty search string matches at index 0 of
      // the whole tag, not inside the attribute list — it would insert
      // before the tag name instead of into it.
      const openTag = match[0];
      const withId = openTag.slice(0, -1) + ` id="${targetId}">`;
      html = html.slice(0, match.index) + withId + html.slice(match.index + openTag.length);
      masked = masked.slice(0, match.index) + ' '.repeat(withId.length) + masked.slice(match.index + openTag.length);
      idsGiven++;
    }

    const bodyOpen = masked.match(BODY_RE);
    if (!bodyOpen) continue;
    const at = bodyOpen.index + bodyOpen[0].length;
    const skipLink = `\n<a href="#${targetId}" class="${MARKER}">${label}</a>`;
    html = html.slice(0, at) + skipLink + html.slice(at);

    fs.writeFileSync(file, html);
    added++;
  }

  console.log(`✅ Skip link added to ${added} page(s)`);
  console.log(`   • ${idsGiven} main landmark(s) given an id`);
  if (noLandmark) console.log(`   ⚠ ${noLandmark} page(s) skipped — no main landmark found`);
  console.log();
}

main();
