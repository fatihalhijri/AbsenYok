import { Injectable } from '@nestjs/common';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { AppConfigService } from '@/config/app.config';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import {
  parseSettingValue,
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  type SettingKey,
  type SettingValues,
} from './setting-definitions';

export interface PublicSettings {
  companyName: string;
  logoUrl: string;
}

/**
 * Pengaturan key-value dengan cache in-memory (dimuat sekali, dibuang saat update).
 * Catatan: cache per proses — bila backend dijalankan multi-instance, perubahan di satu
 * instance baru terlihat di instance lain setelah restart.
 */
@Injectable()
export class SettingsService {
  private cache: Map<string, string> | null = null;
  /** Naik setiap invalidate; hasil query yang dimulai sebelum invalidate tidak disimpan ke cache. */
  private generation = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
    private readonly config: AppConfigService,
  ) {}

  /** Nilai bertipe; fallback ke env/bawaan bila belum tersimpan atau tidak valid. */
  async get<K extends SettingKey>(key: K): Promise<SettingValues[K]> {
    const stored = (await this.load()).get(key);
    return this.resolve(key, stored);
  }

  async getAll(): Promise<SettingValues> {
    const stored = await this.load();
    return Object.fromEntries(
      SETTING_KEYS.map((key) => [key, this.resolve(key, stored.get(key))]),
    ) as SettingValues;
  }

  async getPublic(): Promise<PublicSettings> {
    const [companyName, logoUrl] = await Promise.all([
      this.get('company.name'),
      this.get('company.logoUrl'),
    ]);
    return { companyName, logoUrl };
  }

  /** Simpan key yang berubah dalam satu transaksi + audit `SETTING_UPDATED` per key. */
  async update(
    changes: Partial<SettingValues>,
    actorId: string,
    client: ClientInfo,
  ): Promise<SettingValues> {
    const before = await this.getAll();
    const changed = (Object.entries(changes) as [SettingKey, SettingValues[SettingKey]][]).filter(
      ([key, value]) => value !== undefined && value !== before[key],
    );

    if (changed.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const [key, value] of changed) {
          await tx.setting.upsert({
            where: { key },
            create: { key, value: String(value) },
            update: { value: String(value) },
          });
          await this.audit.log(
            {
              actorId,
              action: AuditAction.SETTING_UPDATED,
              entity: 'Setting',
              entityId: key,
              metadata: { before: before[key], after: value },
              ip: client.ipAddress,
              userAgent: client.userAgent,
            },
            tx,
          );
        }
      });
      this.invalidate();
    }

    return this.getAll();
  }

  invalidate(): void {
    this.generation += 1;
    this.cache = null;
  }

  private resolve<K extends SettingKey>(key: K, stored: string | undefined): SettingValues[K] {
    const definition = SETTING_DEFINITIONS[key];
    const parsed = stored === undefined ? undefined : parseSettingValue(definition.type, stored);
    return (parsed ?? definition.fallback(this.config)) as SettingValues[K];
  }

  private async load(): Promise<Map<string, string>> {
    if (this.cache) return this.cache;
    const generation = this.generation;
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: SETTING_KEYS } },
      select: { key: true, value: true },
    });
    const loaded = new Map(rows.map((row) => [row.key, row.value]));
    // PATCH /settings yang selesai selagi query berjalan → nilai ini mungkin lama; jangan di-cache.
    if (generation === this.generation) this.cache = loaded;
    return loaded;
  }
}
