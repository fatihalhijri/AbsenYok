'use client';

import {
  type IDetectedBarcode,
  type IScannerError,
  type IScannerHandle,
  Scanner,
  setZXingModuleOverrides,
  useDevices,
} from '@yudiel/react-qr-scanner';
import { FlashlightIcon, FlashlightOffIcon, SwitchCameraIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/*
 * Browser tanpa BarcodeDetector native (iOS Safari, Chrome desktop Windows) memakai polyfill
 * ZXing WASM. Muat dari server sendiri (`public/zxing/`, disalin oleh scripts/copy-zxing-wasm.mjs)
 * — bukan CDN pihak ketiga — agar tetap jalan di jaringan kantor yang ketat.
 */
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) =>
    path.endsWith('.wasm') ? `/zxing/${path}` : `${prefix}${path}`,
});

export type CameraState = 'starting' | 'ready' | 'error';

const CAMERA_ERRORS: Partial<Record<IScannerError['kind'], string>> = {
  'permission-denied': 'Izin kamera ditolak.',
  'no-camera': 'Kamera tidak ditemukan di perangkat ini.',
  'in-use': 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.',
  overconstrained: 'Kamera yang dipilih tidak tersedia.',
  'insecure-context': 'Kamera hanya dapat dipakai lewat koneksi aman (HTTPS).',
  unsupported: 'Browser ini tidak mendukung akses kamera.',
};

/** Pesan Indonesia untuk error kamera dari library pemindai. */
export function cameraErrorMessage(error: IScannerError): string {
  return (
    CAMERA_ERRORS[error.kind] ?? 'Kamera tidak dapat dibuka. Muat ulang halaman lalu coba lagi.'
  );
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}
interface TorchConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

function subscribeVisibility(listener: () => void) {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

/** `true` selama tab terlihat. */
function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
}

/** Pengulangan penghentian stream setelah dilepas (menutup celah start kamera yang tertunda). */
const RELEASE_RETRY_MS = [800, 2500];

const stopStream = (stream: MediaStream | null) =>
  stream?.getTracks().forEach((track) => track.stop());

export interface QrScannerViewProps {
  /** Dipanggil untuk QR yang lolos `validate`. */
  onDecode: (value: string) => void;
  /** Bekukan pemindaian (mis. saat memproses hasil). */
  paused?: boolean;
  /** Validasi cepat di klien; `false` → toast `rejectMessage` dan pemindaian berlanjut. */
  validate?: (value: string) => boolean;
  rejectMessage?: (value: string) => string;
  /** Status kamera; saat `error` disertai jenis (`permission-denied`, dst.) & pesan Indonesia. */
  onCameraState?: (
    state: CameraState,
    error?: { kind: IScannerError['kind']; message: string },
  ) => void;
  className?: string;
}

/**
 * Pemindai QR kamera belakang (hanya format `qr_code`) dengan viewfinder, senter & ganti kamera.
 * Kamera dilepas (track di-stop) saat tab disembunyikan dan saat komponen dilepas.
 */
export function QrScannerView({
  onDecode,
  paused = false,
  validate,
  rejectMessage = () => 'QR tidak valid',
  onCameraState,
  className,
}: QrScannerViewProps) {
  const visible = useDocumentVisible();
  const devices = useDevices();
  const [deviceIndex, setDeviceIndex] = useState<number | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<IScannerHandle>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rejectedRef = useRef<{ value: string; at: number } | null>(null);
  const cameraStateRef = useRef(onCameraState);
  useEffect(() => {
    cameraStateRef.current = onCameraState;
  });

  const deviceId = deviceIndex === null ? undefined : devices[deviceIndex]?.deviceId;
  // Objek stabil: library me-restart kamera bila constraints berubah.
  const constraints = useMemo<MediaTrackConstraints>(
    () => (deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }),
    [deviceId],
  );

  /*
   * Seumur satu instance <Scanner> (berganti saat tab disembunyikan / ganti kamera): pegang
   * elemen video-nya. Library menghentikan kamera lewat antrean async ("best-effort") — bila
   * dilepas saat kamera masih menyala-kan diri, stream bisa telat dimatikan. Maka saat dilepas
   * kita hentikan sendiri stream di elemen video tsb sekarang dan sekali lagi setelah start yang
   * mungkin masih berjalan selesai.
   */
  useEffect(() => {
    if (!visible) return;
    const video = scannerRef.current?.getVideoElement() ?? null;
    const release = () => {
      const source = video?.srcObject;
      stopStream(source && 'getTracks' in source ? source : null);
      stopStream(streamRef.current);
    };
    return () => {
      release();
      streamRef.current = null;
      RELEASE_RETRY_MS.forEach((ms) => setTimeout(release, ms));
    };
  }, [visible, deviceId]);

  // Deteksi kapan stream hidup (library tidak punya callback "start"). Saat `paused` library
  // mematikan kamera dan menyalakannya lagi saat dilanjutkan, jadi deteksi diulang.
  useEffect(() => {
    if (!visible || paused) return;
    cameraStateRef.current?.('starting');
    const timer = setInterval(() => {
      const stream = scannerRef.current?.getStream() ?? null;
      const track = stream?.getVideoTracks()[0];
      if (!stream || track?.readyState !== 'live') return;
      clearInterval(timer);
      streamRef.current = stream;
      const capabilities = track.getCapabilities?.() as TorchCapabilities | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
      setTorchOn(false);
      cameraStateRef.current?.('ready');
    }, 250);
    return () => clearInterval(timer);
  }, [visible, paused, deviceId]);

  const handleScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const value = codes[0]?.rawValue;
      if (!value || paused) return;
      if (validate && !validate(value)) {
        // QR yang sama terus terlihat kamera → jangan banjiri toast.
        const last = rejectedRef.current;
        if (last?.value === value && Date.now() - last.at < 3000) return;
        rejectedRef.current = { value, at: Date.now() };
        toast.error(rejectMessage(value), { id: 'scan-reject' });
        return;
      }
      onDecode(value);
    },
    [onDecode, paused, validate, rejectMessage],
  );

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as TorchConstraintSet] });
      setTorchOn(next);
    } catch {
      toast.error('Senter tidak dapat dinyalakan di perangkat ini');
      setTorchSupported(false);
    }
  };

  const switchCamera = () => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setTorchSupported(false);
    setDeviceIndex((index) => {
      if (devices.length < 2) return null;
      const current =
        index ?? devices.findIndex((device) => /back|rear|belakang/i.test(device.label));
      return ((current < 0 ? 0 : current) + 1) % devices.length;
    });
  };

  return (
    <div
      className={cn(
        'relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-950 text-white',
        className,
      )}
    >
      {visible ? (
        <Scanner
          ref={scannerRef}
          key={deviceId ?? 'environment'}
          onScan={handleScan}
          onError={(error) =>
            cameraStateRef.current?.('error', {
              kind: error.kind,
              message: cameraErrorMessage(error),
            })
          }
          constraints={constraints}
          formats={['qr_code']}
          paused={paused}
          allowMultiple
          scanDelay={800}
          sound={false}
          components={{ finder: false, torch: false, onOff: false, zoom: false }}
          styles={{
            container: { width: '100%', height: '100%', paddingTop: 0 },
            video: { width: '100%', height: '100%', objectFit: 'cover' },
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
          Kamera dijeda saat aplikasi tidak terlihat.
        </div>
      )}

      <Viewfinder scanning={visible && !paused} />

      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-3 p-3">
        {torchSupported ? (
          <OverlayButton
            label={torchOn ? 'Matikan senter' : 'Nyalakan senter'}
            pressed={torchOn}
            onClick={() => void toggleTorch()}
          >
            {torchOn ? <FlashlightOffIcon /> : <FlashlightIcon />}
          </OverlayButton>
        ) : null}
        {devices.length > 1 ? (
          <OverlayButton label="Ganti kamera" onClick={switchCamera}>
            <SwitchCameraIcon />
          </OverlayButton>
        ) : null}
      </div>
    </div>
  );
}

/** Kotak bidik dengan sudut ter-highlight + garis pemindai beranimasi. */
function Viewfinder({ scanning }: { scanning: boolean }) {
  const corner = 'absolute size-10 border-white border-[3px]';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-[14%] rounded-xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]">
        <span className={cn(corner, 'top-0 left-0 rounded-tl-xl border-r-0 border-b-0')} />
        <span className={cn(corner, 'top-0 right-0 rounded-tr-xl border-b-0 border-l-0')} />
        <span className={cn(corner, 'bottom-0 left-0 rounded-bl-xl border-t-0 border-r-0')} />
        <span className={cn(corner, 'right-0 bottom-0 rounded-br-xl border-t-0 border-l-0')} />
        {scanning ? (
          <span className="absolute inset-x-[6%] h-0.5 animate-scan-line rounded-full bg-primary shadow-[0_0_12px_2px] shadow-primary motion-reduce:hidden" />
        ) : null}
      </div>
    </div>
  );
}

function OverlayButton({
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
      aria-pressed={pressed}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur outline-none hover:bg-black/70 focus-visible:ring-3 focus-visible:ring-white/70 aria-pressed:bg-white aria-pressed:text-neutral-900 [&_svg]:size-5"
    >
      {children}
    </button>
  );
}
