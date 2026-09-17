import { useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed, MapPin, Radio } from 'lucide-react';
import type { ActiveDriverSession, DriverSnapshot } from '@/lib/api';
import 'leaflet/dist/leaflet.css';

type Position = [number, number];
type LiveMapProps = { snapshot: DriverSnapshot | null; sessionKey: string; stale?: boolean; drivers?: ActiveDriverSession[]; onSelect?: (id: string) => void; selectionDisabled?: boolean };
const MAX_TRAIL_POINTS = 250;
const FRESH_TELEMETRY_SECONDS = 5;

function MapControls({ position }: { position?: Position }) {
  const map = useMap();
  const centered = useRef(false);
  useEffect(() => {
    if (position && !centered.current) {
      map.setView(position, 15);
      centered.current = true;
    }
  }, [map, position]);

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  if (!position) return null;
  return <button type="button" onClick={() => map.setView(position, Math.max(map.getZoom(), 15), { animate: true })}
    className="absolute right-3 top-3 z-[500] inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1746a2] shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5f9df7]"
    aria-label="Pusatkan peta ke posisi kendaraan terakhir">
    <LocateFixed className="size-4" aria-hidden="true" /> Pusatkan
  </button>;
}

function SessionMap({ snapshot, stale = false, drivers = [], onSelect, selectionDisabled = false, sessionKey }: LiveMapProps) {
  const [trail, setTrail] = useState<Position[]>([]);
  const latitude = snapshot?.telemetry?.latitude;
  const longitude = snapshot?.telemetry?.longitude;
  const age = snapshot?.telemetry_age_seconds;
  const accuracy = snapshot?.telemetry?.accuracy;
  const valid = typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  const fresh = !stale && valid && typeof age === 'number' && Number.isFinite(age) && age >= 0 && age <= FRESH_TELEMETRY_SECONDS;

  useEffect(() => {
    if (!fresh || typeof latitude !== 'number' || typeof longitude !== 'number') return;
    setTrail(previous => {
      const last = previous[previous.length - 1];
      if (last && last[0] === latitude && last[1] === longitude) return previous;
      return [...previous, [latitude, longitude] as Position].slice(-MAX_TRAIL_POINTS);
    });
  }, [fresh, latitude, longitude]);

  const position: Position | undefined = valid ? [latitude, longitude] : trail[trail.length - 1];
  const locationLabel = fresh ? 'GPS aktif' : valid || trail.length ? 'Posisi terakhir' : 'Menunggu GPS';
  const locationColor = fresh ? '#1746a2' : '#fd5f00';

  return <div className="live-session-map relative isolate flex w-full flex-col overflow-hidden bg-[#f5f8fc]">
    <MapContainer center={position ?? [-2.5, 118]} zoom={position ? 15 : 5} scrollWheelZoom={false} className="z-0 min-h-[340px] w-full flex-1" style={{ height: '100%' }} aria-label="Peta posisi kendaraan dan jejak GPS sesi aktif">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#1746a2', weight: 4, opacity: 0.75 }} />}
      {position && valid && typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy > 0 && <Circle center={position} radius={accuracy} pathOptions={{ color: '#5f9df7', weight: 1, fillColor: '#5f9df7', fillOpacity: 0.12 }} />}
      {position && <CircleMarker center={position} radius={10} eventHandlers={{ click: () => { if (!selectionDisabled && sessionKey) onSelect?.(sessionKey); } }} pathOptions={{ color: '#fff', weight: 3, fillColor: locationColor, fillOpacity: 1 }}>
        <Popup><strong>{locationLabel}</strong><br />{position[0].toFixed(5)}, {position[1].toFixed(5)}<br />{fresh ? 'Posisi diterima dari perangkat pengemudi.' : 'Lokasi belum diperbarui; ini posisi terakhir yang tersedia.'}</Popup>
      </CircleMarker>}
      {drivers.filter(driver => driver.session_id !== sessionKey && typeof driver.latitude === 'number' && Number.isFinite(driver.latitude) && Math.abs(driver.latitude) <= 90 && typeof driver.longitude === 'number' && Number.isFinite(driver.longitude) && Math.abs(driver.longitude) <= 180).map(driver => <CircleMarker key={driver.session_id} center={[driver.latitude!, driver.longitude!]} radius={9} eventHandlers={{ click: () => { if (!selectionDisabled) onSelect?.(driver.session_id); } }} pathOptions={{ color: '#fff', weight: 3, fillColor: driver.telemetry_age_seconds != null && driver.telemetry_age_seconds <= 5 ? '#1746a2' : '#fd5f00', fillOpacity: 1 }}><Popup><strong>{driver.driver_name}</strong><br />{driver.telemetry_age_seconds != null && driver.telemetry_age_seconds <= 5 ? 'GPS aktif' : 'Posisi terakhir'}<br /><button type="button" disabled={selectionDisabled} onClick={() => onSelect?.(driver.session_id)}>Lihat kamera driver</button></Popup></CircleMarker>)}
      <MapControls position={position} />
    </MapContainer>
    {!position && <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center px-6">
      <div className="max-w-xs rounded-xl border border-slate-200 bg-white/95 px-5 py-4 text-center shadow-sm">
        <MapPin className="mx-auto mb-3 size-6 text-[#1746a2]" aria-hidden="true" />
        <p className="text-sm font-semibold text-[#1746a2]">Menunggu lokasi kendaraan</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">Peta OpenStreetMap tersedia. Mulai atau pantau sesi dengan GPS aktif untuk melihat posisi dan jejak kendaraan.</p>
      </div>
    </div>}
    {position && !valid && <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-white/20 px-8">
      <div className="max-w-xs rounded-xl border border-slate-200 bg-white/95 px-5 py-4 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#1746a2]">GPS tidak tersedia</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Peta menampilkan posisi terakhir. Menunggu pembacaan lokasi baru.</p>
      </div>
    </div>}
    <div className="absolute bottom-7 left-3 right-3 z-[500] flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
      <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: position ? locationColor : '#64748b' }}><Radio className="size-3.5" aria-hidden="true" />{locationLabel}</span>
      <span className="text-slate-500">{fresh ? `Jejak sesi · ${trail.length} titik` : position ? 'Data lokasi belum terkini' : 'Belum ada data perjalanan'}</span>
    </div>
  </div>;
}

export default function LiveMap(props: LiveMapProps) {
  return <SessionMap key={props.sessionKey} {...props} />;
}
