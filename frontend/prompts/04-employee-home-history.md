# [FE-04] Beranda & Riwayat Karyawan

**Konteks:** endpoint `GET /attendance/me/today`, `GET /attendance/me`, `GET /holidays`.

## Beranda `/app`
1. Salam dinamis: "Selamat pagi/siang/sore/malam, {nama depan}" + tanggal lengkap & **jam berjalan** (detik, zona APP_TIMEZONE).
2. **Kartu Status Hari Ini** (komponen utama, paling menonjol):
   - Belum absen & jendela dibuka → CTA besar "Scan Absen Masuk" → `/app/scan`
   - Belum dibuka → "Absen masuk dibuka pukul 07:00" + hitung mundur
   - Sudah masuk → jam masuk, StatusBadge, durasi kerja berjalan (live), CTA "Scan Absen Pulang"
   - Sudah pulang → ringkasan masuk/pulang/total jam kerja + pesan "Terima kasih, sampai jumpa besok!"
   - Hari libur / bukan hari kerja / sedang cuti → kartu informatif tanpa CTA
3. Info shift: nama shift, jam kerja, toleransi.
4. **Ringkasan bulan ini**: 4 StatCard mini (Hadir, Terlambat, Izin/Sakit, Alpa) + persentase kehadiran berupa progress ring.
5. 5 aktivitas terakhir + tautan "Lihat semua".
6. Banner "Pasang aplikasi" (tangkap event `beforeinstallprompt`; di iOS tampilkan instruksi "Bagikan → Tambahkan ke Layar Utama"); bisa ditutup & diingat.
7. Pull-to-refresh sederhana atau tombol refresh; `refetchOnWindowFocus` aktif untuk query today.

## Riwayat `/app/history`
1. `MonthPicker` di atas (default bulan berjalan).
2. Tab **Kalender** dan **Daftar**:
   - Kalender: grid bulan, setiap tanggal diberi titik/warna sesuai status, hari libur ditandai (nama libur di tooltip/tap), tap tanggal → bottom sheet detail (jam masuk/pulang, terlambat, pulang cepat, total kerja, lokasi/kiosk, catatan)
   - Daftar: kartu per hari, urut terbaru
3. Ringkasan bulan (summary dari API) di bagian atas.
4. Tombol "Unduh PDF" → `GET /reports/me/export?month=&format=pdf` (unduh blob).

## Kriteria Selesai
- [ ] Semua 6 kondisi kartu status tampil benar (uji dengan mengubah data seed / MSW)
- [ ] Jam & durasi live tidak menyebabkan re-render seluruh halaman (isolasi di komponen kecil)
- [ ] Tampilan rapi di layar 360 px
