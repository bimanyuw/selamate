import { useEffect, useState } from 'react';
import { driverCameraUrl } from '@/lib/api';

export default function RemoteCamera({ sessionId, version }: { sessionId: string; version: number }) {
  const url = driverCameraUrl(sessionId, version);
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [url]);
  return <>{<img className="remote-driver-camera" src={url} alt="Kamera langsung dari perangkat driver" onError={() => setError(true)} />}{error && <p className="remote-camera-error" role="status">Frame kamera belum dapat dimuat. Menunggu pembaruan driver.</p>}</>;
}
