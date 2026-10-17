'use client';

import { QRCodeSVG } from 'qrcode.react';
import { memo, useEffect, useState } from 'react';
import { useNow } from '@/hooks/use-now';
import { isQrDisplayable } from '@/lib/qr-schedule';
import { cn } from '@/lib/utils';
import type { KioskQr as KioskQrData } from '@/types';

/** Ukuran koordinat QR (viewBox); tampilan sebenarnya mengikuti CSS. */
const QR_SIZE = 512;
const LOGO_SIZE = 104; // ±20% — aman untuk level H (30% koreksi galat)
const CROSSFADE_MS = 500;

interface KioskQrProps {
  qr: KioskQrData;
  /** Selisih jam server − perangkat (ms). */
  offsetMs: number;
}

/**
 * QR kiosk besar (`level="H"` + logo di tengah) dengan cincin hitung mundur di sekelilingnya.
 * Pergantian token memakai crossfade; QR yang mendekati batas sah disembunyikan (jangan pernah
 * menampilkan token kedaluwarsa).
 */
export function KioskQr({ qr, offsetMs }: KioskQrProps) {
  const [layers, setLayers] = useState<{ current: string; previous: string | null }>({
    current: qr.token,
    previous: null,
  });

  // Simpan token lama sebentar untuk crossfade, lalu buang.
  if (layers.current !== qr.token) {
    setLayers({ current: qr.token, previous: layers.current });
  }
  useEffect(() => {
    if (!layers.previous) return;
    const timer = setTimeout(
      () => setLayers((value) => ({ ...value, previous: null })),
      CROSSFADE_MS,
    );
    return () => clearTimeout(timer);
  }, [layers.previous]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8">
      <div className="relative aspect-square h-[min(70dvh,82vw)] max-h-full">
        <CountdownRing
          expiresAt={qr.expiresAt}
          intervalSeconds={qr.intervalSeconds}
          offsetMs={offsetMs}
        />
        {/* Selalu hitam di atas putih — mode gelap paksa tidak berlaku untuk QR. */}
        <div className="absolute inset-[3%] overflow-hidden rounded-[2rem] bg-white p-[5%] shadow-2xl">
          <ExpiryGuard qr={qr} offsetMs={offsetMs}>
            <div className="relative h-full w-full">
              {layers.previous ? (
                <QrLayer
                  key={layers.previous}
                  token={layers.previous}
                  className="animate-out fill-mode-forwards fade-out"
                />
              ) : null}
              <QrLayer
                key={layers.current}
                token={layers.current}
                className={layers.previous ? 'animate-in fade-in' : undefined}
                current
              />
            </div>
          </ExpiryGuard>
        </div>
      </div>
      <p className="max-w-xl text-center text-xl font-medium text-balance text-muted-foreground lg:text-2xl">
        Scan untuk absen menggunakan aplikasi <span className="text-foreground">AbsenYok</span>
      </p>
    </div>
  );
}

const QrLayer = memo(function QrLayer({
  token,
  className,
  current,
}: {
  token: string;
  className?: string;
  current?: boolean;
}) {
  return (
    <QRCodeSVG
      value={token}
      size={QR_SIZE}
      level="H"
      marginSize={0}
      bgColor="#ffffff"
      fgColor="#000000"
      imageSettings={{
        src: '/icons/icon-192.png',
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        excavate: true,
      }}
      title={current ? 'QR absensi kiosk' : undefined}
      aria-hidden={current ? undefined : true}
      data-kiosk-qr={current ? 'current' : 'previous'}
      data-token-window={token.split('.')[3]}
      className={cn('absolute inset-0 h-full w-full duration-500', className)}
    />
  );
});

/** Sembunyikan QR bila token sudah mendekati batas sah (mis. refresh terus gagal). */
function ExpiryGuard({
  qr,
  offsetMs,
  children,
}: {
  qr: KioskQrData;
  offsetMs: number;
  children: React.ReactNode;
}) {
  const now = useNow(1000);
  const displayable = now === null || isQrDisplayable(qr, qr.intervalSeconds, now + offsetMs);
  if (displayable) return children;
  return (
    <div
      data-testid="qr-expired"
      className="flex h-full items-center justify-center text-center text-lg font-medium text-neutral-500"
    >
      Memperbarui QR…
    </div>
  );
}

/** Cincin hitung mundur di sekeliling QR (komponen terpisah — hanya ini yang berdetak). */
function CountdownRing({
  expiresAt,
  intervalSeconds,
  offsetMs,
}: {
  expiresAt: string;
  intervalSeconds: number;
  offsetMs: number;
}) {
  const now = useNow(250);
  const remaining =
    now === null ? intervalSeconds * 1000 : Date.parse(expiresAt) - (now + offsetMs);
  const fraction = Math.min(1, Math.max(0, remaining / (intervalSeconds * 1000)));
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  return (
    <>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <rect
          x="1"
          y="1"
          width="98"
          height="98"
          rx="9"
          fill="none"
          strokeWidth="1.2"
          className="stroke-white/10"
        />
        <rect
          x="1"
          y="1"
          width="98"
          height="98"
          rx="9"
          fill="none"
          strokeWidth="1.2"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 * (1 - fraction)}
          strokeLinecap="round"
          className={cn(
            'transition-[stroke-dashoffset] duration-300 ease-linear',
            fraction < 0.2 ? 'stroke-amber-400' : 'stroke-primary',
          )}
        />
      </svg>
      <span
        role="timer"
        aria-label={`QR berganti dalam ${seconds} detik`}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border border-white/15 bg-neutral-900 px-4 py-1 text-base font-semibold text-white tabular-nums shadow"
      >
        {seconds} dtk
      </span>
    </>
  );
}
