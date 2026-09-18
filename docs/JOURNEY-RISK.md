# Skor bahaya perjalanan untuk demo

Endpoint login-required: `POST /api/journey-risk`. Dashboard mengirim `session_id` dan menghitung ulang sekitar setiap dua detik. Backend mengambil hasil deteksi kantuk terbaru dari sesi tersebut; hanya pemilik sesi atau admin yang boleh mengaksesnya. Permintaan tanpa sesi tetap dapat menghitung indeks perjalanan parsial tanpa kamera.

Bobot dasar: lingkungan 35%, kecepatan/manuver 30%, kondisi kendaraan 20%, bahaya sekitar GPS 15%. Komponen yang tidak tersedia dikeluarkan dan bobot sisanya dinormalisasi. Cakupan data dan komponen yang belum tersedia selalu ditampilkan; tidak adanya data tidak berarti aman.

Lingkungan memakai algoritma `score_environment`: hujan (mm/jam), jarak pandang (meter), permukaan jalan, kemiringan (derajat), dan indeks bahaya lingkungan (0–100). Perilaku memakai `score_behavior`: rasio kecepatan terhadap batas serta jumlah pengereman, akselerasi, dan belokan mendadak. Batas kecepatan berasal dari input, bukan otomatis dari peta.

Kondisi kendaraan mengambil nilai tertinggi dari indikator bensin, RPM, dan suhu: bensin <=25/10/5% menghasilkan 40/70/100; RPM >=4500/6000 menghasilkan 40/80; suhu >=100/110°C menghasilkan 50/100. Nilai lain menghasilkan 0. Sensor yang tidak tersedia tidak diisi dengan angka buatan pada mode live.

GPS memakai jarak Haversine ke titik bahaya dari `/api/alerts`, radius 5 km, dengan akurasi GPS maksimal 100 meter. Skor titik = tingkat bahaya (Waspada 40, Siaga 70, Awas 100) × (1 − jarak/5). Digunakan skor tertinggi. Posisi GPS tidak menciptakan data cuaca; cuaca berasal dari input telemetri atau skenario demo. Data titik bahaya bawaan masih simulasi dan ditandai demikian. Jika database bahaya gagal, komponen GPS tidak dihitung.

Skor akhir = rata-rata berbobot komponen yang tersedia, dengan nilai minimum untuk pemicu penting. Minimum 40 untuk bensin <=25%, suhu >=100°C, atau melampaui batas kecepatan; minimum 70 untuk bensin <=5%, suhu >=110°C, kecepatan >=130% batas, jalan tergenang/es, skor lingkungan atau kedekatan bahaya >=70, serta kecepatan >40 km/jam bersamaan hujan >=20 mm/jam atau jarak pandang <300 meter. Pemicu minimum mencegah bahaya penting tertutupi komponen lain yang rendah.

Status: 0–<40 aman (hijau), 40–<70 hati-hati (kuning), 70–100 waspada (merah). Ini indeks heuristik untuk demo, bukan probabilitas kecelakaan atau ambang kendaraan yang sudah dikalibrasi. Sesuaikan batas RPM/suhu untuk kendaraan sebenarnya.

Data demo di dashboard memakai satu konfigurasi tetap di kode, tanpa checkbox atau pilihan skenario. OBD: kecepatan 48 km/jam, batas 60 km/jam, bensin 23%, RPM 2200, suhu 88 C, durasi 8200 detik, jarak 82,4 km. Lingkungan: hujan 10 mm/jam, jarak pandang 600 meter, jalan basah, kemiringan 3 derajat, indeks bahaya lingkungan 10. GPS, akun, kamera, deteksi mata, dan pesan admin tetap live. Nilai dummy tetap konstan; skor bahaya dan kurvanya berubah mengikuti kantuk live serta GPS.

Dengan kamera valid, skor gabungan = indeks perjalanan + (100 - indeks perjalanan) × skor kantuk / 100. Contoh indeks perjalanan 40: kantuk 0 → skor 40, kantuk 20 → 52, kantuk 50 → 70, kantuk 80 → 88. Ini heuristik indeks 0–100, bukan probabilitas kecelakaan. Skor kantuk memakai nilai terbesar antara analisis mata (proporsi waktu mata tertutup dan durasi penutupan terpanjang) dan indikasi menguap (durasi/frekuensi mulut terbuka dari landmark wajah pretrained). Rincian/ambang heuristik menguap ada di `models/README.md`. Kantuk tidak boleh menurunkan risiko kendaraan/jalan yang sudah tinggi. Jika hanya kamera tersedia, gunakan skor kantuk sebagai indeks parsial.

Frame lebih tua dari lima detik atau hasil `INSUFFICIENT_DATA` tidak digunakan sebagai nilai kantuk nol: komponen kantuk ditandai belum tersedia dan hanya indeks perjalanan parsial ditampilkan. Cakupan input gabungan mengalokasikan 50% untuk kamera dan 50% untuk kelompok perjalanan dengan bobot dasar di atas; bobot cakupan tidak merupakan rumus skor gabungan yang nonlinear. Gauge, analisis admin, kurva, dan pemicu peringatan driver memakai skor gabungan yang sama.

## Driver mobile dan peringatan mandiri

Panel OBD Bluetooth menampilkan form service/write/notify UUID untuk adaptor ELM327 BLE GATT UART dan tombol putus koneksi. Konfigurasi perjalanan menyimpan batas kecepatan, termasuk selama sesi berjalan. Telemetri mobile memakai kecepatan/RPM sensor jika tersedia; bagian yang tidak tersedia memakai nilai demo. Lingkungan demo menghasilkan skor 26,5/100. Konfigurasi UUID harus sesuai adaptor, bukan nilai tebakan. Pengujian koneksi memakai mock BLE, belum adaptor fisik.

Backend mencatat admin yang mengambil snapshot sesi yang dipilih. Kehadiran berlaku 8 detik sejak pembacaan terakhir. Snapshot driver menyertakan `admin_monitoring`. Saat admin tidak memantau, driver menerima alarm otomatis sederhana untuk kantuk/menguap, indeks bahaya >=70, atau durasi sesi kamera nyata >=7200 detik, beserta rekomendasi istirahat. Alarm dibatasi 30 detik dan bisa dihentikan; pemicu yang sama tidak dibunyikan ulang dalam sesi. Alarm otomatis berhenti saat admin kembali memantau. Tidak ada Level 1–2–3, countdown, tombol respons, atau riwayat eskalasi; endpoint peringatan bertingkat tidak diaktifkan. Tabel lama tetap dipertahankan untuk kompatibilitas migrasi tanpa menghapus data.

Kartu analisis rinci hanya di dashboard admin. Mobile driver memakai kartu Teman perjalanan aktif, notifikasi admin, kamera, dan konfigurasi OBD. Pesan teks admin menghasilkan chime ting sekali per ID pesan, bukan pada setiap polling. Suara memerlukan aktivasi dari tindakan pengguna; getar bergantung dukungan browser/perangkat. Alarm admin tetap diprioritaskan atas alarm otomatis.

Tiga area istirahat fiktif disimpan di `frontend/src/lib/rest-stops.ts`. Posisi GPS valid memilih titik dengan jarak Haversine terkecil, bukan jarak rute jalan. Tanpa GPS dipakai titik contoh pertama dan jarak tidak ditampilkan. Semua rekomendasi diberi label dummy; bukan rekomendasi lokasi nyata yang terverifikasi.

## Stabilitas deteksi live

Lima detik awal mengumpulkan observasi: status `INSUFFICIENT_DATA` dengan skor kantuk null, bukan langsung ngantuk/aman. Bukaan mata dikonfirmasi dari blendshape MediaPipe (kedua eyeBlink <=0.4 untuk OPEN, >=0.65 untuk CLOSED). Pembacaan landmark ambigu/tidak tersedia memakai hasil YOLO OPEN/CLOSED yang valid; jika kedua model tidak membaca mata, status tetap UNKNOWN. Deteksi mulut yang tidak tersedia tidak membatalkan hasil deteksi mata. Indikator mulut hanya tampil jika terbaca; mata tertutup berkepanjangan menampilkan indikator mengantuk. Hasil mentah YOLO disertakan sebagai `yolo_eye_state` untuk diagnosis.

Analisis mata live memakai jendela 15 detik, mengabaikan episode penutupan <1 detik atau hanya satu observasi. Penutupan kontinu >=1.5 detik memberi indeks minimal 40, >=3 detik minimal 70. Mata terbuka kontinu selama dua detik menghapus pengaruh penutupan lama agar tidak menahan status ngantuk selama 60 detik. Jeda/UNKNOWN tidak dihitung sebagai pemulihan. Analisis video offline tetap menyimpan ringkasan historisnya.

Indikasi menguap live juga pulih setelah mulut tertutup kontinu dua detik; jumlah indikasi 60 detik tetap tampil sebagai riwayat pengamatan, bukan penalti permanen. Alarm durasi memakai `session_duration_seconds` dari waktu monotonic backend, bukan durasi kendaraan dummy 8200 detik. Nilai dummy kendaraan/lingkungan tetap memengaruhi indeks perjalanan; bensin 23% tetap membuat indeks perjalanan minimal 40 walaupun skor kantuk sudah nol.
