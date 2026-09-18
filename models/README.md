# Models

- `artifacts/`: berkas model terlatih, tokenizer, scaler, atau checkpoint; diabaikan Git.
- `registry.json`: metadata model dan penunjuk model aktif; disimpan di Git.

Registry mencatat model mata yang diberikan pengguna, model wajah pretrained Google, tiga rencana model yang **belum dilatih**, dan dua modul algoritma. Metrik evaluasi tidak tersedia; tidak ada klaim training atau akurasi tim. Rencana model tidak menghasilkan inferensi dan tidak mempunyai artefak palsu.

Untuk demo kamera:

1. Sediakan `models/eye_detector.pt` (kelas OPEN/CLOSED).
2. Install `.venv/Scripts/python.exe -m pip install -e "./ai[vision]"`.
3. Jalankan `.venv/Scripts/python.exe scripts/setup-face-model.py` sekali untuk mengunduh model pretrained resmi dan memverifikasi checksum. Berkas `.task` diabaikan Git; setelah tersedia, demo tidak memerlukan download ulang.
4. Jalankan program, aktifkan kamera depan, dan tunggu minimal lima detik.

MediaPipe FaceLandmarker v1 membundel face detector, face mesh, dan blendshape. Sumber: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker. Bobot ini pretrained oleh Google, bukan dilatih di proyek ini. Environment variable `FACE_MODEL_PATH` dapat mengganti lokasi artefak.

Indikasi menguap memakai `jawOpen >= 0.5` selama minimal 1,5 detik; bukaan singkat tidak dihitung. Satu bukaan kontinu hanya dihitung sekali. Bukaan >=3 detik meningkatkan indeks kantuk menjadi minimal 70; dua/tiga indikasi pada jendela penilaian live menjadi 60/80. Nilai kantuk gabungan memakai nilai terbesar antara mata dan indikasi menguap, kemudian masuk skor bahaya perjalanan dan alarm otomatis sederhana tanpa level. Ini heuristik demo, bukan classifier menguap yang telah dilatih/diuji akurasinya; berbicara dengan mulut terbuka lama bisa menyerupai menguap. Mulut tertutup tanpa data mata tidak menandakan driver terjaga. Frame/jeda yang hilang memutus kontinuitas, dan kegagalan model wajah tidak menghentikan deteksi mata.

Deteksi live menunggu lima detik saat kamera baru aktif, menyaring kedipan singkat, dan memakai konfirmasi eyeBlink MediaPipe. Mata terbuka atau mulut tertutup stabil selama dua detik memulihkan indeks terkait; hitungan menguap 60 detik tetap dicatat. Rincian ada di `docs/JOURNEY-RISK.md`.
