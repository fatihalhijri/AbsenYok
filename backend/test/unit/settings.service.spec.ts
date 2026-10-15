import type { AppConfigService } from '@/config/app.config';
import type { Env } from '@/config/env.schema';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import type { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import { parseSettingValue } from '@/modules/settings/setting-definitions';
import { SettingsService } from '@/modules/settings/settings.service';
import type { PrismaService } from '@/prisma/prisma.service';

const env: Partial<Env> = {
  APP_NAME: 'AbsenYok',
  GEOFENCE_ENABLED: true,
  DEVICE_BINDING_ENABLED: false,
  MIN_CHECKOUT_GAP_MINUTES: 5,
};

function createService(rows: { key: string; value: string }[]) {
  const prisma = {
    setting: { findMany: jest.fn().mockResolvedValue(rows), upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  );
  const audit = { log: jest.fn() };
  const config = { get: (key: keyof Env) => env[key] } as unknown as AppConfigService;
  const service = new SettingsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditLogsService,
    config,
  );
  return { service, prisma, audit };
}

describe('SettingsService', () => {
  it('tanpa data tersimpan → fallback env / bawaan dengan tipe benar', async () => {
    const { service } = createService([]);
    await expect(service.getAll()).resolves.toEqual({
      'company.name': 'AbsenYok',
      'company.logoUrl': '',
      'attendance.geofenceEnabled': true,
      'attendance.deviceBindingEnabled': false,
      'attendance.minCheckoutGapMinutes': 5,
      'leave.annualQuota': 12,
      'leave.maxRangeDays': 14,
    });
  });

  it('nilai di tabel menimpa env dan diurai sesuai tipe', async () => {
    const { service } = createService([
      { key: 'attendance.geofenceEnabled', value: 'false' },
      { key: 'leave.annualQuota', value: '15' },
      { key: 'company.name', value: 'PT Maju Jaya' },
    ]);
    await expect(service.get('attendance.geofenceEnabled')).resolves.toBe(false);
    await expect(service.get('leave.annualQuota')).resolves.toBe(15);
    await expect(service.getPublic()).resolves.toEqual({
      companyName: 'PT Maju Jaya',
      logoUrl: '',
    });
  });

  it('nilai tersimpan yang rusak diabaikan (fallback)', async () => {
    const { service } = createService([{ key: 'leave.maxRangeDays', value: 'empat belas' }]);
    await expect(service.get('leave.maxRangeDays')).resolves.toBe(14);
  });

  it('cache: database hanya dibaca sekali sampai di-invalidate', async () => {
    const { service, prisma } = createService([]);
    await service.get('company.name');
    await service.getAll();
    expect(prisma.setting.findMany).toHaveBeenCalledTimes(1);

    service.invalidate();
    await service.get('company.name');
    expect(prisma.setting.findMany).toHaveBeenCalledTimes(2);
  });

  it('cache: hasil query lama yang selesai SETELAH invalidate tidak disimpan (race PATCH)', async () => {
    const { service, prisma } = createService([]);
    let releaseOld!: (rows: { key: string; value: string }[]) => void;
    prisma.setting.findMany.mockImplementationOnce(
      () => new Promise((resolve) => (releaseOld = resolve)),
    );
    const pending = service.get('attendance.geofenceEnabled');
    // PATCH selesai & invalidate selagi query lama masih berjalan.
    service.invalidate();
    releaseOld([{ key: 'attendance.geofenceEnabled', value: 'true' }]);
    await expect(pending).resolves.toBe(true);

    prisma.setting.findMany.mockResolvedValue([
      { key: 'attendance.geofenceEnabled', value: 'false' },
    ]);
    await expect(service.get('attendance.geofenceEnabled')).resolves.toBe(false);
  });

  it('update: hanya key yang berubah disimpan, audit before/after, cache dibuang', async () => {
    const { service, prisma, audit } = createService([]);
    const client = { ipAddress: '10.0.0.1', userAgent: 'jest' };

    await service.update(
      { 'leave.annualQuota': 15, 'attendance.geofenceEnabled': true },
      'sa-1',
      client,
    );

    expect(prisma.setting.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.setting.upsert).toHaveBeenCalledWith({
      where: { key: 'leave.annualQuota' },
      create: { key: 'leave.annualQuota', value: '15' },
      update: { value: '15' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SETTING_UPDATED,
        entityId: 'leave.annualQuota',
        metadata: { before: 12, after: 15 },
      }),
      prisma,
    );
    // getAll() setelah update memuat ulang dari database.
    expect(prisma.setting.findMany).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['boolean', 'true', true],
    ['boolean', 'ya', undefined],
    ['number', '7', 7],
    ['number', '', undefined],
    ['string', 'abc', 'abc'],
  ] as const)('parseSettingValue(%s, %j) → %j', (type, raw, expected) => {
    expect(parseSettingValue(type, raw)).toBe(expected);
  });
});
