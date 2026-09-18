// Fictional locations for the demo; distances are straight-line, not road distances.
export const restStops = [
  { id: 'rest-01', name: 'Area Istirahat SelaMate 01', latitude: -6.21, longitude: 106.81, facilities: 'Parkir / toilet / minuman' },
  { id: 'rest-02', name: 'Area Istirahat SelaMate 02', latitude: -6.59, longitude: 106.80, facilities: 'Parkir / toilet / tempat makan' },
  { id: 'rest-03', name: 'Area Istirahat SelaMate 03', latitude: -6.90, longitude: 107.61, facilities: 'Parkir / toilet / ruang istirahat' },
];
export function nearestRestStop(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null) return { ...restStops[0], distance: null };
  const rad = (n: number) => n * Math.PI / 180;
  return restStops.map(stop => {
    const h = Math.sin(rad(stop.latitude - latitude) / 2) ** 2 + Math.cos(rad(latitude)) * Math.cos(rad(stop.latitude)) * Math.sin(rad(stop.longitude - longitude) / 2) ** 2;
    return { ...stop, distance: 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))) };
  }).sort((a, b) => a.distance - b.distance)[0];
}
