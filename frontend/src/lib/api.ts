export type Alert = {
  id: string;
  region: string;
  hazard: string;
  level: 'Waspada' | 'Siaga' | 'Awas';
  description: string;
  latitude: number;
  longitude: number;
  is_simulation: boolean;
};

export type AlertsResponse = { source: 'simulation' | 'database'; alerts: Alert[] };

export async function getAlerts(signal?: AbortSignal): Promise<AlertsResponse> {
  const response = await fetch('/api/alerts', { signal });
  if (!response.ok) throw new Error('Data belum tersedia. Periksa backend dan koneksi database.');
  return response.json();
}
