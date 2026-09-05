#!/usr/bin/env node

/**
 * Adds the Track B enhancement layer (assets/enhance/enhance.css — design
 * tokens, scroll-driven reveals, micro-interactions, cross-document view
 * transitions, header glass) to every page.
 *
 * A standalone stylesheet injected at the end of the pipeline, NOT part of
 * the vm-*.css bundles, for the same reason the search widget is: it must
 * survive purge-unused-css (which cannot see that @view-transition or
 * animation-timeline rules are "used"), and it must apply uniformly across
 * all six header/page generators without touching any of them.
 *
 * Injected before </head> (it is pure CSS — no render-blocking JS), using
 * indexOf('</head>') per the pattern established in
 * enrich-structured-data.js. Runs after inject-search.js.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');
const MARKER = 'vm-enhance';
const TAG = `<link rel="stylesheet" href="/assets/enhance/enhance.css" id="${MARKER}">\n`;

function findHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, results);
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function main() {
  console.log('\n✨ Adding the enhancement layer (tokens, motion, view transitions)...\n');

  const src = path.join(__dirname, '../assets/enhance/enhance.css');
  const destDir = path.join(DIST, 'assets/enhance');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, 'enhance.css'));

  let added = 0;
  for (const file of findHtmlFiles(DIST)) {
    let html = fs.readFileSync(file, 'utf-8');
    if (html.includes(MARKER)) continue;
    const headClose = html.indexOf('</head>');
    if (headClose === -1) continue;
    html = html.slice(0, headClose) + TAG + html.slice(headClose);
    fs.writeFileSync(file, html);
    added++;
  }

  console.log(`✅ Enhancement layer added to ${added} page(s)\n`);
}

main();
