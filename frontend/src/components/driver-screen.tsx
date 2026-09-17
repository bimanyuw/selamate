import { useState } from 'react';
import { Bell, Camera, Copy, LogOut, PhoneCall, VideoOff, Volume2 } from 'lucide-react';
import SlideSound from './slide-sound';
import { Button } from './ui/button';
import type { AuthUser } from '@/lib/api';
import type { LiveDriverView } from './live-driver';
import { useDriverAlarm } from './use-driver-alarm';

type Props = { user: AuthUser; logout: () => void; loggingOut: boolean; logoutError: string; live: LiveDriverView };

export default function DriverScreen({ user, logout, loggingOut, logoutError, live }: Props) {
  const [copyStatus, setCopyStatus] = useState('');
  const notifications = [...(live.snapshot?.notifications ?? [])].reverse();
  const sound = useDriverAlarm(live.session, live.snapshot?.notifications ?? []);
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
        <div className="driver-camera-actions">
          {live.playbackBlocked && <Button onClick={live.playCamera}>Tampilkan kamera</Button>}
          {!live.session && <Button className="driver-camera-start" onClick={() => { void sound.enable(); live.startCamera(); }} disabled={live.starting}><Camera />{live.starting ? 'Memulai…' : live.cameraActive ? 'Hubungkan ke admin' : 'Aktifkan kamera'}</Button>}
          {(live.cameraActive || live.session || live.starting) && <Button className="driver-camera-stop" onClick={live.stop}><VideoOff />Hentikan kamera</Button>}
        </div>
        {live.session && <details className="driver-share"><summary>Bagikan sesi ke admin</summary><code>{live.session}</code><Button variant="outline" onClick={() => void copySession()}><Copy />Salin ID sesi</Button><p role="status">{copyStatus}</p></details>}
      </section>
      <section className="driver-notifications" aria-labelledby="driver-notification-heading"><div className="driver-section-heading"><h2 id="driver-notification-heading"><Bell size={19} />Notifikasi admin</h2>{notifications.length > 0 && <span className="driver-notification-count">{notifications.length}</span>}</div>
        <div className="driver-sound-controls" data-audio-ready={sound.ready}><p><Volume2 size={16} />{sound.ready ? 'Suara alarm aktif' : 'Suara alarm belum aktif'}</p><SlideSound ready={sound.ready} onEnable={() => void sound.enable()} /><small>Naikkan volume media HP.{'vibrate' in navigator ? ' Suara + getar.' : ' Getar tidak didukung browser ini.'}</small>{sound.error && <p role="alert">{sound.error}</p>}</div>
        {sound.alarm && <div className="driver-incoming-alarm" role="alert" data-alarm-id={sound.alarm.id}><PhoneCall /><strong>Alarm dari {sound.alarm.sender}</strong><p>{sound.alarm.message}</p>{!sound.ready && <p>Geser kontrol suara untuk membunyikan alarm.</p>}<Button onClick={sound.dismiss}>Hentikan alarm</Button></div>}
        <div aria-live="polite" aria-relevant="additions">{notifications.length ? notifications.map(note => <article className="driver-message" key={note.id}><div><strong>{note.sender}</strong><time dateTime={new Date(note.created_at * 1000).toISOString()}>{new Date(note.created_at * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{note.message}</p></article>) : <div className="driver-notifications-empty"><Bell size={26} /><p>Belum ada notifikasi</p><small>{live.session ? 'Pesan admin akan muncul di sini.' : 'Aktifkan kamera untuk menerima pesan admin.'}</small></div>}</div>
      </section>
    </main>
  </div>;
}
