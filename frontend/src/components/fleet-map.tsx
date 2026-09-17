import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { Vehicle } from '@/data/fleet';
import 'leaflet/dist/leaflet.css';

const route: [number, number][] = [[-6.655,107.411],[-6.69,107.425],[-6.724,107.448],[-6.756,107.476],[-6.815,107.535],[-6.844,107.566],[-6.9,107.62]];
function Focus({ vehicle }: { vehicle: Vehicle }) { const map = useMap(); useEffect(() => { map.flyTo([vehicle.lat, vehicle.lng], 11, { duration: .7 }); }, [map, vehicle]); return null; }
export default function FleetMap({ fleet, selected, onSelect }: { fleet: Vehicle[]; selected: Vehicle; onSelect: (vehicle: Vehicle) => void }) {
  return <MapContainer center={[selected.lat,selected.lng]} zoom={10} scrollWheelZoom className="fleet-map" aria-label="Peta posisi kendaraan">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Polyline positions={route} pathOptions={{ color:'#255b50', weight:5, opacity:.75, dashArray:'8 8' }} />
    <Focus vehicle={selected}/>
    {fleet.map(vehicle => <CircleMarker key={vehicle.id} center={[vehicle.lat,vehicle.lng]} radius={vehicle.id===selected.id?13:9} eventHandlers={{ click:()=>onSelect(vehicle) }} pathOptions={{ color:'#fff', weight:3, fillOpacity:1, fillColor:vehicle.status==='critical'?'#dc4545':vehicle.status==='warning'?'#d6972d':'#278a62' }}><Popup><strong>{vehicle.id}</strong><br/>{vehicle.driver}<br/>{vehicle.speed} km/j · {vehicle.location}</Popup></CircleMarker>)}
  </MapContainer>;
}
