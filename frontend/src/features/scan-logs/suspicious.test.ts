import { describe, expect, it } from 'vitest';
import type { ScanLog } from '@/types';
import { findSuspiciousUsers } from './suspicious';

let seq = 0;
function log(overrides: Partial<ScanLog> & { userId?: string | null } = {}): ScanLog {
  const { userId = 'u1', ...rest } = overrides;
  seq += 1;
  return {
    id: `log-${seq}`,
    createdAt: '2026-10-22T02:00:00.000Z', // 09:00 WIB
    scanType: 'KIOSK',
    success: false,
    errorCode: 'OUTSIDE_GEOFENCE',
    user: userId ? { id: userId, name: `Nama ${userId}`, employeeCode: 'EMP' } : null,
    kiosk: null,
    ...rest,
  };
}

const TODAY = '2026-10-22';

describe('findSuspiciousUsers', () => {
  it('≥ 3 kegagalan geofence/perangkat hari ini → ditandai, rincian per kode', () => {
    const result = findSuspiciousUsers(
      [
        log(),
        log({ errorCode: 'DEVICE_MISMATCH' }),
        log(),
        log({ userId: 'u2' }),
        log({ userId: 'u2' }),
      ],
      TODAY,
    );
    expect([...result.keys()]).toEqual(['u1']);
    expect(result.get('u1')).toEqual({
      userId: 'u1',
      name: 'Nama u1',
      total: 3,
      byCode: { OUTSIDE_GEOFENCE: 2, DEVICE_MISMATCH: 1 },
    });
  });

  it('kode lain, scan sukses, log tanpa user & hari lain tidak dihitung', () => {
    const result = findSuspiciousUsers(
      [
        log({ errorCode: 'QR_EXPIRED' }),
        log({ success: true, errorCode: null }),
        log({ userId: null }),
        log({ createdAt: '2026-10-21T16:59:00.000Z' }), // 23:59 WIB kemarin
        log(),
        log(),
      ],
      TODAY,
    );
    expect(result.size).toBe(0);
  });

  it('batas hari memakai zona aplikasi (00:30 WIB = 17:30 UTC hari sebelumnya)', () => {
    const early = '2026-10-21T17:30:00.000Z';
    const result = findSuspiciousUsers(
      [log({ createdAt: early }), log({ createdAt: early }), log({ createdAt: early })],
      TODAY,
    );
    expect(result.get('u1')?.total).toBe(3);
  });

  it('log dengan id sama (gabungan dua query) dihitung sekali', () => {
    const one = log();
    expect(findSuspiciousUsers([one, one, one, log()], TODAY).size).toBe(0);
  });
});
