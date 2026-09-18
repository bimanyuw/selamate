import { useEffect, useRef, useState } from 'react';
import { scoreJourney, type DriverTelemetry, type JourneyRisk } from './api';

export default function useJourneyRisk(key: string, telemetry: DriverTelemetry) {
  const latest = useRef(telemetry); latest.current = telemetry;
  const [result, setResult] = useState<JourneyRisk | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setResult(null); setError('');
    if (!key) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        const next = await scoreJourney({ ...latest.current, session_id: key }, controller.signal);
        if (!controller.signal.aborted) { setResult(next); setError(''); }
      } catch (failure) {
        if (!controller.signal.aborted) { setResult(null); setError(failure instanceof Error ? failure.message : 'Skor gagal dihitung.'); }
      } finally { if (!controller.signal.aborted) timer = setTimeout(update, 2000); }
    };
    void update();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [key]);
  return { result, error };
}
