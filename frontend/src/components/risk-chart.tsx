import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Alert } from '@/lib/api';

export default function RiskChart({ alerts }: { alerts: Alert[] }) {
  const data = ['Waspada', 'Siaga', 'Awas'].map(level => ({ level, jumlah: alerts.filter(a => a.level === level).length }));
  return <div>
    <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} accessibilityLayer margin={{ top: 15, right: 10, bottom: 0, left: -25 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="level" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Bar dataKey="jumlah" name="Jumlah peringatan" fill="#276556" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer></div>
    <p className="text-xs text-muted-foreground">{data.map(d => d.level + ': ' + d.jumlah).join(' · ')}</p>
  </div>;
}
