'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck2Icon,
  ClockAlertIcon,
  FileHeartIcon,
  type LucideIcon,
  UserRoundXIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/shared/error-state';
import { StatCard } from '@/components/shared/stat-card';
import { getErrorMessage } from '@/lib/error';
import type { DashboardSummary } from '@/types';
import { dashboardApi, dashboardKeys } from '../api';

type Tone = 'primary' | 'warning' | 'destructive' | 'info' | 'neutral';

interface CardDef {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  value: (s: DashboardSummary) => number;
  /** Tujuan klik (filter terkait). */
  href: (s: DashboardSummary) => string;
}

const attendanceHref = (date: string, extra: string) =>
  `/admin/attendance?dateFrom=${date}&dateTo=${date}${extra}`;

const CARDS: CardDef[] = [
  {
    key: 'total',
    label: 'Total Karyawan',
    icon: UsersIcon,
    tone: 'neutral',
    value: (s) => s.totalEmployees,
    href: () => '/admin/employees?isActive=true',
  },
  {
    key: 'present',
    label: 'Hadir',
    icon: CalendarCheck2Icon,
    tone: 'primary',
    value: (s) => s.present,
    href: (s) => attendanceHref(s.date, '&status=PRESENT'),
  },
  {
    key: 'late',
    label: 'Terlambat',
    icon: ClockAlertIcon,
    tone: 'warning',
    value: (s) => s.late,
    href: (s) => attendanceHref(s.date, '&status=LATE'),
  },
  {
    key: 'leave',
    label: 'Izin/Cuti',
    icon: FileHeartIcon,
    tone: 'info',
    value: (s) => s.onLeave,
    // Izin/cuti hari ini = pengajuan disetujui yang beririsan dengan hari ini.
    href: (s) => `/admin/leave-requests?status=APPROVED&dateFrom=${s.date}&dateTo=${s.date}`,
  },
  {
    key: 'missing',
    label: 'Belum Absen',
    icon: UserRoundXIcon,
    tone: 'destructive',
    value: (s) => s.notYetCheckedIn,
    // Backend belum punya filter "belum absen" (karyawan tanpa record) → daftar absensi hari ini.
    href: (s) => attendanceHref(s.date, ''),
  },
];

const percent = (value: number, total: number) =>
  total > 0
    ? `${((value / total) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
    : '0%';

/** Baris StatCard hari ini; tiap kartu menuju daftar terfilter. */
export function SummaryCards() {
  const summary = useQuery({ queryKey: dashboardKeys.summary(), queryFn: dashboardApi.summary });

  if (summary.isError) {
    return (
      <ErrorState
        className="rounded-xl border"
        message={getErrorMessage(summary.error)}
        onRetry={() => void summary.refetch()}
      />
    );
  }
  const data = summary.data;
  return (
    <div className="space-y-2">
      {data?.holiday ? (
        <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-200">
          Hari ini libur: <strong>{data.holiday.name}</strong>
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CARDS.map((card) => (
          <li key={card.key}>
            {data ? (
              <Link
                href={card.href(data)}
                className="block rounded-xl transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`${card.label}: ${card.value(data)} — lihat daftar`}
              >
                <StatCard
                  label={card.label}
                  value={card.value(data).toLocaleString('id-ID')}
                  icon={card.icon}
                  tone={card.tone}
                  hint={
                    card.key === 'total'
                      ? `Kehadiran ${data.attendanceRate.toLocaleString('id-ID')}%`
                      : `${percent(card.value(data), data.totalEmployees)} dari karyawan`
                  }
                />
              </Link>
            ) : (
              <StatCard label={card.label} value="" icon={card.icon} tone={card.tone} loading />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
