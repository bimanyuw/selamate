# Backend

HTTP API Node.js tanpa dependency runtime tambahan. Jalankan `npm run dev:backend` dari root. Port default 3001; bisa diubah melalui environment variable `PORT` (sesuaikan juga proxy frontend).

- `GET /api/health`: status layanan.
- `POST /api/auth/login`: membuat sesi dari email dan password.
- `POST /api/auth/logout`: menghapus sesi.
- `GET /api/auth/me`: pengguna yang sedang login.
- `GET /api/alerts`: data simulasi untuk User dan Admin.
- `GET /api/admin/summary`: ringkasan khusus Admin.

API hanya bind ke localhost untuk pengembangan. Sesi ditandatangani dan disimpan dalam cookie HttpOnly. `npm test` memeriksa autentikasi, otorisasi role, dan endpoint dasar. Belum ada koneksi database atau layanan AI.
