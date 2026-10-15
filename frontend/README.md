# AbsenYok — Frontend (PWA)

PWA absensi QR Code: **Next.js 16 (App Router, Turbopack, Cache Components) + React 19 +
Tailwind CSS 4 + shadcn/ui + Serwist**. Panduan fitur ada di [`PROMPT.md`](PROMPT.md) dan
`prompts/01`–`10`.

## Setup

Prasyarat: Node.js ≥ 22, npm 11, backend berjalan di `http://localhost:4000`
(lihat [`../backend/README.md`](../backend/README.md)).

```bash
cd frontend
npm install
cp .env.example .env.local   # sesuaikan bila backend tidak di localhost:4000
npm run dev                  # http://localhost:3000
```

Env divalidasi zod di `src/lib/env.ts` saat `next.config.ts` dimuat — nilai salah langsung gagal
dengan pesan jelas.

| Variabel                   | Keterangan                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`     | Nama aplikasi (judul, manifest)                                   |
| `NEXT_PUBLIC_APP_TIMEZONE` | Zona waktu IANA tampilan tanggal (default `Asia/Jakarta`)         |
| `NEXT_PUBLIC_API_BASE`     | Path API di browser, relatif (default `/api/v1`)                  |
| `BACKEND_INTERNAL_URL`     | Alamat backend yang dilihat server Next.js (tujuan proxy/rewrite) |

## Script

| Script                            | Fungsi                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                     | Development (Turbopack). Service worker **tidak** aktif               |
| `npm run dev:https`               | Development via HTTPS (kamera HP butuh secure context)                |
| `npm run build` / `npm start`     | Build & jalankan produksi (service worker aktif)                      |
| `npm run lint` / `lint:fix`       | ESLint (`eslint-config-next` + Prettier)                              |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit`                                       |
| `npm run format` / `format:check` | Prettier (+ urutan class Tailwind)                                    |
| `npm run gen:api`                 | Generate `src/types/api.d.ts` dari Swagger backend (backend harus on) |
| `npm run gen:icons`               | Generate ikon PWA & favicon dari SVG (`scripts/generate-icons.mjs`)   |

`dev:https` memakai sertifikat lokal yang dibuat Next.js (mkcert); saat pertama dijalankan
Windows dapat meminta izin memasang CA lokal. Untuk menguji dari HP di jaringan yang sama, buka
`https://<IP-laptop>:3000`.

## Proxy API

`next.config.ts` meneruskan `/api/*` dan `/uploads/*` ke `BACKEND_INTERNAL_URL`, sehingga browser
selalu memanggil origin yang sama (`/api/v1/...`): cookie refresh token `httpOnly` tetap
first-party dan tidak perlu CORS. Tujuan rewrite ditetapkan saat **build** — pada Docker,
`BACKEND_INTERNAL_URL` diberikan sebagai build arg.

## PWA (Serwist, mode Turbopack)

- Service worker: `src/app/sw.ts`, di-bundle esbuild dan disajikan route
  `src/app/serwist/[path]/route.ts` di `/serwist/sw.js` (header `Service-Worker-Allowed: /`).
  Didaftarkan oleh `SerwistProvider` di `src/app/providers.tsx`, nonaktif saat development.
- Strategi cache (aturan pertama yang cocok dipakai):

  | Permintaan                                    | Strategi                         |
  | --------------------------------------------- | -------------------------------- |
  | `/api/v1/holidays`, `/api/v1/settings/public` | StaleWhileRevalidate             |
  | `/api/*` lainnya (data absensi, auth, dll.)   | **NetworkOnly** (tidak di-cache) |
  | Font                                          | CacheFirst (1 tahun)             |
  | Gambar & ikon                                 | CacheFirst (30 hari)             |
  | Aset/halaman Next.js lain                     | `defaultCache` Serwist           |

- Navigasi saat offline → halaman `/offline` (di-precache).
- Manifest: `src/app/manifest.ts` (`start_url: /app`, shortcut "Scan Absen" → `/app/scan`).
  Ikon "AY" placeholder di `public/icons/` (192, 512, maskable, apple-touch-icon) dibuat oleh
  `npm run gen:icons`; warna merek di `src/lib/brand.ts`.
- Lighthouse 12+ tidak lagi punya kategori "PWA". Cek installable lewat DevTools → Application →
  Manifest (bagian _Installability_) atau ikon Install di address bar setelah `npm start`.
- Menguji offline: DevTools → Application → Service workers → centang **Offline** (mengatur
  halaman sekaligus service worker), lalu buka halaman yang belum pernah dikunjungi.
- Setelah berpindah dari `npm start` ke `npm run dev` di port yang sama, service worker lama
  masih terpasang di browser: _Unregister_ lewat DevTools bila perubahan tidak muncul.

## Design system & layout (FE-02)

- **Token warna** di `src/app/globals.css` (light & dark): primer emerald (light: emerald-700 agar
  kontras AA dengan teks putih), `warning` amber, `destructive` rose, `success`, chart
  emerald/teal/amber/rose/sky. Radius `0.75rem`, bayangan lembut, ikon lucide stroke 1.75. Font
  Plus Jakarta Sans. Tema light/dark/system via `next-themes`.
- **Layout karyawan** `(employee)/app`: topbar + bottom nav 5 item (Scan bulat di tengah), padding
  `env(safe-area-inset-*)`; ≥ 768 px tampil terpusat maks 480 px.
- **Layout admin** `(admin)/admin`: sidebar shadcn collapsible (preferensi di Zustand persist
  `ay-ui`), Sheet di mobile, breadcrumb dari URL (`components/layout/admin-nav.ts`), grup Sistem
  hanya SUPER_ADMIN.
- **Komponen shared** `src/components/shared/`: `StatusBadge`, `PageHeader`, `DataTable`,
  `EmptyState`, `ErrorState`, `ConfirmDialog`, `DateRangePicker`, `MonthPicker`, `StatCard`.
- **DataTable** memakai **TanStack Table v9** (API `useTable` + `tableFeatures`). Definisikan kolom
  dengan `createDataTableColumnHelper<T>()` dan `helper.columns([...])`; meta kolom: `label`
  (menu Kolom), `className` (header & sel), `cellClassName` (sel saja). Sorting & paginasi
  server-side: masukkan state `pagination`/`sorting`/`search` ke query key TanStack Query.
- **Waktu & Cache Components**: Client Component tidak boleh membaca `new Date()` saat prerender.
  Pakai hook `useToday()` (`null` saat prerender, tanggal APP_TIMEZONE di browser) dan tampilkan
  skeleton selama `null`. Format tanggal Indonesia di `src/lib/date.ts` (dayjs, locale `id`).
- Halaman demo sementara: `/admin/_demo` (folder `%5Fdemo`, karena folder berawalan `_` adalah
  private folder di App Router) — dihapus di FE-08.

## Catatan

- **Form** memakai komponen shadcn `field` + `Controller` dari React Hook Form + zod (pola resmi
  shadcn saat ini). Item registry `form` lama sudah tidak berisi file untuk style `radix-nova`.
- Komponen shadcn diimpor dari `@/components/ui/*`; util `cn` dari paket resmi `cn`
  (`@/lib/utils` me-re-export).
- `npm audit`: 5 temuan _high_ hanya di dependensi dev (`braces` lewat `eslint-config-next`, belum
  ada versi perbaikan); `npm audit --omit=dev` bersih.
