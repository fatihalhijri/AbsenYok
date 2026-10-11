# [BE-10] Testing, Hardening Keamanan, Docker & CI

## Tugas
Siapkan backend agar layak produksi.

## Spesifikasi
### Testing
1. Pastikan coverage unit test ≥ 80% untuk: `auth`, `qr`, `attendance` (rules, geofence, device), `leave-requests`.
2. E2E memakai database test terpisah (`DATABASE_URL` di `.env.test`, mis. `absenyok_test`), reset dengan `prisma migrate reset --force --skip-seed` sebelum suite, factory data helper di `test/factories/`.
3. Gunakan fake timer / injeksi `now` untuk test yang bergantung waktu.

### Hardening (checklist OWASP API Top 10)
- [ ] Broken Object Level Authorization: setiap endpoint `:id` memverifikasi kepemilikan/role
- [ ] Mass assignment: `whitelist + forbidNonWhitelisted`, DTO terpisah create/update
- [ ] Rate limiting global + khusus login & scan
- [ ] Header keamanan (helmet), CORS hanya origin terdaftar
- [ ] Batas ukuran body JSON 1 MB, upload 2 MB
- [ ] Tidak ada stack trace di respons produksi
- [ ] Secret tidak ter-log (cek redact pino)
- [ ] `npm audit --omit=dev` tanpa high/critical
- [ ] Query raw hanya `$queryRaw` dengan template literal (parameterized)

### Docker
- `Dockerfile` multi-stage (`node:22-alpine` atau LTS terbaru): stage `deps` → `build` (prisma generate + nest build) → `runner` (hanya `dist`, `node_modules` produksi, `prisma`, `prisma.config.ts`), user non-root, `HEALTHCHECK` ke `/api/v1/health`.
- `docker-entrypoint.sh`: `npx prisma migrate deploy` lalu `node dist/main.js`.
- `.dockerignore`.
- Pastikan `docker compose --profile app up -d --build` dari root berjalan.

### CI (GitHub Actions) `.github/workflows/backend.yml`
- Trigger push/PR ke `main` pada path `backend/**`
- Service MySQL 8.4, langkah: install → lint → prisma generate → migrate deploy → unit test → e2e test → build

### Dokumentasi
- `backend/README.md`: cara setup, daftar script, struktur modul, cara menambah modul baru, troubleshooting (timezone, koneksi MySQL, error Prisma adapter).

## Kriteria Selesai
- [ ] `npm run test:cov` memenuhi target coverage
- [ ] Image Docker < 300 MB dan berjalan sebagai non-root
- [ ] Pipeline CI hijau
