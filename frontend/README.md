# Frontend

Mode pengemudi kamera/GPS/OBD BLE dan monitoring sesi: lihat [REALTIME.md](REALTIME.md).

React + TypeScript + Vite, Tailwind melalui plugin Vite. Alias @/ mengarah ke src/.
components.json dan src/components/ui/button.tsx menyiapkan pola shadcn/ui; komponen dimiliki dan dapat diedit di proyek.

Dashboard memakai komponen Button, peta react-leaflet, dan grafik Recharts. Peta serta grafik dimuat lazy.
Polling API setiap 30 detik, tombol refresh, filter wilayah, dan kondisi error tersedia.
Tidak ada API key untuk peta dasar OpenStreetMap; penggunaan produksi perlu menyesuaikan layanan tile.

Dari root: npm.cmd run dev:frontend atau npm.cmd run build.

## Backend API configuration

All frontend requests use `src/lib/api.ts` (fetch). The single API base is in `src/lib/api-config.ts`: `import.meta.env.VITE_API_BASE_URL`, defaulting to `/api`.

Create `frontend/.env.local` from `frontend/.env.example`. Vite loads env files from the frontend workspace, not the repository-root backend .env. Only VITE_-prefixed variables are exposed to the browser. Backend API prefixes belong in the base URL; avoid adding /api to individual request paths.

Local development: `VITE_API_BASE_URL=/api` preserves the existing Vite proxy to port 3001. Run `npm.cmd run dev:backend` and `npm.cmd run dev:frontend` from root. For direct access use `VITE_API_BASE_URL=http://localhost:3001/api`, then set backend CORS_ORIGINS to a JSON array containing the actual frontend origin.

Cloudeka: set VITE_API_BASE_URL to the actual HTTPS backend URL plus /api in frontend/.env.production.local or the build environment. Configure backend CORS_ORIGINS for the hosted frontend origin when cross-origin. Restart Vite after development env changes; rebuild and redeploy the frontend after production env changes because Vite substitutes these values at build time. Same-origin production may retain /api with a reverse proxy; the Vite development proxy does not exist in the production build.

Client methods: getHealth(), scoreBehavior(input), scoreEnvironment(input), analyzeFatigue(videoFile), fuseRisk(input), and existing getAlerts(). Every method supports an optional AbortSignal. Video requests use FormData field file without setting multipart Content-Type. Errors preserve backend detail strings and field validation messages.

The existing dashboard is preserved. A collapsible driver-risk panel accepts driving/environment observations and an optional video, displays backend health and component results, then calls risk fusion only when a sufficiently detected fatigue score exists. Without video, behavior and environment scoring still run. Scores come from backend functions; no frontend scoring or simulated eye predictions are added. Health reports backend reachability, not model readiness. Video inference requires the backend vision extras and models/eye_detector.pt. Assessment inputs are manual; no sensor or weather-provider ingestion is implied.
