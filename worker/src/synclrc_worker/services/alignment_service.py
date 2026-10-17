from __future__ import annotations

from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import GpuExecutionError, ModelLoadError
from synclrc_worker.schemas.device import ProcessingDevice
from synclrc_worker.services.device_service import require_device
from synclrc_worker.core.logging import logger
from synclrc_worker.schemas.alignment import (
    AlignLineInput,
    AlignedLineResult,
    AlignedWordItem,
    AlignResponse,
)

import re
import time
import unicodedata
from threading import Lock
import numpy as np

_ALIGN_REGISTRY: dict[tuple[str, str, str], tuple[object, dict]] = {}
_MODEL_LOCK = Lock()

_APOSTROPHE_RE = re.compile(r"['’`ʼʻ]")
_NON_WORD_RE = re.compile(r"[^\w\s-]", flags=re.UNICODE)
_MULTI_SPACE_RE = re.compile(r"\s+")


def loaded_align_models() -> list[str]:
    return [f"{lang}:{name}@{device}" for lang, name, device in list(_ALIGN_REGISTRY)]


def normalize_token_for_alignment(token: str) -> str:
    """Normalize regional lyric token (glottal stops, diacritics, punctuation) for wav2vec2."""
    nfd = unicodedata.normalize("NFD", token)
    without_marks = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    cleaned = _APOSTROPHE_RE.sub("", without_marks.lower())
    cleaned = _NON_WORD_RE.sub("", cleaned).replace("_", "")
    return cleaned.strip()


def prepare_line_for_alignment(line_text: str) -> tuple[list[str], list[str], str]:
    """Return (original_tokens, normalized_tokens, normalized_sentence)."""
    raw_tokens = [tok for tok in _MULTI_SPACE_RE.split(line_text.strip()) if tok]
    orig_kept: list[str] = []
    norm_kept: list[str] = []
    for tok in raw_tokens:
        norm = normalize_token_for_alignment(tok)
        if norm:
            orig_kept.append(tok)
            norm_kept.append(norm)
    return orig_kept, norm_kept, " ".join(norm_kept)


def restore_original_tokens(
    original_tokens: list[str], aligned_words: list[dict]
) -> list[AlignedWordItem]:
    """Map aligned wav2vec2 words back to user's original regional spelling/punctuation."""
    if not aligned_words or len(aligned_words) != len(original_tokens):
        return []

    restored: list[AlignedWordItem] = []
    for orig, w in zip(original_tokens, aligned_words):
        if "start" not in w or "end" not in w or w["start"] is None or w["end"] is None:
            return []
        start_val = round(float(w["start"]), 3)
        end_val = round(max(float(w["end"]), start_val + 0.02), 3)
        score_val = round(float(w.get("score") if w.get("score") is not None else 1.0), 3)
        restored.append(
            AlignedWordItem(word=orig, start=start_val, end=end_val, score=score_val)
        )
    return restored


def _ensure_nltk_punkt() -> None:
    import nltk

    nltk_dir = str(settings.nltk_data_dir)
    if nltk_dir not in nltk.data.path:
        nltk.data.path.insert(0, nltk_dir)
    try:
        nltk.data.find("tokenizers/punkt_tab")
    except LookupError:
        logger.info("Downloading NLTK punkt_tab to %s", nltk_dir)
        if not nltk.download("punkt_tab", download_dir=nltk_dir, quiet=True):
            raise ModelLoadError("Gagal mengunduh tokenizer NLTK. Periksa koneksi internet.")


def _get_align_model(language: str, model_name: str | None = None, device: ProcessingDevice = "cpu") -> tuple[object, dict, str]:
    require_device(device)
    eff_lang = language if language in ("id", "en") else "id"
    eff_model = model_name or (
        settings.default_align_model_id if eff_lang == "id" else "WAV2VEC2_ASR_BASE_960H"
    )
    key = (eff_lang, eff_model, device)
    with _MODEL_LOCK:
        if key not in _ALIGN_REGISTRY:
            try:
                _ensure_nltk_punkt()
                from whisperx.alignment import load_align_model

                _ALIGN_REGISTRY.clear()
                logger.info("Loading WhisperX '%s' (%s) on %s into %s", eff_model, eff_lang, device, settings.wav2vec2_models_dir)
                model, meta = load_align_model(
                    language_code=eff_lang, device=device, model_name=eff_model,
                    model_dir=str(settings.wav2vec2_models_dir),
                )
                _ALIGN_REGISTRY[key] = (model, meta)
            except Exception as exc:
                logger.exception("Failed to load alignment model '%s'", eff_model)
                if device == "cuda":
                    raise GpuExecutionError(exc) from exc
                raise ModelLoadError(f"Gagal memuat model alignment '{eff_model}'.", details=str(exc)) from exc
        model, meta = _ALIGN_REGISTRY[key]
        return model, meta, eff_model


def align_lyric_lines(
    audio: np.ndarray,
    lines: list[AlignLineInput],
    language: str = "id",
    align_model: str | None = None,
    device: ProcessingDevice = "cpu",
) -> AlignResponse:
    t0 = time.perf_counter()
    model, metadata, model_used = _get_align_model(language, align_model, device)
    from whisperx.alignment import align

    audio_duration = float(audio.shape[0]) / settings.sample_rate
    results: list[AlignedLineResult] = []

    for idx, line in enumerate(lines):
        orig_tokens, _, norm_sentence = prepare_line_for_alignment(line.text)
        if not orig_tokens or line.end <= line.start:
            results.append(AlignedLineResult(index=idx, aligned=False, words=[]))
            continue

        seg_start = min(float(line.start), audio_duration)
        seg_end = min(float(line.end), audio_duration)
        if seg_end - seg_start < 0.02:
            results.append(AlignedLineResult(index=idx, aligned=False, words=[]))
            continue

        try:
            aligned_out = align(
                [{"text": norm_sentence, "start": seg_start, "end": seg_end}],
                model,
                metadata,
                audio,
                device,
                return_char_alignments=False,
            )
            raw_words = [
                w
                for seg in aligned_out.get("segments", [])
                for w in seg.get("words", [])
            ]
            restored_words = restore_original_tokens(orig_tokens, raw_words)
            results.append(
                AlignedLineResult(
                    index=idx,
                    aligned=bool(restored_words),
                    words=restored_words,
                )
            )
        except Exception as exc:
            if device == "cuda":
                raise GpuExecutionError(exc) from exc
            logger.warning("Line %d alignment failed: %s", idx, exc)
            results.append(AlignedLineResult(index=idx, aligned=False, words=[]))

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    return AlignResponse(
        lines=results,
        model_used=model_used,
        processing_ms=elapsed_ms,
        separated=False,
    )
