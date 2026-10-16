// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isKioskQr, rejectMessage } from './scan-errors';

const { toastError, track, scannerProps } = vi.hoisted(() => ({
  toastError: vi.fn(),
  track: {
    readyState: 'live' as MediaStreamTrackState,
    stop: vi.fn(),
    getCapabilities: () => ({}),
  },
  scannerProps: { current: null as null | { onScan: (codes: { rawValue: string }[]) => void } },
}));

vi.mock('sonner', () => ({ toast: { error: toastError } }));

// Pengganti library kamera: menyimpan props & menyediakan stream palsu lewat ref.
vi.mock('@yudiel/react-qr-scanner', () => {
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
  const Scanner = forwardRef(function Scanner(
    props: { onScan: (codes: { rawValue: string }[]) => void },
    ref,
  ) {
    scannerProps.current = props;
    useImperativeHandle(ref, () => ({ getStream: () => stream, getVideoElement: () => null }));
    return <div data-testid="scanner" />;
  });
  return { Scanner, setZXingModuleOverrides: vi.fn(), useDevices: () => [] };
});

const { QrScannerView } = await import('./qr-scanner-view');

const QR = 'AY1.K.0d5c9a1e-2b3f-4c4d-8e5f-6a7b8c9d0e1f.59372161.Zx3kQ9vB2mN8pL1sT4wY6a';
const scanValue = (value: string) => act(() => scannerProps.current?.onScan([{ rawValue: value }]));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('QrScannerView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const renderView = (onDecode = vi.fn(), onCameraState = vi.fn()) => {
    render(
      <QrScannerView
        onDecode={onDecode}
        validate={isKioskQr}
        rejectMessage={rejectMessage}
        onCameraState={onCameraState}
      />,
    );
    return { onDecode, onCameraState };
  };

  it('QR bukan AbsenYok → toast, tidak diteruskan; QR kiosk → onDecode', () => {
    const { onDecode } = renderView();
    scanValue('https://example.com');
    expect(onDecode).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Ini bukan QR absensi AbsenYok', { id: 'scan-reject' });

    // QR yang sama masih di depan kamera → tidak spam toast.
    scanValue('https://example.com');
    expect(toastError).toHaveBeenCalledTimes(1);

    scanValue(QR);
    expect(onDecode).toHaveBeenCalledExactlyOnceWith(QR);
  });

  it('melaporkan kamera siap setelah stream hidup', () => {
    const { onCameraState } = renderView();
    expect(onCameraState).toHaveBeenLastCalledWith('starting');
    act(() => vi.advanceTimersByTime(300));
    expect(onCameraState).toHaveBeenLastCalledWith('ready');
  });

  it('tab disembunyikan → pemindai dilepas & track kamera dihentikan', () => {
    renderView();
    act(() => vi.advanceTimersByTime(300));
    setVisibility('hidden');
    expect(screen.queryByTestId('scanner')).toBeNull();
    expect(track.stop).toHaveBeenCalled();
    setVisibility('visible');
    expect(screen.getByTestId('scanner')).toBeTruthy();
  });

  it('meninggalkan halaman (unmount) → track kamera dihentikan', () => {
    renderView();
    act(() => vi.advanceTimersByTime(300));
    cleanup();
    expect(track.stop).toHaveBeenCalled();
  });
});
