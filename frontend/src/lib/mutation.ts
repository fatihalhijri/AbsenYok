'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error';

interface ToastMutationOptions<TInput, TResult> {
  mutationFn: (input: TInput) => Promise<TResult>;
  /** Query yang dimuat ulang setelah sukses (prefix key). */
  invalidate: QueryKey[];
  /** Pesan toast sukses (boleh bergantung pada hasil/input). */
  success: string | ((result: TResult, input: TInput) => string);
  /** Judul toast gagal; pesan detail diambil dari server. `false` = jangan toast (form menangani). */
  error?: string | false;
}

/**
 * Mutasi standar admin: toast sukses/gagal + invalidasi query terkait. Error tetap dilempar ke
 * pemanggil (`mutateAsync`) agar form bisa memetakan error per field.
 */
export function useToastMutation<TInput, TResult>({
  mutationFn,
  invalidate,
  success,
  error = 'Gagal menyimpan',
}: ToastMutationOptions<TInput, TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result, input) => {
      toast.success(typeof success === 'function' ? success(result, input) : success);
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
    onError: (cause) => {
      if (error !== false) toast.error(error, { description: getErrorMessage(cause) });
    },
  });
}
