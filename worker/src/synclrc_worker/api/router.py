from __future__ import annotations

from synclrc_worker.api.routes import align, audio, health, transcribe
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(transcribe.router, tags=["transcribe"])
api_router.include_router(align.router, tags=["align"])
api_router.include_router(audio.router, tags=["audio"])
