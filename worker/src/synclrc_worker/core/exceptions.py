from __future__ import annotations

from typing import Any
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class SyncLrcWorkerError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class InvalidAudioError(SyncLrcWorkerError):
    def __init__(self, message: str, details: Any = None) -> None:
        super().__init__("INVALID_AUDIO", message, status_code=400, details=details)


class ModelLoadError(SyncLrcWorkerError):
    def __init__(self, message: str, details: Any = None) -> None:
        super().__init__("MODEL_LOAD_ERROR", message, status_code=500, details=details)


class AlignmentError(SyncLrcWorkerError):
    def __init__(self, message: str, details: Any = None) -> None:
        super().__init__("ALIGNMENT_ERROR", message, status_code=422, details=details)


class GpuExecutionError(SyncLrcWorkerError):
    def __init__(self, cause: Exception) -> None:
        out_of_memory = "out of memory" in str(cause).lower()
        super().__init__(
            "GPU_OUT_OF_MEMORY" if out_of_memory else "GPU_EXECUTION_ERROR",
            "VRAM GPU tidak cukup. Pilih model small atau gunakan CPU." if out_of_memory else "Pemrosesan GPU gagal. Periksa runtime CUDA atau pilih CPU.",
            status_code=503,
            details=str(cause),
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(SyncLrcWorkerError)
    async def handle_worker_error(_: Request, exc: SyncLrcWorkerError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Input request tidak valid.",
                    "details": [
                        {"loc": error["loc"], "type": error["type"], "msg": error["msg"]}
                        for error in exc.errors()
                    ],
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def handle_http_error(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail), "details": None}},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_WORKER_ERROR",
                    "message": str(exc) or "Terjadi kesalahan internal pada worker.",
                    "details": None,
                }
            },
        )
