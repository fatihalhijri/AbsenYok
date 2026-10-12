import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import type { Role } from '@/common/constants/roles';
import { hashPassword } from '@/common/utils/password.util';
import type { PrismaService } from '@/prisma/prisma.service';
import { assertTestDatabaseUrl } from './test-db';

type ControllerClass = new (...args: never[]) => unknown;

/**
 * Aplikasi e2e identik dengan produksi (main.ts) plus controller khusus test.
 * `configure` dapat dipakai untuk override provider (mis. ClockService palsu).
 */
export async function createE2eApp(
  controllers: ControllerClass[] = [],
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
) {
  const moduleRef = await configure(
    Test.createTestingModule({ imports: [AppModule], controllers }),
  ).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  await app.init();
  return app;
}

/** Kosongkan semua tabel (urutan sesuai relasi). Hanya untuk database `_test`. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.attendanceScanLog.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.kiosk.deleteMany(),
    prisma.location.deleteMany(),
    prisma.shift.deleteMany(),
    prisma.department.deleteMany(),
    prisma.holiday.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
}

/** Nilai cookie dari header Set-Cookie (`undefined` bila tidak ada). */
export function getCookie(setCookie: string[] | string | undefined, name: string) {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const raw = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!raw) return undefined;
  const [pair, ...attributes] = raw.split(';').map((part) => part.trim());
  return { value: decodeURIComponent(pair.slice(name.length + 1)), attributes, raw };
}

/** Pastikan respons tidak pernah membocorkan hash/rahasia. */
export function expectNoSecrets(body: unknown): void {
  const json = JSON.stringify(body);
  for (const secret of ['passwordHash', 'tokenHash', '$argon2', 'boundDeviceId', 'secret']) {
    expect(json).not.toContain(secret);
  }
}

export const E2E_PASSWORD = 'Rahasia@123';

/** Buat user langsung di database (fixture). */
export async function createUserFixture(
  prisma: PrismaService,
  data: { employeeCode: string; email: string; role: Role; isActive?: boolean; shiftId?: string },
) {
  return prisma.user.create({
    data: {
      ...data,
      name: `User ${data.employeeCode}`,
      passwordHash: await hashPassword(E2E_PASSWORD),
    },
  });
}

/** Penghitung IP unik per file test — throttle login dihitung per IP. */
export function createIpSequence(prefix = '203.0.113') {
  let seq = 0;
  return () => `${prefix}.${(seq = (seq % 250) + 1)}`;
}

/** Login dan kembalikan access token. */
export async function loginToken(
  http: App,
  email: string,
  ip: string,
  password = E2E_PASSWORD,
): Promise<string> {
  const res = await request(http)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login ${email} gagal: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return (res.body as { data: { accessToken: string } }).data.accessToken;
}

/** Daftar field dari `error.details` respons validasi (urut abjad). */
export function errorFields(body: unknown): string[] {
  const details = (body as { error?: { details?: { field: string }[] } }).error?.details ?? [];
  return details.map((detail) => detail.field).sort();
}

/** Jam palsu untuk ClockService — logika absensi diuji pada jam tertentu. */
export class FakeClock {
  private current = new Date();

  now(): Date {
    return new Date(this.current);
  }

  /** `set('2026-10-19T07:50:00+07:00')` */
  set(instant: string | Date): void {
    this.current = new Date(instant);
  }
}
