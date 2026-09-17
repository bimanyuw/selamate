# Website pengemudi realtime

Login atau register terlebih dahulu. Akun membutuhkan PostgreSQL dan `npm.cmd run db:migrate`, termasuk pada mode simulation. Dashboard pemantau juga harus login; ID sesi yang dibagikan mengizinkan pembacaan snapshot, sedangkan pengiriman frame/telemetri dan penghentian sesi hanya untuk pemilik.

Struktur React/Vite, FastAPI, dan package ai/src/selamate_ai tetap digunakan. Mode upload/manual yang lama tetap tersedia. Panel **Mode pengemudi realtime** mengirim JPEG kamera depan secara berurutan, GPS, dan pembacaan OBD-II BLE ke backend yang sama. Semua request menggunakan VITE_API_BASE_URL.

## Demo lokal

Layar driver memakai dua kolom pada HP: kamera di kiri dan notifikasi admin di kanan, termasuk saat portrait. Preview kamera dibuka langsung dari tombol pengguna sebelum mencoba koneksi sesi backend. Jika koneksi admin gagal, preview tetap aktif dan tombol **Hubungkan ke admin** dapat mencoba koneksi ulang. Jika browser memblokir playback, tekan **Tampilkan kamera**. Video memakai ref stabil agar pembaruan telemetri tidak memasang ulang MediaStream. Error izin kamera ditampilkan dengan instruksi mencoba kembali.

Tampilan mengikuti role: akun **Driver** membuka kamera depan, tombol aktifkan/hentikan, ID sesi dan notifikasi admin pada semua perangkat. Akun **Admin** membuka dashboard kendaraan, peta, grafik dan kontrol operator. Memulai kamera di HP tidak mengisi kondisi lingkungan/batas kecepatan fiktif; komponen risiko tersebut menunggu data yang valid.

Admin login di laptop; daftar driver aktif diperbarui otomatis, dan driver pertama dengan kamera aktif langsung dipantau. Admin dapat memilih driver lain melalui tombol **Pantau** atau memasukkan ID sesi. Dashboard menerima preview kamera serta status kantuk. Admin menulis pesan pada **Notifikasi untuk driver**. Hanya role Admin yang boleh mengirim pesan (`POST /api/driver/sessions/{id}/notifications`). Pesan tampil di HP melalui respons telemetri berkala saat sesi aktif. Pesan disimpan dalam memori per sesi (maksimal 50), hilang ketika sesi dihentikan/server restart, dan bukan push notification saat browser ditutup. Jika model belum tersedia, frame preview tetap dikirim sementara analisis mata dihentikan dengan pesan error yang jelas.

Dari root, terminal 1:

```powershell
$env:DATA_SOURCE = "simulation"
npm.cmd run dev:backend
```

Terminal 2:

```powershell
$env:VITE_API_BASE_URL = "/api"
npm.cmd run dev:frontend
```

Untuk HP, buka website melalui HTTPS (reverse proxy atau tunnel HTTPS ke frontend port 5173). HTTP alamat IP laptop tidak cukup untuk kamera/GPS. Jika tunnel memakai hostname publik, tambahkan hostname itu ke FRONTEND_ALLOWED_HOSTS, misalnya di frontend/.env.local, lalu restart Vite. Daftar hostname dipisah koma; isi hostname saja, tanpa https:// atau path. Tunnel meneruskan /api melalui proxy Vite ke backend lokal, sehingga CORS lintas origin tidak diperlukan. Untuk frontend dan backend yang terpisah, gunakan URL API HTTPS serta CORS_ORIGINS yang sesuai.

Isi batas kecepatan, kondisi lingkungan, serta hitungan kejadian manual. Klik **Mulai kamera & GPS**, berikan izin, dan biarkan halaman aktif. GPS speed dapat null; sistem tidak menggantinya dengan angka nol. Jika OBD memberikan kecepatan terbaru, kecepatan OBD diprioritaskan. Data GPS kedaluwarsa setelah 10 detik, OBD setelah 5 detik. Kecepatan GPS dikonversi dari m/s menjadi km/jam.

Model tidak tersedia: analisis menampilkan pesan 503 yang jelas dan pengiriman ke endpoint analisis dihentikan; preview kamera, GPS dan notifikasi tetap berjalan. Tidak ada prediksi fatigue palsu. Sediakan models/eye_detector.pt secara terpisah untuk inference sebenarnya. Klik **Hentikan** untuk menutup kamera, GPS, Bluetooth, dan sesi.

## OBD-II BLE

Implementasi mendukung **ELM327 text UART over BLE GATT**, bukan Bluetooth Classic/SPP. Isi service UUID, write characteristic UUID, dan notify characteristic UUID 128-bit sesuai dokumentasi adaptor. Pengguna harus menekan tombol pemilihan perangkat. Browser harus mendukung Web Bluetooth; dukungannya tidak universal. Protokol vendor khusus membutuhkan penyesuaian setelah tipe adaptor diketahui.

Inisialisasi: ATZ, ATE0, ATL0, ATS0, ATH0, ATSP0. Polling: PID 010D (speed km/jam) dan 010C (RPM). Respons tanpa PID menghasilkan nilai tidak tersedia, bukan data simulasi. Koneksi hardware belum diuji. Harsh braking/acceleration/turns belum dideteksi otomatis; hitungan manual dinyatakan jelas di UI. Tidak ada klaim GPS memberikan speed limit, risiko bencana, atau cuaca otomatis.

## Backend dan dashboard

- POST /api/driver/sessions: buat sesi.
- POST /api/driver/sessions/{id}/frame: multipart file JPEG/PNG, timestamp detik relatif terhadap awal sesi. Maksimal 512 KiB/frame; tidak ditulis ke disk.
- POST /api/driver/sessions/{id}/telemetry: JSON lokasi, sumber kecepatan, RPM, serta input behavior/environment opsional.
- GET /api/driver/sessions/{id}: snapshot terbaru untuk dashboard.
- POST /api/driver/sessions/{id}/stop: hapus sesi.

Salin ID sesi ke panel **Pantau sesi dari perangkat lain** pada website yang terhubung ke backend sama. Snapshot dipoll setiap detik. Perlakukan ID sesi sebagai akses privat demo.

Backend menyimpan window fatigue 60 detik, maksimum 300 sampel per sesi. UNKNOWN dan gap >1.5 detik mengurangi cakupan deteksi; setidaknya 5 detik pengamatan diperlukan sebelum status fatigue digunakan untuk fusion. Fusion hanya dilakukan jika ketiga komponen tersedia dan frame/telemetri masih segar (<=5 detik). Usia data ditampilkan di dashboard. Frekuensi aktual frame tergantung waktu inference dan jaringan, sehingga kemampuan menangkap penutupan mata singkat perlu dievaluasi pada GPU/perangkat nyata.

Sesi disimpan dalam memori: gunakan **satu worker Uvicorn**. Maksimum 128 sesi; TTL 15 menit sejak request terakhir. Restart menghapus sesi. Untuk deployment dengan banyak worker diperlukan shared session store. Versi demo belum menyediakan login/otorisasi multi-user, pengoperasian background browser, atau penyimpanan telemetri permanen. Tab harus tetap aktif. Tidak ada backend kedua atau server Python baru.
