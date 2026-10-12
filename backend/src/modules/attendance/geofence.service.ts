import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@/common/constants/error-codes';
import { BusinessException } from '@/common/exceptions/business.exception';
import { haversineMeters } from '@/common/utils/geo.util';

export interface GeofenceLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface GeofenceOptions {
  enabled: boolean;
  maxAccuracyMeters: number;
}

/**
 * BUSINESS-RULES §7 langkah 5. Mengembalikan jarak (meter, dibulatkan) untuk dicatat di log
 * scan — juga saat geofence dimatikan.
 */
@Injectable()
export class GeofenceService {
  /** Jarak (meter, dibulatkan) dari titik lokasi. */
  distanceMeters(location: GeofenceLocation, latitude: number, longitude: number): number {
    return Math.round(haversineMeters(location.latitude, location.longitude, latitude, longitude));
  }

  assertInside(
    location: GeofenceLocation,
    latitude: number,
    longitude: number,
    accuracy: number,
    { enabled, maxAccuracyMeters }: GeofenceOptions,
  ): number {
    const distance = this.distanceMeters(location, latitude, longitude);
    if (!enabled) return distance;

    if (accuracy > maxAccuracyMeters) {
      throw new BusinessException(
        ErrorCode.LOCATION_ACCURACY_LOW,
        `Sinyal GPS lemah (akurasi ${Math.round(accuracy)} m, maks ${maxAccuracyMeters} m). Coba di area terbuka`,
        undefined,
        { accuracy: Math.round(accuracy), maxAccuracy: maxAccuracyMeters },
      );
    }
    if (distance > location.radiusMeters) {
      throw new BusinessException(
        ErrorCode.OUTSIDE_GEOFENCE,
        `Anda berada ${distance} m dari lokasi kantor (maks ${location.radiusMeters} m)`,
        undefined,
        { distance, radius: location.radiusMeters },
      );
    }
    return distance;
  }
}
