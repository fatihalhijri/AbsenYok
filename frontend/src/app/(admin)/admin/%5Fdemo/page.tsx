import type { Metadata } from 'next';
import { DemoClient } from './demo-client';

export const metadata: Metadata = { title: 'Demo Komponen', robots: { index: false } };

/**
 * Halaman demo SEMENTARA (FE-02) di URL `/admin/_demo` — folder `%5Fdemo` karena folder berawalan
 * `_` adalah private folder di App Router. Hapus di FE-08.
 */
export default function DemoPage() {
  return <DemoClient />;
}
