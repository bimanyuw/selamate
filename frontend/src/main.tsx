import React, { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Alert = { id: string; region: string; hazard: string; level: string; description: string };
type User = { id: string; name: string; email: string; role: 'Admin' | 'User' };
type AdminSummary = { activeUsers: number; systemStatus: string; dataSource: string };

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('user@selamate.id');
  const [password, setPassword] = useState('User123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onLogin(data.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Login gagal'); }
    finally { setLoading(false); }
  }
  return <main className="login-page"><section className="login-card">
    <a className="brand" href="/">◈ selamate<span>EARLY WARNING SYSTEM</span></a>
    <p className="eyebrow">AKSES DASHBOARD</p><h1>Selamat datang.</h1><p>Masuk untuk melihat informasi kesiapsiagaan sesuai akses Anda.</p>
    <form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button disabled={loading}>{loading ? 'Memeriksa…' : 'Masuk'}</button></form>
    <div className="demo-credentials"><strong>Akun demo</strong><span>User: user@selamate.id / User123!</span><span>Admin: admin@selamate.id / Admin123!</span></div>
  </section></main>;
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [region, setRegion] = useState('Semua wilayah');
  const [status, setStatus] = useState('Memuat data…');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/alerts', { signal: controller.signal }).then(async response => { if (response.status === 401) return onLogout(); if (!response.ok) throw new Error(); const data = await response.json(); setAlerts(data.alerts); setStatus('Data simulasi'); }).catch(error => { if (error.name !== 'AbortError') setStatus('Data tidak dapat dimuat.'); });
    if (user.role === 'Admin') fetch('/api/admin/summary', { signal: controller.signal }).then(response => response.json()).then(setSummary).catch(() => undefined);
    return () => controller.abort();
  }, [user.role, onLogout]);
  const filtered = alerts.filter(alert => region === 'Semua wilayah' || alert.region === region);
  return <div className="app"><header><a className="brand" href="/">◈ selamate<span>EARLY WARNING SYSTEM</span></a><div className="account"><div><strong>{user.name}</strong><span className={`role role-${user.role.toLowerCase()}`}>{user.role}</span></div><button className="logout" onClick={onLogout}>Keluar</button></div></header><main>
    <section className="hero"><div><p className="eyebrow">PANTAU. PAHAMI. ANTISIPASI.</p><h1>Lebih siap,<br />lebih terlindungi.</h1><p>Informasi risiko bencana yang mudah dipahami<br /> dalam satu dashboard.</p></div><div className="hero-icon" aria-hidden="true">◎</div></section>
    <div className="notice"><strong>Mode demonstrasi</strong> · Informasi berikut adalah contoh, bukan peringatan bencana aktual.</div>
    {user.role === 'Admin' && <section className="admin-panel"><div><p className="eyebrow">KHUSUS ADMIN</p><h2>Ringkasan sistem</h2></div><p><strong>{summary?.activeUsers ?? '—'}</strong> akun aktif</p><p><strong>{summary?.systemStatus ?? 'Memuat…'}</strong> status sistem</p><p><strong>{summary?.dataSource ?? '—'}</strong> sumber data</p></section>}
    <section className="stats"><article><p>Wilayah dalam demo</p><strong>{new Set(alerts.map(a => a.region)).size}</strong><span>Wilayah contoh</span></article><article><p>Peringatan simulasi</p><strong>{alerts.length}</strong><span>Seluruh tingkat risiko</span></article><article><p>Layanan prediksi AI</p><strong className="small">Belum aktif</strong><span>Menunggu integrasi model</span></article></section>
    <section className="alerts"><div className="section-heading"><div><p className="eyebrow">INFORMASI WILAYAH</p><h2>Peringatan & potensi risiko</h2></div><label>Wilayah<select value={region} onChange={e => setRegion(e.target.value)}><option>Semua wilayah</option>{[...new Set(alerts.map(a => a.region))].map(value => <option key={value}>{value}</option>)}</select></label></div><p className="status" role="status">{status}</p><div className="alert-list">{filtered.map(alert => <article className="alert" key={alert.id}><div className="alert-icon" aria-hidden="true">△</div><div><span className="level">{alert.level}</span><h3>{alert.hazard}</h3><p>{alert.region}</p><details><summary>Lihat keterangan</summary><p>{alert.description}</p></details></div><span className="demo-label">SIMULASI</span></article>)}</div></section>
  </main><footer><span>© {new Date().getFullYear()} Selamate</span><span>Fondasi informasi untuk kesiapsiagaan bersama.</span></footer></div>;
}

function App() {
  const [user, setUser] = useState<User | null>(null); const [checking, setChecking] = useState(true);
  useEffect(() => { fetch('/api/auth/me').then(async response => { if (response.ok) setUser((await response.json()).user); }).finally(() => setChecking(false)); }, []);
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); }
  if (checking) return <div className="splash">◈ selamate</div>;
  return user ? <Dashboard user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
