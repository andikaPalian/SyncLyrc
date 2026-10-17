from __future__ import annotations

from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import InvalidAudioError

import io
import numpy as np
import soundfile as sf

MAX_AUDIO_BYTES = 25 * 1024 * 1024

def decode_wav_16k_mono(raw_bytes: bytes) -> np.ndarray:
    """Decode in-memory WAV bytes and verify 16 kHz sample rate without FFmpeg."""
    if not raw_bytes or len(raw_bytes) < 44:
        raise InvalidAudioError("File audio kosong atau terlalu pendek.")
    if len(raw_bytes) > MAX_AUDIO_BYTES:
        raise InvalidAudioError("Ukuran audio melebihi batas 25 MB.")

    try:
        audio, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32", always_2d=True)
    except Exception as exc:
        raise InvalidAudioError(
            "Gagal membaca format WAV. Pastikan audio sudah dikonversi ke WAV PCM.",
            details=str(exc),
        ) from exc

    if sr != settings.sample_rate:
        raise InvalidAudioError(
            f"Sample rate wajib {settings.sample_rate} Hz (diterima {sr} Hz)."
        )

    mono = audio.mean(axis=1).astype(np.float32)
    if mono.size == 0:
        raise InvalidAudioError("Gelombang audio tidak memiliki sampel.")
    if not np.isfinite(mono).all():
        raise InvalidAudioError("Audio berisi sampel yang tidak valid.")
    return mono
