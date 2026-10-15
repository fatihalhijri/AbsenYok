'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Provider global sisi client. Service worker tidak didaftarkan saat development agar
 * perubahan kode tidak tertahan cache (`next dev`).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'}>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </TooltipProvider>
    </SerwistProvider>
  );
}
