import { Eye, Smile } from 'lucide-react';
import type { DriverSnapshot } from '@/lib/api';
import './camera-detection.css';

export default function CameraDetection({ fatigue }: { fatigue: DriverSnapshot['fatigue'] }) {
  const eyes = fatigue?.eye_state;
  const mouth = fatigue?.mouth_state;
  const drowsy = fatigue?.fatigue_status === 'DROWSY' || fatigue?.fatigue_status === 'FATIGUED';
  return <div className="camera-detection" aria-label="Deteksi kamera live">
    <span className={eyes === 'CLOSED' ? 'detection-attention' : ''}><Eye size={15} />{eyes === 'OPEN' ? 'Mata terbuka' : eyes === 'CLOSED' ? drowsy ? 'Mata tertutup · mengantuk' : 'Mata tertutup' : 'Mata belum terbaca'}</span>
    {mouth !== 'UNKNOWN' && mouth != null && <span className={mouth === 'OPEN' ? 'detection-attention' : ''}><Smile size={15} />{mouth === 'OPEN' ? 'Mulut terbuka' : 'Mulut tertutup'}</span>}
    {!!fatigue?.yawn_count && <small>Indikasi menguap: {fatigue.yawn_count}× / 60 detik</small>}
  </div>;
}
