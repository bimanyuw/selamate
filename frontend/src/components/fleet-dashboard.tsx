import { lazy, Suspense, useEffect, useState } from 'react';
import { Activity, CloudRain, Eye, Fuel, Gauge, LogOut, MapPin, Radio, Route, Thermometer, Timer, Video, VideoOff } from 'lucide-react';
import type { ActiveDriverSession, AuthUser, DriverTelemetry } from '@/lib/api';
import type { LiveDriverView } from './live-driver';
import ActiveDrivers from './active-drivers';
import LiveMap from './live-map';
import RemoteCamera from './remote-camera';
import AdminMessaging from './admin-messaging';
import JourneyAnalysis from './journey-analysis';
import CameraDetection from './camera-detection';
import ModelStatus from './model-status';
import { demoVehicle } from '@/lib/demo-vehicle';
import useJourneyRisk from '@/lib/use-journey-risk';
import { demoEnvironment } from '@/lib/demo-environment';
import DashboardGauge, { speedTone, type ReadingTone } from './dashboard-gauge';
const JourneyTrend = lazy(() => import('./journey-trend'));
import '@/fleet-dashboard.css';

type Props = { user: AuthUser; logout: () => void; loggingOut: boolean; logoutError: string; live: LiveDriverView };
const fatigueNames = { ALERT: 'Terjaga', DROWSY: 'Mengantuk', FATIGUED: 'Lelah', INSUFFICIENT_DATA: 'Data belum cukup' };
const format = (value: number | null | undefined) => value == null ? '\u2014' : value.toLocaleString('id-ID', { maximumFractionDigits: 1 });

export default function FleetDashboard({ user, logout, loggingOut, logoutError, live }: Props) {
  const [drivers, setDrivers] = useState<ActiveDriverSession[]>([]);
  const [now, setNow] = useState(Date.now());
  const [received, setReceived] = useState(Date.now());
  useEffect(() => { setReceived(Date.now()); }, [live.snapshot]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  function select(id: string) { if (!live.monitoring || id !== live.sessionKey) live.monitorSession(id); }
  const selected = drivers.find(driver => driver.session_id === live.sessionKey);
  const snapshot = live.snapshot;
  const elapsed = Math.max(0, (now - received) / 1000);
  const fresh = (age: number | null | undefined) => age != null && age + elapsed <= 5;
  const telemetryFresh = fresh(snapshot?.telemetry_age_seconds);
  const cameraFresh = fresh(snapshot?.camera_age_seconds);
  const frameFresh = fresh(snapshot?.frame_age_seconds);
  const showing = live.monitoring && !!live.sessionKey;
  const online = new Set(drivers.filter(driver => driver.camera_active).map(driver => driver.driver_id ?? driver.session_id)).size;
  const fatigue = frameFresh ? snapshot?.fatigue : null;
  const tone = fatigue?.fatigue_status === 'DROWSY' || fatigue?.fatigue_status === 'FATIGUED' ? 'critical' : fatigue?.fatigue_status === 'ALERT' ? 'safe' : 'unknown';
  const position = snapshot?.telemetry;
  const vehicle = demoVehicle;
  const speed = vehicle.speed;
  const speedLimit = vehicle.speedLimit;
  const rpm = vehicle.rpm;
  const speedState = speedTone(speed, speedLimit);
  const environment = demoEnvironment;
  const journeyTelemetry: DriverTelemetry = {
    latitude: telemetryFresh ? position?.latitude ?? null : null, longitude: telemetryFresh ? position?.longitude ?? null : null, accuracy: telemetryFresh ? position?.accuracy ?? null : null,
    speed_source: null,
    rpm: rpm ?? null, fuel_level: vehicle.fuel,
    engine_temperature: vehicle.engineTemp,
    behavior: { speed: vehicle.speed, speed_limit: vehicle.speedLimit },
    environment: environment ?? null,
  };
  const { result: risk, error: riskError } = useJourneyRisk(showing ? live.sessionKey : '', journeyTelemetry);
  const riskState: ReadingTone = risk?.risk_level === 'HIGH' ? 'danger' : risk?.risk_level === 'MEDIUM' ? 'caution' : risk?.risk_level === 'LOW' ? 'safe' : 'unknown';
  const fuel = vehicle.fuel;
  const fuelState: ReadingTone = fuel == null ? 'unknown' : fuel <= 10 ? 'danger' : fuel <= 25 ? 'attention' : 'safe';
  const attention = environment && (environment.rainfall > 0 || environment.road_condition !== 'dry');
  const trendSnapshot = showing ? { ...snapshot, telemetry: { ...position, latitude: position?.latitude ?? null, longitude: position?.longitude ?? null, accuracy: position?.accuracy ?? null, speed_source: null, rpm: vehicle.rpm, fuel_level: vehicle.fuel, behavior: { speed: vehicle.speed, speed_limit: vehicle.speedLimit }, environment: environment ?? null }, fatigue: snapshot?.fatigue ?? null, behavior: snapshot?.behavior ?? null, environment: snapshot?.environment ?? null, risk: null, telemetry_age_seconds: 0, frame_age_seconds: snapshot?.frame_age_seconds ?? null } : snapshot;
  const stateLabel = (state: ReadingTone) => ({ safe: 'Aman', caution: 'Hati-hati', attention: 'Perlu perhatian', danger: 'Waspada', unknown: 'Belum ada data' })[state];
  return <div className="command-shell real-fleet-dashboard">
    <header className="topbar"><a className="fleet-brand" href="/" aria-label="SelaMate, beranda"><img className="fleet-brand-logo" src="/brand/selamate-logo.png" alt="" /><span><img className="fleet-brand-wordmark" src="/brand/selamate-wordmark.png" alt="SelaMate" /><small>sampai tujuan</small></span></a><p className="top-slogan"><strong>Dashboard Early Warning System</strong></p><div className="top-meta"><span className="online"><i />{online} driver online</span><time>{new Date(now).toLocaleTimeString('id-ID')} WIB</time><div className="user-chip"><span>{user.name}<small>{user.role}</small></span><button onClick={logout} disabled={loggingOut} aria-label="Keluar"><LogOut size={16} /></button></div></div></header>
    <aside className="fleet-panel"><div className="panel-title"><p className="eyebrow">DRIVER TERHUBUNG</p><h2>{online} <small>driver aktif</small></h2></div><ActiveDrivers selected={live.monitoring ? live.sessionKey : ''} onSelect={select} onSessions={setDrivers} autoSelect={false} disabled={!!live.session || live.starting} /></aside>
    <main className="map-panel"><div className="map-header"><div><p className="eyebrow">LIVE MONITORING</p><h1>Peta perjalanan driver</h1><span>Klik driver pada peta untuk melihat live kameranya.</span></div></div>{(logoutError || live.error) && <p className="fleet-error" role="alert">{logoutError || live.error}</p>}<div className="map-wrap"><LiveMap snapshot={snapshot} sessionKey={live.sessionKey} stale={!telemetryFresh} drivers={drivers} onSelect={select} selectionDisabled={!!live.session || live.starting} showStatus={false} /><div className="route-summary"><div><span>DRIVER DIPANTAU</span><strong>{showing ? selected?.driver_name ?? 'Driver' : 'Pilih driver'}</strong></div><div><span>KECEPATAN</span><strong>{showing ? format(speed) : '\u2014'} km/j</strong></div><div><span>KONDISI DRIVER</span><strong className={tone}>{fatigue ? fatigueNames[fatigue.fatigue_status] : 'Menunggu deteksi'}</strong></div><div><span>LOKASI</span><strong>{position?.latitude != null && position.longitude != null ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}` : '\u2014'}</strong></div></div></div></main>
    <aside className="monitor-panel"><div className="monitor-head"><div><p className="eyebrow">LIVE VIEW DRIVER</p><h2>{showing ? selected?.driver_name ?? 'Driver' : 'Pilih driver'}</h2>{showing && <span>Sesi {live.sessionKey.slice(0, 8)}</span>}</div></div>{showing ? <><section className="camera-feed">{snapshot?.camera_version ? <RemoteCamera key={live.sessionKey} sessionId={live.sessionKey} version={snapshot.camera_version} /> : <div className="fleet-camera-placeholder"><VideoOff /><p>Menunggu kamera driver</p></div>}</section><div className="camera-caption"><span><Video size={14} />{cameraFresh ? 'Kamera driver terhubung' : 'Menunggu frame terbaru'}</span></div><CameraDetection fatigue={fatigue ?? null} /><section className={`fatigue-card status-${tone === 'critical' ? 'danger' : tone}`}><div><span>KONDISI DRIVER</span><strong className={tone}>{fatigue ? fatigueNames[fatigue.fatigue_status] : 'Menunggu deteksi'}</strong></div>{fatigue?.fatigue_score != null && <div className="risk-bar"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, fatigue.fatigue_score))}%` }} /></div>}<p><Eye size={14} />{fatigue ? `Cakupan deteksi ${format(fatigue.detection_rate * 100)}%` : 'Data mata belum tersedia'}</p></section><div className="fleet-gauge-grid"><section className={`fleet-reading status-${speedState}`}><h3><Gauge />Kecepatan</h3><DashboardGauge value={speed} max={Math.max(120, speedLimit ?? 0, speed ?? 0)} tone={speedState} label="Kecepatan" /><strong>{format(speed)} <small>km/jam</small></strong><span>{stateLabel(speedState)}</span></section><section className={`fleet-reading status-${riskState}`}><h3><Radio />Skor bahaya</h3><DashboardGauge value={risk?.overall_risk_score} max={100} tone={riskState} label="Skor bahaya" /><strong>{format(risk?.overall_risk_score)} <small>/100</small></strong><span>{stateLabel(riskState)}</span></section></div><JourneyAnalysis risk={risk} environment={environment} error={riskError} /><ModelStatus /><div className="metrics-grid"><section className={`metric fleet-fuel status-${fuelState}`}><Fuel size={20} /><span>Bahan bakar<strong>{format(fuel)}{fuel != null ? '%' : ''}</strong><small>{fuel == null ? 'Sensor belum terhubung' : stateLabel(fuelState)}</small></span></section><section className="metric"><Activity size={20} /><span>RPM mesin<strong>{format(rpm)}</strong><small>{rpm == null ? 'Menunggu sensor' : 'rpm'}</small></span></section><><section className="metric"><Timer size={20} /><span>Durasi berkendara<strong>{Math.floor(vehicle.duration / 3600)}j {Math.floor(vehicle.duration % 3600 / 60)}m</strong></span></section><section className="metric"><Route size={20} /><span>Jarak tempuh<strong>{format(vehicle.distance)} km</strong></span></section><section className="metric"><Thermometer size={20} /><span>Suhu mesin<strong>{vehicle.engineTemp} &deg;C</strong></span></section></></div>{attention && <section className="fleet-environment-alert status-attention"><CloudRain /><div><strong>Kondisi perlu perhatian</strong><p>{environment.rainfall > 0 ? `Hujan ${format(environment.rainfall)} mm/jam` : 'Kondisi jalan kurang ideal'}</p></div></section>}<Suspense fallback={<p className="control-note">Memuat kurva perjalanan...</p>}><JourneyTrend key={live.sessionKey} sessionId={live.sessionKey} snapshot={trendSnapshot} simulatedSpeed journeyRisk={risk} /></Suspense><section className="vehicle-status"><h3>Lokasi driver</h3><div><MapPin size={15} /><span>Status GPS<strong>{telemetryFresh && position?.latitude != null && position.longitude != null ? 'Lokasi terkini' : 'Menunggu lokasi terbaru'}</strong></span></div></section><AdminMessaging key={live.sessionKey} sessionId={live.sessionKey} snapshot={snapshot} /></> : <div className="fleet-camera-placeholder fleet-selection-prompt"><Video size={36} /><h3>Pilih driver untuk live view</h3><p>Klik penanda driver pada peta atau tombol Pantau di daftar kiri.</p><small>Driver tanpa GPS tetap tersedia di daftar kiri.</small></div>}</aside>
  </div>;
}
