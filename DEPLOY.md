# Deployment: Vercel + backend Docker

Frontend di Vercel; backend dan PostgreSQL online berjalan tanpa laptop. Backend memerlukan satu instance dan satu worker karena sesi pengemudi masih disimpan di memori. Restart/deploy backend menghapus sesi pengemudi aktif; akun tetap tersimpan di PostgreSQL.

## 1. Siapkan backend

Push perubahan proyek ke GitHub. Di Render, buat PostgreSQL lalu Web Service dari repository ini menggunakan runtime Docker dan Dockerfile root. Hosting Docker lain juga bisa digunakan. Pilih RAM yang memadai untuk PyTorch/YOLO; jangan aktifkan autoscaling. Periksa biaya paket di dashboard sebelum membuat layanan.

Isi environment backend:

```env
DATABASE_URL=<connection string PostgreSQL online>
DATA_SOURCE=simulation
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
CORS_ORIGINS=["https://nama-proyek.vercel.app"]
EYE_MODEL_URL=https://alamat-file-model-yang-dipercaya/eye_detector.pt
EYE_MODEL_SHA256=<checksum SHA256 model>
```

DATABASE_URL boleh berawalan postgres://, postgresql:// atau postgresql+psycopg://. Script startup mengatur driver psycopg, mengunduh dan memverifikasi model, menjalankan migrasi, lalu menjalankan backend. Mode database juga menjalankan seed contoh idempotent. Jangan mengisi localhost sebagai host database cloud. Tambahkan origin domain custom/preview yang dipakai ke CORS_ORIGINS.

Model harus model mata terlatih dengan kelas OPEN/CLOSED, bukan YOLO generik. Model ini belum tersedia di repository. Unggah model sendiri ke penyimpanan HTTPS tepercaya; URL rahasia hanya di environment backend. Alternatif: mount file dan set EYE_MODEL_PATH ke lokasi file. Untuk checksum lokal:

```powershell
Get-FileHash models/eye_detector.pt -Algorithm SHA256
```

Set health check backend ke /api/health/database. Tunggu backend healthy dan catat URL HTTPS-nya. Uji kamera/model sesudah deployment; health database tidak memeriksa kecocokan kelas model.

## 2. Hubungkan Vercel

Dari root repository, gunakan URL backend sebenarnya:

```powershell
node scripts/configure-vercel.mjs https://alamat-backend.onrender.com
```

Script membuat vercel.json dengan build frontend, proxy /api dan fallback halaman /login serta /register. Commit vercel.json dan push ke GitHub.

Di Vercel: Add New Project, import repository selamate, Root Directory tetap root repository. Set VITE_API_BASE_URL=/api. Build dan output mengikuti vercel.json. Jangan masukkan DATABASE_URL atau URL model ke environment frontend. Deploy, lalu sesuaikan CORS_ORIGINS backend dengan domain Vercel yang sebenarnya.

Proxy /api mempertahankan cookie sesi pada domain website. Jangan menggunakan tunnel trycloudflare sebagai backend permanen. Upload besar dapat terkena batas proxy platform; gunakan klip singkat dan periksa batas paket untuk upload video. Frame kamera aplikasi maksimal 512 KiB.

## 3. Verifikasi

Buka https://nama-proyek.vercel.app/api/health/database: harus status ok. Daftar akun, refresh halaman, login/logout, mulai kamera/GPS, lalu pantau ID sesi dari browser/perangkat kedua. Uji unggah video dan pastikan model memberikan hasil asli. HTTPS diperlukan untuk kamera/GPS/BLE; dukungan BLE tergantung browser/perangkat. Setelah semua berjalan, laptop dan Docker lokal boleh dimatikan.

Deployment belum dilakukan hanya dengan menambahkan file ini: masih perlu akun Vercel/hosting backend, database online, model mata, dan URL backend sebenarnya.
