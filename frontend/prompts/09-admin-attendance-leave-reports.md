# [FE-09] Kelola Absensi, Approval Izin, Laporan & Scan QR Personal

## Absensi `/admin/attendance`
1. Default: hari ini. Filter: rentang tanggal (maks 92 hari), departemen, status, pencarian.
2. Kolom: tanggal, karyawan (avatar, nama, NIP), departemen, jam masuk, jam pulang, terlambat (menit), total kerja, status, metode (ikon kiosk/QR personal/manual), aksi.
3. Klik baris → `Sheet` detail: info lengkap, mini-peta titik masuk/pulang vs radius lokasi, riwayat scan log hari itu, riwayat koreksi.
4. **Koreksi** (dialog): ubah jam masuk/pulang/status/catatan + **alasan wajib**; tampilkan preview hasil hitung ulang sebelum simpan.
5. **Tambah Manual**: pilih karyawan (combobox pencarian), tanggal, jam, status, alasan.
6. Tombol "Export Hari Ini" (XLSX/PDF).

## Izin & Cuti `/admin/leave-requests`
1. Tab: Menunggu (default, dengan badge jumlah), Disetujui, Ditolak, Semua.
2. Kartu/tabel: karyawan, tipe, rentang, hari kerja, alasan (dipotong, expand), lampiran (preview gambar di dialog / buka PDF di tab baru melalui endpoint terproteksi — unduh sebagai blob dengan token), tanggal pengajuan.
3. Aksi Setujui (catatan opsional) / Tolak (catatan wajib). Mendukung **pilih banyak + setujui massal**.
4. Optimistic update + rollback bila gagal.

## Laporan `/admin/reports`
1. Pilih bulan & departemen → tabel rekap per karyawan (kolom sesuai kontrak), baris total di bawah, sorting per kolom.
2. Tombol **Export Excel** dan **Export PDF** → unduh blob dengan nama file dari header `Content-Disposition`; tampilkan loading di tombol.
3. Grafik kecil persentase kehadiran per departemen.

## Log Scan `/admin/scan-logs`
- Default filter "Gagal". Kolom: waktu, karyawan, kiosk, kode error (badge), jarak, akurasi, device id (dipotong), IP.
- Sorot pola mencurigakan: karyawan dengan ≥ 3 `OUTSIDE_GEOFENCE`/`DEVICE_MISMATCH` hari ini (badge "Perlu perhatian").

## Audit Log `/admin/audit-logs` (SUPER_ADMIN)
- Tabel dengan filter aksi & aktor; baris dapat di-expand untuk melihat `metadata` (diff before/after yang mudah dibaca).

## Scan QR Personal `/admin/scan-personal`
1. Pilih lokasi (default lokasi kerja admin) → pakai ulang `QrScannerView` & `usePreciseLocation` dari FE-05.
2. Validasi client prefix `AY1.P.`.
3. Mode **scan beruntun**: setelah hasil tampil 2 detik, scanner otomatis aktif lagi (cocok untuk antrean karyawan). Daftar hasil sesi ini tampil di samping/bawah.
4. Hasil sukses/gagal memakai `ScanResultSheet` versi ringkas (nama karyawan, tipe, status).

## Kriteria Selesai
- [ ] Koreksi absensi tanpa alasan tidak bisa disimpan
- [ ] Export menghasilkan file dengan nama yang benar
- [ ] Setujui massal 10 pengajuan berhasil & daftar ter-update
- [ ] Scan beruntun 5 karyawan berturut-turut tanpa reload
