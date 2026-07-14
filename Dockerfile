# Virtual Marketer — static site container
# Multi-stage build: build the static site with Node, serve with hardened nginx.

# ---- Stage 1: Build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
COPY blog-posts.json ./blog-posts.json
COPY dist ./dist-src

# The dist/ folder is pre-built and committed (static content generated from
# the WordPress export). We copy it as-is and just re-run the sitemap
# generator so lastmod/sitemap always reflect this exact build.
RUN mkdir -p dist && cp -r dist-src/. dist/ \
  && node scripts/generate-sitemap.js

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

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER webapp
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
