#!/usr/bin/env node

/**
 * Build Script - Convert WordPress site to optimized static HTML
 *
 * Steps:
 * 1. Copy HTML files (cleaned)
 * 2. Copy CSS files (consolidated & minified)
 * 3. Copy images and assets
 * 4. Remove WordPress-specific resources
 * 5. Generate index/sitemap
 */

const fs = require('fs');
const path = require('path');
const fse = require('fs').promises;

const SOURCE = '/home/fabian-stamminger/tmp_vm_scrape/virtual-marketer.de';
const DIST = path.join(__dirname, '../dist');

console.log('\n🔨 Building Static Site\n');

async function build() {
  try {
    // Clean dist directory
    if (fs.existsSync(DIST)) {
      fs.rmSync(DIST, { recursive: true });
    }
    fs.mkdirSync(DIST, { recursive: true });

    // Copy HTML pages (cleaned)
    console.log('📄 Processing HTML pages...');
    const htmlFiles = findFiles(SOURCE, /\.html$/);
    const validPages = htmlFiles.filter(f =>
      !f.includes('wp-json') &&
      !f.includes('wp-admin') && // AJAX-endpoint captures from the scrape, not real admin pages
      !f.includes('xmlrpc') &&
      !f.includes('feed/') &&
      !f.includes('comments/feed') &&
      // WordPress's "shortlink" format (/?p=NNNN) redirects to a page/post's
      // real canonical URL, but wget's mirror captured 53 of these as their
      // own files instead of following through. They're duplicate copies of
      // content that already exists at a clean URL elsewhere in the scrape
      // (e.g. index.html?p=60.html duplicates /impressum/), never linked
      // from real navigation, not in sitemap.xml — and at least one
      // (?p=58103) is outright malformed, with two different pages' <head>
      // content merged into a single file. Excluding by filename pattern
      // rather than fixing content, since there's nothing to fix: the
      // canonical version already exists and is copied separately.
      !/index\.html\?p=\d+\.html$/.test(f) &&
      // wget captured both /virtual-marketer-demo (no trailing slash) and
      // /virtual-marketer-demo/ (trailing slash) as separate near-identical
      // files. Keep only the directory form (.../virtual-marketer-demo/index.html)
      // to match the URL structure every other page on the site uses.
      f !== path.join(SOURCE, 'virtual-marketer-demo.html')
    );

    let pagesCount = 0;
    for (const htmlFile of validPages) {
      const relativePath = htmlFile.replace(SOURCE, '');
      const destPath = path.join(DIST, relativePath);
      const destDir = path.dirname(destPath);

      // Create destination directory
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Read and clean HTML
      let content = fs.readFileSync(htmlFile, 'utf-8');
      content = cleanHTML(content);

      fs.writeFileSync(destPath, content);
      pagesCount++;
    }
    console.log(`  ✓ Processed ${pagesCount} pages`);

    // Copy CSS
    console.log('🎨 Processing CSS...');
    const cssFiles = findFiles(SOURCE, /\.css$/);
    const cssDir = path.join(DIST, 'wp-content');
    fs.mkdirSync(cssDir, { recursive: true });

    for (const cssFile of cssFiles) {
      const relativePath = cssFile.replace(SOURCE, '');
      const destPath = path.join(DIST, relativePath);
      const destCssDir = path.dirname(destPath);

      if (!fs.existsSync(destCssDir)) {
        fs.mkdirSync(destCssDir, { recursive: true });
      }

      let content = fs.readFileSync(cssFile, 'utf-8');
      // Basic CSS minification (remove comments and extra whitespace)
      content = minifyCSS(content);
      fs.writeFileSync(destPath, content);
    }
    console.log(`  ✓ Processed ${cssFiles.length} CSS files`);

    // Copy JavaScript
    // Note: these files don't end in a literal ".js" — wget preserved the
    // WordPress version query string as part of the filename without
    // re-appending an extension (unlike CSS, where --adjust-extension
    // appended a trailing ".css" after the query string). So a plain
    // /\.js$/ pattern matches zero files; this was a real bug that meant
    // build.js silently never copied ANY JavaScript, breaking every bit of
    // site interactivity (mobile menu, sliders, WooCommerce, popups, form
    // validation) despite dozens of <script src="..."> tags referencing
    // these files in the HTML.
    console.log('📜 Processing JavaScript...');
    const jsFiles = findFiles(SOURCE, /\.js(\?|$)/i);

    for (const jsFile of jsFiles) {
      const relativePath = jsFile.replace(SOURCE, '');
      const destPath = path.join(DIST, relativePath);
      const destJsDir = path.dirname(destPath);

      if (!fs.existsSync(destJsDir)) {
        fs.mkdirSync(destJsDir, { recursive: true });
      }

      fs.copyFileSync(jsFile, destPath);
    }
    console.log(`  ✓ Processed ${jsFiles.length} JavaScript files`);

    // Copy images and assets
    // Note: same class of bug as the JavaScript fix above — wget kept the
    // WordPress cache-busting query string as part of the on-disk filename
    // for these too (e.g. "nunito-sans--v12-normal-400.woff2?c=1682535240"),
    // so a plain end-anchored /\.woff2$/ pattern matches zero of them. This
    // silently dropped every font file (and any other asset with a query
    // string on disk) from the dist/ copy, producing 404s for @font-face
    // src: url(...) references even though the CSS itself (and server.js's
    // %3F-decoding logic) already handle this filename convention correctly
    // — the files just never made it into dist/ in the first place.
    console.log('🖼️  Processing images and assets...');
    // avif belongs here even though the original list omitted it: the three
    // management-team portraits (/wp-content/uploads/2025/06/*.avif) are the
    // only AVIF files in the scrape, and leaving the extension out meant
    // /management/ shipped with three broken portraits — the images were
    // sitting in SOURCE the whole time, they just never got copied.
    const assetExtensions = /\.(jpg|jpeg|png|gif|webp|avif|svg|woff|woff2|ttf|eot)(\?|$)/i;
    const assetFiles = findFiles(SOURCE, assetExtensions);

    for (const assetFile of assetFiles) {
      const relativePath = assetFile.replace(SOURCE, '');
      const destPath = path.join(DIST, relativePath);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(assetFile, destPath);
    }
    console.log(`  ✓ Processed ${assetFiles.length} assets`);

    // Create robots.txt
    console.log('🤖 Creating robots.txt...');
    const robotsTxt = `User-agent: *
Allow: /
Sitemap: https://virtual-marketer.de/sitemap.xml

User-agent: *
Disallow: /wp-admin/
Disallow: /wp-login.php
Disallow: /wp-includes/
`;
    fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt);

    // Create .htaccess for Apache servers
    console.log('⚙️  Creating .htaccess...');
    const htaccess = `# Virtual Marketer Static Site
# Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html
  AddOutputFilterByType DEFLATE text/plain
  AddOutputFilterByType DEFLATE text/xml
  AddOutputFilterByType DEFLATE text/css
  AddOutputFilterByType DEFLATE text/javascript
  AddOutputFilterByType DEFLATE application/javascript
  AddOutputFilterByType DEFLATE application/json
</IfModule>

# Caching
<IfModule mod_headers.c>
  <FilesMatch "\\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$">
    Header set Cache-Control "max-age=31536000, public"
  </FilesMatch>
  <FilesMatch "\\.(html)$">
    Header set Cache-Control "max-age=3600, public"
  </FilesMatch>
</IfModule>

# Rewrite rules for clean URLs
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # If it's not a file or directory
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Try to serve index.html for directories
  RewriteRule ^(.*)$ index.html [L]
</IfModule>

# Security
<FilesMatch "\\.(php|phtml|pht|phps|php3|php4|php5|php6|php7|phps|shtml|phar)$">
  Deny from all
</FilesMatch>

# HTTPS redirect (uncomment if needed)
# <IfModule mod_ssl.c>
#   RewriteEngine On
#   RewriteCond %{HTTPS} off
#   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
# </IfModule>
`;
    fs.writeFileSync(path.join(DIST, '.htaccess'), htaccess);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Build Complete!\n');
    console.log('Output directory: ' + DIST);
    console.log('\nBuild Summary:');
    console.log(`  Pages:  ${pagesCount}`);
    console.log(`  CSS:    ${cssFiles.length}`);
    console.log(`  Assets: ${assetFiles.length}`);

    const distSize = getDirectorySize(DIST);
    console.log(`  Size:   ${(distSize / 1024 / 1024).toFixed(2)} MB\n`);

    console.log('Next steps:');
    console.log('  1. npm run optimize  - Compress images');
    console.log('  2. npm run test      - Verify pages');
    console.log('  3. Deploy to hosting\n');

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

/**
 * Find all files matching a pattern
 */
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

/**
 * Clean WordPress markup from HTML
 */
function cleanHTML(html) {
  // Remove WordPress admin bar
  html = html.replace(/<div[^>]*id=["\']wpadminbar["\'][^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove WordPress nonces and security tokens
  html = html.replace(/<input[^>]*type=["\']hidden["\'][^>]*name=["\']_wpnonce["\'][^>]*>/gi, '');
  html = html.replace(/<input[^>]*type=["\']hidden["\'][^>]*name=["\']_wp_[^"\']*["\'][^>]*>/gi, '');

  // Remove WordPress version query strings (?ver=7.0.1)
  html = html.replace(/(["\'])([^"\']*)\?ver=[^"\']+(["\'])/g, '$1$2$3');

  // Remove wp-json feeds from header
  html = html.replace(/<link[^>]*rel=["\']alternate["\'][^>]*application\/json[^>]*>/gi, '');

  // Remove EditURI links (xmlrpc)
  html = html.replace(/<link[^>]*rel=["\']EditURI["\'][^>]*>/gi, '');

  // Remove wlwmanifest
  html = html.replace(/<link[^>]*rel=["\']wlwmanifest["\'][^>]*>/gi, '');

  // Remove WordPress emoji
  html = html.replace(/<script[^>]*src=["\'][^"\']*wp-emoji[^"\']*["\'][^>]*>[\s\S]*?<\/script>/gi, '');

  // Clean up excessive whitespace
  html = html.replace(/\n\s*\n/g, '\n');

  return html;
}

/**
 * Basic CSS minification
 */
function minifyCSS(css) {
  // Remove comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove unnecessary whitespace
  css = css.replace(/\s+/g, ' ');
  css = css.replace(/\s*([{}:;,])\s*/g, '$1');

  // Remove last semicolon in rule
  css = css.replace(/;}/g, '}');

  return css.trim();
}

/**
 * Get directory size
 */
function getDirectorySize(dir) {
  let size = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }

  return size;
}

// Run build
build();
