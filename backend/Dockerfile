# Virtual Marketer — booking/contact API container.
#
# Runs as a sidecar alongside nginx in one Cloud Run service: nginx is the
# ingress container on 8080 and reverse-proxies /api/ to this one on
# loopback:4000, so this port is never exposed publicly.
FROM node:20-alpine AS build
WORKDIR /app
# No build toolchain needed any more — the only native dependency was
# better-sqlite3, which the move to Firestore removed. Firestore's client is
# pure JS over gRPC, so this stays a plain `npm ci`.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
LABEL org.opencontainers.image.title="virtual-marketer-api" \
      org.opencontainers.image.description="Booking + contact-form API for virtual-marketer.de"

RUN addgroup -g 1001 -S api && adduser -u 1001 -S api -G api

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER api
EXPOSE 4000

# No /data volume: bookings live in Firestore now, so the container is fully
# stateless and safe to scale to zero.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://127.0.0.1:4000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
