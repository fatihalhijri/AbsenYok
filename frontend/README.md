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

## Autentikasi & API client (FE-03)

- **Token**: access token hanya di memori (`stores/auth-store.ts`, Zustand tanpa persist); refresh
  token di cookie httpOnly `ay_rt` (path `/api/v1/auth`) yang dikelola browser.
- **`lib/api-client.ts`** (axios, `withCredentials`, timeout 15 dtk): header `Authorization`
  otomatis; 401 `TOKEN_EXPIRED` → satu `/auth/refresh` bersama untuk semua request paralel
  (single-flight) **dan** di-serialisasi antar-tab dengan Web Locks — refresh token dirotasi dan
  pemakaian ulang token lama dianggap pencurian oleh backend (seluruh sesi dicabut). Refresh ditolak
  (401/403) → sesi dihapus & ke `/login?next=…`; offline/5xx → sesi dipertahankan.
  Helper `api.get/post/patch/put/delete` mengembalikan `body.data`; `api.page` → `{ items, meta }`.
  Semua error menjadi `ApiError { code, message, status, details }` (`lib/error.ts`).
- **Bootstrap**: `AuthBootstrap` (di `providers.tsx`) memanggil refresh sekali saat app dimuat.
- **`src/proxy.ts`** (pengganti `middleware.ts` di Next 16): `/app`, `/admin`, `/kiosk` tanpa
  cookie `ay_session` → `/login?next=…`. Hanya redirect cepat; otorisasi tetap di backend.
- **`RoleGate`**: `(admin)` untuk SUPER_ADMIN/ADMIN, `(employee)` untuk EMPLOYEE; role lain
  diarahkan ke berandanya. Menu Sistem hanya SUPER_ADMIN.
- **Komponen**: `LoginView`/`LoginForm`, `ChangePasswordForm` + `PasswordStrength` (dipakai di
  profil FE-06), hook `useLogin`, `useLogout`, `useEndSession`, `usePublicSettings`.
- **Test**: `npm test` (Vitest + MSW) — termasuk "5 request paralel → 1 refresh".

## Beranda & riwayat karyawan (FE-04)

- **`/app`** (`features/attendance/components/employee-home.tsx`): salam + tanggal + jam berjalan,
  **kartu Status Hari Ini**, info shift, ringkasan bulan (4 stat + progress ring), 5 aktivitas
  terakhir, banner "Pasang aplikasi" (`beforeinstallprompt`; iOS → instruksi Bagikan → Tambahkan ke
  Layar Utama; bisa ditutup & diingat via `useLocalFlag`), tombol "Perbarui".
- **Kondisi kartu** diturunkan murni dari `/attendance/me/today` oleh `deriveTodayState()`
  (`features/attendance/today-status.ts`): `ready`, `not-open` (hitung mundur), `checked-in`
  (durasi live, CTA pulang / info jeda minimal), `checked-out`, `on-leave`, `holiday`,
  `non-working-day`, `no-shift`, `missed`.
- **Waktu live terisolasi**: hanya `LiveClock`/`LiveDuration`/`Countdown` yang berlangganan
  `useNow()` (satu timer bersama per interval, selaras pergantian detik) — kartu & halaman tidak
  ikut render ulang tiap detik. Selisih jam server−perangkat (`serverTime`) dipakai sebagai offset.
  Query today: `refetchOnWindowFocus` aktif; hitung mundur habis → refetch.
- **`/app/history?month=YYYY-MM`** (default bulan berjalan, maks bulan ini): ringkasan bulan,
  tab Kalender (titik warna status, libur merah, tap → bottom sheet detail termasuk lokasi/kiosk)
  dan Daftar (terbaru di atas), tombol **Unduh PDF** (`GET /reports/me/export`, blob + toast).
- **Test**: `today-status.test.ts` (semua kondisi) dan `today-status-card.test.tsx` (jsdom +
  Testing Library: render tiap kondisi, hitung mundur → `onRefresh` sekali, dan bukti isolasi —
  `deriveTodayState` tetap dipanggil 1× walau durasi berdetak).

## Scan QR absen (FE-05)

- **`/app/scan`** (`features/attendance/scan/scan-view.tsx`): lokasi mulai dipantau
  (`usePreciseLocation`, `watchPosition` akurasi tinggi, simpan posisi terbaik yang masih segar)
  bersamaan dengan kamera. Checklist izin Kamera/Lokasi (+ akurasi, merah bila > 100 m) dan panduan
  Android Chrome / iOS Safari + "Coba lagi" bila izin ditolak. Bukan HTTPS / tanpa kamera / offline →
  pemindai tidak dijalankan & pesan jelas.
- **`QrScannerView`** (dipakai ulang FE-09): `@yudiel/react-qr-scanner`, kamera belakang, hanya
  `qr_code`, viewfinder + garis animasi, tombol senter & ganti kamera buatan sendiri. Library
  dimuat lewat `next/dynamic` hanya di halaman ini. Kamera dilepas saat tab disembunyikan, saat
  dijeda, dan saat keluar halaman — stream di elemen video dihentikan sendiri (sekarang + 0,8 dtk +
  2,5 dtk) karena penghentian oleh library bersifat async/best-effort.
- **QR non-kiosk** (bukan `AY1.K.`) → toast "Ini bukan QR absensi AbsenYok", tidak dikirim.
  **1 QR = 1 request**: `useScanFlow` mengunci sampai "Scan Ulang". Posisi ditunggu maks 8 dtk.
- **`ScanResultSheet`**: sukses (centang SVG, jam besar, StatusBadge, pesan server, auto ke beranda
  5 dtk) atau gagal dengan aksi per `error.code` (`scan-errors.ts`, murni & teruji).
- **ZXing WASM** (polyfill BarcodeDetector untuk iOS Safari/Chrome desktop) dilayani dari
  `public/zxing/` — disalin dari `node_modules` oleh `scripts/copy-zxing-wasm.mjs` lewat
  `predev`/`prebuild` (di-gitignore), bukan dari CDN.
- **Uji di HP** (kamera & lokasi butuh HTTPS): `npm run dev:https -- --hostname 0.0.0.0`, lalu buka
  `https://<IP-laptop>:3000` dari HP di Wi-Fi yang sama (terima peringatan sertifikat).

## QR personal, izin/cuti & profil (FE-06)

- **`/app/my-qr`**: `QRCodeSVG` (≥ 260 px, `level="M"`, selalu hitam-di-atas-putih) + nama & NIP,
  hitung mundur berbentuk cincin (komponen terpisah). `useMyQr` mengambil token 3 dtk sebelum
  `expiresAt` dan sekali lagi tepat setelah jendela berganti (server memberi token per jendela
  berjalan; token jendela sebelumnya masih diterima), dikoreksi selisih jam dari `serverTime`.
  `placeholderData` menahan token lama selama memuat → QR berganti tanpa kedip.
  **Wake Lock** (`hooks/use-wake-lock.ts`): diminta saat halaman dibuka, diminta ulang saat tab
  terlihat lagi, dilepas saat keluar.
- **`/app/leave`**: kartu sisa cuti tahunan (progress), tab Semua/Menunggu/Disetujui/Ditolak,
  batalkan PENDING (ConfirmDialog), lihat lampiran (Blob dari endpoint terproteksi).
- **`/app/leave/new`**: kartu tipe, kalender rentang (libur merah, bukan hari kerja redup, > 7 hari
  ke belakang nonaktif), estimasi hari kerja live (`lib/working-days.ts`, divalidasi ulang server),
  alasan ≥ 10 karakter, lampiran: pilih file / **ambil foto** (`capture="environment"`) → foto
  dikompres di canvas (maks sisi 1600 px, kualitas 0.8) → divalidasi tipe & ≤ 2 MB **sebelum**
  upload (`features/leave/attachment.ts`); wajib bila Sakit > 1 hari kerja. Multipart dengan progres.
- **`/app/profile`**: avatar (pilih → crop persegi geser/zoom → 512×512 → upload), telepon
  (dialog, normalisasi sama dengan backend), shift, lokasi, status perangkat; menu Ganti Password
  (komponen FE-03), Tema, Pasang Aplikasi (`lib/install-prompt.ts`: `beforeinstallprompt` ditangkap
  sekali untuk banner beranda & menu), Tentang (versi dari `package.json`), Keluar.
- **Validasi instant-navigation (dev)**: `experimental.instantInsights.validationLevel =
'manual-warning'` di `next.config.ts`. Area `/app`/`/admin`/`/kiosk` baru dirender setelah sesi
  diverifikasi di browser (RoleGate), sehingga validasi otomatis per halaman tidak bisa merender
  halamannya di server dan memunculkan error dev di semua halaman.

## Catatan

- **Form** memakai komponen shadcn `field` + `Controller` dari React Hook Form + zod (pola resmi
  shadcn saat ini). Item registry `form` lama sudah tidak berisi file untuk style `radix-nova`.
- Komponen shadcn diimpor dari `@/components/ui/*`; util `cn` dari paket resmi `cn`
  (`@/lib/utils` me-re-export).
- `npm audit`: 5 temuan _high_ hanya di dependensi dev (`braces` lewat `eslint-config-next`, belum
  ada versi perbaikan); `npm audit --omit=dev` bersih.
