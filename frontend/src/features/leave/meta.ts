import { CalendarHeartIcon, FileClockIcon, type LucideIcon, ThermometerIcon } from 'lucide-react';
import { LEAVE_TYPE_LABELS } from '@/features/attendance/today-status';
import type { LeaveType } from '@/types';

export const LEAVE_TYPE_META: Record<
  LeaveType,
  { label: string; description: string; icon: LucideIcon; tone: string }
> = {
  SICK: {
    label: LEAVE_TYPE_LABELS.SICK,
    description: 'Lebih dari 1 hari wajib surat dokter',
    icon: ThermometerIcon,
    tone: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  PERMIT: {
    label: LEAVE_TYPE_LABELS.PERMIT,
    description: 'Keperluan pribadi/keluarga',
    icon: FileClockIcon,
    tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  ANNUAL: {
    label: LEAVE_TYPE_LABELS.ANNUAL,
    description: 'Memotong kuota cuti tahunan',
    icon: CalendarHeartIcon,
    tone: 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300',
  },
};

export const LEAVE_TYPES: LeaveType[] = ['SICK', 'PERMIT', 'ANNUAL'];
