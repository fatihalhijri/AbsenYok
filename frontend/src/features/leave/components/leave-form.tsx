'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck2Icon, CircleAlertIcon, Loader2Icon, SendIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { id as localeId } from 'react-day-picker/locale';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useHolidays } from '@/features/holidays/hooks';
import { useToday } from '@/hooks/use-today';
import { dateToString, formatDateShort, isoWeekdayOf, stringToDate } from '@/lib/date';
import { toApiError } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { cn } from '@/lib/utils';
import { countWorkingDays, datesBetween, parseWorkDays } from '@/lib/working-days';
import { useAuthStore } from '@/stores/auth-store';
import type { Holiday, LeaveType } from '@/types';
import { useCreateLeave, useLeaveQuota } from '../hooks';
import { LEAVE_TYPE_META, LEAVE_TYPES } from '../meta';
import { attachmentRequired, earliestStartDate, MIN_REASON_LENGTH } from '../rules';
import { type LeaveFormValues, leaveFormSchema } from '../schemas';
import { AttachmentField } from './attachment-field';

const SERVER_FIELDS = ['type', 'reason'] as const;

/** `/app/leave/new`: form pengajuan izin/sakit/cuti dengan estimasi hari kerja live. */
export function LeaveForm() {
  const today = useToday();
  if (!today) return <Skeleton className="h-[640px] w-full rounded-2xl" />;
  return <LeaveFormInner today={today} />;
}

function LeaveFormInner({ today }: { today: string }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const workDays = useMemo(() => parseWorkDays(user?.shift?.workDays), [user?.shift?.workDays]);
  const [month, setMonth] = useState(() => stringToDate(today));
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [rangeServerError, setRangeServerError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const create = useCreateLeave(setProgress);

  const form = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { type: undefined, range: {}, reason: '' },
  });
  const type = useWatch({ control: form.control, name: 'type' }) as LeaveType | undefined;
  const range = useWatch({ control: form.control, name: 'range' });
  const reason = useWatch({ control: form.control, name: 'reason' });

  // Libur untuk tahun yang tampil di kalender + tahun hari ini (rentang bisa lintas tahun).
  const currentYear = Number(today.slice(0, 4));
  const shownYear = month.getFullYear();
  const holidaysNow = useHolidays(currentYear);
  const holidaysShown = useHolidays(shownYear === currentYear ? null : shownYear);
  const holidays = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const holiday of [...(holidaysNow.data ?? []), ...(holidaysShown.data ?? [])]) {
      map.set(holiday.date, holiday);
    }
    return map;
  }, [holidaysNow.data, holidaysShown.data]);
  const holidaySet = useMemo(() => new Set(holidays.keys()), [holidays]);

  const quota = useLeaveQuota(
    type === 'ANNUAL' && range.from ? Number(range.from.slice(0, 4)) : null,
  );

  const from = range.from;
  const to = range.to ?? range.from;
  const workingDays = from && to ? countWorkingDays(from, to, workDays, holidaySet) : 0;
  const holidaysInRange =
    from && to ? datesBetween(from, to).flatMap((date) => holidays.get(date) ?? []) : [];
  const needsAttachment = attachmentRequired(type, workingDays);
  const earliest = earliestStartDate(today);

  const submit = form.handleSubmit(
    async (values) => {
      setRangeServerError(null);
      const startDate = values.range.from as string;
      const endDate = values.range.to ?? startDate;
      if (needsAttachment && !attachment) {
        setAttachmentError('Sakit lebih dari 1 hari kerja wajib melampirkan surat dokter');
        return;
      }
      if (attachmentError) return;
      setProgress(0);
      try {
        await create.mutateAsync({
          type: values.type,
          startDate,
          endDate,
          reason: values.reason.trim(),
          attachment,
        });
        toast.success('Pengajuan terkirim', { description: 'Menunggu persetujuan admin.' });
        router.push('/app/leave');
      } catch (error) {
        const apiError = toApiError(error);
        const applied = applyServerFieldErrors(error, form.setError, SERVER_FIELDS);
        const rangeDetail = apiError.fieldErrors.find(
          (detail) => detail.field === 'startDate' || detail.field === 'endDate',
        );
        const fileDetail = apiError.fieldErrors.find((detail) => detail.field === 'attachment');
        if (rangeDetail) setRangeServerError(rangeDetail.messages[0] ?? null);
        if (fileDetail) setAttachmentError(fileDetail.messages[0] ?? null);
        if (!applied && !rangeDetail && !fileDetail) {
          toast.error('Pengajuan gagal dikirim', { description: apiError.message });
        }
      }
    },
    () => {
      toast.error('Periksa kembali isian formulir');
    },
  );

  const pending = create.isPending;
  const offDay = (date: Date) =>
    workDays.length > 0 && !workDays.includes(isoWeekdayOf(dateToString(date)));
  const isHoliday = (date: Date) => holidaySet.has(dateToString(date));

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FieldGroup>
        <Controller
          name="type"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id="leave-type-label">Jenis pengajuan</FieldLabel>
              <div role="radiogroup" aria-labelledby="leave-type-label" className="grid gap-2">
                {LEAVE_TYPES.map((value) => {
                  const meta = LEAVE_TYPE_META[value];
                  const Icon = meta.icon;
                  const checked = field.value === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors',
                        'has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                        checked
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:bg-accent',
                      )}
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={value}
                        checked={checked}
                        onChange={() => field.onChange(value)}
                        onBlur={field.onBlur}
                        className="sr-only"
                        disabled={pending}
                      />
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-lg',
                          meta.tone,
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{meta.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {meta.description}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-5 shrink-0 rounded-full border-2',
                          checked
                            ? 'border-primary bg-primary shadow-[inset_0_0_0_3px_var(--card)]'
                            : 'border-muted-foreground/40',
                        )}
                      />
                    </label>
                  );
                })}
              </div>
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <Controller
          name="range"
          control={form.control}
          render={({ field, fieldState }) => {
            const selected: DateRange | undefined = field.value.from
              ? {
                  from: stringToDate(field.value.from),
                  to: field.value.to ? stringToDate(field.value.to) : undefined,
                }
              : undefined;
            const message = fieldState.error?.message ?? rangeServerError;
            return (
              <Field data-invalid={Boolean(message)}>
                <FieldLabel id="leave-range-label">Tanggal</FieldLabel>
                <FieldDescription>
                  Ketuk tanggal mulai lalu tanggal selesai (sama untuk 1 hari). Paling awal{' '}
                  {formatDateShort(earliest)}.
                </FieldDescription>
                <div className="rounded-xl border bg-card" aria-labelledby="leave-range-label">
                  <Calendar
                    mode="range"
                    locale={localeId}
                    weekStartsOn={1}
                    month={month}
                    onMonthChange={setMonth}
                    selected={selected}
                    onSelect={(next) => {
                      setRangeServerError(null);
                      field.onChange({
                        from: next?.from ? dateToString(next.from) : undefined,
                        to: next?.to ? dateToString(next.to) : undefined,
                      });
                    }}
                    disabled={[
                      { before: stringToDate(earliest) },
                      ...(pending ? [() => true] : []),
                    ]}
                    modifiers={{ offDay, holiday: isHoliday }}
                    modifiersClassNames={{
                      offDay: 'text-muted-foreground/70',
                      holiday: 'text-destructive font-semibold',
                    }}
                    className="mx-auto w-full bg-transparent [--cell-size:--spacing(10)]"
                    classNames={{
                      root: 'w-full',
                      months: 'relative flex w-full flex-col gap-4',
                      month: 'flex w-full flex-col gap-3',
                    }}
                  />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-destructive" aria-hidden="true" />
                      Hari libur
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full bg-muted-foreground/40"
                        aria-hidden="true"
                      />
                      Bukan hari kerja
                    </span>
                  </div>
                </div>
                {message ? <FieldError>{message}</FieldError> : null}
              </Field>
            );
          }}
        />

        {from ? (
          <WorkingDaysSummary
            from={from}
            to={to ?? from}
            workingDays={workingDays}
            holidayNames={holidaysInRange.map((holiday) => holiday.name)}
            annualRemaining={type === 'ANNUAL' ? quota.data?.remaining : undefined}
          />
        ) : null}

        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="leave-reason">Alasan</FieldLabel>
              <Textarea
                {...field}
                id="leave-reason"
                rows={4}
                maxLength={1000}
                placeholder="Mis. demam tinggi, disarankan istirahat oleh dokter"
                aria-invalid={fieldState.invalid}
                disabled={pending}
              />
              <FieldDescription className="flex justify-between">
                <span>Minimal {MIN_REASON_LENGTH} karakter.</span>
                <span className="tabular-nums">{reason.trim().length}/1000</span>
              </FieldDescription>
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />

        <AttachmentField
          value={attachment}
          onChange={(file) => {
            setAttachment(file);
            if (file) setAttachmentError(null);
          }}
          onError={setAttachmentError}
          error={attachmentError ?? undefined}
          required={needsAttachment}
          disabled={pending}
        />
      </FieldGroup>

      {pending ? (
        <div className="space-y-1" role="status" aria-live="polite">
          <Progress value={progress} className="h-2" aria-label="Progres unggah" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {attachment ? `Mengunggah… ${progress}%` : 'Mengirim…'}
          </p>
        </div>
      ) : null}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <SendIcon aria-hidden="true" />
        )}
        Kirim pengajuan
      </Button>
    </form>
  );
}

function WorkingDaysSummary({
  from,
  to,
  workingDays,
  holidayNames,
  annualRemaining,
}: {
  from: string;
  to: string;
  workingDays: number;
  holidayNames: string[];
  annualRemaining?: number;
}) {
  const overQuota = annualRemaining !== undefined && workingDays > annualRemaining;
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3 ring-1 ring-primary/20">
        <CalendarCheck2Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p>
            <span className="font-semibold tabular-nums" data-testid="working-days">
              {workingDays} hari kerja
            </span>{' '}
            <span className="text-muted-foreground">
              (
              {from === to
                ? formatDateShort(from)
                : `${formatDateShort(from)} – ${formatDateShort(to)}`}
              )
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Estimasi dari jadwal shift & hari libur — dihitung ulang oleh server.
            {holidayNames.length > 0 ? ` Libur: ${holidayNames.join(', ')}.` : ''}
          </p>
        </div>
      </div>
      {workingDays === 0 ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>Rentang ini tidak mencakup hari kerja Anda.</AlertDescription>
        </Alert>
      ) : overQuota ? (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>Melebihi sisa cuti tahunan ({annualRemaining} hari).</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
