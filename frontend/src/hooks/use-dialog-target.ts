'use client';

import { useCallback, useState } from 'react';

/**
 * State dialog dengan target (mis. baris yang diubah). Saat ditutup, `target` DIPERTAHANKAN
 * sampai dialog dibuka lagi — agar judul/teks tidak berubah selama animasi tutup
 * (mis. "Ubah kiosk" sempat menjadi "Tambah kiosk").
 */
export function useDialogTarget<T>() {
  const [state, setState] = useState<{ open: boolean; target: T | null }>({
    open: false,
    target: null,
  });
  const show = useCallback((target: T | null = null) => setState({ open: true, target }), []);
  const close = useCallback(() => setState((current) => ({ ...current, open: false })), []);
  const onOpenChange = useCallback(
    (open: boolean) => (open ? undefined : setState((current) => ({ ...current, open: false }))),
    [],
  );
  return { open: state.open, target: state.target, show, close, onOpenChange };
}
