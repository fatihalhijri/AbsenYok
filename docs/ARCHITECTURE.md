# Arsitektur AbsenYok

## Gambaran Umum

```
┌────────────────────┐        ┌────────────────────┐
│  HP Karyawan (PWA) │        │  Layar Kiosk       │
│  /app/scan         │        │  /kiosk/[id]       │
│  kamera → baca QR  │        │  tampil QR dinamis │
└─────────┬──────────┘        └─────────┬──────────┘
          │ HTTPS                       │ HTTPS (polling 5 dtk)
          ▼                             ▼
┌──────────────────────────────────────────────────┐
│  Next.js (frontend)                              │
│  rewrites: /api/*  →  BACKEND_INTERNAL_URL/api/* │  ← satu origin, cookie aman
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│  NestJS (backend)  /api/v1                       │
│  Guards: JwtAuthGuard (global) → RolesGuard      │
│  Modules: auth, users, departments, shifts,      │
│  locations, kiosks, qr, attendance, leave,       │
│  holidays, reports, dashboard, audit, settings   │
│  Scheduler: cron harian (tandai alpa)            │
└───────────────────────┬──────────────────────────┘
                        ▼ Prisma
                ┌───────────────┐
                │   MySQL 8     │
                └───────────────┘
```

**Kenapa frontend mem-proxy API (rewrites)?** Agar browser melihat frontend & API di origin yang sama. Refresh token httpOnly cookie jadi first-party (tidak diblok browser), tidak perlu CORS rumit, dan middleware Next.js bisa membaca keberadaan cookie untuk redirect awal.

## Alur Autentikasi
1. `POST /auth/login` → backend mengembalikan `accessToken` (body) + set cookie `ay_rt` (refresh token, httpOnly, SameSite=Lax, path `/api/v1/auth`).
2. Frontend menyimpan `accessToken` **di memori** (Zustand, tidak di localStorage).
3. Setiap request: header `Authorization: Bearer <accessToken>`.
4. Saat 401 `TOKEN_EXPIRED` → interceptor memanggil `POST /auth/refresh` (cookie terkirim otomatis) → dapat access token baru → ulangi request. Request paralel diantrekan agar refresh hanya sekali.
5. Refresh token **dirotasi** setiap dipakai. Jika token lama dipakai lagi (reuse) → seluruh *family* token dicabut (indikasi pencurian) → user harus login ulang.
6. Saat app dibuka ulang → panggil `/auth/refresh` untuk memulihkan sesi.

## Alur Absen via Kiosk (mode utama)
1. Admin login di perangkat kiosk (tablet/TV) → buka `/kiosk/[kioskId]` (mode layar penuh).
2. Kiosk memanggil `GET /kiosks/:id/qr` → dapat `{ token, expiresAt, intervalSeconds }` → render QR + hitung mundur.
3. Karyawan membuka `/app/scan` → izinkan kamera & lokasi → pindai QR.
4. Frontend mengirim `POST /attendance/scan` berisi `qrToken`, `latitude`, `longitude`, `accuracy`, `deviceId`.
5. Backend memvalidasi berurutan (lihat `BUSINESS-RULES.md` bagian Validasi Scan) → menentukan CHECK_IN / CHECK_OUT → simpan → kembalikan hasil.
6. Setiap percobaan scan (berhasil/gagal) dicatat di `attendance_scan_logs`.

## Alur Absen via QR Personal (mode cadangan)
1. Karyawan membuka `/app/my-qr` → `GET /users/me/qr` → QR berganti tiap 60 detik.
2. Admin/petugas membuka `/admin/scan-personal` → pindai QR karyawan → `POST /attendance/personal-scan`.
3. Geofence memakai lokasi perangkat petugas; device binding karyawan tidak dicek (karena petugas yang memindai).

## Modul Backend & Tanggung Jawab
| Modul | Tanggung jawab |
|---|---|
| auth | login, refresh, logout, me, ganti password |
| users | CRUD karyawan/admin, reset device, upload avatar, QR personal |
| departments | CRUD departemen |
| shifts | CRUD shift kerja (jam masuk/pulang, toleransi, hari kerja) |
| locations | CRUD lokasi kantor + geofence |
| kiosks | CRUD kiosk, rotate secret, generate token QR |
| qr | service sign/verify token (tanpa controller) |
| attendance | scan, personal-scan, riwayat, hari ini, koreksi admin |
| leave-requests | pengajuan & approval izin/sakit/cuti |
| holidays | CRUD hari libur |
| reports | rekap bulanan, export XLSX/PDF |
| dashboard | statistik ringkas admin |
| audit-logs | pencatatan & pembacaan aktivitas sensitif |
| settings | pengaturan key-value (nama instansi, toggle geofence, dll) |
| scheduler | cron harian penandaan alpa & cuti |
