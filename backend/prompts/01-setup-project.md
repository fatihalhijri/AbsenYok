# [BE-01] Setup Proyek NestJS & Lapisan Common

**Konteks:** baca `docs/00-MASTER-CONTEXT.md` dan `backend/PROMPT.md`.

## Tugas
Inisialisasi proyek NestJS di folder `backend/` (folder `prisma/`, `prisma.config.ts`, dan `.env.example` sudah ada — JANGAN ditimpa).

## Spesifikasi
1. Buat proyek NestJS (npm, TypeScript strict: `strict`, `noImplicitAny`, `strictNullChecks`). Path alias `@/*` → `src/*`.
2. ESLint + Prettier (single quote, trailing comma, printWidth 100). Husky + lint-staged untuk pre-commit lint.
3. **Config**: `src/config/env.schema.ts` memvalidasi SEMUA variabel di `.env.example` menggunakan zod (coerce number/boolean). Aplikasi gagal start dengan pesan jelas bila env tidak valid. Ekspos via `ConfigService` bertipe.
4. **main.ts**:
   - global prefix `api/v1` (kecuali `/health` boleh juga di `api/v1/health`)
   - `helmet()`, `cookie-parser`, CORS dari `CORS_ORIGIN` dengan `credentials: true`
   - `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` dengan `exceptionFactory` yang menghasilkan `VALIDATION_ERROR` + `details` per field
   - Swagger di `/api/docs` (hanya bila `NODE_ENV !== 'production'`), dengan `addBearerAuth()`
   - `app.enableShutdownHooks()`, `trust proxy` aktif
5. **Common layer**:
   - `error-codes.ts`: enum semua kode di `docs/API-CONTRACT.md`
   - `BusinessException`
   - `AllExceptionsFilter`: format error standar; map Prisma error `P2002` → 409 `CONFLICT`, `P2025` → 404 `NOT_FOUND`; error tak dikenal → 500 tanpa membocorkan stack di produksi
   - `TransformResponseInterceptor`: bungkus respons `{ success: true, data, meta? }`. Jika service mengembalikan `{ items, meta }`, ubah menjadi `data: items, meta`. Lewati untuk respons file (`StreamableFile`)
   - Decorators: `@Public()`, `@Roles(...roles)`, `@CurrentUser()`
   - `PaginationQueryDto` (`page`, `limit` maks 100, `sortBy`, `sortOrder`, `search`) + util `paginate()`
   - `date.util.ts` (dayjs + tz `APP_TIMEZONE`): `nowInTz()`, `todayDateString()`, `toDbDate(dateStr)` (→ Date UTC 00:00 untuk kolom @db.Date), `combineDateAndTime(dateStr, 'HH:mm')` (→ Date UTC), `isoWeekday()`, `diffMinutes()`
   - `geo.util.ts`: `haversineMeters(lat1, lng1, lat2, lng2)`
6. **Logger**: `nestjs-pino`, pretty di dev, JSON di prod, `redact` untuk `req.headers.authorization`, `req.headers.cookie`, `*.password`.
7. **Health**: modul `health` dengan `@nestjs/terminus` (cek DB menyusul di BE-02).
8. Script npm: `start:dev`, `build`, `start:prod`, `lint`, `test`, `test:e2e`, `prisma:generate`, `prisma:migrate`, `seed`.

## Kriteria Selesai
- [ ] `npm run start:dev` jalan, `GET /api/v1/health` → `{ success: true, data: { status: "ok" } }`
- [ ] Hapus satu env wajib → aplikasi berhenti dengan pesan error jelas
- [ ] `/api/docs` tampil
- [ ] Unit test `date.util` (konversi Jakarta↔UTC, pergantian hari pukul 00:00 WIB) & `geo.util` lulus
- [ ] `npm run lint` bersih
