# Virtual Marketer — booking/contact API container.
FROM node:20-alpine AS build
WORKDIR /app
# better-sqlite3 compiles a native addon at install time.
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine
LABEL org.opencontainers.image.title="virtual-marketer-api" \
      org.opencontainers.image.description="Booking + contact-form API for virtual-marketer.de"

RUN addgroup -g 1001 -S api && adduser -u 1001 -S api -G api \
  && mkdir -p /data && chown -R api:api /data

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://127.0.0.1:4000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
