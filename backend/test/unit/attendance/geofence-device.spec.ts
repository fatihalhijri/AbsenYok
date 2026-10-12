import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import { DeviceBindingService } from '@/modules/attendance/device-binding.service';
import { GeofenceService } from '@/modules/attendance/geofence.service';

const OFFICE = { latitude: -6.2, longitude: 106.8166667, radiusMeters: 100 };
const ENABLED = { enabled: true, maxAccuracyMeters: 100 };
/** ~1 meter ke utara per derajat 1/111195. */
const north = (meters: number) => OFFICE.latitude + meters / 111_195;

function catchError(run: () => unknown): BusinessException {
  try {
    run();
  } catch (error) {
    if (error instanceof BusinessException) return error;
    throw error;
  }
  throw new Error('Seharusnya melempar BusinessException');
}

describe('GeofenceService', () => {
  const geofence = new GeofenceService();

  it('di dalam radius → mengembalikan jarak (meter)', () => {
    expect(geofence.assertInside(OFFICE, north(40), OFFICE.longitude, 15, ENABLED)).toBe(40);
  });

  it('tepat di tepi radius masih diterima', () => {
    expect(geofence.assertInside(OFFICE, north(100), OFFICE.longitude, 15, ENABLED)).toBe(100);
  });

  it('di luar radius → OUTSIDE_GEOFENCE dengan details { distance, radius }', () => {
    const error = catchError(() =>
      geofence.assertInside(OFFICE, north(245), OFFICE.longitude, 10, ENABLED),
    );
    expect(error.code).toBe(ErrorCode.OUTSIDE_GEOFENCE);
    expect(error.getStatus()).toBe(422);
    expect(error.message).toBe('Anda berada 245 m dari lokasi kantor (maks 100 m)');
    expect(error.details).toEqual({ distance: 245, radius: 100 });
  });

  it('akurasi GPS buruk → LOCATION_ACCURACY_LOW (dicek sebelum jarak)', () => {
    const error = catchError(() =>
      geofence.assertInside(OFFICE, north(5000), OFFICE.longitude, 350.4, ENABLED),
    );
    expect(error.code).toBe(ErrorCode.LOCATION_ACCURACY_LOW);
    expect(error.details).toEqual({ accuracy: 350, maxAccuracy: 100 });
  });

  it('geofence dimatikan → tidak menolak, jarak tetap dihitung untuk log', () => {
    expect(
      geofence.assertInside(OFFICE, north(5000), OFFICE.longitude, 999, {
        enabled: false,
        maxAccuracyMeters: 100,
      }),
    ).toBe(5000);
  });
});

describe('DeviceBindingService', () => {
  const device = new DeviceBindingService();
  const DEVICE = '0b8f9e1a-2c3d-4e5f-8a9b-0c1d2e3f4a5b';

  it('belum terikat → BIND (disimpan saat scan berhasil)', () => {
    expect(device.assertOrBind({ boundDeviceId: null }, DEVICE, true)).toBe('BIND');
  });

  it('device sama → MATCHED (tidak peka huruf besar/kecil)', () => {
    expect(device.assertOrBind({ boundDeviceId: DEVICE.toUpperCase() }, DEVICE, true)).toBe(
      'MATCHED',
    );
  });

  it('device lain → DEVICE_MISMATCH', () => {
    const error = catchError(() =>
      device.assertOrBind({ boundDeviceId: DEVICE }, 'ffffffff-ffff-4fff-8fff-ffffffffffff', true),
    );
    expect(error.code).toBe(ErrorCode.DEVICE_MISMATCH);
    expect(error.message).toBe('Akun terdaftar di perangkat lain. Hubungi admin');
  });

  it('fitur dimatikan → SKIPPED', () => {
    expect(
      device.assertOrBind({ boundDeviceId: DEVICE }, 'ffffffff-ffff-4fff-8fff-ffffffffffff', false),
    ).toBe('SKIPPED');
  });
});
