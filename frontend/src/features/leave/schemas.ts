import { z } from '@/lib/zod';
import { MIN_REASON_LENGTH } from './rules';

/** Form pengajuan; aturan lintas field (lampiran wajib, batas tanggal) dicek di komponen. */
export const leaveFormSchema = z.object({
  type: z.enum(['SICK', 'PERMIT', 'ANNUAL'], { error: 'Pilih jenis pengajuan' }),
  range: z
    .object({ from: z.string().optional(), to: z.string().optional() })
    .refine((value) => value.from && value.to, { error: 'Pilih tanggal mulai dan selesai' }),
  reason: z
    .string()
    .trim()
    .min(MIN_REASON_LENGTH, { error: `Alasan minimal ${MIN_REASON_LENGTH} karakter` })
    .max(1000, { error: 'Alasan maksimal 1000 karakter' }),
});

export type LeaveFormValues = z.input<typeof leaveFormSchema>;
