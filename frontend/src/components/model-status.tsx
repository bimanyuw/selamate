import { useEffect, useState } from 'react';
import './camera-detection.css';
import { apiUrl } from '@/lib/api-config';
type Entry = { id: string; name: string; status: string };
export default function ModelStatus() {
  const [models, setModels] = useState<Entry[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl('ai/status'), { signal: controller.signal, credentials: 'include' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (!controller.signal.aborted) setModels(data.models ?? []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <details className="model-status"><summary>Modul deteksi & pengembangan</summary><ul>{models.map(model => <li key={model.id}><span>{model.name}</span><small>{{ pretrained: 'Pretrained Google', weights_available: 'Model tersedia', not_trained: 'Belum dilatih', implemented: 'Algoritma aktif', missing_weights: 'Model belum tersedia' }[model.status] ?? model.status}</small></li>)}</ul><p>Model pretrained bukan hasil training tim. Modul yang belum dilatih tidak digunakan untuk menghasilkan prediksi demo.</p></details>;
}
