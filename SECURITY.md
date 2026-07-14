# Security Overview — Virtual Marketer Static Site

**Scope:** `virtual-marketer-new-website` (this repository)
**Last reviewed:** 2026-07-14
**Reviewer:** Automated audit (Claude) — recommend a follow-up human review by the CTO before production cutover.

---

## 1. Threat Model Change: WordPress → Static

The legacy site (`virtual-marketer.de`) runs WordPress + Elementor + WooCommerce + ~15 plugins on 1blu shared hosting. That stack carries a large, continuously-changing attack surface: PHP execution, a MySQL database, an admin panel (`/wp-admin/`), XML-RPC, REST API endpoints, and plugin code that requires constant patching (the live site currently has 5 pending core/plugin updates and one plugin — Kirki — throwing a fatal PHP syntax error on `/wp-admin/customize.php`).

This repository replaces that with a **static-only** site: plain HTML/CSS/JS/images served by nginx from a read-only filesystem. This removes entire vulnerability classes by construction:

| Vulnerability class | WordPress (legacy) | This static site |
|---|---|---|
| SQL injection | Possible (MySQL + plugins) | **Not applicable** — no database |
| PHP RCE / plugin vulnerabilities | Possible (15+ plugins) | **Not applicable** — no PHP runtime |
| Admin panel brute-force / takeover | `/wp-admin/` reachable | **Not applicable** — no admin panel; `/wp-admin/`, `/wp-login.php`, `/wp-json/`, `/xmlrpc.php` return `410 Gone` |
| Outdated dependency CVEs (core/plugins) | Ongoing risk | **Not applicable** — no CMS dependencies to patch |
| File upload / arbitrary file write | Possible via media library | **Not applicable** — no upload functionality |
| Session/auth vulnerabilities | Possible (wp-login, cookies) | **Not applicable** — no authentication on this site |

What remains in scope for a static site: content integrity (supply chain of the build), transport security, response headers, and safe serving behavior — covered below.

---

## 2. Implemented Controls

### 2.1 HTTP response headers (`docker/nginx.conf`)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — forces HTTPS on repeat visits
- `X-Content-Type-Options: nosniff` — blocks MIME-sniffing attacks
- `X-Frame-Options: SAMEORIGIN` — blocks clickjacking via foreign iframes
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage to third parties
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()` — disables unused browser APIs, opts out of FLoC
- `Content-Security-Policy` — restricts script/style/img/font/connect sources; see §5 for the one known gap
- `server_tokens off` — nginx version string not disclosed in error pages/headers

**Verified, not just configured:** these headers were built into a real Docker image and checked with `curl -I` against a running container as part of this update (not just eyeballed in the config). That test caught a real bug: nginx silently drops all `add_header` directives inherited from a parent block if a child `location` block declares even one `add_header` of its own (e.g. our `Cache-Control` overrides). The fix moved the shared header set into `docker/security-headers.conf` and explicitly `include`s it in every location block that also sets `Cache-Control`. Re-tested after the fix — all five headers now appear on `/`, on cached assets (`.css`/`.js`/images), and on `/sitemap.xml`/`/robots.txt`.

### 2.2 Container hardening (`Dockerfile`, `docker-compose.yml`)
- Multi-stage build — the Node.js toolchain used to build the site is **not** present in the final runtime image
- Runs as a **non-root** user (`webapp`, uid 1001), not `root`
- Filesystem is **read-only** at runtime (`read_only: true`), with `tmpfs` mounts only where nginx needs to write (`/tmp`, cache, logs)
- `cap_drop: ALL` + `no-new-privileges:true` — no Linux capabilities beyond the minimum, no privilege escalation
- Listens on unprivileged port `8080` (not `80`) so the container never needs `root` to bind
- Healthcheck included for orchestrators (Docker/Kubernetes) to detect and restart a hung container

### 2.3 Legacy endpoint closure
The WordPress installation exposed `/wp-admin/`, `/wp-login.php`, `/wp-json/*`, and `/xmlrpc.php`. These no longer exist as functional endpoints, but bots will keep probing them (this is normal internet background noise). We explicitly return `410 Gone` for these paths instead of a generic `404`, which is the correct signal to crawlers that the resource is permanently gone (helps deindex stale WordPress admin URLs faster than a bare 404 would).

### 2.4 No secrets in the repository
- No API keys, passwords, database credentials, or `.env` files are present in this repo or the build output.
- The FTP/hosting credentials shared during this project's setup were used only interactively in chat/browser sessions and were **never written to any file in this repository**. `.gitignore` additionally excludes `.env*` as a defense-in-depth measure.
- Nothing in `dist/` references the WordPress database, admin credentials, or any backend secret — it is pure static markup exported from the public-facing pages.

### 2.5 Dotfile / backup-file protection
`docker/nginx.conf` denies any request for dotfiles (`location ~ /\. { deny all; }`) and common backup/source extensions (`.bak`, `.sql`, `.log`, `.env`), preventing accidental exposure if such a file is ever mistakenly placed in `dist/`.

### 2.6 Two site-wide bugs found and fixed while adding the AI Features section

Testing the new homepage/product-page section surfaced two pre-existing bugs affecting the *entire* site, not just the new content — worth flagging explicitly since they were silent:

1. **Versioned asset URLs 404'd in local dev.** WordPress exports assets as e.g. `style.css?ver=7.0.1.css` — the literal `?` is part of the *filename* on disk, but the HTML references it URL-encoded (`style.css%3Fver=7.0.1.css`). `server.js` split on `?` to strip real query strings but never decoded `%3F` back to a literal `?`, so it never matched the file on disk — every such asset (a large fraction of the theme's CSS/JS, including all of Font Awesome) silently 404'd in local dev. Fixed in `server.js` by decoding *after* stripping any genuine query string (order matters — decoding first turns `%3F` into `?`, which then gets incorrectly stripped by a subsequent split).
2. **A stuck loading-screen overlay.** The theme's "royal_preloader" overlay sets `body{visibility:hidden}` and expects a bundled jQuery plugin to reveal the page on `window.load`. That reveal doesn't reliably fire in this static export, so the site could get stuck showing a blank/covered page indefinitely. Since this is now a static site — there's no real "loading" work happening — `scripts/fix-preloader.js` neutralizes the mechanism outright with a CSS override (`body{visibility:visible!important}` + hiding `#royal_preloader`) injected into every page, rather than trying to reproduce the legacy plugin's exact timing.

Both were caught by actually loading the built site and checking computed styles / network responses, not just reading the config — see `scripts/fix-preloader.js` and the `server.js` comment at the URL-decoding line for the full explanation.

---

## 3. Content Supply Chain

All page content in `dist/` originates from one of two places:
1. **Verbatim export** of the live WordPress site (via `wget --mirror`), for existing pages/posts — see `scripts/build.js`.
2. **New blog posts** (11 posts added in this update) generated by AI agents against detailed briefs, each explicitly instructed to avoid fabricated statistics, avoid inventing named client testimonials, hedge claims appropriately, and include a legal disclaimer on posts touching GDPR/AI Act topics. **These posts should get a human editorial read before publishing** — AI-assisted content is a productivity aid, not a substitute for a final human sign-off, especially for compliance-adjacent claims (GDPR, AI Act).

No third-party JavaScript, analytics, tag managers, or tracking pixels were added as part of this update. The legacy site's Google Tag Manager, Yoast SEO scripts, and similar third-party inclusions were part of the original WordPress export and are preserved as-is where present in the mirrored HTML — **recommend reviewing these against your current consent-management/cookie-banner configuration before go-live**, since a static rebuild is also a natural opportunity to prune anything no longer needed.

---

## 4. Redirects & Legacy URL Handling

- `/home/` → `301` to `/` (duplicate legacy homepage — same title/content as `/`, consolidated to avoid duplicate-content SEO issues)
- `/wp-admin/*`, `/wp-login.php`, `/wp-json/*`, `/xmlrpc.php` → `410 Gone`
- `/elements/` (an Elementor theme-demo scaffold page, not real site content) was intentionally **not** carried over — it never appeared in real navigation and contains no content specific to Virtual Marketer.
- All other URLs (`/ki-loesungen/`, `/blog/`, `/blog/<slug>/`, `/management/`, `/datenschutzerklaerung/`, `/impressum/`, `/nutzungsbedingungen/`, `/modell-anfragen/`, `/virtual-marketer-ai-services/`, `/virtual-marketer-demo/`, `/faqs/`, `/login/`) are preserved at their **exact original paths** — no redirects needed, no inbound links or search rankings should break.

---

## 5. Known Gaps / Follow-ups for the CTO

These are flagged transparently rather than silently left out:

1. **CSP uses `'unsafe-inline'`** for `script-src`/`style-src`. The original WordPress theme (Elementor, WooCommerce, LayerSlider, etc.) relies on inline `<script>`/`<style>` blocks throughout the exported HTML. A stricter CSP (nonces/hashes) would require rewriting those inline blocks — worth doing in a follow-up pass once the content is stable, but out of scope for this content-and-hosting update.
2. **Legacy third-party embeds** (Google Tag Manager, Jetpack stats, etc.) inherited from the WordPress export have not been audited against current consent requirements — flagged in §3.
3. **AI-generated blog content has not had human editorial review.** Recommend a marketing/legal read-through before the 11 new posts go live, particularly the GDPR/AI Act and student-predictive-analytics posts, which touch regulated topics.
4. **No automated dependency/vulnerability scanning is wired up yet** (e.g., Trivy/Grype on the built image, `npm audit` in CI). The build has zero npm runtime dependencies today (Node stdlib only), which minimizes this risk, but if dependencies are added later, add scanning to CI at that point.
5. **HTTPS/TLS termination is out of scope of this container.** The nginx container serves plain HTTP on port 8080 by design — TLS should terminate at your reverse proxy / load balancer / Cloudflare in front of it, per your existing infrastructure conventions.

---

## 6. Recommended Pre-Production Checklist

- [ ] CTO / engineering review of `Dockerfile`, `docker-compose.yml`, `docker/nginx.conf`
- [ ] Human editorial review of the 11 new blog posts (`BLOG_CONTENT_PLAN.md` for topic list)
- [ ] Confirm TLS termination point and HSTS behavior in production topology
- [ ] Confirm cookie-consent banner still covers all third-party scripts present in `dist/`
- [ ] Run `docker build . && docker compose up` locally and smoke-test all pages (see `README.md`)
- [ ] Point a staging subdomain at the container before cutting over the apex domain
