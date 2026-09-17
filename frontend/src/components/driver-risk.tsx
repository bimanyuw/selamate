import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  analyzeFatigue, fuseRisk, getHealth, scoreBehavior, scoreEnvironment,
  type BehaviorResponse, type EnvironmentInput, type EnvironmentResponse,
  type FatigueResponse, type RiskResponse,
} from '@/lib/api';

const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';
const levelNames = { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi' };
const factorNames = { fatigue: 'Kelelahan', behavior: 'Perilaku', environment: 'Lingkungan', none: 'Tidak ada' };
const fatigueNames = { ALERT: 'Terjaga', DROWSY: 'Mengantuk', FATIGUED: 'Lelah', INSUFFICIENT_DATA: 'Deteksi belum memadai' };

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Analisis gagal.';
}

export default function DriverRisk() {
  const [health, setHealth] = useState('Memeriksa koneksi backend…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [behavior, setBehavior] = useState<BehaviorResponse | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentResponse | null>(null);
  const [fatigue, setFatigue] = useState<FatigueResponse | null>(null);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const processing = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal).then(result => {
      if (!controller.signal.aborted) setHealth(result.status === 'ok' ? 'Backend terhubung' : 'Backend belum siap');
    }).catch(err => {
      if (!controller.signal.aborted) setHealth(message(err));
    });
    return () => { controller.abort(); processing.current?.abort(); };
  }, []);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const number = (name: string) => Number(values.get(name));
    const video = values.get('video');
    processing.current?.abort();
    const controller = new AbortController();
    processing.current = controller;
    setBusy(true);
    setError('');
    setBehavior(null);
    setEnvironment(null);
    setFatigue(null);
    setRisk(null);
    try {
      const results = await Promise.allSettled([
        scoreBehavior({ speed: number('speed'), speed_limit: number('speed_limit'), harsh_braking: number('harsh_braking'), harsh_acceleration: number('harsh_acceleration'), sharp_turns: number('sharp_turns') }, controller.signal),
        scoreEnvironment({ rainfall: number('rainfall'), visibility: number('visibility'), road_condition: values.get('road_condition') as EnvironmentInput['road_condition'], slope: number('slope'), disaster_risk: number('disaster_risk') }, controller.signal),
        video instanceof File && video.name ? analyzeFatigue(video, controller.signal) : Promise.resolve(null),
      ]);
      if (controller.signal.aborted) return;
      const [behaviorResult, environmentResult, fatigueResult] = results;
      const nextBehavior = behaviorResult.status === 'fulfilled' ? behaviorResult.value : null;
      const nextEnvironment = environmentResult.status === 'fulfilled' ? environmentResult.value : null;
      const nextFatigue = fatigueResult.status === 'fulfilled' ? fatigueResult.value : null;
      setBehavior(nextBehavior);
      setEnvironment(nextEnvironment);
      setFatigue(nextFatigue);
      const names = ['Perilaku', 'Lingkungan', 'Kelelahan'];
      setError(results.flatMap((result, index) => result.status === 'rejected' ? [`${names[index]}: ${message(result.reason)}`] : []).join(' '));
      if (nextBehavior && nextEnvironment && nextFatigue?.fatigue_score != null && nextFatigue.fatigue_status !== 'INSUFFICIENT_DATA') {
        const combined = await fuseRisk({ fatigue_score: nextFatigue.fatigue_score, behavior_score: nextBehavior.behavior_score, environment_score: nextEnvironment.environment_score }, controller.signal);
        if (!controller.signal.aborted) setRisk(combined);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(message(err));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <section className="mt-9 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-label="Analisis risiko pengemudi">
    <details>
      <summary className="cursor-pointer text-lg font-semibold">Analisis risiko pengemudi</summary>
      <p className="mt-3 text-xs text-muted-foreground" role="status">{health}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Masukkan pengamatan perjalanan. Gunakan jumlah kejadian dari periode pengamatan yang sama. Tambahkan video pengemudi untuk analisis kelelahan dan risiko gabungan.</p>
      <form className="mt-5" onSubmit={event => void analyze(event)}>
        <fieldset disabled={busy}>
          <legend className="font-semibold">Perilaku mengemudi</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">Kecepatan (km/jam)<input className={inputClass} name="speed" type="number" min="0" step="any" required /></label>
            <label className="text-xs">Batas kecepatan (km/jam)<input className={inputClass} name="speed_limit" type="number" min="0.01" step="any" required /></label>
            <label className="text-xs">Pengereman mendadak<input className={inputClass} name="harsh_braking" type="number" min="0" step="1" defaultValue="0" required /></label>
            <label className="text-xs">Akselerasi mendadak<input className={inputClass} name="harsh_acceleration" type="number" min="0" step="1" defaultValue="0" required /></label>
            <label className="text-xs">Belokan tajam<input className={inputClass} name="sharp_turns" type="number" min="0" step="1" defaultValue="0" required /></label>
          </div>
          <h3 className="mt-5 font-semibold">Lingkungan</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs">Curah hujan (mm/jam)<input className={inputClass} name="rainfall" type="number" min="0" step="any" required /></label>
            <label className="text-xs">Jarak pandang (meter)<input className={inputClass} name="visibility" type="number" min="0" step="any" required /></label>
            <label className="text-xs">Kondisi jalan<select className={inputClass} name="road_condition" defaultValue="" required><option value="" disabled>Pilih kondisi</option><option value="dry">Kering</option><option value="wet">Basah</option><option value="damaged">Rusak</option><option value="flooded">Tergenang</option><option value="icy">Berlapis es</option></select></label>
            <label className="text-xs">Kemiringan (derajat)<input className={inputClass} name="slope" type="number" min="-90" max="90" step="any" required /></label>
            <label className="text-xs">Risiko bencana (0–100)<input className={inputClass} name="disaster_risk" type="number" min="0" max="100" step="any" required /></label>
          </div>
          <label className="mt-5 block text-xs">Video pengemudi (opsional)<input className="mt-2 block w-full text-sm" name="video" type="file" accept=".mp4,.avi,.mov,.webm,.mkv,.m4v" /></label>
          <p className="mt-2 text-xs text-muted-foreground">Batas bawaan: 100 MiB dan 5 menit. Analisis video dapat memerlukan waktu.</p>
          <Button className="mt-4" type="submit">{busy ? 'Menganalisis…' : 'Analisis risiko'}</Button>
        </fieldset>
      </form>
      {error && <p className="mt-4 rounded-xl border border-warning/30 bg-warning-background px-4 py-3 text-sm text-warning-foreground" role="alert">{error}</p>}
      {(behavior || environment || fatigue) && <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-live="polite">
        {behavior && <article className="rounded-xl border border-border p-4"><h3 className="text-sm">Perilaku</h3><strong className="mt-2 block text-2xl">{behavior.behavior_score}/100</strong><p className="mt-1 text-xs text-muted-foreground">{levelNames[behavior.risk_level]}</p></article>}
        {environment && <article className="rounded-xl border border-border p-4"><h3 className="text-sm">Lingkungan</h3><strong className="mt-2 block text-2xl">{environment.environment_score}/100</strong><p className="mt-1 text-xs text-muted-foreground">{levelNames[environment.risk_level]}</p></article>}
        {fatigue && <article className="rounded-xl border border-border p-4"><h3 className="text-sm">Kelelahan</h3><strong className="mt-2 block text-2xl">{fatigue.fatigue_score === null ? 'Belum tersedia' : `${fatigue.fatigue_score}/100`}</strong><p className="mt-1 text-xs text-muted-foreground">{fatigueNames[fatigue.fatigue_status]}</p><p className="mt-2 text-xs">PERCLOS: {fatigue.perclos === null ? '—' : `${(fatigue.perclos * 100).toFixed(1)}%`}</p><p className="mt-1 text-xs">Penutupan terlama: {fatigue.max_closed_duration.toFixed(2)} detik · Kejadian: {fatigue.closure_events}</p><p className="mt-1 text-xs">Cakupan deteksi: {(fatigue.detection_rate * 100).toFixed(1)}%</p></article>}
      </div>}
      {risk && <article className="mt-4 rounded-xl border border-border bg-accent p-4" aria-live="polite"><h3 className="font-semibold">Risiko gabungan: {risk.overall_risk_score}/100 · {levelNames[risk.risk_level]}</h3><p className="mt-2 text-sm">Faktor dominan: {factorNames[risk.dominant_factor]}</p><p className="mt-2 text-sm">{risk.warning}</p></article>}
      {!busy && (behavior || environment) && !risk && <p className="mt-3 text-xs text-muted-foreground">Risiko gabungan memerlukan hasil dari ketiga komponen dan deteksi kelelahan yang memadai.</p>}
    </details>
  </section>;
}
