#!/usr/bin/env node

/**
 * Site Analysis Script
 * Analyzes the downloaded WordPress site structure, assets, and content
 * Generates a report for optimization planning
 */

const fs = require('fs');
const path = require('path');

const SITE_PATH = '/home/fabian-stamminger/tmp_vm_scrape/virtual-marketer.de';

// Simple glob without external dependency
function globSync(pattern, opts) {
  const results = [];
  const { nodir = false } = opts || {};

  function walk(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (!nodir || stat.isFile()) {
        results.push(fullPath);
      }
    });
  }

  walk(SITE_PATH);
  return results;
}

console.log('\n🔍 Virtual Marketer - Site Analysis Report\n');
console.log('='.repeat(60));

// File inventory
const allFiles = globSync(`${SITE_PATH}/**/*`, { nodir: true });
const htmlFiles = allFiles.filter(f => f.endsWith('.html'));
const cssFiles = allFiles.filter(f => f.endsWith('.css'));
const jsFiles = allFiles.filter(f => f.endsWith('.js'));
const imageFiles = allFiles.filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f));

console.log('\n📊 FILE INVENTORY');
console.log('-'.repeat(60));
console.log(`Total files:        ${allFiles.length}`);
console.log(`HTML pages:         ${htmlFiles.length}`);
console.log(`CSS files:          ${cssFiles.length}`);
console.log(`JavaScript files:   ${jsFiles.length}`);
console.log(`Image files:        ${imageFiles.length}`);

// Size analysis
const totalSize = allFiles.reduce((sum, f) => sum + (fs.statSync(f).size || 0), 0);
const htmlSize = htmlFiles.reduce((sum, f) => sum + (fs.statSync(f).size || 0), 0);
const cssSize = cssFiles.reduce((sum, f) => sum + (fs.statSync(f).size || 0), 0);
const jsSize = jsFiles.reduce((sum, f) => sum + (fs.statSync(f).size || 0), 0);
const imageSize = imageFiles.reduce((sum, f) => sum + (fs.statSync(f).size || 0), 0);

console.log('\n💾 SIZE ANALYSIS');
console.log('-'.repeat(60));
console.log(`Total size:         ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`HTML:               ${(htmlSize / 1024).toFixed(2)} KB (${((htmlSize / totalSize) * 100).toFixed(1)}%)`);
console.log(`CSS:                ${(cssSize / 1024).toFixed(2)} KB (${((cssSize / totalSize) * 100).toFixed(1)}%)`);
console.log(`JavaScript:         ${(jsSize / 1024).toFixed(2)} KB (${((jsSize / totalSize) * 100).toFixed(1)}%)`);
console.log(`Images:             ${(imageSize / 1024 / 1024).toFixed(2)} MB (${((imageSize / totalSize) * 100).toFixed(1)}%)`);

// Top files by size
console.log('\n🔝 LARGEST FILES');
console.log('-'.repeat(60));
const filesSorted = allFiles
  .map(f => ({ file: f.replace(SITE_PATH, ''), size: fs.statSync(f).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 15);

filesSorted.forEach(f => {
  const size = f.size > 1024 * 1024
    ? `${(f.size / 1024 / 1024).toFixed(2)} MB`
    : `${(f.size / 1024).toFixed(2)} KB`;
  console.log(`${size.padStart(12)} - ${f.file}`);
});

// CSS files
console.log('\n🎨 CSS FILES DETECTED');
console.log('-'.repeat(60));
cssFiles.slice(0, 20).forEach(f => {
  const size = fs.statSync(f).size;
  const shortPath = f.replace(SITE_PATH, '').replace(/^\//, '');
  console.log(`${(size / 1024).toFixed(1)}KB - ${shortPath}`);
});
if (cssFiles.length > 20) {
  console.log(`... and ${cssFiles.length - 20} more CSS files`);
}

// Pages analysis
console.log('\n📄 PAGES');
console.log('-'.repeat(60));
const pageFiles = htmlFiles.filter(f =>
  f.includes('index.html') || (f.endsWith('.html') && !f.includes('wp-json'))
);
pageFiles.forEach(f => {
  const url = f
    .replace(SITE_PATH, '')
    .replace(/\/index.html$/, '/')
    .replace(/\.html$/, '/');
  const size = fs.statSync(f).size;
  console.log(`${(size / 1024).toFixed(1)}KB - ${url}`);
});

// WordPress resources detected
console.log('\n⚠️  WORDPRESS-SPECIFIC RESOURCES (To Remove)');
console.log('-'.repeat(60));

const wpResources = allFiles.filter(f =>
  f.includes('wp-admin') ||
  f.includes('wp-login') ||
  f.includes('wp-json') ||
  f.includes('xmlrpc')
);

if (wpResources.length > 0) {
  console.log(`Found ${wpResources.length} WordPress admin/API resources to remove`);
  wpResources.slice(0, 10).forEach(f => {
    console.log(`  - ${f.replace(SITE_PATH, '').substring(0, 70)}`);
  });
  if (wpResources.length > 10) {
    console.log(`  ... and ${wpResources.length - 10} more`);
  }
} else {
  console.log('No WordPress admin resources found');
}

// Generate report
console.log('\n\n📋 OPTIMIZATION RECOMMENDATIONS');
console.log('-'.repeat(60));

const recommendations = [];

if (cssSize > 500 * 1024) {
  recommendations.push(`✓ CSS (${(cssSize / 1024).toFixed(0)}KB) - Consolidate and minify`);
}

if (jsSize > 1024 * 1024) {
  recommendations.push(`✓ JavaScript (${(jsSize / 1024).toFixed(0)}KB) - Large bundle, analyze dependencies`);
}

if (imageSize > 2 * 1024 * 1024) {
  recommendations.push(`✓ Images (${(imageSize / 1024 / 1024).toFixed(1)}MB) - Convert to WebP, resize, compress`);
}

if (wpResources.length > 0) {
  recommendations.push(`✓ Remove ${wpResources.length} WordPress-specific resources`);
}

if (recommendations.length === 0) {
  console.log('✓ Site is relatively optimized! Focus on:');
  console.log('  - Image optimization (biggest gain)');
  console.log('  - CSS/JS minification');
}

recommendations.forEach(r => console.log(r));

console.log('\n' + '='.repeat(60) + '\n');
console.log('Next steps:');
console.log('  1. npm run build  - Generate static site');
console.log('  2. npm run optimize - Compress assets');
console.log('  3. npm run test   - Verify all pages');
console.log('\n');
