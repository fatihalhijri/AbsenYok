# [BE-09] Dashboard, Laporan & Export, Audit Log

**Konteks:** `docs/API-CONTRACT.md` bagian Dashboard & Reports, Audit Logs.

## Tugas
Buat modul `dashboard`, `reports`, dan controller `audit-logs`.

## Spesifikasi
### Dashboard (hari ini, zona APP_TIMEZONE)
- `summary`: `totalEmployees` (EMPLOYEE aktif yang punya shift & hari ini hari kerjanya), `present`, `late`, `onLeave`, `absent` (hanya terisi setelah cron, sebelum itu gunakan `notYetCheckedIn`), `attendanceRate`.
- `trend?days=30`: agregasi per tanggal dengan `groupBy(['date','status'])`, isi tanggal kosong dengan 0.
- `late-ranking?month=`: top 10 akumulasi `lateMinutes` + frekuensi terlambat.
- `recent-activity`: 20 absensi terbaru hari ini (nama, avatar, jam, masuk/pulang, status, kiosk).
- Cache respons 30 detik (`CacheInterceptor`) kecuali `recent-activity`.

### Reports
- `GET /reports/monthly?month=&departmentId=` → per karyawan: NIP, nama, departemen, hari kerja, hadir, terlambat, total menit terlambat, alpa, sakit, izin, cuti, total jam kerja, persentase kehadiran.
- **Export XLSX** (`exceljs`): sheet "Rekap" (tabel di atas, header tebal, freeze pane, autofilter, lebar kolom otomatis, format persen) + sheet "Detail Harian" (matriks karyawan × tanggal berisi kode H/T/A/S/I/C/L — legenda di bawah tabel). Judul berisi nama instansi & periode.
- **Export PDF** (`pdfmake`): A4 landscape, kop berisi nama instansi, tabel rekap, footer nomor halaman & tanggal cetak.
- `GET /reports/daily/export?date=&format=` → daftar absensi satu hari.
- `GET /reports/me/export?month=&format=pdf` → laporan kehadiran pribadi karyawan.
- Kirim file dengan `StreamableFile` + header `Content-Disposition: attachment; filename="rekap-absensi-2026-10.xlsx"`.
- Untuk data besar, stream baris per batch (jangan muat semua ke memori sekaligus).

### Audit Logs
- `GET /audit-logs` (SUPER_ADMIN) dengan filter & paginasi, include actor ringkas.

## Kriteria Selesai
- [ ] File XLSX terbuka rapi di Excel/LibreOffice dengan 2 sheet
- [ ] File PDF terbuka & tabel tidak terpotong untuk 31 hari
- [ ] Angka di dashboard cocok dengan data seed (tulis 1 e2e test yang membandingkan)
- [ ] EMPLOYEE tidak bisa mengakses endpoint dashboard/report admin (403)
