// Data dummy halaman demo sementara (FE-02) — dihapus di FE-08.
import type { AttendanceStatus, LeaveStatus } from '@/types';

export interface DemoEmployee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  status: AttendanceStatus;
  leaveStatus: LeaveStatus;
  /** Jam masuk `HH:mm` atau null (belum/tidak absen). */
  checkIn: string | null;
  lateMinutes: number;
}

const FIRST = ['Budi', 'Siti', 'Andi', 'Dewi', 'Rizky', 'Putri', 'Agus', 'Rina', 'Fajar', 'Maya'];
const LAST = ['Santoso', 'Rahmawati', 'Pratama', 'Lestari', 'Hidayat', 'Wulandari', 'Saputra'];
const DEPARTMENTS = ['Teknologi Informasi', 'Keuangan', 'Operasional', 'SDM', 'Pemasaran'];
const STATUSES: AttendanceStatus[] = [
  'PRESENT',
  'PRESENT',
  'LATE',
  'ABSENT',
  'SICK',
  'PERMIT',
  'LEAVE',
];
const LEAVE_STATUSES: LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

/** Deterministik (tanpa Math.random) agar HTML server = render client. */
export const DEMO_EMPLOYEES: DemoEmployee[] = Array.from({ length: 57 }, (_, index) => {
  const first = FIRST[index % FIRST.length];
  const last = LAST[(index * 3) % LAST.length];
  const status = STATUSES[(index * 5) % STATUSES.length];
  const worked = status === 'PRESENT' || status === 'LATE';
  const lateMinutes = status === 'LATE' ? 16 + ((index * 7) % 40) : 0;
  const minutes = 7 * 60 + 40 + (status === 'LATE' ? lateMinutes + 20 : (index * 3) % 30);
  return {
    id: `demo-${index + 1}`,
    employeeCode: `EMP${String(index + 1).padStart(3, '0')}`,
    name: `${first} ${last}`,
    email: `${first}.${last}${index + 1}@absenyok.id`.toLowerCase(),
    department: DEPARTMENTS[index % DEPARTMENTS.length],
    status,
    leaveStatus: LEAVE_STATUSES[(index * 2) % LEAVE_STATUSES.length],
    checkIn: worked
      ? `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      : null,
    lateMinutes,
  };
});

export type DemoSortField = 'employeeCode' | 'name' | 'department' | 'checkIn';

/** Simulasi endpoint berpaginasi (`?page&limit&search&sortBy&sortOrder`) seperti backend. */
export function queryDemoEmployees(params: {
  page: number;
  limit: number;
  search: string;
  department: string | null;
  sortBy: DemoSortField | null;
  sortOrder: 'asc' | 'desc';
}): { items: DemoEmployee[]; total: number } {
  const keyword = params.search.toLowerCase();
  let rows = DEMO_EMPLOYEES.filter(
    (row) =>
      (!keyword ||
        row.name.toLowerCase().includes(keyword) ||
        row.employeeCode.toLowerCase().includes(keyword)) &&
      (!params.department || row.department === params.department),
  );
  if (params.sortBy) {
    const field = params.sortBy;
    const direction = params.sortOrder === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const left = a[field] ?? '';
      const right = b[field] ?? '';
      return left < right ? -direction : left > right ? direction : 0;
    });
  }
  const start = (params.page - 1) * params.limit;
  return { items: rows.slice(start, start + params.limit), total: rows.length };
}

export const DEMO_DEPARTMENTS = DEPARTMENTS;
