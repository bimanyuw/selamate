export class DriverRingtone {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private oscillators = new Set<OscillatorNode>();
  private chimes = new Set<OscillatorNode>();

  constructor(private onReady: (ready: boolean) => void) {}

  async enable() {
    const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Browser ini tidak mendukung alarm suara.');
    if (!this.context || this.context.state === 'closed') {
      this.context = new Audio();
      this.context.onstatechange = () => this.onReady(this.context?.state === 'running');
    }
    await this.context.resume();
    const ready = this.context.state === 'running';
    this.onReady(ready);
    if (!ready) throw new Error('Geser kontrol suara untuk mengizinkan alarm.');
    this.chime();
  }

  private tone(delay: number, duration: number) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime + delay;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.015);
    gain.gain.setValueAtTime(0.3, start + duration - 0.025);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    gain.connect(context.destination);
    let remaining = 2;
    for (const frequency of [850, 1200]) {
      const oscillator = context.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = 'triangle';
      oscillator.connect(gain);
      this.oscillators.add(oscillator);
      oscillator.onended = () => { this.oscillators.delete(oscillator); oscillator.disconnect(); if (--remaining === 0) gain.disconnect(); };
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
  }

  private vibrate(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern); } catch { /* Device/browser does not permit vibration. */ }
  }

  private burst() {
    this.tone(0, 0.32); this.tone(0.44, 0.32); this.tone(0.88, 0.48);
    this.vibrate([320, 120, 320, 120, 480]);
  }

  chime(delay = 0) {
    const context = this.context;
    if (!context || context.state !== 'running') return false;
    const start = context.currentTime + delay;
    for (const [frequency, amplitude] of [[1568, .18], [2093, .07]]) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(amplitude, start);
      gain.gain.exponentialRampToValueAtTime(.001, start + .55);
      oscillator.connect(gain); gain.connect(context.destination);
      this.chimes.add(oscillator);
      oscillator.onended = () => { this.chimes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + .6);
    }
    return true;
  }

  ring() {
    this.stop();
    if (this.context?.state !== 'running') return false;
    this.burst();
    this.timer = setInterval(() => this.burst(), 1900);
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.vibrate(0);
    for (const oscillator of this.oscillators) { try { oscillator.stop(); } catch { /* Already ended. */ } }
    this.oscillators.clear();
  }

  close() {
    this.stop();
    for (const oscillator of this.chimes) { try { oscillator.stop(); } catch { /* Already ended. */ } }
    this.chimes.clear();
    if (this.context) { this.context.onstatechange = null; void this.context.close().catch(() => {}); this.context = null; }
  }
}
