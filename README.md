# Virtual Marketer — Static Website

High-performance, security-hardened static rebuild of [virtual-marketer.de](https://virtual-marketer.de/), containerized for self-hosting on Virtual Marketer's own infrastructure.

**For review by:** Jens Göckus (CTO)
**Status:** Ready for review — content, SEO/geo, security, and containerization complete; production deployment (DNS/TLS cutover) not yet performed.

---

## What this is

The original site is WordPress 7.0.1 + Elementor + WooCommerce + ~15 plugins on 1blu shared hosting, and it currently has a broken admin panel (a fatal PHP syntax error in the Kirki plugin on `/wp-admin/customize.php`) plus 5 pending core/plugin updates. This repository is a from-scratch static rebuild:

- **Same URLs, same content** — every page keeps its original path (`/ki-loesungen/`, `/blog/<slug>/`, `/impressum/`, etc.), so no inbound links or search rankings break. No redirects were needed except one (`/home/` → `/`, a duplicate legacy homepage).
- **45 existing blog posts preserved**, plus **11 new posts** written for the content gap since the last post (July 2025). See [`BLOG_CONTENT_PLAN.md`](BLOG_CONTENT_PLAN.md) for the topic research and publication schedule.
- **Zero PHP, zero database** — the entire attack surface of a CMS is gone by construction. See [`SECURITY.md`](SECURITY.md) for the full before/after threat model and what was verified (not just configured).
- **SEO & geo-optimized** — Schema.org JSON-LD, Open Graph, auto-generated sitemap, Germany-targeted geo meta tags. See [`SEO_GEO_GUIDE.md`](SEO_GEO_GUIDE.md).
- **Containerized** — a hardened, non-root, read-only nginx container (`Dockerfile` + `docker-compose.yml`) ready to run on any of your servers, no 1blu/shared-hosting dependency.

## Quick start

```bash
# Build the static site (WordPress export → clean HTML → blog posts → SEO → sitemap)
npm run build

# Run locally without Docker
npm run dev              # http://localhost:3000

# Run in the production container
docker compose up --build   # http://localhost:8080
```

## Project structure

```
├── dist/                    # Build output — deployable static site (gitignored... see note below)
├── content/blog/            # Body content (HTML fragments) for the 11 new posts
├── blog-posts.json          # Metadata for the 11 new posts (title, date, keywords, ...)
├── scripts/
│   ├── build.js              # WordPress export → cleaned static HTML
│   ├── generate-blog-posts.js # Renders content/blog/*.html into dist/blog/<slug>/
│   ├── seo-optimize.js       # Injects meta tags, Schema.org JSON-LD, OG tags
│   ├── generate-sitemap.js   # Auto-generates sitemap.xml/robots.txt from dist/ (run last)
│   └── analyze.js            # Site inventory / size report
├── docker/
│   ├── nginx.conf            # Hardened server config (security headers, redirects, caching)
│   └── security-headers.conf # Shared header set (see SECURITY.md §2.1 for why it's separate)
├── Dockerfile                # Multi-stage build → non-root, read-only nginx image
├── docker-compose.yml        # Local/production run config (read-only fs, dropped capabilities)
├── server.js                 # Lightweight Node dev server (gzip, caching, no Docker needed)
└── .claude/launch.json       # Preview-tool config for local development
```

> **Note on `dist/`:** it's currently committed so this repo is deployable as-is without an npm install step. If you'd rather build it in CI, add `dist/` to `.gitignore` and add a build step to your deploy pipeline — `npm run build` has zero external dependencies (Node stdlib only), so this is a trivial change.

## Documentation index

| Doc | Contents |
|---|---|
| [`SECURITY.md`](SECURITY.md) | Threat model, implemented controls, **a real bug found & fixed during this build** (nginx header-inheritance issue), known gaps, pre-production checklist |
| [`SEO_GEO_GUIDE.md`](SEO_GEO_GUIDE.md) | Meta tags, structured data, geo-targeting strategy, Core Web Vitals targets, launch checklist |
| [`BLOG_CONTENT_PLAN.md`](BLOG_CONTENT_PLAN.md) | Research behind the 11 new posts — search-volume tiers, publication calendar, lead-gen angles |
| [`BLOG_STRATEGY.md`](BLOG_STRATEGY.md) | Longer-term content strategy and ongoing publication cadence |
| [`MIGRATION.md`](MIGRATION.md) | Original 8-phase migration plan (download → cleanup → optimize → deploy) |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Hosting options if you don't containerize (Cloudflare Pages, Netlify, GitHub Pages) — superseded by the Docker setup below for self-hosting, kept for reference |
| [`STATUS.md`](STATUS.md) | Point-in-time progress snapshot from earlier in the project |

## Content

| Type | Count |
|---|---|
| Static pages | 12 (home, `/ki-loesungen/`, `/blog/`, `/management/`, `/faqs/`, `/login/`, legal pages, etc.) |
| Blog posts (existing, preserved) | 45 |
| Blog posts (new, this update) | 11 |
| Total sitemap URLs | 67 |

The 11 new posts cover Agentic AI, Generative Engine Optimization (AI-search SEO), GDPR-compliant personalization, RAG for product descriptions, multimodal AI in retail, voice/conversational AI, neural search, predictive analytics for universities, synthetic training data, edge AI, and cost-efficient model fine-tuning — see [`BLOG_CONTENT_PLAN.md`](BLOG_CONTENT_PLAN.md) for why these topics and the research behind them. **They have not had a human editorial pass yet** — see the pre-production checklist in `SECURITY.md`.

## Deploying on your own servers

```bash
docker build -t virtual-marketer-website .
docker run -d -p 8080:8080 --name virtual-marketer virtual-marketer-website
```

Or with Compose (includes read-only filesystem, dropped Linux capabilities, healthcheck):
```bash
docker compose up -d --build
```

The container serves plain HTTP on port 8080 by design — terminate TLS at your reverse proxy/load balancer in front of it, per your existing infra conventions. Point that proxy's upstream at this container and you're done; no further app-level config needed.

## What's not done yet

- Human editorial review of the 11 new blog posts (content, not code)
- Image optimization pass (WebP conversion) — `scripts/optimize.js` documents the approach, not yet automated
- Production DNS/TLS cutover from the current WordPress site
- CI/CD wiring (build/deploy on push) — currently a manual `npm run build` + container rebuild

See `SECURITY.md` §6 for the full pre-production checklist.

---

**Repository:** [github.com/SGS-Virtual-Marketer-GmbH/virtual-marketer-new-website](https://github.com/SGS-Virtual-Marketer-GmbH/virtual-marketer-new-website)
**Original site:** https://virtual-marketer.de/
