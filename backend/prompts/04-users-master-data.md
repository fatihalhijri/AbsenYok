# [BE-04] Users & Master Data (Departemen, Shift, Lokasi, Libur, Settings)

**Konteks:** `docs/API-CONTRACT.md` bagian Users & Master Data, `docs/BUSINESS-RULES.md` §1, §13.

## Tugas
Buat modul `users`, `departments`, `shifts`, `locations`, `holidays`, `settings`.

## Spesifikasi
### Users
- CRUD sesuai kontrak dengan paginasi, filter & pencarian (`name`, `email`, `employeeCode`).
- **Aturan hierarki**: ADMIN hanya boleh membuat/mengubah/menonaktifkan user ber-role `EMPLOYEE`. Hanya SUPER_ADMIN yang bisa mengelola ADMIN. Tidak ada yang bisa menonaktifkan/menghapus dirinya sendiri.
- Validasi relasi (`departmentId`, `shiftId`, `locationId`) harus ada & aktif.
- Nonaktifkan user → cabut seluruh refresh token-nya.
- `reset-device` → `boundDeviceId = null`, audit `DEVICE_RESET`.
- `reset-password` → hash baru, cabut token, audit.
- Avatar: simpan ke `UPLOAD_DIR/avatars/<uuid>.<ext>`, validasi mime nyata (cek magic bytes dengan `file-type`), maks 2 MB, kompres/resize 256×256 dengan `sharp`. Sajikan statis via `/uploads/*` (ServeStaticModule) dengan header `Cache-Control`.
- **Import XLSX** (`exceljs`): kolom `employeeCode, name, email, phone, position, departmentCode, shiftName, password`. Validasi semua baris dulu; jika ada error kembalikan daftar error per baris tanpa menyimpan apa pun; jika valid simpan dalam satu transaksi. Sediakan endpoint unduh template.
- Semua respons user memakai `select` aman (tanpa `passwordHash`, `failedLoginAttempts`, `lockedUntil`); tampilkan `hasBoundDevice: boolean` bukan device id mentah.

### Departments
- `code` uppercase, unik. DELETE ditolak (409) bila masih ada user aktif.

### Shifts
- Validasi `startTime`/`endTime` format `HH:mm`, `endTime > startTime`, `workDays` berisi angka 1–7 unik.
- Perubahan shift tidak mengubah absensi lama (sudah ada `shiftSnapshot`).

### Locations
- Validasi latitude −90..90, longitude −180..180, `radiusMeters` 10–5000.
- DELETE ditolak bila masih dipakai kiosk aktif.

### Holidays
- `GET /holidays?year=2026` bisa diakses semua role (dipakai kalender karyawan).
- Endpoint bulk `POST /holidays/bulk` untuk memasukkan banyak tanggal sekaligus.

### Settings
- `SettingsService.get<T>(key, fallbackEnv)` dengan cache in-memory, invalidasi saat update.
- `PATCH /settings` hanya SUPER_ADMIN, validasi whitelist key & tipe, audit `SETTING_UPDATED`.
- `GET /settings/public` (`@Public`) → `companyName`, `logoUrl`.

## Kriteria Selesai
- [ ] ADMIN gagal (403) membuat user role ADMIN; SUPER_ADMIN berhasil
- [ ] Import XLSX dengan 1 baris email duplikat → tidak ada data tersimpan, error menyebut nomor baris
- [ ] Upload file `.exe` yang di-rename `.jpg` ditolak
- [ ] Semua endpoint terdokumentasi di Swagger dengan contoh
