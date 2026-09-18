import { useCallback, useEffect, useRef, useState } from 'react';
import { setDriverAudio, updateDriverAlarm, type DriverNotification } from '@/lib/api';
import { DriverRingtone } from '@/lib/ringtone';

export function useDriverAlarm(sessionId: string, notifications: DriverNotification[]) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [alarm, setAlarm] = useState<DriverNotification | null>(null);
  const ringtone = useRef<DriverRingtone | null>(null);
  const handled = useRef(new Set<string>());
  const heard = useRef(new Set<string>());
  const active = useRef('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    ringtone.current?.stop();
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null; active.current = ''; setAlarm(null);
  }, []);

  useEffect(() => {
    handled.current.clear(); heard.current.clear(); stop();
    return () => { ringtone.current?.stop(); if (timeout.current) clearTimeout(timeout.current); active.current = ''; };
  }, [sessionId, stop]);
  useEffect(() => () => { ringtone.current?.close(); ringtone.current = null; }, []);

  const enable = useCallback(async () => {
    setError('');
    try {
      if (!ringtone.current) ringtone.current = new DriverRingtone(setReady);
      await ringtone.current.enable();
    } catch (failure) { setReady(false); setError(failure instanceof Error ? failure.message : 'Suara belum dapat diaktifkan.'); }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    setDriverAudio(sessionId, ready, controller.signal).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Status suara gagal dikirim.'); });
    return () => controller.abort();
  }, [sessionId, ready]);

  useEffect(() => {
    if (!sessionId || !ready || !ringtone.current) return;
    let delay = 0;
    for (const note of notifications) {
      if (note.local || note.kind === 'ringtone' || heard.current.has(note.id)) continue;
      if (Date.now() / 1000 - note.created_at <= 60) {
        ringtone.current.chime(delay); delay += .25;
      }
      heard.current.add(note.id);
    }
  }, [notifications, sessionId, ready]);

  useEffect(() => {
    if (!sessionId) return;
    const now = Date.now() / 1000;
    const latest = [...notifications].reverse().find(note => note.kind === 'ringtone' && note.state !== 'acknowledged' && (note.expires_at ?? 0) > now);
    if (!latest && alarm) { stop(); return; }
    if (active.current) {
      const current = notifications.find(note => note.id === active.current);
      if (!current || current.state === 'acknowledged') stop();
    }
    if (!latest || handled.current.has(latest.id)) return;
    if (alarm?.id !== latest.id) setAlarm(latest);
    if (!ready || !ringtone.current?.ring()) return;
    for (const note of notifications) if (note.kind === 'ringtone' && note.created_at <= latest.created_at) handled.current.add(note.id);
    if (timeout.current) clearTimeout(timeout.current);
    active.current = latest.id;
    timeout.current = setTimeout(stop, Math.max(0, (latest.expires_at! - now) * 1000));
    if (!latest.local) updateDriverAlarm(sessionId, latest.id, 'ringing').catch(failure => setError(failure instanceof Error ? failure.message : 'Status alarm gagal dikirim.'));
  }, [notifications, sessionId, ready, alarm?.id, stop]);

  const dismiss = useCallback(() => {
    if (!alarm) return;
    const id = alarm.id;
    handled.current.add(id); stop();
    if (!alarm.local) updateDriverAlarm(sessionId, id, 'acknowledged').catch(failure => setError(failure instanceof Error ? failure.message : 'Konfirmasi alarm gagal dikirim.'));
  }, [alarm, sessionId, stop]);

  return { ready, error, alarm, enable, dismiss };
}
