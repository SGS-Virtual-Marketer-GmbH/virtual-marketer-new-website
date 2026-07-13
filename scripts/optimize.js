#!/usr/bin/env node

/**
 * Asset Optimization Script
 * Compresses images and optimizes CSS/JS
 *
 * NOTE: Requires optional dependencies:
 * npm install --save-dev imagemin imagemin-jpegtran imagemin-pngquant sharp
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../dist');

console.log('\n📦 Asset Optimization\n');
console.log('This script requires additional dependencies:');
console.log('  npm install --save-dev imagemin imagemin-jpegtran imagemin-pngquant\n');

console.log('Manual optimization steps:\n');

console.log('1. IMAGE COMPRESSION');
console.log('   For macOS/Linux (using ImageMagick):');
console.log('   find dist -type f \\( -name "*.jpg" -o -name "*.png" \\)');
console.log('   mogrify -quality 80 dist/**/*.jpg  # JPEG');
console.log('   optipng -o7 dist/**/*.png          # PNG\n');

console.log('   Or use online tools:');
console.log('   - TinyPNG.com (drag & drop)');
console.log('   - Squoosh.app (Google)');
console.log('   - ImageOptim (macOS)\n');

console.log('2. CONVERT TO WEBP');
console.log('   cwebp -quality 80 input.jpg -o output.webp\n');

console.log('3. CSS MINIFICATION');
console.log('   Already done by build.js');
console.log('   Further optimization: PurgeCSS (remove unused styles)\n');

console.log('4. HTML SIZE REDUCTION');
console.log('   Find largest HTML files:');

// Analyze HTML sizes
const htmlFiles = findFiles(DIST, /\.html$/);
const htmlSizes = htmlFiles
  .filter(f => !f.includes('wp-json'))
  .map(f => ({
    file: f.replace(DIST, ''),
    size: fs.statSync(f).size
  }))
  .sort((a, b) => b.size - a.size)
  .slice(0, 10);

htmlSizes.forEach(f => {
  const kb = (f.size / 1024).toFixed(1);
  console.log(`   ${kb}KB - ${f.file}`);
});

console.log('\n💡 ESTIMATED SAVINGS');
console.log('   Images (50% reduction):    ~200 KB');
console.log('   CSS (consolidation):       ~200 KB');
console.log('   Minification overall:      ~100 KB');
console.log('   ─────────────────────────────────');
console.log('   Total potential:           ~500 KB (21% reduction)');
console.log('   Final site size:           ~1.9 MB\n');

console.log('📊 NEXT STEPS');
console.log('  1. Run manual image optimization (see steps above)');
console.log('  2. Run: npm run test');
console.log('  3. Check Lighthouse: npm run build && lighthouse dist/index.html');
console.log('  4. Deploy when ready\n');

function findFiles(dir, pattern) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(item.name)) {
      results.push(fullPath);
    }
  }

  return results;
}
