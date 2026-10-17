from __future__ import annotations

from synclrc_worker.schemas.transcription import TranscribeResponse
from synclrc_worker.schemas.device import ProcessingDevice
from synclrc_worker.services.audio_service import decode_wav_16k_mono
from synclrc_worker.services.transcription_service import transcribe_audio

from fastapi import APIRouter, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool
from typing import Literal

router = APIRouter()


@router.post("/transcribe", response_model=TranscribeResponse)
async def post_transcribe(
    audio: UploadFile = File(...),
    language: Literal["id", "en"] = Form("id"),
    model_size: Literal["small", "medium", "large-v3-turbo"] = Form("small"),
    prompt: str | None = Form(None),
    device: ProcessingDevice = Form("cpu"),
) -> TranscribeResponse:
    raw_bytes = await audio.read(25 * 1024 * 1024 + 1)
    waveform = decode_wav_16k_mono(raw_bytes)
    return await run_in_threadpool(
        transcribe_audio,
        audio=waveform,
        language=language,
        model_size=model_size,
        prompt=prompt,
        device=device,
    )
