import { CloudRain, Eye, Fuel, Gauge, MapPin, Mountain, ShieldCheck, TriangleAlert, Waves } from 'lucide-react';
import type { EnvironmentInput, JourneyRisk } from '@/lib/api';
import './journey-analysis.css';

const factors = [
  { key: 'fatigue', name: 'Kantuk live', Icon: Eye, color: 'orange' },
  { key: 'environment', name: 'Lingkungan', Icon: CloudRain, color: 'orange' },
  { key: 'behavior', name: 'Kecepatan', Icon: Gauge, color: 'blue' },
  { key: 'vehicle', name: 'Kendaraan', Icon: Fuel, color: 'purple' },
  { key: 'gps', name: 'Area sekitar', Icon: MapPin, color: 'teal' },
];
export default function JourneyAnalysis({ risk, environment, error = '', source = 'Kantuk & GPS live / OBD & lingkungan dummy' }: { risk: JourneyRisk | null; environment: EnvironmentInput; error?: string; source?: string }) {
  const state = risk?.risk_level === 'HIGH' ? 'danger' : risk?.risk_level === 'MEDIUM' ? 'caution' : risk?.risk_level === 'LOW' ? 'safe' : 'unknown';
  const labels = { safe: 'Aman', caution: 'Hati-hati', danger: 'Waspada', unknown: 'Menunggu data' };
  return <section className={`journey-analysis journey-risk-details analysis-${state}`} aria-label="Analisis bahaya perjalanan">
    <header><div><span className="analysis-kicker">EARLY WARNING SYSTEM</span><h3>Analisis perjalanan</h3></div><span className="analysis-status"><ShieldCheck size={13} />{labels[state]}</span></header>
    <div className="analysis-summary"><div className="analysis-score" style={{ '--score': `${risk?.overall_risk_score ?? 0}%` } as React.CSSProperties}><span><strong>{risk?.overall_risk_score ?? '\u2014'}</strong><small>/100</small></span></div><div><strong>Indeks bahaya perjalanan</strong><p>{source}</p><span className="analysis-coverage">Data tersedia {risk?.coverage ?? 0}%</span></div></div>
    <div className="analysis-factor-grid">{factors.map(({ key, name, Icon, color }) => { const item = risk?.components[key]; return <div className={`analysis-factor factor-${color}`} key={key}><Icon size={18} /><span>{name}</span><strong>{item ? item.score : '\u2014'}<small>{item ? '/100' : ''}</small></strong><div className="analysis-factor-track"><i style={{ width: `${item?.score ?? 0}%` }} /></div></div>; })}</div>
    <div className="analysis-weather"><h4>Kondisi lingkungan <span>Dummy</span></h4><div><span><CloudRain />Hujan<strong>{environment.rainfall} <small>mm/jam</small></strong></span><span><Eye />Jarak pandang<strong>{environment.visibility} <small>m</small></strong></span><span><Waves />Permukaan jalan<strong>{{ dry: 'Kering', wet: 'Basah', damaged: 'Rusak', flooded: 'Tergenang', icy: 'Es' }[environment.road_condition]}</strong></span><span><Mountain />Kemiringan<strong>{environment.slope}&deg;</strong></span></div></div>
    {error && <p className="analysis-error" role="alert">{error}</p>}
    {risk?.reasons.length ? <div className="analysis-reasons">{risk.reasons.map(reason => <div key={reason}><TriangleAlert size={15} /><p>{reason}</p></div>)}</div> : <p className="analysis-neutral">{risk?.overall_risk_score != null ? 'Tidak ada pemicu bahaya pada data yang tersedia.' : 'Menyiapkan analisis perjalanan...'}</p>}
    {!!risk?.missing_components.length && <p className="analysis-missing">Belum tersedia: {risk.missing_components.map(key => ({ fatigue: 'deteksi kantuk yang cukup dari kamera', environment: 'lingkungan', behavior: 'kecepatan', vehicle: 'sensor kendaraan', gps: 'GPS akurat / titik bahaya' }[key] ?? key)).join(', ')}.</p>}
    {risk?.nearby_hazards.some(item => item.is_simulation) && <p className="analysis-missing">Titik bahaya sekitar memakai data contoh.</p>}
  </section>;
}
