import type { Metadata } from 'next';
import { EmployeeHome } from '@/features/attendance/components/employee-home';

export const metadata: Metadata = { title: 'Beranda' };

export default function EmployeeHomePage() {
  return <EmployeeHome />;
}
