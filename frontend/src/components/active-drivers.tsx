import { useEffect, useRef, useState } from 'react';
import { Radio, Video } from 'lucide-react';
import { getActiveDriverSessions, type ActiveDriverSession } from '@/lib/api';
import { Button } from './ui/button';

export default function ActiveDrivers({ selected, onSelect, disabled, onSessions, autoSelect = true }: { selected: string; onSelect: (id: string) => void; disabled: boolean; onSessions?: (sessions: ActiveDriverSession[]) => void; autoSelect?: boolean }) {
  const [sessions, setSessions] = useState<ActiveDriverSession[]>([]);
  const [error, setError] = useState('');
  const selection = useRef({ selected, onSelect, disabled, onSessions, autoSelect });
  selection.current = { selected, onSelect, disabled, onSessions, autoSelect };
  const autoSelected = useRef('');
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await getActiveDriverSessions(controller.signal);
        if (!controller.signal.aborted) {
          const accounts = new Map<string, ActiveDriverSession>();
          for (const session of response.sessions) {
            const key = session.driver_id ?? session.session_id;
            const previous = accounts.get(key);
            if (!previous || (session.camera_active && !previous.camera_active) || (session.camera_active === previous.camera_active && (session.telemetry_age_seconds ?? Infinity) < (previous.telemetry_age_seconds ?? Infinity))) accounts.set(key, session);
          }
          const available = [...accounts.values()];
          setSessions(available); setError('');
          selection.current.onSessions?.(available);
          if (!available.length) autoSelected.current = '';
          const driver = available.find(session => session.camera_active);
          if (driver && selection.current.autoSelect && !selection.current.selected && !selection.current.disabled && autoSelected.current !== driver.session_id) {
            autoSelected.current = driver.session_id;
            selection.current.onSelect(driver.session_id);
          }
        }
      }
      catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Gagal memuat driver'); }
      if (!controller.signal.aborted) timer = setTimeout(() => void load(), 2000);
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  return <section className="ews-panel active-drivers" aria-labelledby="active-drivers-title"><div className="panel-heading"><div><p className="eyebrow">PERANGKAT DRIVER</p><h2 id="active-drivers-title">Pilih driver untuk dipantau</h2></div><Radio /></div>{error && <p role="alert">{error}</p>}{!sessions.length && !error && <p className="control-note">Menunggu driver login dan mengaktifkan kamera. Daftar diperbarui otomatis.</p>}<div className="active-driver-list">{sessions.map(session => <article key={session.session_id} data-fatigue={session.fatigue_status ?? 'UNKNOWN'}><Video /><div><strong>{session.driver_name}</strong><small>{session.camera_active ? 'Kamera aktif' : 'Menunggu kamera'} · Sesi {session.session_id.slice(0, 8)}</small></div><Button onClick={() => onSelect(session.session_id)} disabled={disabled || selected === session.session_id}>{selected === session.session_id ? 'Sedang dipantau' : 'Pantau'}</Button></article>)}</div></section>;
}
