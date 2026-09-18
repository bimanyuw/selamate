import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError, getCurrentUser, loginUser, logoutUser, registerUser, type AuthUser } from '@/lib/api';

type Props = { children: (user: AuthUser, logout: () => void, loggingOut: boolean, logoutError: string) => ReactNode };
const inputClass = 'mt-2 block h-12 w-full rounded-lg border border-border bg-surface px-4 text-sm';

export default function AuthShell({ children }: Props) {
  const [path, setPath] = useState(window.location.pathname);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const registering = path === '/register';

  function navigate(next: string, replace = false) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
    setPath(next); setError(''); setShowPassword(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    void getCurrentUser(controller.signal).then(next => {
      if (!controller.signal.aborted) { setUser(next); if (window.location.pathname !== '/') navigate('/', true); }
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) {
        if (window.location.pathname !== '/register') navigate('/login', true);
      } else setError(failure instanceof Error ? failure.message : 'Gagal memeriksa sesi.');
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    const pop = () => { setPath(window.location.pathname); setError(''); setShowPassword(false); };
    const expired = () => { setUser(null); setLoggingOut(false); navigate('/login', true); setError('Sesi berakhir. Silakan login kembali.'); };
    window.addEventListener('popstate', pop);
    window.addEventListener('selamate:unauthorized', expired);
    return () => { controller.abort(); window.removeEventListener('popstate', pop); window.removeEventListener('selamate:unauthorized', expired); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get('password'));
    if (registering && password !== values.get('confirm')) { setError('Konfirmasi password tidak sama.'); return; }
    setBusy(true); setError('');
    try {
      const next = registering ? await registerUser(String(values.get('name')), String(values.get('email')), password) : await loginUser(String(values.get('email')), password);
      form.reset(); setUser(next); navigate('/', true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Autentikasi gagal.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setLoggingOut(true); setLogoutError('');
    try { await logoutUser(); setUser(null); navigate('/login', true); }
    catch (failure) { setLogoutError(failure instanceof Error ? failure.message : 'Logout gagal.'); }
    finally { setLoggingOut(false); }
  }

  if (checking) return <main className="flex min-h-screen items-center justify-center text-sm" role="status">Memeriksa sesi…</main>;
  if (user) return children(user, () => void logout(), loggingOut, logoutError);

  return <div className="auth-page">
    <main className="auth-card">
      <section className="auth-story"><div className="auth-story-content"><a href="/login" onClick={event => { event.preventDefault(); navigate('/login'); }} className="auth-brand"><img src="/brand/selamate-logo.png" alt="" /><span><img src="/brand/selamate-wordmark.png" alt="SelaMate" /><small>sampai tujuan</small></span></a><h1>Selamat<br />sampai tujuan.</h1><p>SelaMate membantu admin memantau lokasi dan kamera pengemudi, mendeteksi kantuk, serta mengirim pesan dan alarm agar perjalanan lebih aman.</p></div></section>
      <section className="auth-form-panel"><div className="auth-form-heading"><p>{registering ? 'PENDAFTARAN AKUN' : 'SELAMAT DATANG'}</p><h2>{registering ? 'Buat akun' : 'Login'}</h2>{registering && <span>Daftar untuk mulai menggunakan SelaMate.</span>}</div>
        <form key={registering ? 'register' : 'login'} className="mt-7" onSubmit={event => void submit(event)}>
          <fieldset disabled={busy} className="space-y-4">
            {registering && <label className="block text-sm">Nama lengkap<input className={inputClass} name="name" autoComplete="name" maxLength={120} required /></label>}
            <label className="block text-sm">Email<input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
            <label className="block text-sm">Password<div className="relative"><input className={inputClass + ' pr-12'} name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required /><button type="button" className="absolute right-3 top-3 text-muted-foreground" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></div></label>
            {registering && <><p className="text-xs text-muted-foreground">Gunakan password minimal 8 karakter.</p><label className="block text-sm">Konfirmasi password<input className={inputClass} name="confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={128} required /></label></>}
            <Button className="h-12 w-full" type="submit">{busy ? 'Memproses…' : registering ? 'Daftar' : 'Login'}</Button>
          </fieldset>
        </form>
        {error && <p className="mt-4 rounded-lg border border-warning/30 bg-warning-background p-3 text-sm text-warning-foreground" role="alert">{error}</p>}
        <p className="auth-switch">{registering ? 'Sudah punya akun? ' : 'Belum punya akun? '}<a href={registering ? '/login' : '/register'} onClick={event => { event.preventDefault(); if (!busy) navigate(registering ? '/login' : '/register'); }}>{registering ? 'Login' : 'Daftar sekarang'}</a></p>
      </section>
    </main><footer className="auth-footer"><span>© {new Date().getFullYear()} SelaMate</span><a href="https://commons.wikimedia.org/wiki/File:Blank_map_of_the_world.svg" target="_blank" rel="noreferrer">Peta: Wikimedia Commons · CC0</a></footer>
  </div>;
}
