#!/usr/bin/env node

/**
 * Heading Structure Fixer
 *
 * A heading audit over dist/ found 69 pages with no <h1> at all and one page
 * with two. Every page needs exactly one <h1> — it is the strongest on-page
 * signal of what the page is about, for classic search and for the answer
 * engines that read structure to decide what a page can be cited for.
 *
 * Three distinct causes, so three distinct fixes:
 *
 *   1. The 44 legacy WordPress blog posts render their post title as
 *      <h3 class="entry-title">, a theme quirk — the title is right there
 *      and visually dominant, it is just wearing the wrong tag. Promoted to
 *      <h1>, classes preserved so the theme CSS keeps applying.
 *
 *   2. The homepage's hero heading is an Elementor <h2>. Same story:
 *      promote the first one.
 *
 *   3. /impressum/, /nutzungsbedingungen/, /virtual-marketer-demo/ and
 *      /login/ have no candidate heading anywhere in their main content —
 *      the legal/demo pages open straight into body copy. Those get a real
 *      <h1> inserted at the top of <article id="post-...">, with the text
 *      taken from the page's own <title> (minus the " - Virtual Marketer"
 *      suffix) so it always matches what the page is actually called.
 *
 *   4. /datenschutzerklaerung/ has two <h1>s: the page title plus a
 *      "Einleitung" section heading that came through from the WordPress
 *      block editor. Any h1 after the first is demoted to <h2>, which is
 *      what it should have been — it is a section inside the page, not the
 *      page's subject.
 *
 * Deliberately skips the thin archive pages (/author/, /tag/, /category/,
 * /blog/page/): scripts/prune-thin-archives.js removes them from the build
 * entirely, so fixing their headings would be work on pages that are about
 * to stop existing.
 *
 * Run after the page generators, before scripts/seo-optimize.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const TITLE_SUFFIX = / [-–—] Virtual Marketer\s*$/;

// Pages that prune-thin-archives.js deletes — nothing to fix here.
const SKIP = /^\/(author|tag|category)\/|^\/blog\/page\//;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&raquo;/g, '»')
    .replace(/&laquo;/g, '«')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function countH1(html) {
  return (html.match(/<h1[\s>]/gi) || []).length;
}

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/** Rewrites the tag name of one heading, keeping every attribute intact. */
function retag(html, matchIndex, matchText, from, to) {
  const open = matchText.replace(new RegExp(`^<${from}`, 'i'), `<${to}`);
  const closeIdx = html.toLowerCase().indexOf(`</${from}>`, matchIndex);
  if (closeIdx === -1) return null;
  return (
    html.slice(0, matchIndex) +
    open +
    html.slice(matchIndex + matchText.length, closeIdx) +
    `</${to}>` +
    html.slice(closeIdx + `</${from}>`.length)
  );
}

function promoteFirst(html, re, from) {
  const m = re.exec(html);
  if (!m) return null;
  return retag(html, m.index, m[0], from, 'h1');
}

function main() {
  console.log('\n🔤 Fixing heading structure (exactly one <h1> per page)...\n');

  const stats = { promotedEntry: 0, promotedHero: 0, inserted: 0, demoted: 0 };

  for (const file of findHtmlFiles(DIST)) {
    const url = '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/index\.html$/, '');
    if (SKIP.test(url)) continue;

    const original = fs.readFileSync(file, 'utf-8');
    let html = original;
    const n = countH1(html);

    if (n === 0) {
      // 1. Legacy blog post title sitting in an <h3 class="entry-title">.
      let next = promoteFirst(html, /<h3[^>]*\bclass=["'][^"']*\bentry-title\b[^"']*["'][^>]*>/i, 'h3');
      if (next) {
        html = next;
        stats.promotedEntry++;
      } else {
        // 2. Elementor hero heading.
        next = promoteFirst(html, /<h2[^>]*\bclass=["'][^"']*\belementor-heading-title\b[^"']*["'][^>]*>/i, 'h2');
        if (next) {
          html = next;
          stats.promotedHero++;
        } else {
          // 3. No candidate heading — synthesise one from <title>.
          const rawTitle = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
          // <article id="post-N"> is the usual anchor, but /login/ is not a
          // WordPress "post" and has no such wrapper — fall back to <main>.
          const article =
            html.match(/<article\b[^>]*id=["']post-\d+["'][^>]*>/i) ||
            html.match(/<main\b[^>]*>/i);
          if (rawTitle && article) {
            const text = escapeHtml(decodeEntities(rawTitle.trim()).replace(TITLE_SUFFIX, '').trim());
            const at = article.index + article[0].length;
            html = html.slice(0, at) + `\n<h1 class="entry-title">${text}</h1>` + html.slice(at);
            stats.inserted++;
          }
        }
      }
    } else if (n > 1) {
      // 4. Keep the first <h1>; every later one becomes a section heading.
      let guard = 0;
      while (countH1(html) > 1 && guard++ < 20) {
        const all = [...html.matchAll(/<h1[^>]*>/gi)];
        const target = all[1];
        const next = retag(html, target.index, target[0], 'h1', 'h2');
        if (!next) break;
        html = next;
        stats.demoted++;
      }
    }

    if (html !== original) fs.writeFileSync(file, html);
  }

  console.log(`✅ Headings normalised`);
  console.log(`   • ${stats.promotedEntry} legacy blog post title(s) h3 → h1`);
  console.log(`   • ${stats.promotedHero} hero heading(s) h2 → h1`);
  console.log(`   • ${stats.inserted} page(s) given an h1 derived from <title>`);
  console.log(`   • ${stats.demoted} surplus h1 → h2\n`);
}

main();
