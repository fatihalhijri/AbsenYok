import { describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_BYTES } from '@/lib/upload';
import { prepareAttachment } from './attachment';
import { attachmentRequired, earliestStartDate } from './rules';

const fileOf = (size: number, type: string, name = 'lampiran') =>
  new File([new Uint8Array(size)], name, { type });

describe('prepareAttachment (tanpa request)', () => {
  it('PDF ≤ 2 MB diterima apa adanya', async () => {
    const pdf = fileOf(MAX_UPLOAD_BYTES, 'application/pdf', 'surat.pdf');
    await expect(prepareAttachment(pdf)).resolves.toEqual({ ok: true, file: pdf });
  });

  it('PDF > 2 MB ditolak dengan pesan ukuran', async () => {
    const result = await prepareAttachment(fileOf(MAX_UPLOAD_BYTES + 1, 'application/pdf'));
    expect(result).toEqual({ ok: false, error: 'Ukuran file 2 MB — maksimal 2 MB' });
    const big = await prepareAttachment(fileOf(3.4 * 1024 * 1024, 'application/pdf'));
    expect(big).toMatchObject({
      ok: false,
      error: expect.stringMatching(/3,4 MB — maksimal 2 MB/),
    });
  });

  it('foto besar dikompres dulu; hasil ≤ 2 MB diterima', async () => {
    const photo = fileOf(5 * 1024 * 1024, 'image/jpeg', 'IMG_0001.jpg');
    const small = fileOf(600 * 1024, 'image/jpeg', 'IMG_0001.jpg');
    const compress = vi.fn(async () => small);
    await expect(prepareAttachment(photo, compress)).resolves.toEqual({ ok: true, file: small });
    expect(compress).toHaveBeenCalledWith(photo);
  });

  it('hasil kompres masih > 2 MB tetap ditolak', async () => {
    const huge = fileOf(MAX_UPLOAD_BYTES + 10, 'image/jpeg');
    const result = await prepareAttachment(huge, async (file) => file);
    expect(result).toMatchObject({ ok: false });
  });

  it('tipe lain (mis. .docx) & gambar rusak ditolak', async () => {
    const docx = fileOf(
      1000,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(await prepareAttachment(docx)).toEqual({
      ok: false,
      error: 'Format file harus JPG, PNG, atau PDF',
    });
    const broken = await prepareAttachment(fileOf(1000, 'image/heic'), async () => {
      throw new Error('decode');
    });
    expect(broken).toMatchObject({ ok: false, error: expect.stringMatching(/tidak dapat dibaca/) });
  });
});

describe('aturan form izin', () => {
  it('lampiran wajib hanya untuk Sakit > 1 hari kerja', () => {
    expect(attachmentRequired('SICK', 2)).toBe(true);
    expect(attachmentRequired('SICK', 1)).toBe(false);
    expect(attachmentRequired('PERMIT', 5)).toBe(false);
    expect(attachmentRequired(undefined, 5)).toBe(false);
  });

  it('tanggal paling awal = hari ini − 7', () => {
    expect(earliestStartDate('2026-10-16')).toBe('2026-10-09');
  });
});
