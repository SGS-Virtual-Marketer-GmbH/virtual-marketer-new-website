#!/usr/bin/env node

/**
 * Booking Widget Injection
 *
 * /virtual-marketer-demo/ (DE) shipped a WordPress "wpcal" plugin calendar
 * widget that can never load on this static site — its AJAX config points
 * at https://virtual-marketer.de/wp-admin/admin-ajax.php, a backend that
 * doesn't exist here, so visitors got a permanent loading spinner (see the
 * broken-embeds audit and the note in scripts/fix-broken-widgets.js).
 *
 * This script:
 *   1. Copies assets/booking-widget/{css,js} into dist/assets/booking-widget/
 *      (the EN demo page in scripts/generate-en-pages.js already references
 *      these paths directly since it's self-generated; this DE page is
 *      legacy scraped HTML, so it's patched here post-build instead).
 *   2. Strips every wpcal-plugin `<link>`/`<script>` tag and the dead
 *      loading-spinner `<div>` from dist/virtual-marketer-demo/index.html,
 *      replacing the div with the real booking widget's mount point.
 *
 * The widget itself (assets/booking-widget/booking-widget.js) talks to
 * backend/'s /api/bookings endpoints — see backend/README.md for the API
 * contract and how to run that service locally.
 *
 * Run after scripts/fix-broken-widgets.js, before scripts/generate-404.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC_ASSETS = path.join(ROOT, 'assets/booking-widget');
const DIST_ASSETS = path.join(DIST, 'assets/booking-widget');
const DEMO_PAGE = path.join(DIST, 'virtual-marketer-demo/index.html');

const WIDGET_MOUNT = `<div id="vm-booking-widget" data-locale="de"></div>
<link rel="stylesheet" href="/assets/booking-widget/booking-widget.css">
<script src="/assets/booking-widget/booking-widget.js" defer></script>`;

function main() {
  console.log('\n📅 Wiring up the real booking widget...\n');

  fs.mkdirSync(DIST_ASSETS, { recursive: true });
  fs.copyFileSync(path.join(SRC_ASSETS, 'booking-widget.css'), path.join(DIST_ASSETS, 'booking-widget.css'));
  fs.copyFileSync(path.join(SRC_ASSETS, 'booking-widget.js'), path.join(DIST_ASSETS, 'booking-widget.js'));
  console.log('  ✓ Copied booking-widget.css / booking-widget.js to dist/assets/booking-widget/');

  if (!fs.existsSync(DEMO_PAGE)) {
    console.log('  ⚠ dist/virtual-marketer-demo/index.html not found, skipping\n');
    return;
  }

  let html = fs.readFileSync(DEMO_PAGE, 'utf-8');
  const before = html;

  html = html.replace(/<div id="wpcal_user_app" class="loading-indicator-initial"><\/div>/, WIDGET_MOUNT);
  html = html.replace(/<script type="text\/javascript">\s*var wpcal_booking_service_id[\s\S]*?<\/script>\s*/, '');
  html = html.replace(/<script id="wpcal_common_path-js-after">[\s\S]*?<\/script>\s*/, '');
  html = html.replace(/<link rel='stylesheet' id='wpcal_[^']*'[^>]*>\s*/g, '');
  html = html.replace(/<script id="wpcal_[^"]*"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  // Self-closing <script src="..."></script> tags with no body content.
  html = html.replace(/<script id="wpcal_[^"]*"[^>]*><\/script>\s*/g, '');

  if (html === before) {
    console.log('  ⚠ No wpcal markup found — page may already be patched or upstream markup changed\n');
    return;
  }

  fs.writeFileSync(DEMO_PAGE, html);
  console.log('  ✓ Replaced dead wpcal calendar widget with the real booking widget on /virtual-marketer-demo/\n');
}

main();
