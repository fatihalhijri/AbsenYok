# [BE-03] Autentikasi JWT + Refresh Token Rotation + Role Guard

**Konteks:** `docs/ARCHITECTURE.md` (Alur Autentikasi), `docs/BUSINESS-RULES.md` §13, `docs/API-CONTRACT.md` bagian Auth.

## Tugas
Implementasikan modul `auth` lengkap dan guard global.

## Spesifikasi
1. **Login** `POST /auth/login` (`@Public`, throttle khusus 5 req/menit per IP):
   - cari user by email (case-insensitive, `deletedAt = null`)
   - jika `lockedUntil > now` → 423 `ACCOUNT_LOCKED` (sertakan menit tersisa)
   - verifikasi argon2; gagal → increment `failedLoginAttempts`; ke-5 dalam 15 menit → set `lockedUntil = now + 15 menit`; audit `LOGIN_FAILED`; respons generik `INVALID_CREDENTIALS` (jangan bedakan email tidak ada vs password salah)
   - `isActive = false` → 403 `ACCOUNT_INACTIVE`
   - sukses → reset counter, update `lastLoginAt`, audit `LOGIN`
   - terbitkan access token (payload: `sub`, `role`, `email`, `jti`) & refresh token
2. **Refresh token**:
   - JWT terpisah (`JWT_REFRESH_SECRET`) berisi `sub`, `familyId`, `jti`
   - DB menyimpan `tokenHash = sha256(token)`, `familyId`, `expiresAt`, `userAgent`, `ipAddress`
   - cookie `ay_rt`: `httpOnly`, `secure = COOKIE_SECURE`, `sameSite = 'lax'`, `path = '/api/v1/auth'`, `maxAge` = masa berlaku
   - cookie penanda `ay_session=1`: `httpOnly`, `sameSite = 'lax'`, `path = '/'`, masa berlaku sama — **tidak berisi rahasia**, hanya dipakai middleware Next.js untuk redirect awal. Set saat login/refresh, hapus saat logout/refresh gagal.
3. **Refresh** `POST /auth/refresh` (`@Public`):
   - token tidak ada/invalid → 401 `TOKEN_INVALID`
   - token ditemukan tetapi `revokedAt != null` → **reuse terdeteksi**: cabut semua token `familyId` tsb, audit `REFRESH_TOKEN_REUSE_DETECTED`, 401 `REFRESH_TOKEN_REUSED`
   - valid → cabut token lama (`revokedAt`, `replacedBy`), terbitkan pasangan baru dengan `familyId` sama (dalam transaksi)
   - cek ulang user masih aktif
4. **Logout**: cabut refresh token saat ini, hapus cookie, audit `LOGOUT`.
5. **Me** `GET /auth/me`: kembalikan `UserProfile` sesuai kontrak.
6. **Change password**: verifikasi password lama, validasi kekuatan password (regex BUSINESS-RULES §13), cabut SEMUA refresh token user, audit `PASSWORD_CHANGED`.
7. **Guards** (global via `APP_GUARD`, urutan: Throttler → JwtAuth → Roles):
   - `JwtAuthGuard`: lewati jika `@Public()`; token kedaluwarsa → 401 `TOKEN_EXPIRED` (penting: frontend memakai kode ini untuk memicu refresh); setelah verifikasi, muat user dari DB (cache 30 detik) dan tolak jika nonaktif
   - `RolesGuard`: baca metadata `@Roles()`; tanpa metadata = semua role terautentikasi boleh; tidak cocok → 403 `FORBIDDEN`
8. `AuditLogsService.log({ actorId, action, entity, entityId, metadata, ip, userAgent })` — buat service ini sekarang (controller-nya di BE-09).
9. Cron harian 03:00: hapus refresh token yang sudah kedaluwarsa > 7 hari.

## Kriteria Selesai
- [ ] Unit test: login sukses, password salah, lockout ke-5, akun nonaktif, refresh rotation, reuse detection
- [ ] E2E: login → akses `/auth/me` → refresh → token lama ditolak → logout
- [ ] EMPLOYEE yang memanggil endpoint `@Roles('ADMIN')` mendapat 403
- [ ] Respons tidak pernah memuat `passwordHash`/`tokenHash`
