#!/usr/bin/env node

/**
 * House rule: no en dash (U+2013) and no em dash (U+2014) anywhere in copy a
 * visitor can read. Both are the most recognisable tell of machine-written
 * text, and the site is meant to read like people wrote it.
 *
 * The scraped WordPress pages, the blog manifests, the generated pages and
 * several build scripts all still produce them, so instead of chasing every
 * source this runs once, late, over the finished dist/ and rewrites:
 *
 *   - text nodes of every .html file (not <script>, <style>, <pre>, <code>)
 *   - <title>, meta descriptions, og:/twitter: content, alt / title /
 *     aria-label / placeholder attributes
 *   - string values inside JSON-LD and the inlined blog search index
 *   - llms.txt, the RSS feeds, the search index JSON files, the web manifest
 *
 * Replacement, by context (never a bare find/replace):
 *
 *   9 - 12, 2023–2024            -> 9-12, 2023-2024        (numeric range)
 *   "A – b" (lowercase follows)  -> "A, b"                 (aside or continuation)
 *   "A – B" (capital/digit)      -> "A: B"                 (explanation, list head)
 *   in title / meta / alt        -> ": " first, ", " if a colon is already there
 *   "A—b", "A–b" (no spaces)     -> "A, b" / "A-b"
 *   dash opening a text node     -> dropped (list marker) or ", " when it
 *                                   continues a sentence started in a tag before
 *   a lone "–" cell             -> "-"
 *
 * Runs before scripts/version-static-assets.js, which must stay last because
 * it fingerprints file contents.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const DASH = /[–—]/;
const SP = '(?:\\s|&nbsp;|&#160;|&#xA0;|&thinsp;|&#8201;|&ensp;|&emsp;)';

// Entity forms of the two dashes are turned into the real characters first so
// one set of rules covers both spellings.
function decodeDashEntities(s) {
  return s
    .replace(/&(?:ndash|#8211|#x2013);/gi, '–')
    .replace(/&(?:mdash|#8212|#x2014);/gi, '—');
}

/**
 * Rewrites the dashes in one run of text.
 * @param {string} s        the text
 * @param {'text'|'meta'} mode  'meta' = title/description/alt style (short, no sentence context)
 * @param {string} prevChar last visible character before this run ('' at a block start)
 */
function fixRun(s, mode, prevChar) {
  if (!DASH.test(s) && !/&(?:ndash|mdash|#8211|#8212|#x2013|#x2014);/i.test(s)) return s;
  s = decodeDashEntities(s);
  if (!DASH.test(s)) return s;

  // A cell or run that is only a dash.
  if (new RegExp(`^${SP}*[\\u2013\\u2014]${SP}*$`).test(s)) return s.replace(/[–—]/, '-');

  // Numeric ranges.
  s = s.replace(new RegExp(`(\\d)${SP}*[\\u2013\\u2014]${SP}*(?=\\d)`, 'g'), '$1-');

  // A dash that is directly followed by punctuation is just noise: drop it.
  s = s.replace(new RegExp(`^${SP}*[\\u2013\\u2014]${SP}*(?=[,.;:!?])`), '');
  s = s.replace(new RegExp(`${SP}*[\\u2013\\u2014]${SP}*(?=[,.;:!?])`, 'g'), '');

  // Dash opening the run.
  s = s.replace(new RegExp(`^(${SP}*)[\\u2013\\u2014]${SP}*`), (m, lead) =>
    /[\p{L}\p{N})\]"'“”]/u.test(prevChar || '') ? `,${lead || ' '}`.replace(/^,$/, ', ') : lead);

  // Spaced dash: decide from what follows it.
  const spaced = new RegExp(`${SP}+[\\u2013\\u2014]${SP}*(\\S?)`, 'g');
  let colonUsed = /:/.test(s);
  s = s.replace(spaced, (m, next) => {
    if (next === '') return ', ';            // dash closes the run (something in a tag follows)
    let sep;
    if (mode === 'meta') sep = colonUsed ? ', ' : ': ';
    else if (/[\p{Ll}]/u.test(next)) sep = ', ';
    else sep = colonUsed ? ', ' : ': ';
    if (sep === ': ') colonUsed = true;
    return sep + next;
  });
  // Dash glued to a space on one side only ("Wort– Wort", "Wort –Wort").
  s = s.replace(new RegExp(`${SP}*[\\u2013\\u2014]${SP}+`, 'g'), ', ');
  s = s.replace(new RegExp(`${SP}+[\\u2013\\u2014]${SP}*`, 'g'), ', ');

  // Unspaced: en dash inside a compound keeps a hyphen, em dash becomes a comma.
  s = s.replace(/(\p{L})–(\p{L})/gu, '$1-$2');
  s = s.replace(/(\S)—(\S)/gu, '$1, $2');
  return s.replace(/[–—]/g, '-');
}

const ATTR_RE = /(\s(?:alt|title|aria-label|placeholder|content|href|data-title|data-description|data-label)=)(["'])([\s\S]*?)\2/gi;

function fixTag(tag) {
  if (!DASH.test(tag) && !/&(?:ndash|mdash|#8211|#8212|#x2013|#x2014);/i.test(tag)) return tag;
  return tag.replace(ATTR_RE, (m, name, q, val) => `${name}${q}${fixRun(val, 'meta', '')}${q}`);
}

const BLOCK_TAG = /^<\/?(?:p|div|li|ul|ol|br|h[1-6]|tr|td|th|table|section|article|header|footer|main|nav|figure|figcaption|blockquote|button|label|option)\b/i;

function fixJsonStrings(node) {
  if (typeof node === 'string') return fixRun(node, 'meta', '');
  if (Array.isArray(node)) return node.map(fixJsonStrings);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = fixJsonStrings(v);
    return out;
  }
  return node;
}

function fixHtml(html) {
  const TOKEN = /<!--[\s\S]*?-->|<(script)\b[^>]*>[\s\S]*?<\/\1>|<(style|pre|code|textarea)\b[^>]*>[\s\S]*?<\/\2>|<[^>]+>|[^<]+/gi;
  let prev = '';
  let inTitle = false;
  return html.replace(TOKEN, (tok) => {
    if (tok.startsWith('<!--')) return tok;
    if (/^<script/i.test(tok)) {
      if (!/type=["']application\/(?:ld\+)?json["']/i.test(tok) || !DASH.test(decodeDashEntities(tok))) return tok;
      return tok.replace(/^(<script\b[^>]*>)([\s\S]*)(<\/script>)$/i, (m, open, body, close) => {
        try { return open + JSON.stringify(fixJsonStrings(JSON.parse(body))).replace(/</g, '\\u003c') + close; }
        catch { return tok; }
      });
    }
    if (/^<(style|pre|code|textarea)\b/i.test(tok)) return tok;
    if (tok[0] === '<') {
      inTitle = /^<title\b/i.test(tok) ? true : /^<\/title/i.test(tok) ? false : inTitle;
      if (BLOCK_TAG.test(tok)) prev = '';
      return fixTag(tok);
    }
    const out = fixRun(tok, inTitle ? 'meta' : 'text', prev);
    const visible = out.replace(/\s+$/, '');
    if (visible) prev = visible.slice(-1);
    return out;
  });
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'wp-includes' || e.name === 'wp-content' && dir === DIST) continue; // third-party code
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

function main() {
  console.log('\n✂️  Normalizing en/em dashes in outward-facing copy...\n');
  let files = 0;
  let left = 0;
  for (const file of walk(DIST)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.html', '.json', '.txt', '.xml', '.webmanifest'].includes(ext)) continue;
    const before = fs.readFileSync(file, 'utf-8');
    if (!DASH.test(before) && !/&(?:ndash|mdash|#8211|#8212|#x2013|#x2014);/i.test(before)) continue;

    let after;
    if (ext === '.html') after = fixHtml(before);
    else if (ext === '.json' || ext === '.webmanifest') {
      try { after = JSON.stringify(fixJsonStrings(JSON.parse(before))); } catch { after = fixRun(before, 'meta', ''); }
    } else after = fixRun(before, 'text', '');

    if (after !== before) { fs.writeFileSync(file, after); files++; }
    if (ext === '.html') left += (after.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '').match(/[–—]/g) || []).length;
  }
  console.log(`   ✓ ${files} file(s) rewritten, ${left} dash(es) left in visible HTML\n`);
}

main();
