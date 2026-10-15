'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthBootstrap } from '@/features/auth/components/auth-bootstrap';
import { createQueryClient } from '@/lib/query-client';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Provider global sisi client. Service worker tidak didaftarkan saat development agar
 * perubahan kode tidak tertahan cache (`next dev`).
 */
export function Providers({ children }: { children: ReactNode }) {
  // Satu QueryClient per tab (bukan module global) — aman untuk SSR/prerender.
  const [queryClient] = useState(createQueryClient);

  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={isDev}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            <AuthBootstrap />
            {children}
            <Toaster richColors closeButton position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
        {isDev ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
      </QueryClientProvider>
    </SerwistProvider>
  );
}
