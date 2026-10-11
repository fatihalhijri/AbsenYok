# [BE-02] Database: Prisma 7 + MySQL + Seed

**Konteks:** `docs/DATABASE.md`, `backend/prisma/schema.prisma`, `backend/prisma.config.ts`.

## Tugas
Hubungkan NestJS ke MySQL menggunakan Prisma ORM v7, buat migrasi awal dan seed data realistis.

## Spesifikasi
1. Install `prisma` (dev), `@prisma/client`, `@prisma/adapter-mariadb`, `dotenv`, `tsx`, `@faker-js/faker`.
   - Ikuti dokumentasi resmi Prisma v7 untuk MySQL (driver adapter). Jika API adapter berbeda dari contoh di bawah, **ikuti dokumentasi resmi** dan sebutkan di jawaban.
2. **JANGAN mengubah model** di `schema.prisma`. Generator sudah diset `provider = "prisma-client"`, `output = "../src/generated/prisma"`, `moduleFormat = "cjs"`. Tambahkan `src/generated` ke `.gitignore`.
3. `PrismaService`:
   ```ts
   import { PrismaMariaDb } from '@prisma/adapter-mariadb';
   import { PrismaClient } from '@/generated/prisma/client';
   // constructor: super({ adapter: new PrismaMariaDb(<connection config dari DATABASE_URL>) })
   ```
   - implements `OnModuleInit` (`$connect`) dan `OnModuleDestroy` (`$disconnect`)
   - logging query lambat (> 500 ms) di dev
   - `PrismaModule` bersifat `@Global()`
4. Jalankan `docker compose up -d mysql` (dari root), lalu `npx prisma migrate dev --name init`.
5. `prisma/seed.ts` sesuai bagian **Data Seed** di `docs/DATABASE.md`:
   - idempotent (pakai `upsert` berdasarkan email/code/name)
   - password di-hash argon2id; password default dari `SEED_DEFAULT_PASSWORD`; karyawan contoh `Karyawan@123`
   - `kiosk.secret` = `crypto.randomBytes(64).toString('hex')`
   - absensi 30 hari terakhir: hanya hari kerja, ~75% PRESENT, ~12% LATE (lateMinutes 1–45), ~5% ABSENT, ~8% SICK/PERMIT; isi `shiftSnapshot`, `checkInMethod = KIOSK_QR`
   - beberapa `leave_requests` PENDING agar halaman approval terisi
   - isi tabel `settings` dengan key default
6. Lengkapi health check dengan `PrismaHealthIndicator` atau query `SELECT 1`.

## Kriteria Selesai
- [ ] `npx prisma migrate dev` sukses, semua tabel ada di MySQL (cek di Adminer `localhost:8080`)
- [ ] `npm run seed` bisa dijalankan dua kali tanpa error/duplikat
- [ ] `GET /api/v1/health` menampilkan `db: "up"`
- [ ] Tidak ada import dari `@prisma/client` lama yang salah path (semua dari `@/generated/prisma/...`)
