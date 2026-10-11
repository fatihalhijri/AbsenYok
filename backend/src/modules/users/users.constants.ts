const MB = 1024 * 1024;

/** Avatar: sisi persegi hasil resize & tipe gambar yang diterima (dicek dari magic bytes). */
export const AVATAR_SIZE_PX = 256;
export const AVATAR_PUBLIC_PATH = '/uploads/avatars';
export const AVATAR_DIR_NAME = 'avatars';
export const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** Batas piksel input sharp — mencegah "decompression bomb". */
export const AVATAR_MAX_INPUT_PIXELS = 40_000_000;

/** Import XLSX. */
export const IMPORT_MAX_BYTES = 5 * MB;
export const IMPORT_MAX_ROWS = 500;
export const IMPORT_COLUMNS = [
  'employeeCode',
  'name',
  'email',
  'phone',
  'position',
  'departmentCode',
  'shiftName',
  'password',
] as const;
export const IMPORT_REQUIRED_COLUMNS = ['employeeCode', 'name', 'email', 'password'] as const;
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Batas multer (yang terbesar dari semua endpoint upload); batas per endpoint dicek di service. */
export const MULTER_MAX_BYTES = IMPORT_MAX_BYTES;

export const bytesToMb = (bytes: number) => bytes / MB;
