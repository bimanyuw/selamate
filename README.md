# Selamate — Early Warning System

Setup awal EWS dengan lima bagian terpisah. Dashboard menggunakan **data simulasi**, bukan data bencana aktual. Autentikasi demo dan pembatasan akses berbasis role sudah tersedia; database, sumber sensor, dan model prediksi belum aktif.

```text
selamate/
├── frontend/   # React + TypeScript + Vite
├── backend/    # HTTP API Node.js
├── ai/         # Package Python untuk pengembangan pipeline AI
├── data/       # Data mentah, hasil pengolahan, dan contoh
└── models/     # Registry dan artefak model terlatih
```

## Menjalankan website

Prasyarat: Node.js 22.12+ dan npm. Jalankan dari root proyek:

```sh
npm install
npm run dev:backend
```

Di terminal kedua:

```sh
npm run dev:frontend
```

Buka alamat yang ditampilkan Vite (biasanya http://localhost:5173). Frontend meneruskan `/api` ke backend pada http://127.0.0.1:3001. Di PowerShell yang memblokir `npm.ps1`, gunakan `npm.cmd` sebagai pengganti `npm`.

```sh
npm run build
npm test
```

## Akun demo dan role

- `Driver`: `driver@selamate.id` / `Driver123!` — dashboard dan data peringatan.
- `Admin`: `admin@selamate.id` / `Admin123!` — akses tambahan ke ringkasan sistem.

Kredensial dapat diganti melalui `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DRIVER_EMAIL`, dan `DRIVER_PASSWORD`. Untuk deployment, wajib isi `SESSION_SECRET` dengan nilai acak yang kuat. Akun masih berada di memori dan harus dipindahkan ke database sebelum penggunaan produksi.

Build menghasilkan `frontend/dist`. Untuk deployment, sediakan reverse proxy `/api` menuju backend; proxy Vite hanya berlaku saat development.

## Fondasi AI

Prasyarat: Python 3.10+. Pemeriksaan registry tanpa dependensi tambahan:

```sh
python ai/src/selamate_ai/__main__.py
```

Untuk pengembangan package, buat virtual environment dan install editable:

```sh
python -m venv ai/.venv
ai/.venv/Scripts/python -m pip install -e ./ai
ai/.venv/Scripts/python -m selamate_ai
```

Perintah environment di atas untuk Windows. Pada Linux/macOS, gunakan `ai/.venv/bin/python`.

Alur saat ini: `frontend → backend → data/samples`. Integrasi yang akan dikembangkan: pemrosesan dataset di `ai`, artefak di `models`, lalu inference melalui backend.
