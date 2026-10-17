'use client';

import 'leaflet/dist/leaflet.css';
import { latLng } from 'leaflet';
import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { formatTime } from '@/lib/date';
import { SCAN_POINT_COLORS, SCAN_POINT_LABELS, type ScanPoint } from './scan-points';

export interface ScanPointsMapProps {
  location: { latitude: number; longitude: number; radiusMeters: number; name: string };
  points: ScanPoint[];
  className?: string;
}

/** Muat semua titik + lingkaran radius dalam layar. */
function FitAll({ location, points }: Omit<ScanPointsMapProps, 'className'>) {
  const map = useMap();
  useEffect(() => {
    const bounds = latLng(location.latitude, location.longitude).toBounds(
      location.radiusMeters * 2.2,
    );
    for (const point of points) bounds.extend([point.latitude, point.longitude]);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
  }, [map, location, points]);
  return null;
}

/** Mini-peta detail absensi: radius lokasi (hijau muda) vs titik scan masuk/pulang/gagal. */
export default function ScanPointsMap({ location, points, className }: ScanPointsMapProps) {
  const center: [number, number] = [location.latitude, location.longitude];
  return (
    <MapContainer
      center={center}
      zoom={17}
      scrollWheelZoom={false}
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Circle
        center={center}
        radius={location.radiusMeters}
        pathOptions={{ color: '#059669', weight: 2, fillColor: '#059669', fillOpacity: 0.12 }}
      >
        <Tooltip>
          {location.name} · radius {location.radiusMeters} m
        </Tooltip>
      </Circle>
      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.latitude, point.longitude]}
          radius={point.kind === 'failed' ? 6 : 8}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: SCAN_POINT_COLORS[point.kind],
            fillOpacity: 1,
          }}
        >
          <Tooltip>
            {SCAN_POINT_LABELS[point.kind]} · {formatTime(point.at)}
            {point.distance !== null ? ` · ${Math.round(point.distance)} m` : ''}
            {point.errorCode ? ` · ${point.errorCode}` : ''}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitAll location={location} points={points} />
    </MapContainer>
  );
}
