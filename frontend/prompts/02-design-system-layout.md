# [FE-02] Design System & Layout

## Tugas
Bangun identitas visual dan kerangka layout.

## Spesifikasi
### Identitas Visual
- Warna primer: **emerald/teal** (kesan "hadir & positif"), aksen amber untuk peringatan, rose untuk error. Definisikan sebagai CSS variables shadcn (light & dark).
- Font: `Plus Jakarta Sans` via `next/font/google` (fallback system-ui).
- Radius `0.75rem`, bayangan lembut, ikon lucide stroke 1.75.
- Komponen `StatusBadge` untuk status absensi dengan warna konsisten:
  PRESENT=hijau "Hadir", LATE=amber "Terlambat", ABSENT=merah "Alpa", SICK=biru "Sakit", PERMIT=ungu "Izin", LEAVE=cyan "Cuti". Status leave: PENDING=abu "Menunggu", APPROVED=hijau "Disetujui", REJECTED=merah "Ditolak", CANCELLED=abu "Dibatalkan".

### Layout Karyawan `(employee)/app/layout.tsx` (mobile-first)
- Topbar: logo/nama instansi, avatar (menu: Profil, Tema, Keluar).
- **Bottom navigation** 5 item: Beranda, Riwayat, **Scan** (tombol tengah besar & menonjol, bulat), Izin, Profil. Hormati `env(safe-area-inset-bottom)`.
- Di layar ≥ 768 px tampil terpusat dengan lebar maksimal 480 px (kesan aplikasi mobile).

### Layout Admin `(admin)/admin/layout.tsx` (desktop-first)
- Sidebar kiri collapsible (ikon saja saat collapsed, simpan preferensi di Zustand persist), grup menu: **Utama** (Dashboard, Absensi, Scan QR Personal), **Pengajuan** (Izin & Cuti + badge jumlah PENDING), **Master Data** (Karyawan, Departemen, Shift, Lokasi, Kiosk, Hari Libur), **Laporan** (Rekap & Export, Log Scan), **Sistem** (Audit Log, Pengaturan — hanya SUPER_ADMIN).
- Mobile: sidebar menjadi `Sheet` dari tombol hamburger.
- Topbar: breadcrumb, toggle tema, menu user.

### Komponen Shared
`PageHeader` (judul, deskripsi, slot aksi), `DataTable` generik (TanStack Table: sorting server-side, paginasi server-side, kolom tersembunyi, toolbar pencarian dengan debounce 400 ms, filter slot, loading skeleton, empty state), `EmptyState`, `ConfirmDialog`, `DateRangePicker`, `MonthPicker`, `StatCard`, `ErrorState`.

## Kriteria Selesai
- [ ] Dark mode konsisten di semua komponen
- [ ] Bottom nav tidak tertutup home indicator iPhone
- [ ] Halaman demo sementara `/admin/_demo` menampilkan DataTable dengan data dummy (hapus di FE-08)
