export interface DetectedFileType {
  ext: string;
  mime: string;
}

/**
 * Deteksi tipe file dari isi (magic bytes), bukan dari nama/ekstensi atau header Content-Type
 * yang bisa dipalsukan. `file-type` hanya tersedia sebagai ESM sehingga dimuat via import().
 */
export async function detectFileType(buffer: Buffer): Promise<DetectedFileType | null> {
  const { fileTypeFromBuffer } = await import('file-type');
  const result = await fileTypeFromBuffer(buffer);
  return result ? { ext: result.ext, mime: result.mime } : null;
}
