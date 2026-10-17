'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarOffIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListPlusIcon,
  PlusIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { FormDialog } from '@/components/shared/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useHolidays } from '@/features/holidays/hooks';
import { useDialogTarget } from '@/hooks/use-dialog-target';
import { useToday } from '@/hooks/use-today';
import { DATE_FORMAT, dayjs, formatDateLong } from '@/lib/date';
import { getErrorMessage } from '@/lib/error';
import { applyServerFieldErrors } from '@/lib/form';
import { useToastMutation } from '@/lib/mutation';
import type { Holiday } from '@/types';
import { holidaysAdminApi, masterKeys } from '../api';
import { MAX_BULK_HOLIDAYS, parseBulkHolidays } from '../holiday-bulk';
import { RowActions } from './row-actions';

const schema = z.object({
  date: z
    .string()
    .refine((value) => dayjs(value, DATE_FORMAT, true).isValid(), { error: 'Pilih tanggal' }),
  name: z
    .string()
    .trim()
    .min(2, { error: 'Nama hari libur minimal 2 karakter' })
    .max(100, { error: 'Nama hari libur maksimal 100 karakter' }),
});
type FormValues = z.infer<typeof schema>;

/** `/admin/holidays`: daftar hari libur per tahun (`?year=`), tambah satu / banyak. */
export function HolidaysView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = useToday();
  const currentYear = today ? Number(today.slice(0, 4)) : null;
  const requested = Number(searchParams.get('year'));
  const year =
    Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : currentYear;

  const holidays = useHolidays(year);
  const editing = useDialogTarget<Holiday>();
  const [bulkOpen, setBulkOpen] = useState(false);
  const deleting = useDialogTarget<Holiday>();

  const remove = useToastMutation({
    mutationFn: (id: string) => holidaysAdminApi.remove(id),
    invalidate: [masterKeys.holidays],
    success: () => 'Hari libur dihapus',
    error: 'Gagal menghapus hari libur',
  });

  const setYear = (next: number) =>
    router.replace(next === currentYear ? pathname : `${pathname}?year=${next}`, { scroll: false });

  const items = [...(holidays.data ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Pilih tahun">
          <Button
            variant="outline"
            size="icon"
            aria-label="Tahun sebelumnya"
            disabled={!year}
            onClick={() => year && setYear(year - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <span
            className="min-w-20 text-center text-lg font-semibold tabular-nums"
            aria-live="polite"
          >
            {year ?? '—'}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Tahun berikutnya"
            disabled={!year}
            onClick={() => year && setYear(year + 1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <ListPlusIcon aria-hidden="true" />
            Tambah banyak
          </Button>
          <Button onClick={() => editing.show(null)}>
            <PlusIcon aria-hidden="true" />
            Tambah
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        {holidays.isPending || year === null ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : holidays.isError ? (
          <ErrorState
            message={getErrorMessage(holidays.error)}
            onRetry={() => void holidays.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarOffIcon}
            title={`Belum ada hari libur ${year}`}
            description='Tambahkan satu per satu atau gunakan "Tambah banyak".'
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((holiday) => (
                <TableRow key={holiday.id} data-holiday-date={holiday.date}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDateLong(holiday.date)}
                  </TableCell>
                  <TableCell className="font-medium">{holiday.name}</TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      label={holiday.name}
                      onEdit={() => editing.show(holiday)}
                      onDelete={() => deleting.show(holiday)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {items.length} hari libur. Hari libur tidak dihitung sebagai hari kerja (absensi & cuti).
      </p>

      <HolidayDialog
        holiday={editing.target}
        open={editing.open}
        onOpenChange={editing.onOpenChange}
      />
      <BulkDialog open={bulkOpen} onOpenChange={setBulkOpen} year={year} />
      <ConfirmDialog
        open={deleting.open}
        onOpenChange={deleting.onOpenChange}
        title={`Hapus "${deleting.target?.name ?? ''}"?`}
        description={
          deleting.target
            ? `${formatDateLong(deleting.target.date)} akan kembali dihitung sebagai hari kerja.`
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={() => (deleting.target ? remove.mutateAsync(deleting.target.id) : undefined)}
      />
    </div>
  );
}

function HolidayDialog({
  holiday,
  open,
  onOpenChange,
}: {
  holiday: Holiday | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: '', name: '' },
  });
  useEffect(() => {
    if (open) form.reset({ date: holiday?.date ?? '', name: holiday?.name ?? '' });
  }, [open, holiday, form]);

  const save = useToastMutation({
    mutationFn: (values: FormValues) =>
      holiday ? holidaysAdminApi.update(holiday.id, values) : holidaysAdminApi.create(values),
    invalidate: [masterKeys.holidays],
    success: (saved) => `${saved.name} disimpan`,
    error: false,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values);
      onOpenChange(false);
    } catch (error) {
      if (!applyServerFieldErrors(error, form.setError, ['date', 'name'])) {
        toast.error('Gagal menyimpan hari libur', { description: getErrorMessage(error) });
      }
    }
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={holiday ? 'Ubah hari libur' : 'Tambah hari libur'}
      formId="holiday-form"
      pending={save.isPending}
    >
      <form id="holiday-form" onSubmit={submit} noValidate>
        <FieldGroup>
          <Controller
            name="date"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="holiday-date">Tanggal</FieldLabel>
                <Input {...field} id="holiday-date" type="date" aria-invalid={fieldState.invalid} />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="holiday-name">Nama</FieldLabel>
                <Input
                  {...field}
                  id="holiday-name"
                  placeholder="Hari Raya Natal"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </FormDialog>
  );
}

function BulkDialog({
  open,
  onOpenChange,
  year,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number | null;
}) {
  const [text, setText] = useState('');
  const parsed = parseBulkHolidays(text);
  const bulk = useToastMutation({
    mutationFn: () => holidaysAdminApi.bulk(parsed.items),
    invalidate: [masterKeys.holidays],
    success: ({ created, skipped }) =>
      `${created} hari libur ditambahkan${skipped ? `, ${skipped} dilewati (tanggal sudah ada)` : ''}`,
    error: 'Gagal menambahkan hari libur',
  });
  const canSubmit = parsed.items.length > 0 && parsed.errors.length === 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setText('');
        onOpenChange(next);
      }}
      title="Tambah banyak hari libur"
      description={`Satu baris per tanggal dengan format YYYY-MM-DD;Nama libur. Maksimal ${MAX_BULK_HOLIDAYS} baris. Tanggal yang sudah ada akan dilewati.`}
      formId="holiday-bulk-form"
      submitLabel={parsed.items.length ? `Tambahkan ${parsed.items.length} tanggal` : 'Tambahkan'}
      pending={bulk.isPending}
      submitDisabled={!canSubmit}
      className="sm:max-w-xl"
    >
      <form
        id="holiday-bulk-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canSubmit) return;
          try {
            await bulk.mutateAsync();
            setText('');
            onOpenChange(false);
          } catch {
            /* toast sudah ditampilkan */
          }
        }}
      >
        <Field data-invalid={parsed.errors.length > 0}>
          <FieldLabel htmlFor="holiday-bulk">Daftar hari libur</FieldLabel>
          <Textarea
            id="holiday-bulk"
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`${year ?? 2026}-01-01;Tahun Baru Masehi\n${year ?? 2026}-08-17;Hari Kemerdekaan RI`}
            className="font-mono text-sm"
            spellCheck={false}
          />
          <FieldDescription>
            {parsed.items.length} tanggal valid
            {parsed.errors.length ? `, ${parsed.errors.length} baris bermasalah` : ''}.
          </FieldDescription>
          {parsed.errors.length > 0 ? (
            <FieldError>
              <ul className="list-disc space-y-0.5 pl-4">
                {parsed.errors.slice(0, 8).map((error) => (
                  <li key={`${error.line}-${error.message}`}>
                    {error.line > 0 ? `Baris ${error.line}: ` : ''}
                    {error.message}
                  </li>
                ))}
              </ul>
            </FieldError>
          ) : null}
        </Field>
      </form>
    </FormDialog>
  );
}
