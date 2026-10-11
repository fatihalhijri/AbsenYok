import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import sharp from 'sharp';
import { fieldError, notFoundError } from '@/common/exceptions/error-factories';
import { detectFileType } from '@/common/utils/file-type.util';
import { AppConfigService } from '@/config/app.config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ALLOWED_AVATAR_MIME,
  AVATAR_DIR_NAME,
  AVATAR_MAX_INPUT_PIXELS,
  AVATAR_PUBLIC_PATH,
  AVATAR_SIZE_PX,
} from './users.constants';

const AVATAR_FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;

/**
 * Avatar user: validasi isi file (magic bytes), resize 256×256, simpan WEBP.
 * Konversi ulang lewat sharp sekaligus membuang metadata EXIF (mis. lokasi GPS foto HP).
 */
@Injectable()
export class AvatarService implements OnModuleInit {
  private readonly logger = new Logger(AvatarService.name);
  private readonly avatarDir: string;
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfigService,
  ) {
    this.avatarDir = join(resolve(config.get('UPLOAD_DIR')), AVATAR_DIR_NAME);
    this.maxBytes = config.get('MAX_UPLOAD_SIZE_MB') * 1024 * 1024;
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.avatarDir, { recursive: true });
  }

  async updateAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<{ avatarUrl: string }> {
    const image = await this.processImage(file);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { avatarUrl: true },
    });
    if (!user) throw notFoundError('Pengguna tidak ditemukan');

    const filename = `${randomUUID()}.webp`;
    await mkdir(this.avatarDir, { recursive: true });
    await writeFile(join(this.avatarDir, filename), image);

    const avatarUrl = `${AVATAR_PUBLIC_PATH}/${filename}`;
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    } catch (error) {
      await this.deleteFile(filename);
      throw error;
    }

    if (user.avatarUrl?.startsWith(`${AVATAR_PUBLIC_PATH}/`)) {
      await this.deleteFile(basename(user.avatarUrl));
    }
    return { avatarUrl };
  }

  private async processImage(file: Express.Multer.File | undefined): Promise<Buffer> {
    if (!file?.buffer?.length) throw fieldError('file', 'File gambar wajib diunggah');
    if (file.size > this.maxBytes) {
      throw fieldError('file', `Ukuran file maksimal ${this.maxBytes / 1024 / 1024} MB`);
    }

    // Tipe ditentukan dari isi file — ekstensi/Content-Type bisa dipalsukan (mis. .exe → .jpg).
    const type = await detectFileType(file.buffer);
    if (!type || !ALLOWED_AVATAR_MIME.has(type.mime)) {
      throw fieldError('file', 'File harus berupa gambar JPG, PNG, atau WEBP');
    }

    try {
      return await sharp(file.buffer, { limitInputPixels: AVATAR_MAX_INPUT_PIXELS })
        .rotate()
        .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw fieldError('file', 'Gambar rusak atau tidak dapat diproses');
    }
  }

  /** Hanya menghapus file avatar milik sistem (nama UUID) di folder avatar. */
  private async deleteFile(filename: string): Promise<void> {
    if (!AVATAR_FILE_PATTERN.test(filename)) return;
    try {
      await unlink(join(this.avatarDir, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Gagal menghapus avatar lama ${filename}: ${String(error)}`);
      }
    }
  }
}
