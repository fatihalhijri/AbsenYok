'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  ClipboardListIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  SmartphoneIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { initialsOf } from '@/components/layout/user-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { MonthPicker } from '@/components/shared/month-picker';
import { AvatarPhoto } from '@/components/shared/avatar-photo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DayDetailSheet } from '@/features/attendance/history/day-detail-sheet';
import { AttendanceCalendar } from '@/features/attendance/history/attendance-calendar';
import { useHolidays } from '@/features/holidays/hooks';
import { LeaveCard } from '@/features/leave/components/leave-card';
import { useToday } from '@/hooks/use-today';
import { datesInMonth, formatDateTime, isoWeekdayOf } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { LOOKUP_QUERY, masterKeys, shiftsApi } from '@/features/master/api';
import { parseWorkDays } from '@/lib/working-days';
import { useAuthStore } from '@/stores/auth-store';
import type { Attendance, Holiday } from '@/types';
import { employeeKeys, employeesApi } from '../api';
import { canManage, ROLE_LABELS } from '../schemas';
import { EmployeeFormSheet } from './employee-form-sheet';

/** `/admin/employees/[id]`: profil + kalender kehadiran per bulan + pengajuan izin/cuti. */
export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const actorRole = useAuthStore((state) => state.user?.role);
  const today = useToday();
  const [month, setMonth] = useState<string | null>(null);
  const currentMonth = today?.slice(0, 7) ?? null;
  const shownMonth = month ?? currentMonth;
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const user = useQuery({ queryKey: employeeKeys.detail(id), queryFn: () => employeesApi.get(id) });
  const range = shownMonth ? datesInMonth(shownMonth) : null;
  const attendance = useQuery({
    queryKey: employeeKeys.attendance(id, shownMonth ?? ''),
    queryFn: () => employeesApi.attendance(id, range?.[0] ?? '', range?.at(-1) ?? ''),
    enabled: range !== null,
  });
  const leaves = useQuery({
    queryKey: employeeKeys.leaves(id),
    queryFn: () => employeesApi.leaves(id),
  });
  const holidaysQuery = useHolidays(shownMonth ? Number(shownMonth.slice(0, 4)) : null);

  const records = useMemo(
    () =>
      new Map<string, Attendance>((attendance.data?.items ?? []).map((item) => [item.date, item])),
    [attendance.data],
  );
  const holidays = useMemo(
    () =>
      new Map<string, Holiday>(
        (holidaysQuery.data ?? [])
          .filter((holiday) => shownMonth && holiday.date.startsWith(shownMonth))
          .map((holiday) => [holiday.date, holiday]),
      ),
    [holidaysQuery.data, shownMonth],
  );
  // Hari kerja dari data shift lengkap (UserShiftEntity tidak memuat workDays).
  const shifts = useQuery({
    queryKey: masterKeys.shiftList(LOOKUP_QUERY),
    queryFn: () => shiftsApi.list(LOOKUP_QUERY),
    staleTime: 5 * 60_000,
  });
  const workDays = useMemo(() => {
    const shift = shifts.data?.items.find((item) => item.id === user.data?.shift?.id);
    return parseWorkDays(shift?.workDays);
  }, [shifts.data, user.data]);

  if (user.isError) {
    return (
      <ErrorState
        className="rounded-xl border"
        title="Karyawan tidak ditemukan"
        message={getErrorMessage(user.error)}
        onRetry={() => void user.refetch()}
      />
    );
  }

  const data = user.data;
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2 w-fit">
        <Link href="/admin/employees">
          <ArrowLeftIcon aria-hidden="true" />
          Kembali ke daftar
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-start">
          {data ? (
            <>
              <Avatar className="size-20 text-xl">
                {data.avatarUrl ? <AvatarPhoto src={data.avatarUrl} size={80} /> : null}
                <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                  {initialsOf(data.name) || <UserIcon className="size-8" aria-hidden="true" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold">{data.name}</h1>
                  <Badge variant={data.role === 'EMPLOYEE' ? 'secondary' : 'default'}>
                    {ROLE_LABELS[data.role]}
                  </Badge>
                  <Badge variant={data.isActive ? 'outline' : 'destructive'}>
                    {data.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  NIP {data.employeeCode}
                  {data.position ? ` · ${data.position}` : ''}
                  {data.department ? ` · ${data.department.name}` : ''}
                </p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Info icon={MailIcon} label="Email" value={data.email} />
                  <Info icon={PhoneIcon} label="Telepon" value={data.phone || '—'} />
                  <Info
                    icon={BriefcaseBusinessIcon}
                    label="Shift"
                    value={
                      data.shift
                        ? `${data.shift.name} · ${data.shift.startTime}–${data.shift.endTime}`
                        : 'Belum ada'
                    }
                  />
                  <Info
                    icon={MapPinIcon}
                    label="Lokasi kerja"
                    value={data.location?.name ?? 'Belum ditentukan'}
                  />
                  <Info
                    icon={SmartphoneIcon}
                    label="Perangkat"
                    value={data.hasBoundDevice ? 'Terdaftar' : 'Belum terdaftar'}
                  />
                  <Info
                    icon={UserIcon}
                    label="Login terakhir"
                    value={data.lastLoginAt ? formatDateTime(data.lastLoginAt) : 'Belum pernah'}
                  />
                </dl>
              </div>
              {canManage(actorRole, data) ? (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon aria-hidden="true" />
                  Ubah
                </Button>
              ) : null}
            </>
          ) : (
            <Skeleton className="h-28 w-full" />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Kehadiran</CardTitle>
              <CardDescription>Ketuk tanggal untuk melihat detail.</CardDescription>
            </div>
            {shownMonth && currentMonth ? (
              <MonthPicker value={shownMonth} onChange={setMonth} maxMonth={currentMonth} />
            ) : null}
          </CardHeader>
          <CardContent>
            {attendance.isPending || !shownMonth || !today ? (
              <Skeleton className="h-80 w-full" />
            ) : attendance.isError ? (
              <ErrorState
                message={getErrorMessage(attendance.error)}
                onRetry={() => void attendance.refetch()}
              />
            ) : (
              <AttendanceCalendar
                month={shownMonth}
                records={records}
                holidays={holidays}
                workDays={workDays}
                today={today}
                selected={selected}
                onSelect={setSelected}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pengajuan izin/cuti</CardTitle>
            <CardDescription>20 pengajuan terbaru.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaves.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : leaves.isError ? (
              <ErrorState
                message={getErrorMessage(leaves.error)}
                onRetry={() => void leaves.refetch()}
              />
            ) : leaves.data.items.length === 0 ? (
              <EmptyState icon={ClipboardListIcon} title="Belum ada pengajuan" />
            ) : (
              leaves.data.items.map((leave) => <LeaveCard key={leave.id} leave={leave} />)
            )}
          </CardContent>
        </Card>
      </div>

      {today ? (
        <DayDetailSheet
          date={selected}
          record={selected ? records.get(selected) : undefined}
          holiday={selected ? holidays.get(selected) : undefined}
          offDay={
            selected !== null && workDays.length > 0 && !workDays.includes(isoWeekdayOf(selected))
          }
          future={selected !== null && selected > today}
          onClose={() => setSelected(null)}
        />
      ) : null}
      {data ? <EmployeeFormSheet employee={data} open={editing} onOpenChange={setEditing} /> : null}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MailIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate">{value}</dd>
      </div>
    </div>
  );
}
