# AbsenYok — Sistem Absensi Berbasis QR Code

AbsenYok adalah aplikasi web absensi (PWA) untuk perusahaan/instansi/sekolah. Karyawan melakukan absen masuk & pulang dengan **memindai QR Code dinamis** yang tampil di layar kiosk kantor, divalidasi dengan **lokasi GPS (geofence)** dan **device binding** agar tidak bisa dititipkan.

Folder ini berisi **blueprint + prompt bertahap** untuk membangun proyek secara profesional dengan bantuan AI coding assistant (Claude Code, Cursor, dll) atau sebagai panduan tim developer.

---

## Tech Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Backend | NestJS (TypeScript) | Modular, DI, guard/interceptor bawaan, cocok untuk skala tim |
| ORM | Prisma | Type-safe, migrasi terkelola, DX bagus |
| Database | MySQL 8.x | Sesuai kebutuhan, stabil, mudah di-hosting |
| Auth | JWT (access + refresh token rotation) + Role Guard | Aman, stateless, refresh token di httpOnly cookie |
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | SSR/CSR fleksibel, ekosistem besar |
| UI Kit | shadcn/ui + lucide-react + sonner | Komponen aksesibel & mudah dikustom |
| State/Data | TanStack Query + Zustand | Cache server-state + state auth ringan |
| Form | React Hook Form + Zod | Validasi type-safe |
| QR | `@yudiel/react-qr-scanner` (scan), `qrcode.react` (tampil) | Ringan, mendukung kamera belakang & torch |
| PWA | Serwist (`@serwist/next`) | Penerus next-pwa yang aktif dipelihara |
| Dokumentasi API | Swagger (`@nestjs/swagger`) | Kontrak API otomatis + generate tipe frontend |
| Infra | Docker Compose | MySQL + backend + frontend sekali jalan |

---

## Struktur Folder

```
AbsenYok/
├── README.md                    ← Anda di sini
├── docker-compose.yml           ← MySQL + Adminer (+ app, opsional)
├── .gitignore
├── docs/
│   ├── 00-MASTER-CONTEXT.md     ← WAJIB ditempel di awal setiap sesi AI
│   ├── ARCHITECTURE.md          ← Arsitektur & alur sistem
│   ├── BUSINESS-RULES.md        ← Aturan absensi (terlambat, shift, cuti, dll)
│   ├── DATABASE.md              ← Penjelasan tabel + ERD
│   ├── API-CONTRACT.md          ← Daftar endpoint & format respons
│   └── QR-SECURITY.md           ← Desain QR dinamis anti-titip-absen
├── backend/
│   ├── PROMPT.md                ← Prompt induk backend
│   ├── .env.example
│   ├── prisma/schema.prisma     ← Schema database siap pakai (tervalidasi)
│   └── prompts/                 ← 10 prompt bertahap (jalankan berurutan)
└── frontend/
    ├── PROMPT.md                ← Prompt induk frontend
    ├── .env.example
    └── prompts/                 ← 10 prompt bertahap (jalankan berurutan)
```

---

## Cara Menggunakan Prompt

1. Buka sesi baru di AI coding assistant **di dalam folder `AbsenYok/`**.
2. Tempelkan isi `docs/00-MASTER-CONTEXT.md` (atau minta AI membacanya) agar AI memahami seluruh proyek.
3. Kerjakan **backend dulu**: baca `backend/PROMPT.md`, lalu jalankan `backend/prompts/01-...` sampai `10-...` **satu per satu**.
4. Setelah setiap prompt: jalankan aplikasi, cek *Kriteria Selesai* di bagian bawah prompt, lalu commit (`git commit -m "feat(backend): ..."`).
5. Lanjut ke **frontend**: `frontend/PROMPT.md`, lalu `frontend/prompts/01-...` sampai `10-...`.
6. Jika AI menyimpang dari aturan, ingatkan: *"Patuhi docs/BUSINESS-RULES.md dan docs/API-CONTRACT.md."*

> Tips: Satu prompt = satu fitur = satu commit. Jangan gabungkan beberapa prompt sekaligus, hasilnya akan kurang rapi.

---

## Quick Start (setelah kode selesai dibuat)

```bash
# 1. Jalankan database
docker compose up -d mysql adminer

# 2. Backend
cd backend
cp .env.example .env            # isi secret dengan string acak panjang
npm install
npx prisma migrate dev
npm run seed
npm run start:dev               # http://localhost:4000/api/docs (Swagger)

# 3. Frontend
cd ../frontend
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

> Kamera di browser HP **hanya jalan di HTTPS**. Untuk uji di HP gunakan `next dev --experimental-https` atau tunnel (ngrok / Cloudflare Tunnel).

### Akun default hasil seed

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | superadmin@absenyok.id | Admin@12345 |
| ADMIN | admin@absenyok.id | Admin@12345 |
| EMPLOYEE | budi@absenyok.id | Karyawan@123 |

**Segera ganti password setelah deploy ke produksi.**

---

## Roadmap Fitur

**MVP (prompt 01–10)**
- Login, refresh token, logout, ganti password
- Manajemen karyawan, departemen, shift, lokasi kantor (geofence), kiosk
- QR dinamis di kiosk (berganti tiap 30 detik) + scan dari HP karyawan
- QR personal karyawan (mode cadangan: admin yang scan)
- Absen masuk/pulang otomatis, deteksi terlambat & pulang cepat
- Pengajuan izin/sakit/cuti + approval admin
- Hari libur, cron harian penanda alpa
- Dashboard statistik, rekap & export Excel/PDF
- Audit log, log scan gagal, PWA installable

**Pengembangan lanjutan (opsional)**
- Selfie saat absen + verifikasi wajah
- Notifikasi push (Web Push) pengingat absen
- Multi-tenant (banyak perusahaan dalam satu sistem)
- Integrasi payroll & lembur
- Realtime dashboard via WebSocket/SSE
