import { describe, expect, it } from 'vitest';
import type { Settings } from '@/types';
import { changedSettings } from './components/settings-form';

const CURRENT: Settings = {
  'company.name': 'PT AbsenYok Indonesia',
  'company.logoUrl': '',
  'attendance.geofenceEnabled': true,
  'attendance.deviceBindingEnabled': true,
  'attendance.minCheckoutGapMinutes': 60,
  'leave.annualQuota': 12,
  'leave.maxRangeDays': 14,
};

describe('changedSettings', () => {
  it('hanya key yang berubah yang dikirim', () => {
    expect(
      changedSettings(CURRENT, {
        companyName: 'PT AbsenYok Indonesia',
        logoUrl: '',
        geofenceEnabled: false,
        deviceBindingEnabled: true,
        minCheckoutGapMinutes: 60,
        annualQuota: 15,
        maxRangeDays: 14,
      }),
    ).toEqual({ 'attendance.geofenceEnabled': false, 'leave.annualQuota': 15 });
  });
});
