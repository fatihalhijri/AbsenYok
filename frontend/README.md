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

Env divalidasi zod di `src/lib/env.server.ts` saat `next.config.ts` dimuat (dev/build) — nilai salah langsung gagal
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
| `npm run build`                   | Build produksi (`output: standalone`) + service worker `public/sw.js` |
| `npm start`                       | Jalankan server standalone hasil build (sama dengan image Docker)     |
| `npm run lint` / `lint:fix`       | ESLint (`eslint-config-next` + Prettier)                              |
| `npm run typecheck`               | `next typegen` + `tsc --noEmit`                                       |
| `npm run format` / `format:check` | Prettier (+ urutan class Tailwind)                                    |
| `npm run gen:api`                 | Generate `src/types/api.d.ts` dari Swagger backend (backend harus on) |
| `npm run gen:icons`               | Generate ikon PWA & favicon dari SVG (`scripts/generate-icons.mjs`)   |
| `npm test` / `test:watch`         | Unit & komponen (Vitest + Testing Library + MSW)                      |
| `npm run test:e2e`                | E2E Playwright (lihat bagian Testing); laporan: `test:e2e:report`     |
| `npm run analyze`                 | Analisis bundle Turbopack (`next experimental-analyze`, UI web)       |

`dev:https` memakai sertifikat lokal yang dibuat Next.js (mkcert); saat pertama dijalankan
Windows dapat meminta izin memasang CA lokal. Untuk menguji dari HP di jaringan yang sama, buka
`https://<IP-laptop>:3000`.

## Proxy API

`next.config.ts` meneruskan `/api/*` dan `/uploads/*` ke `BACKEND_INTERNAL_URL`, sehingga browser
selalu memanggil origin yang sama (`/api/v1/...`): cookie refresh token `httpOnly` tetap
first-party dan tidak perlu CORS. Tujuan rewrite ditetapkan saat **build** — pada Docker,
`BACKEND_INTERNAL_URL` diberikan sebagai build arg.

## PWA (Serwist, mode Turbopack)

- Service worker: `src/app/sw.ts`, di-bundle esbuild oleh `scripts/build-sw.mjs` (`postbuild`)
  menjadi `public/sw.js` beserta daftar precache, lalu didaftarkan `SerwistProvider` di
  `src/app/providers.tsx` (nonaktif saat development). Route bawaan `@serwist/turbopack`
  (`/serwist/[path]`) tidak dipakai: dengan `cacheComponents` route itu tidak di-prerender dan
  mem-bundle `sw.ts` saat request — gagal (500) di server standalone/Docker tanpa source.
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
  Manifest (bagian _Installability_) atau ikon Install di address bar setelah `npm start`
  (diverifikasi FE-10 lewat CDP `Page.getInstallabilityErrors`: tanpa error).
- Menguji offline: DevTools → Application → Service workers → centang **Offline** (mengatur
  halaman sekaligus service worker), lalu buka halaman yang belum pernah dikunjungi.
- Setelah berpindah dari `npm start` ke `npm run dev` di port yang sama, service worker lama
  masih terpasang di browser: _Unregister_ lewat DevTools bila perubahan tidak muncul.

## Struktur folder

```
frontend/
├── e2e/                    ← Playwright: global-setup (data uji via API), spesifikasi, helper
├── public/                 ← ikon PWA, zxing/ (WASM, disalin prebuild), sw.js (hasil postbuild)
├── scripts/                ← copy-zxing-wasm, build-sw, start-standalone, generate-icons
├── src/
│   ├── app/                ← App Router: (auth)/login, (employee)/app/*, (admin)/admin/*,
│   │                         kiosk/[kioskId], offline, error.tsx, not-found.tsx, sw.ts
│   ├── components/         ← ui/ (shadcn), layout/ (shell, nav), shared/ (DataTable, dll.)
│   ├── features/<fitur>/   ← api.ts (query key + fetcher), hooks, schemas, components/, test
│   ├── hooks/ · lib/       ← util lintas fitur (api-client, date, env, geolocation, …)
│   ├── stores/             ← Zustand (auth, preferensi UI)
│   ├── types/              ← api.d.ts (openapi-typescript) + alias
│   └── proxy.ts            ← redirect awal ke /login bila tanpa penanda sesi
└── Dockerfile · .dockerignore · playwright.config.ts · next.config.ts
```

## Uji kamera & GPS di HP

Kamera dan Geolocation hanya jalan di _secure context_ (HTTPS atau `localhost`).

1. **LAN + HTTPS lokal**: `npm run dev:https`, lalu buka `https://<IP-laptop>:3000` di HP (satu
   Wi-Fi). Terima peringatan sertifikat (CA mkcert lokal belum dipercaya HP). Tambahkan IP laptop
   ke `allowedDevOrigins` di `next.config.ts` bila Next.js memblokir aset dev dari origin itu.
2. **Tunnel HTTPS publik** (sertifikat valid, cocok untuk iPhone): jalankan `npm run build`
   lalu `npm start` (atau `npm run dev`), kemudian mis. `cloudflared tunnel --url
http://localhost:3000` atau `ngrok http 3000`, dan buka URL `https://…` yang diberikan. Backend
   tetap diakses lewat proxy `/api` frontend, jadi cukup satu tunnel.
3. Pastikan izin Kamera & Lokasi untuk situs itu "Izinkan" dan GPS HP menyala. Device binding
   mengikat akun ke browser pertama yang dipakai scan — reset lewat admin bila berganti browser.

## Testing

- **Unit & komponen**: `npm test` (Vitest; `jsdom` per berkas lewat komentar
  `// @vitest-environment jsdom`, MSW untuk api-client). Mencakup api-client (refresh tunggal
  untuk request paralel & redirect saat refresh gagal), kartu status beranda, `StatusBadge`,
  `ScanResultSheet` (sukses & tiap kode error), util tanggal, hari kerja, dan logika fitur admin.
- **E2E (Playwright)** terhadap frontend + backend yang **sudah berjalan** dengan DB seed.
  Gunakan database uji — global setup membuat shift, karyawan & pengajuan baru setiap run.
  Langkah (dari folder `backend`, lalu `frontend`):

  ```bash
  # backend dengan DB uji (nama DB wajib berakhiran _test)
  npx prisma migrate reset --force && npm run seed && npm run build
  PORT=4100 DATABASE_URL="mysql://…/absenyok_test" node dist/main

  # frontend produksi yang mem-proxy ke backend uji
  BACKEND_INTERNAL_URL=http://localhost:4100 npm run build
  PORT=3100 npm start

  # E2E (Chrome terpasang; atau `npx playwright install chromium` sekali)
  E2E_BASE_URL=http://127.0.0.1:3100 E2E_API_URL=http://127.0.0.1:4100/api/v1 E2E_CHANNEL=chrome npm run test:e2e
  ```

  Skenario: karyawan login → beranda → scan QR kiosk (kamera tiruan: canvas berisi QR token kiosk
  asli disuntik lewat `addInitScript`, geolocation di-grant di context) → absen masuk sukses;
  admin menyetujui pengajuan → status berubah; admin export rekap → file Excel & PDF terunduh
  dengan nama dari server. Bisa juga dijalankan terhadap stack Docker
  (`E2E_BASE_URL=http://localhost:3000`, `E2E_API_URL=http://localhost:4000/api/v1`).

## Optimasi & keamanan (FE-10)

- **Lighthouse mobile** (build produksi, simulasi 4G + CPU 4×): `/login` 92–93, `/app` 96–97,
  `/app/scan` 93–96, `/admin` 96–97 (desktop 100). Accessibility, Best Practices & SEO 100.
- Halaman pembuka ringan: Zod tidak lagi di bundle awal (env publik divalidasi saat build di
  `lib/env.server.ts`; form login memakai validasi bawaan React Hook Form; skema lain mengimpor
  Zod lewat `lib/zod.ts`), `Toaster` dimuat setelah hydration, `TooltipProvider` hanya di area
  admin. Area ber-`RoleGate` dirender lewat `useDeferredValue` (render dicicil, tanpa satu long
  task besar). Di HP, grafik dashboard berada paling bawah dan baru dipasang saat terlihat.
- Komponen berat via `next/dynamic`: pemindai QR (ZXing), recharts (dashboard & laporan — grafik
  dashboard baru dipasang saat mendekati viewport), Leaflet; `qrcode.react` hanya di halaman QR.
  Library pemindai hanya ada di `/app/scan` & `/admin/scan-personal` (diverifikasi per rute).
- Halaman login di-prerender utuh (form ada di HTML statis); `?next=` dibaca saat dibutuhkan.
  Karyawan: data beranda di-prefetch tepat setelah login.
- Avatar lewat `next/image` (`getImageProps` + fallback inisial Radix), pola lokal
  `/uploads/avatars/**`.
- Error boundary per segmen (`error.tsx` root/app/admin/kiosk — kiosk mencoba pulih otomatis),
  `global-error.tsx`, dan `not-found.tsx`.
- **Header keamanan** (`next.config.ts`): CSP (`script-src 'self' 'unsafe-inline'
'wasm-unsafe-eval'` — nonce akan memaksa render dinamis & mematikan prerender Cache Components;
  tile OSM, `blob:`/`data:` untuk QR & lampiran), `Permissions-Policy` (kamera, lokasi, wake lock,
  fullscreen hanya `self`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, COOP, dan HSTS
  (produksi). Zod dijalankan mode `jitless` agar tidak memicu pelanggaran CSP `eval`.
- Tidak ada HTML mentah dari server: satu-satunya `dangerouslySetInnerHTML` adalah CSS variabel
  warna grafik dari konfigurasi statis (`components/ui/chart.tsx`).
- Bootstrap sesi melewati `/auth/refresh` bila penanda `ay_session` tidak ada (belum login) —
  tanpa request sia-sia & tanpa 401 di konsol.

## Docker

`Dockerfile` multi-stage (deps → build → runner `node:22-alpine`, user `node`, hanya
`.next/standalone` + `.next/static` + `public`, image ±350 MB, healthcheck `/login`). Build arg
`BACKEND_INTERNAL_URL` (default `http://backend:4000`) & `NEXT_PUBLIC_*`. Jalankan seluruh
aplikasi dari root repo: `docker compose --profile app up -d --build` → `http://localhost:3000`
(panduan produksi di [README root](../README.md#deploy)).

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

## Layar kiosk QR dinamis (FE-07)

- **`/kiosk/[kioskId]`** (tanpa navigasi, gelap paksa, `KioskGate` khusus ADMIN/SUPER_ADMIN): QR besar
  `level="H"` + logo di tengah dengan cincin hitung mundur & crossfade (kiri), jam server besar,
  nama kiosk/lokasi, dan **"Baru saja absen"** (kanan; portrait bertumpuk). Buka dari
  `/admin/kiosks` → **Buka Layar Kiosk** (tab baru), login sekali di perangkat kiosk.
- **Jadwal token** (`lib/qr-schedule.ts`, dipakai juga QR personal): diminta `expiresAt − 1 dtk` dan
  tepat setelah jendela berganti, dikoreksi offset `serverTime`. QR disembunyikan bila token mendekati
  batas sah (backend menerima jendela berjalan + sebelumnya) → tidak pernah menampilkan token basi.
- **Ketahanan** (`features/kiosk/use-kiosk-qr.ts`): gagal/offline → overlay "Koneksi terputus…" dan
  **QR disembunyikan**, coba lagi 2 → 4 → 8 → 16 → 30 dtk, pulih otomatis (event `online`/tab terlihat
  → langsung dicoba). Kiosk dihapus/nonaktif → "Kiosk tidak tersedia" (tetap dicek berkala). Sesi
  ditolak → "Sesi kiosk berakhir" (tidak dialihkan diam-diam ke login). Server tak terjangkau saat
  halaman dibuka → overlay + coba ulang otomatis. Wake Lock, layar penuh, kursor hilang setelah 3 dtk
  diam, reload penuh tiap 6 jam (menunggu online).
- **"Baru saja absen"**: polling 5 dtk, entri baru masuk dari atas & disorot 6 dtk, bunyi "ding" (bisa
  dimatikan; browser baru mengizinkan suara setelah ada klik — mis. tombol layar penuh/suara).

## Dashboard admin & master data (FE-08)

- **Tabel**: semua daftar memakai `DataTable` dengan paginasi & sort **server-side**; state
  (`page, limit, sortBy, sortOrder, search`, filter) disimpan di URL lewat `hooks/use-list-params.ts`
  (bisa di-refresh/dibagikan; `sortBy` di-whitelist sesuai `*_SORT_FIELDS` backend). Halaman
  wajib di dalam `<Suspense>`. Pengecualian: Hari Libur (endpoint per tahun, tanpa paginasi; tahun di
  `?year=`).
- **Mutasi**: `lib/mutation.ts` (`useToastMutation`) → toast sukses/gagal + invalidasi query; error
  validasi backend dipetakan ke field form (`applyServerFieldErrors`). Dialog memakai
  `hooks/use-dialog-target.ts` (target dipertahankan selama animasi tutup).
- **Dashboard `/admin`**: StatCard (tautan ke daftar terfilter), tren 30 hari (batang bertumpuk +
  tampilan tabel), donut status hari ini, Top 10 terlambat, aktivitas (refetch 15 dtk), pengajuan
  menunggu — tiap widget query & skeleton sendiri. Warna status (`--chart-present/leave/late/absent`)
  & urutannya divalidasi dengan validator palet dataviz (CVD & kontras, terang + gelap).
- **Karyawan**: filter departemen/role/status, Sheet tambah/ubah (role sesuai hak: ADMIN hanya
  Karyawan), reset password, reset perangkat, aktif/nonaktif, hapus (SUPER_ADMIN), **Import XLSX**
  (template, drag & drop, tabel error per baris). Detail `/admin/employees/[id]`.
- **Master data**: Departemen, Shift (input jam, chip Sen–Min, preview teks), Hari Libur (per tahun +
  "Tambah banyak" `YYYY-MM-DD;Nama`), Lokasi (**Leaflet** via `next/dynamic` `ssr:false`, klik peta,
  radius live, "lokasi saya"; penanda vektor), Kiosk (terakhir aktif relatif — merah > 5 menit, rotasi
  secret), Pengaturan (SUPER_ADMIN; hanya key yang berubah yang dikirim).
- **Tipe API**: `npm run gen:api` memakai `--default-non-nullable false` (field ber-default di DTO
  update tetap opsional).

## Absensi, izin/cuti, laporan & scan petugas (FE-09)

- **Absensi `/admin/attendance`**: default hari ini (membaca `?dateFrom&dateTo&status` dari tautan
  dashboard), rentang maks. 92 hari (`DateRangePicker maxDays`). Klik baris → Sheet detail (peta
  titik scan masuk/pulang/gagal vs radius lokasi, log scan hari itu, riwayat koreksi dari audit log).
  **Koreksi**: alasan wajib ≥ 10 karakter; preview hitung ulang di klien
  (`features/attendance/admin/correction.ts`) meniru `computeMetrics`/`assertTimes` backend dan
  memakai `shiftSnapshot` record; hanya field yang berubah yang dikirim (ISO berzona, mis.
  `…T07:55:00+07:00`). **Tambah Manual** memakai `UserCombobox` (pencarian server). "Export Hari Ini"
  → `/reports/daily/export` (XLSX/PDF).
- **Izin & Cuti `/admin/leave-requests`**: tab Menunggu (badge, sama dengan badge menu & dashboard —
  satu query bersama) / Disetujui / Ditolak / Semua; lampiran diunduh sebagai Blob bertoken (gambar →
  dialog, PDF → tab baru). Setujui (catatan opsional) / Tolak (alasan wajib ≥ 5). **Setujui massal**:
  `features/leave/admin/review.ts` — optimistic di semua daftar admin, request paralel maks. 4, hanya
  yang gagal di-rollback.
- **Rekap & Export `/admin/reports`**: tabel per karyawan (sort klien per kolom, baris total —
  persentase gabungan, bukan rata-rata persen), Export Excel/PDF dengan nama file dari
  `Content-Disposition`, grafik batang kehadiran per departemen (satu seri `--chart-present`, label
  nilai, tampilan tabel).
- **Log Scan `/admin/scan-logs`**: default hanya gagal; lencana "Perlu perhatian" untuk karyawan
  dengan ≥ 3 `OUTSIDE_GEOFENCE`/`DEVICE_MISMATCH` hari ini (`features/scan-logs/suspicious.ts`).
- **Audit Log `/admin/audit-logs`** (SUPER_ADMIN): filter aksi/aktor/entitas/tanggal; baris di-expand
  → diff sebelum/sesudah yang mudah dibaca (`features/audit-logs/diff.ts`).
- **Scan QR Personal `/admin/scan-personal`**: memakai ulang `QrScannerView` + `usePreciseLocation`;
  hanya token `AY1.P.` yang dikirim; **scan beruntun** aktif lagi 2 dtk setelah hasil
  (`usePersonalScan`), token yang sama diabaikan 90 dtk, token gagal dicoba ulang otomatis setelah
  8 dtk (atau langsung lewat "Scan ulang"); hasil memakai `ScanResultSheet variant="compact"`
  (panel bawah non-modal) + daftar hasil sesi.

## Catatan

- **Form** memakai komponen shadcn `field` + `Controller` dari React Hook Form + zod (pola resmi
  shadcn saat ini). Item registry `form` lama sudah tidak berisi file untuk style `radix-nova`.
- Komponen shadcn diimpor dari `@/components/ui/*`; util `cn` dari paket resmi `cn`
  (`@/lib/utils` me-re-export).
- `npm audit`: 5 temuan _high_ hanya di dependensi dev (`braces` lewat `eslint-config-next`, belum
  ada versi perbaikan); `npm audit --omit=dev` bersih.
