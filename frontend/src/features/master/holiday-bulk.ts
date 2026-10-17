import { DATE_FORMAT, dayjs } from '@/lib/date';

/** Batas backend (`MAX_BULK_HOLIDAYS`). */
export const MAX_BULK_HOLIDAYS = 100;

export interface BulkParseResult {
  items: { date: string; name: string }[];
  errors: { line: number; message: string }[];
}

/**
 * Parser "Tambah Banyak": satu baris = `YYYY-MM-DD;Nama libur`. Baris kosong & baris diawali `#`
 * diabaikan. Validasi sama dengan backend (tanggal nyata, nama 2–100 karakter, maks 100 item);
 * tanggal ganda di input dilaporkan (tanggal yang sudah ada di server dilewati oleh backend).
 */
export function parseBulkHolidays(text: string): BulkParseResult {
  const items: BulkParseResult['items'] = [];
  const errors: BulkParseResult['errors'] = [];
  const seen = new Map<string, number>();

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const value = raw.trim();
    if (!value || value.startsWith('#')) return;
    const separator = value.indexOf(';');
    if (separator < 0) {
      errors.push({ line, message: 'Format harus "YYYY-MM-DD;Nama libur"' });
      return;
    }
    const date = value.slice(0, separator).trim();
    const name = value.slice(separator + 1).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dayjs(date, DATE_FORMAT, true).isValid()) {
      errors.push({ line, message: `Tanggal "${date}" tidak valid (YYYY-MM-DD)` });
      return;
    }
    if (name.length < 2 || name.length > 100) {
      errors.push({ line, message: 'Nama libur harus 2–100 karakter' });
      return;
    }
    const first = seen.get(date);
    if (first !== undefined) {
      errors.push({ line, message: `Tanggal ${date} sudah ada di baris ${first}` });
      return;
    }
    seen.set(date, line);
    items.push({ date, name });
  });

  if (items.length > MAX_BULK_HOLIDAYS) {
    errors.push({ line: 0, message: `Maksimal ${MAX_BULK_HOLIDAYS} tanggal sekali kirim` });
  }
  return { items, errors };
}
