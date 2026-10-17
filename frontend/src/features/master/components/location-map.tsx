'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export interface LocationMapProps {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** Klik peta → set titik baru. */
  onPick: (latitude: number, longitude: number) => void;
  className?: string;
}

/** Klik peta memanggil `onPick` (dibulatkan 7 desimal = batas backend). */
function ClickToPick({ onPick }: { onPick: LocationMapProps['onPick'] }) {
  useMapEvents({
    click: (event) => onPick(round7(event.latlng.lat), round7(event.latlng.lng)),
  });
  return null;
}

/** Ikuti titik/radius yang diubah lewat input (geser peta bila titik keluar layar). */
function FollowPoint({ latitude, longitude, radiusMeters }: Omit<LocationMapProps, 'onPick'>) {
  const map = useMap();
  useEffect(() => {
    const center: [number, number] = [latitude, longitude];
    if (!map.getBounds().pad(-0.1).contains(center)) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [latitude, longitude, map]);
  useEffect(() => {
    // Radius besar → perkecil zoom agar lingkaran tetap terlihat utuh.
    const bounds = map.getBounds();
    const circleBounds = map.getCenter().toBounds(radiusMeters * 2.4);
    if (!bounds.contains(circleBounds)) map.fitBounds(circleBounds, { animate: true });
  }, [radiusMeters, map]);
  return null;
}

export const round7 = (value: number) => Math.round(value * 1e7) / 1e7;

/**
 * Peta OpenStreetMap untuk memilih titik lokasi & melihat radius geofence secara langsung.
 * Penanda memakai CircleMarker (vektor) — ikon gambar bawaan Leaflet rusak saat di-bundle.
 */
export default function LocationMap({
  latitude,
  longitude,
  radiusMeters,
  onPick,
  className,
}: LocationMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom
      className={className}
      style={{ height: '100%', width: '100%' }}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Circle
        center={[latitude, longitude]}
        radius={radiusMeters}
        pathOptions={{ color: '#059669', weight: 2, fillColor: '#059669', fillOpacity: 0.15 }}
      />
      <CircleMarker
        center={[latitude, longitude]}
        radius={8}
        pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#047857', fillOpacity: 1 }}
      />
      <ClickToPick onPick={onPick} />
      <FollowPoint latitude={latitude} longitude={longitude} radiusMeters={radiusMeters} />
    </MapContainer>
  );
}
