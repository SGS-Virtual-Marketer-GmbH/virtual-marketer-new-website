#!/usr/bin/env node

/**
 * Guards against `<img>` tags that carry no `alt` attribute at all — a hard
 * accessibility and SEO failure distinct from `alt=""`, which is the
 * legitimate way to mark a decorative image and is never touched here.
 *
 * IMPORTANT CONTEXT ON THE NUMBERS THIS WAS COMMISSIONED AGAINST: the sweep
 * brief quoted "236 images with no alt attribute at all", re-verified by the
 * requester as more trustworthy than an earlier automated report. Measuring
 * directly against dist/ (238 files) turned up a different reality:
 *
 *   - `grep -o '<img' dist -r` does find 804 occurrences — but 236 of those
 *     are the literal string "A 565px-wide <img> inside a 375px column…"
 *     inside the #vm-mobile-polish `<style>` comment that
 *     scripts/mobile-polish.js injects into every page's <head>. That is a
 *     code comment, not a tag — and 236 is exactly the sweep's "no alt"
 *     count, confirmed by grepping that exact string across dist/.
 *   - 1 more is an `<img …>` string assembled inside a `<script>`-embedded
 *     JS template literal on /virtual-marketer-ai-services/ (a simulated
 *     chat widget's demo reply) — never present in the static markup a
 *     crawler or screen reader parses, only materialising client-side.
 *   - That leaves 567 real, static `<img>` tags. Every single one already
 *     carries an `alt` attribute (449 with real text, 118 with `alt=""` on
 *     a repeated small WordPress author-avatar icon in blog bylines —
 *     legitimately decorative, left alone by design).
 *
 * So the true count of `<img>` tags missing `alt` in the current dist/ is 0,
 * not 236 — and this script reports exactly that (see its own console
 * output). It still ships as a permanent guard rather than a one-off: any
 * future page generator that forgets an `alt` (WordPress source HTML
 * frequently does) is caught and repaired the next time the pipeline runs,
 * using this priority of signals per image:
 *
 *   1. the image's own `title` attribute
 *   2. its enclosing `<figure>`'s `<figcaption>` text
 *   3. visible link text sharing the same `<a>` as the image (an icon next
 *      to a text label), or that `<a>`'s `aria-label` (an icon-only link)
 *   4. the nearest preceding heading (h1–h4) in the same document
 *   5. the filename, cleaned up (query string, WP `-{w}x{h}` thumbnail
 *      suffix and a trailing hash-looking segment stripped, extension
 *      dropped, hyphens/underscores to spaces, sentence-cased)
 *
 * A signal that is empty, boilerplate ("image", "photo", numbers only) or
 * absent (e.g. a data: URI with no filename at all) means nothing reliable
 * was found — the image is left `alt=""` and counted as decorative rather
 * than given an invented description; a wrong alt actively misleads a
 * screen-reader user in a way a silent one does not.
 *
 * <style>/<script>/comment blocks are blanked out (same length, so every
 * other offset in the file still lines up) before scanning, specifically so
 * this script can never touch the mobile-polish CSS comment above or any
 * JS-template-literal HTML string — both parse as `<img>` tags to a naive
 * regex, and neither is real, static, user-facing markup.
 *
 * Idempotent: an image this script has already given an alt to no longer
 * matches "missing alt" on the next run. Runs after fix-a11y.js (which is
 * where alt="" on decorative icons already gets set — this script must
 * never re-open one of those) and before fix-title-meta-lengths.js, the
 * last SEO-content pass before enrich-structured-data.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const IMG_RE = /<img\s[^>]*>/g;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '));
}

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'is'));
  return m ? decodeEntities(m[2]) : null;
}

// Blanks every stretch of the document that is NOT real, static, rendered
// markup — style/script bodies and comments — replacing each character with
// a space so byte offsets are unchanged. All detection below runs against
// this blanked copy; the rewrite is applied to the real, original html at
// the same offsets, so a match can never come from a CSS comment or a JS
// template-literal string.
function blankNonMarkup(html) {
  return html.replace(/<!--[\s\S]*?-->|<style[^>]*>[\s\S]*?<\/style>|<script[^>]*>[\s\S]*?<\/script>/g, (m) =>
    m.replace(/[^\n]/g, ' ')
  );
}

// Cleans a WordPress-style filename into readable words: strips the query
// string, the "cropped-" prefix, a trailing "-{width}x{height}" thumbnail
// suffix, a trailing hex-looking hash segment, and the extension; converts
// remaining hyphens/underscores to spaces; sentence-cases the result.
// Returns null when nothing meaningful survives (data: URI, bare numbers,
// or one of a short list of generic filler words).
function filenameFallback(src) {
  if (!src || src.startsWith('data:')) return null;
  let name = src.split('/').pop().split('?')[0].split('#')[0];
  name = name.replace(/\.(png|jpe?g|webp|avif|gif|svg)$/i, '');
  name = name.replace(/-\d+x\d+$/i, '');
  name = name.replace(/-[0-9a-f]{6,}$/i, '');
  name = name.replace(/^cropped-/i, '');
  const words = name.replace(/[-_]+/g, ' ').trim();
  if (!words || /^\d+$/.test(words)) return null;
  const GENERIC = new Set(['image', 'img', 'photo', 'picture', 'bild', 'placeholder', 'icon']);
  if (GENERIC.has(words.toLowerCase())) return null;
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

// Derives alt text for one <img> tag (from the blanked `scan` copy, at
// `pos`), trying each signal in priority order. Returns { text, via } where
// text is null (decorative — nothing reliable found) or a non-empty string.
function deriveAlt(scan, tag, pos, headings) {
  const title = attr(tag, 'title');
  if (title && title.trim()) return { text: title.trim(), via: 'title' };

  // Enclosing <figure>: nearest <figure ...> before the image with no
  // intervening </figure>, and a <figcaption> before that figure closes.
  const before = scan.slice(0, pos);
  const lastFigureOpen = before.lastIndexOf('<figure');
  const lastFigureClose = before.lastIndexOf('</figure>');
  if (lastFigureOpen > lastFigureClose) {
    const figureEnd = scan.indexOf('</figure>', pos);
    if (figureEnd !== -1) {
      const figCap = scan.slice(pos, figureEnd).match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
      if (figCap) {
        const t = stripTags(figCap[1]);
        if (t) return { text: t, via: 'figcaption' };
      }
    }
  }

  // Enclosing <a>: nearest <a ...> before the image with no intervening
  // </a>, closed within this same anchor. Prefer the anchor's own visible
  // text (an icon beside a label); fall back to aria-label (icon-only link).
  const lastAOpen = before.lastIndexOf('<a ');
  const lastAClose = before.lastIndexOf('</a>');
  if (lastAOpen > lastAClose) {
    const aEnd = scan.indexOf('</a>', pos);
    if (aEnd !== -1) {
      const aOpenTagEnd = scan.indexOf('>', lastAOpen);
      const aOpenTag = scan.slice(lastAOpen, aOpenTagEnd + 1);
      const inner = scan.slice(aOpenTagEnd + 1, aEnd);
      // A fresh regex literal, not the shared module-level IMG_RE: that one
      // is mid-iteration (`.exec`) in the caller's while loop, and reusing a
      // global-flagged RegExp object for a second, concurrent match resets
      // its lastIndex out from under that loop.
      const visibleText = stripTags(inner.replace(/<img\s[^>]*>/g, ' '));
      if (visibleText) return { text: visibleText, via: 'linkText' };
      const ariaLabel = attr(aOpenTag, 'aria-label');
      if (ariaLabel && ariaLabel.trim()) return { text: ariaLabel.trim(), via: 'linkText' };
    }
  }

  const preceding = headings.filter((h) => h.pos < pos).pop();
  if (preceding && preceding.text) return { text: preceding.text, via: 'heading' };

  const src = attr(tag, 'src') || attr(tag, 'data-src');
  const fb = filenameFallback(src);
  if (fb) return { text: fb, via: 'filename' };

  return { text: null, via: null };
}

function main() {
  console.log('\n🖼️  Filling in missing <img> alt attributes...\n');

  const files = findHtmlFiles(DIST);

  let derived = 0;
  let decorative = 0;
  let filesTouched = 0;
  const sources = { title: 0, figcaption: 0, linkText: 0, heading: 0, filename: 0 };

  for (const file of files) {
    if (path.basename(file) === '404.html') continue;
    const html = fs.readFileSync(file, 'utf-8');
    const scan = blankNonMarkup(html);

    const headings = [...scan.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map((m) => ({
      pos: m.index,
      text: stripTags(m[1]),
    }));

    let rewritten = html;
    let offsetDelta = 0;
    let changedCount = 0;
    let match;
    IMG_RE.lastIndex = 0;
    while ((match = IMG_RE.exec(scan)) !== null) {
      const tag = match[0];
      if (/\balt\s*=/i.test(tag)) continue;

      const { text, via } = deriveAlt(scan, tag, match.index, headings);
      const altAttr = ` alt="${text ? escapeAttr(text) : ''}"`;
      // Insert before the closing `>` — or before `/>` on a self-closed tag,
      // which WP-generated markup uses often (e.g. the `<img … />` bylines).
      const selfClosed = tag.endsWith('/>');
      const replacement = selfClosed
        ? tag.slice(0, -2).replace(/\s+$/, '') + altAttr + ' />'
        : tag.slice(0, -1) + altAttr + '>';

      const startInReal = match.index + offsetDelta;
      const endInReal = startInReal + tag.length;
      rewritten = rewritten.slice(0, startInReal) + replacement + rewritten.slice(endInReal);
      offsetDelta += replacement.length - tag.length;
      changedCount++;

      if (text) {
        derived++;
        sources[via]++;
      } else {
        decorative++;
      }
    }

    if (changedCount > 0) {
      fs.writeFileSync(file, rewritten);
      filesTouched++;
    }
  }

  console.log(`✅ ${derived} image(s) given a derived alt`);
  console.log(
    `   • by title: ${sources.title}, figcaption: ${sources.figcaption}, link text: ${sources.linkText}, heading: ${sources.heading}, filename: ${sources.filename}`
  );
  console.log(`   • ${decorative} image(s) marked decorative (alt="") — no reliable signal found`);
  console.log(`   • ${filesTouched} file(s) touched\n`);
}

main();
