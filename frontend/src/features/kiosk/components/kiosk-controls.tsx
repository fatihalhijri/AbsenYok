'use client';

import { MaximizeIcon, MinimizeIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { unlockAudio } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { CURSOR_IDLE_MS } from '../schedule';

function subscribeFullscreen(listener: () => void) {
  document.addEventListener('fullscreenchange', listener);
  return () => document.removeEventListener('fullscreenchange', listener);
}

/** `true` selama mode layar penuh aktif. */
export function useFullscreen(): boolean {
  return useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );
}

/** `true` bila tidak ada gerakan mouse/sentuhan/tombol selama `ms`. */
export function useIdle(ms = CURSOR_IDLE_MS): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), ms);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const events = ['mousemove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((event) => window.addEventListener(event, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, wake));
    };
  }, [ms]);
  return idle;
}

/** Tombol layar penuh & suara (memudar saat diam bersama kursor). */
export function KioskControls({
  idle,
  soundOn,
  onToggleSound,
}: {
  idle: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  const fullscreen = useFullscreen();

  const toggleFullscreen = async () => {
    // Gestur pengguna juga dipakai untuk membuka kunci audio (kebijakan autoplay browser).
    void unlockAudio();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      /* ditolak browser / tidak didukung */
    }
  };

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-20 flex gap-2 transition-opacity duration-500',
        idle ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <ControlButton
        label={soundOn ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}
        pressed={soundOn}
        onClick={() => {
          void unlockAudio();
          onToggleSound();
        }}
      >
        {soundOn ? <Volume2Icon /> : <VolumeXIcon />}
      </ControlButton>
      <ControlButton
        label={fullscreen ? 'Keluar dari layar penuh' : 'Layar penuh'}
        onClick={() => void toggleFullscreen()}
      >
        {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur outline-none hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60 [&_svg]:size-5"
    >
      {children}
    </button>
  );
}
