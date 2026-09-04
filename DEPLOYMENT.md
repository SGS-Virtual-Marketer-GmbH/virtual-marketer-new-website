# Deployment & GitHub Setup Guide

**Status:** Ready for GitHub push  
**Version:** 1.0  
**Date:** 2026-07-13

---

## 🚀 Quick Start: Push to GitHub

### Option 1: Create Repo via GitHub UI (Easiest)

1. **Go to GitHub:** https://github.com/new
2. **Create Repository:**
   - Name: `virtual-marketer-new-website` (or similar)
   - Description: "High-performance static HTML version of virtual-marketer.de - Rebuilt from WordPress"
   - Visibility: **Public** (recommended for transparency)
   - Initialize: **No** (we have existing git repo)
   - Click "Create repository"

3. **Copy the repository URL** (HTTPS or SSH)

4. **Add remote and push:**
```bash
cd "virtual-marketer.de Website"
git remote add origin https://github.com/YOUR_USERNAME/virtual-marketer-new-website.git
git branch -M main
git push -u origin main
```

### Option 2: Create via GitHub CLI

```bash
# Requires: GitHub CLI (gh) installed
gh repo create virtual-marketer-new-website \
  --public \
  --source=. \
  --remote=origin \
  --push
```

### Option 3: Use GitHub Token

```bash
# With GITHUB_TOKEN environment variable set
git remote add origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/virtual-marketer-new-website.git
git push -u origin main
```

---

## 📋 Repository Structure for GitHub

```
virtual-marketer-new-website/
├── README.md                 # Project overview
├── MIGRATION.md              # Migration details (8 phases)
├── SEO_GEO_GUIDE.md         # SEO & Geo optimization guide
├── DEPLOYMENT.md            # This file
├── STATUS.md                # Current project status
├── .gitignore               # Git ignore rules
├── .claude/
│   └── launch.json          # Local dev server config
├── package.json             # Build dependencies
├── server.js                # Local dev server
├── dist/                    # Built static site (2.9 MB)
│   ├── index.html
│   ├── blog/
│   ├── ki-loesungen/
│   ├── wp-content/          # CSS, fonts, images
│   ├── robots.txt           # Search engine rules
│   ├── sitemap.xml          # URL index for search
│   ├── sitemap_index.xml
│   └── .htaccess            # Apache server config
└── scripts/
    ├── analyze.js           # Site analysis tool
    ├── build.js             # Build system
    ├── seo-optimize.js      # SEO metadata injector
    ├── optimize.js          # Asset optimization guide
    └── dev.js               # Local development (todo)
```

---

## 🌐 Hosting Options & Recommendations

### Option A: Cloudflare Pages (⭐ Recommended)

**Why:** Free tier, incredibly fast, Germany CDN, automatic HTTPS

**Setup (5 minutes):**
1. Go to https://pages.cloudflare.com
2. Connect your GitHub account
3. Select `virtual-marketer-new-website` repo
4. Build command: (leave blank - static files)
5. Build output directory: `dist`
6. Deploy!

**Custom Domain:**
1. In Cloudflare Pages: Custom domain
2. Point your DNS to Cloudflare nameservers
3. Auto HTTPS with Cloudflare's certificate

**Advantages:**
- Free tier (unlimited builds/deploys)
- Global CDN (Germany edge servers)
- Automatic optimization
- Geo-routing capabilities
- DDoS protection included

### Option B: Netlify

**Why:** Excellent developer experience, form handling, analytics

**Setup (5 minutes):**
1. Go to https://netlify.com
2. "Connect to Git" → Select repo
3. Build command: (leave blank)
4. Publish directory: `dist`
5. Deploy!

**Advantages:**
- Free tier
- Automatic deployments on git push
- Built-in analytics
- Form handling (for contact forms)
- Easy rollbacks

**Custom Domain:**
- Domain: Transfer or point DNS
- SSL: Automatic via Let's Encrypt

### Option C: GitHub Pages

**Why:** Free, integrated with GitHub, simple setup

**Setup (3 steps):**
```bash
# Add to package.json:
"deploy": "npm run build && git add dist && git commit -m 'Build' && git push"

# Or use gh-pages package
npm install --save-dev gh-pages
# Add to package.json scripts:
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

**Disadvantages:**
- Slower than Cloudflare/Netlify
- Limited customization
- No custom build pipeline

### Option D: Self-Hosted (1blu)

**Why:** Use existing Virtual Marketer hosting

**Your Current Setup:**
- Host: 1blu.de (webhosting34.1blu.de)
- Access: FTP (u321783-1) or SFTP
- Space: `/www` directory

**Deploy via SFTP:**
```bash
# Using sftp command or FileZilla
sftp u321726-2756001@webhosting34.1blu.de
# Navigate to /www
# Upload contents of dist/
```

**Advantages:**
- Use existing hosting
- Full control
- Keep domain on 1blu
- Familiar infrastructure

**Disadvantages:**
- No automatic builds
- Need to manually upload files
- Less performance optimization
- Managing own HTTPS

---

## 📦 Deployment Workflow (Automated)

### With Cloudflare Pages (Recommended)

**Automatic Deployment:**
1. Push to GitHub: `git push origin main`
2. Cloudflare Pages detects change
3. Triggers build (if configured)
4. Deploys to CDN automatically

**Build Configuration (if needed):**
Create `wrangler.toml` in repo root:
```toml
[env.production]
vars = { ENVIRONMENT = "production" }

[[routes]]
pattern = "example.com/*"
zone_name = "example.com"
```

### With Netlify

**Automatic Deployment:**
1. Push to GitHub
2. Netlify GitHub app detects change
3. Runs build command
4. Deploys to CDN
5. Gets automatic status checks on PR

**Configuration File (`netlify.toml`):**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/blog/*"
  to = "/blog/index.html"
  status = 200

[[headers]]
  for = "/dist/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

## 🔄 CI/CD Pipeline (GitHub Actions)

### Automatic Testing & Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Static Site

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build static site
        run: npm run build
      
      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          uploadArtifacts: true
          temporaryPublicStorage: true
      
      - name: Deploy to Cloudflare Pages
        if: github.ref == 'refs/heads/main'
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: virtual-marketer-new-website
          directory: dist

      - name: Comment PR with scores
        uses: actions/github-script@v6
        with:
          script: |
            const result = require('./dist/lighthouse.json');
            const score = Math.round(result[0].summary.performance * 100);
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🎯 Lighthouse Score: ${score}`
            });
```

**Features:**
- Automatic build on every push
- Lighthouse performance testing
- Automated deployment to Cloudflare Pages
- PR status checks

---

## ✅ Pre-Deployment Checklist

### Code Quality
- [ ] All files committed to git
- [ ] No sensitive data in repo (passwords, tokens)
- [ ] `.gitignore` properly configured
- [ ] README is comprehensive
- [ ] Documentation is up-to-date

### SEO & Technical
- [ ] All meta tags present in HTML
- [ ] robots.txt includes sitemap references
- [ ] sitemap.xml validates (XML syntax)
- [ ] No 404 errors for internal links
- [ ] Mobile responsive (test on multiple devices)
- [ ] HTTPS enabled (let hosting provide SSL)

### Performance
- [ ] Lighthouse score 95+
- [ ] LCP < 2.5s
- [ ] Images optimized (WebP format)
- [ ] CSS/JS minified
- [ ] Gzip compression enabled
- [ ] Caching headers configured

### Browser Compatibility
- [ ] Chrome 90+ ✓
- [ ] Firefox 88+ ✓
- [ ] Safari 14+ ✓
- [ ] Edge 90+ ✓
- [ ] Mobile Safari (iOS 14+) ✓

### Security
- [ ] Security headers present (X-Frame-Options, CSP, etc.)
- [ ] No external JavaScript (or verified sources)
- [ ] No inline scripts (except data)
- [ ] HTTPS enabled
- [ ] No exposed API keys or credentials

### DNS & Domain
- [ ] Domain points to new hosting
- [ ] DNS A records configured
- [ ] CNAME records for subdomains (if any)
- [ ] SSL certificate installed
- [ ] Email forwarding configured (if needed)

### Analytics & Monitoring
- [ ] Google Analytics 4 tag added
- [ ] Search Console sitemap submitted
- [ ] Uptime monitoring configured
- [ ] Error logging enabled
- [ ] Performance monitoring active

---

## 🔄 Migration from Old Site

### 301 Redirects Setup

**For Apache (.htaccess):**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Redirect WordPress post URLs to new structure
  RewriteRule ^\?p=([0-9]+)$ /blog/post-$1/ [R=301,L]
  RewriteRule ^blog/([^/]+)/$ /blog/$1/ [R=301,L]

  # Redirect old pages
  RewriteRule ^solutions/$ /ki-loesungen/ [R=301,L]
  RewriteRule ^about/$ /management/ [R=301,L]
</IfModule>
```

**For Nginx:**
```nginx
# In server block:
rewrite ^/\?p=([0-9]+)$ /blog/post-$1/ permanent;
rewrite ^/blog/([^/]+)/$ /blog/$1/ permanent;
rewrite ^/solutions/$ /ki-loesungen/ permanent;
```

**For Cloudflare Pages (`_redirects`):**
```
/\?p=:id            /blog/post-:id/          301
/solutions/         /ki-loesungen/           301
/about/             /management/             301
```

### Search Console Update

1. **Old Property:** https://search.google.com/search-console
2. Add new domain property
3. Upload sitemap from new site
4. Request indexing for key pages
5. Monitor for crawl errors
6. Set preferred domain to new URL

---

## 📊 Post-Deployment Monitoring

### Week 1: Verification
- [ ] Check Google indexing (1-2 days)
- [ ] Verify all pages are indexed
- [ ] Monitor for 404 errors
- [ ] Check Search Console for crawl errors
- [ ] Verify Lighthouse scores

### Week 2-4: Performance
- [ ] Track organic traffic trends
- [ ] Monitor keyword rankings
- [ ] Check Core Web Vitals scores
- [ ] Analyze user behavior
- [ ] Review conversion metrics

### Month 2+: Optimization
- [ ] Identify low-performing pages
- [ ] Optimize for target keywords
- [ ] Build backlink strategy
- [ ] Create additional content
- [ ] A/B test headlines/CTAs

---

## 🆘 Troubleshooting

### Site Not Showing After Deploy

**Check:**
1. DNS pointing to hosting
2. dist/ folder uploaded completely
3. No .htaccess issues (if Apache)
4. Server error logs for 500 errors
5. CORS headers if accessing from subdomain

### Lighthouse Scores Low

**Solutions:**
1. Run `npm run optimize` (image compression)
2. Enable gzip compression
3. Add cache headers
4. Minify CSS/JS further
5. Reduce unused CSS via PurgeCSS

### Pages Not Indexed

**Solutions:**
1. Submit sitemap to Google Search Console
2. Request URL indexing manually
3. Check robots.txt allows indexing
4. Verify no `noindex` meta tags
5. Check for redirect chains

### Geo-Targeting Not Working

**Solutions:**
1. Verify geo meta tags are present
2. Check hreflang tags correct
3. Confirm Search Console geo setting
4. Review ICBM coordinates
5. Test with: `curl -I [url] | grep geo`

---

## 📞 Support & Resources

### GitHub Issues
- Report bugs: https://github.com/YOUR_USERNAME/virtual-marketer-new-website/issues
- Discuss features: GitHub Discussions tab
- Track progress: GitHub Projects

### Deployment Support

**Cloudflare:** https://support.cloudflare.com/hc/en-us  
**Netlify:** https://docs.netlify.com/  
**GitHub Pages:** https://docs.github.com/en/pages  
**1blu:** https://www.1blu.de/support  

### SEO Tools
- Google Search Console: https://search.google.com/search-console
- Bing Webmaster Tools: https://www.bing.com/webmasters
- Google Analytics 4: https://analytics.google.com

---

## 🎉 Next Steps

1. **Create GitHub Repo** (see top of this file)
2. **Push to GitHub:**
   ```bash
   git remote add origin [REPO_URL]
   git push -u origin main
   ```
3. **Choose Hosting:** Cloudflare Pages (recommended)
4. **Connect GitHub to Hosting**
5. **Test & Monitor**
6. **Announce Launch**

**Estimated Time:** 30 minutes to fully deployed + monitoring setup

---

**Status:** ✅ Ready to deploy  
**Recomm Host:** Cloudflare Pages  
**Next Action:** Create GitHub repo & deploy


---

# ☁️ Google Cloud Run (current production target)

This is what the site actually runs on now. The hosting options above predate
it and are kept only for reference.

## Why Cloud Run and not the cheaper-looking alternatives

Firebase Hosting and Cloudflare Pages are cheaper per byte for pure static
content, but neither can filter traffic by user agent — and the requirement
here is to block commercial scrapers while never throttling Googlebot. That
rule lives in `docker/nginx.conf.template`, so the site has to be served by
something that runs nginx. Cloud Armor could do it at the edge instead, but it
needs a global external load balancer, which is a fixed ~EUR 18/month whether
or not anyone visits.

Cloud Run with `minScale: 0` costs effectively nothing at this traffic level:
the free tier covers 2M requests and 180k vCPU-seconds a month, and the
service bills nothing at all while idle. Firestore's free tier (1 GiB, 20k
writes/day) similarly covers the booking volume with room to spare.

## What is deployed

One Cloud Run service, **two containers in the same instance**:

| Container | Image | Role |
|---|---|---|
| `web` | `virtual-marketer-website` | nginx, ingress on `$PORT`, serves `dist/`, proxies `/api/` |
| `api` | `virtual-marketer-api` | booking/contact API on `127.0.0.1:4000`, never public |

```
Project   virtual-marketer-chat-bot
Region    europe-west1          (Firestore (default) is europe-west3 — cross-region
                                 reads add ~5ms, and europe-west1 is where Cloud Run
                                 domain mappings are supported)
Service   virtual-marketer-website
URL       https://virtual-marketer-website-394370849364.europe-west1.run.app
Scaling   minScale 0, maxScale 4, concurrency 200
Identity  vm-website@virtual-marketer-chat-bot.iam.gserviceaccount.com
          └── roles/datastore.user, secretAccessor on vm-website-smtp-pass
```

The API is a sidecar rather than its own service on purpose: nginx reaches it
over loopback, so there is no second public endpoint to secure, no
service-to-service auth to configure, and no second cold start on the booking
path.

## Redeploying

```bash
# 1. Rebuild the static site
npm run build

# 2. Build and push both images
REPO=europe-west1-docker.pkg.dev/virtual-marketer-chat-bot/cloud-run-source-deploy
gcloud auth print-access-token | docker login -u oauth2accesstoken \
  --password-stdin https://europe-west1-docker.pkg.dev
docker build -t "$REPO/virtual-marketer-website:vN" .
docker build -t "$REPO/virtual-marketer-api:vN" ./backend
docker push "$REPO/virtual-marketer-website:vN"
docker push "$REPO/virtual-marketer-api:vN"

# 3. Point the manifest at the new tag and apply
gcloud run services replace service.yaml \
  --project=virtual-marketer-chat-bot --region=europe-west1
```

`gcloud auth configure-docker` alone is not enough on a snap-installed Docker —
the credential helper is not on its PATH, hence the explicit `docker login`.

Use real version tags, not `:latest`. Cloud Run resolves the image to a digest
at deploy time, so `:latest` makes it impossible to tell which build a revision
is running or to roll back to a specific one.

## Cutting the domain over from the old WordPress host

`virtual-marketer.de` still resolves to **178.254.10.137** (1blu), and DNS is
served by `ns01.1blu.de` / `ns02.1blu.de`. Nothing below has been done — it
changes what the public sees, so it is a deliberate, separate step.

**The domain is already verified.** `1und1.`, `denta-tec-com.`,
`primeo-energie.`, `self-reliance.` and `voice-denta-tec-com.` are all mapped
to Cloud Run services in this project today, which is only possible for a
verified domain. `gcloud domains verify` is therefore not needed — that step
was in this document before those mappings existed.

1. **Lower the TTL, a day ahead.** It is 7200s today, so without this a
   rollback takes two hours to take effect. Set 300s on the A records for
   the apex and on `www`.

2. **Create the mappings:**
   ```bash
   gcloud beta run domain-mappings create --service=virtual-marketer-website \
     --domain=virtual-marketer.de --region=europe-west1 \
     --project=virtual-marketer-chat-bot
   gcloud beta run domain-mappings create --service=virtual-marketer-website \
     --domain=www.virtual-marketer.de --region=europe-west1 \
     --project=virtual-marketer-chat-bot
   ```
   Both are needed. `www` is not decoration: nginx 301s it to the apex, but
   the request has to reach the container before it can be redirected, and it
   only does that if `www` is mapped.

3. **Add the records the command prints**, in the 1blu DNS panel. The shape
   differs by host and this is not interchangeable:
   - **apex** — four `A` and four `AAAA` records. A CNAME is not possible at
     a zone apex, which is why Cloud Run hands out addresses here.
   - **www** — a single `CNAME` to `ghs.googlehosted.com.`, the same target
     the existing subdomains already use.

   Take the values from the command's output rather than from this document;
   they are per-project and printing them here would create a second copy to
   go stale.

4. **Wait for the managed certificate.** Cloud Run issues it only after DNS
   resolves to Google, typically 15–60 minutes. The site serves TLS errors in
   between, so do this outside business hours.

5. **Afterwards, check:**
   - `https://virtual-marketer.de/` and `https://www.virtual-marketer.de/` —
     the second must answer **301** to the first, with the path preserved.
   - `/blog/`, `/blog/page/8/`, `/blog/kategorie/seo/`, `/en/blog/page/3/` —
     all **200**. Note `/blog/page/` is real pagination now; an earlier
     version of this document told you to confirm it **301s** to `/blog/`,
     which was correct when those URLs held WordPress's thin archives and is
     wrong today.
   - `/tag/`, `/category/`, `/author/` — still **301** to `/blog/`.
   - Resubmit `https://virtual-marketer.de/sitemap.xml` in Search Console.

**One thing to decide before step 3.** The site sends
`Strict-Transport-Security: max-age=31536000; includeSubDomains`. Once a
browser has seen that on the apex it will refuse plain HTTP to *every*
`*.virtual-marketer.de` host for a year, and the header is cached client-side,
so removing it later does not release browsers that already have it. Checked
against what exists today: `api.`, `login.` and the five mapped app
subdomains all serve HTTPS correctly, and `mail.` runs no web service at all —
it is the MX host, and SMTP/IMAP are unaffected by HSTS. So this is safe as
it stands. It does mean **any subdomain added later must be HTTPS from the
first day**, which is a constraint worth knowing before it bites.

Keep the 1blu WordPress instance running but unreferenced until the new site
has been live and indexed for a week — reverting is then just a DNS change.

## The service spec is in the repo

`deploy-service.yaml` is the Cloud Run service definition, exported from the
running service. It was not version-controlled before, which meant the only
copy of the two-container topology lived in whatever shell last touched it.

Deploy with:

```bash
gcloud run services replace deploy-service.yaml \
  --region=europe-west1 --project=virtual-marketer-chat-bot
```

**Two containers, two images.** The website image and the API image are built
separately, and it is easy to rebuild one and believe you have shipped both —
that happened: the model-request endpoint 404'd after a website-only deploy
because the route lives in the API container.

```bash
docker build -t …/virtual-marketer-website:vNN .          # from the repo root
docker build -t …/virtual-marketer-api:vNN backend/       # from backend/
```

**Container startup order.** nginx starts before the API sidecar is listening,
so on a cold start the first request to `/api/` used to return 502 while the
page itself served fine — losing exactly the visitor who came to book a demo.
Fixed with two settings that only work together:

- `run.googleapis.com/container-dependencies: '{"web":["api"]}'` on the
  revision. Note this is an annotation, not a `dependsOn` field; the field
  exists in Knative but `gcloud run services replace` rejects it.
- a `tcpSocket` startupProbe on port 4000 in the API container. Without it
  Cloud Run treats the container as started the moment the process launches,
  so the dependency waits for nothing.

Verified by idling the service to zero and hitting `/api/` first: 200, not
502.

## Operational notes

- **AVIF content negotiation.** nginx serves `<file>.avif` siblings to
  browsers whose Accept header includes `image/avif` (see the `$vm_avif` map
  in `docker/nginx.conf.template`). The siblings are generated by
  `scripts/generate-avif.js` into the committed `dist/`, cached under
  `.cache/avif/` (gitignored) so rebuilds don't re-encode. If images ever
  look wrong in one browser but not another, check `Vary: Accept` is still
  on the images location before suspecting the files.
- **OG cards.** `scripts/generate-og-images.js` renders the blog's link
  preview cards using fonts instanced from the site's own variable woff2 —
  it needs `python3` with `fonttools` + `brotli` on the build machine and
  falls back to a system font (visibly wrong typeface, still functional)
  without them. The Docker image copies pre-built `dist/`, so the container
  build needs neither.
- **Secrets.** Only `SMTP_PASS` is in Secret Manager (`vm-website-smtp-pass`).
  The rest of the SMTP settings are plain env vars in the service manifest;
  they are configuration, not credentials.
- **Cost ceiling.** `maxScale: 4` is the real protection against a traffic
  spike or a determined scraper turning into a bill. The nginx rate limit is a
  backstop, not the budget control.
- **`minScale: 1`, not `0`.** Scaling to zero was correct at the time it was
  chosen — this project's own billing analysis (see the "Strato move" work)
  measured the site's whole Cloud Run cost at roughly $0.18/month, deep
  inside the free tier, and scale-to-zero is what makes that true. But a cold
  start is a real cost paid by whichever visitor happens to arrive after an
  idle gap, not by the invoice: a mobile Lighthouse run against a cold
  instance measured Total Blocking Time at 990 ms and a performance score of
  70; the identical page, warm, scored 85–93. That gap is invisible in the
  monthly bill and very visible to that one visitor and to anyone auditing
  the site with Lighthouse or PageSpeed Insights, which is what surfaced it.

  `minScale: 1` keeps one instance warm continuously. With
  `run.googleapis.com/cpu-throttling: true` already set, the idle instance is
  billed for its 512 MiB of reserved memory around the clock but not for CPU
  while there is no request to serve — roughly $3–5/month at current
  pricing, not the cost of a fully-idle-but-CPU-billed instance. Reversible
  in one line (`minScale: 0`) if that trade is ever wrong.
- **Logs.** `gcloud run services logs read virtual-marketer-website
  --region=europe-west1 --project=virtual-marketer-chat-bot`
