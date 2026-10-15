import type { Metadata } from 'next';
import { AdminShell } from '@/components/layout/admin-shell';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin AbsenYok' },
};

/** Layout admin (desktop-first): sidebar + topbar. Proteksi role ditambahkan di FE-03. */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return <AdminShell>{children}</AdminShell>;
}
