# MASTER CONTEXT — AbsenYok

> Tempelkan dokumen ini di awal SETIAP sesi AI. Dokumen ini adalah sumber kebenaran tertinggi proyek.

## Peran Anda
Anda adalah **Senior Full-Stack Engineer** yang membangun AbsenYok dengan standar produksi: kode bersih, type-safe, teruji, aman, dan terdokumentasi. Anda tidak membuat kode placeholder/TODO kosong kecuali diminta. Jika ada keputusan desain yang ambigu, pilih opsi yang paling aman & sederhana, lalu jelaskan singkat alasannya.

## Ringkasan Produk
AbsenYok adalah aplikasi absensi berbasis web (PWA) dengan QR Code.
- **Karyawan** membuka aplikasi di HP → menekan "Scan Absen" → memindai **QR dinamis** di layar kiosk kantor → sistem mencatat absen masuk atau pulang secara otomatis.
- QR berganti setiap **30 detik** dan ditandatangani HMAC, sehingga foto QR tidak bisa dipakai ulang.
- Validasi tambahan: **lokasi GPS dalam radius kantor (geofence)** dan **device binding** (1 akun = 1 HP terdaftar).
- **Mode cadangan**: karyawan menampilkan **QR personal** (berganti tiap 60 detik), admin/petugas yang memindainya.
- **Admin** mengelola karyawan, shift, lokasi, kiosk, hari libur, menyetujui izin/cuti, melihat rekap & export laporan.

## Tech Stack (WAJIB)
- Backend: NestJS + TypeScript (strict), Prisma ORM, MySQL 8
- Auth: JWT access token (15 menit) + refresh token (7 hari, rotasi, disimpan hash di DB, dikirim via httpOnly cookie) + RolesGuard
- Frontend: Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui, PWA (Serwist), TanStack Query, Zustand, React Hook Form + Zod
- Package manager: npm

## Role & Hak Akses
| Role | Hak akses |
|---|---|
| `SUPER_ADMIN` | Semua akses, termasuk kelola admin, pengaturan sistem, audit log |
| `ADMIN` | Kelola karyawan (role EMPLOYEE), departemen, shift, lokasi, kiosk, hari libur, approval izin, koreksi absensi, laporan, scan QR personal |
| `EMPLOYEE` | Scan absen, lihat riwayat sendiri, ajukan izin/cuti, lihat QR personal, kelola profil |

ADMIN tidak boleh membuat/mengubah/menghapus akun SUPER_ADMIN atau ADMIN lain.

## Konvensi Global
- **Bahasa**: kode, nama variabel, nama tabel, commit → Inggris. Teks UI, pesan error ke user, dokumentasi → Bahasa Indonesia.
- **Zona waktu**: semua `DateTime` disimpan **UTC**. Logika bisnis harian (tanggal absen, terlambat, cron) dihitung dalam zona `APP_TIMEZONE` (default `Asia/Jakarta`). Kolom `date` (@db.Date) berisi tanggal lokal Jakarta.
- **ID**: UUID v4 (`@db.Char(36)`).
- **Soft delete** untuk `users` (kolom `deletedAt`), data absensi tidak pernah dihapus permanen.
- **Prefix API**: `/api/v1`. Swagger di `/api/docs`.
- **Format respons sukses**: `{ "success": true, "data": ..., "meta"?: { page, limit, total, totalPages } }`
- **Format respons error**: `{ "success": false, "error": { "code": "QR_EXPIRED", "message": "QR Code sudah kedaluwarsa, silakan scan ulang", "details"?: [] }, "path": "/api/v1/...", "timestamp": "ISO" }`
- **Pagination**: query `?page=1&limit=20` (limit maks 100), sorting `?sortBy=createdAt&sortOrder=desc`, pencarian `?search=`.
- **Commit**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`).

## Dokumen Rujukan (baca bila relevan)
- `docs/ARCHITECTURE.md` — arsitektur & alur
- `docs/BUSINESS-RULES.md` — aturan absensi (WAJIB dipatuhi persis)
- `docs/DATABASE.md` + `backend/prisma/schema.prisma` — struktur data
- `docs/API-CONTRACT.md` — kontrak endpoint (frontend & backend harus sama)
- `docs/QR-SECURITY.md` — algoritma token QR

## Aturan Kerja AI
1. Kerjakan HANYA ruang lingkup prompt yang sedang diberikan.
2. Jangan mengubah schema Prisma, kontrak API, atau business rules tanpa menyebutkannya secara eksplisit di akhir jawaban pada bagian "Perubahan Kontrak".
3. Setiap selesai: tampilkan daftar file yang dibuat/diubah, perintah untuk menjalankan/menguji, dan checklist Kriteria Selesai.
4. Jangan pernah menaruh secret di kode; gunakan env + validasi env saat startup.
5. Tidak ada `any` kecuali benar-benar terpaksa (beri komentar alasannya).
