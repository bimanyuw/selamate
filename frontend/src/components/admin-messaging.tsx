import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, PhoneCall } from 'lucide-react';
import { notifyDriver, type DriverSnapshot } from '@/lib/api';
import { Button } from './ui/button';

export default function AdminMessaging({ sessionId, snapshot }: { sessionId: string; snapshot: DriverSnapshot | null }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const current = useRef(sessionId); current.current = sessionId;
  useEffect(() => { setStatus(''); setError(''); setMessage(''); }, [sessionId]);
  async function send(kind: 'text' | 'ringtone') {
    const target = sessionId;
    setBusy(true); setStatus(''); setError('');
    try {
      await notifyDriver(target, message.trim() || 'Admin meminta Anda berhenti di tempat aman dan beristirahat.', kind);
      if (current.current === target) { setMessage(''); setStatus(kind === 'ringtone' ? 'Alarm dikirim ke HP driver.' : 'Notifikasi terkirim ke driver.'); }
    } catch (failure) {
      if (current.current === target) setError(failure instanceof Error ? failure.message : 'Notifikasi gagal dikirim.');
    } finally { setBusy(false); }
  }
  const latestAlarm = [...(snapshot?.notifications ?? [])].reverse().find(note => note.kind === 'ringtone');
  const alarmStatus = latestAlarm?.state === 'acknowledged' ? 'Driver sudah menghentikan alarm.' : latestAlarm && (latestAlarm.expires_at ?? 0) <= Date.now() / 1000 ? 'Alarm selesai (maksimal 30 detik).' : latestAlarm?.state === 'ringing' ? 'HP driver sedang membunyikan ringtone.' : latestAlarm ? 'Menunggu HP driver menerima/membunyikan alarm.' : '';
  function submit(event: FormEvent) { event.preventDefault(); void send('text'); }
  return <form className="admin-message-form" onSubmit={submit}><label htmlFor="admin-driver-message">Notifikasi untuk driver</label><p>{sessionId ? 'Pesan dikirim ke sesi pengemudi yang sedang dipantau.' : 'Pantau ID sesi driver terlebih dahulu.'}</p><div><input id="admin-driver-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={500} disabled={!sessionId || busy} placeholder="Contoh: berhenti di tempat aman dan istirahat." required /><Button type="submit" disabled={!sessionId || !message.trim() || busy}><Bell />{busy ? 'Mengirim…' : 'Kirim notifikasi'}</Button></div><div className="admin-alarm-actions"><Button className="admin-ring-button" type="button" disabled={!sessionId || busy} onClick={() => void send('ringtone')}><PhoneCall />Bunyikan ringtone</Button><span>{sessionId ? snapshot?.audio_ready ? 'Suara alarm di HP aktif' : 'Driver perlu mengaktifkan suara di HP' : 'Belum ada sesi driver'}</span></div>{alarmStatus && <p className="admin-alarm-status" role="status">{alarmStatus}</p>}{status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}</form>;
}
