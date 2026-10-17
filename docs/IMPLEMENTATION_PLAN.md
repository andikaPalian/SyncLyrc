# Rencana Implementasi SyncLRC v3.2 (Clean Enterprise Architecture)

Membangun aplikasi **SyncLRC** sesuai [PRD.md](./PRD.md) dengan tiga pilar utama:
1. **Arsitektur Berlapis & Modular (Clean Layered Architecture)**: pemisahan tegas antara *Domain Logic* (fungsi murni tanpa efek samping), *Services/Infrastructure* (API, worker, cache), dan *Presentation* (React Hooks & UI Components; FastAPI Routers & Pydantic Schemas).
2. **Fleksibilitas Mesin (Strategy Pattern)**: mendukung **Mode Full Lokal** (`faster-whisper` + `whisperx.alignment` di laptop, tanpa API key) sebagai default, serta **Mode Hibrida** (`Groq Cloud` + `whisperx.alignment` lokal) lewat kontrak `TranscriptionProvider` yang seragam.
3. **Zero Drive `C:` Footprint (3 Lapis Proteksi)**: `.venv`, paket Python/Node, file `TEMP`, dan seluruh model AI (`wav2vec2`, `faster-whisper`, `nltk`, `torch`) dikunci 100% di `D:\synclyrc\`.

---

## Standar Arsitektur & Kualitas Kode

- **Layered Architecture & Single Responsibility**: tidak ada logika bisnis atau panggilan API yang dicampur di dalam komponen React atau route handler FastAPI. Maksimal ±200 baris per file agar selalu mudah dibaca.
- **Contract-First & Strict Typing**: TypeScript `strict: true` (tanpa `any`) di frontend, serta Python *type annotations* + **Pydantic v2** schemas di backend.
- **Consistent Error Semantics**: seluruh error dari worker dan service mengikuti bentuk standar `{ error: { code, message, details } }`.
- **Pure Domain Layer**: seluruh algoritma inti (encoder WAV, normalisasi teks daerah, penjajaran kata Needleman–Wunsch, filter halusinasi, parser/formatter LRC) ditulis sebagai *pure functions* bebas DOM/React sehingga mudah dipahami dan diuji unit 100%.

---

## Struktur Proyek (Modern Enterprise Layout)

```text
D:\synclyrc
├─ AGENTS.md                               # Aturan wajib workspace (.venv, Drive D:, standar arsitektur)
├─ README.md                               # Dokumentasi arsitektur, cara menjalankan, dan panduan kontribusi
├─ .gitignore
├─ docs/
│  ├─ PRD.md                               # Dokumen Kebutuhan Produk (PRD v3.1)
│  └─ IMPLEMENTATION_PLAN.md               # Dokumen Rencana Implementasi & Arsitektur (v3.2)
│
├─ web/                                    # Frontend: React 19 + Vite + TypeScript (Strict)
│  ├─ package.json
│  ├─ tsconfig.json                        # strict: true, path alias "@/*" -> "src/*"
│  ├─ vite.config.ts
│  ├─ index.html
│  └─ src/
│     ├─ main.tsx                          # Entrypoint aplikasi
│     ├─ App.tsx                           # Komposisi halaman utama
│     ├─ types/                            # Kontrak tipe terpusat (Contract-First)
│     │  ├─ domain.ts                      # WordTimestamp, LyricLine, AlignmentWindow, QualityFlag
│     │  ├─ lrc.ts                         # LrcMetadata, LrcDocument, LrcMode
│     │  └─ api.ts                         # Kontrak request/response Worker & Groq, AppError
│     ├─ domain/                           # Pure Business Logic (0 ketergantungan ke React/IO)
│     │  ├─ audio/
│     │  │  ├─ wavEncoder.ts               # Encode Float32Array PCM -> RIFF WAV 16-bit
│     │  │  └─ hash.ts                     # SHA-256 fingerprint untuk cache key
│     │  ├─ lyrics/
│     │  │  ├─ normalizer.ts               # Normalisasi NFD, apostrof bahasa daerah, tokenisasi
│     │  │  ├─ matcher.ts                  # Penjajaran global Needleman-Wunsch & interpolasi jendela
│     │  │  ├─ hallucinationFilter.ts      # Deteksi & filter segmen halusinasi Whisper
│     │  │  └─ qualityFlags.ts             # Deteksi long_word (>5s), align_failed, interpolated_line
│     │  └─ lrc/
│     │     ├─ formatter.ts                # Generator LRC per kata (<mm:ss.xx>) & per kalimat
│     │     └─ parser.ts                   # Parser teks LRC -> LrcDocument terstruktur
│     ├─ services/                         # Infrastructure & External Adapters
│     │  ├─ audio/
│     │  │  └─ audioDecoderService.ts      # Web Audio API decode & OfflineAudioContext 16 kHz mono
│     │  ├─ transcription/                 # Strategy Pattern untuk Tahap 1 (Transkripsi)
│     │  │  ├─ transcriptionProvider.ts    # Interface TranscriptionProvider
│     │  │  ├─ localWhisperProvider.ts     # Adapter ke Worker POST /api/v1/transcribe
│     │  │  └─ groqWhisperProvider.ts      # Adapter ke Groq Cloud + auto-fallback 429
│     │  ├─ alignment/
│     │  │  └─ workerAlignmentClient.ts    # Klien HTTP ke Worker (/health, /align)
│     │  ├─ storage/
│     │  │  ├─ lrcCacheRepository.ts       # Penyimpanan LRC berbasis IndexedDB
│     │  │  └─ settingsRepository.ts       # Penyimpanan konfigurasi di localStorage
│     │  └─ pipeline/
│     │     └─ syncLrcPipeline.ts          # Orkestrator alur end-to-end dengan pelaporan progres
│     ├─ hooks/                            # State Management & Pengikat UI
│     │  ├─ useSyncPipeline.ts
│     │  ├─ useAudioKaraoke.ts
│     │  ├─ useWorkerHealth.ts
│     │  └─ useAppSettings.ts
│     ├─ components/                       # Komponen UI Modular (Presentational)
│     │  ├─ common/                        # Button, Badge, Alert, ProgressBar, Card
│     │  ├─ layout/                        # AppHeader, StatusBanner
│     │  ├─ workspace/                     # AudioDropzone, LyricsInputPanel, PipelineControls
│     │  ├─ editor/                        # LyricLineRow, WordChipEditor, OffsetToolbar
│     │  ├─ player/                        # KaraokeAudioPlayer (sorotan kata real-time)
│     │  └─ settings/                      # SettingsDrawer (Engine mode, model size, Groq key)
│     ├─ styles/
│     │  └─ index.css                      # Desain sistem CSS modern berbasis variabel (clean dark/light UI)
│     └─ __tests__/                        # Unit test Vitest untuk seluruh modul domain & pipeline
│        ├─ normalizer.test.ts
│        ├─ matcher.test.ts
│        ├─ hallucinationFilter.test.ts
│        ├─ lrcFormatterParser.test.ts
│        └─ wavEncoder.test.ts
│
├─ worker/                                 # Backend Worker Lokal: Python 3.12 (src-layout standar)
│  ├─ pyproject.toml                       # Metadata paket, konfigurasi pytest & ruff
│  ├─ requirements.txt                     # Dependensi terkunci (CPU wheel PyTorch, FastAPI, dll.)
│  ├─ scripts/                             # Otomasi & Penjaga Aturan Drive D:
│  │  ├─ env.ps1                           # Pengarah seluruh cache & TEMP ke D:\synclyrc\worker\.cache
│  │  ├─ setup.ps1                         # Pembuat .venv di D: + injeksi Activate.ps1 + instalasi paket
│  │  ├─ run.ps1                           # Menjalankan server Uvicorn dari .venv
│  │  ├─ test.ps1                          # Menjalankan pytest dari .venv
│  │  └─ evaluate.py                       # Evaluasi akurasi LRC terhadap referensi (Gerbang Fase 1)
│  ├─ src/
│  │  └─ synclrc_worker/
│  │     ├─ __init__.py                    # Memuat core.config paling awal sebelum import ML
│  │     ├─ main.py                        # FastAPI Application Factory (create_app)
│  │     ├─ core/
│  │     │  ├─ config.py                   # Penguncian os.environ ke D:\synclyrc\worker\.cache
│  │     │  ├─ exceptions.py               # WorkerError hierarchy & exception handler seragam
│  │     │  └─ logging.py                  # Konfigurasi structured logging
│  │     ├─ schemas/                       # Kontrak API dengan Pydantic v2
│  │     │  ├─ common.py                   # ErrorResponse, HealthResponse
│  │     │  ├─ transcription.py            # TranscribeRequest, TranscribeResponse, WordItem, SegmentItem
│  │     │  └─ alignment.py                # AlignLineInput, AlignResponse, AlignedLineResult
│  │     ├─ services/                      # Business & ML Services (Lazy Singleton Registry)
│  │     │  ├─ audio_service.py            # Validasi & baca WAV 16 kHz mono di memori (soundfile)
│  │     │  ├─ transcription_service.py    # faster-whisper (CPU int8, download_root di D:)
│  │     │  └─ alignment_service.py        # whisperx.alignment (wav2vec2, model_dir di D:)
│  │     └─ api/
│  │        ├─ router.py                   # Penggabung router /api/v1
│  │        └─ routes/
│  │           ├─ health.py                # GET /api/v1/health (termasuk info disk D: & C:)
│  │           ├─ transcribe.py            # POST /api/v1/transcribe
│  │           └─ align.py                 # POST /api/v1/align
│  └─ tests/                               # Pengujian otomatis Worker (pytest)
│     ├─ conftest.py
│     ├─ test_config_paths.py              # Memastikan semua env cache menunjuk ke D:\
│     ├─ test_audio_service.py
│     ├─ test_alignment_text_restore.py
│     └─ test_api_health.py
│
└─ reference/                              # (gitignored) Tempat menaruh lagu & LRC referensi Toraja/Indonesia
```
