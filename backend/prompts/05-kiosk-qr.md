# [BE-05] Kiosk & Token QR Dinamis

**Konteks:** `docs/QR-SECURITY.md` (WAJIB dibaca penuh), `docs/API-CONTRACT.md` bagian Kiosks & `/users/me/qr`.

## Tugas
Buat modul `qr` (service murni, tanpa controller) dan modul `kiosks`.

## Spesifikasi
### QrService
```ts
generateKioskToken(kiosk: { id; secret; qrIntervalSeconds }, now?: Date): { token: string; expiresAt: Date; window: number }
verifyKioskToken(token: string): Promise<{ kioskId: string; window: number }>   // lempar QR_INVALID / QR_EXPIRED / KIOSK_INACTIVE
generatePersonalToken(userId: string, now?: Date): { token; expiresAt; window }
verifyPersonalToken(token: string): { userId: string; window: number }           // + anti-replay QR_ALREADY_USED
markPersonalTokenUsed(userId: string, window: number): void
```
- Format & algoritma PERSIS seperti `QR-SECURITY.md` (prefix `AY1`, HMAC-SHA256, base64url, potong 22 karakter, toleransi 1 window).
- Gunakan `crypto.timingSafeEqual` (samakan panjang buffer dulu).
- `now` dapat diinjeksi agar mudah di-test.
- Cache kiosk (id → secret, interval, isActive, location) 60 detik; invalidasi saat kiosk diubah / rotate secret.
- Parser harus tahan input sembarang (string acak, URL, kosong, sangat panjang > 200 karakter) → `QR_INVALID`, tidak boleh crash.

### Kiosks
- CRUD sesuai kontrak. Respons TIDAK PERNAH memuat `secret`.
- Buat kiosk → generate secret 64 byte hex.
- `POST /kiosks/:id/rotate-secret` → secret baru, invalidasi cache, audit `KIOSK_SECRET_ROTATED`.
- `GET /kiosks/:id/qr` → token terkini + `expiresAt` + `serverTime` (agar layar kiosk bisa sinkronisasi hitung mundur meski jam perangkat beda), update `lastSeenAt` (maks sekali/menit agar tidak membebani DB).
- `GET /kiosks/:id/recent-scans` → 10 absensi berhasil terakhir di kiosk itu hari ini (nama, jam, tipe masuk/pulang, status).

### QR Personal
- `GET /users/me/qr` (EMPLOYEE) → `generatePersonalToken`.

## Kriteria Selesai
- [ ] Unit test QrService: token valid, window sebelumnya diterima, 2 window lalu → `QR_EXPIRED`, signature diubah 1 karakter → `QR_INVALID`, kiosk lain → `QR_INVALID`, setelah rotate secret → `QR_INVALID`, input sampah → `QR_INVALID`, replay token personal → `QR_ALREADY_USED`
- [ ] `secret` tidak muncul di respons endpoint mana pun (cek dengan test)
