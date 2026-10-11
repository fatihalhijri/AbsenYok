# [FE-08] Dashboard Admin & Master Data

**Konteks:** `docs/API-CONTRACT.md` bagian Dashboard, Users, Master Data, Kiosks.

## Dashboard `/admin`
1. Baris StatCard: Total Karyawan, Hadir, Terlambat, Izin/Cuti, Belum Absen — masing-masing dengan ikon & persentase; klik → ke `/admin/attendance` dengan filter terkait.
2. Grafik **Tren Kehadiran 30 hari** (recharts stacked bar/area: hadir, terlambat, alpa, cuti) dengan tooltip Bahasa Indonesia.
3. Donut komposisi status hari ini.
4. Tabel **Top 10 Terlambat** bulan ini.
5. Feed **Aktivitas Terkini** (refetch 15 detik).
6. Kartu "Pengajuan Menunggu" (jumlah + 5 terbaru + tombol tinjau).
7. Seluruh widget punya skeleton masing-masing (tidak menunggu satu sama lain).

## Karyawan `/admin/employees`
1. DataTable: avatar+nama, NIP, email, departemen, shift, role, status aktif (switch), perangkat (badge terdaftar/belum), aksi (dropdown).
2. Filter: departemen, role, status. Pencarian nama/NIP/email.
3. Tambah/Ubah via `Sheet` samping berisi form lengkap (zod sesuai DTO backend). Pilihan role hanya muncul sesuai hak (ADMIN hanya bisa EMPLOYEE).
4. Aksi: Ubah, Reset Password (dialog), **Reset Perangkat** (ConfirmDialog dengan penjelasan), Nonaktifkan/Aktifkan, Hapus (SUPER_ADMIN).
5. **Import XLSX**: dialog berisi tombol unduh template, drag & drop file, tampilkan hasil validasi per baris (tabel error) atau ringkasan sukses.
6. Halaman detail `/admin/employees/[id]`: profil + kalender kehadiran bulan ini + daftar pengajuan.

## Departemen, Shift, Hari Libur
- CRUD sederhana dengan Dialog form.
- Shift: input jam (`type="time"`), pilihan hari kerja berupa toggle chip Sen–Min, preview teks "Senin–Jumat, 08:00–17:00, toleransi 15 menit, absen dibuka 07:00".
- Hari Libur: tampilan daftar per tahun + tombol "Tambah Banyak" (bulk, textarea `YYYY-MM-DD;Nama`).

## Lokasi `/admin/locations`
- Form lokasi dengan **peta interaktif** memakai `leaflet` + `react-leaflet` (tile OpenStreetMap): klik peta untuk set titik, lingkaran radius tampil & berubah live saat slider radius digeser, tombol "Gunakan lokasi saya saat ini", input lat/lng manual tetap ada.
- Import dinamis (`next/dynamic`, `ssr: false`) untuk komponen peta.

## Kiosk `/admin/kiosks`
- Daftar kiosk: nama, lokasi, interval, status, "terakhir aktif" (relatif, mis. "2 menit lalu" — merah bila > 5 menit).
- Aksi: Ubah, Buka Layar Kiosk (tab baru), Rotasi Secret (ConfirmDialog: "QR yang sedang tampil akan langsung tidak berlaku"), Nonaktifkan.

## Pengaturan `/admin/settings` (SUPER_ADMIN)
- Form nama instansi, URL logo, toggle geofence & device binding, jeda minimal pulang, kuota cuti, maksimal rentang izin.

## Kriteria Selesai
- [ ] Semua tabel memakai paginasi & sorting server-side; state filter tersimpan di URL search params (bisa dibagikan/refresh)
- [ ] Mutasi menampilkan toast & meng-invalidasi query terkait
- [ ] Peta tidak error saat build (SSR dinonaktifkan untuk Leaflet)
- [ ] Hapus halaman `/admin/_demo`
