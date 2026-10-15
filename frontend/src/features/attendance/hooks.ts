'use client';

import { useQuery } from '@tanstack/react-query';
import { attendanceApi, attendanceKeys } from './api';

/**
 * Status absensi hari ini. `refetchOnWindowFocus` aktif: kembali ke aplikasi (mis. setelah scan
 * dari tab lain) langsung memperbarui kartu. `clockOffsetMs` = selisih jam server − jam perangkat,
 * dipakai hitung mundur/jam agar akurat walau jam HP meleset.
 */
export function useMyToday() {
  const query = useQuery({
    queryKey: attendanceKeys.today(),
    queryFn: attendanceApi.myToday,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const clockOffsetMs = query.data ? Date.parse(query.data.serverTime) - query.dataUpdatedAt : 0;
  return { ...query, clockOffsetMs };
}

/** Riwayat & ringkasan satu bulan; `month = null` → belum dimuat (mis. menunggu tanggal klien). */
export function useMyMonth(month: string | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: attendanceKeys.month(month ?? ''),
    queryFn: () => attendanceApi.myMonth(month ?? ''),
    enabled: month !== null && (options.enabled ?? true),
  });
}
