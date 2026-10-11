# [FE-10] Testing, Optimasi & Deploy

## Testing
1. **Unit/komponen (Vitest + Testing Library + MSW)**:
   - `api-client`: refresh tunggal untuk request paralel, redirect saat refresh gagal
   - `StatusBadge`, kartu status beranda (6 kondisi), `ScanResultSheet` (sukses & tiap kode error)
   - util tanggal & perhitungan hari kerja di form izin
2. **E2E (Playwright)** terhadap backend + DB seed:
   - login karyawan → beranda → buka halaman scan (mock kamera dengan `--use-fake-device-for-media-stream` & `--use-file-for-fake-video-capture` berisi video QR, atau injeksi `onDecode` lewat test hook) → absen masuk sukses
   - login admin → setujui pengajuan → status berubah
   - admin export rekap → file terunduh
   - grant geolocation di context Playwright (`geolocation` + `permissions`)
3. Script: `test`, `test:watch`, `test:e2e`.

## Optimasi
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable.
- `next/dynamic` untuk komponen berat: scanner, recharts, leaflet, qrcode di halaman yang tidak membutuhkannya.
- `next/image` untuk avatar (konfigurasi `remotePatterns`/path lokal `/uploads`).
- Prefetch data beranda setelah login.
- Analisis bundle (`@next/bundle-analyzer`), pastikan library scanner tidak masuk bundle halaman admin lain.
- Error boundary per segmen (`error.tsx`) + `not-found.tsx` bergaya.

## Keamanan Frontend
- Header keamanan di `next.config.ts` (`Content-Security-Policy` yang mengizinkan kamera, tile OSM, dan font; `Permissions-Policy: camera=(self), geolocation=(self)`; `X-Frame-Options: DENY` kecuali bila diperlukan; `Referrer-Policy`).
- Tidak pernah merender HTML dari server tanpa sanitasi.

## Deploy
- `output: 'standalone'` di `next.config.ts`.
- `Dockerfile` multi-stage (deps → build → runner `node:22-alpine` atau LTS terbaru, user non-root, salin `.next/standalone`, `.next/static`, `public`), terima build arg `BACKEND_INTERNAL_URL`.
- `.dockerignore`.
- CI `.github/workflows/frontend.yml`: install → lint → typecheck → test → build.
- `frontend/README.md`: setup, script, struktur folder, cara uji kamera di HP (HTTPS/tunnel), cara generate tipe API.

## Panduan Produksi (tulis di README root, bagian Deploy)
- Domain tunggal, mis. `absen.perusahaan.co.id` → reverse proxy (Nginx/Caddy) ke frontend; frontend mem-proxy `/api` ke backend internal.
- HTTPS wajib (kamera & geolocation), `COOKIE_SECURE=true`.
- Backup MySQL harian (`mysqldump` terjadwal) + simpan 14 hari.
- Monitoring: health check `/api/v1/health`, log terpusat.

## Kriteria Selesai
- [ ] Semua test hijau di CI
- [ ] Skor Lighthouse memenuhi target
- [ ] `docker compose --profile app up -d --build` menjalankan aplikasi lengkap di `http://localhost:3000`
