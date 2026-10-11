# [BE-06] Inti Absensi: Scan Kiosk & Scan QR Personal

**Konteks:** `docs/BUSINESS-RULES.md` §2–§8 (WAJIB dipatuhi urutan validasinya), `docs/API-CONTRACT.md` bagian Attendance.

## Tugas
Implementasikan `POST /attendance/scan`, `POST /attendance/personal-scan`, dan `GET /attendance/me/today`.

## Spesifikasi
1. Pisahkan logika menjadi unit kecil yang mudah di-test:
   - `AttendanceRulesService` (murni, tanpa DB): `resolveAction()`, `isWithinCheckInWindow()`, `computeCheckInStatus()`, `computeCheckOutMetrics()`, `isWorkingDay()`
   - `AttendanceContextLoader`: memuat user + shift + holiday hari ini + leave approved hari ini + attendance hari ini (paralel, `Promise.all`)
   - `GeofenceService`: `assertInside(location, lat, lng, accuracy)` → kembalikan jarak
   - `DeviceBindingService`: `assertOrBind(user, deviceId)`
   - `ScanLogService`: catat setiap percobaan (berhasil/gagal) — panggil di blok `finally`/catch agar error pun tercatat
   - `AttendanceService.scanKiosk()` & `scanPersonal()` sebagai orkestrator
2. DTO `ScanKioskDto`: `qrToken` (string ≤ 200), `latitude`, `longitude` (number, rentang valid), `accuracy` (number ≥ 0), `deviceId` (UUID). `PersonalScanDto`: `qrToken`, `locationId`, `latitude`, `longitude`, `accuracy`.
3. Urutan validasi PERSIS §7. Pesan error ramah dalam Bahasa Indonesia, sertakan `details` (mis. `{ distance, radius }`, `{ opensAt }`, `{ minutesLeft }`).
4. CHECK_IN: hitung status `PRESENT`/`LATE` & `lateMinutes`, simpan `shiftSnapshot`, `checkInLat/Lng`, `kioskId`, `locationId`, method.
5. CHECK_OUT: validasi jeda minimal, hitung `earlyLeaveMinutes` & `workMinutes`, simpan koordinat pulang.
6. Simpan di `$transaction`; tangkap `P2002` (dua scan bersamaan) → 409 `ALREADY_CHECKED_IN`.
7. Rate limit `@Throttle` 10/menit untuk endpoint scan.
8. Respons `ScanResult` dengan `message` yang siap ditampilkan, contoh:
   - "Absen masuk berhasil pukul 07:52. Selamat bekerja!"
   - "Absen masuk berhasil pukul 08:22. Anda terlambat 7 menit."
   - "Absen pulang berhasil pukul 17:05. Total kerja 9 jam 13 menit."
9. `GET /attendance/me/today` → status lengkap untuk kartu beranda karyawan: `attendance`, `shift`, `isWorkingDay`, `holiday`, `leave`, `canCheckIn`, `canCheckOut`, `checkInOpensAt`.

## Kriteria Selesai
- [ ] Unit test `AttendanceRulesService` mencakup: tepat waktu, tepat di batas toleransi (masih PRESENT), 1 menit lewat toleransi (LATE dengan `lateMinutes` dihitung dari startTime), sebelum jendela dibuka, setelah endTime, checkout terlalu cepat, pulang cepat, hari Sabtu untuk shift Sen–Jum
- [ ] Unit test geofence: di dalam radius, di luar radius, akurasi buruk
- [ ] E2E: alur lengkap login karyawan → ambil token kiosk (via admin) → scan masuk → scan pulang → scan ketiga ditolak `ALREADY_CHECKED_OUT`
- [ ] Device binding: scan pertama mengikat device, device lain ditolak `DEVICE_MISMATCH`
- [ ] Setiap percobaan scan tercatat di `attendance_scan_logs`, termasuk yang gagal
