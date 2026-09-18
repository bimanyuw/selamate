import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, createDriverSession, getDriverSession, sendDriverCamera, sendDriverFrame, sendDriverTelemetry, stopDriverSession, type DriverSnapshot, type EnvironmentInput } from '@/lib/api';
import { ObdBle, type ObdReading } from '@/lib/obd-ble';
import { demoEnvironment } from '@/lib/demo-environment';

const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Permintaan gagal.';
function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Akses kamera ditolak. Izinkan kamera pada pengaturan situs di browser, lalu coba lagi.';
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera atau panggilan video, lalu coba lagi.';
  if (name === 'NotFoundError') return 'Kamera tidak ditemukan pada perangkat ini.';
  return errorMessage(error);
}
type Configuration = { limit: number; braking: number; acceleration: number; turns: number; environment: EnvironmentInput };

export type LiveDriverView = {
  session: string;
  sessionKey: string;
  starting: boolean;
  monitoring: boolean;
  snapshot: DriverSnapshot | null;
  error: string;
  cameraActive: boolean;
  cameraStatus: string;
  gpsStatus: string;
  bleStatus: string;
  stop: () => void;
  startCamera: () => void;
  monitorSession: (id: string) => void;
  playCamera: () => void;
  playbackBlocked: boolean;
  camera: ReactNode;
  configuration: ReactNode;
  obdControls: ReactNode;
  drivingControls: ReactNode;
  monitorControls: ReactNode;
};

// Keep the existing session, camera, GPS and BLE lifecycle in one mounted owner.
// The dashboard only arranges these controls and readings into visual panels.
export default function LiveDriver({ children }: { children: (view: LiveDriverView) => ReactNode }) {
  const [session, setSession] = useState('');
  const [starting, setStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [snapshot, setSnapshot] = useState<DriverSnapshot | null>(null);
  const [error, setError] = useState('');
  const [cameraStatus, setCameraStatus] = useState('Kamera belum aktif');
  const [gpsStatus, setGpsStatus] = useState('GPS belum aktif');
  const [bleStatus, setBleStatus] = useState('OBD belum terhubung');
  const [bleBusy, setBleBusy] = useState(false);
  const [monitorId, setMonitorId] = useState('');
  const [monitoring, setMonitoring] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const gps = useRef<{ position: GeolocationPosition; received: number } | null>(null);
  const obd = useRef<ObdReading | null>(null);
  const adapter = useRef<ObdBle | null>(null);
  const controller = useRef<AbortController | null>(null);
  const monitorController = useRef<AbortController | null>(null);
  const sessionRef = useRef('');
  const startLock = useRef(false);
  const watch = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const settings = useRef<Configuration>({ limit: 60, braking: 0, acceleration: 0, turns: 0, environment: demoEnvironment });
  const [settingsStatus, setSettingsStatus] = useState('');

  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    video.current = node;
    if (node) {
      node.muted = true;
      node.playsInline = true;
      node.setAttribute('webkit-playsinline', 'true');
      if (stream.current && node.srcObject !== stream.current) node.srcObject = stream.current;
    }
  }, []);

  async function playCamera() {
    const preview = video.current;
    const media = stream.current;
    if (!preview || !media) return;
    preview.muted = true;
    preview.playsInline = true;
    if (preview.srcObject !== media) preview.srcObject = media;
    try {
      await preview.play();
      if (stream.current === media && media.active) setPlaybackBlocked(false);
    } catch {
      if (stream.current === media && media.active) setPlaybackBlocked(true);
    }
  }

  function cleanup() {
    controller.current?.abort();
    monitorController.current?.abort();
    timers.current.forEach(clearTimeout); timers.current = [];
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    adapter.current?.disconnect(); adapter.current = null; obd.current = null; gps.current = null;
    const id = sessionRef.current; sessionRef.current = '';
    if (id) void stopDriverSession(id).catch(() => {});
  }
  useEffect(() => cleanup, []);

  function stop() {
    cleanup(); setSession(''); setMonitoring(false); setStarting(false); setSnapshot(null);
    setCameraActive(false); setPlaybackBlocked(false);
    setCameraStatus('Kamera dihentikan'); setGpsStatus('GPS dihentikan'); setBleStatus('OBD terputus');
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const num = (key: string) => Number(data.get(key));
    const config: Configuration = { limit: num('limit'), braking: num('braking'), acceleration: num('acceleration'), turns: num('turns'), environment: { rainfall: num('rain'), visibility: num('visibility'), road_condition: data.get('road') as EnvironmentInput['road_condition'], slope: num('slope'), disaster_risk: num('disaster') } };
    await begin(config);
  }

  async function begin(config?: Configuration) {
    if (sessionRef.current || startLock.current || monitoring) return;
    if (!window.isSecureContext) { setError('Kamera HP membutuhkan alamat HTTPS. Buka link HTTPS dari launcher HP, bukan alamat IP dengan http://.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Browser ini tidak menyediakan akses kamera. Buka halaman langsung di Chrome atau Safari.'); return; }
    if (config) settings.current = config;
    startLock.current = true;
    setStarting(true); setError(''); setSnapshot(null);
    const active = new AbortController(); controller.current = active;
    let id = '';
    const schedule = (callback: () => void, delay: number) => {
      if (!active.signal.aborted) {
        const timer = setTimeout(() => { timers.current = timers.current.filter(value => value !== timer); callback(); }, delay);
        timers.current.push(timer);
      }
    };
    try {
      if (!stream.current?.active) {
        setCameraStatus('Menunggu izin kamera…');
        let media: MediaStream;
        try {
          media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        } catch (failure) {
          if (active.signal.aborted) return;
          if (failure instanceof Error && ['OverconstrainedError', 'NotFoundError'].includes(failure.name)) {
            media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else throw failure;
        }
        if (active.signal.aborted) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        media.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
          if (stream.current === media) {
            setCameraActive(false); setCameraStatus('Kamera terputus. Hentikan sesi lalu aktifkan kamera kembali.');
          }
        }, { once: true }));
      }
      if (!video.current) throw new Error('Preview kamera tidak tersedia');
      setCameraActive(true);
      setCameraStatus('Kamera aktif · menghubungkan ke admin…');
      await playCamera();
      if (active.signal.aborted) return;
      id = (await createDriverSession(active.signal)).session_id;
      if (active.signal.aborted) { void stopDriverSession(id); return; }
      sessionRef.current = id; setSession(id);
      const began = performance.now();
      try { if (navigator.geolocation) {
        setGpsStatus('Menunggu izin dan lokasi GPS…');
        watch.current = navigator.geolocation.watchPosition(position => {
          if (!active.signal.aborted) { gps.current = { position, received: performance.now() }; setGpsStatus(`GPS aktif · akurasi ${position.coords.accuracy.toFixed(0)} m`); }
        }, failure => { if (!active.signal.aborted) { gps.current = null; setGpsStatus(`GPS: ${failure.message}`); } }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
      } else setGpsStatus('Browser tidak menyediakan GPS');
      } catch { setGpsStatus('GPS tidak tersedia; kamera tetap aktif.'); }
      const telemetry = async () => {
        try {
          const config = settings.current;
          const now = performance.now();
          const location = gps.current && now - gps.current.received <= 10000 ? gps.current.position.coords : null;
          const reading = obd.current && now - obd.current.received <= 5000 ? obd.current : null;
          const gpsSpeed = location?.speed;
          const speed = reading?.speed != null ? reading.speed : gpsSpeed != null && Number.isFinite(gpsSpeed) && gpsSpeed >= 0 ? gpsSpeed * 3.6 : null;
          const next = await sendDriverTelemetry(id, { latitude: location?.latitude ?? null, longitude: location?.longitude ?? null, accuracy: location?.accuracy ?? null,
            speed_source: speed === null ? null : reading?.speed != null ? 'obd' : 'gps', rpm: reading?.rpm ?? null,
            behavior: speed === null || !config ? null : { speed, speed_limit: config.limit, harsh_braking: config.braking, harsh_acceleration: config.acceleration, sharp_turns: config.turns }, environment: config?.environment ?? null }, active.signal);
          if (!active.signal.aborted) setSnapshot(next);
        } catch (failure) { if (!active.signal.aborted) setError(errorMessage(failure)); }
        finally { schedule(() => void telemetry(), 1000); }
      };
      void telemetry();
        setCameraStatus('Kamera aktif · mengirim frame berkala');
        const canvas = document.createElement('canvas');
        let inferenceAvailable = true;
        const capture = async () => {
          try {
            const preview = video.current;
            if (!preview || preview.readyState < 2 || !preview.videoWidth || !preview.videoHeight) return;
            canvas.width = 640; canvas.height = Math.round(640 * preview.videoHeight / preview.videoWidth);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Browser tidak mendukung canvas');
            context.drawImage(preview, 0, 0, canvas.width, canvas.height);
            const timestamp = (performance.now() - began) / 1000;
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .65));
            if (!blob) throw new Error('Frame kamera gagal dibuat');
            await sendDriverCamera(id, blob, active.signal);
            if (inferenceAvailable) {
              try {
                const next = await sendDriverFrame(id, blob, timestamp, active.signal);
                if (!active.signal.aborted) setSnapshot(next);
              } catch (failure) {
                if (failure instanceof ApiError && [422, 503].includes(failure.status)) inferenceAvailable = false;
                throw failure;
              }
            }
          } catch (failure) {
            if (!active.signal.aborted) setCameraStatus(`Kamera aktif · analisis: ${errorMessage(failure)}`);
          } finally { schedule(() => void capture(), 300); }
        };
        void capture();
    } catch (failure) {
      if (!active.signal.aborted) {
        if (stream.current?.active) {
          active.abort(); setSession('');
          setCameraStatus('Kamera aktif · belum terhubung ke admin');
          setError(`Koneksi admin gagal: ${errorMessage(failure)}. Tekan Hubungkan ke admin untuk mencoba lagi.`);
        } else {
          cleanup(); setSession(''); setCameraActive(false);
          setCameraStatus(cameraError(failure)); setError(cameraError(failure));
        }
      }
    } finally { startLock.current = false; setStarting(false); }
  }

  async function connectObd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new ObdBle(); adapter.current?.disconnect(); adapter.current = next;
    setBleBusy(true);
    try {
      const name = await next.connect(String(data.get('service')).trim(), String(data.get('write')).trim(), String(data.get('notify')).trim());
      if (adapter.current !== next) { next.disconnect(); return; }
      setBleStatus(`Terhubung: ${name}`);
      next.poll(reading => { obd.current = reading; setBleStatus(`OBD aktif · ${reading.speed ?? '—'} km/jam · ${reading.rpm ?? '—'} RPM`); }, failure => { obd.current = null; setBleStatus(errorMessage(failure)); });
    } catch (failure) { setBleStatus(errorMessage(failure)); }
    finally { setBleBusy(false); }
  }

  function monitor(id = monitorId.trim()) {
    if (sessionRef.current || startLock.current || !id) return;
    setMonitorId(id);
    monitorController.current?.abort();
    const active = new AbortController(); monitorController.current = active;
    setMonitoring(true); setError(''); setSnapshot(null);
    const read = async () => {
      try { const next = await getDriverSession(id, active.signal); if (!active.signal.aborted) setSnapshot(next); }
      catch (failure) { if (!active.signal.aborted) { setError(errorMessage(failure)); active.abort(); setMonitoring(false); } }
      if (!active.signal.aborted) { const timer = setTimeout(() => { timers.current = timers.current.filter(value => value !== timer); void read(); }, 1000); timers.current.push(timer); }
    };
    void read();
  }

  const configuration = (
<form className="mt-4" onSubmit={event => void start(event)}><fieldset disabled={!!session || starting || monitoring}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[['limit', 'Batas kecepatan (km/jam)', .01, undefined], ['braking', 'Pengereman mendadak (jumlah)', 0, undefined], ['acceleration', 'Akselerasi mendadak (jumlah)', 0, undefined], ['turns', 'Belokan tajam (jumlah)', 0, undefined], ['rain', 'Hujan (mm/jam)', 0, undefined], ['visibility', 'Jarak pandang (m)', 0, undefined], ['slope', 'Kemiringan (derajat)', -90, 90], ['disaster', 'Risiko bencana (0–100)', 0, 100]].map(([name, label, min, max]) => <label key={String(name)} className="text-xs">{label}<input className={inputClass} name={String(name)} type="number" min={min as number} max={max as number | undefined} step={['braking', 'acceleration', 'turns'].includes(String(name)) ? '1' : 'any'} defaultValue={['braking', 'acceleration', 'turns'].includes(String(name)) ? 0 : undefined} required /></label>)}
          <label className="text-xs">Kondisi jalan<select name="road" className={inputClass} required defaultValue=""><option value="" disabled>Pilih kondisi</option>{[['dry', 'Kering'], ['wet', 'Basah'], ['damaged', 'Rusak'], ['flooded', 'Tergenang'], ['icy', 'Berlapis es']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div><Button className="mt-4" type="submit">{starting ? 'Memulai…' : 'Mulai kamera & GPS'}</Button>
      </fieldset></form>
  );
  const obdControls = (
<details className="mt-4"><summary className="text-sm font-semibold">Hubungkan OBD-II BLE</summary><p className="mt-2 text-xs text-muted-foreground">Untuk adaptor ELM327 BLE dengan GATT UART. Isi UUID dari dokumentasi adaptor; Bluetooth Classic/SPP tidak didukung.</p>
        <form onSubmit={event => void connectObd(event)} className="mt-3"><fieldset disabled={bleBusy}>{[['service', 'Service UUID'], ['write', 'Write characteristic UUID'], ['notify', 'Notify characteristic UUID']].map(([name, label]) => <label key={name} className="mt-2 block text-xs">{label}<input className={inputClass} name={name} required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></label>)}<Button type="submit" className="mt-3">{bleBusy ? 'Menghubungkan…' : 'Pilih adaptor BLE'}</Button></fieldset></form>
        <Button className="mt-2" variant="outline" onClick={() => { adapter.current?.disconnect(); adapter.current = null; obd.current = null; setBleStatus('OBD terputus'); }}>Putuskan OBD</Button>
      </details>
  );
  const drivingControls = <form className="driver-driving-settings" onSubmit={event => {
    event.preventDefault();
    const limit = Number(new FormData(event.currentTarget).get('speed-limit'));
    if (!Number.isFinite(limit) || limit <= 0) return;
    settings.current = { ...settings.current, limit };
    setSettingsStatus(`Batas kecepatan tersimpan: ${limit} km/jam`);
  }}><label>Batas kecepatan (km/jam)<input className={inputClass} name="speed-limit" type="number" min="1" max="200" defaultValue={settings.current.limit} required /></label><Button type="submit" variant="outline">Simpan konfigurasi</Button><p role="status">{settingsStatus}</p></form>;
  const monitorControls = (
!session && !starting && <div className="mt-5"><label className="text-xs">Pantau sesi dari perangkat lain<input className={inputClass} value={monitorId} onChange={event => setMonitorId(event.target.value)} disabled={monitoring} placeholder="ID sesi pengemudi" /></label><Button className="mt-2" variant="outline" disabled={!monitorId.trim() || monitoring} onClick={() => monitor()}>Pantau sesi</Button></div>
  );
  return children({
    session, sessionKey: session || (monitoring ? monitorId.trim() : ''),
    starting, monitoring, snapshot, error,
    cameraActive, playbackBlocked, playCamera: () => void playCamera(),
    cameraStatus, gpsStatus, bleStatus, stop, startCamera: () => void begin(), monitorSession: monitor,
    camera: <video ref={attachVideo} autoPlay muted playsInline onPlaying={() => setPlaybackBlocked(false)} className="driver-video" aria-label="Preview kamera pengemudi" />,
    configuration, obdControls, drivingControls, monitorControls,
  });
}
