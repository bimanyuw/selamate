# Selamate — Early Warning System

Fondasi EWS untuk pengembangan. Data bawaan adalah simulasi; model prediksi belum aktif.

| Folder | Stack / fungsi |
| --- | --- |
| frontend | React, TypeScript, Vite, Tailwind CSS, fondasi shadcn/ui, Leaflet, Recharts |
| backend | FastAPI, SQLAlchemy, Alembic, psycopg |
| ai | pandas, scikit-learn, joblib (PyArrow opsional) |
| data | Data mentah, hasil olahan, dan sampel JSON |
| models | Artefak model terlatih dan registry |

## Instalasi

Prasyarat: Node.js 22.12+, Python 3.11+, dan Docker Desktop jika memakai database lokal.
Jalankan dari root proyek (PowerShell):

```powershell
npm.cmd install
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e './backend[dev]' -e ./ai
Copy-Item .env.example .env
```

Jangan menimpa .env yang sudah dikustomisasi. Di Linux/macOS gunakan npm dan .venv/bin/python.
requirements.lock.txt menyimpan versi Python hasil instalasi; untuk mereproduksi gunakan pip install -r requirements.lock.txt sebelum install editable kedua package.

## Menjalankan demo

Terminal pertama:

```powershell
npm.cmd run dev:backend
```

Terminal kedua:

```powershell
npm.cmd run dev:frontend
```

- Website: http://localhost:5173 (atau port yang ditampilkan Vite).
- API dan dokumentasi interaktif: http://127.0.0.1:3001/docs.
- Frontend menggunakan proxy /api ke port 3001.
- Mode DATA_SOURCE=simulation tidak membutuhkan PostgreSQL.
- Dashboard memuat peta, grafik jumlah peringatan, filter wilayah, dan pembaruan setiap 30 detik.
- Peta dasar OpenStreetMap membutuhkan internet. Koordinat demo adalah perkiraan lokasi kota.
- Untuk deployment, siapkan reverse proxy /api; proxy Vite hanya untuk development.

## PostgreSQL lokal

Pastikan Docker Desktop berjalan, lalu:

```powershell
docker compose up -d db
npm.cmd run db:migrate
npm.cmd run db:seed
```

Ubah DATA_SOURCE=database pada .env dan restart backend untuk membaca database.
Seed dapat dijalankan ulang tanpa menimpa record yang ada; record contoh tetap diberi label simulasi.
DATABASE_URL harus sesuai POSTGRES_USER, POSTGRES_PASSWORD, dan POSTGRES_DB.
Kredensial bawaan khusus lokal; port database hanya diekspos ke 127.0.0.1.
Data tersimpan di volume selamate_postgres. Hentikan container dengan docker compose stop.
PostGIS belum diperlukan untuk titik lokasi sederhana dan belum dipasang.

## Pemeriksaan

```powershell
npm.cmd run build
npm.cmd test
.venv\Scripts\python.exe -m selamate_ai
```

Tes database otomatis menggunakan SQLite terisolasi untuk logika query; PostgreSQL lokal diperiksa terpisah melalui migrasi dan /api/health/database.

## API

Register/login tersedia pada `/register` dan `/login`, dengan logout di header dashboard. Jalankan PostgreSQL dan `npm.cmd run db:migrate` untuk tabel akun. Autentikasi memakai backend yang sama; akun tetap membutuhkan database ketika DATA_SOURCE=simulation. Endpoint `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, dan `/api/auth/logout` mengelola cookie sesi HttpOnly. Alerts dan endpoint AI/pengemudi memerlukan login. Untuk deployment HTTPS gunakan AUTH_COOKIE_SECURE=true. Hosting frontend menyediakan SPA fallback untuk halaman auth.

- GET /api/health — status API, bukan jaminan koneksi database.
- GET /api/health/database — pemeriksaan koneksi database (503 jika tidak tersedia).
- GET /api/alerts — data simulasi atau record database sesuai konfigurasi.
- GET /api/ai/status — status registry model lama; terpisah dari ketersediaan endpoint scoring.

- POST /api/behavior — scoring perilaku mengemudi.
- POST /api/environment — scoring risiko lingkungan.
- POST /api/fatigue — upload video multipart field file; memerlukan ai[vision] dan models/eye_detector.pt.
- POST /api/risk — fusion tiga score 0–100.
- Alias tanpa /api juga tersedia untuk health dan keempat endpoint AI.

Backend mengimpor package ai langsung. Belum ada layanan inference terpisah, autentikasi, ingestion sensor, training, atau pengiriman notifikasi.
