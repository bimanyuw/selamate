# Backend

Backend Node.js awal telah diganti FastAPI. Package: src/selamate_backend.
Install backend dan ai di .venv root; jalankan npm.cmd run dev:backend dari root.
Dokumentasi: http://127.0.0.1:3001/docs.

SQLAlchemy memakai PostgreSQL melalui psycopg; migrasi di migrations/.
npm.cmd run db:migrate menerapkan migrasi, npm.cmd run db:seed menambahkan contoh secara idempotent.
Konfigurasi dibaca dari .env root. DATA_SOURCE=simulation tidak membuka koneksi database saat mengambil peringatan.
DATA_SOURCE=database mengembalikan 503 ketika database tidak siap, tanpa mengganti sumber secara diam-diam.

Lihat README root untuk instalasi, endpoint, dan pengujian.
