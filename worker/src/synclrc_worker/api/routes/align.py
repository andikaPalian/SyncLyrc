from __future__ import annotations

from synclrc_worker.core.exceptions import AlignmentError
from synclrc_worker.schemas.alignment import AlignLineInput, AlignResponse
from synclrc_worker.schemas.device import ProcessingDevice
from synclrc_worker.services.alignment_service import align_lyric_lines
from synclrc_worker.services.audio_service import decode_wav_16k_mono

import json
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import Field, TypeAdapter
from starlette.concurrency import run_in_threadpool
from typing import Annotated, Literal

router = APIRouter()
_LINES_ADAPTER = TypeAdapter(Annotated[list[AlignLineInput], Field(min_length=1)])


@router.post("/align", response_model=AlignResponse)
async def post_align(
    audio: UploadFile = File(...),
    lines: str = Form(...),
    language: Literal["id", "en"] = Form("id"),
    align_model: str | None = Form(None),
    device: ProcessingDevice = Form("cpu"),
) -> AlignResponse:
    try:
        parsed_raw = json.loads(lines)
        line_items = _LINES_ADAPTER.validate_python(parsed_raw)
    except Exception as exc:
        raise AlignmentError(
            "Format parameter 'lines' tidak valid (harus JSON array berisi text, start, end).",
            details=str(exc),
        ) from exc

    raw_bytes = await audio.read(25 * 1024 * 1024 + 1)
    waveform = decode_wav_16k_mono(raw_bytes)
    return await run_in_threadpool(
        align_lyric_lines,
        audio=waveform,
        lines=line_items,
        language=language,
        align_model=align_model,
        device=device,
    )
