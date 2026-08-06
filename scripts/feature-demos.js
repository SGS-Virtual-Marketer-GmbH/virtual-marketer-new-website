#!/usr/bin/env node

/**
 * Animated product demos for the feature landing pages
 * (scripts/generate-feature-pages.js) — auto-playing, looping scenes that
 * mimic the real product UI inside a fake browser window. Plain HTML plus a
 * declarative step timeline executed by the tiny shared runner below; no
 * backend calls, no external assets, no framework.
 *
 * PORTED COPY — the source of truth for these scenes is the product repo:
 *   vm-customer-web-ui/scripts/marketing-demos.ts
 * (used there for the logged-out /tools/* pages on login.virtual-marketer.de).
 * When scenes change over there, re-sync this file. Differences from the
 * source are deliberate and must be preserved when syncing:
 *   1. CommonJS, no TypeScript types (this build pipeline is plain node).
 *   2. All font sizes in px, not rem — the WordPress theme resets the root
 *      font-size to 12px, so rem values would render 25% smaller here.
 *   3. Browser-chrome classes are vmd-window/vmd-titlebar/vmd-stage/… instead
 *      of demo-window/… — generate-feature-pages.js already uses .demo-* for
 *      the interactive step-through wizard, and its `.vm-fp .demo-stage` rule
 *      would out-specificity an unprefixed `.demo-stage` here.
 *   4. The .vmd-window block defines the gray-scale custom properties the
 *      product app gets from its own stylesheet.
 *
 * Accessibility / motion: with prefers-reduced-motion the runner applies all
 * steps instantly once (final state, no loop).
 *
 * White-label rule applies: only Virtual Marketer product names, never
 * AI-vendor or infrastructure names.
 */

// ---------------------------------------------------------------------------
// Shared CSS for all demos (appended to the page <style>).
// ---------------------------------------------------------------------------
const DEMO_STYLE = `
  .vmd-window { --vm-gray-300:#d9cfd0; --vm-gray-400:#a99a9c; --vm-gray-600:#5a5052; --vm-gray-700:#4a4143; --vm-gray-800:#362a2d;
    background: #fff; border: 1px solid var(--vm-gray-300); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 60px -24px rgba(36,20,23,0.35); }
  .vmd-titlebar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--vm-gray-100); border-bottom: 1px solid var(--vm-gray-200); }
  .vmd-dot { width: 11px; height: 11px; border-radius: 999px; background: var(--vm-gray-300); }
  .vmd-dot:nth-child(1) { background: #f87171; } .vmd-dot:nth-child(2) { background: #fbbf24; } .vmd-dot:nth-child(3) { background: #34d399; }
  .vmd-titletext { margin-left: 10px; font-size: 12.5px; font-weight: 600; color: var(--vm-gray-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vmd-stage { padding: 22px; min-height: 300px; font-size: 14px; text-align: left; }
  .vmd-demonote { font-size: 13px; color: var(--vm-gray-500); margin: 10px 2px 0; }

  .vmd { transition: opacity 0.45s ease, transform 0.45s ease; }
  .vmd:not(.vmd-on) { opacity: 0; transform: translateY(8px); pointer-events: none; }
  .vmd-instant { transition: none; }

  .vmd-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vm-gray-500); margin: 0 0 6px; }
  .vmd-input { background: var(--vm-gray-100); border: 1px solid var(--vm-gray-300); border-radius: 10px; padding: 10px 14px; color: var(--vm-gray-800); min-height: 20px; line-height: 1.5; }
  .vmd-typing::after { content: "▍"; color: var(--vm-red); animation: vmdBlink 0.8s step-start infinite; }
  @keyframes vmdBlink { 50% { opacity: 0; } }

  .vmd-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--vm-red); color: #fff; font-weight: 700; border-radius: 10px; padding: 9px 20px; font-size: 14px; }
  .vmd-btn.vmd-busy::before { content: ""; width: 12px; height: 12px; border-radius: 999px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; animation: vmdSpin 0.7s linear infinite; }
  @keyframes vmdSpin { to { transform: rotate(360deg); } }
  .vmd-btn-ghost { background: #fff; color: var(--vm-gray-700); border: 1px solid var(--vm-gray-300); }

  .vmd-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--vm-gray-300); background: #fff; color: var(--vm-gray-600); border-radius: 999px; padding: 6px 14px; font-weight: 600; font-size: 13px; transition: all 0.3s ease; }
  .vmd-chip.vmd-chip-on { border-color: var(--vm-red); color: var(--vm-red); background: rgba(148,21,43,0.06); }
  .vmd-chip .vmd-primarytag { display: none; font-size: 10px; font-weight: 800; color: #fff; background: var(--vm-red); border-radius: 999px; padding: 1px 7px; }
  .vmd-chip.vmd-chip-primary .vmd-primarytag { display: inline; }

  .vmd-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .vmd-grid2 { grid-template-columns: 1fr; } }
  .vmd-card { background: var(--vm-gray-100); border: 1px solid var(--vm-gray-200); border-radius: 12px; padding: 14px; }
  .vmd-card-title { display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--vm-gray-800); font-size: 13px; margin-bottom: 8px; }
  .vmd-line { height: 9px; border-radius: 6px; background: var(--vm-gray-300); margin: 7px 0; overflow: hidden; position: relative; }
  .vmd-line.vmd-shimmer::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent); animation: vmdShimmer 1.1s ease infinite; }
  @keyframes vmdShimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
  .vmd-text { color: var(--vm-gray-700); line-height: 1.5; font-size: 13px; }
  .vmd-strike { text-decoration: line-through; color: var(--vm-gray-500); }
  .vmd-new { color: var(--vm-gray-800); font-weight: 600; }

  .vmd-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 3px 10px; background: rgba(52,211,153,0.15); color: #047857; }
  .vmd-badge-blue { background: rgba(102,163,206,0.15); color: #1d4ed8; }
  .vmd-badge-red { background: rgba(148,21,43,0.08); color: var(--vm-red); }

  .vmd-msg { max-width: 85%; border-radius: 14px; padding: 10px 14px; margin: 8px 0; line-height: 1.5; font-size: 13.5px; }
  .vmd-msg-user { background: var(--vm-red); color: #fff; margin-left: auto; border-bottom-right-radius: 4px; }
  .vmd-msg-bot { background: var(--vm-gray-100); border: 1px solid var(--vm-gray-200); color: var(--vm-gray-800); border-bottom-left-radius: 4px; }
  .vmd-tool { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--vm-gray-600); background: var(--vm-gray-100); border: 1px dashed var(--vm-gray-400); border-radius: 999px; padding: 4px 12px; margin: 4px 0; }
  .vmd-tool::before { content: "⚙"; }

  .vmd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .vmd-table th { text-align: left; color: var(--vm-gray-500); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 8px; border-bottom: 1px solid var(--vm-gray-300); }
  .vmd-table td { padding: 7px 8px; border-bottom: 1px solid var(--vm-gray-200); color: var(--vm-gray-700); }
  .vmd-cell-miss { color: var(--vm-gray-400); font-style: italic; }
  .vmd-cell-fill { color: #047857; font-weight: 600; animation: vmdPop 0.4s ease; }
  @keyframes vmdPop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  .vmd-progress { height: 8px; border-radius: 999px; background: var(--vm-gray-200); overflow: hidden; }
  .vmd-progress > span { display: block; height: 100%; width: 0; border-radius: 999px; background: var(--vm-red); transition: width 1.1s ease; }

  .vmd-imgbox { border-radius: 12px; border: 1px solid var(--vm-gray-200); height: 130px; background: linear-gradient(135deg, #a3cce9 0%, #66a3ce 45%, #94152b 130%); position: relative; overflow: hidden; transition: filter 1.2s ease; }
  .vmd-imgbox.vmd-blur { filter: blur(14px) saturate(0.4); }
  .vmd-imgbox::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 68% 32%, rgba(255,255,255,0.55), transparent 42%); }
  /* With a real example in the pane the decorative gradient and its highlight
     would show through the photo, so both are dropped for those. */
  .vmd-imgbox.vmd-hasimg { background: var(--vm-gray-100); }
  .vmd-imgbox.vmd-hasimg::after { display: none; }
  .vmd-imgbox.vmd-hasimg img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .vmd-avatar.vmd-hasimg { background: none; overflow: hidden; }
  .vmd-avatar.vmd-hasimg img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* Avatars cut from a full-body shot. object-fit:cover centres on the frame,
     which on a head-to-toe photo is the waist — so the circle shows a torso
     and no face. Pulling the crop to the top of the image puts the head in
     the circle, which is the only part of a 44px avatar that reads. */
  .vmd-avatars-face .vmd-avatar.vmd-hasimg img { object-position: 50% 4%; }
  /* The result pane holds a head-to-toe fashion photo, and the point of it is
     that you can see the garment on the model. A 130px-tall cover crop showed
     a midriff with the head cut off. Taller, and contained rather than
     cropped, so the whole figure is in frame. */
  .vmd-imgbox.vmd-imgbox-full { height: 250px; background: var(--vm-gray-100); }
  .vmd-imgbox.vmd-imgbox-full img { object-fit: contain; }
  .vmd-playhead { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; box-shadow: 0 0 8px rgba(255,255,255,0.9); left: 4%; transition: left 2.6s linear; }

  .vmd-email { border: 1px solid var(--vm-gray-200); border-radius: 12px; overflow: hidden; background: #fff; }
  .vmd-email-head { background: var(--vm-gray-100); border-bottom: 1px solid var(--vm-gray-200); padding: 10px 14px; font-size: 13px; color: var(--vm-gray-700); }
  .vmd-email-body { padding: 14px; }
  .vmd-cta { display: inline-block; background: var(--vm-red); color: #fff; font-weight: 700; font-size: 12.5px; border-radius: 8px; padding: 8px 18px; margin-top: 8px; }

  .vmd-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .vmd-cal-day { background: var(--vm-gray-100); border: 1px solid var(--vm-gray-200); border-radius: 8px; padding: 6px 4px; text-align: center; font-size: 11px; color: var(--vm-gray-500); min-height: 44px; }
  .vmd-cal-slot { margin-top: 4px; height: 8px; border-radius: 4px; background: var(--vm-gray-300); transition: background 0.4s ease; }
  .vmd-cal-day.vmd-slot-on .vmd-cal-slot { background: var(--vm-blue); }
  .vmd-cal-day.vmd-slot-done .vmd-cal-slot { background: #34d399; }

  .vmd-code { background: #1a202c; border-radius: 12px; padding: 14px 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.65; color: #e2e8f0; overflow-x: auto; }
  .vmd-code .c-key { color: #a3cce9; } .vmd-code .c-str { color: #fbbf24; } .vmd-code .c-cmt { color: #718096; }

  .vmd-avatars { display: flex; gap: 10px; }
  .vmd-avatar { width: 44px; height: 44px; border-radius: 999px; background: linear-gradient(135deg, var(--vm-gray-300), var(--vm-gray-400)); border: 2px solid transparent; transition: border-color 0.3s ease, transform 0.3s ease; }
  .vmd-avatar.vmd-picked { border-color: var(--vm-red); transform: scale(1.1); }

  .vmd-flow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .vmd-arrow { color: var(--vm-gray-400); font-size: 18px; }

  .vmd-linkword { border-bottom: 2px solid transparent; transition: all 0.3s ease; }
  .vmd-linkword.vmd-linked { color: var(--vm-red); border-bottom-color: var(--vm-red); font-weight: 600; }

  .vmd-senti { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 2px 9px; }
  .vmd-senti-pos { background: rgba(52,211,153,0.15); color: #047857; }
  .vmd-senti-neu { background: var(--vm-gray-200); color: var(--vm-gray-600); }
`;

// ---------------------------------------------------------------------------
// Shared runner. Serialized once per page. Starts when the demo scrolls into
// view; loops forever; reduced-motion → final state, once, statically.
// ---------------------------------------------------------------------------
const DEMO_ENGINE_JS = `
function vmDemo(rootId, steps, loopPause) {
  var root = document.getElementById(rootId);
  if (!root) return;
  var initial = root.innerHTML;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timer = null;
  function q(sel) { return root.querySelector(sel); }
  function apply(step, instant, next) {
    var el = step.s ? q(step.s) : null;
    var done = function () { if (!instant) timer = setTimeout(next, 0); };
    if (step.t === 'wait') { done(); return; }
    if (!el) { done(); return; }
    if (step.t === 'text') { el.textContent = step.x; done(); return; }
    if (step.t === 'show') { el.classList.add('vmd-on'); done(); return; }
    if (step.t === 'hide') { el.classList.remove('vmd-on'); done(); return; }
    if (step.t === 'class') { el.classList.add(step.x); done(); return; }
    if (step.t === 'style') { el.style[step.k] = step.x; done(); return; }
    if (step.t === 'type') {
      if (instant) { el.textContent = step.x; return; }
      el.textContent = '';
      el.classList.add('vmd-typing');
      var i = 0;
      var tick = function () {
        el.textContent = step.x.slice(0, ++i);
        if (i < step.x.length) timer = setTimeout(tick, 24);
        else { el.classList.remove('vmd-typing'); timer = setTimeout(next, 0); }
      };
      tick();
      return;
    }
    done();
  }
  function runFrom(i) {
    if (i >= steps.length) {
      timer = setTimeout(function () { root.innerHTML = initial; runFrom(0); }, loopPause || 3800);
      return;
    }
    timer = setTimeout(function () { apply(steps[i], false, function () { runFrom(i + 1); }); }, steps[i].d == null ? 400 : steps[i].d);
  }
  if (reduced) {
    root.querySelectorAll('.vmd').forEach(function (el) { el.classList.add('vmd-instant'); });
    steps.forEach(function (s) { apply(s, true, function () {}); });
    return;
  }
  if ('IntersectionObserver' in window) {
    var started = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !started) { started = true; io.disconnect(); runFrom(0); }
      });
    }, { threshold: 0.25 });
    io.observe(root);
  } else {
    runFrom(0);
  }
}
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const skel = (n, cls = '') =>
  Array.from({ length: n }, (_, i) => `<div class="vmd-line vmd-shimmer ${cls}" style="width:${[92, 78, 85, 64][i % 4]}%"></div>`).join('');

function chat(idPrefix, userText, toolText, botText) {
  return `
    <div class="vmd-msg vmd-msg-user vmd" id="${idPrefix}-u"><span id="${idPrefix}-ut"></span></div>
    <div class="vmd vmd-tool" id="${idPrefix}-tool">${toolText}</div>
    <div class="vmd-msg vmd-msg-bot vmd" id="${idPrefix}-b"><span id="${idPrefix}-bt"></span></div>`;
}

// ---------------------------------------------------------------------------
// The demos, one per product view (keys match the product repo's AppView).
// ---------------------------------------------------------------------------

/**
 * Real example output inside a mockup's image pane.
 *
 * These panes were a blue-red CSS gradient that un-blurred on cue, which
 * demonstrated a blur transition rather than anything the product makes. The
 * blur reveal is kept — it reads as "generating…" — but what sharpens into
 * view is now an actual example asset.
 *
 * Falls back to the gradient when the file is absent so a checkout without
 * generated images still builds (see scripts/generate-ai-images.js).
 */
function vmdImage(id, src, extraStyle, extraClass) {
  const fs = require('fs');
  const path = require('path');
  const rel = `assets/product-pages/${src}`;
  const has = fs.existsSync(path.join(__dirname, '..', rel));
  const style = extraStyle ? ` style="${extraStyle}"` : '';
  const cls = extraClass ? ` ${extraClass}` : '';
  if (!has) return `<div class="vmd-imgbox vmd-blur${cls}" id="${id}"${style}></div>`;
  return `<div class="vmd-imgbox vmd-blur vmd-hasimg${cls}" id="${id}"${style}>` +
    `<img src="/product-pages/${src}" alt="" loading="lazy" decoding="async"></div>`;
}

/** Avatar row backed by the real model portraits. */
function vmdAvatars(ids, files) {
  const fs = require('fs');
  const path = require('path');
  return ids
    .map((id, i) => {
      const file = (files && files[i]) || `demo-model-${i + 1}.jpg`;
      const has = fs.existsSync(path.join(__dirname, '..', `assets/product-pages/${file}`));
      return has
        ? `<span class="vmd-avatar vmd-hasimg" id="${id}"><img src="/product-pages/${file}" alt="" loading="lazy" decoding="async"></span>`
        : `<span class="vmd-avatar" id="${id}"></span>`;
    })
    .join('');
}

/**
 * The Product Staging line-up.
 *
 * One list, used for both the avatar row and the result pane, because the
 * whole claim of that demo is "the model you picked is the model you get".
 * It previously failed that on sight: the avatars were the head-and-shoulders
 * demo-model-*.jpg portraits, the animation highlighted the second one — a
 * man — and the result pane was a hardcoded image of a woman in a green
 * jumpsuit. A visitor watching the demo saw it pick one person and produce a
 * different one, in a demo whose entire subject is identity preservation.
 *
 * Deriving both from `picked` means the two can no longer disagree: change
 * the index and the avatar highlight and the result move together.
 *
 * These models have full-body studio shots, which the demo-model-* portraits
 * do not — and a head-and-shoulders crop cannot show a garment, which is what
 * the result pane exists to do.
 */
const STAGING_MODELS = [
  { avatar: 'model-sabrina-studio.jpg', result: 'model-sabrina-studio.jpg' },
  { avatar: 'model-malik-studio.jpg', result: 'model-malik-studio.jpg' },
  { avatar: 'model-greta-studio.jpg', result: 'model-greta-studio.jpg' },
];
/** Which of the three the animation settles on. */
const STAGING_PICK = 0;

function buildDemo(view, locale) {
  const de = locale === 'de';
  const L = (d, e) => (de ? d : e);

  switch (view) {
    // ----- Campaign Builder: one briefing fans out into four channels -------
    case 'campaign': {
      const brief = L(
        'Sommer-Sale für unsere Lauf-Kollektion: 20 % auf alles, junge aktive Zielgruppe.',
        'Summer sale for our running collection: 20% off everything, young active audience.'
      );
      return {
        title: L('Virtual Marketer — Campaign Builder', 'Virtual Marketer — Campaign Builder'),
        html: `
          <p class="vmd-label">${L('1 · Briefing & Assets', '1 · Briefing & assets')}</p>
          <div class="vmd-input"><span id="cb-brief"></span></div>
          <p class="vmd-label" style="margin-top:14px;">${L('2 · Kanäle', '2 · Channels')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="vmd-chip" id="cb-c1">Google Ads <span class="vmd-primarytag">${L('PRODUKTION', 'PRODUCTION')}</span></span>
            <span class="vmd-chip" id="cb-c2">Meta Paid</span>
            <span class="vmd-chip" id="cb-c3">E-Mail</span>
            <span class="vmd-chip" id="cb-c4">Social</span>
          </div>
          <div class="vmd" id="cb-gen" style="margin-top:14px;"><span class="vmd-btn vmd-busy" id="cb-btn">${L('Alle Kanäle generieren', 'Generate all channels')}</span></div>
          <div class="vmd-grid2" style="margin-top:14px;">
            <div class="vmd vmd-card" id="cb-r1"><div class="vmd-card-title">Google Ads <span class="vmd-badge" id="cb-b1" style="visibility:hidden;">✓</span></div><div id="cb-t1">${skel(3)}</div></div>
            <div class="vmd vmd-card" id="cb-r2"><div class="vmd-card-title">Meta Paid <span class="vmd-badge" id="cb-b2" style="visibility:hidden;">✓</span></div><div id="cb-t2">${skel(3)}</div></div>
            <div class="vmd vmd-card" id="cb-r3"><div class="vmd-card-title">${L('E-Mail-Kampagne', 'Email campaign')} <span class="vmd-badge" id="cb-b3" style="visibility:hidden;">✓</span></div><div id="cb-t3">${skel(3)}</div></div>
            <div class="vmd vmd-card" id="cb-r4"><div class="vmd-card-title">${L('Social-Post', 'Social post')} <span class="vmd-badge vmd-badge-blue" id="cb-b4" style="visibility:hidden;">A/B</span></div><div id="cb-t4">${skel(3)}</div></div>
          </div>`,
        steps: [
          { t: 'type', s: '#cb-brief', x: brief, d: 500 },
          { t: 'class', s: '#cb-c1', x: 'vmd-chip-on', d: 500 },
          { t: 'class', s: '#cb-c1', x: 'vmd-chip-primary', d: 250 },
          { t: 'class', s: '#cb-c2', x: 'vmd-chip-on', d: 300 },
          { t: 'class', s: '#cb-c3', x: 'vmd-chip-on', d: 300 },
          { t: 'class', s: '#cb-c4', x: 'vmd-chip-on', d: 300 },
          { t: 'show', s: '#cb-gen', d: 450 },
          { t: 'show', s: '#cb-r1', d: 700 }, { t: 'show', s: '#cb-r2', d: 150 },
          { t: 'show', s: '#cb-r3', d: 150 }, { t: 'show', s: '#cb-r4', d: 150 },
          { t: 'text', s: '#cb-t1', x: L('„Lauf-Kollektion −20 %“ · „Jetzt Sale sichern“ · 12 Headlines, 4 Beschreibungen', '“Running collection −20%” · “Shop the sale” · 12 headlines, 4 descriptions'), d: 1300 },
          { t: 'style', s: '#cb-b1', k: 'visibility', x: 'visible', d: 100 },
          { t: 'text', s: '#cb-t2', x: L('Primary Text + Hook + 1:1-Creative für Feed & Stories', 'Primary text + hook + 1:1 creative for feed & stories'), d: 700 },
          { t: 'style', s: '#cb-b2', k: 'visibility', x: 'visible', d: 100 },
          { t: 'text', s: '#cb-t3', x: L('Betreff, Preheader, Hero-Bild & CTA — als Entwurf bereit für Ihren E-Mail-Anbieter', 'Subject, preheader, hero image & CTA — ready as a draft for your email provider'), d: 700 },
          { t: 'style', s: '#cb-b3', k: 'visibility', x: 'visible', d: 100 },
          { t: 'text', s: '#cb-t4', x: L('Organischer Post mit Persona-Bild — plus A/B-Test mit zwei Varianten je Kanal', 'Organic post with persona image — plus an A/B test with two variants per channel'), d: 700 },
          { t: 'style', s: '#cb-b4', k: 'visibility', x: 'visible', d: 100 },
          { t: 'text', s: '#cb-btn', x: L('Fertig — 4 Kanäle aus einem Briefing', 'Done — 4 channels from one briefing'), d: 500 },
          { t: 'class', s: '#cb-btn', x: 'vmd-btn-donestate', d: 0 },
        ],
      };
    }

    // ----- Email Marketing: briefing → email → draft in ESP -----------------
    case 'mail': {
      return {
        title: L('Virtual Marketer — E-Mail-Marketing', 'Virtual Marketer — Email Marketing'),
        html: `
          <p class="vmd-label">${L('Briefing', 'Briefing')}</p>
          <div class="vmd-input"><span id="em-brief"></span></div>
          <div class="vmd-email vmd" id="em-mail" style="margin-top:14px;">
            <div class="vmd-email-head"><strong>${L('Betreff:', 'Subject:')}</strong> <span id="em-subj"></span></div>
            <div class="vmd-email-body">
              ${vmdImage('em-hero', 'demo-email-hero.jpg', 'height:78px;')}
              <div id="em-body" style="margin-top:10px;">${skel(3)}</div>
              <span class="vmd-cta vmd" id="em-cta">${L('Jetzt entdecken', 'Discover now')}</span>
            </div>
          </div>
          <div class="vmd" id="em-push" style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="vmd-btn" id="em-pushbtn">${L('Als Entwurf übertragen', 'Push as draft')}</span>
            <span class="vmd-badge" id="em-pushed" style="visibility:hidden;">✓ ${L('Entwurf in Ihrem E-Mail-Anbieter — Versand bleibt bei Ihnen', 'Draft in your email provider — sending stays with you')}</span>
          </div>`,
        steps: [
          { t: 'type', s: '#em-brief', x: L('Neue Frühjahrskollektion ankündigen, 15 % Willkommensrabatt.', 'Announce the new spring collection, 15% welcome discount.'), d: 500 },
          { t: 'show', s: '#em-mail', d: 600 },
          { t: 'type', s: '#em-subj', x: L('Der Frühling ist da — 15 % auf alles Neue 🌱', 'Spring is here — 15% off everything new 🌱'), d: 500 },
          { t: 'class', s: '#em-hero', x: 'vmd-unblur', d: 400 },
          { t: 'style', s: '#em-hero', k: 'filter', x: 'none', d: 0 },
          { t: 'text', s: '#em-body', x: L('Drei Absätze Markentext, responsives HTML, korrekter Abmelde-Link — alles generiert und vor dem Übertragen editierbar.', 'Three paragraphs of on-brand copy, responsive HTML, a correct unsubscribe link — all generated and editable before pushing.'), d: 900 },
          { t: 'show', s: '#em-cta', d: 400 },
          { t: 'show', s: '#em-push', d: 600 },
          { t: 'class', s: '#em-pushbtn', x: 'vmd-busy', d: 700 },
          { t: 'style', s: '#em-pushed', k: 'visibility', x: 'visible', d: 1200 },
        ],
      };
    }

    // ----- Agents 2.0: chat with tool use ------------------------------------
    case 'agents2': {
      return {
        title: L('Virtual Marketer — Agents 2.0', 'Virtual Marketer — Agents 2.0'),
        html: chat(
          'ag',
          '',
          L('Analytics-Daten werden gelesen …', 'Reading analytics data …'),
          ''
        ) + `
          <div class="vmd" id="ag-actions" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="vmd-badge">✓ ${L('Analyse fertig', 'Analysis done')}</span>
            <span class="vmd-badge vmd-badge-blue">${L('Zeitplan: täglich 7:00', 'Schedule: daily 7am')}</span>
            <span class="vmd-badge vmd-badge-red">${L('Änderungen nur mit Freigabe', 'Changes only with approval')}</span>
          </div>`,
        steps: [
          { t: 'show', s: '#ag-u', d: 500 },
          { t: 'type', s: '#ag-ut', x: L('Wie liefen unsere Kampagnen letzte Woche — und was sollten wir ändern?', 'How did our campaigns do last week — and what should we change?'), d: 100 },
          { t: 'show', s: '#ag-tool', d: 600 },
          { t: 'show', s: '#ag-b', d: 1600 },
          { t: 'type', s: '#ag-bt', x: L('Umsatz +12 % zur Vorwoche. Zwei Anzeigengruppen mit schwachem CTR gefunden — ich habe einen Optimierungsvorschlag in Ihre Freigaben gelegt.', "Revenue up 12% week over week. Found two ad groups with weak CTR — I've placed an optimization proposal in your approvals inbox."), d: 100 },
          { t: 'show', s: '#ag-actions', d: 700 },
        ],
      };
    }

    // ----- Coding API: request in editor, streamed reply ---------------------
    case 'coding': {
      return {
        title: L('Ihr Editor — Virtual Marketer Coding-API', 'Your editor — Virtual Marketer Coding API'),
        html: `
          <div class="vmd-code">
            <div><span class="c-cmt"># ${L('Jedes Tool mit eigenem Endpunkt-Support', 'Any tool that supports a custom endpoint')}</span></div>
            <div><span class="c-key">base_url</span> = <span class="c-str">"https://login.virtual-marketer.de/v1"</span></div>
            <div><span class="c-key">model</span>    = <span class="c-str">"virtual-marketer-senior"</span></div>
            <div style="margin-top:8px;"><span class="c-cmt">&gt; </span><span id="co-req"></span></div>
            <div class="vmd" id="co-resp" style="margin-top:8px;color:#a7f3d0;"><span id="co-respt"></span></div>
          </div>
          <div class="vmd" id="co-badges" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="vmd-badge">✓ Streaming</span>
            <span class="vmd-badge">✓ ${L('Tool-Calling', 'Tool calling')}</span>
            <span class="vmd-badge vmd-badge-blue">Senior & Junior</span>
          </div>`,
        steps: [
          { t: 'type', s: '#co-req', x: L('Schreibe eine Funktion, die Produktdaten aus CSV parst und validiert.', 'Write a function that parses and validates product data from CSV.'), d: 600 },
          { t: 'show', s: '#co-resp', d: 700 },
          { t: 'type', s: '#co-respt', x: 'def parse_products(path): …  ✓ 42 lines, typed, with tests', d: 100 },
          { t: 'show', s: '#co-badges', d: 500 },
        ],
      };
    }

    // ----- Product Staging: product + avatar → staged photo ------------------
    case 'staging': {
      return {
        title: L('Virtual Marketer — Product Staging', 'Virtual Marketer — Product Staging'),
        html: `
          <div class="vmd-flow">
            <div style="flex:1;min-width:130px;">
              <p class="vmd-label">${L('Produktfoto', 'Product photo')}</p>
              <div class="vmd-card" style="text-align:center;padding:18px;"><span style="font-size:32px;">👕</span><div class="vmd-text" style="margin-top:4px;">${L('aus dem Katalog', 'from the catalog')}</div></div>
            </div>
            <span class="vmd-arrow">→</span>
            <div style="flex:1;min-width:130px;">
              <p class="vmd-label">${L('Avatar wählen', 'Pick an avatar')}</p>
              <div class="vmd-avatars vmd-avatars-face">${vmdAvatars(
                ['st-a1', 'st-a2', 'st-a3'],
                STAGING_MODELS.map((m) => m.avatar)
              )}</div>
            </div>
            <span class="vmd-arrow">→</span>
            <div style="flex:1.4;min-width:150px;">
              <p class="vmd-label">${L('Ergebnis', 'Result')}</p>
              ${vmdImage('st-result', STAGING_MODELS[STAGING_PICK].result, '', 'vmd-imgbox-full')}
              <div class="vmd" id="st-done" style="margin-top:8px;"><span class="vmd-badge">✓ ${L('Model trägt Ihr Produkt — bereit für Shop & Ads', 'Model wearing your product — ready for shop & ads')}</span></div>
            </div>
          </div>
          <div class="vmd" id="st-video" style="margin-top:14px;"><span class="vmd-badge vmd-badge-blue">🎬 ${L('Optional: Foto zu kurzem Video animieren', 'Optional: animate the photo into a short clip')}</span></div>`,
        steps: [
          { t: 'class', s: `#st-a${STAGING_PICK + 1}`, x: 'vmd-picked', d: 900 },
          { t: 'style', s: '#st-result', k: 'filter', x: 'none', d: 1300 },
          { t: 'show', s: '#st-done', d: 800 },
          { t: 'show', s: '#st-video', d: 600 },
        ],
        loopPause: 4200,
      };
    }

    // ----- Files: reports appear, one opens ----------------------------------
    case 'files': {
      return {
        title: L('Virtual Marketer — Dateien', 'Virtual Marketer — Files'),
        html: `
          <table class="vmd-table">
            <tr><th>${L('Name', 'Name')}</th><th>${L('Quelle', 'Source')}</th><th></th></tr>
            <tr class="vmd" id="fi-r1"><td>📊 ${L('Performance-Report KW 30.md', 'Performance report W30.md')}</td><td>${L('Analytics-Agent', 'Analytics agent')}</td><td><span class="vmd-badge" id="fi-b1" style="visibility:hidden;">${L('neu', 'new')}</span></td></tr>
            <tr class="vmd" id="fi-r2"><td>📈 ${L('Konto-Audit Juli.md', 'Account audit July.md')}</td><td>${L('Ads-Agent', 'Ads agent')}</td><td></td></tr>
            <tr class="vmd" id="fi-r3"><td>📝 ${L('Content-Plan Q3.md', 'Content plan Q3.md')}</td><td>${L('SEO-Agent', 'SEO agent')}</td><td></td></tr>
          </table>
          <div class="vmd vmd-card" id="fi-preview" style="margin-top:12px;">
            <div class="vmd-card-title">${L('Vorschau — Performance-Report KW 30', 'Preview — Performance report W30')}</div>
            <div class="vmd-text" id="fi-prevtext"></div>
          </div>`,
        steps: [
          { t: 'show', s: '#fi-r1', d: 500 },
          { t: 'style', s: '#fi-b1', k: 'visibility', x: 'visible', d: 200 },
          { t: 'show', s: '#fi-r2', d: 300 },
          { t: 'show', s: '#fi-r3', d: 300 },
          { t: 'show', s: '#fi-preview', d: 700 },
          { t: 'type', s: '#fi-prevtext', x: L('Umsatz +12 %, Top-Kanal: Google Ads. Empfehlung: Budget-Verlagerung in die zwei stärksten Anzeigengruppen …', 'Revenue +12%, top channel: Google Ads. Recommendation: shift budget into the two strongest ad groups …'), d: 300 },
        ],
      };
    }

    // ----- Social Publisher: schedule fills, post generated, approved --------
    case 'socialPublisher': {
      const days = de ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      return {
        title: L('Virtual Marketer — Social Publisher', 'Virtual Marketer — Social Publisher'),
        html: `
          <p class="vmd-label">${L('Wochenplan', 'Weekly schedule')}</p>
          <div class="vmd-cal">${days.map((d, i) => `<div class="vmd-cal-day" id="sp-d${i}">${d}<div class="vmd-cal-slot"></div></div>`).join('')}</div>
          <div class="vmd vmd-card" id="sp-post" style="margin-top:14px;">
            <div class="vmd-card-title"><span>💼 ${L('Generierter Beitrag — Persona „Lena“', 'Generated post — persona “Lena”')}</span><span class="vmd-badge vmd-badge-blue" id="sp-state">${L('wartet auf Freigabe', 'awaiting approval')}</span></div>
            <div class="vmd-text" id="sp-text"></div>
          </div>
          <div class="vmd" id="sp-approve" style="margin-top:10px;display:flex;gap:10px;align-items:center;">
            <span class="vmd-btn" id="sp-btn">${L('Freigeben & veröffentlichen', 'Approve & publish')}</span>
          </div>`,
        steps: [
          { t: 'class', s: '#sp-d1', x: 'vmd-slot-on', d: 500 },
          { t: 'class', s: '#sp-d3', x: 'vmd-slot-on', d: 300 },
          { t: 'show', s: '#sp-post', d: 700 },
          { t: 'type', s: '#sp-text', x: L('Drei Dinge, die wir aus 1.000 Produkttests gelernt haben — Nummer 2 überrascht jedes Mal …', 'Three things we learned from 1,000 product tests — number two surprises us every time …'), d: 400 },
          { t: 'show', s: '#sp-approve', d: 700 },
          { t: 'class', s: '#sp-btn', x: 'vmd-busy', d: 900 },
          { t: 'text', s: '#sp-state', x: L('✓ veröffentlicht', '✓ published'), d: 1100 },
          { t: 'class', s: '#sp-d1', x: 'vmd-slot-done', d: 200 },
        ],
      };
    }

    // ----- Feed Enhance: table cells fill, validation passes -----------------
    case 'feedEnhance': {
      return {
        title: L('Virtual Marketer — Feed Enhance', 'Virtual Marketer — Feed Enhance'),
        html: `
          <table class="vmd-table">
            <tr><th>${L('Produkt', 'Product')}</th><th>${L('Farbe', 'Color')}</th><th>${L('Material', 'Material')}</th><th>${L('Titel', 'Title')}</th></tr>
            <tr><td>👟 Runner Pro</td><td id="fe-c1" class="vmd-cell-miss">${L('fehlt', 'missing')}</td><td id="fe-m1" class="vmd-cell-miss">${L('fehlt', 'missing')}</td><td id="fe-t1">Runner Pro</td></tr>
            <tr><td>🧥 City Jacke</td><td>${L('Blau', 'Blue')}</td><td id="fe-m2" class="vmd-cell-miss">${L('fehlt', 'missing')}</td><td id="fe-t2">City Jacke</td></tr>
          </table>
          <div class="vmd" id="fe-run" style="margin-top:12px;"><span class="vmd-tool">${L('AI-Schritt läuft — nur neue & geänderte Produkte', 'AI step running — only new & changed products')}</span></div>
          <div class="vmd" id="fe-valid" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="vmd-badge">✓ ${L('Validierung bestanden', 'Validation passed')}</span>
            <span class="vmd-badge vmd-badge-blue">${L('Feed-URL aktualisiert', 'Feed URL updated')}</span>
          </div>`,
        steps: [
          { t: 'show', s: '#fe-run', d: 600 },
          { t: 'text', s: '#fe-c1', x: L('Rot', 'Red'), d: 1100 },
          { t: 'class', s: '#fe-c1', x: 'vmd-cell-fill', d: 0 },
          { t: 'text', s: '#fe-m1', x: 'Mesh', d: 500 },
          { t: 'class', s: '#fe-m1', x: 'vmd-cell-fill', d: 0 },
          { t: 'text', s: '#fe-m2', x: L('Baumwolle', 'Cotton'), d: 500 },
          { t: 'class', s: '#fe-m2', x: 'vmd-cell-fill', d: 0 },
          { t: 'text', s: '#fe-t1', x: L('Runner Pro Herren Laufschuh, Rot, Mesh', "Runner Pro men's running shoe, red, mesh"), d: 600 },
          { t: 'class', s: '#fe-t1', x: 'vmd-cell-fill', d: 0 },
          { t: 'show', s: '#fe-valid', d: 800 },
        ],
      };
    }

    // ----- Single generator ---------------------------------------------------
    case 'single': {
      return {
        title: L('Virtual Marketer — Einzel-Generator', 'Virtual Marketer — Single Generator'),
        html: `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
            <span class="vmd-chip vmd-chip-on">${L('Modell: Ihre Markensprache', 'Model: your brand voice')}</span>
          </div>
          <p class="vmd-label">${L('Eingabe', 'Input')}</p>
          <div class="vmd-input"><span id="sg-in"></span></div>
          <p class="vmd-label" style="margin-top:12px;">${L('Ergebnis', 'Result')}</p>
          <div class="vmd vmd-card" id="sg-out"><div class="vmd-text" id="sg-outtext"></div></div>
          <div class="vmd" id="sg-actions" style="margin-top:10px;"><span class="vmd-badge">✓ ${L('Kopieren oder als HTML herunterladen', 'Copy or download as HTML')}</span></div>`,
        steps: [
          { t: 'type', s: '#sg-in', x: L('Trekkingrucksack 28 L, wasserdicht, ergonomisches Tragesystem', 'Trekking backpack 28 L, waterproof, ergonomic carry system'), d: 500 },
          { t: 'show', s: '#sg-out', d: 700 },
          { t: 'type', s: '#sg-outtext', x: L('Der 28-Liter-Trekkingrucksack begleitet Sie bei jedem Wetter: vollständig wasserdicht, mit ergonomischem Tragesystem für lange Touren …', 'This 28-litre trekking backpack goes wherever you do: fully waterproof, with an ergonomic carry system built for long days out …'), d: 300 },
          { t: 'show', s: '#sg-actions', d: 500 },
        ],
      };
    }

    // ----- Bulk generator -----------------------------------------------------
    case 'bulk': {
      return {
        title: L('Virtual Marketer — Bulk-Generator', 'Virtual Marketer — Bulk Generator'),
        html: `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
            <span class="vmd-chip vmd-chip-on">produkte.csv · 214 ${L('Zeilen', 'rows')}</span>
            <span class="vmd-badge vmd-badge-blue" id="bu-count">0 / 214</span>
          </div>
          <div class="vmd-progress"><span id="bu-bar"></span></div>
          <table class="vmd-table" style="margin-top:12px;">
            <tr><th>SKU</th><th>${L('Status', 'Status')}</th></tr>
            <tr><td>RUN-001</td><td id="bu-s1">⏳</td></tr>
            <tr><td>RUN-002</td><td id="bu-s2">⏳</td></tr>
            <tr><td>RUN-003</td><td id="bu-s3">⏳</td></tr>
          </table>
          <div class="vmd" id="bu-done" style="margin-top:10px;"><span class="vmd-badge">✓ ${L('Fertig — Export als CSV', 'Done — export as CSV')}</span></div>`,
        steps: [
          { t: 'style', s: '#bu-bar', k: 'width', x: '22%', d: 600 },
          { t: 'text', s: '#bu-s1', x: '✓', d: 400 }, { t: 'text', s: '#bu-count', x: '48 / 214', d: 100 },
          { t: 'style', s: '#bu-bar', k: 'width', x: '55%', d: 500 },
          { t: 'text', s: '#bu-s2', x: '✓', d: 300 }, { t: 'text', s: '#bu-count', x: '117 / 214', d: 100 },
          { t: 'style', s: '#bu-bar', k: 'width', x: '100%', d: 500 },
          { t: 'text', s: '#bu-s3', x: '✓', d: 400 }, { t: 'text', s: '#bu-count', x: '214 / 214', d: 100 },
          { t: 'show', s: '#bu-done', d: 500 },
        ],
      };
    }

    // ----- Image generator ----------------------------------------------------
    case 'image': {
      return {
        title: L('Virtual Marketer — Bild-Generator', 'Virtual Marketer — Image Generator'),
        html: `
          <p class="vmd-label">${L('Beschreibung', 'Description')}</p>
          <div class="vmd-input"><span id="im-in"></span></div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <span class="vmd-chip vmd-chip-on">16:9</span><span class="vmd-chip">1:1</span><span class="vmd-chip">9:16</span>
          </div>
          ${vmdImage('im-result', 'demo-imagegen-result.jpg', 'margin-top:12px;')}
          <div class="vmd" id="im-done" style="margin-top:10px;"><span class="vmd-badge">✓ ${L('Download in voller Auflösung', 'Full-resolution download')}</span></div>`,
        steps: [
          { t: 'type', s: '#im-in', x: L('Sportschuh auf nassem Asphalt, dramatisches Abendlicht, Werbe-Look', 'Running shoe on wet asphalt, dramatic evening light, ad-style'), d: 500 },
          { t: 'style', s: '#im-result', k: 'filter', x: 'none', d: 1400 },
          { t: 'show', s: '#im-done', d: 900 },
        ],
      };
    }

    // ----- Video generator ----------------------------------------------------
    case 'video': {
      return {
        title: L('Virtual Marketer — Video-Generator', 'Virtual Marketer — Video Generator'),
        html: `
          <p class="vmd-label">${L('Prompt', 'Prompt')}</p>
          <div class="vmd-input"><span id="vi-in"></span></div>
          ${vmdImage('vi-stage', 'demo-video-frame.jpg', 'margin-top:12px;').replace('vmd-blur ', '').replace('</div>', '<div class="vmd-playhead" id="vi-head"></div></div>')}
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <span class="vmd-chip vmd-chip-on">${L('Schnell', 'Fast')}</span><span class="vmd-chip">${L('Referenzbilder', 'Reference images')}</span><span class="vmd-chip">Frames</span><span class="vmd-chip">${L('Verlängern', 'Extend')}</span>
          </div>
          <div class="vmd" id="vi-done" style="margin-top:10px;"><span class="vmd-badge">✓ ${L('8-Sekunden-Clip, bereit zum Teilen', '8-second clip, ready to share')}</span></div>`,
        steps: [
          { t: 'type', s: '#vi-in', x: L('Kamerafahrt über eine Bergstraße bei Sonnenaufgang, Cinematic-Look', 'Camera glide over a mountain road at sunrise, cinematic look'), d: 500 },
          { t: 'style', s: '#vi-head', k: 'left', x: '96%', d: 800 },
          { t: 'show', s: '#vi-done', d: 2400 },
        ],
      };
    }

    // ----- Content generator --------------------------------------------------
    case 'content': {
      return {
        title: L('Virtual Marketer — Content-Generator', 'Virtual Marketer — Content Generator'),
        html: `
          <p class="vmd-label">${L('Themen aus Ihrer Sitemap', 'Topics from your sitemap')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span class="vmd-chip" id="cg-t1">${L('Wanderschuhe pflegen', 'Caring for hiking boots')}</span>
            <span class="vmd-chip" id="cg-t2">${L('Packliste Trekking', 'Trekking packing list')}</span>
            <span class="vmd-chip" id="cg-t3">${L('Zwiebelprinzip erklärt', 'Layering explained')}</span>
          </div>
          <div class="vmd vmd-card" id="cg-article" style="margin-top:12px;">
            ${vmdImage('cg-hero', 'demo-content-hero.jpg', 'height:64px;')}
            <div class="vmd-card-title" style="margin-top:10px;"><span id="cg-title"></span></div>
            <div class="vmd-text" id="cg-body">${skel(3)}</div>
          </div>
          <div class="vmd" id="cg-done" style="margin-top:10px;"><span class="vmd-badge">✓ ${L('Vollständiger Artikel inkl. Hero-Bild', 'Complete article incl. hero image')}</span></div>`,
        steps: [
          { t: 'class', s: '#cg-t1', x: 'vmd-chip-on', d: 700 },
          { t: 'show', s: '#cg-article', d: 700 },
          { t: 'type', s: '#cg-title', x: L('Wanderschuhe richtig pflegen: die komplette Anleitung', 'How to care for hiking boots: the complete guide'), d: 400 },
          { t: 'style', s: '#cg-hero', k: 'filter', x: 'none', d: 400 },
          { t: 'text', s: '#cg-body', x: L('Einleitung, 6 Abschnitte, FAQ — geschrieben aus dem echten Kontext Ihrer Seite, in Ihrer Markensprache.', "Introduction, 6 sections, FAQ — written from your page's real context, in your brand voice."), d: 900 },
          { t: 'show', s: '#cg-done', d: 600 },
        ],
      };
    }

    // ----- Feed Optimizer: rewrite descriptions ------------------------------
    case 'feed': {
      return {
        title: L('Virtual Marketer — Feed-Optimizer', 'Virtual Marketer — Feed Optimizer'),
        html: `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <span class="vmd-chip vmd-chip-on">${L('Kategorie: Schuhe', 'Category: shoes')}</span>
            <span class="vmd-chip vmd-chip-on">${L('Auf Lager', 'In stock')}</span>
            <span class="vmd-chip">${L('Marke: alle', 'Brand: all')}</span>
          </div>
          <div class="vmd-card">
            <div class="vmd-card-title">Runner Pro <span class="vmd-badge" id="fo-b1" style="visibility:hidden;">${L('neu geschrieben', 'rewritten')}</span></div>
            <div class="vmd-text"><span class="vmd-strike">${L('Schuh, rot, Gr. 42.', 'Shoe, red, size 42.')}</span><br/><span class="vmd-new" id="fo-new"></span></div>
          </div>
          <div class="vmd" id="fo-done" style="margin-top:10px;"><span class="vmd-badge">✓ 132 ${L('Beschreibungen verarbeitet — CSV bereit', 'descriptions processed — CSV ready')}</span></div>`,
        steps: [
          { t: 'type', s: '#fo-new', x: L('Der Runner Pro in kräftigem Rot: atmungsaktives Mesh, gedämpfte Sohle — Ihr Begleiter für Tempo und Alltag.', 'The Runner Pro in bold red: breathable mesh, cushioned sole — built for pace and everyday miles.'), d: 900 },
          { t: 'style', s: '#fo-b1', k: 'visibility', x: 'visible', d: 300 },
          { t: 'show', s: '#fo-done', d: 700 },
        ],
      };
    }

    // ----- Linkinator: words become links ------------------------------------
    case 'linkinator': {
      return {
        title: 'Virtual Marketer — Linkinator',
        html: `
          <p class="vmd-label">${L('Ihr Text', 'Your text')}</p>
          <div class="vmd-card"><div class="vmd-text">${L(
            'Unsere <span class="vmd-linkword" id="li-w1">Wanderschuhe</span> sind der ideale Begleiter. Mit der richtigen <span class="vmd-linkword" id="li-w2">Pflege</span> halten sie jahrelang — und zur passenden <span class="vmd-linkword" id="li-w3">Ausrüstung</span> beraten wir gern.',
            'Our <span class="vmd-linkword" id="li-w1">hiking boots</span> are the perfect companion. With the right <span class="vmd-linkword" id="li-w2">care</span> they last for years — and we are happy to advise on matching <span class="vmd-linkword" id="li-w3">gear</span>.'
          )}</div></div>
          <div class="vmd" id="li-map" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <span class="vmd-badge vmd-badge-blue">${L('Keyword-Karte aus Ihrer Sitemap', 'Keyword map from your sitemap')}</span>
            <span class="vmd-badge" id="li-count" style="visibility:hidden;">✓ 3 ${L('interne Links gesetzt', 'internal links added')}</span>
          </div>`,
        steps: [
          { t: 'show', s: '#li-map', d: 500 },
          { t: 'class', s: '#li-w1', x: 'vmd-linked', d: 700 },
          { t: 'class', s: '#li-w2', x: 'vmd-linked', d: 500 },
          { t: 'class', s: '#li-w3', x: 'vmd-linked', d: 500 },
          { t: 'style', s: '#li-count', k: 'visibility', x: 'visible', d: 500 },
        ],
      };
    }

    // ----- Agent viewer / chat insights --------------------------------------
    case 'agent': {
      return {
        title: L('Virtual Marketer — Chat-Insights', 'Virtual Marketer — Chat Insights'),
        html: `
          <div class="vmd-msg vmd-msg-user vmd vmd-on" style="max-width:100%;background:var(--vm-gray-100);color:var(--vm-gray-700);border:1px solid var(--vm-gray-200);">${L('„Habt ihr die Jacke auch in Größe XL und ist sie wasserdicht?“', '“Do you have the jacket in XL, and is it waterproof?”')}</div>
          <div class="vmd" id="av-senti" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <span class="vmd-senti vmd-senti-pos">😊 ${L('positiv', 'positive')}</span>
            <span class="vmd-chip">${L('Thema: Verfügbarkeit', 'Topic: availability')}</span>
            <span class="vmd-chip">${L('Thema: Produkteigenschaften', 'Topic: product features')}</span>
          </div>
          <div class="vmd vmd-card" id="av-insight" style="margin-top:12px;">
            <div class="vmd-card-title">${L('Erkenntnis', 'Insight')}</div>
            <div class="vmd-text" id="av-text"></div>
          </div>`,
        steps: [
          { t: 'show', s: '#av-senti', d: 700 },
          { t: 'show', s: '#av-insight', d: 700 },
          { t: 'type', s: '#av-text', x: L('17 Anfragen diese Woche zu Wasserdichtigkeit — die Produktseiten nennen sie nicht. Empfehlung: Attribut ergänzen.', "17 questions this week about waterproofing — your product pages don't mention it. Recommendation: add the attribute."), d: 300 },
        ],
      };
    }

    default:
      return null;
  }
}

module.exports = { DEMO_STYLE, DEMO_ENGINE_JS, buildDemo };
