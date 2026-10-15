'use client';

import { Loader2Icon, LogOutIcon, PaletteIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/auth-store';
import { ThemeRadioItems } from './theme-toggle';

const ROLE_LABELS = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', EMPLOYEE: 'Karyawan' } as const;

/** "Budi Santoso" → "BS". */
export function initialsOf(name: string | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Avatar + menu: Profil, Tema, Keluar. */
export function UserMenu({ profileHref }: { profileHref: string }) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label="Menu akun">
          <Avatar className="size-9">
            {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
              {initialsOf(user?.name) || <UserIcon className="size-4" aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.name ?? 'Tamu'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user ? `${ROLE_LABELS[user.role]} · ${user.email}` : 'Belum masuk'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={profileHref}>
              <UserIcon aria-hidden="true" />
              Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon aria-hidden="true" />
              Tema
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <ThemeRadioItems />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={() => logout.mutate()}
        >
          {logout.isPending ? (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOutIcon aria-hidden="true" />
          )}
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
