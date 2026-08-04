#!/usr/bin/env node

/**
 * Page Title Fixer
 *
 * Two things, both about what shows up as the clickable line in a search
 * result.
 *
 * 1. One post never had its title chosen. /blog/ki-in-der-forschung-…/ ships
 *    a 472-character <title> (and matching <h1>) that is literally a list of
 *    five candidate headlines separated by dashes, quotes and all — someone
 *    pasted the options into WordPress and never deleted the four they did
 *    not want. The first candidate is the one the URL slug was built from, so
 *    that is the one kept; the rest are dropped from <title>, <h1> and the
 *    og:/twitter: mirrors.
 *
 * 2. 135 pages have a <title> past the ~65 characters Google will render,
 *    nearly all of them German blog posts whose headline is a full sentence.
 *    Where such a title has a natural clause boundary (a colon, dash, comma
 *    or question mark) that falls between 35 and 65 characters, the title is
 *    cut there — which keeps a complete, readable clause and almost always
 *    the keyword-bearing half, because German headlines of this shape lead
 *    with the topic and trail with the elaboration:
 *
 *      "Die Gratwanderung zwischen KI und Datenschutz: Wie schützen wir
 *       unsere Daten in der sich entwickelnden KI-Landschaft"   (129)
 *        → "Die Gratwanderung zwischen KI und Datenschutz"       (45)
 *
 *    The other 82 have no boundary in that window and are deliberately left
 *    alone. Chopping them at an arbitrary word would read worse in the SERP
 *    than letting Google truncate, and inventing replacement headlines is an
 *    editorial call rather than a scripted one — those are reported at the
 *    end of the run so they can be rewritten by hand later.
 *
 * Only <title> is shortened, never <h1>: the on-page headline should stay the
 * full, descriptive sentence a reader landed for. The one exception is the
 * five-suggestions post above, whose <h1> is broken by any measure.
 *
 * Run near the end of the pipeline, after scripts/seo-optimize.js has
 * finished rewriting heads, alongside scripts/fix-meta-descriptions.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const { MAX_TITLE, MIN_CLAUSE } = require('./lib/title-cleanup');
// " - Virtual Marketer" is redundant on an over-long title: the brand is
// already in the domain shown above the SERP title and in og:site_name.
// Dropping it buys 19 characters for free, so it is tried before any cut.
// Both separators are in use: the legacy WordPress pages end " - Virtual
// Marketer", the generated solution pages end " | Virtual Marketer".
const BRAND_SUFFIX = / [-–—|] Virtual Marketer\s*$/;

function decodeEntities(s) {
  return s
    .replace(/&quot;|&#34;|&#8220;|&#8221;|&#8222;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

/** First quoted candidate from a pasted list of headline options. */
// The title-cleaning rules moved to lib/title-cleanup.js so that the blog
// archive, which harvests legacy titles at pipeline step 5, applies exactly
// the same ones this step applies at step 28. See that file's header.
const { firstSuggestion, stripWrappingQuotes, clauseTrim } = require('./lib/title-cleanup');

function setMeta(html, re, value) {
  return html.replace(re, (tag) => tag.replace(/content=(["'])[\s\S]*?\1/i, `content="${escapeAttr(value)}"`));
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
  console.log('\n🏷️  Fixing page titles...\n');

  let suggestionsFixed = 0;
  let debranded = 0;
  let trimmed = 0;
  const stillLong = [];

  for (const file of findHtmlFiles(DIST)) {
    const url = '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/index\.html$/, '');
    const original = fs.readFileSync(file, 'utf-8');
    let html = original;

    const raw = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    if (!raw) continue;
    const decoded = decodeEntities(raw.trim());
    const current = stripWrappingQuotes(decoded);
    // A title that was only ever wrapped in quotes still needs writing back.
    let next = current !== decoded ? current : null;

    const suggestion = firstSuggestion(current);
    if (suggestion) {
      // The <h1> carries the same pasted list — replace it too.
      next = suggestion;
      html = html.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/i, `$1${escapeText(suggestion)}$2`);
      console.log(`   • ${url}\n       5 pasted headline options → "${suggestion}"`);
      suggestionsFixed++;
    } else if (current.length > MAX_TITLE) {
      // Cheapest fix first: drop the brand suffix. Only cut a clause if the
      // title is still too long without it.
      let candidate = current;
      if (BRAND_SUFFIX.test(candidate)) {
        candidate = candidate.replace(BRAND_SUFFIX, '').trim();
        if (candidate !== current) {
          next = candidate;
          debranded++;
        }
      }
      const cut = clauseTrim(candidate);
      if (cut) {
        next = cut;
        trimmed++;
      }
    }

    if (next) {
      html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeText(next)}</title>`);
      html = setMeta(html, /<meta[^>]+property=["']og:title["'][^>]*>/i, next);
      html = setMeta(html, /<meta[^>]+name=["']twitter:title["'][^>]*>/i, next);
    }

    const finalTitle = next || current;
    if (finalTitle.length > MAX_TITLE) stillLong.push([finalTitle.length, url]);

    if (html !== original) fs.writeFileSync(file, html);
  }

  console.log(`\n✅ Titles normalised`);
  console.log(`   • ${suggestionsFixed} pasted-headline-list title(s) resolved to a single headline`);
  console.log(`   • ${debranded} title(s) shortened by dropping the redundant brand suffix`);
  console.log(`   • ${trimmed} title(s) cut back to a complete clause under ${MAX_TITLE} chars`);
  console.log(`   ⚠ ${stillLong.length} title(s) still over ${MAX_TITLE} chars with no clean clause boundary —`);
  console.log(`     these need an editorial rewrite, not a script. Longest:`);
  stillLong.sort((a, b) => b[0] - a[0]).slice(0, 5).forEach(([n, u]) => console.log(`       ${n} chars  ${u}`));
  console.log('');
}

main();
