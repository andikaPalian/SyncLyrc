from __future__ import annotations

from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import register_exception_handlers
from synclrc_worker.api.router import api_router

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


def create_app() -> FastAPI:
    app = FastAPI(
        title="SyncLRC Worker",
        version="3.1.0",
        description="Local WhisperX Forced Alignment & faster-whisper Transcription Worker",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8765",
            "http://127.0.0.1:8765",
        ],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api/v1")
    app.include_router(api_router)  # backward-compatible root aliases (/health, /align, /transcribe)

    if settings.web_dist_dir.exists():
        app.mount(
            "/",
            StaticFiles(directory=str(settings.web_dist_dir), html=True),
            name="web_static",
        )

    return app


app = create_app()
