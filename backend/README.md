# Backend

HTTP API Node.js tanpa dependency runtime tambahan. Jalankan `npm run dev:backend` dari root. Port default 3001; bisa diubah melalui environment variable `PORT` (sesuaikan juga proxy frontend).

- `GET /api/health`: status layanan.
- `GET /api/alerts`: data contoh dari `data/samples/alerts.json`, diberi `source: simulation`.

API hanya bind ke localhost untuk pengembangan. `npm test` dari root memeriksa health, data simulasi, 404, dan 405. Belum ada koneksi database atau layanan AI.
