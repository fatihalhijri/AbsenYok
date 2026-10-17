'use client';

import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { dashboardApi, dashboardKeys } from '@/features/dashboard/api';
import { useUiStore } from '@/stores/ui-store';
import { AdminTopbar } from './admin-topbar';
import { AppSidebar } from './app-sidebar';

/** Kerangka admin: sidebar collapsible (preferensi di Zustand persist) + topbar + konten. */
export function AdminShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  // Badge "Izin & Cuti" = jumlah PENDING (key sama dengan pratinjau dashboard → satu request).
  const pendingLeaves = useQuery({
    queryKey: dashboardKeys.pendingLeaves(),
    queryFn: dashboardApi.pendingLeaves,
    refetchInterval: 60_000,
    select: (page) => page.meta.total,
  });

  // Muat preferensi dari localStorage setelah mount (store dibuat dengan skipHydration).
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return (
    // Tooltip hanya dipakai area admin (sidebar ringkas, ikon metode) → provider di sini, bukan root.
    <TooltipProvider delayDuration={300}>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar badges={{ pendingLeaves: pendingLeaves.data }} />
        <SidebarInset className="min-w-0">
          <AdminTopbar />
          <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
