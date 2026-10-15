# syntax=docker/dockerfile:1
# Image produksi backend AbsenYok (NestJS + Prisma 7).
#   Build : docker build -t absenyok-backend ./backend
#   Jalan : docker compose --profile app up -d --build   (dari root repo)

ARG NODE_IMAGE=node:22-alpine
# Samakan dengan npm yang membuat package-lock.json (npm 10 bawaan Node 22 menolak lockfile npm 11).
ARG NPM_VERSION=11.6.2

# ---------------------------------------------------------------------------
# deps: seluruh dependensi (termasuk dev untuk build). Engine Prisma diunduh di sini
# sesuai platform Alpine (linux-musl).
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
ARG NPM_VERSION
WORKDIR /app
RUN apk add --no-cache openssl && npm install -g npm@${NPM_VERSION} --no-audit --no-fund
# HUSKY=0: hook git tidak dipasang di dalam image.
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# build: prisma generate + nest build, lalu buang dependensi dev.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# prisma.config.ts mewajibkan DATABASE_URL; generate tidak terhubung ke database.
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate \
  && npm run build \
  && npm prune --omit=dev --no-audit --no-fund \
  && npm cache clean --force
# Rampingkan node_modules (hanya bagian yang tidak pernah dimuat di runtime Alpine + MySQL):
# - query compiler WASM Prisma Client untuk provider selain MySQL,
# - varian sharp untuk glibc/wasm32 (Alpine memakai linuxmusl),
# - deklarasi tipe, source map & dokumentasi.
RUN find node_modules/@prisma/client/runtime -name '*.wasm-base64.*' ! -name '*mysql*' -delete \
  && rm -rf node_modules/@img/sharp-linux-x64 node_modules/@img/sharp-libvips-linux-x64 \
    node_modules/@img/sharp-wasm32 \
  && find node_modules -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \
    -o -name '*.map' -o -iname '*.md' \) -delete

# ---------------------------------------------------------------------------
# runner: hanya dist, node_modules produksi, prisma (migrasi) & prisma.config.ts.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/app/uploads

# Kode aplikasi milik root (read-only bagi proses); hanya folder uploads yang bisa ditulis user node.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
