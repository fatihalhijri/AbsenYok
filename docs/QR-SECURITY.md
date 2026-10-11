# Desain Keamanan QR Code

## Tujuan
Mencegah titip absen: QR yang difoto/dikirim via WhatsApp tidak boleh bisa dipakai setelah beberapa detik, dan tidak bisa dipalsukan.

## A. Token QR Kiosk (dinamis, stateless)

**Format string di dalam QR:**
```
AY1.K.<kioskId>.<window>.<signature>
```
- `AY1` — versi format (memudahkan migrasi format di masa depan)
- `K` — tipe kiosk
- `kioskId` — UUID kiosk
- `window` — `floor(unixSeconds / intervalSeconds)` (interval default 30 detik)
- `signature` — `base64url( HMAC-SHA256( kiosk.secret, "AY1.K.<kioskId>.<window>" ) )`, dipotong 22 karakter pertama

**Verifikasi di backend:**
1. Parse, cek prefix `AY1.K.` dan jumlah bagian.
2. Ambil kiosk dari DB (cache in-memory 60 detik boleh).
3. Hitung `currentWindow`. Terima jika `window ∈ { currentWindow, currentWindow − 1 }` (toleransi jeda jaringan/jam). Selain itu → `QR_EXPIRED`.
4. Hitung ulang signature dan bandingkan dengan **`crypto.timingSafeEqual`**. Tidak cocok → `QR_INVALID`.

**Kenapa stateless?** Tidak perlu menyimpan setiap token di DB, kiosk cukup polling. `kiosk.secret` (64 byte acak, hex) **tidak pernah** dikirim ke frontend. Endpoint `GET /kiosks/:id/qr` (ADMIN) menghitung token di server.

**Rotasi secret:** `POST /kiosks/:id/rotate-secret` → semua QR lama langsung tidak berlaku.

## B. Token QR Personal (karyawan)

```
AY1.P.<userId>.<window>.<signature>
```
- interval 60 detik, toleransi 1 window sebelumnya
- `signature = base64url(HMAC-SHA256(QR_SIGNING_SECRET, "AY1.P.<userId>.<window>"))` dipotong 22 karakter
- Anti-replay: setelah token personal dipakai, simpan `userId:window` di cache in-memory (TTL 120 detik). Token yang sama ditolak `QR_ALREADY_USED`.

## C. Lapisan Pertahanan Tambahan
| Lapisan | Mencegah |
|---|---|
| QR berganti 30 detik | foto QR dikirim ke teman di rumah |
| Geofence GPS + batas akurasi | absen dari luar kantor |
| Device binding | login akun teman di HP sendiri lalu scan |
| Rate limit scan | brute force token |
| Log scan gagal | deteksi pola kecurangan (laporan admin) |

> Catatan jujur: lokasi GPS dapat dipalsukan dengan aplikasi *fake GPS* pada perangkat yang di-root. Device binding + QR dinamis di lokasi fisik membuat kecurangan jauh lebih sulit, tetapi tidak mustahil. Untuk keamanan lebih tinggi, tambahkan selfie + verifikasi wajah (roadmap).

## D. Device ID di Frontend
- Dibuat sekali dengan `crypto.randomUUID()`, disimpan di `localStorage` key `ay_device_id` dan IndexedDB (cadangan).
- Jika user menghapus data browser → device berubah → admin harus melakukan **Reset Device** (`POST /users/:id/reset-device`).
