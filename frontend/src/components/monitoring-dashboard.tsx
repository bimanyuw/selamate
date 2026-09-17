import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowDownUp, ArrowUpRight, Bell, Bluetooth, ChevronDown, CircleAlert, Clock3, CloudRain, Eye, Fuel, Gauge, LogOut, MapPin, Mountain, Navigation, Radio, RefreshCw, Route, ScanFace, Send, Settings2, ShieldCheck, Timer, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAlerts, getAdminSummary, type AdminSummary, type AlertsResponse, type AuthUser, type DriverSnapshot } from '@/lib/api';
import type { LiveDriverView } from './live-driver';
import DriverRisk from './driver-risk';

const LiveMap = lazy(() => import('./live-map'));
const RiskMap = lazy(() => import('./risk-map'));
const RiskChart = lazy(() => import('./risk-chart'));
const roadNames = { dry: 'Kering', wet: 'Basah', damaged: 'Rusak', flooded: 'Tergenang', icy: 'Berlapis es' };
const levelNames = { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi' };
const fatigueNames = { ALERT: 'Terjaga', DROWSY: 'Mengantuk', FATIGUED: 'Lelah', INSUFFICIENT_DATA: 'Data belum cukup' };
const factorNames = { fatigue: 'Kelelahan', behavior: 'Perilaku', environment: 'Lingkungan', none: 'Tidak ada' };
const number = (value: number | null | undefined, digits = 0) => value == null ? '—' : value.toLocaleString('id-ID', { maximumFractionDigits: digits });

function Status({ children, active = false, warning = false }: { children: ReactNode; active?: boolean; warning?: boolean }) {
  return <span className={`ews-status ${warning ? 'is-warning' : active ? 'is-active' : ''}`}><span aria-hidden="true" />{children}</span>;
}

function Metric({ icon, label, value, unit, note, primary = false, unavailable = false }: { icon: ReactNode; label: string; value: string; unit?: string; note: string; primary?: boolean; unavailable?: boolean }) {
  return <article className={`vehicle-metric ${primary ? 'metric-primary' : ''} ${unavailable ? 'metric-unavailable' : ''}`}>
    <div className="metric-label"><span>{label}</span>{icon}</div>
    <p className="metric-value">{value}{unit && value !== '—' && <span>{unit}</span>}</p>
    <p className="metric-note">{note}</p>
  </article>;
}

// Ages continue increasing when network polling stalls.
function useReadingAge(snapshot: DriverSnapshot | null) {
  const received = useRef({ snapshot, at: Date.now() });
  if (received.current.snapshot !== snapshot) received.current = { snapshot, at: Date.now() };
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const since = (Date.now() - received.current.at) / 1000;
  return {
    telemetry: snapshot?.telemetry_age_seconds == null ? null : snapshot.telemetry_age_seconds + since,
    frame: snapshot?.frame_age_seconds == null ? null : snapshot.frame_age_seconds + since,
    readingTime: snapshot?.telemetry_age_seconds == null ? null : new Date(received.current.at - snapshot.telemetry_age_seconds * 1000),
  };
}

function RiskSummary({ snapshot, telemetryFresh, frameFresh }: { snapshot: DriverSnapshot | null; telemetryFresh: boolean; frameFresh: boolean }) {
  const risk = telemetryFresh && frameFresh ? snapshot?.risk : null;
  const components = [
    ['Kelelahan', snapshot?.fatigue?.fatigue_status === 'INSUFFICIENT_DATA' ? null : snapshot?.fatigue?.fatigue_score, frameFresh],
    ['Perilaku', snapshot?.behavior?.behavior_score, telemetryFresh],
    ['Lingkungan', snapshot?.environment?.environment_score, telemetryFresh],
  ] as const;
  return <section className={`risk-overview ${risk?.risk_level === 'HIGH' ? 'risk-elevated' : ''}`} aria-label="Risiko perjalanan">
    <div className="risk-total"><ShieldCheck aria-hidden="true" /><div><p className="eyebrow">RISIKO PERJALANAN</p><p><strong>{number(risk?.overall_risk_score, 1)}</strong><span> / 100</span></p></div><span className="risk-level">{risk ? levelNames[risk.risk_level] : 'Menunggu data'}</span></div>
    <div className="risk-components">{components.map(([label, value, fresh]) => <div key={label}><div><span>{label}</span><strong>{fresh ? number(value, 1) : '—'}</strong></div><div className="score-track"><span style={{ width: `${fresh && value != null ? Math.max(0, Math.min(100, value)) : 0}%` }} /></div></div>)}</div>
    <div className="risk-message"><p>{risk ? risk.warning : 'Skor gabungan menunggu ketiga komponen yang valid dan terbaru.'}</p>{risk && <small>Faktor dominan: {factorNames[risk.dominant_factor]}</small>}</div>
    {risk && <details className="risk-breakdown"><summary>Rincian pembobotan</summary><div>{Object.entries(risk.component_breakdown).map(([key, item]) => <span key={key}>{factorNames[key as keyof typeof factorNames]}: {number(item.score, 1)} × {number(item.weight * 100)}% = {number(item.contribution, 1)}</span>)}</div></details>}
  </section>;
}

function EnvironmentPanel({ snapshot, stale }: { snapshot: DriverSnapshot | null; stale: boolean }) {
  const env = snapshot?.telemetry?.environment;
  return <aside className="ews-panel environment-panel">
    <div className="panel-heading"><div><p className="eyebrow">KONTEKS PERJALANAN</p><h2>Kondisi lingkungan</h2></div><CloudRain aria-hidden="true" /></div>
    <div className="environment-note">{env ? stale ? 'Data terakhir · pembaruan terlambat' : 'Sumber: input kondisi sesi' : 'Menunggu kondisi dari sesi pengemudi'}</div>
    <div className="environment-item"><div className="environment-icon"><CloudRain /></div><div><span>Kondisi cuaca</span><strong>{env ? `Hujan ${number(env.rainfall, 1)} mm/jam` : 'Belum tersedia'}</strong><small>Jarak pandang {number(env?.visibility)}{env ? ' m' : ''}</small></div></div>
    <div className="environment-item"><div className="environment-icon"><Mountain /></div><div><span>Topografi</span><strong>{env ? `Kemiringan ${number(env.slope, 1)}°` : 'Belum tersedia'}</strong><small>Kemiringan diisi manual</small></div></div>
    <div className="environment-item"><div className="environment-icon"><Route /></div><div><span>Geometri jalan</span><strong className="unavailable-text">Belum tersedia</strong><small>Data tikungan belum terhubung</small></div></div>
    <div className="environment-item"><div className="environment-icon"><Navigation /></div><div><span>Kondisi jalan</span><strong>{env ? roadNames[env.road_condition] : 'Belum tersedia'}</strong><small>Risiko bencana {number(env?.disaster_risk)}{env ? '/100' : ''}</small></div></div>
  </aside>;
}

function BehaviorPanel({ snapshot, stale }: { snapshot: DriverSnapshot | null; stale: boolean }) {
  const fatigue = snapshot?.fatigue;
  const eye = !fatigue ? 'Menunggu kamera' : stale ? 'Data terlambat' : fatigue.eye_state === 'CLOSED' ? 'Tertutup' : fatigue.eye_state === 'OPEN' ? 'Terbuka' : 'Tidak terdeteksi';
  const rows = [
    { label: 'Blink rate', value: 'Belum tersedia', detail: 'Kedipan per menit belum dihitung', icon: <Eye /> },
    { label: 'Eye closed', value: eye, detail: fatigue ? `Penutupan terlama ${number(fatigue.max_closed_duration, 2)} detik` : 'Status mata dari detektor', icon: <Eye />, alert: !stale && fatigue?.eye_state === 'CLOSED' },
    { label: 'Yawn', value: 'Belum tersedia', detail: 'Deteksi menguap belum tersedia', icon: <ScanFace /> },
    { label: 'Head pose', value: 'Belum tersedia', detail: 'Orientasi kepala belum tersedia', icon: <ScanFace /> },
    { label: 'PERCLOS', value: fatigue?.perclos == null ? '—' : `${number(fatigue.perclos * 100, 1)}%`, detail: stale ? 'Nilai terakhir · data terlambat' : 'Proporsi durasi mata tertutup', icon: <Activity /> },
  ];
  return <aside className="behavior-panel"><div className="panel-heading"><div><p className="eyebrow">ANALISIS PENGEMUDI</p><h3>DRIVING BEHAVIOR<br />YANG TERDETEKSI</h3></div><ScanFace aria-hidden="true" /></div>
    <div className="behavior-readings">{rows.map(row => <div className={`behavior-reading ${row.alert ? 'reading-alert' : ''}`} key={row.label}><span className="reading-icon">{row.icon}</span><div><span>{row.label}</span><small>{row.detail}</small></div><strong>{row.value}</strong></div>)}</div>
    <div className="detection-footer"><span>Cakupan deteksi <strong>{fatigue ? number(fatigue.detection_rate * 100, 1) + '%' : '—'}</strong></span><span>Episode mata tertutup <strong>{number(fatigue?.closure_events)}</strong></span></div>
  </aside>;
}

function AdminPanel() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    getAdminSummary(controller.signal).then(setSummary).catch(err => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan admin');
    });
    return () => controller.abort();
  }, []);
  return <div className="admin-strip"><ShieldCheck size={17} /><strong>Panel Admin</strong>{error ? <span role="alert">{error}</span> : summary ? <span>{summary.activeUsers} akun terdaftar · {summary.systemStatus} · Sumber: {summary.dataSource}</span> : <span>Memuat ringkasan admin…</span>}</div>;
}

type Props = { user: AuthUser; logout: () => void; loggingOut: boolean; logoutError: string; live: LiveDriverView };

export default function MonitoringDashboard({ user, logout, loggingOut, logoutError, live }: Props) {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [region, setRegion] = useState('Semua wilayah');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [updated, setUpdated] = useState('');
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      setLoading(true);
      try {
        const next = await getAlerts(controller.signal);
        if (controller.signal.aborted) return;
        setData(next); setError(''); setUpdated(new Date().toLocaleTimeString('id-ID'));
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Gagal memuat data.');
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(load, 30_000); }
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);

  const alerts = data?.alerts ?? [];
  const regions = [...new Set(alerts.map(a => a.region))];
  const selected = regions.includes(region) ? region : 'Semua wilayah';
  const filtered = alerts.filter(a => selected === 'Semua wilayah' || a.region === selected);
  const simulated = data?.source === 'simulation' || alerts.some(a => a.is_simulation);
  const { snapshot } = live;
  const age = useReadingAge(snapshot);
  const telemetryFresh = !!live.sessionKey && age.telemetry != null && age.telemetry <= 5;
  const frameFresh = !!live.sessionKey && age.frame != null && age.frame <= 5;
  const active = !!live.sessionKey && (telemetryFresh || frameFresh);
  const telemetry = snapshot?.telemetry;
  const behavior = telemetry?.behavior;
  const cameraLabel = live.monitoring ? 'Perangkat pengemudi' : live.cameraActive ? 'Kamera aktif' : 'Kamera offline';
  const dataNote = telemetryFresh ? telemetry?.speed_source === 'obd' ? 'Sumber: OBD-II' : telemetry?.speed_source === 'gps' ? 'Sumber: GPS perangkat' : 'Menunggu sensor' : telemetry ? 'Data terakhir · terlambat' : 'Menunggu sesi pengemudi';

  return <div className="ews-dashboard">
    <a href="#dashboard-content" className="skip-link">Lewati ke dashboard</a>
    <header className="ews-header">
      <a href="/" className="ews-brand" aria-label="Selamate EWS, beranda"><span className="brand-symbol"><ShieldCheck /></span><span><strong>EWS<span>.</span></strong><small>SELAMATE</small></span></a>
      <div className="header-title"><h1>MONITORING DASHBOARD</h1><p>Early Warning System · Pusat pemantauan perjalanan</p></div>
      <div className="header-account"><div><Status active={active} warning={!!live.sessionKey && !active}>ARMADA AKTIF <b>{active ? '01' : '00'}</b></Status><small>Sesi yang sedang dipantau</small></div><button className="logout-button" onClick={logout} disabled={loggingOut} aria-label={loggingOut ? 'Sedang logout' : 'Logout'} title={`Logout · ${user.name}`}><LogOut size={18} /><span>{loggingOut ? 'Keluar…' : 'Logout'}</span></button></div>
    </header>
    <main id="dashboard-content" className="dashboard-main">
      <div className="dashboard-toolbar"><div><p className="eyebrow">OPERASIONAL / MONITORING</p><h2>Pantau perjalanan. Antisipasi risiko.</h2></div><a className="toolbar-action" href="#operator-actions"><Radio size={16} />{live.sessionKey ? 'Kelola sesi' : 'Mulai / pantau sesi'}<ArrowUpRight size={15} /></a></div>
      {logoutError && <p className="ews-error" role="alert">{logoutError}</p>}
      {live.error && <p className="ews-error" role="alert"><CircleAlert size={18} />{live.error}</p>}
      <section aria-labelledby="vehicle-title">
        <div className="section-heading"><div className="section-title"><span className="section-number">01</span><h2 id="vehicle-title">DATA KENDARAAN</h2></div><Status active={telemetryFresh} warning={!!telemetry && !telemetryFresh}>{telemetryFresh ? 'Telemetri terhubung' : telemetry ? 'Data terlambat' : 'Menunggu telemetri'}</Status></div>
        <div className="vehicle-grid">
          <Metric icon={<Gauge />} label="Kecepatan kendaraan" value={number(behavior?.speed, 1)} unit="km/jam" note={dataNote} primary />
          <Metric icon={<Clock3 />} label="Timestamp pembacaan" value={age.readingTime ? age.readingTime.toLocaleTimeString('id-ID') : '—'} note={age.telemetry == null ? 'Belum ada pembacaan' : `Perkiraan penerimaan · ${number(age.telemetry, 1)} dtk lalu`} />
          <Metric icon={<Gauge />} label="Batas kecepatan" value={number(behavior?.speed_limit)} unit="km/jam" note="Input batas pada sesi" />
          <Metric icon={<ArrowDownUp />} label="Akselerasi / deselerasi" value="—" note="Belum tersedia · m/s²" unavailable />
          <Metric icon={<Navigation />} label="Lateral / rotasi" value="—" note="Sensor gerak belum terhubung" unavailable />
          <Metric icon={<Timer />} label="Durasi berkendara" value="—" note="Durasi perjalanan belum tersedia" unavailable />
          <Metric icon={<Route />} label="Jarak tempuh" value="—" note="Odometer belum tersedia" unavailable />
          <Metric icon={<Activity />} label="RPM mesin" value={number(telemetry?.rpm)} unit="rpm" note={telemetry?.rpm != null ? telemetryFresh ? 'Sumber: OBD-II' : 'Data terakhir · terlambat' : 'Menunggu OBD-II'} />
          <Metric icon={<Settings2 />} label="Engine load" value="—" note="Belum tersedia · %" unavailable />
          <Metric icon={<Settings2 />} label="Throttle position" value="—" note="Belum tersedia · %" unavailable />
          <Metric icon={<Fuel />} label="Sisa bahan bakar" value="—" note="Fuel level belum tersedia" unavailable />
          <Metric icon={<CircleAlert />} label="Check engine" value="—" note="Status mesin belum tersedia" unavailable />
        </div>
      </section>
      <RiskSummary snapshot={snapshot} telemetryFresh={telemetryFresh} frameFresh={frameFresh} />
      <section id="live-monitoring" aria-labelledby="monitoring-title">
        <div className="section-heading"><div className="section-title"><span className="section-number">02</span><h2 id="monitoring-title">LIVE MONITORING</h2></div><span className="section-caption"><MapPin size={14} />Lokasi & kondisi perjalanan</span></div>
        <div className="monitoring-grid"><div className="ews-panel live-map-panel">
          <div className="map-toolbar"><div><span className="live-dot" data-active={telemetryFresh} />{live.sessionKey ? 'Sesi pengemudi dipantau' : 'Belum ada sesi dipilih'}</div><span>GPS {telemetry?.accuracy != null ? `±${number(telemetry.accuracy)} m` : 'belum tersedia'}</span></div>
          <Suspense fallback={<div className="map-loading">Memuat peta…</div>}><LiveMap snapshot={snapshot} sessionKey={live.sessionKey} stale={!telemetryFresh} /></Suspense>
          <div className="map-footer"><span><span className="route-key" />Jejak GPS selama pemantauan</span><span>{telemetry?.latitude != null && telemetry.longitude != null ? `${telemetry.latitude.toFixed(5)}, ${telemetry.longitude.toFixed(5)}` : 'Menunggu koordinat pengemudi'}</span></div>
        </div><EnvironmentPanel snapshot={snapshot} stale={!telemetryFresh} /></div>
      </section>
      <section id="driver-camera" aria-labelledby="camera-title">
        <div className="section-heading"><div className="section-title"><span className="section-number">03</span><h2 id="camera-title">LIVE DRIVER CAMERA</h2></div><Status active={frameFresh} warning={!!snapshot?.fatigue && !frameFresh}>{frameFresh ? 'Deteksi diperbarui' : snapshot?.fatigue ? 'Deteksi terlambat' : 'Menunggu deteksi'}</Status></div>
        <div className="ews-panel camera-grid"><div className="camera-panel">
          <div className="camera-stage" data-active={live.cameraActive}>
            <div className="camera-overlay-top"><span><Video size={14} /> DRIVER CAM / 01</span><span><i className="live-dot" data-active={live.cameraActive} />{cameraLabel}</span></div>
            {live.camera}
            {!live.cameraActive && <div className="camera-empty"><span className="camera-empty-icon"><VideoOff size={32} strokeWidth={1.2} /></span><strong>{live.monitoring ? 'Pratinjau di perangkat pengemudi' : 'Kamera belum aktif'}</strong><p>{live.monitoring ? 'Hasil deteksi tampil di dashboard ini. Video langsung tersedia pada perangkat yang memulai sesi.' : 'Mulai sesi dan izinkan kamera untuk memantau kondisi pengemudi.'}</p>{!live.monitoring && <a href="#operator-actions">Siapkan sesi <ArrowUpRight size={14} /></a>}</div>}
            <span className="camera-corner corner-tl" /><span className="camera-corner corner-br" />
            <div className="camera-overlay-bottom"><span>{live.session ? `SESI ${live.session.slice(0, 8).toUpperCase()}` : live.monitoring ? 'MODE MONITOR' : 'MENUNGGU SESI'}</span><span>{age.frame == null ? 'BELUM ADA FRAME' : `FRAME ${number(age.frame, 1)} DTK LALU`}</span></div>
          </div>
          <div className="camera-status-bar" role="status"><span><span className="live-dot" data-active={live.monitoring ? frameFresh : live.cameraActive} />{live.monitoring ? 'Memantau hasil deteksi perangkat pengemudi' : live.cameraStatus}</span><strong>{snapshot?.fatigue ? frameFresh ? fatigueNames[snapshot.fatigue.fatigue_status] : 'Data deteksi terlambat' : 'Belum ada analisis'}</strong></div>
        </div><BehaviorPanel snapshot={snapshot} stale={!frameFresh} /></div>
      </section>
      <details className="ews-panel regional-panel"><summary><div><MapPin size={18} /><span>PERINGATAN & POTENSI RISIKO WILAYAH</span></div><span>{data ? `${regions.length} wilayah · ${alerts.length} peringatan` : 'Memuat data'}<ChevronDown size={16} /></span></summary>
        <div className="regional-content">
          <p className="source-note">{data ? simulated ? 'Data wilayah simulasi untuk demonstrasi; terpisah dari telemetri kendaraan.' : 'Sumber peringatan: database.' : 'Menunggu sumber peringatan wilayah.'}</p>
          <div className="regional-controls"><label>Wilayah<select value={selected} onChange={e => setRegion(e.target.value)}><option>Semua wilayah</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label><Button variant="outline" disabled={loading} onClick={reload}><RefreshCw className={loading ? 'animate-spin' : ''} />Perbarui</Button></div>
          <p role="status" className="update-note">{loading ? 'Memuat data…' : error ? error + (data ? ' Menampilkan data terakhir.' : '') : `Diperbarui ${updated} · Pembaruan otomatis setiap 30 detik`}</p>
          {data && filtered.length > 0 && <><div className="regional-visuals"><div><h3>Sebaran peringatan wilayah</h3><Suspense fallback={<p>Memuat peta wilayah…</p>}><RiskMap alerts={filtered} /></Suspense></div><div><h3>Jumlah peringatan per tingkat</h3><Suspense fallback={<p>Memuat grafik…</p>}><RiskChart alerts={filtered} /></Suspense></div></div>
            <div className="alert-list">{filtered.map(alert => <article key={alert.id}><CircleAlert size={18} /><div><span className="eyebrow">{alert.level} · {alert.region}</span><h3>{alert.hazard}</h3><details><summary>Keterangan</summary><p>{alert.description}</p></details></div>{alert.is_simulation && <span className="simulation-label">SIMULASI</span>}</article>)}</div></>}
          {data && !filtered.length && <p className="update-note">Belum ada peringatan pada data yang tersedia.</p>}
        </div>
      </details>
      <DriverRisk />
      <section id="operator-actions" aria-labelledby="operator-title">
        <div className="section-heading"><div className="section-title"><span className="section-number">04</span><h2 id="operator-title">OPERATOR ACTIONS</h2></div><span className="section-caption">{user.name} · {user.role}</span></div>
        <div className="ews-panel operator-panel">
          <div className="operator-intro"><div><h3>Kelola sesi perjalanan</h3><p>Mulai kamera pada HP atau pantau ID sesi dari perangkat lain.</p></div>{(live.session || live.starting || live.monitoring) && <Button variant="outline" className="stop-session" onClick={live.stop}>{live.monitoring ? 'Hentikan pemantauan' : 'Hentikan sesi'}</Button>}</div>
          <div className="session-controls"><div><h4><Video size={17} />Mode pengemudi realtime</h4><p className="control-note">Isi kondisi perjalanan dan jumlah kejadian pada periode yang sama. Kamera dan GPS memerlukan izin perangkat.</p>{live.configuration}</div>
            <div className="monitor-controls"><h4><Radio size={17} />Pantau perangkat lain</h4>{live.session ? <div className="session-id"><p>Bagikan ID ini kepada operator yang sudah login.</p><strong>{live.session}</strong></div> : live.monitorControls}
              {live.monitoring && <p className="control-note">Sedang memantau sesi <strong className="break-all">{live.sessionKey}</strong></p>}
              <div className="sensor-status"><p><MapPin size={14} />{live.monitoring ? telemetry?.latitude != null && telemetry.longitude != null ? `GPS pengemudi · akurasi ${number(telemetry.accuracy)} m` : 'GPS pengemudi belum tersedia' : live.gpsStatus}</p><p><Bluetooth size={14} />{live.monitoring ? telemetry?.speed_source === 'obd' || telemetry?.rpm != null ? 'Data OBD diterima dari pengemudi' : 'Belum ada data OBD pengemudi' : live.bleStatus}</p></div>
              {live.obdControls}
            </div>
          </div>
          <div className="event-counts"><span>Kejadian tercatat · input manual</span><span>Pengereman <b>{number(behavior?.harsh_braking == null ? null : Number(behavior.harsh_braking))}</b></span><span>Akselerasi <b>{number(behavior?.harsh_acceleration == null ? null : Number(behavior.harsh_acceleration))}</b></span><span>Belokan tajam <b>{number(behavior?.sharp_turns == null ? null : Number(behavior.sharp_turns))}</b></span></div>
          <div className="operator-messaging"><div><p>Komunikasi pengemudi</p><small>Pengiriman notifikasi dan perintah belum tersedia.</small></div><Button variant="outline" disabled><Bell />Kirim notifikasi</Button><Button variant="outline" disabled><Send />Kirim perintah</Button></div>
          {user.role === 'Admin' && <AdminPanel />}
        </div>
      </section>
    </main>
    <footer className="ews-footer"><span><ShieldCheck size={16} /><strong>SELAMATE EWS</strong> · Early Warning System</span><span>© {new Date().getFullYear()} Selamate · Pantau. Pahami. Antisipasi.</span></footer>
  </div>;
}
