import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DriverSnapshot, JourneyRisk } from '@/lib/api';

type Point = { time: number; speed: number | null; risk: number | null };
const clock = (time: number) => new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function JourneyTrend({ sessionId, snapshot, simulatedSpeed = false, journeyRisk }: { sessionId: string; snapshot: DriverSnapshot | null; simulatedSpeed?: boolean; journeyRisk?: JourneyRisk | null }) {
  const [points, setPoints] = useState<Point[]>([]);
  const latestRisk = useRef(journeyRisk); latestRisk.current = journeyRisk;
  const latest = useRef(snapshot); latest.current = snapshot;
  const received = useRef(Date.now());
  useEffect(() => { received.current = Date.now(); }, [snapshot]);
  useEffect(() => {
    setPoints([]);
    if (!sessionId) return;
    const sample = () => {
      const data = latest.current;
      const elapsed = (Date.now() - received.current) / 1000;
      const telemetryFresh = data?.telemetry_age_seconds != null && data.telemetry_age_seconds + elapsed <= 5;
      const frameFresh = data?.frame_age_seconds != null && data.frame_age_seconds + elapsed <= 5;
      const point = { time: Date.now(), speed: telemetryFresh ? data?.telemetry?.behavior?.speed ?? null : null, risk: latestRisk.current !== undefined ? latestRisk.current?.overall_risk_score ?? null : telemetryFresh && frameFresh ? data?.risk?.overall_risk_score ?? null : null };
      setPoints(previous => [...previous.filter(item => item.time > point.time - 120_000), point].slice(-61));
    };
    sample(); const timer = setInterval(sample, 2000);
    return () => clearInterval(timer);
  }, [sessionId]);
  const valid = points.some(point => point.speed != null || point.risk != null);
  return <section className="ews-panel journey-trend" aria-labelledby="journey-trend-title"><div className="panel-heading"><div><p className="eyebrow">TREN PERJALANAN Â· 2 MENIT TERAKHIR</p><h2 id="journey-trend-title">Kecepatan & risiko</h2></div><Activity /></div><div className="trend-legend"><span><i className="trend-speed" />Kecepatan Â· km/jam</span><span><i className="trend-risk" />Risiko Â· /100</span></div>
    {valid ? <div className="journey-trend-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 8 }} accessibilityLayer><CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#e4eaf2" /><XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={clock} minTickGap={55} tick={{ fontSize: 12 }} /><YAxis yAxisId="speed" tick={{ fontSize: 12 }} width={42} /><YAxis yAxisId="risk" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} width={38} /><Tooltip labelFormatter={value => clock(Number(value))} /><Line yAxisId="speed" dataKey="speed" name="Kecepatan (km/jam)" type="monotone" stroke="#1746a2" strokeWidth={3} dot={false} isAnimationActive={false} connectNulls={false} /><Line yAxisId="risk" dataKey="risk" name="Risiko (/100)" type="monotone" stroke="#f56a0a" strokeWidth={3} dot={false} isAnimationActive={false} connectNulls={false} /></LineChart></ResponsiveContainer></div> : <div className="trend-empty"><Activity /><p>Kurva muncul saat data driver diterima.</p><small>Pilih driver dengan kamera aktif untuk mulai pemantauan.</small></div>}
    <p className="trend-footnote">{simulatedSpeed ? 'OBD dan lingkungan dummy; skor bahaya mengikuti deteksi kantuk live dan GPS yang tersedia.' : 'Riwayat selama pemantauan halaman ini. Data terlambat ditampilkan sebagai jeda pada kurva.'}</p></section>;
}
