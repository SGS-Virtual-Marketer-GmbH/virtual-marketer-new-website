# WordPress to Static Site Migration Plan

## Phase 1: Analysis & Download ✅ (In Progress)

**Status:** Downloading full site with `wget --mirror`  
**Command:** `wget -q --mirror --convert-links --adjust-extension --page-requisites --no-parent https://virtual-marketer.de/`

**Content Inventory:**
- 13 main pages
- 48 blog posts  
- All WordPress assets (CSS, JS, images, fonts)
- Plugins resources (Elementor, WooCommerce, etc.)

**Location:** `/tmp_vm_scrape/virtual-marketer.de/`

---

## Phase 2: HTML Extraction & Cleanup

### 2.1 Extract Content
- [ ] Parse each `.html` file from wget mirror
- [ ] Remove WordPress-specific markup:
  - Admin bars
  - Nonces and security tokens
  - `wp-json` feeds
  - Plugin-specific classes
  - Gutenberg/Elementor editor markup
- [ ] Clean up excessive div nesting
- [ ] Remove WordPress query strings from URLs (`?ver=7.0.1`)

### 2.2 Fix Relative Links
- [ ] Convert absolute URLs to relative
- [ ] Update internal links for new structure
- [ ] Fix asset paths (CSS, JS, images)
- [ ] Remove `.html` extensions for clean URLs (optional)

### 2.3 Extract & Structure Content
```
Extract from HTML → Store in JSON:
  - Page title, slug, content
  - Meta description, keywords
  - Author, publish date
  - Featured image path
```

---

## Phase 3: CSS & JavaScript Optimization

### 3.1 CSS Consolidation
- [ ] Audit all loaded CSS files (~15+ currently)
  - `bootstrap.css` (1. Check if fully used or just reset)
  - `font-awesome.min.css`
  - `theme.css`, `woocommerce.css`, etc.
- [ ] Extract critical CSS (above-fold)
- [ ] Inline critical CSS in `<head>`
- [ ] Defer non-critical CSS
- [ ] Minify remaining CSS
- [ ] Remove unused styles via PurgeCSS

**Current Estimation:** 15+ CSS files → 1-2 optimized files

### 3.2 JavaScript Cleanup
- [ ] Identify essential JS:
  - Navigation/menu toggles
  - Form validations
  - Analytics (if keeping)
  - Chat widget (if keeping)
- [ ] Remove WordPress-only scripts:
  - jQuery (if not needed)
  - wp-json loaders
  - Admin-related scripts
- [ ] Minify kept JavaScript
- [ ] Convert to ES6 modules (optional)
- [ ] Lazy-load non-critical JS

**Current Estimation:** ~20 JS files → 2-3 optimized files

### 3.3 Remove Dynamic Features
- [ ] Comments system (replace with static or API-based)
- [ ] WooCommerce cart (if not needed)
- [ ] Search functionality (replace with JSON + JS search)
- [ ] Admin pages & login forms

---

## Phase 4: Asset Optimization

### 4.1 Image Optimization
- [ ] Inventory all images
- [ ] Convert to modern formats:
  - `.jpg` → `.webp` + `.jpg` fallback
  - `.png` → `.webp` + `.png` fallback
  - `.gif` → `.webp` or `.mp4`
- [ ] Resize to 2x max width (responsive)
- [ ] Compress aggressively
- [ ] Create responsive image sets (`srcset`)

**Tools:** `imagemin`, `sharp`, `ffmpeg`

### 4.2 Font Optimization
- [ ] Identify loaded fonts
- [ ] Subsetting to used characters only
- [ ] Convert to `.woff2` (modern browsers)
- [ ] Self-host instead of external CDN
- [ ] Use `font-display: swap` for loading UX

### 4.3 Other Assets
- [ ] Videos: Compress or host externally
- [ ] SVG files: Inline or minify
- [ ] Icons: Convert to font or sprite sheet

---

## Phase 5: Static Site Generation

### 5.1 Choose Architecture

**Option A: HTML + Static Assets (Simplest)**
```
dist/
├── index.html
├── blog/
│   ├── post-1/index.html
│   ├── post-2/index.html
│   └── ...
├── css/
├── js/
└── assets/
```
**Pros:** Simplest, works everywhere  
**Cons:** Harder to maintain; copy-paste templates

**Option B: Template-Based (Recommended)**
```
src/
├── _templates/
│   ├── page.html
│   ├── blog-post.html
│   └── layout.html
├── content/
│   ├── pages/*.json
│   └── blog/*.md
```
Build script generates static HTML from templates + content.

**Option C: Static Site Generator (11ty, Hugo, etc.)**
- [ ] Import content as JSON/YAML
- [ ] Use templating engine
- [ ] Automatic pagination, archives
- [ ] Hot reload development

**Recommendation:** Option B with Node.js build script (lightweight, full control)

### 5.2 Build System
Create `scripts/build.js`:
```javascript
// Pseudo-code structure
1. Read all source files
2. Extract content from JSON/HTML
3. Render through templates
4. Optimize assets
5. Generate dist/
6. Output report
```

---

## Phase 6: Testing & QA

### 6.1 Functionality Tests
- [ ] All pages load
- [ ] All links work (internal + external)
- [ ] Forms submit (if keeping)
- [ ] Images load
- [ ] CSS/JS loads without errors

### 6.2 Performance Tests
- [ ] Lighthouse audit (95+ target)
- [ ] PageSpeed Insights
- [ ] WebPageTest
- [ ] Core Web Vitals check

### 6.3 SEO Tests
- [ ] Meta tags present
- [ ] Open Graph tags
- [ ] Structured data (schema.org)
- [ ] Sitemap.xml generated
- [ ] robots.txt correct

### 6.4 Browser Compatibility
- [ ] Modern browsers (Chrome, Firefox, Safari, Edge)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)
- [ ] IE11 (if needed; otherwise document as unsupported)

---

## Phase 7: Deployment

### 7.1 Hosting Options

| Option | Cost | Features | Recommended For |
|--------|------|----------|-----------------|
| **GitHub Pages** | Free | Git-based, SSL, CDN | Open source, blogs |
| **Netlify** | Free tier | CI/CD, forms, functions | Seamless deployment |
| **Vercel** | Free tier | Edge functions, analytics | Performance-focused |
| **Cloudflare Pages** | Free | Ultra-fast CDN | Maximum performance |
| **Self-hosted** | $5-20/mo | Full control | Existing infrastructure |

**Recommendation:** Cloudflare Pages + GitHub (free, fast, secure)

### 7.2 DNS & SSL
- [ ] Update DNS to point to hosting
- [ ] Verify SSL/TLS certificate
- [ ] Set up redirects from old domain
- [ ] 301 redirects from `/old-page` → `/new-page`

### 7.3 Monitoring
- [ ] Set up uptime monitoring
- [ ] Track performance metrics
- [ ] Monitor error rates
- [ ] Log 404s for broken links

---

## Phase 8: Post-Launch

### 8.1 Search Engine Resubmission
- [ ] Submit new sitemap to Google Search Console
- [ ] Submit to Bing Webmaster Tools
- [ ] Check crawl status
- [ ] Monitor index status

### 8.2 Redirect Old WordPress URLs
- [ ] Create 301 redirects for:
  - `/blog/` → `/articles/`  (if renaming)
  - `?p=123` → `/slug/`
  - Trailing slashes (if removing)

### 8.3 Analytics Migration
- [ ] Add Google Analytics 4 tag
- [ ] Track 404s, redirects
- [ ] Monitor organic search traffic
- [ ] Set up conversion tracking

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Content loss | Keep WordPress site live during transition; 2-week parallel run |
| Broken links | Automated link checking; 301 redirects; monitoring |
| Search traffic drop | Proper redirects; fast-track Google reindexing |
| User disruption | Announce maintenance; email notifications |
| Asset issues | Comprehensive backup; version control for all assets |

---

## Success Criteria

- ✅ All pages accessible and content intact
- ✅ Lighthouse score ≥ 95
- ✅ Load time < 2 seconds (first paint)
- ✅ No console errors
- ✅ All external links working
- ✅ SEO metadata preserved
- ✅ 301 redirects in place
- ✅ Zero search traffic impact after 30 days

---

**Timeline Estimate:** 2-4 weeks depending on optimization depth  
**Effort:** ~80-120 hours (one person)

