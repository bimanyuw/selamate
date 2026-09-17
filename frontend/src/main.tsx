import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Alert = { id: string; region: string; hazard: string; level: string; description: string };

function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [region, setRegion] = useState('Semua wilayah');
  const [status, setStatus] = useState('Memuat data…');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/alerts', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { setAlerts(data.alerts); setStatus('Data simulasi'); })
      .catch(error => { if (error.name !== 'AbortError') setStatus('Backend belum terhubung. Jalankan backend lalu muat ulang halaman.'); });
    return () => controller.abort();
  }, []);
  const filtered = alerts.filter(alert => region === 'Semua wilayah' || alert.region === region);
  return <div className="app">
    <header><a className="brand" href="/">◈ selamate<span>EARLY WARNING SYSTEM</span></a><span className="badge">Lingkungan pengembangan</span></header>
    <main>
      <section className="hero"><div><p className="eyebrow">PANTAU. PAHAMI. ANTISIPASI.</p><h1>Lebih siap,<br />lebih terlindungi.</h1><p>Informasi risiko bencana yang mudah dipahami<br /> dalam satu dashboard.</p></div><div className="hero-icon" aria-hidden="true">◎</div></section>
      <div className="notice"><strong>Mode demonstrasi</strong> · Informasi berikut adalah contoh, bukan peringatan bencana aktual.</div>
      <section className="stats" aria-label="Ringkasan simulasi">
        <article><p>Wilayah dalam demo</p><strong>{new Set(alerts.map(a => a.region)).size}</strong><span>Wilayah contoh</span></article>
        <article><p>Peringatan simulasi</p><strong>{alerts.length}</strong><span>Seluruh tingkat risiko</span></article>
        <article><p>Layanan prediksi AI</p><strong className="small">Belum aktif</strong><span>Menunggu integrasi model</span></article>
      </section>
      <section className="alerts"><div className="section-heading"><div><p className="eyebrow">INFORMASI WILAYAH</p><h2>Peringatan & potensi risiko</h2></div><label>Wilayah<select value={region} onChange={e => setRegion(e.target.value)}><option>Semua wilayah</option>{[...new Set(alerts.map(a => a.region))].map(value => <option key={value}>{value}</option>)}</select></label></div>
        <p className="status" role="status">{status}</p>
        <div className="alert-list">{filtered.map(alert => <article className="alert" key={alert.id}><div className="alert-icon" aria-hidden="true">△</div><div><span className="level">{alert.level}</span><h3>{alert.hazard}</h3><p>{alert.region}</p><details><summary>Lihat keterangan</summary><p>{alert.description}</p></details></div><span className="demo-label">SIMULASI</span></article>)}</div>
      </section>
    </main><footer><span>© {new Date().getFullYear()} Selamate</span><span>Fondasi informasi untuk kesiapsiagaan bersama.</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
