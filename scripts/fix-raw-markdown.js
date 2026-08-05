#!/usr/bin/env node

/**
 * Converts Markdown that was pasted into WordPress as plain text.
 *
 * Some of the scraped posts were drafted in Markdown and pasted into the
 * editor without conversion, so the syntax is sitting in the rendered page as
 * literal characters:
 *
 *     <p>### Vorteile der KI-gestützten Personalisierung im E-Commerce:</p>
 *     <p>**1. Vertrauen aufbauen:**</p>
 *
 * A reader sees the hashes and asterisks. A search engine sees a paragraph
 * where the author meant a heading, so the article's structure — the thing
 * that makes a long post skimmable and rankable — is invisible to it.
 *
 * WHAT IS CONVERTED, AND WHAT IS DELIBERATELY NOT
 *
 * Only two constructs, both of which appear in these posts and neither of
 * which has a plausible innocent reading:
 *
 *   A paragraph whose entire content is "## …" through "#### …" becomes the
 *   matching heading. Anchored to the start of the paragraph, so a sentence
 *   that merely contains a "#" is untouched.
 *
 *   **bold** becomes <strong>. Restricted to runs without markup inside, so
 *   it cannot swallow a tag and produce broken HTML.
 *
 * Not converted: single "#", because on this blog a lone hash is more likely
 * a hashtag than an h1, and these posts already have their h1. Not converted
 * either: *italic*, because a single asterisk appears in ordinary prose
 * (footnote markers, multiplication) often enough that the false-positive
 * rate is not worth the gain.
 *
 * Scoped to blog post bodies. The heading level is taken from the number of
 * hashes rather than normalised, so an author who wrote ### under an ## keeps
 * the nesting they intended.
 */

const fs = require('fs');
const path = require('path');

const DIST_BLOG = path.join(__dirname, '../dist/blog');
const DIST_EN_BLOG = path.join(__dirname, '../dist/en/blog');

/** `<p>### Text</p>` → `<h3>Text</h3>`, for 2–4 hashes. */
const HEADING = /<p([^>]*)>\s*(#{2,4})\s+([^<]+?)\s*<\/p>/gi;

/**
 * `**bold**` → `<strong>bold</strong>`.
 *
 * The inner group excludes `<`, `>` and `*`, so a run can never cross a tag
 * boundary — pairing an opening `**` in one element with a closing `**` in
 * the next would produce overlapping markup that no browser recovers from
 * cleanly.
 */
const BOLD = /\*\*([^*<>\n]{1,200}?)\*\*/g;

function findPosts(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findPosts(full, results);
    else if (entry.name === 'index.html') results.push(full);
  }
  return results;
}

function main() {
  console.log('\n📝 Converting Markdown left as plain text...\n');

  let pages = 0;
  let headings = 0;
  let bolds = 0;
  const samples = [];

  for (const file of [...findPosts(DIST_BLOG), ...findPosts(DIST_EN_BLOG)]) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!/<p[^>]*>\s*#{2,4}\s/.test(html) && !/\*\*[^*<>\n]/.test(html)) continue;

    let out = html.replace(HEADING, (whole, attrs, hashes, text) => {
      const level = hashes.length; // ## -> h2, ### -> h3, #### -> h4
      headings++;
      if (samples.length < 4) samples.push(`h${level}: ${text.slice(0, 55)}`);
      return `<h${level}${attrs}>${text}</h${level}>`;
    });

    out = out.replace(BOLD, (whole, text) => {
      bolds++;
      return `<strong>${text}</strong>`;
    });

    if (out !== html) {
      fs.writeFileSync(file, out);
      pages++;
    }
  }

  console.log(`✅ ${pages} post(s) cleaned`);
  console.log(`   • ${headings} paragraph(s) turned into real headings`);
  console.log(`   • ${bolds} **run(s)** turned into <strong>`);
  samples.forEach((s) => console.log(`       ${s}`));

  // Nothing should be left. A survivor means the markup did not match the
  // shapes above — worth seeing rather than shipping.
  const left = [];
  for (const file of [...findPosts(DIST_BLOG), ...findPosts(DIST_EN_BLOG)]) {
    const html = fs.readFileSync(file, 'utf-8');
    if (/<p[^>]*>\s*#{2,4}\s/.test(html) || /\*\*[^*<>\n]{1,200}?\*\*/.test(html)) {
      left.push(path.relative(path.join(__dirname, '../dist'), file));
    }
  }
  if (left.length) {
    console.log(`   ⚠ ${left.length} post(s) still contain raw Markdown:`);
    left.slice(0, 5).forEach((f) => console.log(`       ${f}`));
  } else {
    console.log('   ✓ no raw Markdown left in any post');
  }
  console.log();
}

main();
