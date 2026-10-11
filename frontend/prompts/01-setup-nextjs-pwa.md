# [FE-01] Setup Next.js, Tailwind, shadcn/ui & PWA

**Konteks:** `docs/00-MASTER-CONTEXT.md`, `frontend/PROMPT.md`.

## Tugas
Inisialisasi proyek di folder `frontend/` (file `.env.example` sudah ada, jangan ditimpa).

## Spesifikasi
1. `create-next-app` dengan TypeScript, App Router, Tailwind, ESLint, `src/` dir, alias `@/*`. Prettier + `prettier-plugin-tailwindcss`.
2. Inisialisasi shadcn/ui; tambahkan komponen: button, input, label, card, badge, dialog, sheet, dropdown-menu, select, tabs, table, skeleton, avatar, separator, calendar, popover, form, textarea, switch, tooltip, alert, progress, sonner.
3. **Proxy API** di `next.config.ts`:
   ```ts
   async rewrites() { return [
     { source: '/api/:path*', destination: `${process.env.BACKEND_INTERNAL_URL}/api/:path*` },
     { source: '/uploads/:path*', destination: `${process.env.BACKEND_INTERNAL_URL}/uploads/:path*` },
   ]}
   ```
4. **Validasi env** di `src/lib/env.ts` dengan zod.
5. **PWA (Serwist)** — ikuti dokumentasi resmi `@serwist/next` untuk versi Next.js yang dipakai:
   - `src/app/sw.ts`: precache aset build, runtime caching `CacheFirst` untuk font/gambar/ikon, `StaleWhileRevalidate` untuk `/api/v1/holidays` & `/api/v1/settings/public`, **NetworkOnly** untuk semua endpoint lain di `/api/*` (data absensi tidak boleh di-cache)
   - fallback dokumen offline → `/offline`
   - nonaktifkan SW saat `NODE_ENV=development`
   - `src/app/manifest.ts`: name "AbsenYok", short_name "AbsenYok", `display: standalone`, `start_url: /app`, `theme_color`, `background_color`, ikon 192/512 + maskable, `shortcuts` ke `/app/scan` ("Scan Absen")
   - meta `apple-mobile-web-app-capable`, `viewport` dengan `themeColor`
   - buat ikon placeholder sederhana (huruf "AY" di kotak berwarna primer) dalam PNG 192 & 512 dan versi maskable
6. Script `dev:https` = `next dev --experimental-https` (kamera HP butuh HTTPS).
7. Script `gen:api` = `openapi-typescript http://localhost:4000/api/docs-json -o src/types/api.d.ts`.
8. Halaman `/` redirect ke `/login`.

## Kriteria Selesai
- [ ] `npm run dev` jalan, `fetch('/api/v1/health')` dari browser berhasil melalui proxy
- [ ] `npm run build && npm start` → Lighthouse kategori PWA: installable
- [ ] Mode pesawat → halaman `/offline` tampil
- [ ] `src/types/api.d.ts` ter-generate
