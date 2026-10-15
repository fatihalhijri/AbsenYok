import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { ErrorCode } from '@/common/constants/error-codes';
import {
  PersonalScanThrottleGuard,
  SCAN_RATE_LIMIT,
  ScanThrottleGuard,
} from '@/modules/attendance/scan-throttle.guard';

const OFFICER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPLOYEE_A = '11111111-1111-4111-8111-111111111111';
const EMPLOYEE_B = '22222222-2222-4222-8222-222222222222';
const personalToken = (userId: string) => `AY1.P.${userId}.29433840.${'x'.repeat(22)}`;

/** Storage throttler sederhana (hitung per kunci) yang mencatat kunci yang dipakai. */
function memoryStorage() {
  const hits = new Map<string, number>();
  const storage = {
    increment: jest.fn((key: string, _ttl: number, limit: number) => {
      const total = (hits.get(key) ?? 0) + 1;
      hits.set(key, total);
      return Promise.resolve({
        totalHits: total,
        timeToExpire: 60,
        isBlocked: total > limit,
        timeToBlockExpire: 42,
      });
    }),
  };
  return { storage: storage as unknown as ThrottlerStorage, keys: () => [...hits.keys()] };
}

function context(body: unknown, userId = OFFICER) {
  const response = { setHeader: jest.fn() };
  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId }, ip: '10.0.0.1', body }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext,
    response,
  };
}

async function hit(guard: ScanThrottleGuard, body: unknown, times: number) {
  const results: (true | string)[] = [];
  for (let i = 0; i < times; i += 1) {
    results.push(
      await guard.canActivate(context(body).context).then(
        () => true as const,
        (error: { code: string }) => error.code,
      ),
    );
  }
  return results;
}

describe('ScanThrottleGuard', () => {
  it('scan kiosk: 10/menit per user, ke-11 → 429 dengan Retry-After', async () => {
    const { storage, keys } = memoryStorage();
    const guard = new ScanThrottleGuard(storage);
    const results = await hit(guard, { qrToken: 'AY1.K...' }, SCAN_RATE_LIMIT.limit + 1);
    expect(results.slice(0, SCAN_RATE_LIMIT.limit).every((r) => r === true)).toBe(true);
    expect(results.at(-1)).toBe(ErrorCode.TOO_MANY_REQUESTS);
    expect(keys()).toEqual([`scan:${OFFICER}`]);

    const { context: ctx, response } = context({});
    await expect(guard.canActivate(ctx)).rejects.toBeDefined();
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });
});

describe('PersonalScanThrottleGuard', () => {
  it('satu petugas memindai banyak karyawan → tidak terkena batas petugas', async () => {
    const { storage, keys } = memoryStorage();
    const guard = new PersonalScanThrottleGuard(storage);
    for (let i = 0; i < SCAN_RATE_LIMIT.limit; i += 1) {
      await expect(hit(guard, { qrToken: personalToken(EMPLOYEE_A) }, 1)).resolves.toEqual([true]);
    }
    // Karyawan lain tetap bisa dipindai petugas yang sama.
    await expect(hit(guard, { qrToken: personalToken(EMPLOYEE_B) }, 1)).resolves.toEqual([true]);
    expect(keys()).toEqual([`scan:employee:${EMPLOYEE_A}`, `scan:employee:${EMPLOYEE_B}`]);
  });

  it('QR karyawan yang sama > 10/menit → 429', async () => {
    const { storage } = memoryStorage();
    const results = await hit(
      new PersonalScanThrottleGuard(storage),
      { qrToken: personalToken(EMPLOYEE_A) },
      SCAN_RATE_LIMIT.limit + 1,
    );
    expect(results.at(-1)).toBe(ErrorCode.TOO_MANY_REQUESTS);
  });

  it('token yang tidak bisa diurai dihitung per petugas (brute force tetap dibatasi)', async () => {
    const { storage, keys } = memoryStorage();
    const results = await hit(
      new PersonalScanThrottleGuard(storage),
      { qrToken: 'sampah' },
      SCAN_RATE_LIMIT.limit + 1,
    );
    expect(results.at(-1)).toBe(ErrorCode.TOO_MANY_REQUESTS);
    expect(keys()).toEqual([`scan:officer:${OFFICER}`]);
  });
});
