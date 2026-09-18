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
 *
 * SECOND PASS: sequential levels, page-wide
 *
 * A real audit (not the earlier claim of "h6 skipping levels" — that was
 * imprecise; re-measured directly against dist/) found 76 pages where a
 * heading's level jumps by more than one from the heading before it in
 * reading order: legacy blog posts run straight from the <h1> post title
 * into <h6> in-body subheadings (the WordPress editor exported every
 * subheading as the smallest tag, apparently for its default size, not for
 * its semantics); the sidebar's "Aktuelle Beiträge" widget title is an
 * <h5> wherever it lands after an <h1> or <h2>; the FAQ accordion's item
 * titles are <h5>; and a couple of newer Tailwind-styled pages jump straight
 * from <h2> to <h4>.
 *
 * Fixed by exposing the correct level via role="heading" aria-level="N" —
 * NOT by changing the tag. Retagging plus a CSS class that reproduces the
 * old tag's default size was the first plan, but it means hand-copying
 * font-size/weight/line-height for every offending tag in every context
 * (a bare <h6> in article prose renders differently than an <h6> in the
 * byline box), and baking those pixel values into a class would silently go
 * stale the next time the CSS pipeline changes underneath it — which,
 * mid-sweep, other scripts in this same build are doing concurrently.
 * aria-level sidesteps all of that: the native tag — and therefore every
 * existing CSS rule that targets it — is untouched, so the visual result is
 * identical by construction, not by a snapshot that can drift. It is also
 * the standard technique (WAI-ARIA: aria-level overrides the level implied
 * by a heading's role) and is what axe-core's heading-order rule — the
 * thing Lighthouse actually runs — and screen readers' heading navigation
 * both read.
 *
 * The level is computed by walking every <hN> in document order and
 * maintaining a stack of {originalLevel, exposedLevel}: an incoming heading
 * pops every stack entry whose original level is >= its own (those were
 * siblings or deeper, not ancestors), then takes exposedLevel = parent's
 * exposedLevel + 1 (or its own original level, unchanged, if the stack is
 * now empty — nothing to violate against). This is what keeps three
 * consecutive bare <h6> subheadings as three siblings at the same corrected
 * level rather than a staircase (h2, h3, h4, …) — each one arrives at the
 * SAME original level as the last, so it pops its sibling off the stack
 * instead of nesting under it. Reruns are stable: the walk reads a prior
 * aria-level back as the heading's level for comparison purposes, so a page
 * already fixed produces the identical attribute value again.
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

/**
 * A same-length stand-in for html with every <script>, <style> and comment
 * blanked out to spaces — used only by fixSequentialLevels() below to decide
 * WHERE a real <hN> tag is, never to build output. One page in this build
 * carries a documentation comment that reads, in prose, "the theme hides
 * <body> itself…" — a sibling script (scripts/inject-skip-link.js) matched
 * that as if it were the real tag and spliced markup into the middle of a
 * <style> block. Heading tags are less likely to turn up as prose in a
 * comment than "<body>" was, but the fix is the same one line either way,
 * so it is applied here too rather than trusted to be safe by luck.
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

/**
 * Second pass: expose a sequential heading outline via aria-level, without
 * touching the tag. See the header comment for the stack algorithm and why
 * aria-level was chosen over retagging.
 *
 * Returns { html, changed } — changed counts headings whose exposed level
 * differs from what the markup currently carries (native tag, or a prior
 * run's aria-level). A rerun over already-fixed markup recomputes the same
 * values, so the returned html is byte-identical to the input and nothing
 * gets written — that's what makes the pass idempotent.
 */
function fixSequentialLevels(html) {
  let changed = 0;
  const stack = []; // {level, exposed}, root-to-current-heading path

  // Matched against the masked copy (so a heading-shaped mention inside a
  // comment or <style> block can't be mistaken for a real tag); everything
  // between matches is copied from the real html untouched, so masked-out
  // comment/style content reaches the output exactly as it was.
  const masked = maskNonMarkup(html);
  const re = /<h([1-6])\b([^>]*)>/gi;
  let out = '';
  let lastIndex = 0;
  let m;
  while ((m = re.exec(masked))) {
    const [whole, tagDigit, attrsIn] = m;
    const nativeLevel = parseInt(tagDigit, 10);

    // Don't touch a heading that already carries a role other than
    // "heading" — it means something else (e.g. a tab trigger) and forcing
    // aria-level on it would be layering a second, conflicting contract on
    // top of the first.
    const roleMatch = attrsIn.match(/\brole=["']([^"']+)["']/i);
    let next = whole;
    if (!roleMatch || roleMatch[1].toLowerCase() === 'heading') {
      // What this heading currently claims to be — its own prior aria-level
      // if this is a rerun, else its native tag. Used both to compare
      // against the stack and, when the stack is empty, as its own result.
      const ariaMatch = attrsIn.match(/\baria-level=["'](\d)["']/i);
      const currentLevel = ariaMatch ? parseInt(ariaMatch[1], 10) : nativeLevel;

      while (stack.length && stack[stack.length - 1].level >= currentLevel) stack.pop();
      const exposed = stack.length ? stack[stack.length - 1].exposed + 1 : currentLevel;
      stack.push({ level: currentLevel, exposed });

      if (exposed === nativeLevel) {
        // Sequential already (or a previous run already normalised it back
        // to its native level) — drop a now-redundant override rather than
        // leave a no-op aria-level in the markup.
        if (ariaMatch) {
          const stripped = attrsIn
            .replace(/\s*\brole=["']heading["']/i, '')
            .replace(/\s*\baria-level=["']\d["']/i, '');
          if (stripped !== attrsIn) next = `<h${tagDigit}${stripped}>`;
        }
      } else {
        let attrs = ariaMatch
          ? attrsIn.replace(/\baria-level=["']\d["']/i, `aria-level="${exposed}"`)
          : `${attrsIn} aria-level="${exposed}"`;
        if (!/\brole=["']heading["']/i.test(attrs)) attrs += ' role="heading"';
        next = `<h${tagDigit}${attrs}>`;
      }
    }

    if (next !== whole) changed++;
    out += html.slice(lastIndex, m.index) + next;
    lastIndex = m.index + whole.length;
  }
  out += html.slice(lastIndex);

  return { html: out, changed };
}

function main() {
  console.log('\n🔤 Fixing heading structure (exactly one <h1> per page)...\n');

  const stats = { promotedEntry: 0, promotedHero: 0, inserted: 0, demoted: 0, levelsFixed: 0, pagesLevelsFixed: 0 };

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

    // Second pass, same file: with exactly one <h1> now in place, walk the
    // rest of the outline and expose sequential levels via aria-level.
    const leveled = fixSequentialLevels(html);
    if (leveled.changed) {
      html = leveled.html;
      stats.levelsFixed += leveled.changed;
      if (leveled.html !== original) stats.pagesLevelsFixed++;
    }

    if (html !== original) fs.writeFileSync(file, html);
  }

  console.log(`✅ Headings normalised`);
  console.log(`   • ${stats.promotedEntry} legacy blog post title(s) h3 → h1`);
  console.log(`   • ${stats.promotedHero} hero heading(s) h2 → h1`);
  console.log(`   • ${stats.inserted} page(s) given an h1 derived from <title>`);
  console.log(`   • ${stats.demoted} surplus h1 → h2`);
  console.log(`   • ${stats.levelsFixed} heading(s) across ${stats.pagesLevelsFixed} page(s) given a corrected aria-level\n`);
}

main();
