# Kontrak API — AbsenYok

Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` (kecuali ditandai 🌐 publik)
Role: **SA** = SUPER_ADMIN, **A** = ADMIN, **E** = EMPLOYEE

## Format Umum

**Sukses**
```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 } }
```

**Error**
```json
{
  "success": false,
  "error": { "code": "OUTSIDE_GEOFENCE", "message": "Anda berada 245 m dari lokasi kantor (maks 100 m)", "details": { "distance": 245, "radius": 100 } },
  "path": "/api/v1/attendance/scan",
  "timestamp": "2026-10-11T01:05:22.000Z"
}
```

## Kode Error Bisnis
| HTTP | code | Pesan (ID) |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Data tidak valid |
| 401 | `INVALID_CREDENTIALS` | Email atau password salah |
| 401 | `TOKEN_EXPIRED` | Sesi berakhir |
| 401 | `TOKEN_INVALID` | Token tidak valid |
| 401 | `REFRESH_TOKEN_REUSED` | Sesi tidak aman, silakan login ulang |
| 403 | `FORBIDDEN` | Anda tidak memiliki akses |
| 403 | `ACCOUNT_INACTIVE` | Akun dinonaktifkan |
| 423 | `ACCOUNT_LOCKED` | Akun dikunci sementara, coba lagi dalam X menit |
| 404 | `NOT_FOUND` | Data tidak ditemukan |
| 409 | `CONFLICT` | Data sudah ada |
| 422 | `QR_INVALID` | QR Code tidak dikenali |
| 422 | `QR_EXPIRED` | QR Code kedaluwarsa, silakan scan ulang |
| 422 | `QR_ALREADY_USED` | QR sudah dipakai |
| 422 | `KIOSK_INACTIVE` | Kiosk tidak aktif |
| 422 | `DEVICE_MISMATCH` | Akun terdaftar di perangkat lain. Hubungi admin |
| 422 | `LOCATION_ACCURACY_LOW` | Sinyal GPS lemah, coba di area terbuka |
| 422 | `OUTSIDE_GEOFENCE` | Anda di luar area kantor |
| 422 | `NO_SHIFT_ASSIGNED` | Anda belum memiliki jadwal shift |
| 422 | `NOT_WORKING_DAY` | Hari ini bukan hari kerja Anda |
| 422 | `HOLIDAY` | Hari ini hari libur |
| 422 | `ON_LEAVE` | Anda sedang izin/cuti hari ini |
| 422 | `CHECKIN_WINDOW_CLOSED` | Di luar jam absen masuk |
| 422 | `CHECKOUT_TOO_SOON` | Absen pulang terlalu cepat |
| 409 | `ALREADY_CHECKED_IN` | Anda sudah absen masuk |
| 409 | `ALREADY_CHECKED_OUT` | Anda sudah absen pulang hari ini |
| 429 | `TOO_MANY_REQUESTS` | Terlalu banyak percobaan |

---

## Auth
| Method | Endpoint | Role | Body / Query | Respons `data` |
|---|---|---|---|---|
| POST | `/auth/login` | 🌐 | `{ email, password }` | `{ accessToken, expiresIn, user }` + Set-Cookie `ay_rt` & `ay_session` |
| POST | `/auth/refresh` | 🌐 (cookie) | – | `{ accessToken, expiresIn, user }` + cookie baru |
| POST | `/auth/logout` | semua | – | `null`, hapus cookie `ay_rt` & `ay_session` |
| GET | `/auth/me` | semua | – | `UserProfile` |
| PATCH | `/auth/change-password` | semua | `{ currentPassword, newPassword }` | `null` |

`UserProfile`: `{ id, employeeCode, name, email, phone, position, role, avatarUrl, department: {id,name}|null, shift: Shift|null, location: {id,name}|null, hasBoundDevice }`

## Users
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/users` | SA, A | filter: `search, role, departmentId, isActive`, paginasi |
| GET | `/users/:id` | SA, A | detail |
| POST | `/users` | SA, A | `{ employeeCode, name, email, phone?, position?, password, role, departmentId?, shiftId?, locationId? }` (A hanya boleh role EMPLOYEE) |
| PATCH | `/users/:id` | SA, A | partial update (tanpa password) |
| PATCH | `/users/:id/status` | SA, A | `{ isActive }` |
| POST | `/users/:id/reset-password` | SA, A | `{ newPassword }` |
| POST | `/users/:id/reset-device` | SA, A | kosongkan `boundDeviceId` |
| DELETE | `/users/:id` | SA | soft delete |
| POST | `/users/import` | SA, A | upload XLSX (template di `/users/import/template`) |
| GET | `/users/import/template` | SA, A | unduh template XLSX |
| PATCH | `/users/me` | semua | `{ name?, phone? }` |
| POST | `/users/me/avatar` | semua | multipart `file` (jpg/png/webp ≤ 2 MB) |
| GET | `/users/me/qr` | E | `{ token, expiresAt, intervalSeconds }` |

## Master Data
| Method | Endpoint | Role |
|---|---|---|
| GET/POST | `/departments` | GET: SA,A · POST: SA,A |
| PATCH/DELETE | `/departments/:id` | SA, A (DELETE ditolak jika masih ada user) |
| GET/POST | `/shifts` | SA, A |
| PATCH/DELETE | `/shifts/:id` | SA, A |
| GET/POST | `/locations` | SA, A |
| PATCH/DELETE | `/locations/:id` | SA, A |
| GET/POST | `/holidays` | GET: semua · POST: SA,A · filter `year` |
| PATCH/DELETE | `/holidays/:id` | SA, A |
| GET | `/settings` | SA, A |
| PATCH | `/settings` | SA · `{ [key]: value }` |
| GET | `/settings/public` | 🌐 · `{ companyName, logoUrl }` |

## Kiosks
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET/POST | `/kiosks` | SA, A | body POST: `{ name, locationId, qrIntervalSeconds? }` |
| PATCH/DELETE | `/kiosks/:id` | SA, A | |
| POST | `/kiosks/:id/rotate-secret` | SA, A | QR lama tidak berlaku |
| GET | `/kiosks/:id/qr` | SA, A | `{ token, expiresAt, intervalSeconds, serverTime, kiosk: {id,name,locationName} }` |
| GET | `/kiosks/:id/recent-scans` | SA, A | 10 scan berhasil terakhir (untuk ditampilkan di layar kiosk) |

## Attendance
| Method | Endpoint | Role | Body / Query | Respons `data` |
|---|---|---|---|---|
| POST | `/attendance/scan` | E | `{ qrToken, latitude, longitude, accuracy, deviceId }` | `ScanResult` |
| POST | `/attendance/personal-scan` | SA, A | `{ qrToken, locationId, latitude, longitude, accuracy }` | `ScanResult` |
| GET | `/attendance/me/today` | E | – | `{ attendance: Attendance\|null, shift, isWorkingDay, holiday\|null, leave\|null, canCheckIn, canCheckOut }` |
| GET | `/attendance/me` | E | `month=YYYY-MM` | `{ items: Attendance[], summary }` |
| GET | `/attendance` | SA, A | `dateFrom, dateTo, userId, departmentId, status, search`, paginasi | `Attendance[]` (+ user) |
| GET | `/attendance/:id` | SA, A | – | detail + log terkait |
| POST | `/attendance/manual` | SA, A | `{ userId, date, checkInAt?, checkOutAt?, status, reason }` | `Attendance` |
| PATCH | `/attendance/:id` | SA, A | `{ checkInAt?, checkOutAt?, status?, note?, reason }` | `Attendance` |
| POST | `/attendance/recalculate` | SA | `date=YYYY-MM-DD` | `{ processed, created, updated }` |
| GET | `/attendance/scan-logs` | SA, A | `success, userId, dateFrom, dateTo`, paginasi | `AttendanceScanLog[]` |

`ScanResult`:
```json
{
  "type": "CHECK_IN",
  "attendance": { "id": "...", "date": "2026-10-12", "status": "LATE", "checkInAt": "...", "lateMinutes": 7 },
  "message": "Absen masuk berhasil pukul 08:22. Anda terlambat 7 menit.",
  "user": { "name": "Budi Santoso", "employeeCode": "EMP001" }
}
```

`summary` (bulanan): `{ present, late, absent, sick, permit, leave, totalLateMinutes, totalWorkMinutes, attendanceRate }`

## Leave Requests
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| POST | `/leave-requests` | E | multipart: `type, startDate, endDate, reason, attachment?` |
| GET | `/leave-requests/me` | E | filter `status, year` |
| GET | `/leave-requests/me/quota` | E | `{ year, quota, used, remaining }` |
| PATCH | `/leave-requests/:id/cancel` | E (pemilik) | hanya PENDING |
| GET | `/leave-requests` | SA, A | filter `status, type, userId, departmentId, dateFrom, dateTo` |
| GET | `/leave-requests/:id` | SA, A, pemilik | |
| PATCH | `/leave-requests/:id/approve` | SA, A | `{ note? }` |
| PATCH | `/leave-requests/:id/reject` | SA, A | `{ note }` (wajib) |

## Dashboard & Reports
| Method | Endpoint | Role | Respons |
|---|---|---|---|
| GET | `/dashboard/summary` | SA, A | `{ date, totalEmployees, present, late, absent, onLeave, notYetCheckedIn, attendanceRate }` |
| GET | `/dashboard/trend` | SA, A | `days=30` → `[{ date, present, late, absent, leave }]` |
| GET | `/dashboard/late-ranking` | SA, A | `month=YYYY-MM` top 10 terlambat |
| GET | `/dashboard/recent-activity` | SA, A | 20 scan terbaru |
| GET | `/reports/monthly` | SA, A | `month, departmentId?` → rekap per karyawan |
| GET | `/reports/monthly/export` | SA, A | `month, departmentId?, format=xlsx\|pdf` → file |
| GET | `/reports/daily/export` | SA, A | `date, format=xlsx\|pdf` → file |
| GET | `/reports/me/export` | E | `month, format=pdf` → slip kehadiran pribadi |

## Audit Logs
| Method | Endpoint | Role |
|---|---|---|
| GET | `/audit-logs` | SA · filter `action, actorId, entity, dateFrom, dateTo` |

## Health
| GET | `/health` | 🌐 | `{ status: "ok", db: "up", time }` |
