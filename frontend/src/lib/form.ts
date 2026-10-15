import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toApiError } from '@/lib/error';

/**
 * Pasang error validasi backend (`details: [{ field, messages }]`) ke field form yang cocok.
 * Mengembalikan `true` bila ada field yang ditandai (pesan umum tidak perlu ditampilkan lagi).
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  let applied = false;
  for (const detail of toApiError(error).fieldErrors) {
    const field = fields.find((name) => name === detail.field);
    if (field && detail.messages[0]) {
      setError(field, { type: 'server', message: detail.messages[0] }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied;
}
