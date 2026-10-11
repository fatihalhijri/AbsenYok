import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import type { PrismaService } from '@/prisma/prisma.service';
import { assertTestDatabaseUrl } from './test-db';

type ControllerClass = new (...args: never[]) => unknown;

/** Aplikasi e2e identik dengan produksi (main.ts) plus controller khusus test. */
export async function createE2eApp(controllers: ControllerClass[] = []) {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  }).compile();

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
