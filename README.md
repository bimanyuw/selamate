# Selamate — Early Warning System

Setup awal EWS dengan lima bagian terpisah. Dashboard menggunakan **data simulasi**, bukan data bencana aktual. Belum ada database, autentikasi, sumber sensor, atau model prediksi aktif.

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
