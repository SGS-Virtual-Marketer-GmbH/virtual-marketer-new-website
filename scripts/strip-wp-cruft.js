#!/usr/bin/env node

/**
 * WordPress Cruft Stripper
 *
 * The scraped legacy pages still carry a layer of WordPress <head> plumbing
 * and dead comment UI that has no meaning on a static site. A link audit
 * over dist/ found 453 broken internal references, and every single one of
 * them came from this cruft — nothing else on the site links to a missing
 * target. Specifically:
 *
 *   - <script src=".../woocommerce-analytics-client.js"> on 75 pages. The
 *     file was never mirrored, so it 404s rather than tracking anything,
 *     but it is still an analytics tag in the markup and one wasted request
 *     per page load. It survived scripts/remove-external-trackers.js because
 *     that script targets external hosts and this src is same-origin.
 *   - RSS/comment feed <link rel="alternate" type="application/rss+xml">
 *     (73 pages x 3) and oEmbed discovery links pointing into /wp-json/.
 *     There is no feed and no WordPress JSON API behind this site.
 *   - <meta name="generator"> advertising WordPress 7.0.1, WooCommerce
 *     10.9.4, Elementor, LayerSlider and friends — stale (none of it runs
 *     here) and a free fingerprint for anyone scanning for known CVEs.
 *   - <link rel="profile" href="https://gmpg.org/xfn/11">, an external
 *     reference kept only out of WordPress theme habit.
 *   - The whole <div id="comments"> block on the 44 legacy blog posts. The
 *     form was already neutered (action="javascript:void(0)"), so it is
 *     dead UI that still renders a "Leave a comment" heading and an empty
 *     Cloudflare Turnstile placeholder. The Turnstile *script* is not
 *     loaded, so this is dead markup rather than a privacy leak, but it
 *     looks broken to a visitor either way.
 *   - secure.gravatar.com author avatars on 44 blog posts — the last real
 *     external image load left on the site, in both the visible author-bio
 *     box and the JSON-LD Person.image. Repointed at the self-hosted logo
 *     so the site stays free of third-party requests (and of the IP leak
 *     that hotlinking an avatar CDN implies).
 *
 * hreflang <link rel="alternate"> tags are also rel="alternate", so the feed
 * and oEmbed matchers below key off the `type` attribute, never off rel
 * alone — dropping hreflang here would silently undo the DE/EN wiring.
 *
 * Run after the page generators and before scripts/seo-optimize.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

// Self-hosted stand-in for the Gravatar-hosted author avatar.
const LOCAL_AVATAR = '/wp-content/uploads/2023/04/Virtual-Marketer-Logo-128x128-New.png';
const SITE_URL = 'https://virtual-marketer.de';

const HEAD_PATTERNS = [
  // Jetpack/WooCommerce analytics tag (src is same-origin, hence the 404)
  /<script[^>]*\bsrc=["'][^"']*woocommerce-analytics[^"']*["'][^>]*>\s*<\/script>\s*/gi,
  // …and the inline block that configures it. Removing only the <script src>
  // left 54 pages still declaring wcAnalytics.trackEndpoint pointing at
  // /wp-json/woocommerce-analytics/v1/track — a tracking endpoint that does
  // not exist on this site, in markup that reads like live analytics.
  /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?wcAnalytics[\s\S]*?<\/script>\s*/gi,
  // RSS + comment feeds
  /<link[^>]*type=["']application\/rss\+xml["'][^>]*>\s*/gi,
  // oEmbed discovery (XML and JSON variants)
  /<link[^>]*type=["'](?:text\/xml|application\/json)\+oembed["'][^>]*>\s*/gi,
  // Version fingerprints
  /<meta[^>]*name=["']generator["'][^>]*>\s*/gi,
  // XFN profile, RSD/Windows Live Writer manifests, WP shortlink
  /<link[^>]*rel=["']profile["'][^>]*gmpg\.org[^>]*>\s*/gi,
  /<link[^>]*rel=["'](?:EditURI|wlwmanifest|shortlink)["'][^>]*>\s*/gi,
  // WP REST API discovery link, <link rel="https://api.w.org/" href="/wp-json/">.
  // rel is a URL rather than a keyword here, which is why it needs its own
  // pattern — and it is the last thing on the site still linking to /wp-json/.
  /<link[^>]*rel=["']https?:\/\/api\.w\.org\/?["'][^>]*>\s*/gi,
];

/**
 * Removes an element and everything nested inside it by counting opening and
 * closing tags of the same name. A plain non-greedy regex would stop at the
 * first </div>, which for the comments block is several levels too early and
 * would leave a trail of unbalanced closing tags behind.
 */
function removeBalanced(html, openRe, tag) {
  const start = html.search(openRe);
  if (start === -1) return html;

  const scan = new RegExp(`<${tag}\\b|</${tag}>`, 'gi');
  scan.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = scan.exec(html))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(0, start) + html.slice(m.index + m[0].length);
  }
  return html; // unbalanced markup — leave the page untouched rather than truncate it
}

function relativeTo(pageFile, absPath) {
  const rel = path.relative(path.dirname(pageFile), path.join(DIST, absPath.replace(/^\//, '')));
  return rel.split(path.sep).join('/');
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
  console.log('\n🧹 Stripping leftover WordPress cruft...\n');

  const stats = { head: 0, comments: 0, avatars: 0, pages: 0 };

  for (const file of findHtmlFiles(DIST)) {
    const original = fs.readFileSync(file, 'utf-8');
    let html = original;

    for (const re of HEAD_PATTERNS) {
      const before = html;
      html = html.replace(re, '');
      if (html !== before) stats.head++;
    }

    if (/<div[^>]*id=["']comments["']/i.test(html)) {
      html = removeBalanced(html, /<div[^>]*id=["']comments["']/i, 'div');
      stats.comments++;
    }

    if (html.includes('gravatar.com')) {
      // Visible author-bio <img>: point src at the local logo and drop the
      // 2x srcset, which only ever referenced a second Gravatar size.
      html = html.replace(/<img\b[^>]*gravatar\.com[^>]*>/gi, (tag) => {
        const local = relativeTo(file, LOCAL_AVATAR);
        return tag
          .replace(/\ssrcset=(['"])[^'"]*\1/gi, '')
          .replace(/\ssrc=(['"])[^'"]*\1/gi, ` src="${local}"`)
          .replace(/\salt=(['"])\1/gi, ' alt="Virtual Marketer"');
      });
      // Remaining hits are inside JSON-LD, where slashes are escaped as \/.
      html = html.replace(
        /https:(?:\\)?\/(?:\\)?\/secure\.gravatar\.com(?:\\)?\/avatar(?:\\)?\/[^"'\s]*/gi,
        `${SITE_URL}${LOCAL_AVATAR}`.replace(/\//g, '\\/')
      );
      stats.avatars++;
    }

    if (html !== original) {
      fs.writeFileSync(file, html);
      stats.pages++;
    }
  }

  console.log(`✅ Cleaned ${stats.pages} page(s)`);
  console.log(`   • ${stats.head} head-cruft removal(s) (analytics tag, feeds, oEmbed, generator meta)`);
  console.log(`   • ${stats.comments} dead comment block(s) removed`);
  console.log(`   • ${stats.avatars} page(s) repointed off secure.gravatar.com\n`);
}

main();
