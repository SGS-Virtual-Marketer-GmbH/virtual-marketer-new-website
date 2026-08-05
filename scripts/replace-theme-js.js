#!/usr/bin/env node

/**
 * Replaces the theme's entire JavaScript stack with the ~20 lines of it that
 * do anything.
 *
 * WHAT THE MEASUREMENT SHOWED
 *
 * The homepage was rendered twice at 1440x3000 — once normally, once with
 * every <script src> stripped — and the two images compared pixel by pixel:
 *
 *     differing pixels: 12808 of 4320000  =  0.296%
 *     all of them in one band, y 1800-2000
 *
 * That band is the industries marquee, and it turned out not to be a
 * JavaScript effect at all: the strip is `ul.industries-marquee-content` with
 * `animation-name: scrolling`, a CSS keyframe animation. The two screenshots
 * simply caught it at different phases. Removing the Elementor runtime
 * specifically gave the same 0.3% in the same band.
 *
 * So on desktop the entire script stack — jQuery, jQuery Migrate, jQuery UI,
 * the five Elementor runtime files, the theme's own scripts — produces
 * exactly nothing. It costs 250 ms of total blocking time and is the only
 * reason the homepage scores in the seventies while the pages built without
 * it score 98.
 *
 * THE ONE THING IT DID DO
 *
 * The mobile menu. Removing the Elementor bundle stopped the burger from
 * responding — the click handler is bound somewhere in that chain. Which is
 * why this file exists rather than a line in strip-dead-assets.js: the stack
 * cannot just be deleted, it has to be replaced.
 *
 * And the thing it does is small. Opening the drawer was traced by watching
 * the DOM across a click:
 *
 *     #mmenu-toggle    gains .active
 *     #mmenu-wrapper   gains .mmenu-open
 *     <body>           gains .mmenu-active
 *
 * Three class toggles. Every pixel of the animation is in the theme's CSS,
 * which stays. So the replacement below is those three toggles plus the two
 * dismissals a drawer needs — overlay click and Escape — and it is better
 * than what it replaces on both counts, since the original had neither.
 *
 * WHAT IS KEPT
 *
 *   Our own scripts: the booking widget, the solutions panel, the mobile
 *   polish, the header alignment. None of them use jQuery — that was checked
 *   before deferring, in scripts/defer-scripts.js.
 *
 *   wp-hooks and wp-i18n, because an inline block calls wp.i18n at parse
 *   time. Roughly 5 KB, and removing the inline caller is a different change.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const MARKER = 'vm-native-menu';

/**
 * The stack being replaced. Everything here was verified to change no pixel
 * on the rendered page; the mobile menu it did drive is reimplemented below.
 */
const REPLACED = [
  /\/jquery\/jquery(\.min)?\.js/i,
  /jquery-migrate/i,
  /\/jquery\/ui\/core(\.min)?\.js/i,
  /elementor\/assets\/js\/webpack\.runtime/i,
  /elementor\/assets\/js\/frontend-modules/i,
  /elementor\/assets\/js\/frontend(\.min)?\.js/i,
  /themes\/engitech\/js\/elementor\.js/i,
  /themes\/engitech\/js\/elementor-header\.js/i,
  /themes\/engitech\/js\/scripts\.js/i,
  /themes\/engitech\/js\/header-mobile\.js/i,
  /simple-likes-public\.js/i,          // posts to an admin-ajax endpoint that is gone
  /kirki[^"']*\/index\.js/i,           // theme customiser runtime, no UI on a static build
];

const NATIVE_JS = `<script id="${MARKER}">
/**
 * The mobile drawer, natively.
 *
 * Replaces jQuery + the Elementor runtime + the theme's scripts, which
 * together did this and — as far as any rendered pixel is concerned —
 * nothing else. See scripts/replace-theme-js.js for the measurement.
 *
 * The class names are the theme's own, so its CSS animates the drawer
 * exactly as before.
 */
(function () {
  var toggle = document.getElementById('mmenu-toggle');
  var wrapper = document.getElementById('mmenu-wrapper');
  if (!toggle || !wrapper) return;

  var overlay = document.querySelector('.mmenu-overlay');
  var button = toggle.querySelector('button') || toggle;

  function setOpen(open) {
    toggle.classList.toggle('active', open);
    wrapper.classList.toggle('mmenu-open', open);
    document.body.classList.toggle('mmenu-active', open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    setOpen(!wrapper.classList.contains('mmenu-open'));
  });

  // Dismissals the original never had: tapping the dimmed backdrop, the
  // drawer's own close button, and Escape.
  if (overlay) overlay.addEventListener('click', function () { setOpen(false); });

  var close = wrapper.querySelector('.mmenu-close');
  if (close) close.addEventListener('click', function (e) { e.preventDefault(); setOpen(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrapper.classList.contains('mmenu-open')) setOpen(false);
  });

  // Following a link inside the drawer should not leave it open behind the
  // new page when the browser restores this one from the back/forward cache.
  wrapper.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (a && !a.classList.contains('mmenu-close') && a.getAttribute('href').charAt(0) !== '#') setOpen(false);
  });

  setOpen(false);
})();
</script>`;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n🧨 Replacing the theme JavaScript stack...\n');

  let pages = 0;
  let removed = 0;
  let bytesBefore = 0;

  // Rough size of what is being dropped, for the log line.
  const sizeOf = (rel) => {
    try { return fs.statSync(path.join(DIST, rel)).size; } catch { return 0; }
  };

  for (const file of findHtmlFiles(DIST)) {
    const html = fs.readFileSync(file, 'utf-8');
    if (!html.includes('id="mmenu-toggle"') && !REPLACED.some((re) => re.test(html))) continue;

    let count = 0;
    let out = html.replace(/<script\b[^>]*\bsrc=(["'])(.*?)\1[^>]*><\/script>/gi, (tag, _q, src) => {
      if (!REPLACED.some((re) => re.test(src))) return tag;
      count++;
      bytesBefore += sizeOf(decodeURIComponent(src.replace(/^\//, '')));
      return '';
    });

    if (!count) continue;

    if (!out.includes(MARKER) && out.includes('id="mmenu-toggle"')) {
      const at = out.lastIndexOf('</body>');
      if (at !== -1) out = out.slice(0, at) + NATIVE_JS + '\n' + out.slice(at);
    }

    fs.writeFileSync(file, out);
    pages++;
    removed += count;
  }

  console.log(`✅ ${removed} script reference(s) removed across ${pages} page(s)`);
  console.log(`   • roughly ${(bytesBefore / 1024 / pages).toFixed(0)}KB of JavaScript per page no longer downloaded or parsed`);
  console.log('   • the mobile drawer is now three class toggles, plus overlay-click and Escape\n');
}

main();
