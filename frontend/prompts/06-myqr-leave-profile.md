# [FE-06] QR Personal, Izin/Cuti & Profil Karyawan

## QR Personal `/app/my-qr`
1. Ambil `GET /users/me/qr`, render `QRCodeSVG` besar (min 260 px, `level="M"`, margin cukup) dengan nama & NIP di bawahnya.
2. Hitung mundur berbentuk ring progress; ambil token baru 3 detik sebelum `expiresAt` (pakai selisih `serverTime` bila ada).
3. Naikkan kecerahan tidak bisa via web — tampilkan petunjuk "Naikkan kecerahan layar". Gunakan **Screen Wake Lock API** agar layar tidak mati selama halaman terbuka.
4. Teks penjelasan: "Tunjukkan QR ini ke petugas jika kiosk tidak tersedia."

## Izin & Cuti `/app/leave`
1. Kartu **Sisa Cuti Tahunan** (`/leave-requests/me/quota`) dengan progress bar.
2. Daftar pengajuan dengan filter status (Tab: Semua, Menunggu, Disetujui, Ditolak) — kartu menampilkan tipe, rentang tanggal, jumlah hari kerja, status, catatan admin.
3. Aksi "Batalkan" untuk PENDING (ConfirmDialog).
4. Halaman `/app/leave/new`:
   - pilih tipe (kartu pilihan: Sakit, Izin, Cuti Tahunan dengan ikon)
   - pilih rentang tanggal (kalender, tandai akhir pekan & libur, nonaktifkan > 7 hari ke belakang)
   - tampilkan estimasi hari kerja secara live (hitung di client dengan data libur + workDays shift; tetap divalidasi server)
   - alasan (min 10 karakter), lampiran (wajib bila Sakit > 1 hari) dengan preview gambar / nama file PDF, validasi ukuran ≤ 2 MB & tipe sebelum upload, opsi **ambil foto langsung** (`accept="image/*" capture="environment"`)
   - kompres gambar di client sebelum upload (maks sisi 1600 px, kualitas 0.8) memakai canvas
   - kirim multipart, tampilkan progress upload

## Profil `/app/profile`
1. Header: avatar (ubah foto: pilih/crop persegi sederhana → upload), nama, NIP, jabatan, departemen.
2. Info: email, telepon (editable), shift, lokasi kerja, status perangkat ("Perangkat terdaftar ✓").
3. Menu: Ganti Password (komponen FE-03), Tema (Terang/Gelap/Sistem), Pasang Aplikasi, Tentang Aplikasi (versi), Keluar.

## Kriteria Selesai
- [ ] QR personal berganti otomatis tanpa layar berkedip
- [ ] Layar tidak mati di halaman QR personal (Wake Lock) dan lock dilepas saat keluar
- [ ] Form izin menolak lampiran > 2 MB sebelum upload
