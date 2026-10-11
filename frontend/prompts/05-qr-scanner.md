# [FE-05] Fitur Scan QR Absen (INTI APLIKASI)

**Konteks:** `docs/QR-SECURITY.md`, `docs/BUSINESS-RULES.md` §7, endpoint `POST /attendance/scan`.

## Tujuan UX
Dari membuka halaman sampai absen tercatat **< 5 detik**, dengan umpan balik yang sangat jelas, termasuk saat gagal.

## Spesifikasi
### Persiapan (`/app/scan`)
1. `lib/device-id.ts`: `getDeviceId()` — ambil dari `localStorage` `ay_device_id`, jika tidak ada buat `crypto.randomUUID()` dan simpan (+ cadangan di IndexedDB via `idb-keyval`).
2. `lib/geolocation.ts`: `getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })` dibungkus Promise + pesan error Indonesia untuk `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`.
3. **Mulai ambil lokasi segera saat halaman dibuka** (paralel dengan kamera) agar saat QR terbaca koordinat sudah siap. Gunakan `watchPosition` dan simpan posisi terbaik (akurasi terkecil); hentikan watch saat keluar halaman.
4. **Checklist izin** di atas kamera: ikon Kamera ✓/✗, Lokasi ✓/✗ + akurasi ("±12 m", merah bila > 100 m). Jika izin ditolak → panel panduan cara mengaktifkan izin (Android Chrome & iOS Safari) + tombol "Coba lagi".
5. Deteksi bukan HTTPS / kamera tidak tersedia → pesan jelas.

### Pemindai
6. Gunakan `@yudiel/react-qr-scanner`:
   - kamera belakang (`facingMode: 'environment'`), hanya format `qr_code`
   - viewfinder kotak dengan sudut ter-highlight + garis animasi scan
   - tombol **senter (torch)** bila didukung, tombol **ganti kamera**
   - `paused` setelah QR terbaca agar tidak memproses berulang
7. Validasi cepat di client: string harus diawali `AY1.K.` → jika bukan, toast "Ini bukan QR absensi AbsenYok" dan lanjutkan scan (jangan kirim ke server).

### Pengiriman
8. Saat QR valid terbaca: getar `navigator.vibrate(80)`, bunyi "beep" pendek (Web Audio API, tanpa file), overlay loading "Memproses absensi…".
9. Kirim `{ qrToken, latitude, longitude, accuracy, deviceId }`. Jika posisi belum ada, tunggu maksimal 8 detik untuk posisi pertama sebelum mengirim.
10. **Layar hasil** (full-screen sheet):
    - Sukses: animasi centang (CSS/SVG), judul "Absen Masuk Berhasil"/"Absen Pulang Berhasil", jam besar, StatusBadge, `message` dari server, tombol "Kembali ke Beranda" (auto-redirect 5 detik dengan progress)
    - Gagal: ikon silang, judul & pesan ramah sesuai `error.code`, plus **aksi spesifik**:
      | code | aksi |
      |---|---|
      | `QR_EXPIRED` / `QR_INVALID` | "Scan Ulang" (lanjutkan kamera) |
      | `OUTSIDE_GEOFENCE` | tampilkan jarak & radius, tips "Pastikan Anda berada di area kantor" |
      | `LOCATION_ACCURACY_LOW` | "Pindah ke dekat jendela/area terbuka", tombol "Perbarui lokasi" |
      | `DEVICE_MISMATCH` | "Hubungi admin untuk reset perangkat" |
      | `ALREADY_CHECKED_OUT` | tombol "Lihat Riwayat" |
      | `CHECKIN_WINDOW_CLOSED` | tampilkan jam buka dari `details` |
      | lainnya | pesan dari server + "Kembali" |
    - getar pola error `[100, 50, 100]`
11. Setelah sukses: `invalidateQueries` untuk `attendance.today` & `attendance.me`.
12. Offline → nonaktifkan scanner, tampilkan "Anda sedang offline. Absensi membutuhkan koneksi internet."
13. Matikan kamera saat tab disembunyikan (`visibilitychange`) dan saat unmount.

### Komponen yang dihasilkan (reusable untuk FE-09)
- `QrScannerView` (props: `onDecode`, `paused`, `validate?`)
- `ScanResultSheet`
- `usePreciseLocation()` hook
- `PermissionChecklist`

## Kriteria Selesai
- [ ] Uji di HP Android (Chrome) & iPhone (Safari) melalui HTTPS — kamera & lokasi berfungsi
- [ ] QR dari aplikasi lain ditolak di client tanpa request ke server
- [ ] Scan satu QR tidak mengirim lebih dari satu request
- [ ] Kamera benar-benar mati (lampu indikator padam) setelah meninggalkan halaman
- [ ] Semua kode error di tabel menampilkan aksi yang sesuai
