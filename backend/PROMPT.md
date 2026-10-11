# PROMPT INDUK — Backend AbsenYok (NestJS + Prisma + MySQL)

> Baca dulu `../docs/00-MASTER-CONTEXT.md`. Prompt ini menjelaskan standar backend. Eksekusi fitur dilakukan lewat `prompts/01` … `prompts/10` secara berurutan.

## Tujuan
Membangun REST API production-ready untuk aplikasi absensi QR AbsenYok sesuai `docs/API-CONTRACT.md` dan `docs/BUSINESS-RULES.md`.

## Stack & Library
| Kebutuhan | Library |
|---|---|
| Framework | `@nestjs/core` (versi stabil terbaru), TypeScript strict |
| ORM | `prisma` + `@prisma/client` v7, driver adapter `@prisma/adapter-mariadb` |
| Config | `@nestjs/config` + validasi env dengan `zod` |
| Validasi DTO | `class-validator`, `class-transformer` |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `argon2`, `cookie-parser` |
| Keamanan | `helmet`, `@nestjs/throttler`, CORS ketat |
| Dokumentasi | `@nestjs/swagger` |
| Jadwal | `@nestjs/schedule` |
| Tanggal | `dayjs` + plugin `utc`, `timezone`, `isoWeek`, `customParseFormat` |
| Logging | `nestjs-pino` + `pino-pretty` (dev) |
| Export | `exceljs` (XLSX), `pdfmake` (PDF) |
| Upload | `@nestjs/platform-express` (multer) + validasi mime & ukuran |
| Cache | `@nestjs/cache-manager` (in-memory) |
| Health | `@nestjs/terminus` |
| Test | `jest`, `supertest`, `@nestjs/testing` |
| Seed | `tsx`, `@faker-js/faker` |

## Struktur Folder (WAJIB diikuti)
```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── prisma.config.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── generated/prisma/          ← output Prisma Client (di-.gitignore)
│   ├── config/
│   │   ├── env.schema.ts          ← zod schema env
│   │   └── app.config.ts
│   ├── prisma/
│   │   ├── prisma.module.ts       ← @Global
│   │   └── prisma.service.ts
│   ├── common/
│   │   ├── constants/error-codes.ts
│   │   ├── decorators/            ← @Public, @Roles, @CurrentUser
│   │   ├── dto/pagination-query.dto.ts
│   │   ├── exceptions/business.exception.ts
│   │   ├── filters/all-exceptions.filter.ts
│   │   ├── guards/                ← jwt-auth.guard.ts, roles.guard.ts
│   │   ├── interceptors/transform-response.interceptor.ts
│   │   ├── types/                 ← JwtPayload, AuthUser
│   │   └── utils/                 ← date.util.ts, geo.util.ts, paginate.util.ts, time.util.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── departments/
│   │   ├── shifts/
│   │   ├── locations/
│   │   ├── holidays/
│   │   ├── settings/
│   │   ├── kiosks/
│   │   ├── qr/
│   │   ├── attendance/
│   │   ├── leave-requests/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── audit-logs/
│   │   ├── scheduler/
│   │   └── health/
│   └── uploads/ (runtime, di-.gitignore — sebenarnya di root ./uploads)
└── test/
    ├── unit/
    └── e2e/
```
Setiap modul: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, dan bila perlu `entities/` (response class untuk Swagger).

## Standar Kode
1. **Controller tipis**, semua logika di service. Service tidak mengakses `Request` langsung.
2. **DTO** untuk setiap input, dengan dekorator Swagger (`@ApiProperty`) dan pesan validasi Bahasa Indonesia.
3. **Error bisnis** dilempar via `BusinessException(code, message, status, details?)`; filter global mengubahnya ke format standar.
4. **Prisma**: gunakan `select` eksplisit agar `passwordHash`, `secret`, `tokenHash` TIDAK PERNAH bocor ke respons. Operasi multi-tabel pakai `$transaction`.
5. **Tanggal**: gunakan helper `date.util.ts` (`nowInTz()`, `todayDate()`, `toDbDate()`, `combineDateAndTime()`); dilarang `new Date()` mentah untuk logika bisnis.
6. **Guard global**: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` (didaftarkan via `APP_GUARD`). Endpoint publik pakai `@Public()`.
7. **Swagger**: setiap endpoint punya `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth`, contoh respons.
8. **Logging**: jangan log password/token. Gunakan logger pino dengan `redact`.
9. **Testing**: unit test untuk service berlogika (auth, qr, attendance rules, leave), e2e untuk alur kritikal.

## Urutan Eksekusi
| # | File | Hasil |
|---|---|---|
| 01 | `prompts/01-setup-project.md` | Proyek NestJS, config, common layer |
| 02 | `prompts/02-database-prisma-seed.md` | Prisma 7 + MySQL + seed |
| 03 | `prompts/03-auth-jwt-rbac.md` | Login, refresh rotation, guard role |
| 04 | `prompts/04-users-master-data.md` | Users, departemen, shift, lokasi, libur, settings |
| 05 | `prompts/05-kiosk-qr.md` | Kiosk + token QR dinamis + QR personal |
| 06 | `prompts/06-attendance-scan.md` | Endpoint scan inti + semua validasi |
| 07 | `prompts/07-attendance-admin-scheduler.md` | Riwayat, koreksi, manual, cron alpa |
| 08 | `prompts/08-leave-requests.md` | Izin/sakit/cuti + approval + upload |
| 09 | `prompts/09-dashboard-reports-audit.md` | Statistik, export XLSX/PDF, audit |
| 10 | `prompts/10-testing-security-docker.md` | Test, hardening, Dockerfile, CI |
