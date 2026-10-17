from __future__ import annotations

from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import GpuExecutionError, ModelLoadError
from synclrc_worker.schemas.device import ProcessingDevice
from synclrc_worker.services.device_service import require_device, whisper_compute_type
from synclrc_worker.core.logging import logger
from synclrc_worker.schemas.transcription import (
    TranscribeResponse,
    TranscribedSegmentItem,
    TranscribedWordItem,
)

import time
from threading import Lock
import numpy as np

_WHISPER_REGISTRY: dict[tuple[str, str], object] = {}
_MODEL_LOCK = Lock()


def loaded_whisper_models() -> list[str]:
    return [f"{model}@{device}" for model, device in list(_WHISPER_REGISTRY)]


def _get_whisper_model(model_size: str, device: ProcessingDevice = "cpu"):
    require_device(device)
    key = (model_size, device)
    with _MODEL_LOCK:
        if key not in _WHISPER_REGISTRY:
            try:
                from faster_whisper import WhisperModel

                _WHISPER_REGISTRY.clear()
                logger.info("Loading faster-whisper '%s' on %s from %s", model_size, device, settings.whisper_models_dir)
                _WHISPER_REGISTRY[key] = WhisperModel(
                    model_size, device=device, compute_type=whisper_compute_type(device),
                    download_root=str(settings.whisper_models_dir),
                )
            except Exception as exc:
                if device == "cuda":
                    raise GpuExecutionError(exc) from exc
                raise ModelLoadError(f"Gagal memuat model faster-whisper '{model_size}'.", details=str(exc)) from exc
        return _WHISPER_REGISTRY[key]


def transcribe_audio(
    audio: np.ndarray,
    language: str = "id",
    model_size: str = "small",
    prompt: str | None = None,
    device: ProcessingDevice = "cpu",
) -> TranscribeResponse:
    t0 = time.perf_counter()
    model = _get_whisper_model(model_size, device)
    lang_arg = language if language in ("id", "en") else "id"

    try:
        segments_gen, info = model.transcribe(
            audio,
            language=lang_arg,
            initial_prompt=prompt or None,
            word_timestamps=True,
            vad_filter=True,
            temperature=0.0,
        )

        segments: list[TranscribedSegmentItem] = []
        words: list[TranscribedWordItem] = []
        full_texts: list[str] = []

        for idx, seg in enumerate(segments_gen):
            seg_text = (seg.text or "").strip()
            if seg_text:
                full_texts.append(seg_text)
            segments.append(
                TranscribedSegmentItem(
                    id=idx,
                    start=round(float(seg.start), 3),
                    end=round(float(seg.end), 3),
                    text=seg_text,
                    avg_logprob=round(float(getattr(seg, "avg_logprob", 0.0)), 4),
                    no_speech_prob=round(float(getattr(seg, "no_speech_prob", 0.0)), 4),
                )
            )
            for w in getattr(seg, "words", None) or []:
                w_text = (w.word or "").strip()
                if w_text:
                    words.append(
                        TranscribedWordItem(
                            word=w_text,
                            start=round(float(w.start), 3),
                            end=round(float(w.end), 3),
                            probability=round(float(getattr(w, "probability", 1.0)), 3),
                        )
                    )

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        duration_sec = round(float(audio.shape[0]) / settings.sample_rate, 3)

        return TranscribeResponse(
            text=" ".join(full_texts),
            language=getattr(info, "language", lang_arg) or lang_arg,
            duration_seconds=duration_sec,
            model_used=f"local:faster-whisper-{model_size}",
            processing_ms=elapsed_ms,
            segments=segments,
            words=words,
        )

    except Exception as exc:
        if device == "cuda":
            raise GpuExecutionError(exc) from exc
        raise
