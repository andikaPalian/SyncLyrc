# SyncLyrc

SyncLyrc membuat lirik bertimestamp dari file audio atau link audio langsung. Hasilnya dapat diedit, diputar untuk meninjau waktu setiap kata, lalu diunduh sebagai **LRC per kata** atau **LRC per kalimat**.

Transkripsi lokal menggunakan **faster-whisper** untuk mengenali teks, kemudian **WhisperX / wav2vec2** menyelaraskan kata dengan audio. Laptop tanpa GPU NVIDIA tetap dapat memakai **CPU**. GPU **NVIDIA CUDA** bersifat opsional dan harus dipilih setelah instalasinya siap.

## Kemampuan dan batasan

- Transkripsi otomatis untuk bahasa Indonesia dan Inggris.
- Lirik manual untuk mempertahankan ejaan dan susunan baris, termasuk pilihan Toraja, Bugis, dan Makassar. Bahasa daerah menggunakan pendekatan alignment Indonesia; akurasinya perlu ditinjau.
- Pilihan model lokal `small`, `medium`, dan `large-v3-turbo`.
- Input MP3, WAV, FLAC, atau M4A yang dapat dibaca browser; konversi ke WAV 16 kHz mono dilakukan di browser tanpa instalasi FFmpeg terpisah untuk alur web ini.
- Link harus langsung menuju file audio publik, maksimal 25 MB. Halaman YouTube/Spotify, URL dengan autentikasi, dan alamat jaringan lokal tidak didukung.
- WAV hasil konversi juga dibatasi 25 MB, sekitar 13 menit. File terkompresi yang kecil masih bisa melewati batas ini setelah dikonversi.
- Editor timestamp, pemutar dengan sorotan kata, koreksi waktu, penggeseran offset, dan ekspor LRC.
- Mode lokal tidak membutuhkan API key. Internet diperlukan untuk instalasi, unduhan model/tokenizer pertama, dan mengambil audio dari link. Setelah model yang diperlukan tersedia, file lokal dapat diproses tanpa internet.
- Mode Groq opsional mengirim audio ke layanan Groq untuk transkripsi; alignment tetap berjalan lokal. API key disimpan di browser, bukan diperlukan untuk mode lokal.

Musik, vokal bertumpuk, dan instrumen keras dapat menyebabkan teks atau waktu keliru. Periksa hasil sebelum digunakan. Baris yang gagal alignment ditandai untuk ditinjau dan memakai timestamp per kalimat.

Pada mode audio + lirik manual, gunakan teks dari lagu dan versi audio yang sama, termasuk urutan pengulangan chorus. Pencocokan memakai urutan transkripsi dan membagi jeda antarbagian yang terdeteksi; baris tanpa pasangan yang cukup tetap ditandai untuk ditinjau. Untuk Indonesia/Inggris, ketidakcocokan yang sangat besar dihentikan sebelum alignment agar tidak menghasilkan waktu kata yang menyesatkan. Periksa transkripsi otomatis atau pilihan model jika pesan ini muncul.

Hasil disimpan dan diekspor dengan urutan baris serta batas waktu kata yang tidak melewati baris berikutnya atau durasi audio. Jika waktu kata tidak dapat dipertahankan, teks tetap disertakan sebagai per kalimat. Perubahan waktu di editor diperiksa dengan aturan yang sama. Ini menjaga format LRC; tidak menjamin ketepatan pengenalan terhadap seluruh jenis vokal. Gunakan audio yang sama dengan audio di platform tujuan saat meninjau waktu.

## Persyaratan laptop

Panduan ini untuk **Windows 64-bit dan PowerShell**. Versi saat ini memakai path tetap **`D:\synclyrc`** pada skrip dan konfigurasi. Laptop lain harus memiliki drive `D:` dan menempatkan proyek di lokasi yang sama. Lokasi lain, Linux, dan macOS belum didukung oleh skrip ini tanpa penyesuaian kode.

Siapkan:

1. [Git](https://git-scm.com/downloads/win).
2. [Python 3.12 64-bit](https://www.python.org/downloads/release/python-31210/) — diuji dengan 3.12.10. Saat instalasi, aktifkan Python Launcher (`py`); gunakan instalasi khusus ke drive D: bila ingin menempatkan interpreter di sana juga.
3. [Node.js](https://nodejs.org/en/download) 22 atau 24 beserta npm.
4. Browser Edge atau Chrome terbaru.
5. Ruang kosong beberapa belas GB di D: untuk paket, cache unduhan, dan model; kebutuhan bertambah sesuai model yang dipakai. RAM 16 GB menjadi titik awal praktis, bukan jaminan semua model/audio muat.
6. Khusus GPU: NVIDIA yang mendukung CUDA, driver yang kompatibel dengan CUDA 12.6, dan VRAM yang cukup. Laptop Intel/AMD tanpa GPU NVIDIA menggunakan CPU pada implementasi ini.

Python, Node.js, Git, dan browser adalah prasyarat sistem. Cache paket, model, dan file sementara milik proyek diarahkan ke D: oleh `worker\scripts\env.ps1`; pengaturan ini tidak memindahkan cache atau instalasi aplikasi lain di Windows.

## Instalasi pertama kali

### 1. Clone proyek

Buka PowerShell:

```powershell
git clone https://github.com/andikaPalian/SyncLyrc.git D:\synclyrc
cd D:\synclyrc
```

Jika proyek sudah tersedia di lokasi tersebut, gunakan folder yang ada. Jangan menyalin `.venv` atau `node_modules` dari laptop lain; buat environment dan instal dependensi di laptop tujuan.

### 2. Buat environment Python di D:

Buka sesi PowerShell tanpa profil agar profil pribadi tidak mengubah lingkungan instalasi. Bypass berikut hanya berlaku untuk sesi ini:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass
cd D:\synclyrc
. D:\synclyrc\worker\scripts\env.ps1
```

Pada laptop baru yang **belum memiliki** `worker\.venv`, lakukan bootstrap environment satu kali menggunakan Python yang sudah terinstal:

```powershell
py -3.12 -m venv D:\synclyrc\worker\.venv
```

Perintah bootstrap hanya membuat environment, bukan memasang paket proyek ke Python global. Setelah itu semua perintah Python/pip proyek menggunakan **`D:\synclyrc\worker\.venv\Scripts\python.exe`**. `setup.ps1` sengaja berhenti jika `.venv` belum dibuat. Jika `py` tidak dikenali, periksa instalasi Python Launcher atau buat environment dengan fitur virtual environment IDE pada path yang sama. Lihat [dokumentasi resmi venv](https://docs.python.org/3.12/library/venv.html).

### 3. Pilih instalasi CPU atau GPU

Jalankan **salah satu** pilihan di bawah, sesuai laptop. Tidak perlu memasang CPU lebih dahulu jika langsung memilih GPU.

| Pilihan | Untuk siapa | Paket PyTorch |
| --- | --- | --- |
| CPU | Semua laptop yang memenuhi prasyarat, termasuk tanpa GPU NVIDIA | PyTorch CPU |
| GPU / CUDA | Laptop NVIDIA dengan driver CUDA dan VRAM yang memadai | PyTorch CUDA 12.6; CPU tetap dapat dipilih |

**CPU:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\synclyrc\worker\scripts\setup.ps1 -Device cpu
```

**GPU NVIDIA / CUDA:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\synclyrc\worker\scripts\setup.ps1 -Device cuda
```

Setup memasang WhisperX beserta dependensinya ke `.venv`. Pilihan CUDA memakai PyTorch 2.8.0, torchaudio 2.8.0, dan torchvision 0.23.0 dari indeks resmi `cu126`, sesuai [kombinasi versi PyTorch](https://pytorch.org/get-started/previous-versions/#v280). Unduhan CUDA sekitar 2,9 GB untuk paket torch saja; instalasi dan cache memerlukan ruang tambahan. Setup memakai cache dan `TEMP` di `D:\synclyrc\worker\.cache`.

Pada Windows, library CUDA yang dibutuhkan CTranslate2 dicari pada `torch\lib` milik environment tersebut. Worker memeriksa PyTorch CUDA, cuBLAS/cuDNN, dan operasi GPU sebelum mengaktifkan pilihan GPU; lihat [persyaratan GPU faster-whisper](https://github.com/SYSTRAN/faster-whisper#gpu). Tidak perlu memasang CUDA Toolkit terpisah untuk jalur wheel ini jika seluruh pemeriksaan berhasil. Driver NVIDIA tetap harus tersedia dan kompatibel.

Untuk mengganti CPU ↔ CUDA setelah pernah menginstal, hentikan worker dengan **Ctrl+C**, jalankan kembali perintah setup pilihan tujuan, lalu mulai ulang worker. Jangan menjalankan setup CPU setelah setup CUDA kecuali memang ingin mengganti paket kembali menjadi CPU.

### 4. Instal dan build antarmuka

Di sesi PowerShell yang sama:

```powershell
. D:\synclyrc\worker\scripts\env.ps1
cd D:\synclyrc\web
npm ci
npm run build
```

`npm ci` memakai `package-lock.json`. Hasil build berada di `web\dist` dan akan disajikan oleh worker. Jika salah satu perintah gagal, perbaiki error tersebut sebelum melanjutkan.

### 5. Jalankan SyncLyrc lokal

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\synclyrc\worker\scripts\run.ps1
```

Biarkan terminal ini terbuka. Setelah muncul `Uvicorn running on http://127.0.0.1:8765`, buka **[http://127.0.0.1:8765](http://127.0.0.1:8765)** di browser. Ini menjalankan worker dan antarmuka dari satu alamat; tidak perlu `npm run dev` untuk penggunaan biasa. Worker hanya mendengarkan alamat lokal laptop.

Untuk berhenti, tekan **Ctrl+C** di terminal worker. Menutup tab browser saja tidak menghentikan worker.

## Pemakaian sehari-hari

Setelah instalasi pertama selesai, cukup jalankan kembali:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\synclyrc\worker\scripts\run.ps1
```

Lalu buka [SyncLyrc lokal](http://127.0.0.1:8765). Tidak perlu mengulang setup atau build setiap kali memakai aplikasi.

1. Buka **Pengaturan**. Pilih sumber transkripsi **Lokal**, model, dan perangkat **CPU** atau **GPU NVIDIA (CUDA)**, lalu **Simpan & Tutup**. CPU adalah pilihan awal, termasuk setelah instalasi CUDA. Pilihan disimpan di browser masing-masing.
2. Pilih file audio, atau tempel link file audio langsung lalu tekan tombol panah **Muat audio dari link**.
3. Pilih bahasa lagu dan format timestamp **Per kata** atau **Per kalimat**.
4. Kosongkan lirik manual untuk mengenali teks otomatis. Untuk mempertahankan lirik asli, isi satu baris lirik per baris. Transkripsi tetap dipakai untuk membantu menentukan jendela waktu, lalu WhisperX menyelaraskan lirik manual tersebut.
5. Isi informasi lagu bila perlu, lalu klik **Buat LRC**. Pertama kali model digunakan, worker mengunduh model transkripsi serta model alignment bahasa yang dipilih ke D:. Jangan menutup terminal saat proses berlangsung.
6. Putar audio, tinjau sorotan kata dan bagian bertanda, lalu sesuaikan waktu di editor. Tab **Teks LRC** memperlihatkan hasil ekspor.
7. Klik **Unduh LRC**. Format keluaran dapat diganti setelah hasil tersedia tanpa mengulang transkripsi. Tombol **Proses ulang** di sebelah **Buat LRC** melewati hasil tersimpan.

Pengaturan lanjutan menyediakan ambang penandaan kata panjang dan jeda instrumental. Ambang tersebut membantu peninjauan/format ekspor; bukan pengaturan akurasi model.

### Memilih model dan perangkat

| Model | Ukuran unduhan perkiraan | Pertimbangan |
| --- | --- | --- |
| `small` | 460 MB | Pilihan awal untuk mengurangi beban CPU dan VRAM |
| `medium` | 1,5 GB | Lebih berat; waktu proses CPU dapat lama |
| `large-v3-turbo` | 1,6 GB | Dapat memakai GPU, tetapi kebutuhan VRAM lebih besar daripada ukuran unduhan |

Model alignment Indonesia dan Inggris diunduh terpisah dari model transkripsi. Model besar tidak menjamin lirik selalu benar. Kebutuhan RAM/VRAM juga bergantung pada panjang segmen audio dan aplikasi lain yang sedang berjalan.

GPU hanya tersedia jika pemeriksaan worker berhasil; jika belum siap, alasannya muncul di **Pengaturan**. Klik **Periksa perangkat** setelah memperbaiki instalasi dan me-restart worker. Jika GPU kehabisan memori, gunakan `small` atau pilih CPU. Kegagalan GPU **tidak otomatis dialihkan ke CPU**. Hasil cache dibedakan berdasarkan model dan perangkat.

Pada laptop pengembangan, `small` dan `large-v3-turbo` berhasil diuji di NVIDIA RTX 2050 4 GB, dengan alignment Indonesia/Inggris dan satu segmen sintetis sekitar 30 detik. Ini bukan jaminan seluruh lagu panjang muat di VRAM 4 GB atau hasil pengenalannya selalu akurat.

### Mode Groq opsional

Pilih **Groq** pada sumber transkripsi dan isi API key di **Pengaturan**. Audio akan dikirim ke Groq; internet dan kuota layanan diperlukan. Model lokal tidak dipakai untuk tahap transkripsi ini, tetapi worker lokal tetap wajib berjalan untuk alignment WhisperX. Pilihan CPU/GPU berlaku untuk alignment. Mode lokal tetap tersedia tanpa API key.

## Jika terjadi masalah

| Gejala | Langkah pemeriksaan |
| --- | --- |
| `.venv` belum tersedia | Selesaikan bootstrap pada langkah 2, lalu ulangi setup. Jangan memakai pip global. |
| `python`, `py`, `node`, `npm`, atau `git` tidak dikenali | Periksa instalasi dan PATH prasyarat, lalu buka terminal baru. |
| Skrip PowerShell diblokir | Gunakan perintah `powershell -NoProfile -ExecutionPolicy Bypass ...` di panduan; tidak perlu mengubah execution policy secara permanen. |
| Halaman kosong atau `/` mengembalikan 404 | Jalankan `npm ci` dan `npm run build` di `D:\synclyrc\web`, lalu mulai ulang worker. Jangan membuka `index.html` lewat `file://`. |
| Worker tidak terhubung | Pastikan terminal worker masih aktif, lalu buka [health](http://127.0.0.1:8765/api/v1/health). Alamat worker di Pengaturan harus `http://127.0.0.1:8765`. |
| `WinError 10048` / port 8765 dipakai | Jika SyncLyrc sudah terbuka pada alamat lokal, gunakan worker yang sudah berjalan. Jika ingin restart, hentikan instance sebelumnya dengan Ctrl+C. Jangan menjalankan dua worker pada port yang sama. |
| GPU belum tersedia | Hentikan worker, pastikan setup `-Device cuda` berhasil dan driver NVIDIA kompatibel, lalu mulai ulang worker dan klik **Periksa perangkat**. Tanpa dukungan CUDA, pilih CPU. |
| `GPU_OUT_OF_MEMORY` | Tutup aplikasi lain yang memakai GPU, pilih `small`, atau ganti ke CPU. |
| DLL / `WinError 126` saat import PyTorch | Periksa [Microsoft Visual C++ Redistributable x64](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170), hasil setup, dan kompatibilitas driver. Baca nama DLL pada error di terminal. |
| Proses pertama lama | Model/tokenizer mungkin masih diunduh. Periksa terminal dan koneksi internet. Pemrosesan model besar di CPU juga dapat memerlukan beberapa menit. |
| Link audio gagal | Gunakan link HTTP/HTTPS file audio publik langsung, maksimal 25 MB; bukan halaman YouTube/Spotify atau jaringan lokal. |
| Audio melebihi 25 MB setelah konversi | Potong audio menjadi bagian lebih pendek. Batas diperiksa juga pada WAV hasil konversi. |
| Lirik salah atau kata tidak selaras | Koreksi lirik manual dan proses ulang. Gunakan editor untuk memperbaiki timestamp; akurasi pada musik bervariasi. |

## Pengembangan dan pemeriksaan

Untuk mengembangkan frontend dengan hot reload, jalankan worker seperti biasa, lalu buka terminal kedua:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass
. D:\synclyrc\worker\scripts\env.ps1
cd D:\synclyrc\web
npm run dev
```

Buka alamat Vite yang ditampilkan terminal, biasanya `http://localhost:5173`. Worker tetap menggunakan port 8765. Setelah mengubah frontend, jalankan `npm run build` lagi untuk memperbarui halaman yang disajikan worker.

Pemeriksaan dependensi, tes, dan build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass
. D:\synclyrc\worker\scripts\env.ps1
& D:\synclyrc\worker\.venv\Scripts\python.exe -m pip check
& D:\synclyrc\worker\.venv\Scripts\python.exe -m pytest D:\synclyrc\worker\tests -q -p no:cacheprovider
cd D:\synclyrc\web
npm test
npm run build
```

Struktur utama:

```text
web/src/                         React + TypeScript: UI, hooks, domain, services
worker/src/synclrc_worker/        FastAPI: konfigurasi, API, transkripsi, alignment
worker/scripts/                  Setup, lingkungan D:, dan runner lokal
worker/tests/                    Tes backend
web/src/__tests__/               Tes frontend
reference/README.md              Panduan data uji pribadi
```

`.venv`, `node_modules`, hasil build, cache/model, log, `.env` pribadi, dan skill agen lokal tidak dikirim ke Git. `web/package-lock.json` serta kode sumber dan tes tetap disertakan agar laptop lain dapat melakukan instalasi sendiri.
