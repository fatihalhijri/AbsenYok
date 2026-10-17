'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronsUpDownIcon, Loader2Icon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { employeeKeys, employeesApi } from '@/features/employees/api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import type { Role, User } from '@/types';

interface UserComboboxProps {
  id?: string;
  value: string | null;
  onChange: (userId: string | null, user: User | null) => void;
  /** Batasi role (mis. `EMPLOYEE` untuk absensi manual). */
  role?: Role;
  /** Hanya akun aktif. */
  activeOnly?: boolean;
  placeholder?: string;
  /** Tampilkan tombol hapus pilihan (untuk filter). */
  clearable?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Combobox pencarian pengguna di server (nama/NIP/email, debounce 300 ms, 20 hasil teratas).
 * Label pilihan dari URL (mis. filter aktor) diambil lewat `GET /users/:id`.
 */
export function UserCombobox({
  id,
  value,
  onChange,
  role,
  activeOnly,
  placeholder = 'Pilih karyawan…',
  clearable,
  className,
  ...aria
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<User | null>(null);
  const term = useDebouncedValue(search.trim(), 300);

  const query = {
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortOrder: 'asc',
    ...(term ? { search: term } : {}),
    ...(role ? { role } : {}),
    ...(activeOnly ? { isActive: 'true' } : {}),
  };
  const users = useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => employeesApi.list(query),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const selectedFromServer = useQuery({
    queryKey: employeeKeys.detail(value ?? ''),
    queryFn: () => employeesApi.get(value ?? ''),
    enabled: Boolean(value) && picked?.id !== value,
    staleTime: 5 * 60_000,
  });
  const selected = value
    ? picked?.id === value
      ? picked
      : (selectedFromServer.data ?? null)
    : null;

  const select = (user: User | null) => {
    setPicked(user);
    onChange(user?.id ?? null, user);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'min-h-10 w-full min-w-0 justify-between font-normal',
              !selected && 'text-muted-foreground',
            )}
            {...aria}
          >
            <span className="truncate">
              {selected
                ? `${selected.name} · ${selected.employeeCode}`
                : value && selectedFromServer.isPending
                  ? 'Memuat…'
                  : placeholder}
            </span>
            <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          {/* Pencarian di server → filter bawaan cmdk dimatikan. */}
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Cari nama, NIP, atau email…"
            />
            <CommandList>
              {users.isPending ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  Memuat…
                </div>
              ) : (
                <>
                  <CommandEmpty>Tidak ada yang cocok.</CommandEmpty>
                  <CommandGroup>
                    {(users.data?.items ?? []).map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => select(user)}
                        data-checked={user.id === value}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{user.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {user.employeeCode}
                            {user.department ? ` · ${user.department.name}` : ''}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && value ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0"
          aria-label="Hapus pilihan"
          onClick={() => select(null)}
        >
          <XIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
