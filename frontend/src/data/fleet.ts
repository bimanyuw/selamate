export type VehicleStatus = 'critical' | 'warning' | 'safe';
export type Vehicle = {
  id: string; driver: string; status: VehicleStatus; score: number; speed: number;
  driveTime: string; location: string; destination: string; lat: number; lng: number;
  fuel: number; engineTemp: number; fatigue: number; camera: 'online' | 'attention';
  seatbelt: boolean; signal: number; lastEvent: string;
};

export const vehicles: Vehicle[] = [
  { id: 'TRK-07', driver: 'Agus Setiawan', status: 'critical', score: 91, speed: 58, driveTime: '3j 42m', location: 'Tol Cipularang KM 104', destination: 'Rest Area KM 97', lat: -6.756, lng: 107.476, fuel: 38, engineTemp: 91, fatigue: 87, camera: 'attention', seatbelt: true, signal: 82, lastEvent: 'Mata tertutup 2,4 detik' },
  { id: 'BUS-12', driver: 'Siti Rahma', status: 'warning', score: 68, speed: 64, driveTime: '2j 18m', location: 'Cisomang KM 112', destination: 'Padalarang', lat: -6.844, lng: 107.566, fuel: 61, engineTemp: 86, fatigue: 62, camera: 'online', seatbelt: true, signal: 74, lastEvent: 'Menguap terdeteksi' },
  { id: 'VAN-03', driver: 'Dedi Kurniawan', status: 'safe', score: 24, speed: 52, driveTime: '1j 06m', location: 'Padalarang KM 120', destination: 'Pasteur', lat: -6.9, lng: 107.62, fuel: 76, engineTemp: 82, fatigue: 21, camera: 'online', seatbelt: true, signal: 91, lastEvent: 'Tidak ada anomali' },
];
