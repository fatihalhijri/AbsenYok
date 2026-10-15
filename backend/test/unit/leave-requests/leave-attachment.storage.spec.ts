import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { ErrorCode } from '@/common/constants/error-codes';
import type { AppConfigService } from '@/config/app.config';
import { LeaveAttachmentStorage } from '@/modules/leave-requests/leave-attachment.storage';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

const multerFile = (buffer: Buffer, size = buffer.length) =>
  ({ buffer, size, originalname: 'surat.pdf', mimetype: 'application/pdf' }) as Express.Multer.File;

describe('LeaveAttachmentStorage', () => {
  let root: string;
  let storage: LeaveAttachmentStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'absenyok-leave-'));
    const env: Record<string, unknown> = { UPLOAD_DIR: root, MAX_UPLOAD_SIZE_MB: 2 };
    storage = new LeaveAttachmentStorage({ get: (key: string) => env[key] } as AppConfigService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    ['PNG', PNG, 'png'],
    ['PDF', PDF, 'pdf'],
  ])('menerima %s berdasarkan magic bytes', async (_label, buffer, ext) => {
    await expect(storage.validate(multerFile(buffer))).resolves.toEqual({ buffer, ext });
  });

  it.each([
    ['file kosong', multerFile(Buffer.alloc(0))],
    ['melebihi 2 MB', multerFile(PDF, 2 * 1024 * 1024 + 1)],
    ['bukan JPG/PNG/PDF (teks berekstensi .pdf)', multerFile(Buffer.from('bukan pdf sungguhan'))],
  ])('menolak %s', async (_label, file) => {
    await expect(storage.validate(file)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
      details: [expect.objectContaining({ field: 'attachment' })],
    });
  });

  it('save → open → remove dengan kunci acak di folder leave/', async () => {
    const key = await storage.save({ buffer: PDF, ext: 'pdf' });
    expect(key).toMatch(/^leave\/[0-9a-f-]{36}\.pdf$/);
    await expect(readFile(join(root, key))).resolves.toEqual(PDF);

    const file = await storage.open(key);
    expect(file).toMatchObject({ mime: 'application/pdf', ext: 'pdf', size: PDF.length });
    const chunks: Buffer[] = [];
    for await (const chunk of file.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks)).toEqual(PDF);

    await storage.remove(key);
    expect(existsSync(join(root, key))).toBe(false);
  });

  it.each(['../../etc/passwd', 'leave/../../.env', 'avatars/x.png', 'leave/abc.exe'])(
    'kunci tidak sah ditolak (anti path traversal): %s',
    async (key) => {
      await expect(storage.open(key)).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    },
  );

  it('file yang sudah hilang → 404 saat dibuka; hapus diam-diam (ENOENT)', async () => {
    const key = 'leave/00000000-0000-4000-8000-000000000000.png';
    await expect(storage.open(key)).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await expect(storage.remove(key)).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('gagal hapus selain ENOENT hanya dicatat sebagai peringatan', async () => {
    const key = 'leave/00000000-0000-4000-8000-000000000001.png';
    // Folder bernama seperti file → unlink gagal dengan EPERM/EISDIR, bukan ENOENT.
    await writeFile(join(root, 'placeholder'), '');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(root, key), { recursive: true });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await expect(storage.remove(key)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Gagal menghapus lampiran'));
  });
});
