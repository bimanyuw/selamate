import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import type { Alert } from '@/lib/api';
import 'leaflet/dist/leaflet.css';

function Bounds({ alerts }: { alerts: Alert[] }) {
  const map = useMap();
  useEffect(() => {
    const resize = () => {
      map.invalidateSize({ pan: false });
      if (alerts.length && map.getContainer().clientWidth) map.fitBounds(alerts.map(a => [a.latitude, a.longitude]), { padding: [40, 40], maxZoom: 10 });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [alerts, map]);
  return null;
}

export default function RiskMap({ alerts }: { alerts: Alert[] }) {
  return <MapContainer center={[-6.6, 107]} zoom={8} scrollWheelZoom={false} className="h-80 w-full rounded-xl" aria-label="Peta lokasi peringatan">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Bounds alerts={alerts} />
    {alerts.map(alert => <CircleMarker key={alert.id} center={[alert.latitude, alert.longitude]} radius={11} pathOptions={{ color: alert.level === 'Awas' ? '#fd5f00' : alert.level === 'Siaga' ? '#1746a2' : '#5f9df7', fillOpacity: 0.65 }}>
      <Popup><strong>{alert.region}</strong><br />{alert.hazard} · {alert.level}<br />{alert.is_simulation ? 'Data simulasi' : 'Data pengamatan'}</Popup>
    </CircleMarker>)}
  </MapContainer>;
}
