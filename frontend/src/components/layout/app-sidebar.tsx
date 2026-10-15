'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/auth-store';
import { ADMIN_NAV, type AdminNavBadgeKey, isAdminNavActive } from './admin-nav';
import { BrandMark } from './brand-mark';

interface AppSidebarProps {
  /** Angka badge menu (mis. jumlah izin PENDING); 0/undefined → tidak tampil. */
  badges?: Partial<Record<AdminNavBadgeKey, number>>;
}

export function AppSidebar({ badges }: AppSidebarProps) {
  const pathname = usePathname();
  const role = useAuthStore((state) => state.user?.role);
  const { isMobile, setOpenMobile } = useSidebar();

  // Grup ber-role (Sistem → SUPER_ADMIN) hanya tampil bila role user cocok.
  const groups = ADMIN_NAV.filter((group) => !group.roles || (role && group.roles.includes(role)));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b">
        <Link
          href="/admin"
          className="rounded-md px-1 outline-none group-data-[collapsible=icon]:px-0 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* Mode ikon (collapsed): hanya logo; nama tetap terbaca screen reader. */}
          <BrandMark nameClassName="group-data-[collapsible=icon]:sr-only" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isAdminNavActive(pathname, item.href)}
                      tooltip={item.title}
                    >
                      <Link
                        href={item.href}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge ? (
                      <SidebarMenuBadge
                        aria-label={`${badge} menunggu persetujuan`}
                        className="rounded-full bg-warning text-warning-foreground"
                      >
                        {badge > 99 ? '99+' : badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
