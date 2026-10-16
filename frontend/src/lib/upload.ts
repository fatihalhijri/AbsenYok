/** Validasi file sebelum upload — sama dengan batas backend, agar ditolak tanpa request. */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** "1,5 MB" / "820 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('id-ID')} KB`;
}

/** Pesan error bila file tidak boleh diunggah; `null` bila valid. */
export function validateUpload(
  file: Pick<File, 'size' | 'type'>,
  {
    types,
    maxBytes = MAX_UPLOAD_BYTES,
    label,
  }: { types: readonly string[]; maxBytes?: number; label: string },
): string | null {
  if (!types.includes(file.type)) return `Format file harus ${label}`;
  if (file.size > maxBytes) {
    return `Ukuran file ${formatBytes(file.size)} — maksimal ${formatBytes(maxBytes)}`;
  }
  return null;
}
