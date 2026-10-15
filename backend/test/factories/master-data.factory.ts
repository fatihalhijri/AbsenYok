import { randomBytes } from 'node:crypto';
import { toDbDate } from '@/common/utils/date.util';
import type { Prisma } from '@/generated/prisma/client';
import type { PrismaService } from '@/prisma/prisma.service';

/** Shift reguler 08:00–17:00 Senin–Jumat (default skema), dapat ditimpa. */
export function createShift(prisma: PrismaService, data: Partial<Prisma.ShiftCreateInput> = {}) {
  return prisma.shift.create({
    data: { name: 'Reguler', startTime: '08:00', endTime: '17:00', ...data },
  });
}

export function createDepartment(
  prisma: PrismaService,
  data: Partial<Prisma.DepartmentCreateInput> & { code: string },
) {
  return prisma.department.create({ data: { name: `Departemen ${data.code}`, ...data } });
}

/** Lokasi kantor; koordinat diterima sebagai number lalu disimpan sebagai Decimal(10,7). */
export function createLocation(
  prisma: PrismaService,
  data: { latitude?: number; longitude?: number } & Partial<
    Omit<Prisma.LocationCreateInput, 'latitude' | 'longitude'>
  > = {},
) {
  const { latitude = -6.2, longitude = 106.8166667, ...rest } = data;
  return prisma.location.create({
    data: {
      name: 'Kantor Pusat',
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      ...rest,
    },
  });
}

/** Kiosk dengan secret acak 64 byte (hex) kecuali ditentukan. */
export function createKiosk(
  prisma: PrismaService,
  data: { locationId: string } & Partial<Omit<Prisma.KioskUncheckedCreateInput, 'locationId'>>,
) {
  return prisma.kiosk.create({
    data: { name: 'Lobi Utama', secret: randomBytes(64).toString('hex'), ...data },
  });
}

/** Hari libur pada tanggal lokal `YYYY-MM-DD`. */
export function createHoliday(prisma: PrismaService, date: string, name = 'Libur Uji') {
  return prisma.holiday.create({ data: { date: toDbDate(date), name } });
}
