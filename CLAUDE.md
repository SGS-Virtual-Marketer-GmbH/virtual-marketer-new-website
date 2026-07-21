# Virtual Marketer — Marketing Website (virtual-marketer.de)

Static HTML site built from a WordPress export via `npm run build` (`scripts/build.js`
+ pipeline — see `package.json`). Served locally with `node server.js` / `npm run dev`,
containerized for production via `Dockerfile` + `docker/nginx.conf`.

## Where product features come from (always check before touching feature/demo pages)

This site's feature pages, product demos and "what Virtual Marketer can do" copy must
reflect the **real, current** product — not invented or stale descriptions. The actual
product lives in a separate repo, `vm-customer-web-ui`, which maintains its own
authoritative sources. Before writing or updating any feature/demo content here, read:

| What | Path |
|---|---|
| Customer-facing changelog (what shipped, in product language) | `/home/fabian-stamminger/Dokumente/Virtual Marketer/vm-customer-web-ui/src/content/changelog.ts` |
| Internal engineering changelog (technical detail, for context only — never copy onto the site) | `/home/fabian-stamminger/Dokumente/Virtual Marketer/vm-customer-web-ui/CHANGELOG-INTERNAL.md` |
| **Feature catalog — the actual foundation for this website's feature content** | `/home/fabian-stamminger/Dokumente/Virtual Marketer/vm-customer-web-ui/docs/product/feature-catalog.md` |
| Full app registry (names, taglines, value bullets, how-it-works steps, FAQ — approved marketing copy, verbatim) | `/home/fabian-stamminger/Dokumente/Virtual Marketer/vm-customer-web-ui/src/content/appRegistry.ts` |
| In-app product-page layout to mirror visually | `/home/fabian-stamminger/Dokumente/Virtual Marketer/vm-customer-web-ui/src/components/ui/ProductPage.tsx` |

The convention on the product side (`vm-customer-web-ui/CLAUDE.md` lines 218–237) requires
every user-visible product change to update all three of: `changelog.ts`,
`CHANGELOG-INTERNAL.md`, and `feature-catalog.md` — with `feature-catalog.md` explicitly
described there as *"the source from which another agent (the website/landing-page
builder) builds interactive demos 'like the real product'."* That other agent is this
project.

**Workflow when asked to add/update a feature page here:**
1. Read `feature-catalog.md` first (what exists, what it looks like, asset paths).
2. Pull exact copy (tagline, value bullets, steps, FAQ) from `appRegistry.ts` — do not
   paraphrase or invent; that copy is already approved.
3. Check `changelog.ts` for what's new/recent, to prioritize which features need pages first.
4. Follow the branding rule from `feature-catalog.md`: Virtual Marketer product language
   only — never name the underlying AI vendor/engine/model (no "Gemini", "Google",
   "Vertex", "OpenAI", "Anthropic", etc.). Model tiers are "Virtual Marketer Senior" and
   "Virtual Marketer Junior".
5. Propose target audience, business/EBIT impact framing, and SEO/search-intent research
   for the feature before building a subpage — don't assume it matches the in-app copy's
   framing 1:1, since website visitors search differently than logged-in users read.
6. Mirror `ProductPage.tsx`'s visual anatomy and this site's existing look (see
   `SEO_GEO_GUIDE.md`, `assets/ai-features.css`) — keep it on-brand and consistent, but
   make it richer/more interactive for a public marketing audience (animation, live demo
   widgets), since this is a landing page, not an in-app help panel.
7. Keep it mobile-first — verify with the preview tools' responsive presets before calling
   a feature page done.

## Build & verify

- `npm run build` — full pipeline (rm -rf + regenerate `dist/`), see `package.json` for
  the exact script order.
- `node server.js` (or `npm run dev`) — local dev server with gzip, cache headers,
  security headers; see `server.js` for WordPress query-string-in-filename handling.
- Always rebuild from scratch and spot-check in a browser preview after content or
  script changes — do not trust static analysis alone for anything user-visible.

## Documentation map

`README.md` (overview), `SECURITY.md` (threat model), `SEO_GEO_GUIDE.md` (SEO/geo
strategy), `MIGRATION.md`, `DEPLOYMENT.md`, `BLOG_STRATEGY.md` / `BLOG_CONTENT_PLAN.md`
(content strategy), `STATUS.md`.
