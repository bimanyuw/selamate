import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
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

  return <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
    <header className="py-7"><a href="/login" onClick={event => { event.preventDefault(); navigate('/login'); }} className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="size-8 text-primary" />selamate</a></header>
    <main className="my-auto grid overflow-hidden rounded-3xl border border-border bg-surface md:grid-cols-2">
      <section className="bg-primary p-8 text-primary-foreground sm:p-12"><ShieldCheck className="size-16 text-secondary" strokeWidth={1} /><p className="mt-8 text-xs font-semibold tracking-[.2em]">PANTAU. PAHAMI. ANTISIPASI.</p><h1 className="mt-5 text-4xl font-semibold leading-tight">Perjalanan lebih siap,<br />lebih terlindungi.</h1><p className="mt-5 text-sm leading-7 text-primary-foreground/90">Pantau kondisi perjalanan, kelelahan, dan risiko lingkungan dalam satu dashboard.</p></section>
      <section className="p-7 sm:p-10"><p className="text-xs font-semibold tracking-widest text-primary">SELAMAT DATANG</p><h2 className="mt-3 text-3xl font-semibold">{registering ? 'Buat akun' : 'Login'}</h2><p className="mt-3 text-sm text-muted-foreground">{registering ? 'Daftar untuk mulai menggunakan selamate.' : 'Masuk untuk melanjutkan ke dashboard.'}</p>
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
        <p className="mt-6 text-sm text-muted-foreground">{registering ? 'Sudah punya akun? ' : 'Belum punya akun? '}<a className="font-semibold text-primary underline underline-offset-4" href={registering ? '/login' : '/register'} onClick={event => { event.preventDefault(); if (!busy) navigate(registering ? '/login' : '/register'); }}>{registering ? 'Login' : 'Daftar sekarang'}</a></p>
      </section>
    </main><footer className="py-7 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Selamate</footer>
  </div>;
}
