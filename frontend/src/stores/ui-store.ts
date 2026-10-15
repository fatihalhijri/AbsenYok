import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UiState {
  /** Sidebar admin terbuka (false = hanya ikon). */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

/**
 * Preferensi UI yang disimpan di localStorage. `skipHydration`: render pertama memakai nilai
 * bawaan (sama dengan HTML server), lalu `useUiStore.persist.rehydrate()` dipanggil setelah mount
 * agar tidak terjadi hydration mismatch.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'ay-ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sidebarOpen }) => ({ sidebarOpen }),
      skipHydration: true,
    },
  ),
);
