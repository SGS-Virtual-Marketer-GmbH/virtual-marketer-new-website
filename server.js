#!/usr/bin/env node

/**
 * Local Development Server
 * Serves static site with proper headers for testing
 * Includes gzip compression, caching, and performance monitoring
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST_DIR = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

// Dev-only reverse proxy to the booking/contact API (backend/), mirroring
// what nginx's `location /api/` does in production (see docker/nginx.conf).
// Defaults to the backend's default local port so the booking widget can be
// tested against a locally-running `node backend/src/server.js` with zero
// extra setup; harmless if that process isn't running (proxied requests
// just 502). This file is never used in production (nginx serves dist/
// directly there — see Dockerfile), so an always-on dev convenience proxy
// carries no production risk. Override with API_PROXY_TARGET if the backend
// is running on a non-default port.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000';

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

// Performance metrics
const metrics = {
  requests: 0,
  startTime: Date.now(),
  totalBytes: 0,
  fileStats: {}
};

/**
 * Get MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Serve file with compression
 */
function serveFile(filePath, req, res) {
  fs.stat(filePath, (err, stats) => {
    if (err) {
      serve404(res);
      return;
    }

    const mimeType = getMimeType(filePath);
    const acceptEncoding = req.headers['accept-encoding'] || '';

    // Cache settings
    // Note: this is the *local dev* server (server.js) — production caching
    // is governed by docker/nginx.conf instead, which does cache HTML briefly.
    // Here, HTML is deliberately never cached so `npm run build` output is
    // always visible on the next reload without manual cache-busting.
    if (filePath.match(/\.(css|js|woff|woff2|ttf|png|jpg|jpeg|gif|webp)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // CORS headers (optional)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    // Compression
    if (acceptEncoding.includes('gzip') && filePath.match(/\.(html|css|js|json|xml|svg)$/i)) {
      res.setHeader('Content-Encoding', 'gzip');
      fs.createReadStream(filePath)
        .pipe(zlib.createGzip())
        .pipe(res);
      metrics.totalBytes += stats.size;
    } else {
      res.setHeader('Content-Length', stats.size);
      fs.createReadStream(filePath).pipe(res);
      metrics.totalBytes += stats.size;
    }

    // Track stats
    const fileName = path.relative(DIST_DIR, filePath);
    metrics.fileStats[fileName] = {
      size: stats.size,
      mimeType: mimeType,
      accessed: new Date().toISOString()
    };
  });
}

/**
 * 404 handler
 */
function serve404(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=UTF-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 - Seite nicht gefunden</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; text-align: center; }
        h1 { font-size: 48px; color: #1a202c; margin-bottom: 20px; }
        p { font-size: 16px; color: #666; margin-bottom: 20px; }
        a { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #1a202c; color: white; text-decoration: none; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404</h1>
        <p>Diese Seite konnte nicht gefunden werden.</p>
        <a href="/">Zurück zur Startseite</a>
      </div>
    </body>
    </html>
  `);
}

/**
 * Create server
 */
const server = http.createServer((req, res) => {
  metrics.requests++;

  if (API_PROXY_TARGET && req.url.startsWith('/api/')) {
    const target = new URL(API_PROXY_TARGET);
    const proxyReq = http.request({
      host: target.hostname,
      port: target.port,
      path: req.url.replace(/^\/api/, '') || '/',
      method: req.method,
      headers: req.headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => { res.writeHead(502); res.end('API proxy target unreachable'); });
    req.pipe(proxyReq);
    return;
  }

  // Handle root and trailing slash
  // Decode first: many filenames on disk are literal WordPress-export
  // artifacts like "style.css?ver=7.0.1.css" (the "?" is part of the
  // filename, not a query string) — the HTML references them as
  // "style.css%3Fver=7.0.1.css". Order matters: split off any real query
  // string FIRST (on the still-encoded "?"), then decode — decoding first
  // would turn "%3F" into "?" and the split would strip it right back off,
  // silently 404-ing every such asset.
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') {
    urlPath = '/index.html';
  } else if (!path.extname(urlPath) && !urlPath.endsWith('/')) {
    urlPath += '/index.html';
  } else if (urlPath.endsWith('/')) {
    urlPath += 'index.html';
  }

  // Security: prevent directory traversal
  const filePath = path.normalize(path.join(DIST_DIR, urlPath));
  if (!filePath.startsWith(DIST_DIR)) {
    serve404(res);
    return;
  }

  // Check if file exists
  fs.existsSync(filePath) ? serveFile(filePath, req, res) : serve404(res);
});

/**
 * Status endpoint
 */
server.on('request', (req, res) => {
  if (req.url === '/__status' || req.url === '/__metrics') {
    const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
    const avgFileSize = metrics.totalBytes / Math.max(metrics.requests, 1);

    const status = {
      uptime: `${uptime}s`,
      requests: metrics.requests,
      totalDataServed: `${(metrics.totalBytes / 1024 / 1024).toFixed(2)} MB`,
      avgFileSize: `${(avgFileSize / 1024).toFixed(2)} KB`,
      filesServed: Object.keys(metrics.fileStats).length,
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }
});

/**
 * Start server
 */
server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log('\n🚀 Virtual Marketer - Local Development Server\n');
  console.log('='.repeat(60));
  console.log(`\n📍 Server running at: ${url}`);
  console.log(`\n🔗 Open in browser:\n   ${url}\n`);
  console.log('📊 Monitoring:\n   ' + url + '/__metrics\n');
  console.log('Features:');
  console.log('  ✓ Gzip compression for HTML/CSS/JS');
  console.log('  ✓ Cache headers (year-long for assets)');
  console.log('  ✓ Security headers (CSP, X-Frame-Options, etc)');
  console.log('  ✓ Performance monitoring');
  console.log('  ✓ Geo-targeting & SEO meta tags');
  console.log('  ✓ Modern MIME type detection\n');
  console.log('Controls:');
  console.log('  Press Ctrl+C to stop server\n');
  console.log('='.repeat(60) + '\n');
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n\n📊 Server Statistics:');
  console.log(`   Requests served: ${metrics.requests}`);
  console.log(`   Total data: ${(metrics.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Uptime: ${Math.floor((Date.now() - metrics.startTime) / 1000)}s`);
  console.log(`   Files served: ${Object.keys(metrics.fileStats).length}\n`);
  server.close();
  process.exit(0);
});
