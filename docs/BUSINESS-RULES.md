# Business Rules — AbsenYok

> Aturan ini WAJIB diimplementasikan persis. Angka yang ditandai *(setting)* dapat diubah lewat tabel `settings` / env.

## 1. Shift
- Setiap karyawan memiliki satu shift aktif (`users.shiftId`). Karyawan tanpa shift tidak bisa absen (error `NO_SHIFT_ASSIGNED`).
- Shift berisi: `startTime` ("08:00"), `endTime` ("17:00"), `lateToleranceMinutes` (default 15), `checkInOpenMinutes` (default 60), `workDays` ("1,2,3,4,5" = Senin–Jumat, format ISO: 1=Senin … 7=Minggu).
- Shift lintas tengah malam (mis. 22:00–06:00) **tidak didukung di MVP**; validasi `endTime > startTime`.

## 2. Tanggal Absensi
- Tanggal absen = tanggal lokal `APP_TIMEZONE` saat scan pertama (check-in).
- Satu karyawan hanya punya **satu record per tanggal** (`@@unique([userId, date])`).

## 3. Penentuan Masuk / Pulang (otomatis)
Saat karyawan scan:
- Belum ada record hari ini → **CHECK_IN**.
- Sudah check-in, belum check-out → **CHECK_OUT**.
- Sudah check-out → tolak `ALREADY_CHECKED_OUT`.

## 4. Jendela Waktu
- Check-in dibuka mulai `startTime − checkInOpenMinutes` sampai `endTime`. Di luar itu → `CHECKIN_WINDOW_CLOSED`.
- Check-out minimal **5 menit** setelah check-in *(setting `MIN_CHECKOUT_GAP_MINUTES`)* → jika kurang: `CHECKOUT_TOO_SOON`.
- Check-out boleh dilakukan sampai pukul 23:59 waktu lokal pada hari yang sama.

## 5. Status Kehadiran
| Status | Kapan |
|---|---|
| `PRESENT` | check-in ≤ `startTime + lateToleranceMinutes` |
| `LATE` | check-in > `startTime + lateToleranceMinutes`; `lateMinutes` = selisih dari `startTime` (bukan dari batas toleransi) |
| `ABSENT` | hari kerja, tidak ada check-in, tidak ada izin/cuti disetujui (diisi cron) |
| `SICK` / `PERMIT` / `LEAVE` | ada pengajuan disetujui (SICK/PERMIT/ANNUAL→LEAVE) |
| `HOLIDAY` | tidak dicatat per karyawan; hari libur cukup dari tabel `holidays` |

- `earlyLeaveMinutes` = `endTime − checkOutAt` jika pulang sebelum `endTime` (minimal 0).
- `workMinutes` = `checkOutAt − checkInAt` dalam menit.
- Simpan `shiftSnapshot` (JSON: name, startTime, endTime, lateToleranceMinutes) saat check-in, agar perubahan shift di kemudian hari tidak mengubah histori.

## 6. Hari Non-Kerja
- Jika hari ini bukan `workDays` shift karyawan → tolak `NOT_WORKING_DAY`.
- Jika tanggal ada di `holidays` → tolak `HOLIDAY`.
- Jika karyawan memiliki izin/cuti **APPROVED** yang mencakup tanggal ini → tolak `ON_LEAVE`.

## 7. Validasi Scan Kiosk (urutan WAJIB)
1. User aktif & tidak terhapus → else `ACCOUNT_INACTIVE`
2. Verifikasi tanda tangan & masa berlaku token QR (`QR-SECURITY.md`) → `QR_INVALID` / `QR_EXPIRED`
3. Kiosk aktif & lokasinya aktif → `KIOSK_INACTIVE`
4. Device binding (jika `DEVICE_BINDING_ENABLED=true`):
   - `boundDeviceId` kosong → ikat ke `deviceId` ini (catat audit `DEVICE_BOUND`)
   - berbeda → `DEVICE_MISMATCH`
5. Geofence (jika `GEOFENCE_ENABLED=true`):
   - `accuracy > GEOFENCE_MAX_ACCURACY_METERS` (default 100) → `LOCATION_ACCURACY_LOW`
   - jarak Haversine ke lokasi kiosk > `radiusMeters` → `OUTSIDE_GEOFENCE` (sertakan jarak di `details`)
6. Karyawan punya shift → `NO_SHIFT_ASSIGNED`
7. Hari kerja / libur / cuti (aturan 6)
8. Tentukan CHECK_IN / CHECK_OUT (aturan 3) + jendela waktu (aturan 4)
9. Simpan dalam **transaksi Prisma**; tangani race condition unique constraint (`P2002`) → kembalikan `ALREADY_CHECKED_IN`.

Rate limit endpoint scan: **10 request/menit per user**.

## 8. QR Personal (mode cadangan)
- Hanya ADMIN/SUPER_ADMIN yang dapat memanggil `POST /attendance/personal-scan`.
- Validasi sama seperti kiosk, KECUALI: device binding dilewati; geofence memakai koordinat petugas terhadap `locationId` yang dipilih petugas.
- `checkInMethod`/`checkOutMethod` = `PERSONAL_QR`, simpan `scannedById`.

## 9. Izin / Sakit / Cuti
- Tipe: `SICK`, `PERMIT`, `ANNUAL`.
- `startDate ≤ endDate`, maksimal rentang 14 hari *(setting)*, tidak boleh tumpang tindih dengan pengajuan PENDING/APPROVED milik user yang sama.
- `SICK` > 1 hari wajib lampiran (surat dokter) — upload JPG/PNG/PDF maks 2 MB.
- Karyawan hanya bisa **membatalkan** pengajuan berstatus `PENDING`.
- Saat APPROVED: untuk setiap hari kerja dalam rentang yang **belum lewat**, cron akan mengisi status. Untuk tanggal yang sudah lewat & berstatus ABSENT → langsung ubah ke SICK/PERMIT/LEAVE.
- Kuota cuti tahunan default 12 hari/tahun *(setting `ANNUAL_LEAVE_QUOTA`)*; hitung hari kerja saja.

## 10. Cron Harian
- Jalan pukul **23:55** `APP_TIMEZONE`.
- Untuk setiap karyawan aktif yang punya shift, jika hari ini hari kerja & bukan libur:
  - ada cuti APPROVED → upsert record status SICK/PERMIT/LEAVE
  - tidak ada record → buat record `ABSENT`
- Harus **idempotent** (aman dijalankan ulang) & memproses dalam batch (500 user/batch).
- Sediakan endpoint SUPER_ADMIN `POST /attendance/recalculate?date=YYYY-MM-DD` untuk menjalankan ulang secara manual.

## 11. Koreksi Absensi oleh Admin
- `PATCH /attendance/:id` dapat mengubah `checkInAt`, `checkOutAt`, `status`, `note`.
- **Wajib** isi `reason`; sistem menghitung ulang `lateMinutes`, `earlyLeaveMinutes`, `workMinutes`.
- Catat `AuditLog` berisi nilai sebelum & sesudah. Method menjadi `MANUAL` untuk sisi yang diubah.
- Admin juga dapat membuat record manual (`POST /attendance/manual`) untuk karyawan yang lupa absen.

## 12. Audit Log (aksi yang wajib dicatat)
`LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED`, `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `DEVICE_BOUND`, `DEVICE_RESET`, `ATTENDANCE_CORRECTED`, `ATTENDANCE_MANUAL_CREATED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `KIOSK_SECRET_ROTATED`, `SETTING_UPDATED`, `REFRESH_TOKEN_REUSE_DETECTED`.

## 13. Keamanan Akun
- Password minimal 8 karakter, wajib huruf besar, huruf kecil, dan angka.
- Hash password: **argon2id**.
- 5 kali gagal login dalam 15 menit → akun dikunci 15 menit (`ACCOUNT_LOCKED`).
- Ganti password → cabut semua refresh token user.
