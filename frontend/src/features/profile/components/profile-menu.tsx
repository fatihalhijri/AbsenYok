'use client';

import {
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  InfoIcon,
  KeyRoundIcon,
  LogOutIcon,
  PaletteIcon,
  ShareIcon,
  SquarePlusIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { THEME_OPTIONS } from '@/components/layout/theme-toggle';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { useLogout } from '@/features/auth/hooks';
import { env } from '@/lib/env';
import { useInstallPrompt } from '@/lib/install-prompt';
import { cn } from '@/lib/utils';

type Panel = 'password' | 'install' | 'about' | 'logout' | null;

/** Menu profil: Ganti Password, Tema, Pasang Aplikasi, Tentang, Keluar. */
export function ProfileMenu() {
  const [panel, setPanel] = useState<Panel>(null);
  const logout = useLogout();
  const { platform, canPrompt, install } = useInstallPrompt();
  const close = () => setPanel(null);

  const onInstall = async () => {
    if (canPrompt) {
      const outcome = await install();
      if (outcome === 'accepted') toast.success('Aplikasi sedang dipasang');
      return;
    }
    setPanel('install');
  };

  return (
    <>
      <nav aria-label="Pengaturan" className="divide-y rounded-2xl border bg-card">
        <MenuButton
          icon={KeyRoundIcon}
          label="Ganti Password"
          onClick={() => setPanel('password')}
        />
        <ThemeRow />
        <MenuButton
          icon={DownloadIcon}
          label="Pasang Aplikasi"
          detail={platform === 'installed' ? 'Sudah terpasang' : undefined}
          done={platform === 'installed'}
          onClick={() => void onInstall()}
          disabled={platform === 'installed'}
        />
        <MenuButton icon={InfoIcon} label="Tentang Aplikasi" onClick={() => setPanel('about')} />
        <MenuButton
          icon={LogOutIcon}
          label="Keluar"
          destructive
          onClick={() => setPanel('logout')}
        />
      </nav>

      <Sheet open={panel === 'password'} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Ganti password</SheetTitle>
            <SheetDescription>
              Setelah berhasil, semua sesi diakhiri dan Anda perlu masuk kembali.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <ChangePasswordForm />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={panel === 'install'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pasang aplikasi</DialogTitle>
            <DialogDescription>Buka AbsenYok langsung dari layar utama HP.</DialogDescription>
          </DialogHeader>
          {platform === 'ios' ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Ketuk <ShareIcon className="inline size-4 align-text-bottom" aria-label="Bagikan" />{' '}
                di Safari.
              </li>
              <li>
                Pilih <span className="font-medium">Tambahkan ke Layar Utama</span>{' '}
                <SquarePlusIcon className="inline size-4 align-text-bottom" aria-hidden="true" />.
              </li>
              <li>Ketuk &ldquo;Tambah&rdquo;.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Buka menu browser (⋮) di Chrome/Edge.</li>
              <li>
                Pilih &ldquo;Instal aplikasi&rdquo; atau &ldquo;Tambahkan ke layar utama&rdquo;.
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'about'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{env.NEXT_PUBLIC_APP_NAME}</DialogTitle>
            <DialogDescription>Aplikasi absensi berbasis QR Code.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Versi</dt>
            <dd className="text-right font-medium tabular-nums" data-testid="app-version">
              {env.NEXT_PUBLIC_APP_VERSION}
            </dd>
            <dt className="text-muted-foreground">Zona waktu</dt>
            <dd className="text-right font-medium">{env.NEXT_PUBLIC_APP_TIMEZONE}</dd>
          </dl>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={panel === 'logout'}
        onOpenChange={(open) => !open && close()}
        title="Keluar dari akun?"
        description="Anda perlu masuk kembali untuk melakukan absensi."
        confirmLabel="Keluar"
        destructive
        onConfirm={() => logout.mutateAsync()}
      />
    </>
  );
}

function MenuButton({
  icon: Icon,
  label,
  detail,
  done,
  destructive,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  done?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 px-4 text-left outline-none first:rounded-t-2xl last:rounded-b-2xl',
        'hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:bg-transparent',
        destructive && 'text-destructive',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 font-medium">{label}</span>
      {detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
      {done ? (
        <CheckIcon className="size-4 text-success" aria-hidden="true" />
      ) : destructive ? null : (
        <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

const noopSubscribe = () => () => {};

/** Pilihan tema sebagai segmented control (radio). */
function ThemeRow() {
  const { theme, setTheme } = useTheme();
  // Tema tersimpan baru diketahui di browser — hindari hydration mismatch.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const current = mounted ? (theme ?? 'system') : null;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <PaletteIcon className="size-5 shrink-0" aria-hidden="true" />
      <span id="theme-label" className="flex-1 font-medium">
        Tema
      </span>
      <div
        role="radiogroup"
        aria-labelledby="theme-label"
        className="grid w-full grid-cols-3 gap-1 rounded-xl bg-muted p-1 min-[400px]:w-auto"
      >
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            onClick={() => setTheme(value)}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-background aria-checked:font-medium aria-checked:shadow-sm"
          >
            <Icon className="size-4" aria-hidden="true" />
            {value === 'system' ? 'Sistem' : label}
          </button>
        ))}
      </div>
    </div>
  );
}
