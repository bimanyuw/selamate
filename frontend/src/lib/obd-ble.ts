// Minimal Web Bluetooth types, kept local because browser support is optional.
interface Characteristic extends EventTarget {
  value?: DataView;
  properties: { write: boolean; writeWithoutResponse: boolean };
  startNotifications(): Promise<Characteristic>;
  writeValueWithResponse(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
}
interface Device extends EventTarget {
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<Server>; disconnect(): void };
}
interface Server {
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<Characteristic> }>;
}
export type ObdReading = { speed: number | null; rpm: number | null; received: number };

export class ObdBle {
  private device: Device | null = null;
  private tx: Characteristic | null = null;
  private rx: Characteristic | null = null;
  private pending: { resolve(value: string): void; reject(error: Error): void } | null = null;
  private buffer = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private onDisconnect: ((error: unknown) => void) | null = null;
  private receive = () => {
    const value = this.rx?.value;
    if (!value || !this.pending) return;
    this.buffer += new TextDecoder().decode(value);
    if (this.buffer.length > 8192) { this.pending.reject(new Error('Respons OBD terlalu panjang')); return; }
    if (this.buffer.includes('>')) this.pending.resolve(this.buffer);
  };
  private disconnected = () => { const notify = this.onDisconnect; this.disconnect(); notify?.(new Error('Koneksi OBD terputus.')); };

  async connect(service: string, write: string, notify: string): Promise<string> {
    if (!window.isSecureContext) throw new Error('Bluetooth membutuhkan HTTPS.');
    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice(options: { filters: { services: string[] }[] }): Promise<Device> } }).bluetooth;
    if (!bluetooth) throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan browser yang mendukung BLE.');
    if (![service, write, notify].every(uuid => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))) throw new Error('Masukkan UUID GATT 128-bit dari dokumentasi adaptor BLE.');
    try {
      this.device = await bluetooth.requestDevice({ filters: [{ services: [service] }] });
      this.device.addEventListener('gattserverdisconnected', this.disconnected);
      if (!this.device.gatt) throw new Error('Adaptor tidak menyediakan koneksi GATT.');
      const server = await this.device.gatt.connect();
      const gattService = await server.getPrimaryService(service);
      this.tx = await gattService.getCharacteristic(write);
      this.rx = await gattService.getCharacteristic(notify);
      this.rx.addEventListener('characteristicvaluechanged', this.receive);
      await this.rx.startNotifications();
      // Supported profile: ELM327 text commands over a BLE GATT UART.
      for (const command of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) {
        const response = await this.command(command);
        if (response.includes('?') || /ERROR/i.test(response)) throw new Error(`Adaptor menolak ${command}; profil ELM327 tidak kompatibel.`);
      }
      return this.device.name || 'OBD BLE';
    } catch (error) { this.disconnect(); throw error; }
  }

  private async command(command: string): Promise<string> {
    if (!this.device?.gatt?.connected || !this.tx) throw new Error('OBD terputus.');
    this.buffer = '';
    let timeout: ReturnType<typeof setTimeout>;
    const response = new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      timeout = setTimeout(() => reject(new Error(`OBD tidak menjawab ${command}`)), 5000);
    });
    const bytes = new TextEncoder().encode(command + '\r');
    try {
      const write = this.tx.properties.write ? this.tx.writeValueWithResponse(bytes) : this.tx.writeValueWithoutResponse(bytes);
      return (await Promise.all([response, write]))[0];
    } finally { clearTimeout(timeout!); this.pending = null; }
  }

  poll(onReading: (reading: ObdReading) => void, onError: (error: unknown) => void): void {
    this.onDisconnect = onError;
    this.running = true;
    const read = async () => {
      try {
        const speedResponse = (await this.command('010D')).replace(/\s/g, '').toUpperCase();
        const rpmResponse = (await this.command('010C')).replace(/\s/g, '').toUpperCase();
        const speed = speedResponse.match(/410D([0-9A-F]{2})/);
        const rpm = rpmResponse.match(/410C([0-9A-F]{4})/);
        if (!this.running) return;
        onReading({ speed: speed ? parseInt(speed[1], 16) : null, rpm: rpm ? parseInt(rpm[1], 16) / 4 : null, received: performance.now() });
        if (this.running) this.timer = setTimeout(() => void read(), 1000);
      } catch (error) { if (this.running) onError(error); this.disconnect(); }
    };
    void read();
  }

  disconnect(): void {
    this.onDisconnect = null;
    this.running = false;
    clearTimeout(this.timer);
    this.pending?.reject(new Error('OBD terputus.'));
    this.rx?.removeEventListener('characteristicvaluechanged', this.receive);
    this.device?.removeEventListener('gattserverdisconnected', this.disconnected);
    this.device?.gatt?.disconnect();
    this.device = null; this.tx = null; this.rx = null;
  }
}
