# [BE-08] Izin, Sakit & Cuti

**Konteks:** `docs/BUSINESS-RULES.md` §9, `docs/API-CONTRACT.md` bagian Leave Requests.

## Tugas
Buat modul `leave-requests`.

## Spesifikasi
1. **Ajukan** (`POST /leave-requests`, multipart):
   - validasi `startDate ≤ endDate`, rentang ≤ `leave.maxRangeDays`, tidak tumpang tindih dengan PENDING/APPROVED milik user
   - `startDate` boleh maksimal 7 hari ke belakang (untuk sakit mendadak), selebihnya ditolak
   - `totalDays` = jumlah hari kerja (berdasarkan `workDays` shift, minus hari libur) — jika 0 → tolak "Rentang tanggal tidak mencakup hari kerja"
   - `SICK` dengan `totalDays > 1` wajib `attachment` (jpg/png/pdf ≤ 2 MB, cek magic bytes) → simpan ke `UPLOAD_DIR/leave/<uuid>.<ext>`
   - `ANNUAL` → cek kuota sisa tahun berjalan cukup
2. **Lampiran** disajikan lewat endpoint terproteksi `GET /leave-requests/:id/attachment` (pemilik, ADMIN, SUPER_ADMIN) — JANGAN lewat folder statis publik.
3. **Batalkan** (pemilik, hanya PENDING) → `CANCELLED`.
4. **Approve** (admin): status `APPROVED`, isi `reviewedById`, `reviewedAt`, `reviewNote`; dalam transaksi yang sama, ubah record attendance `ABSENT` pada tanggal yang tercakup & sudah lewat menjadi SICK/PERMIT/LEAVE dan isi `leaveRequestId`. Audit `LEAVE_APPROVED`.
5. **Reject** (admin): `note` wajib. Audit `LEAVE_REJECTED`.
6. Hanya PENDING yang bisa di-approve/reject (selain itu 409 `CONFLICT`).
7. `GET /leave-requests/me/quota` → `{ year, quota, used, remaining }` (used = total `totalDays` ANNUAL yang APPROVED tahun itu).
8. Listing admin dengan filter & paginasi, include user ringkas + reviewer.

## Kriteria Selesai
- [ ] Unit test perhitungan `totalDays` (melewati akhir pekan & hari libur)
- [ ] Pengajuan tumpang tindih ditolak
- [ ] Approve cuti untuk tanggal yang sudah tercatat ABSENT mengubahnya menjadi LEAVE
- [ ] Karyawan lain tidak bisa mengunduh lampiran milik orang lain (403)
