# Virtual Marketer — static site container
# Multi-stage build: build the static site with Node, serve with hardened nginx.

# ---- Stage 1: Build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
COPY blog-posts.json ./blog-posts.json
COPY blog-posts-en.json ./blog-posts-en.json
COPY dist ./dist-src

# The dist/ folder is pre-built and committed (static content generated from
# the WordPress export). We copy it as-is and just re-run the sitemap and
# llms.txt generators so both always reflect this exact build.
RUN mkdir -p dist && cp -r dist-src/. dist/ \
  && node scripts/generate-sitemap.js \
  && node scripts/generate-llms-txt.js

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="virtual-marketer-website" \
      org.opencontainers.image.description="Static, SEO/geo-optimized virtual-marketer.de site" \
      org.opencontainers.image.source="https://github.com/SGS-Virtual-Marketer-GmbH/virtual-marketer-new-website"

# Run as non-root
RUN addgroup -g 1001 -S webapp && adduser -u 1001 -S webapp -G webapp \
  && mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
  && chown -R webapp:webapp /tmp /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
  && rm -f /etc/nginx/conf.d/default.conf \
  && touch /tmp/nginx.pid && chown webapp:webapp /tmp/nginx.pid

# nginx.conf is a template rendered at start-up — see docker/entrypoint.sh for
# which values vary and why substitution is restricted to exactly those.
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/entrypoint.sh /usr/local/bin/vm-entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod +x /usr/local/bin/vm-entrypoint.sh

USER webapp

# Documentation only: the port actually bound comes from $PORT at runtime,
# which Cloud Run sets. 8080 is the default and what compose publishes.
EXPOSE 8080
ENV PORT=8080 \
    API_UPSTREAM=127.0.0.1:4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1

ENTRYPOINT ["/usr/local/bin/vm-entrypoint.sh"]
