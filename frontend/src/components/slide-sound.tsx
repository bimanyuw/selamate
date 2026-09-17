import { useRef, useState, type PointerEvent } from 'react';
import { ChevronsRight, Volume2 } from 'lucide-react';

export default function SlideSound({ ready, onEnable }: { ready: boolean; onEnable: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const distance = () => Math.max(1, (track.current?.clientWidth ?? 0) - 48);
  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    const completed = event.clientX - start.current >= distance() * 0.85;
    start.current = null; setOffset(0);
    if (completed) onEnable();
  }
  const label = ready ? 'Geser untuk tes suara' : 'Geser aktifkan suara';
  return <div className="sound-slide" ref={track}>
    <span className="sound-slide-label" aria-hidden="true">{label}</span>
    <button type="button" className="sound-slide-thumb" aria-label={label} style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={event => { start.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (start.current !== null) setOffset(Math.min(distance(), Math.max(0, event.clientX - start.current))); }}
      onPointerUp={finish} onPointerCancel={() => { start.current = null; setOffset(0); }}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEnable(); } }}><Volume2 size={19} /></button>
    <ChevronsRight className="sound-slide-arrow" size={16} aria-hidden="true" />
  </div>;
}
