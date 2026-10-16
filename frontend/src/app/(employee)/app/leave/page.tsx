import type { Metadata } from 'next';
import { LeaveListView } from '@/features/leave/components/leave-list-view';

export const metadata: Metadata = { title: 'Izin & Cuti' };

export default function LeavePage() {
  return <LeaveListView />;
}
