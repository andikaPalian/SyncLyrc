from __future__ import annotations

from typing import Any
from pydantic import BaseModel
from synclrc_worker.schemas.device import DeviceCapabilities


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class HealthResponse(DeviceCapabilities):
    status: str
    version: str
    device: str
    cache_root: str
    drive_d_free_gb: float
    drive_c_free_gb: float
    loaded_whisper_models: list[str]
    loaded_align_models: list[str]
