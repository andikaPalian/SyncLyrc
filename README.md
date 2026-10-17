# SyncLRC v3.1 — WhisperX Lokal (+ Opsi Akselerasi Groq) & React SPA

**SyncLRC** mengubah berkas audio (`mp3`, `wav`, `flac`, `m4a`) menjadi lirik ber-timestamp dalam format **LRC per kata** (`<mm:ss.xx>`) maupun **per kalimat** (`[mm:ss.xx]`), termasuk untuk lagu bahasa daerah (Toraja, Bugis, Makassar) dengan lirik manual melalui *forced alignment* `wav2vec2` di **WhisperX**.

---

## Dokumen Utama Proyek

- [**AGENTS.md**](./AGENTS.md) — Aturan wajib workspace (larangan menulis ke drive `C:`, kewajiban `.venv` di `D:`, dan standar arsitektur kode).
- [**docs/PRD.md**](./docs/PRD.md) — Product Requirements Document (PRD v3.1) lengkap beserta analisis revisi dari draf awal.
- [**docs/IMPLEMENTATION_PLAN.md**](./docs/IMPLEMENTATION_PLAN.md) — Rencana implementasi & arsitektur berlapis (*Clean Enterprise Architecture* v3.2).

---

## Fitur Utama

1. **Dua Mode Mesin Transkripsi (Tahap 1):**
   - **Mode Full Lokal (Default):** menggunakan `faster-whisper` (`int8` di CPU) + `whisperx.alignment` (`wav2vec2`) 100% di laptop tanpa perlu API key.
   - **Mode Hibrida Cepat (Opsional):** menggunakan **Groq Cloud** (`whisper-large-v3-turbo` / `whisper-large-v3`) untuk transkripsi ~2 detik, lalu **WhisperX lokal** untuk penyelarasan kata (`wav2vec2`).
2. **Penyelarasan Lirik Bahasa Daerah (Tahap 2):**
   - Penjajaran global *Needleman–Wunsch* tingkat kata untuk membangun jendela waktu tiap baris lirik.
   - Normalisasi & pemulihan karakter khusus bahasa daerah (seperti glottal stop / apostrof `to'`).
3. **Zero Drive `C:` Footprint:**
   - Seluruh `.venv`, paket `pip`/`npm`, file sementara (`TEMP`/`TMP`), dan model AI (`Hugging Face`, `PyTorch`, `NLTK`) dikunci di dalam `D:\synclyrc\`.
4. **Aplikasi Web Ringan (React 19 + Vite + TypeScript):**
   - Konversi audio ke WAV 16 kHz mono langsung di browser lewat Web Audio API (tanpa membutuhkan FFmpeg terinstal di sistem).
   - Editor interaktif & pemutar karaoke dengan sorotan kata *real-time*, koreksi timestamp, geser offset, dan penanda kualitas (`long_word`, `align_failed`, `interpolated_line`).

---

## Cara Menjalankan

### 1. Persiapan Worker Python di Drive `D:`
```powershell
powershell -ExecutionPolicy Bypass -File D:\synclyrc\worker\scripts\setup.ps1
```
Skrip ini otomatis membuat `.venv` di `D:\synclyrc\worker\.venv`, mengarahkan seluruh cache/`TEMP` ke `D:\synclyrc\worker\.cache`, dan menginstal dependensi.

### 2. Menjalankan Worker Lokal (`http://127.0.0.1:8765`)
```powershell
powershell -ExecutionPolicy Bypass -File D:\synclyrc\worker\scripts\run.ps1
```

### 3. Menjalankan / Membangun Aplikasi Web React (`D:\synclyrc\web`)
```powershell
cd D:\synclyrc\web
$env:npm_config_cache = "D:\synclyrc\.cache\npm"
npm install
npm run dev
```
Atau jalankan `npm run build` agar aplikasi web disajikan langsung oleh Worker di `http://127.0.0.1:8765`.
