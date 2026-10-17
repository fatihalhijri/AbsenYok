'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

interface RenderWhenVisibleProps {
  children: ReactNode;
  /** Placeholder dengan tinggi sama agar tidak terjadi layout shift saat konten dipasang. */
  fallback: ReactNode;
  /** Mulai memasang sedikit sebelum terlihat. */
  rootMargin?: string;
}

/**
 * Pasang `children` hanya setelah area ini mendekati viewport. Untuk komponen berat di bawah
 * lipatan (mis. grafik recharts di dashboard mobile): unduh, parse & render ditunda sampai
 * dibutuhkan sehingga tidak memblokir interaksi awal.
 */
export function RenderWhenVisible({
  children,
  fallback,
  rootMargin = '200px',
}: RenderWhenVisibleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return visible ? children : <div ref={ref}>{fallback}</div>;
}
