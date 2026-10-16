import { compressImage } from '@/lib/image';
import { ATTACHMENT_TYPES, validateUpload } from '@/lib/upload';

export type PreparedAttachment = { ok: true; file: File } | { ok: false; error: string };

const LABEL = 'JPG, PNG, atau PDF';

/**
 * Siapkan lampiran sebelum upload (tanpa request apa pun):
 * 1. PDF → langsung divalidasi (≤ 2 MB).
 * 2. Gambar (termasuk foto kamera) → dikompres di client (maks sisi 1600 px, kualitas 0.8)
 *    lalu hasilnya divalidasi — foto HP 4 MB biasanya menjadi < 1 MB.
 * 3. Tipe lain → ditolak.
 */
export async function prepareAttachment(
  file: File,
  compress: (file: File) => Promise<File> = compressImage,
): Promise<PreparedAttachment> {
  if (file.type === 'application/pdf') {
    const error = validateUpload(file, { types: ATTACHMENT_TYPES, label: LABEL });
    return error ? { ok: false, error } : { ok: true, file };
  }
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: `Format file harus ${LABEL}` };
  }
  let processed: File;
  try {
    processed = await compress(file);
  } catch {
    return { ok: false, error: 'Gambar tidak dapat dibaca. Gunakan foto JPG/PNG atau file PDF.' };
  }
  const error = validateUpload(processed, { types: ATTACHMENT_TYPES, label: LABEL });
  return error ? { ok: false, error } : { ok: true, file: processed };
}
