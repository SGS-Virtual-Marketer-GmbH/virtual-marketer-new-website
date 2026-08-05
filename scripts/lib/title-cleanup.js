'use strict';

/**
 * Turning a scraped WordPress post title into something publishable.
 *
 * These rules were written for scripts/fix-page-titles.js, which rewrites the
 * <title> tag late in the build. They live here because the blog archive
 * needs exactly the same rules much earlier: lib/blog-index.js harvests
 * legacy post titles at pipeline step 5, and fix-page-titles.js does not run
 * until step 28. Before this was shared, the archive card for
 * /blog/ki-in-der-forschung-…/ printed all 472 characters of the author's
 * five candidate headlines — the same defect fix-page-titles.js already knew
 * how to fix, on the same post, four hours of build order apart.
 *
 * Reordering the pipeline is not the alternative: the SEO passes have to run
 * after the pages exist, and the archive has to be written while the
 * generator is running. Sharing the rule is.
 */

const MAX_TITLE = 65;
const MIN_CLAUSE = 35;

/**
 * Some posts were saved with the author's shortlist of candidate headlines
 * instead of one title — several quoted alternatives strung together. Two or
 * more quoted runs is the signal; the first is taken as the intended one.
 */
function firstSuggestion(title) {
  const quoted = title.match(/"([^"]{15,})"/g);
  if (!quoted || quoted.length < 2) return null;
  return quoted[0].replace(/^"|"$/g, '').trim();
}

/**
 * Removes quote marks that wrap a whole title.
 *
 * Noise in a SERP on its own — and actively broken once clauseTrim() cuts the
 * title short, because the closing quote is in the discarded half. Stripping
 * the wrapper first means the trimmer only ever sees plain text.
 */
function stripWrappingQuotes(title) {
  let t = title.trim().replace(/^["'“„»«‚']+/, '').replace(/["'”“‘'»«]+$/, '').trim();
  // If an unbalanced straight quote survives (quotes around only part of the
  // title), drop it rather than ship a dangling one.
  if ((t.match(/"/g) || []).length % 2 === 1) t = t.replace(/"/g, '');
  return t;
}

/** Cut at the last clause boundary that leaves a complete, in-range clause. */
function clauseTrim(title) {
  if (title.length <= MAX_TITLE) return null;
  const bounds = [...title.matchAll(/[:–—,?!]/g)]
    .map((m) => m.index)
    .filter((i) => i >= MIN_CLAUSE && i <= MAX_TITLE);
  if (!bounds.length) return null;
  return title.slice(0, bounds[bounds.length - 1]).replace(/[\s,:–—]+$/, '').trim();
}

/**
 * The whole sequence, for callers that just want a usable title.
 *
 * Returns the input unchanged when it is already fine, so it is safe to run
 * over every title rather than only the suspect ones.
 */
function cleanTitle(raw) {
  const suggestion = firstSuggestion(raw);
  const base = stripWrappingQuotes(suggestion || raw);
  return clauseTrim(base) || base;
}

module.exports = { MAX_TITLE, MIN_CLAUSE, firstSuggestion, stripWrappingQuotes, clauseTrim, cleanTitle };
