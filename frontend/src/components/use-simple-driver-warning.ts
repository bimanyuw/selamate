import { useEffect, useRef, useState } from 'react';
import type { DriverNotification, FatigueResponse } from '@/lib/api';

export function useSimpleDriverWarning(session: string, enabled: boolean, score: number | null, duration: number, restName: string, fatigue: FatigueResponse['fatigue_status'] | undefined) {
  const [note, setNote] = useState<DriverNotification | null>(null);
  const issued = useRef({ session: '', notes: new Map<string, DriverNotification>() });
  const cause = fatigue === 'FATIGUED' ? 'fatigue-heavy' : fatigue === 'DROWSY' ? 'fatigue' : score != null && score >= 70 ? 'journey' : duration >= 7200 ? 'rest' : '';
  useEffect(() => {
    if (issued.current.session !== session) issued.current = { session, notes: new Map() };
    if (!session || !enabled || !cause) { setNote(null); return; }
    let next = issued.current.notes.get(cause);
    if (!next) {
      const created = Date.now() / 1000;
      next = {
        id: `local-${session}-${cause}`, local: true, kind: 'ringtone', state: 'pending', sender: 'SelaMate otomatis',
        created_at: created, expires_at: created + 30,
        message: cause.startsWith('fatigue') ? 'Tanda kantuk atau menguap terdeteksi. Berhenti dan beristirahat di tempat aman.' : cause === 'journey' ? 'Risiko perjalanan meningkat. Kurangi kecepatan dan cari tempat aman untuk beristirahat.' : `Sudah lebih dari dua jam berkendara. Pertimbangkan istirahat di ${restName} (lokasi demo).`,
      };
      issued.current.notes.set(cause, next);
    }
    setNote(next);
  }, [session, enabled, cause, restName]);
  return note;
}
