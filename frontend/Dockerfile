# syntax=docker/dockerfile:1
# Image produksi frontend AbsenYok (Next.js standalone + PWA).
#   Build : docker build --build-arg BACKEND_INTERNAL_URL=http://backend:4000 -t absenyok-frontend ./frontend
#   Jalan : docker compose --profile app up -d --build   (dari root repo)

ARG NODE_IMAGE=node:22-alpine
# Samakan dengan npm yang membuat package-lock.json (npm 10 bawaan Node 22 menolak lockfile npm 11).
ARG NPM_VERSION=11.6.2

# ---------------------------------------------------------------------------
# deps: seluruh dependensi (dev dibutuhkan untuk build: Tailwind, TypeScript, sharp, dll.).
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
ARG NPM_VERSION
WORKDIR /app
RUN apk add --no-cache libc6-compat && npm install -g npm@${NPM_VERSION} --no-audit --no-fund
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# build: next build (output standalone). Tujuan rewrite /api & /uploads ditetapkan SAAT BUILD,
# jadi BACKEND_INTERNAL_URL wajib benar di sini. NEXT_PUBLIC_* juga di-inline ke bundle browser.
# ---------------------------------------------------------------------------
FROM deps AS build
ARG BACKEND_INTERNAL_URL=http://backend:4000
ARG NEXT_PUBLIC_APP_NAME=AbsenYok
ARG NEXT_PUBLIC_APP_TIMEZONE=Asia/Jakarta
ARG NEXT_PUBLIC_API_BASE=/api/v1
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_TIMEZONE=${NEXT_PUBLIC_APP_TIMEZONE} \
    NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE} \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
# `prebuild` menyalin mesin ZXing WASM ke public/zxing (diserve sendiri, bukan CDN).
RUN npm run build

# ---------------------------------------------------------------------------
# runner: hanya server standalone + aset statis + public. Tanpa source & node_modules penuh.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Kode milik root (read-only bagi proses); cache optimizer gambar satu-satunya yang ditulis.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || exit 1

CMD ["node", "server.js"]
