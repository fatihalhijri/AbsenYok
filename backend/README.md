# AbsenYok — Backend API

REST API aplikasi absensi QR Code AbsenYok: **NestJS 11 (CommonJS) + Prisma 7 + MySQL 8**.
Kontrak endpoint ada di [`docs/API-CONTRACT.md`](../docs/API-CONTRACT.md), aturan bisnis di
[`docs/BUSINESS-RULES.md`](../docs/BUSINESS-RULES.md).

- Prefix API: `/api/v1` · Swagger (non-produksi): `http://localhost:4000/api/docs`
- Health: `GET /health` dan `GET /api/v1/health` (cek koneksi database)

---

## 1. Setup lokal

Prasyarat: **Node.js ≥ 22**, **npm 11** (versi yang membuat `package-lock.json`), MySQL 8
(Docker atau Laragon/XAMPP).

```bash
# 1. Database (dari root repo) — MySQL 8.4 + Adminer (http://localhost:8080)
docker compose up -d mysql adminer

# 2. Dependensi & env
cd backend
npm install
cp .env.example .env          # lalu ganti JWT_*_SECRET & QR_SIGNING_SECRET dengan string acak:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 3. Prisma Client, migrasi, seed
npm run prisma:generate
npx prisma migrate deploy     # atau `npm run prisma:migrate` saat mengubah schema (development)
npm run seed                  # admin, shift, lokasi, kiosk, 10 karyawan + riwayat absensi

# 4. Jalankan
npm run start:dev
```

Akun hasil seed: `superadmin@absenyok.id` & `admin@absenyok.id` (password `SEED_DEFAULT_PASSWORD`),
karyawan `EMP001`–`EMP010` (password `Karyawan@123`).

### Database untuk test e2e

E2E memakai database terpisah **berakhiran `_test`** (dari `.env.test`, default `absenyok_test`).
Seluruh isinya di-reset (`prisma migrate reset --force`) sekali sebelum suite e2e berjalan, dan
setiap file test mengosongkan tabel sendiri. Buat sekali:

```sql
CREATE DATABASE absenyok_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON absenyok_test.* TO 'absenyok'@'%';   -- sesuaikan host user
```

Container MySQL dari `docker-compose.yml` hanya membuat database `absenyok`; jalankan SQL di
atas lewat Adminer/`docker exec` sebagai root. Urutan pemuatan env test: `.env.test` → `.env` →
`.env.example` (variabel lingkungan yang sudah ada selalu menang). Pengaman di
`test/e2e/test-db.ts` menolak berjalan pada database yang tidak berakhiran `_test`.

> Prisma CLI menolak `migrate reset` bila dijalankan oleh agen AI (mis. Claude Code) kecuali
> variabel `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` diisi oleh pengguna. Menjalankan
> `npm run test:e2e` sendiri di terminal atau di CI tidak terpengaruh.

---

## 2. Script npm

| Script                      | Fungsi                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `npm run start:dev`         | Development + watch (log pino-pretty)                                  |
| `npm run start:prod`        | Menjalankan hasil build (`node dist/main`)                             |
| `npm run build`             | Compile ke `dist/`                                                     |
| `npm run lint` / `lint:fix` | ESLint (type-checked) + Prettier                                       |
| `npm run format`            | Prettier untuk `src/` & `test/`                                        |
| `npm test`                  | Unit test (`test/unit`)                                                |
| `npm run test:cov`          | Unit test + coverage; **gagal bila target coverage tidak tercapai**    |
| `npm run test:e2e`          | E2E (`test/e2e`, butuh MySQL & database `_test`)                       |
| `npm run prisma:generate`   | Generate Prisma Client ke `src/generated/prisma` (wajib setelah clone) |
| `npm run prisma:migrate`    | `prisma migrate dev` (membuat migrasi baru)                            |
| `npm run seed`              | Isi data contoh (`prisma/seed.ts`)                                     |

Hook pre-commit (husky + lint-staged) menjalankan ESLint & Prettier pada file yang di-stage.

### Target coverage unit test

`coverageThreshold` di `package.json` (lines/statements/functions/branches ≥ 80%):
`src/modules/auth/`, `src/modules/qr/`, `src/modules/leave-requests/`, serta
`attendance-rules`, `geofence`, dan `device-binding` di `src/modules/attendance/`.
Coverage unit tidak menghitung file deklaratif (`*.module.ts`, `*.controller.ts`, `dto/`,
`entities/`) — controller diuji lewat e2e. Logika yang bergantung jam memakai `ClockService`
(di e2e diganti `FakeClock`) atau parameter `now`. Unit test hermetis: env diisi dari
`.env.example` (`test/unit/setup-env.ts`), bukan dari `.env` lokal, sehingga hasilnya sama
dengan CI.

---

## 3. Struktur modul

```
src/
├── main.ts / app.module.ts / app.setup.ts   ← bootstrap; app.setup dipakai juga oleh e2e
├── config/        env.schema.ts (zod), app.config.ts, logger.config.ts (pino + redact)
├── prisma/        PrismaService (@Global) + driver adapter mariadb
├── generated/     Prisma Client (di-.gitignore, hasil `prisma generate`)
├── common/        clock, constants (error codes), decorators (@Public/@Roles/@CurrentUser),
│                  exceptions, filters, guards, interceptors, pipes, swagger, utils, validators
└── modules/
    ├── auth/            login, refresh token rotation (cookie httpOnly), change password
    ├── users/           karyawan & admin, profil, avatar, import XLSX, kebijakan akses
    ├── departments/ shifts/ locations/ holidays/ settings/   master data
    ├── kiosks/ qr/      kiosk + token QR dinamis (HMAC) & QR personal
    ├── attendance/      scan, aturan masuk/pulang, geofence, device binding, riwayat, koreksi
    ├── leave-requests/  izin/sakit/cuti + lampiran terproteksi + approval
    ├── scheduler/       cron harian penandaan ABSENT
    ├── dashboard/ reports/ audit-logs/   statistik, export XLSX/PDF, audit
    └── health/
test/
├── unit/        test service & util (Prisma di-mock)
├── e2e/         alur HTTP lengkap ke database `_test`
└── factories/   pembuat data e2e (user, shift, lokasi, kiosk, absensi, pengajuan izin)
```

### Menambah modul baru

1. Buat folder `src/modules/<nama>/` berisi `<nama>.module.ts`, `<nama>.controller.ts`,
   `<nama>.service.ts`, `dto/` (input + pesan validasi Bahasa Indonesia + `@ApiProperty`) dan
   `entities/` (bentuk respons untuk Swagger).
2. Controller tipis: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiStandardErrors()`,
   `@Roles(...)` (tanpa `@Public()` semua endpoint wajib login), `ParseIdPipe` untuk `:id`.
3. Service: Prisma dengan `select` eksplisit (jangan bocorkan `passwordHash`/`secret`/`tokenHash`),
   operasi multi-tabel dalam `$transaction`, error lewat `BusinessException`/`error-factories`,
   waktu dari `ClockService` + helper `date.util.ts` (bukan `new Date()` mentah).
4. Endpoint ber-`:id` milik pengguna: verifikasi kepemilikan di service (lihat
   `LeaveRequestsService.assertCanView`) — jangan hanya mengandalkan role.
5. Daftarkan module di `src/app.module.ts`; tambahkan aksi audit bila mengubah data penting.
6. Tulis unit test (`test/unit/<nama>/`) dan e2e (`test/e2e/<nama>.e2e-spec.ts`, data via
   `test/factories`), lalu `npm run lint && npm run test:cov && npm run test:e2e`.
7. Perubahan schema Prisma, kontrak API, atau aturan bisnis wajib disebutkan di bagian
   "Perubahan Kontrak" dan disinkronkan dengan `docs/`.

---

## 4. Keamanan (OWASP API Top 10)

| Kontrol                    | Implementasi                                                                                                                                                                                            | Bukti test                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Object level authorization | Semua endpoint `:id` admin dibatasi `@Roles`; endpoint milik karyawan (`leave-requests/:id`, `/attachment`, `/cancel`) mengecek pemilik; ADMIN hanya boleh mengelola EMPLOYEE (`user-access.policy.ts`) | `security.e2e-spec.ts`, `users.e2e-spec.ts`                |
| Mass assignment            | `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, DTO create/update terpisah (`UpdateMeDto` tanpa role/status)                                                                          | `security.e2e-spec.ts`, `app.e2e-spec.ts`                  |
| Rate limiting              | Global `THROTTLE_LIMIT`/`THROTTLE_TTL_MS` per IP, login 5/menit per IP, scan 10/menit per user (personal-scan: per karyawan pemilik QR)                                                                 | `auth.e2e-spec.ts`, `attendance.e2e-spec.ts`               |
| Header & CORS              | `helmet`, CORS hanya origin di `CORS_ORIGIN` (+ credentials), `x-powered-by` dimatikan                                                                                                                  | `app.e2e-spec.ts`                                          |
| Ukuran body                | JSON/urlencoded maks **1 MB** (413 format standar), upload maks `MAX_UPLOAD_SIZE_MB` (2 MB) + cek magic bytes                                                                                           | `security.e2e-spec.ts`, `leave-attachment.storage.spec.ts` |
| Stack trace                | Hanya di `details` saat non-produksi; produksi → pesan generik                                                                                                                                          | `all-exceptions.filter.spec.ts`                            |
| Secret di log              | pino `redact` untuk header Authorization/Cookie/Set-Cookie dan field password/token/secret                                                                                                              | `logger-redact.spec.ts`                                    |
| Dependensi                 | `npm audit --omit=dev --audit-level=high` di CI; `overrides` untuk `mariadb`, `mysql2`, `deepmerge-ts`                                                                                                  | CI                                                         |
| SQL injection              | Hanya `$queryRaw` tagged template; `$queryRawUnsafe`/`$executeRawUnsafe` dilarang ESLint                                                                                                                | `npm run lint`                                             |

Sisa temuan `npm audit` (moderate, tanpa perbaikan non-breaking): `js-yaml` lewat
`@nestjs/swagger@11` (Swagger tidak aktif di produksi) dan `uuid` lewat `exceljs` (fungsi
yang rentan tidak dipakai).

Batasan yang perlu diketahui: throttler, cache kiosk, anti-replay QR personal, cache settings,
dan cache dashboard tersimpan **in-memory per proses** — gunakan Redis bila backend dijalankan
lebih dari satu instance.

---

## 5. Docker

```bash
# dari root repo: MySQL + backend (migrasi otomatis saat container start)
docker compose --profile app up -d --build backend
# seluruh stack (setelah Dockerfile frontend dibuat di FE-10)
docker compose --profile app up -d --build
```

- `Dockerfile` multi-stage `node:22-alpine`: `deps` (npm ci) → `build` (prisma generate,
  nest build, prune dev deps, buang file yang tidak dimuat runtime) → `runner`.
- `runner` hanya berisi `dist/`, `node_modules` produksi, `prisma/`, `prisma.config.ts`;
  berjalan sebagai user **`node`** (non-root), kode aplikasi read-only, hanya `/app/uploads`
  yang bisa ditulis (volume `uploads`).
- `docker-entrypoint.sh`: `npx prisma migrate deploy` lalu `exec node dist/main.js`.
- `HEALTHCHECK` ke `/api/v1/health` (gagal bila database tidak terjangkau).
- Ukuran image ±160 MB terkompresi (±545 MB setelah diekstrak; ±220 MB di antaranya CLI Prisma
  yang dibutuhkan `migrate deploy`).
- Compose memakai `backend/.env`; `DATABASE_URL` ditimpa ke host `mysql`. Bila port 3306 sudah
  dipakai MySQL lokal (Laragon/XAMPP), hentikan dulu atau hapus mapping `ports` service `mysql`.
- File `*.sh` wajib berakhiran baris LF (diatur `.gitattributes`).

## 6. CI

`.github/workflows/backend.yml` berjalan pada push/PR ke `main` yang mengubah `backend/**`:
service MySQL 8.4 (`absenyok_test`) → install (npm 11) → lint → prisma generate →
migrate deploy → unit test + coverage → e2e → build → audit dependensi produksi.
Secret JWT/QR dibangkitkan acak setiap run; laporan coverage diunggah sebagai artifact.

---

## 7. Troubleshooting

**Jam/tanggal absensi bergeser 7 jam**

- Semua `DateTime` disimpan UTC; logika harian memakai `APP_TIMEZONE` (default `Asia/Jakarta`).
  Kolom `@db.Date` berisi tanggal lokal.
- Sesi database dikunci ke UTC oleh adapter (`timezone: 'Z'`) — jangan mengubah zona sesi.
  Container MySQL di compose memakai `--default-time-zone=+00:00`.
- Saat membaca data langsung di Adminer, ingat kolom `checkInAt` dll. bernilai UTC.

**Tidak bisa terhubung ke MySQL**

- `ECONNREFUSED`/`P1001`: MySQL belum menyala atau host/port salah. Di Docker gunakan host
  `mysql`, dari host gunakan `localhost:3306`. Cek `docker compose ps` (status `healthy`).
- `RSA public key is not available client side` / `caching_sha2_password`: MySQL 8 tanpa TLS
  butuh `allowPublicKeyRetrieval`. Otomatis aktif di luar produksi; di produksi tambahkan
  `?allowPublicKeyRetrieval=true` ke `DATABASE_URL` (lebih baik aktifkan TLS).
- `Access denied`: periksa user/password & hak akses (`SHOW GRANTS FOR 'absenyok'@'%'`).
- `pool timeout`: tambah `?connection_limit=20&pool_timeout=10000` di `DATABASE_URL`.

**Error Prisma / driver adapter**

- `Cannot find module '.../generated/prisma/client'` → jalankan `npm run prisma:generate`.
- `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` → `.env` belum
  dibuat; `prisma.config.ts` memuatnya lewat `dotenv`.
- Prisma 7 tidak lagi menjalankan seed otomatis setelah `migrate reset`/`migrate dev` — jalankan
  `npm run seed` bila perlu. Flag `--skip-seed` sudah tidak ada.
- `P2034` (deadlock) saat scan bersamaan sudah dipetakan ke `ALREADY_CHECKED_IN/OUT`.
- Schema berubah tetapi tipe tidak ikut berubah: jalankan ulang `prisma generate` lalu restart
  `start:dev`.

**Container backend restart terus**

- Lihat `docker logs absenyok-backend`. Konfigurasi env yang salah dicetak sebagai daftar
  `Konfigurasi environment tidak valid`. Dengan `NODE_ENV=production`, secret contoh dari
  `.env.example` ditolak.
