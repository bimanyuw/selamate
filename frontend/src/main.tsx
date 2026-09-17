import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAlerts, type AlertsResponse } from '@/lib/api';
import DriverRisk from '@/components/driver-risk';
import './styles.css';

const RiskMap = lazy(() => import('@/components/risk-map'));
const RiskChart = lazy(() => import('@/components/risk-chart'));

function App() {
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
        setData(next);
        setError('');
        setUpdated(new Date().toLocaleTimeString('id-ID'));
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Gagal memuat data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          timer = setTimeout(load, 30_000);
        }
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

  return <div className="mx-auto max-w-6xl px-5 sm:px-8">
    <header className="flex items-center justify-between gap-4 py-7">
      <a href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="size-8" />selamate</a>
      <span className="rounded-full border border-border bg-accent px-3 py-2 text-xs">Lingkungan pengembangan</span>
    </header>
    <main className="pb-12">
      <section className="flex items-center justify-between overflow-hidden rounded-3xl bg-primary px-7 py-10 text-primary-foreground sm:px-12">
        <div><p className="text-xs font-semibold tracking-[.2em] text-background">PANTAU. PAHAMI. ANTISIPASI.</p>
          <h1 className="my-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">Lebih siap,<br />lebih terlindungi.</h1>
          <p className="max-w-md text-sm leading-7 text-background/90">Informasi risiko bencana yang mudah dipahami dalam satu dashboard.</p></div>
        <ShieldCheck className="hidden size-44 text-secondary sm:block" strokeWidth={0.8} aria-hidden="true" />
      </section>
      <p className="my-5 rounded-xl border border-warning/30 bg-warning-background px-4 py-3 text-xs leading-6 text-warning-foreground">
        {data ? (simulated ? 'Mode demonstrasi: halaman ini memuat data simulasi, bukan peringatan bencana aktual.' : 'Sumber: database. Informasi ditampilkan sesuai data yang tersimpan.') : 'Menunggu sumber data. Status peringatan belum tersedia.'}
      </p>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Ringkasan">
        {[['Wilayah', data ? regions.length : '—', 'Wilayah dalam data'], ['Peringatan', data ? alerts.length : '—', 'Seluruh tingkat risiko'], ['Prediksi AI', 'Belum aktif', 'Menunggu integrasi model']].map(([label, value, caption]) =>
          <article key={label} className="rounded-2xl border border-border bg-surface p-6"><p className="text-sm text-muted-foreground">{label}</p><strong className="my-3 block text-3xl font-medium">{value}</strong><span className="text-xs text-muted-foreground">{caption}</span></article>)}
      </section>
      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs tracking-widest text-muted-foreground">INFORMASI WILAYAH</p><h2 className="mt-2 text-2xl font-semibold">Peringatan & potensi risiko</h2></div>
          <div className="flex flex-wrap items-end gap-3"><label className="text-xs">Wilayah
            <select className="mt-1 block h-10 rounded-lg border border-border bg-surface px-3 text-sm" value={selected} onChange={e => setRegion(e.target.value)}><option>Semua wilayah</option>{regions.map(r => <option key={r}>{r}</option>)}</select>
          </label><Button variant="outline" disabled={loading} onClick={reload}><RefreshCw className={loading ? 'animate-spin' : ''} />Perbarui</Button></div>
        </div>
        <p role="status" className="my-4 text-xs text-muted-foreground">{loading ? 'Memuat data…' : error ? error + (data ? ' Menampilkan data terakhir.' : '') : 'Diperbarui ' + updated + ' · Pembaruan otomatis setiap 30 detik'}</p>
        {data && filtered.length > 0 && <div className="mb-5 grid gap-4 lg:grid-cols-5">
          <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 lg:col-span-3"><h3 className="mb-3 font-semibold">Sebaran wilayah</h3><Suspense fallback={<p className="h-80">Memuat peta…</p>}><RiskMap alerts={filtered} /></Suspense><p className="mt-3 text-xs text-muted-foreground">Peta dasar memerlukan internet. Titik demo menunjukkan lokasi perkiraan kota.</p></section>
          <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 lg:col-span-2"><h3 className="mb-3 font-semibold">Jumlah peringatan per tingkat</h3><Suspense fallback={<p>Memuat grafik…</p>}><RiskChart alerts={filtered} /></Suspense></section>
        </div>}
        <div className="grid gap-3">{filtered.map(alert => <article key={alert.id} className="flex gap-4 rounded-xl border border-border bg-surface p-5">
          <TriangleAlert className="mt-1 size-6 shrink-0 text-warning" aria-hidden="true" /><div className="min-w-0 flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-warning-foreground">{alert.level}</span><h3 className="mt-1 font-semibold">{alert.hazard}</h3><p className="mt-1 text-sm text-muted-foreground">{alert.region}</p>
            <details className="mt-3 text-sm"><summary>Keterangan</summary><p className="mt-2 leading-6 text-muted-foreground">{alert.description}</p></details>
          </div>{alert.is_simulation && <span className="text-[10px] text-muted-foreground">SIMULASI</span>}
        </article>)}</div>
        {data && !filtered.length && <p className="rounded-xl border border-border p-6 text-sm">Belum ada peringatan pada data yang tersedia.</p>}
      </section>
      <DriverRisk />
    </main>
    <footer className="flex flex-wrap justify-between gap-3 border-t border-border py-6 text-xs text-muted-foreground"><span>© {new Date().getFullYear()} Selamate</span><span>Fondasi informasi untuk kesiapsiagaan bersama.</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
