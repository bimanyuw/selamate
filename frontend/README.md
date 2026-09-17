# Frontend

React + TypeScript + Vite, Tailwind melalui plugin Vite. Alias @/ mengarah ke src/.
components.json dan src/components/ui/button.tsx menyiapkan pola shadcn/ui; komponen dimiliki dan dapat diedit di proyek.

Dashboard memakai komponen Button, peta react-leaflet, dan grafik Recharts. Peta serta grafik dimuat lazy.
Polling API setiap 30 detik, tombol refresh, filter wilayah, dan kondisi error tersedia.
Tidak ada API key untuk peta dasar OpenStreetMap; penggunaan produksi perlu menyesuaikan layanan tile.

Dari root: npm.cmd run dev:frontend atau npm.cmd run build.
