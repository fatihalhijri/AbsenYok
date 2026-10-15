'use client';

import {
  CalendarDaysIcon,
  ClipboardListIcon,
  HouseIcon,
  type LucideIcon,
  ScanQrCodeIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tombol tengah besar (Scan). */
  primary?: boolean;
}

export const EMPLOYEE_NAV: NavItem[] = [
  { href: '/app', label: 'Beranda', icon: HouseIcon },
  { href: '/app/history', label: 'Riwayat', icon: CalendarDaysIcon },
  { href: '/app/scan', label: 'Scan', icon: ScanQrCodeIcon, primary: true },
  { href: '/app/leave', label: 'Izin', icon: ClipboardListIcon },
  { href: '/app/profile', label: 'Profil', icon: UserIcon },
];

const isActive = (pathname: string, href: string) =>
  href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Navigasi bawah karyawan. Padding bawah = `env(safe-area-inset-bottom)` sehingga tidak tertutup
 * home indicator iPhone (butuh `viewport-fit=cover`, sudah diatur di root layout).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgb(15_23_42/0.12)] backdrop-blur supports-backdrop-filter:bg-background/85"
    >
      <ul className="grid h-16 grid-cols-5 items-end">
        {EMPLOYEE_NAV.map(({ href, label, icon: Icon, primary }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex h-full justify-center">
              {primary ? (
                <Link
                  href={href}
                  aria-label="Scan absen"
                  aria-current={active ? 'page' : undefined}
                  className="group flex -translate-y-5 flex-col items-center gap-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform group-active:scale-95">
                    <Icon className="size-7" aria-hidden="true" />
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {label}
                  </span>
                </Link>
              ) : (
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-6" aria-hidden="true" />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
