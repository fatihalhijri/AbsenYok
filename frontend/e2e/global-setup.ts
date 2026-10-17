import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { api, DATA_FILE, type E2EData, loginApi } from './support';

interface IdName {
  id: string;
  name: string;
}
interface LocationRow extends IdName {
  latitude: number;
  longitude: number;
  isActive: boolean;
}
interface KioskRow extends IdName {
  isActive: boolean;
  location?: { id: string } | null;
}

/** Jam lokal Jakarta `HH:mm` 5 menit lalu (dibulatkan ke bawah per 5 menit, minimal 00:00). */
function shiftStartNow(): string {
  const now = new Date(Date.now() + 7 * 3_600_000);
  const minutes = Math.max(0, now.getUTCHours() * 60 + now.getUTCMinutes() - 5);
  const rounded = minutes - (minutes % 5);
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

/** Tanggal lokal Jakarta `YYYY-MM-DD` + offset hari. */
const jakartaDate = (offsetDays: number) =>
  new Date(Date.now() + 7 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * Data uji per run (tidak bergantung pada hari/jam): shift semua hari yang dimulai saat ini,
 * satu karyawan baru (perangkat belum terikat), satu pengajuan izin PENDING. Kredensial seed
 * dapat diganti lewat env.
 */
export default async function globalSetup() {
  const superAdmin = {
    email: process.env.E2E_SUPERADMIN_EMAIL ?? 'superadmin@absenyok.id',
    password: process.env.E2E_SUPERADMIN_PASSWORD ?? 'Admin@12345',
  };
  const token = await loginApi(superAdmin.email, superAdmin.password);
  const runId = Date.now().toString(36).toUpperCase();

  const locations = await api<LocationRow[]>('GET', '/locations?limit=100', { token });
  const location = locations.find((item) => item.isActive);
  if (!location) throw new Error('Seed tidak memiliki lokasi aktif');
  const kiosks = await api<KioskRow[]>('GET', '/kiosks?limit=100', { token });
  const kiosk = kiosks.find((item) => item.isActive && item.location?.id === location.id);
  if (!kiosk) throw new Error('Seed tidak memiliki kiosk aktif di lokasi tersebut');
  const departments = await api<IdName[]>('GET', '/departments?limit=100', { token });

  const shift = await api<IdName>('POST', '/shifts', {
    token,
    body: {
      name: `E2E ${runId}`,
      // Dimulai "baru saja" → scan berstatus Hadir (dalam toleransi), jendela terbuka s.d. 23:59.
      startTime: shiftStartNow(),
      endTime: '23:59',
      lateToleranceMinutes: 15,
      checkInOpenMinutes: 60,
      workDays: '1,2,3,4,5,6,7',
    },
  });

  const employee = {
    name: `E2E Karyawan ${runId}`,
    code: `E2E-${runId}`,
    email: `e2e-${runId.toLowerCase()}@uji.absenyok.id`,
    password: 'E2eRahasia123',
  };
  const created = await api<IdName>('POST', '/users', {
    token,
    body: {
      employeeCode: employee.code,
      name: employee.name,
      email: employee.email,
      password: employee.password,
      role: 'EMPLOYEE',
      departmentId: departments[0]?.id,
      shiftId: shift.id,
      locationId: location.id,
    },
  });

  const employeeToken = await loginApi(employee.email, employee.password);
  const form = new FormData();
  form.append('type', 'PERMIT');
  form.append('startDate', jakartaDate(14));
  form.append('endDate', jakartaDate(14));
  form.append('reason', `Keperluan keluarga (uji E2E ${runId})`);
  const leave = await api<IdName>('POST', '/leave-requests', { token: employeeToken, form });

  const data: E2EData = {
    runId,
    superAdmin,
    employee: { id: created.id, ...employee },
    location: { id: location.id, latitude: location.latitude, longitude: location.longitude },
    kioskId: kiosk.id,
    leaveId: leave.id,
  };
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
