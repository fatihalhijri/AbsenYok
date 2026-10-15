'use client';

import { type ReactNode, useEffect } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useUiStore } from '@/stores/ui-store';
import { AdminTopbar } from './admin-topbar';
import { AppSidebar } from './app-sidebar';

/** Kerangka admin: sidebar collapsible (preferensi di Zustand persist) + topbar + konten. */
export function AdminShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  // Muat preferensi dari localStorage setelah mount (store dibuat dengan skipHydration).
  useEffect(() => {
    void useUiStore.persist.rehydrate();
  }, []);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AdminTopbar />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
