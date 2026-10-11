# [FE-03] Autentikasi, API Client & Proteksi Route

**Konteks:** `docs/ARCHITECTURE.md` (Alur Autentikasi), `docs/API-CONTRACT.md` bagian Auth.

## Spesifikasi
1. **auth-store (Zustand, TIDAK di-persist)**: `accessToken`, `user`, `status: 'idle'|'loading'|'authenticated'|'unauthenticated'`, aksi `setSession`, `clear`.
2. **api-client.ts (axios)**:
   - `baseURL = NEXT_PUBLIC_API_BASE`, `withCredentials: true`, timeout 15 dtk
   - request interceptor menyisipkan `Authorization`
   - response interceptor: jika 401 dengan `error.code === 'TOKEN_EXPIRED'` → panggil `/auth/refresh` **sekali** (promise tunggal bersama untuk request paralel), ulangi request awal; jika refresh gagal → `clear()` + redirect `/login?next=<path>`
   - unwrap otomatis `response.data.data` dan sediakan `meta` untuk listing
   - kelas `ApiError { code, message, details, status }`
3. **Bootstrap sesi** di `providers.tsx`: saat app dimuat, panggil `/auth/refresh` (diam-diam) untuk memulihkan sesi; tampilkan splash/skeleton selama `status === 'loading'`.
4. **Middleware/proxy Next.js**: jika akses `/app/*`, `/admin/*`, atau `/kiosk/*` tanpa cookie `ay_session` → redirect `/login?next=...`. Jika ada cookie dan membuka `/login` → biarkan client yang memutuskan (setelah refresh).
   > Cookie `ay_rt` ber-path `/api/v1/auth` sehingga tidak terbaca middleware; karena itu backend juga mengirim cookie penanda non-sensitif `ay_session` (lihat BE-03). Middleware hanya untuk redirect cepat — otorisasi sebenarnya tetap di backend & RoleGate.
5. **RoleGate** komponen client: layout `(admin)` hanya untuk SUPER_ADMIN/ADMIN, layout `(employee)` hanya EMPLOYEE; selain itu redirect ke beranda yang sesuai role (`/admin` atau `/app`). Menu khusus SUPER_ADMIN disembunyikan untuk ADMIN.
6. **Halaman Login**:
   - kiri (desktop): ilustrasi/hero dengan nama instansi dari `/settings/public`; kanan: form
   - field email & password (toggle lihat password), validasi zod, tombol loading
   - tampilkan pesan error dari backend (termasuk `ACCOUNT_LOCKED` dengan sisa menit)
   - sukses → redirect ke `next` atau beranda sesuai role
7. **Logout**: panggil endpoint, `queryClient.clear()`, `clear()` store, redirect `/login`.
8. **Ganti password** (dipakai di profil FE-06): komponen form tersendiri dengan indikator kekuatan password.

## Kriteria Selesai
- [ ] Refresh halaman tetap login (sesi pulih via refresh)
- [ ] Access token tidak ada di localStorage/sessionStorage
- [ ] 5 request paralel saat token kedaluwarsa → hanya 1 panggilan `/auth/refresh`
- [ ] EMPLOYEE membuka `/admin` → dialihkan ke `/app`
