# PROMPT INDUK — Frontend AbsenYok (Next.js + Tailwind + PWA)

> Baca dulu `../docs/00-MASTER-CONTEXT.md` dan `../docs/API-CONTRACT.md`. Backend harus sudah berjalan. Eksekusi fitur lewat `prompts/01` … `prompts/10` berurutan.

## Tujuan
Membangun PWA responsif (mobile-first untuk karyawan, desktop-first untuk admin) dengan pengalaman scan QR yang cepat & jelas.

## Stack & Library
| Kebutuhan | Library |
|---|---|
| Framework | `next` (App Router, versi stabil terbaru), React, TypeScript strict |
| Styling | Tailwind CSS, `tailwind-merge`, `clsx`, `class-variance-authority` |
| Komponen | shadcn/ui (Radix), `lucide-react`, `sonner` (toast), `vaul` (drawer mobile) |
| Tema | `next-themes` (light/dark/system) |
| Data | `@tanstack/react-query` + devtools, `axios` |
| State | `zustand` (auth, preferensi UI) |
| Form | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Tabel | `@tanstack/react-table` |
| Grafik | `recharts` |
| Tanggal | `dayjs` (+ `utc`, `timezone`, locale `id`) |
| QR Scan | `@yudiel/react-qr-scanner` |
| QR Tampil | `qrcode.react` |
| PWA | `@serwist/next` + `serwist` |
| Tipe API | `openapi-typescript` (generate dari Swagger backend) |
| Test | `vitest`, `@testing-library/react`, `msw`, `@playwright/test` |

## Struktur Folder
```
frontend/
├── public/icons/                 ← ikon PWA 192, 512, maskable
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (employee)/app/       ← layout mobile + bottom nav
│   │   │   ├── page.tsx          ← Beranda
│   │   │   ├── scan/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── leave/page.tsx  (+ new/page.tsx)
│   │   │   ├── my-qr/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── (admin)/admin/        ← layout sidebar
│   │   │   ├── page.tsx          ← Dashboard
│   │   │   ├── attendance/  employees/  departments/  shifts/
│   │   │   ├── locations/  kiosks/  leave-requests/  holidays/
│   │   │   ├── reports/  scan-logs/  audit-logs/  settings/
│   │   │   └── scan-personal/
│   │   ├── kiosk/[kioskId]/page.tsx   ← layar penuh tanpa navigasi
│   │   ├── offline/page.tsx
│   │   ├── manifest.ts
│   │   ├── sw.ts                     ← service worker Serwist
│   │   ├── layout.tsx  providers.tsx  not-found.tsx  error.tsx
│   ├── components/
│   │   ├── ui/                   ← shadcn
│   │   ├── layout/               ← AppShell, BottomNav, Sidebar, Topbar
│   │   └── shared/               ← DataTable, PageHeader, EmptyState, StatusBadge, ConfirmDialog, DateRangePicker
│   ├── features/<fitur>/         ← api.ts, hooks.ts, schemas.ts, components/
│   ├── lib/                      ← api-client.ts, query-client.ts, date.ts, geolocation.ts, device-id.ts, error.ts, utils.ts
│   ├── stores/auth-store.ts
│   ├── types/api.d.ts            ← hasil openapi-typescript
│   └── middleware.ts             ← (Next.js 16+: proxy.ts)
```

## Standar
1. **Server Component default**; gunakan `'use client'` hanya untuk komponen interaktif. Halaman ber-data user di-render client-side via TanStack Query (karena token di memori).
2. **Tidak ada fetch langsung di komponen** — selalu lewat `features/*/api.ts` + hook `use…Query`/`use…Mutation`.
3. **Query key factory** per fitur (`attendanceKeys.me(month)` dll).
4. **Error**: helper `getErrorMessage(err)` membaca `error.message` dari format backend; toast via `sonner`.
5. **Aksesibilitas**: semua tombol ikon punya `aria-label`, kontras AA, fokus terlihat, target sentuh ≥ 44 px.
6. **Bahasa UI**: Indonesia, format tanggal `dayjs().locale('id')` (mis. "Senin, 12 Oktober 2026"), jam 24 jam.
7. **Responsif**: uji di 360 px, 768 px, 1280 px.
8. **Loading state** dengan Skeleton, **empty state** dengan ilustrasi ikon + ajakan aksi, **error state** dengan tombol coba lagi.

## Urutan Eksekusi
| # | File | Hasil |
|---|---|---|
| 01 | `prompts/01-setup-nextjs-pwa.md` | Proyek, Tailwind, shadcn, PWA, proxy API |
| 02 | `prompts/02-design-system-layout.md` | Tema, komponen dasar, layout karyawan & admin |
| 03 | `prompts/03-auth-api-client.md` | Login, token di memori, auto-refresh, proteksi route |
| 04 | `prompts/04-employee-home-history.md` | Beranda & riwayat karyawan |
| 05 | `prompts/05-qr-scanner.md` | Fitur scan QR absen (inti) |
| 06 | `prompts/06-myqr-leave-profile.md` | QR personal, izin/cuti, profil |
| 07 | `prompts/07-kiosk-display.md` | Layar kiosk QR dinamis |
| 08 | `prompts/08-admin-dashboard-master.md` | Dashboard admin & master data |
| 09 | `prompts/09-admin-attendance-leave-reports.md` | Kelola absensi, approval, laporan, scan personal |
| 10 | `prompts/10-testing-optimization-deploy.md` | Test, performa, Docker |
