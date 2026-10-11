# [FE-07] Layar Kiosk QR Dinamis

**Konteks:** `docs/QR-SECURITY.md`, endpoint `GET /kiosks/:id/qr`, `GET /kiosks/:id/recent-scans`.

## Tujuan
Halaman `/kiosk/[kioskId]` ditampilkan di tablet/TV di pintu masuk kantor, berjalan berjam-jam tanpa disentuh.

## Spesifikasi
1. Hanya untuk ADMIN/SUPER_ADMIN (login sekali di perangkat kiosk). Tanpa sidebar/navigasi.
2. Layout landscape (dan tetap rapi di portrait):
   - **Kiri (60%)**: QR besar (setinggi ~70% layar) dengan logo/inisial di tengah (`imageSettings` qrcode.react, `level="H"`), ring hitung mundur di sekelilingnya, teks "Scan untuk absen menggunakan aplikasi AbsenYok"
   - **Kanan (40%)**: jam digital besar (HH:mm:ss) + tanggal lengkap, nama kiosk & lokasi, daftar **"Baru saja absen"** (10 terakhir, animasi masuk dari atas, avatar + nama + jam + badge Masuk/Pulang + status)
3. **Sinkronisasi waktu**: hitung offset `serverTime − Date.now()` dari respons; jadwalkan pengambilan token berikutnya tepat saat `expiresAt − 1 detik` (koreksi offset). Transisi QR dengan crossfade halus.
4. Polling `recent-scans` setiap 5 detik; bunyi "ding" lembut & highlight saat ada entri baru (bisa dimatikan).
5. **Ketahanan**:
   - Wake Lock API (minta ulang saat `visibilitychange`)
   - tombol layar penuh (`requestFullscreen`), sembunyikan kursor setelah 3 detik diam
   - jika fetch gagal: tampilkan overlay "Koneksi terputus, mencoba menghubungkan kembali…" dan **sembunyikan QR** (jangan tampilkan QR basi), retry dengan backoff (2, 4, 8, maks 30 dtk)
   - jika sesi habis (refresh gagal) → layar "Sesi kiosk berakhir, silakan login ulang"
   - reload penuh halaman otomatis setiap 6 jam (mencegah kebocoran memori)
6. Halaman pemilihan kiosk: di `/admin/kiosks` ada tombol "Buka Layar Kiosk" (tab baru).
7. Mode gelap paksa (kontras tinggi lebih nyaman di kiosk) — QR tetap hitam di atas putih.

## Kriteria Selesai
- [ ] QR berganti tepat setiap interval dan selalu bisa dipindai saat ditampilkan (tidak pernah menampilkan token kedaluwarsa)
- [ ] Cabut kabel jaringan → QR disembunyikan, sambungkan kembali → pulih otomatis
- [ ] Berjalan 1 jam tanpa kenaikan memori signifikan (cek DevTools Performance Monitor)
