import { describe, expect, it } from 'vitest';
import { describeScanError, isKioskQr, rejectMessage } from './scan-errors';

const KIOSK_QR = 'AY1.K.0d5c9a1e-2b3f-4c4d-8e5f-6a7b8c9d0e1f.59372161.Zx3kQ9vB2mN8pL1sT4wY6a';

describe('isKioskQr / rejectMessage', () => {
  it('menerima token kiosk AY1.K', () => {
    expect(isKioskQr(KIOSK_QR)).toBe(true);
  });

  it.each([
    'https://wa.me/628123',
    'WIFI:S:Kantor;T:WPA;P:rahasia;;',
    'AY1.P.11111111-1111-4111-8111-111111111111.29686080.abc',
    'AY1.K.terpotong',
    'ay1.k.huruf-kecil.1.x',
    '',
  ])('menolak %j', (value) => {
    expect(isKioskQr(value)).toBe(false);
  });

  it('pesan khusus untuk QR personal', () => {
    expect(rejectMessage('https://example.com')).toBe('Ini bukan QR absensi AbsenYok');
    expect(rejectMessage('AY1.P.x.1.y')).toMatch(/QR personal/);
  });
});

describe('describeScanError — aksi sesuai tabel FE-05', () => {
  it.each(['QR_EXPIRED', 'QR_INVALID'])('%s → Scan Ulang', (code) => {
    expect(describeScanError(code, 'x').actions[0]).toBe('scan-again');
  });

  it('OUTSIDE_GEOFENCE → jarak & radius + tips area kantor', () => {
    const view = describeScanError('OUTSIDE_GEOFENCE', 'Anda berada 245 m', {
      distance: 245,
      radius: 100,
    });
    expect(view.facts).toEqual([
      { label: 'Jarak Anda', value: '245 m' },
      { label: 'Radius kantor', value: '100 m' },
    ]);
    expect(view.hint).toMatch(/Pastikan Anda berada di area kantor/);
  });

  it('LOCATION_ACCURACY_LOW → saran area terbuka + "Perbarui lokasi"', () => {
    const view = describeScanError('LOCATION_ACCURACY_LOW', 'x', {
      accuracy: 180,
      maxAccuracy: 100,
    });
    expect(view.hint).toMatch(/jendela\/area terbuka/);
    expect(view.actions[0]).toBe('refresh-location');
    expect(view.facts[0]).toEqual({ label: 'Akurasi', value: '±180 m' });
  });

  it('DEVICE_MISMATCH → hubungi admin untuk reset perangkat', () => {
    const view = describeScanError('DEVICE_MISMATCH', 'x');
    expect(view.hint).toMatch(/Hubungi admin untuk reset perangkat/);
    expect(view.actions).not.toContain('scan-again');
  });

  it('ALREADY_CHECKED_OUT → Lihat Riwayat', () => {
    const view = describeScanError('ALREADY_CHECKED_OUT', 'x', {
      checkOutAt: '2026-10-15T10:01:00.000Z',
    });
    expect(view.actions[0]).toBe('history');
    expect(view.facts).toEqual([{ label: 'Pulang pukul', value: '17:01' }]);
  });

  it('CHECKIN_WINDOW_CLOSED → jam buka dari details', () => {
    const view = describeScanError('CHECKIN_WINDOW_CLOSED', 'Absen masuk baru dibuka pukul 07:00', {
      opensAt: '2026-10-15T00:00:00.000Z',
    });
    expect(view.title).toBe('Absen masuk belum dibuka');
    expect(view.facts).toEqual([{ label: 'Dibuka pukul', value: '07:00' }]);
  });

  it('CHECKIN_WINDOW_CLOSED (sudah lewat) → jam tutup', () => {
    const view = describeScanError('CHECKIN_WINDOW_CLOSED', 'x', {
      closedAt: '2026-10-15T10:00:00.000Z',
    });
    expect(view.facts).toEqual([{ label: 'Ditutup pukul', value: '17:00' }]);
  });

  it('kode lain → pesan server + "Kembali"', () => {
    const view = describeScanError('SOMETHING_NEW', 'Pesan dari server');
    expect(view.message).toBe('Pesan dari server');
    expect(view.actions).toEqual(['home']);
  });

  it('details rusak tidak membuat crash', () => {
    expect(describeScanError('OUTSIDE_GEOFENCE', 'x', ['bukan objek']).facts).toEqual([]);
    expect(
      describeScanError('CHECKIN_WINDOW_CLOSED', 'x', { opensAt: 'bukan tanggal' }).facts,
    ).toEqual([]);
  });
});
