import { useEffect, useState } from 'react';
import { Bell, Bluetooth, Camera, Coffee, Copy, LogOut, MapPin, PhoneCall, ShieldCheck, Timer, VideoOff, Volume2 } from 'lucide-react';
import SlideSound from './slide-sound';
import CameraDetection from './camera-detection';
import { Button } from './ui/button';
import type { AuthUser, DriverTelemetry } from '@/lib/api';
import type { LiveDriverView } from './live-driver';
import { useDriverAlarm } from './use-driver-alarm';
import { useSimpleDriverWarning } from './use-simple-driver-warning';
import useJourneyRisk from '@/lib/use-journey-risk';
import { demoVehicle } from '@/lib/demo-vehicle';
import { demoEnvironment } from '@/lib/demo-environment';
import { nearestRestStop } from '@/lib/rest-stops';

type Props = { user: AuthUser; logout: () => void; loggingOut: boolean; logoutError: string; live: LiveDriverView };

export default function DriverScreen({ user, logout, loggingOut, logoutError, live }: Props) {
  const [copyStatus, setCopyStatus] = useState('');
  const [now, setNow] = useState(Date.now());
  const [received, setReceived] = useState(Date.now());
  useEffect(() => { setReceived(Date.now()); }, [live.snapshot]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const elapsed = (now - received) / 1000;
  const fresh = (age: number | null | undefined) => age != null && age + elapsed <= 5;
  const telemetryFresh = fresh(live.snapshot?.telemetry_age_seconds);
  const position = telemetryFresh ? live.snapshot?.telemetry : null;
  const telemetry: DriverTelemetry = {
    latitude: position?.latitude ?? null, longitude: position?.longitude ?? null, accuracy: position?.accuracy ?? null,
    speed_source: position?.speed_source ?? null,
    rpm: position?.rpm ?? demoVehicle.rpm, fuel_level: position?.fuel_level ?? demoVehicle.fuel,
    engine_temperature: position?.engine_temperature ?? demoVehicle.engineTemp,
    behavior: position?.behavior ?? { speed: demoVehicle.speed, speed_limit: demoVehicle.speedLimit },
    environment: demoEnvironment,
  };
  const { result: risk } = useJourneyRisk(live.session, telemetry);
  const validGps = position?.accuracy != null && position.accuracy <= 100;
  const rest = nearestRestStop(validGps ? position?.latitude : null, validGps ? position?.longitude : null);
  const autonomous = !!live.session && live.snapshot?.admin_monitoring === false;
  const localWarning = useSimpleDriverWarning(live.session, autonomous, risk?.overall_risk_score ?? null, live.snapshot?.session_duration_seconds ?? 0, rest.name, fresh(live.snapshot?.frame_age_seconds) ? live.snapshot?.fatigue?.fatigue_status : undefined);
  const notifications = [...(live.snapshot?.notifications ?? [])].reverse();
  const sound = useDriverAlarm(live.session, [...(localWarning ? [localWarning] : []), ...(live.snapshot?.notifications ?? [])]);
  async function copySession() {
    try { await navigator.clipboard.writeText(live.session); setCopyStatus('ID sesi disalin'); }
    catch { setCopyStatus('Salin ID sesi yang ditampilkan untuk admin'); }
  }
  return <div className="driver-screen">
    <header className="driver-header"><div className="driver-brand"><img className="driver-brand-logo" src="/brand/selamate-logo.png" alt="" /><span><img className="driver-brand-wordmark" src="/brand/selamate-wordmark.png" alt="SelaMate" /><small>sampai tujuan</small></span></div><div className="driver-profile"><span><small>Pengemudi</small><strong>{user.name}</strong></span><button onClick={logout} disabled={loggingOut} aria-label="Logout"><LogOut size={18} /></button></div></header>
    <main className="driver-main">
      {(logoutError || live.error) && <p className="ews-error" role="alert">{logoutError || live.error}</p>}
      <section className="driver-camera-card" aria-labelledby="driver-camera-heading">
        <div className="driver-section-heading"><h1 id="driver-camera-heading">Kamera pengemudi</h1><span className="driver-connection"><i className="live-dot" data-active={live.cameraActive} />{live.cameraActive ? 'Aktif' : 'Offline'}</span></div>
        <div className="driver-camera-preview">{live.camera}{!live.cameraActive && <div className="driver-camera-placeholder"><VideoOff size={42} /><strong>Siap memulai perjalanan?</strong><p>Aktifkan kamera depan untuk pemantauan admin.</p></div>}</div>
        {live.session && <CameraDetection fatigue={fresh(live.snapshot?.frame_age_seconds) ? live.snapshot?.fatigue ?? null : null} />}
        <div className="driver-camera-actions">
          {live.playbackBlocked && <Button onClick={live.playCamera}>Tampilkan kamera</Button>}
          {!live.session && <Button className="driver-camera-start" onClick={() => { void sound.enable(); live.startCamera(); }} disabled={live.starting}><Camera />{live.starting ? 'Memulai…' : live.cameraActive ? 'Hubungkan ke admin' : 'Aktifkan kamera'}</Button>}
          {(live.cameraActive || live.session || live.starting) && <Button className="driver-camera-stop" onClick={live.stop}><VideoOff />Hentikan kamera</Button>}
        </div>
        {live.session && <details className="driver-share"><summary>Bagikan sesi ke admin</summary><code>{live.session}</code><Button variant="outline" onClick={() => void copySession()}><Copy />Salin ID sesi</Button><p role="status">{copyStatus}</p></details>}
      </section>
      <section className="driver-notifications" aria-labelledby="driver-notification-heading"><div className="driver-section-heading"><h2 id="driver-notification-heading"><Bell size={19} />Notifikasi admin</h2>{notifications.length > 0 && <span className="driver-notification-count">{notifications.length}</span>}</div>
        <div className="driver-sound-controls" data-audio-ready={sound.ready}><p><Volume2 size={16} />{sound.ready ? 'Suara alarm aktif' : 'Suara alarm belum aktif'}</p><SlideSound ready={sound.ready} onEnable={() => void sound.enable()} /><small>Naikkan volume media HP.{'vibrate' in navigator ? ' Suara + getar.' : ' Getar tidak didukung browser ini.'}</small>{sound.error && <p role="alert">{sound.error}</p>}</div>
        {sound.alarm && <div className="driver-incoming-alarm" role="alert" data-alarm-id={sound.alarm.id}><PhoneCall /><strong>{sound.alarm.local ? 'Peringatan otomatis SelaMate' : `Alarm dari ${sound.alarm.sender}`}</strong><p>{sound.alarm.message}</p>{!sound.ready && <p>Geser kontrol suara untuk membunyikan alarm.</p>}<Button onClick={sound.dismiss}>Hentikan alarm</Button></div>}
        <div aria-live="polite" aria-relevant="additions">{notifications.length ? notifications.map(note => <article className="driver-message" key={note.id}><div><strong>{note.sender}</strong><time dateTime={new Date(note.created_at * 1000).toISOString()}>{new Date(note.created_at * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{note.message}</p></article>) : <div className="driver-notifications-empty"><Bell size={26} /><p>Belum ada notifikasi</p><small>{live.session ? 'Pesan admin akan muncul di sini.' : 'Aktifkan kamera untuk menerima pesan admin.'}</small></div>}</div>
      </section>
      <section className={`driver-autonomous-card ${sound.alarm?.local ? 'has-warning' : ''}`} aria-label="Peringatan otomatis"><div className="driver-autonomous-header"><span className="driver-feature-icon"><ShieldCheck /></span><div><small>EARLY WARNING SYSTEM</small><h2>Teman perjalanan aktif</h2></div><span className="driver-monitor-badge">{!live.session ? 'Siap' : live.snapshot?.admin_monitoring === true ? 'Dipantau admin' : autonomous ? 'Otomatis' : 'Menghubungkan'}</span></div><p>{!live.session ? 'Aktifkan kamera untuk memulai peringatan perjalanan.' : autonomous ? 'Peringatan perjalanan tetap aktif saat admin tidak memantau.' : live.snapshot?.admin_monitoring === true ? 'Admin terhubung ke sesi perjalanan kamu.' : 'Memeriksa status pemantauan perjalanan...'}</p>{live.session && <><div className="driver-duration"><Timer size={16} /><span>Durasi perjalanan <strong>{Math.floor(demoVehicle.duration / 3600)}j {Math.floor(demoVehicle.duration % 3600 / 60)}m</strong></span><small>Dummy</small></div><div className="driver-rest-stop"><div><span className="rest-stop-icon"><Coffee /></span><div><small>{rest.distance == null ? 'REKOMENDASI TITIK CONTOH' : 'TITIK CONTOH TERDEKAT DARI GPS'}</small><h3>{rest.name}</h3><p>{rest.facilities}</p></div></div><footer><span><MapPin size={13} />{rest.distance == null ? 'Lokasi GPS belum tersedia' : `${rest.distance.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km garis lurus`}</span><a href={`https://www.google.com/maps/search/?api=1&query=${rest.latitude},${rest.longitude}`} target="_blank" rel="noreferrer">Lihat titik</a></footer><small>Lokasi dummy untuk demo, bukan tempat istirahat yang terverifikasi.</small></div></>}</section>
      <section className="driver-obd-card" aria-label="Konfigurasi OBD Bluetooth"><div className="driver-autonomous-header"><span className="driver-feature-icon obd-icon"><Bluetooth /></span><div><small>KONEKSI KENDARAAN</small><h2>OBD Bluetooth</h2></div><span className="driver-monitor-badge">BLE</span></div><p className="driver-obd-status" role="status">{live.bleStatus}</p>{live.obdControls}<details className="driver-driving-details"><summary>Konfigurasi perjalanan</summary>{live.drivingControls}</details><p className="driver-obd-note">Kecepatan dan RPM memakai sensor saat terhubung. Data yang belum tersedia memakai dummy untuk demo.</p></section>
    </main>
  </div>;
}
