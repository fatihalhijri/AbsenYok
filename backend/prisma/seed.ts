/**
 * Seed data AbsenYok — idempoten (aman dijalankan berulang).
 *
 * Kebijakan: seed hanya MENGISI data yang belum ada; record yang sudah ada tidak ditimpa
 * (upsert dengan `update: {}`), sehingga perubahan dari aplikasi tetap aman.
 * Record tanpa kolom unik alami memakai UUID deterministik (lihat seed-utils.ts).
 *
 * Jalankan: npm run seed
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { fakerID_ID as faker } from '@faker-js/faker';
import { PASSWORD_POLICY_REGEX } from '@/common/constants/password-policy';
import {
  addDays,
  combineDateAndTime,
  diffMinutes,
  isoWeekday,
  setAppTimezone,
  toDbDate,
  todayDateString,
} from '@/common/utils/date.util';
import { hashPassword } from '@/common/utils/password.util';
import { validateEnv } from '@/config/env.schema';
import {
  AttendanceMethod,
  AttendanceStatus,
  LeaveStatus,
  LeaveType,
  type Prisma,
  PrismaClient,
  Role,
} from '@/generated/prisma/client';
import { createPrismaAdapter } from '@/prisma/prisma-adapter';
import { seedInt, seedRandom, seedUuid, slugifyName } from './seed-utils';

const env = validateEnv(process.env);
setAppTimezone(env.APP_TIMEZONE);

const prisma = new PrismaClient({
  adapter: createPrismaAdapter(env.DATABASE_URL, env.NODE_ENV === 'production'),
});

const EMPLOYEE_PASSWORD = 'Karyawan@123';
const EMAIL_DOMAIN = 'absenyok.id';
const FAKER_SEED = 2026;
const HISTORY_DAYS = 30;

// ------------------------------- DATA MASTER -------------------------------

const DEPARTMENTS = [
  { code: 'IT', name: 'Teknologi Informasi' },
  { code: 'HR', name: 'Sumber Daya Manusia' },
  { code: 'FIN', name: 'Keuangan' },
] as const;

type DepartmentCode = (typeof DEPARTMENTS)[number]['code'];

const POSITIONS: Record<DepartmentCode, string[]> = {
  IT: ['Software Engineer', 'QA Engineer', 'DevOps Engineer', 'UI/UX Designer'],
  HR: ['Staf HR', 'Rekruter', 'Staf Payroll'],
  FIN: ['Staf Akuntansi', 'Analis Keuangan', 'Staf Pajak'],
};

const SHIFTS = [
  {
    name: 'Reguler',
    startTime: '08:00',
    endTime: '17:00',
    lateToleranceMinutes: 15,
    checkInOpenMinutes: 60,
    workDays: '1,2,3,4,5',
  },
  {
    name: 'Pagi Sabtu',
    startTime: '08:00',
    endTime: '13:00',
    lateToleranceMinutes: 15,
    checkInOpenMinutes: 60,
    workDays: '1,2,3,4,5,6',
  },
] as const;

type ShiftSeed = (typeof SHIFTS)[number];

const LOCATION = {
  id: seedUuid('location:kantor-pusat'),
  name: 'Kantor Pusat',
  address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
  latitude: -6.2,
  longitude: 106.8166667,
  radiusMeters: 100,
};

const KIOSK = { id: seedUuid('kiosk:lobi-utama'), name: 'Lobi Utama' };

/**
 * Hari libur nasional bertanggal tetap. Libur berbasis kalender lunar (Idul Fitri, Imlek,
 * Nyepi, dll.) berubah setiap tahun sesuai SKB Menteri — tambahkan lewat menu admin.
 */
const FIXED_HOLIDAYS = [
  { monthDay: '01-01', name: 'Tahun Baru Masehi' },
  { monthDay: '05-01', name: 'Hari Buruh Internasional' },
  { monthDay: '06-01', name: 'Hari Lahir Pancasila' },
  { monthDay: '08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
  { monthDay: '12-25', name: 'Hari Raya Natal' },
];

// -------------------------------- HELPERS ----------------------------------

const workDaysOf = (shift: ShiftSeed): number[] => shift.workDays.split(',').map(Number);

const isWorkDay = (shift: ShiftSeed, dateStr: string): boolean =>
  workDaysOf(shift).includes(isoWeekday(dateStr));

/** Jumlah hari kerja (sesuai shift, di luar hari libur) dalam rentang inklusif. */
function countWorkDays(
  shift: ShiftSeed,
  startDate: string,
  endDate: string,
  holidays: Set<string>,
): number {
  let total = 0;
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (isWorkDay(shift, date) && !holidays.has(date)) total += 1;
  }
  return total;
}

/** Hari kerja pertama mulai `fromDate` (inklusif) sesuai shift, di luar hari libur. */
function firstWorkDayFrom(shift: ShiftSeed, fromDate: string, holidays: Set<string>): string {
  let date = fromDate;
  while (!isWorkDay(shift, date) || holidays.has(date)) date = addDays(date, 1);
  return date;
}

/** Tanggal berikutnya setelah `fromDate` dengan hari ISO tertentu (1 = Senin). */
function nextWeekday(fromDate: string, weekday: number): string {
  let date = addDays(fromDate, 1);
  while (isoWeekday(date) !== weekday) date = addDays(date, 1);
  return date;
}

/** Koordinat acak (deterministik) dalam ±~30 m dari kantor, sebagai string Decimal(10,7). */
function jitterCoordinate(base: number, key: string): string {
  return (base + (seedRandom(key) - 0.5) * 0.0006).toFixed(7);
}

function addMinutes(date: Date, minutes: number, seconds = 0): Date {
  return new Date(date.getTime() + minutes * 60_000 + seconds * 1_000);
}

// --------------------------------- SEEDERS ---------------------------------

async function seedDepartments(): Promise<Map<DepartmentCode, string>> {
  const ids = new Map<DepartmentCode, string>();
  for (const department of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { code: department.code },
      create: department,
      update: {},
      select: { id: true },
    });
    ids.set(department.code, row.id);
  }
  return ids;
}

async function seedShifts(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const shift of SHIFTS) {
    const row = await prisma.shift.upsert({
      where: { name: shift.name },
      create: shift,
      update: {},
      select: { id: true },
    });
    ids.set(shift.name, row.id);
  }
  return ids;
}

async function seedLocationAndKiosk(): Promise<void> {
  await prisma.location.upsert({
    where: { id: LOCATION.id },
    create: {
      ...LOCATION,
      latitude: LOCATION.latitude.toFixed(7),
      longitude: LOCATION.longitude.toFixed(7),
    },
    update: {},
  });

  await prisma.kiosk.upsert({
    where: { id: KIOSK.id },
    create: {
      ...KIOSK,
      locationId: LOCATION.id,
      // Secret hanya dibuat sekali; seed ulang tidak merotasi agar QR yang tampil tetap valid.
      secret: randomBytes(64).toString('hex'),
      qrIntervalSeconds: env.QR_KIOSK_INTERVAL_SECONDS,
    },
    update: {},
  });
}

async function seedHolidays(year: number): Promise<Set<string>> {
  for (const holiday of FIXED_HOLIDAYS) {
    const date = `${year}-${holiday.monthDay}`;
    await prisma.holiday.upsert({
      where: { date: toDbDate(date) },
      create: { date: toDbDate(date), name: holiday.name },
      update: {},
    });
  }

  const rows = await prisma.holiday.findMany({ select: { date: true } });
  return new Set(rows.map((row) => row.date.toISOString().slice(0, 10)));
}

async function seedSettings(): Promise<void> {
  const defaults: Record<string, string> = {
    'company.name': 'PT AbsenYok Indonesia',
    'company.logoUrl': '',
    'attendance.geofenceEnabled': String(env.GEOFENCE_ENABLED),
    'attendance.deviceBindingEnabled': String(env.DEVICE_BINDING_ENABLED),
    'attendance.minCheckoutGapMinutes': String(env.MIN_CHECKOUT_GAP_MINUTES),
    'leave.annualQuota': '12',
    'leave.maxRangeDays': '14',
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }
}

interface SeededEmployee {
  id: string;
  employeeCode: string;
  shift: ShiftSeed;
}

interface SeededUsers {
  adminId: string;
  employees: SeededEmployee[];
}

async function seedUsers(
  departmentIds: Map<DepartmentCode, string>,
  shiftIds: Map<string, string>,
): Promise<SeededUsers> {
  const adminPassword = env.SEED_DEFAULT_PASSWORD;
  if (!adminPassword || !PASSWORD_POLICY_REGEX.test(adminPassword)) {
    throw new Error(
      'SEED_DEFAULT_PASSWORD wajib diisi: minimal 8 karakter dengan huruf besar, huruf kecil, dan angka',
    );
  }

  const admins = [
    {
      employeeCode: 'SA001',
      name: 'Super Admin',
      email: `superadmin@${EMAIL_DOMAIN}`,
      position: 'Administrator Sistem',
      role: Role.SUPER_ADMIN,
      department: 'IT' as const,
    },
    {
      employeeCode: 'ADM001',
      name: 'Admin HR',
      email: `admin@${EMAIL_DOMAIN}`,
      position: 'HR Manager',
      role: Role.ADMIN,
      department: 'HR' as const,
    },
  ];

  let adminId = '';
  for (const admin of admins) {
    const { department, ...data } = admin;
    const row = await prisma.user.upsert({
      where: { employeeCode: admin.employeeCode },
      create: {
        ...data,
        passwordHash: await hashPassword(adminPassword),
        departmentId: departmentIds.get(department),
        locationId: LOCATION.id,
      },
      update: {},
      select: { id: true },
    });
    if (admin.role === Role.ADMIN) adminId = row.id;
  }

  faker.seed(FAKER_SEED);
  const usedEmails = new Set<string>();
  const employees: SeededEmployee[] = [];

  for (let index = 0; index < 10; index += 1) {
    const employeeCode = `EMP${String(index + 1).padStart(3, '0')}`;
    const department = DEPARTMENTS[index % DEPARTMENTS.length].code;
    const shift = index < 8 ? SHIFTS[0] : SHIFTS[1];

    const name = `${faker.person.firstName()} ${faker.person.lastName()}`;
    const phone = `08${faker.string.numeric(10)}`;
    const position = faker.helpers.arrayElement(POSITIONS[department]);

    let email = `${slugifyName(name)}@${EMAIL_DOMAIN}`;
    if (usedEmails.has(email)) email = `${slugifyName(name)}.${index + 1}@${EMAIL_DOMAIN}`;
    usedEmails.add(email);

    const row = await prisma.user.upsert({
      where: { employeeCode },
      create: {
        employeeCode,
        name,
        email,
        phone,
        position,
        role: Role.EMPLOYEE,
        passwordHash: await hashPassword(EMPLOYEE_PASSWORD),
        departmentId: departmentIds.get(department),
        shiftId: shiftIds.get(shift.name),
        locationId: LOCATION.id,
      },
      update: {},
      select: { id: true },
    });
    employees.push({ id: row.id, employeeCode, shift });
  }

  return { adminId, employees };
}

interface HistoryStats {
  created: number;
  skipped: number;
  approvedLeaves: number;
}

/** Kuota kumulatif status: 75% PRESENT, 12% LATE, 5% ABSENT, 4% SICK, 4% PERMIT. */
const STATUS_QUOTAS: [number, AttendanceStatus][] = [
  [0.75, AttendanceStatus.PRESENT],
  [0.87, AttendanceStatus.LATE],
  [0.92, AttendanceStatus.ABSENT],
  [0.96, AttendanceStatus.SICK],
  [1, AttendanceStatus.PERMIT],
];

/** Status untuk slot ke-`rank` dari `total` slot (slot sudah diacak deterministik). */
function statusForRank(rank: number, total: number): AttendanceStatus {
  const position = rank / total;
  return STATUS_QUOTAS.find(([limit]) => position < limit)?.[1] ?? AttendanceStatus.PRESENT;
}

function buildCheckedInAttendance(
  employee: SeededEmployee,
  date: string,
  status: 'PRESENT' | 'LATE',
  key: string,
): Omit<Prisma.AttendanceUncheckedCreateInput, 'id' | 'userId' | 'date'> {
  const { shift } = employee;
  const shiftStart = combineDateAndTime(date, shift.startTime);
  const shiftEnd = combineDateAndTime(date, shift.endTime);
  const seconds = seedInt(`${key}:sec`, 0, 59);

  // PRESENT: datang 40 menit sebelum s.d. 10 menit sesudah jam masuk (masih dalam toleransi).
  // LATE: melewati toleransi 15 menit → 16–45 menit dari jam masuk (BUSINESS-RULES §5).
  const lateMinutes = status === 'LATE' ? seedInt(`${key}:late`, 16, 45) : 0;
  const checkInOffset = status === 'LATE' ? lateMinutes : seedInt(`${key}:early`, -40, 10);
  const checkInAt = addMinutes(shiftStart, checkInOffset, seconds);

  // ~6% pulang 5–30 menit lebih awal, sisanya 0–60 menit setelah jam pulang.
  const leavesEarly = seedRandom(`${key}:leaveEarly`) < 0.06;
  const checkOutOffset = leavesEarly
    ? -seedInt(`${key}:earlyLeave`, 5, 30)
    : seedInt(`${key}:overtime`, 0, 60);
  const checkOutAt = addMinutes(shiftEnd, checkOutOffset, seedInt(`${key}:outSec`, 0, 59));

  return {
    status,
    checkInAt,
    checkOutAt,
    checkInMethod: AttendanceMethod.KIOSK_QR,
    checkOutMethod: AttendanceMethod.KIOSK_QR,
    checkInLat: jitterCoordinate(LOCATION.latitude, `${key}:inLat`),
    checkInLng: jitterCoordinate(LOCATION.longitude, `${key}:inLng`),
    checkOutLat: jitterCoordinate(LOCATION.latitude, `${key}:outLat`),
    checkOutLng: jitterCoordinate(LOCATION.longitude, `${key}:outLng`),
    lateMinutes,
    earlyLeaveMinutes: Math.max(0, diffMinutes(shiftEnd, checkOutAt)),
    workMinutes: diffMinutes(checkOutAt, checkInAt),
    shiftSnapshot: {
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      lateToleranceMinutes: shift.lateToleranceMinutes,
    },
    kioskId: KIOSK.id,
    locationId: LOCATION.id,
  };
}

async function seedAttendanceHistory(
  { adminId, employees }: SeededUsers,
  today: string,
  holidays: Set<string>,
): Promise<HistoryStats> {
  const stats: HistoryStats = { created: 0, skipped: 0, approvedLeaves: 0 };
  const firstDate = addDays(today, -HISTORY_DAYS);

  // Slot yang sudah punya absensi dilewati: seed tidak menimpa histori (termasuk hasil seed lama).
  const existing = await prisma.attendance.findMany({
    where: {
      userId: { in: employees.map((employee) => employee.id) },
      date: { gte: toDbDate(firstDate), lt: toDbDate(today) },
    },
    select: { userId: true, date: true },
  });
  const existingKeys = new Set(
    existing.map((row) => `${row.userId}:${row.date.toISOString().slice(0, 10)}`),
  );

  const slots: { employee: SeededEmployee; date: string; key: string }[] = [];
  for (const employee of employees) {
    for (let offset = HISTORY_DAYS; offset >= 1; offset -= 1) {
      const date = addDays(today, -offset);
      if (!isWorkDay(employee.shift, date) || holidays.has(date)) continue;
      if (existingKeys.has(`${employee.id}:${date}`)) continue;
      slots.push({ employee, date, key: `attendance:${employee.employeeCode}:${date}` });
    }
  }

  stats.skipped = existing.length;

  // Acak deterministik lalu bagi sesuai kuota agar komposisi status tepat.
  slots.sort((a, b) => seedRandom(`${a.key}:rank`) - seedRandom(`${b.key}:rank`));
  const statusByKey = new Map(
    slots.map((slot, rank) => [slot.key, statusForRank(rank, slots.length)]),
  );

  for (const employee of employees) {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    for (const { date, key } of slots.filter((slot) => slot.employee === employee)) {
      const status = statusByKey.get(key) ?? AttendanceStatus.PRESENT;
      const where = { userId_date: { userId: employee.id, date: toDbDate(date) } };
      const base = { id: seedUuid(key), userId: employee.id, date: toDbDate(date) };

      if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE) {
        const data = buildCheckedInAttendance(employee, date, status, key);
        operations.push(
          prisma.attendance.upsert({ where, create: { ...base, ...data }, update: {} }),
        );
      } else if (status === AttendanceStatus.ABSENT) {
        operations.push(
          prisma.attendance.upsert({ where, create: { ...base, status }, update: {} }),
        );
      } else {
        // SICK / PERMIT selalu berasal dari pengajuan yang sudah disetujui.
        const leaveId = seedUuid(`leave:${employee.employeeCode}:${date}`);
        const isSick = status === AttendanceStatus.SICK;
        operations.push(
          prisma.leaveRequest.upsert({
            where: { id: leaveId },
            create: {
              id: leaveId,
              userId: employee.id,
              type: isSick ? LeaveType.SICK : LeaveType.PERMIT,
              startDate: toDbDate(date),
              endDate: toDbDate(date),
              totalDays: 1,
              reason: isSick ? 'Demam dan perlu istirahat' : 'Keperluan keluarga',
              status: LeaveStatus.APPROVED,
              reviewedById: adminId,
              reviewedAt: combineDateAndTime(date, '07:30'),
              reviewNote: 'Disetujui',
            },
            update: {},
          }),
          prisma.attendance.upsert({
            where,
            create: { ...base, status, leaveRequestId: leaveId },
            update: {},
          }),
        );
        stats.approvedLeaves += 1;
      }
      stats.created += 1;
    }

    if (operations.length > 0) await prisma.$transaction(operations);
  }

  return stats;
}

async function seedPendingLeaves(
  employees: SeededEmployee[],
  today: string,
  holidays: Set<string>,
): Promise<number> {
  const byCode = new Map(employees.map((employee) => [employee.employeeCode, employee]));
  const nextMonday = nextWeekday(today, 1);
  const nextWednesday = addDays(nextMonday, 2);
  // Pengajuan sakit untuk hari ini, atau hari kerja terdekat bila hari ini libur/akhir pekan.
  const sickDate = firstWorkDayFrom(byCode.get('EMP007')?.shift ?? SHIFTS[0], today, holidays);

  const pending = [
    {
      code: 'EMP001',
      type: LeaveType.ANNUAL,
      startDate: nextMonday,
      endDate: addDays(nextMonday, 1),
      reason: 'Cuti tahunan untuk menghadiri pernikahan saudara di luar kota',
    },
    {
      code: 'EMP004',
      type: LeaveType.PERMIT,
      startDate: nextWednesday,
      endDate: nextWednesday,
      reason: 'Mengurus perpanjangan dokumen kependudukan',
    },
    {
      code: 'EMP007',
      type: LeaveType.SICK,
      startDate: sickDate,
      endDate: sickDate,
      reason: 'Sakit kepala dan demam sejak pagi',
    },
  ];

  for (const leave of pending) {
    const employee = byCode.get(leave.code);
    if (!employee) continue;

    // Kunci tanpa tanggal: seed di hari lain tidak membuat pengajuan baru.
    const id = seedUuid(`pending-leave:${leave.code}:${leave.type}`);
    await prisma.leaveRequest.upsert({
      where: { id },
      create: {
        id,
        userId: employee.id,
        type: leave.type,
        startDate: toDbDate(leave.startDate),
        endDate: toDbDate(leave.endDate),
        totalDays: countWorkDays(employee.shift, leave.startDate, leave.endDate, holidays),
        reason: leave.reason,
        status: LeaveStatus.PENDING,
      },
      update: {},
    });
  }

  return pending.length;
}

// ---------------------------------- MAIN -----------------------------------

async function main(): Promise<void> {
  const today = todayDateString();
  console.log(`🌱 Seed AbsenYok — tanggal lokal ${today} (${env.APP_TIMEZONE})`);

  const departmentIds = await seedDepartments();
  const shiftIds = await seedShifts();
  await seedLocationAndKiosk();
  const holidays = await seedHolidays(Number(today.slice(0, 4)));
  await seedSettings();
  const users = await seedUsers(departmentIds, shiftIds);
  const history = await seedAttendanceHistory(users, today, holidays);
  const pendingLeaves = await seedPendingLeaves(users.employees, today, holidays);

  console.log(`   ✔ ${DEPARTMENTS.length} departemen, ${SHIFTS.length} shift, 1 lokasi, 1 kiosk`);
  console.log(`   ✔ ${holidays.size} hari libur, ${users.employees.length + 2} pengguna`);
  console.log(
    `   ✔ absensi ${HISTORY_DAYS} hari terakhir: ${history.created} dibuat, ${history.skipped} sudah ada ` +
      `(${history.approvedLeaves} izin disetujui baru), ${pendingLeaves} izin menunggu persetujuan`,
  );
  console.log('\n🔑 Akun login:');
  console.log(`   SUPER_ADMIN  superadmin@${EMAIL_DOMAIN}  / (SEED_DEFAULT_PASSWORD)`);
  console.log(`   ADMIN        admin@${EMAIL_DOMAIN}       / (SEED_DEFAULT_PASSWORD)`);
  console.log(`   EMPLOYEE     EMP001–EMP010 (lihat tabel users) / ${EMPLOYEE_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed gagal:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
