# Models

- `artifacts/`: berkas model terlatih, tokenizer, scaler, atau checkpoint; diabaikan Git.
- `registry.json`: metadata model dan penunjuk model aktif; disimpan di Git.

Registry awal kosong, dengan `active_model: null`. Saat model tersedia, catat ID, versi, lokasi artefak, skema fitur, metrik evaluasi, dan tanggal training. Folder ini untuk model AI; definisi entitas database nantinya berada di backend.
