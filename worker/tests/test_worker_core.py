from __future__ import annotations

from synclrc_worker.core.config import ENV_LOCK, settings

import io
import os
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from synclrc_worker.main import app
from synclrc_worker.services.alignment_service import (
    normalize_token_for_alignment,
    prepare_line_for_alignment,
    restore_original_tokens,
)
from synclrc_worker.services.audio_service import decode_wav_16k_mono
from synclrc_worker.core.exceptions import InvalidAudioError
import pytest


def _make_wav_bytes(sr: int = 16000, duration_s: float = 0.25) -> bytes:
    t = np.linspace(0, duration_s, int(sr * duration_s), endpoint=False, dtype=np.float32)
    wave = 0.2 * np.sin(2 * np.pi * 440.0 * t)
    buf = io.BytesIO()
    sf.write(buf, wave, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def test_zero_c_drive_config_paths() -> None:
    assert str(settings.cache_root).lower().startswith("d:\\synclyrc\\worker\\.cache")
    for env_key in ENV_LOCK:
        val = os.environ.get(env_key, "")
        assert val.lower().startswith("d:\\synclyrc\\worker\\.cache"), f"{env_key}={val}"


def test_decode_wav_16k_mono_valid_and_invalid_sr() -> None:
    wav_ok = _make_wav_bytes(sr=16000)
    arr = decode_wav_16k_mono(wav_ok)
    assert arr.ndim == 1
    assert arr.shape[0] == 4000

    wav_bad = _make_wav_bytes(sr=44100)
    with pytest.raises(InvalidAudioError):
        decode_wav_16k_mono(wav_bad)


def test_regional_lyrics_normalization_and_restore() -> None:
    assert normalize_token_for_alignment("to'bara'") == "tobara"
    assert normalize_token_for_alignment("Marendeng,") == "marendeng"

    orig, norm, sentence = prepare_line_for_alignment("To'bara' marendeng marampa'!")
    assert orig == ["To'bara'", "marendeng", "marampa'!"]
    assert norm == ["tobara", "marendeng", "marampa"]
    assert sentence == "tobara marendeng marampa"

    restored = restore_original_tokens(
        orig,
        [
            {"word": "tobara", "start": 1.0, "end": 1.4, "score": 0.9},
            {"word": "marendeng", "start": 1.45, "end": 2.1, "score": 0.88},
            {"word": "marampa", "start": 2.15, "end": 2.8, "score": 0.92},
        ],
    )
    assert [w.word for w in restored] == ["To'bara'", "marendeng", "marampa'!"]
    assert restored[0].start == 1.0
    assert restored[2].end == 2.8
    assert restore_original_tokens(["hello"], [{"start": 0, "end": 1, "score": 0}])[0].score == 0


def test_health_endpoint_and_uniform_error_format() -> None:
    client = TestClient(app)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["cache_root"].lower().startswith("d:\\synclyrc\\worker\\.cache")

    bad_res = client.post(
        "/api/v1/align",
        data={"lines": "not-valid-json", "language": "id"},
        files={"audio": ("test.wav", b"short", "audio/wav")},
    )
    assert bad_res.status_code == 422
    err = bad_res.json()
    assert "error" in err
    assert err["error"]["code"] == "ALIGNMENT_ERROR"


@pytest.mark.parametrize("start,end", [(1, 1), (2, 1), (float("nan"), 2), (0, float("inf"))])
def test_alignment_rejects_invalid_windows(start, end):
    import json

    response = TestClient(app).post(
        "/api/v1/align",
        data={"lines": json.dumps([{"text": "hello", "start": start, "end": end}])},
        files={"audio": ("test.wav", _make_wav_bytes(), "audio/wav")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ALIGNMENT_ERROR"


def test_transcription_rejects_arbitrary_models():
    response = TestClient(app).post(
        "/api/v1/transcribe", data={"model_size": "D:/private-model"},
        files={"audio": ("test.wav", _make_wav_bytes(), "audio/wav")},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_model_processing_keeps_health_responsive(monkeypatch):
    import asyncio
    import threading
    import httpx
    from synclrc_worker.api.routes import health, transcribe
    from synclrc_worker.schemas.device import DeviceCapabilities
    from synclrc_worker.schemas.transcription import TranscribeResponse

    entered, release = threading.Event(), threading.Event()

    def process(**kwargs):
        entered.set()
        release.wait(2)
        return TranscribeResponse(text="", language="en", duration_seconds=0.25, model_used="test", processing_ms=0, segments=[], words=[])

    monkeypatch.setattr(transcribe, "transcribe_audio", process)
    monkeypatch.setattr(health, "get_device_capabilities", lambda: DeviceCapabilities())

    async def scenario():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            task = asyncio.create_task(client.post("/api/v1/transcribe", files={"audio": ("test.wav", _make_wav_bytes(), "audio/wav")}))
            try:
                assert await asyncio.to_thread(entered.wait, 1)
                health = await asyncio.wait_for(client.get("/api/v1/health"), 0.5)
                assert health.status_code == 200
                assert not task.done(), "Health must respond while transcription is still processing"
            finally:
                release.set()
                await task

    asyncio.run(scenario())
