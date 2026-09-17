export type ReadingTone = 'safe' | 'caution' | 'attention' | 'danger' | 'unknown';

export function speedTone(speed: number | null | undefined, limit: number | null | undefined): ReadingTone {
  if (speed == null || limit == null || limit <= 0) return 'unknown';
  return speed > limit ? 'danger' : speed >= limit * 0.9 ? 'caution' : 'safe';
}

export default function DashboardGauge({ value, max, tone, label }: { value: number | null | undefined; max: number; tone: ReadingTone; label: string }) {
  const fraction = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return <svg className={`dashboard-gauge tone-${tone}`} viewBox="0 0 180 112" role="img" aria-label={`${label}: ${value == null ? 'belum tersedia' : value}`}>
    <path className="gauge-track" d="M 18 90 A 72 72 0 0 1 162 90" fill="none" strokeWidth="12" strokeLinecap="round" />
    {value != null && <path className="gauge-fill" d="M 18 90 A 72 72 0 0 1 162 90" fill="none" strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray={`${fraction * 100} 100`} />}
    {[0, .25, .5, .75, 1].map(step => { const angle = Math.PI * (1 - step); return <line key={step} x1={90 + 53 * Math.cos(angle)} y1={90 - 53 * Math.sin(angle)} x2={90 + 59 * Math.cos(angle)} y2={90 - 59 * Math.sin(angle)} stroke="currentColor" opacity=".35" strokeWidth="2" />; })}
    {value != null && <g transform={`rotate(${fraction * 180},90,90)`}><line x1="90" y1="90" x2="38" y2="90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="90" cy="90" r="6" fill="currentColor" /></g>}
    <text x="18" y="108" textAnchor="middle">0</text><text x="162" y="108" textAnchor="middle">{max}</text>
  </svg>;
}
