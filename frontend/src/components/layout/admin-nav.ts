import {
  Building2Icon,
  CalendarOffIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileClockIcon,
  FileSpreadsheetIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MapPinIcon,
  MonitorSmartphoneIcon,
  ScanLineIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import type { Role } from '@/types';

/** Kunci angka badge di menu (diisi data nyata di FE-09: jumlah izin PENDING). */
export type AdminNavBadgeKey = 'pendingLeaves';

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: AdminNavBadgeKey;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
  /** Hanya tampil untuk role ini (default: semua admin). */
  roles?: Role[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Utama',
    items: [
      { title: 'Dashboard', href: '/admin', icon: LayoutDashboardIcon },
      { title: 'Absensi', href: '/admin/attendance', icon: ClipboardCheckIcon },
      { title: 'Scan QR Personal', href: '/admin/scan-personal', icon: ScanLineIcon },
    ],
  },
  {
    label: 'Pengajuan',
    items: [
      {
        title: 'Izin & Cuti',
        href: '/admin/leave-requests',
        icon: FileClockIcon,
        badgeKey: 'pendingLeaves',
      },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { title: 'Karyawan', href: '/admin/employees', icon: UsersIcon },
      { title: 'Departemen', href: '/admin/departments', icon: Building2Icon },
      { title: 'Shift', href: '/admin/shifts', icon: ClockIcon },
      { title: 'Lokasi', href: '/admin/locations', icon: MapPinIcon },
      { title: 'Kiosk', href: '/admin/kiosks', icon: MonitorSmartphoneIcon },
      { title: 'Hari Libur', href: '/admin/holidays', icon: CalendarOffIcon },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { title: 'Rekap & Export', href: '/admin/reports', icon: FileSpreadsheetIcon },
      { title: 'Log Scan', href: '/admin/scan-logs', icon: ScrollTextIcon },
    ],
  },
  {
    label: 'Sistem',
    roles: ['SUPER_ADMIN'],
    items: [
      { title: 'Audit Log', href: '/admin/audit-logs', icon: ShieldCheckIcon },
      { title: 'Pengaturan', href: '/admin/settings', icon: SettingsIcon },
    ],
  },
];

/** Label segmen URL di luar menu (untuk breadcrumb). */
const EXTRA_SEGMENT_LABELS: Record<string, string> = {
  new: 'Tambah',
  edit: 'Ubah',
};

export const isAdminNavActive = (pathname: string, href: string) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

export interface Crumb {
  label: string;
  href: string;
}

/** `/admin/employees/123` → Admin › Karyawan › Detail. `/admin` → Admin › Dashboard. */
export function adminBreadcrumbs(pathname: string): Crumb[] {
  const items = ADMIN_NAV.flatMap((group) => group.items);
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((segment, index): Crumb => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const decoded = decodeURIComponent(segment);
    const label =
      href === '/admin'
        ? 'Admin'
        : (items.find((item) => item.href === href)?.title ??
          EXTRA_SEGMENT_LABELS[decoded] ??
          'Detail');
    return { label, href };
  });
  if (crumbs.length === 1) crumbs.push({ label: 'Dashboard', href: '/admin' });
  return crumbs;
}
