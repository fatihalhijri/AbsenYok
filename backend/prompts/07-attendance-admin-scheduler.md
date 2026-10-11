# [BE-07] Riwayat, Koreksi Admin & Cron Harian

**Konteks:** `docs/BUSINESS-RULES.md` §5, §10, §11, `docs/API-CONTRACT.md` bagian Attendance.

## Tugas
Lengkapi modul attendance untuk kebutuhan riwayat & admin, serta modul `scheduler`.

## Spesifikasi
1. `GET /attendance/me?month=YYYY-MM` → daftar absensi bulan itu + `summary` (lihat kontrak). `attendanceRate` = (present + late) / hari kerja yang sudah lewat × 100, dibulatkan 1 desimal.
2. `GET /attendance` (admin) → paginasi, filter `dateFrom`, `dateTo` (maks rentang 92 hari), `userId`, `departmentId`, `status`, `search` (nama/NIP), include user ringkas (nama, NIP, departemen).
3. `GET /attendance/:id` → detail + scan log terkait (user & tanggal yang sama).
4. `POST /attendance/manual` → buat record untuk karyawan yang lupa absen; tolak bila record tanggal itu sudah ada (arahkan pakai PATCH). Method `MANUAL`, audit `ATTENDANCE_MANUAL_CREATED`.
5. `PATCH /attendance/:id` → koreksi dengan `reason` wajib (min 10 karakter); hitung ulang metrik dari `shiftSnapshot`; audit `ATTENDANCE_CORRECTED` berisi `before`/`after`/`reason`.
6. `GET /attendance/scan-logs` → untuk halaman "Log Scan Gagal" (deteksi kecurangan).
7. **Scheduler** (`@nestjs/schedule`, `@Cron('55 23 * * *', { timeZone: APP_TIMEZONE })`):
   - jalankan `AttendanceRecalculateService.run(date)` sesuai §10
   - batch 500 user, gunakan `createMany({ skipDuplicates: true })` untuk ABSENT
   - idempotent, log ringkasan `{ processed, created, updated, durationMs }`
   - cegah eksekusi ganda bila ada lebih dari satu instance: gunakan MySQL `GET_LOCK('absenyok_daily_cron', 0)` lewat `$queryRaw`
8. `POST /attendance/recalculate?date=` (SUPER_ADMIN) memanggil service yang sama; tolak tanggal di masa depan.

## Kriteria Selesai
- [ ] Menjalankan recalculate dua kali untuk tanggal sama tidak membuat duplikat
- [ ] Karyawan dengan cuti APPROVED tercatat LEAVE, bukan ABSENT
- [ ] Hari libur & akhir pekan dilewati
- [ ] Koreksi admin tercatat di audit log dengan nilai sebelum/sesudah
