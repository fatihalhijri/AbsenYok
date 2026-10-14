import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ReadStream } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { fieldError, notFoundError } from '@/common/exceptions/error-factories';
import { detectFileType } from '@/common/utils/file-type.util';
import { AppConfigService } from '@/config/app.config';

const LEAVE_DIR = 'leave';
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};
/** Kunci tersimpan di `leave_requests.attachmentUrl` — divalidasi ketat (anti path traversal). */
const KEY_PATTERN = /^leave\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;

export interface ValidatedAttachment {
  buffer: Buffer;
  ext: string;
}

export interface AttachmentFile {
  stream: ReadStream;
  mime: string;
  ext: string;
  size: number;
}

/**
 * Lampiran izin (mis. surat dokter) berisi data sensitif: disimpan di `UPLOAD_DIR/leave/`
 * dan HANYA disajikan lewat endpoint ber-otorisasi, tidak lewat folder statis publik.
 */
@Injectable()
export class LeaveAttachmentStorage {
  private readonly logger = new Logger(LeaveAttachmentStorage.name);
  private readonly root: string;
  private readonly maxBytes: number;

  constructor(config: AppConfigService) {
    this.root = resolve(config.get('UPLOAD_DIR'));
    this.maxBytes = config.get('MAX_UPLOAD_SIZE_MB') * 1024 * 1024;
  }

  /** Validasi ukuran & tipe dari isi file (magic bytes) — ekstensi/Content-Type diabaikan. */
  async validate(file: Express.Multer.File): Promise<ValidatedAttachment> {
    if (!file.buffer?.length) throw fieldError('attachment', 'File lampiran kosong');
    if (file.size > this.maxBytes) {
      throw fieldError('attachment', `Ukuran lampiran maksimal ${this.maxBytes / 1024 / 1024} MB`);
    }
    const type = await detectFileType(file.buffer);
    const ext = type ? ALLOWED[type.mime] : undefined;
    if (!ext) throw fieldError('attachment', 'Lampiran harus berupa JPG, PNG, atau PDF');
    return { buffer: file.buffer, ext };
  }

  /** Simpan file yang sudah divalidasi; mengembalikan kunci relatif `leave/<uuid>.<ext>`. */
  async save(attachment: ValidatedAttachment): Promise<string> {
    const key = `${LEAVE_DIR}/${randomUUID()}.${attachment.ext}`;
    await mkdir(join(this.root, LEAVE_DIR), { recursive: true });
    await writeFile(this.pathOf(key), attachment.buffer);
    return key;
  }

  async open(key: string): Promise<AttachmentFile> {
    const path = this.pathOf(key);
    try {
      const info = await stat(path);
      const ext = key.split('.').pop() ?? '';
      return { stream: createReadStream(path), mime: MIME_BY_EXT[ext], ext, size: info.size };
    } catch {
      throw notFoundError('File lampiran tidak ditemukan');
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Gagal menghapus lampiran ${key}: ${String(error)}`);
      }
    }
  }

  private pathOf(key: string): string {
    if (!KEY_PATTERN.test(key)) throw notFoundError('File lampiran tidak ditemukan');
    return join(this.root, key);
  }
}
