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
const MIN_CLAUSE = 25;

/**
 * Words that mean something to a reader searching for this site's subject.
 *
 * Used to decide which half of a "hook: substance" headline to keep — see
 * pickClause(). Deliberately a list of the domain's real nouns rather than a
 * per-title tuning knob: if a clause contains none of these, it is a rhetorical
 * opener ("Vom Chaos zur Effizienz", "Dank KI zum Erfolg") and not what
 * anybody typed into a search box.
 */
const TOPIC_WORDS =
  /(?:\bKI\b|\bAI\b|künstlich|intelligenz|chatbot|e-?commerce|marketing|\bSEO\b|content|kundenservice|shopping|\bshop\b|daten|datenschutz|produkt|lager|logistik|bildung|hochschul|studenten|lernen|lehren|klassenzimmer|modell|automatisier|personalisier|\bsuche\b|search|werbung|werbebranche|e-?mail|social|feed|agent|bilder|video|texte|handel|kampagne|newsletter|analytics|generativ|forschung|gesundheit|arbeitswelt|betrug|preisgestaltung)/gi;

/** How many distinct topical terms a clause carries. */
function topicScore(clause) {
  const hits = clause.match(TOPIC_WORDS);
  return hits ? new Set(hits.map((h) => h.toLowerCase())).size : 0;
}

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
 * Picks the better half of a "hook: substance" headline.
 *
 * Nearly every over-long title on this site is one German sentence split by a
 * colon or an em dash, and clauseTrim() could not touch them: it only ever
 * keeps the *head*, and it required the head to be at least 35 characters.
 * Both assumptions are wrong often enough to have left 55 titles untouched.
 *
 * Keeping the head is wrong when the head is a rhetorical opener and the
 * keywords are all in the tail:
 *
 *   "Fair und effizient bewerten: Wie KI die Automatisierung von
 *    Studentenleistungen unterstützt"
 *      head → "Fair und effizient bewerten"                (says nothing)
 *      tail → "Wie KI die Automatisierung von …"           (the actual topic)
 *
 * And the 35-character floor rejected heads that are perfectly good titles:
 * "Kommunikation im Kundenservice" is 30, "Die Zukunft des Shoppings" is 25.
 *
 * So: consider both halves, discard any that will not fit a SERP or is too
 * short to stand alone, and keep whichever carries more of the subject's
 * vocabulary. Ties go to the head, which is where a German headline
 * conventionally puts its topic.
 *
 * When neither half is usable — the tail is still too long and the head is a
 * bare hook — nothing is returned and the title is left for a human. That is
 * the right answer for "Vom Chaos zur Effizienz: Wie automatisierte
 * Lagerverwaltung den E-Commerce-Logistikbetrieb revolutioniert", where the
 * head is empty of content and the tail is 79 characters.
 */
function pickClause(title) {
  if (title.length <= MAX_TITLE) return null;

  // The first colon or dash that has real text on both sides.
  const split = title.match(/^(.{10,}?)\s*[:–—]\s*(\S.*)$/s);
  if (!split) return clauseTrim(title);

  const candidates = [split[1], split[2]]
    .map((c) => stripWrappingQuotes(c.trim()).replace(/[\s,:–—]+$/, ''))
    .filter((c) => c.length >= MIN_CLAUSE && c.length <= MAX_TITLE);

  if (!candidates.length) return clauseTrim(title);

  let best = candidates[0];
  let bestScore = topicScore(best);
  for (const c of candidates.slice(1)) {
    const s = topicScore(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best === title ? null : best;
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
  return pickClause(base) || base;
}

module.exports = {
  MAX_TITLE,
  MIN_CLAUSE,
  firstSuggestion,
  stripWrappingQuotes,
  clauseTrim,
  pickClause,
  topicScore,
  cleanTitle,
};
