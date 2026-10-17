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

> Kamera di browser HP **hanya jalan di HTTPS**. Untuk uji di HP gunakan `npm run dev:https` atau tunnel (ngrok / Cloudflare Tunnel) — lihat [frontend/README.md](frontend/README.md#uji-kamera--gps-di-hp).
>
> Semua sekaligus dengan Docker: `docker compose --profile app up -d --build` → http://localhost:3000 (lihat [Deploy](#deploy)).

### Akun default hasil seed

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | superadmin@absenyok.id | Admin@12345 |
| ADMIN | admin@absenyok.id | Admin@12345 |
| EMPLOYEE | budi@absenyok.id | Karyawan@123 |

**Segera ganti password setelah deploy ke produksi.**

---

## Deploy

### Arsitektur produksi (domain tunggal)

```
Browser ──HTTPS──▶ reverse proxy (Caddy/Nginx) ──▶ frontend :3000 (Next.js standalone)
                    absen.perusahaan.co.id              │  /api/* & /uploads/* (rewrite)
                                                        ▼
                                                  backend :4000 ──▶ MySQL :3306
                                                  (jaringan internal, tidak dibuka publik)
```

- Satu domain, mis. `absen.perusahaan.co.id`, diarahkan reverse proxy ke **frontend** saja.
  Frontend mem-proxy `/api` & `/uploads` ke backend lewat jaringan internal Docker
  (`BACKEND_INTERNAL_URL=http://backend:4000`, ditanam saat build image frontend). Cookie refresh
  token tetap first-party, tanpa CORS.
- **HTTPS wajib**: kamera & geolocation hanya jalan di secure context. Di `backend/.env` set
  `COOKIE_SECURE=true`, `CORS_ORIGIN=https://absen.perusahaan.co.id`, `NODE_ENV=production`, dan
  secret acak panjang (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `QR_SIGNING_SECRET` — mis.
  `openssl rand -hex 64`). Frontend sudah mengirim HSTS & header keamanan lain.
- Backend mempercayai `X-Forwarded-For` dari jaringan privat (`trust proxy`), jadi IP klien asli
  tetap tercatat (rate limit login & audit log) selama reverse proxy meneruskan header itu.

Contoh **Caddy** (sertifikat Let's Encrypt otomatis; container Caddy di jaringan Compose yang sama):

```caddy
absen.perusahaan.co.id {
  encode zstd gzip
  reverse_proxy frontend:3000
}
```

Contoh **Nginx** (sertifikat dari certbot):

```nginx
server {
  listen 443 ssl http2;
  server_name absen.perusahaan.co.id;
  ssl_certificate     /etc/letsencrypt/live/absen.perusahaan.co.id/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/absen.perusahaan.co.id/privkey.pem;
  client_max_body_size 5m;               # unggah lampiran izin & avatar

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
server { listen 80; server_name absen.perusahaan.co.id; return 301 https://$host$request_uri; }
```

### Menjalankan dengan Docker Compose

```bash
cp backend/.env.example backend/.env       # isi nilai produksi (lihat di atas)
docker compose --profile app up -d --build  # MySQL + backend + frontend → http://localhost:3000
# Pertama kali: data awal (akun Super Admin dll.) dari mesin yang punya source & Node.js
cd backend && DATABASE_URL="mysql://absenyok:<password>@<host-db>:3306/absenyok" npm run seed
```

- Migrasi database dijalankan otomatis saat container backend start (`prisma migrate deploy`).
- Port 3306 sudah dipakai MySQL lokal? `MYSQL_PORT=3307 docker compose --profile app up -d`.
- Di server produksi: ganti password MySQL di `docker-compose.yml`, **jangan** publikasikan port
  3306/4000/8080 (hapus `ports` backend, MySQL & Adminer atau batasi ke `127.0.0.1`), dan ganti
  password akun seed segera setelah login pertama.
- Semua service punya healthcheck; status: `docker compose ps`.

### Backup MySQL harian (simpan 14 hari)

```bash
# /usr/local/bin/absenyok-backup.sh
set -euo pipefail
DIR=/var/backups/absenyok
mkdir -p "$DIR"
docker exec absenyok-mysql sh -c \
  'exec mysqldump --single-transaction --routines --triggers -uroot -p"$MYSQL_ROOT_PASSWORD" absenyok' \
  | gzip > "$DIR/absenyok-$(date +%F).sql.gz"
# File unggahan (lampiran izin, avatar) dari volume uploads
docker run --rm -v absenyok_uploads:/data -v "$DIR":/backup alpine \
  tar czf "/backup/uploads-$(date +%F).tar.gz" -C /data .
find "$DIR" -type f -mtime +14 -delete
```

```cron
# crontab -e  → setiap hari pukul 02:00
0 2 * * * /usr/local/bin/absenyok-backup.sh >> /var/log/absenyok-backup.log 2>&1
```

Uji pemulihan berkala: `gunzip -c absenyok-YYYY-MM-DD.sql.gz | docker exec -i absenyok-mysql
mysql -uroot -p<password> absenyok`. Simpan salinan backup di luar server (object storage).

### Monitoring & log

- **Health check**: `GET https://absen.perusahaan.co.id/api/v1/health` →
  `{ "status": "ok", "db": "up", "time": … }` (lewat proxy frontend). Pasang di uptime monitor
  (Uptime Kuma, Better Stack, dll.) dengan interval 1 menit.
- **Log terpusat**: backend menulis log JSON (pino) ke stdout. Kumpulkan dengan driver logging
  Docker (mis. Loki/Promtail, Grafana Alloy, Fluent Bit, CloudWatch) atau minimal batasi ukuran:

  ```yaml
  # docker-compose.override.yml (produksi)
  services:
    backend:
      logging: { driver: json-file, options: { max-size: '20m', max-file: '5' } }
    frontend:
      logging: { driver: json-file, options: { max-size: '20m', max-file: '5' } }
  ```

- Pantau juga menu **Log Scan** (lencana "Perlu perhatian") & **Audit Log** di aplikasi.

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
