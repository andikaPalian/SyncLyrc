from __future__ import annotations

from synclrc_worker import __version__
from synclrc_worker.core.config import settings
from synclrc_worker.schemas.common import HealthResponse
from synclrc_worker.services.alignment_service import loaded_align_models
from synclrc_worker.services.transcription_service import loaded_whisper_models
from synclrc_worker.services.device_service import get_device_capabilities

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse(
        **get_device_capabilities().model_dump(),
        status="ok",
        version=__version__,
        device=settings.device,
        cache_root=str(settings.cache_root),
        drive_d_free_gb=settings.disk_free_gb("D"),
        drive_c_free_gb=settings.disk_free_gb("C"),
        loaded_whisper_models=loaded_whisper_models(),
        loaded_align_models=loaded_align_models(),
    )
