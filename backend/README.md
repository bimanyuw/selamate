# Backend

## Admin / Driver setelah penggabungan GitHub

Endpoint `GET /api/admin/summary` dan panel Admin tetap tersedia. Akun registrasi selalu mendapat role Driver; role tidak bisa dipilih melalui API. Untuk memberi akses Admin, administrator database dapat menjalankan `UPDATE users SET role = 'Admin' WHERE email = 'alamat-akun-yang-dipercaya';` setelah akun dibuat. Terapkan migrasi `npm.cmd run db:migrate` sebelum menjalankan versi ini. Akun demo hardcoded dan backend Node lama digantikan oleh autentikasi PostgreSQL di aplikasi FastAPI yang sama. Login/me mengembalikan user langsung dengan id/name/email/role, tanpa wrapper tambahan.

## Register, login, logout

Akun disimpan di PostgreSQL, termasuk ketika DATA_SOURCE=simulation. Jalankan `npm.cmd run db:migrate` untuk tabel users/auth_sessions. Endpoint: POST /api/auth/register (name/email/password), POST /api/auth/login (email/password), GET /api/auth/me, POST /api/auth/logout. Register langsung membuat sesi login. Password 8–128 karakter di-hash Argon2id; token sesi acak hanya disimpan sebagai hash di database. Cookie HttpOnly berlaku 7 hari secara default; logout mencabut token server-side. Registrasi dan login dibatasi per IP dalam proses backend.

Dashboard, alerts, AI scoring/upload, dan sesi pengemudi memerlukan login. Health dan status registry tetap publik. Endpoint mutation sesi pengemudi hanya untuk pemilik sesi; pengguna login lain bisa memantau dengan ID sesi yang dibagikan. Penyimpanan window pengemudi masih memakai satu worker.

AUTH_COOKIE_SECURE=false, AUTH_COOKIE_SAMESITE=lax untuk localhost. Pada HTTPS production gunakan AUTH_COOKIE_SECURE=true. Jika frontend dan backend benar-benar cross-site, gunakan AUTH_COOKIE_SAMESITE=none dengan secure=true, CORS_ORIGINS eksplisit, dan browser yang mengizinkan cookie lintas situs; satu domain dengan reverse proxy /api lebih sederhana. AUTH_SESSION_SECONDS default 604800. Origin browser diperiksa terhadap origin request atau CORS_ORIGINS; reverse proxy perlu menjaga header Host/proxy agar origin konsisten. Email belum diverifikasi, dan reset password belum disediakan.

Endpoint sesi pengemudi realtime berada di `src/selamate_backend/driver_routes.py` pada aplikasi yang sama. Gunakan satu worker untuk penyimpanan sesi dalam memori. Alur HP/HTTPS dan kontrak endpoint dijelaskan di [frontend/REALTIME.md](../frontend/REALTIME.md).

Backend Node.js awal telah diganti FastAPI. Package: src/selamate_backend.
Install backend dan ai di .venv root; jalankan npm.cmd run dev:backend dari root.
Dokumentasi: http://127.0.0.1:3001/docs.

SQLAlchemy memakai PostgreSQL melalui psycopg; migrasi di migrations/.
npm.cmd run db:migrate menerapkan migrasi, npm.cmd run db:seed menambahkan contoh secara idempotent.
Konfigurasi dibaca dari .env root. DATA_SOURCE=simulation tidak membuka koneksi database saat mengambil peringatan.
DATA_SOURCE=database mengembalikan 503 ketika database tidak siap, tanpa mengganti sumber secara diam-diam.

Lihat README root untuk instalasi, endpoint, dan pengujian.

## AI endpoints

The existing FastAPI app owns every route. Canonical paths follow the `/api` convention; unprefixed aliases `/health`, `/behavior`, `/environment`, `/fatigue`, and `/risk` are also accepted (hidden from OpenAPI).

| Method | Path | AI function |
| --- | --- | --- |
| GET | /api/health | Existing backend health handler |
| POST | /api/behavior | selamate_ai.behavior.score_behavior |
| POST | /api/environment | selamate_ai.environment.score_environment |
| POST | /api/fatigue | selamate_ai.fatigue.analyze_video |
| POST | /api/risk | selamate_ai.fusion.fuse_risk |

Behavior JSON fields: speed, speed_limit (>0), harsh_braking, harsh_acceleration, sharp_turns. Event fields accept nonnegative integer counts or booleans and default to zero. Speeds must share a unit; event counts must cover a consistent observation window.

Environment JSON fields: rainfall (mm/h), visibility (metres), road_condition (dry/wet/damaged/flooded/icy), slope (signed degrees), disaster_risk (0–100).

Risk JSON fields: fatigue_score, behavior_score, environment_score, each finite and within 0–100. Unknown fields are rejected. Fatigue INSUFFICIENT_DATA must be handled by callers before fusion; null scores are rejected.

Fatigue expects multipart/form-data with video field `file`. MP4, AVI, MOV, WebM, MKV, M4V extensions are accepted, subject to OpenCV codec availability. Files are copied in chunks to a uniquely named temporary directory and removed after success or failure. Processing is synchronous in FastAPI's worker thread pool. Duration defaults to 300 seconds and upload size to 100 MiB; configure FATIGUE_MAX_VIDEO_SECONDS and FATIGUE_MAX_UPLOAD_BYTES. Upload limits are enforced during the route's copy; configure ingress/reverse-proxy body limits as well because multipart parsing occurs before the route.

Video decoding calls real YOLO on every frame, then timestamp-based fatigue analysis. Timing uses nominal video FPS; use constant-frame-rate videos for reliable temporal measurements. There is no prediction simulation fallback. Upload validation/decode errors return 422; oversize uploads 413; missing dependencies/weights or incompatible model classes 503; unexpected processing failures 500 with server-side logging. No per-driver window is shared between uploads.

Install backend with `pip install -e ./backend`; for video inference additionally use `pip install -e "./ai[vision]"` and provision root `models/eye_detector.pt` separately from GitHub. The inference extras remain optional and are not included in the base requirements lock.

Existing frontend requests remain relative to `/api`. CORS_ORIGINS defaults to `[]` for same-origin proxy use; for cross-origin deployment supply a JSON array of explicit frontend origins through environment settings. No Cloudeka URL is embedded in routes. The registry endpoint remains the legacy trained-model registry status, separate from scoring-route availability.
