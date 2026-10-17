'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import dynamic from 'next/dynamic';
import { type ReactNode, useState } from 'react';
import { AuthBootstrap } from '@/features/auth/components/auth-bootstrap';
// Efek samping: tangkap `beforeinstallprompt` sedini mungkin (dikirim sekali per muat halaman).
import '@/lib/install-prompt';
import { createQueryClient } from '@/lib/query-client';

// Toaster (sonner) dimuat setelah hydration: tidak dibutuhkan untuk tampilan pertama, jadi tidak
// ikut membebani halaman pembuka (login/beranda). Tooltip hanya dipakai area admin (AdminShell).
const Toaster = dynamic(() => import('@/components/ui/sonner').then((m) => m.Toaster), {
  ssr: false,
});

const isDev = process.env.NODE_ENV === 'development';
const isServer = typeof window === 'undefined';

/**
 * Provider global sisi client. Service worker tidak didaftarkan saat development agar
 * perubahan kode tidak tertahan cache (`next dev`).
 */
export function Providers({ children }: { children: ReactNode }) {
  // Satu QueryClient per tab (bukan module global) — aman untuk SSR/prerender.
  const [queryClient] = useState(createQueryClient);

  // public/sw.js dibangun oleh scripts/build-sw.mjs (postbuild); service worker nonaktif di dev.
  return (
    <SerwistProvider swUrl="/sw.js" disable={isDev}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          // Skrip anti-kedip tema hanya berguna di HTML dari server. Bila tree dirender ulang di
          // client (mis. setelah hydration mismatch), React 19 memperingatkan <script> yang dibuat
          // di client → di client jadikan data block (tidak dieksekusi, tanpa peringatan).
          // Perbedaan atribut `type` aman karena next-themes memasang suppressHydrationWarning.
          scriptProps={{ type: isServer ? undefined : 'application/json' }}
        >
          <AuthBootstrap />
          {children}
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
        {isDev ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
      </QueryClientProvider>
    </SerwistProvider>
  );
}
