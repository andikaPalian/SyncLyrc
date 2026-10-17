from synclrc_worker.services.audio_url_service import download_audio_url
from synclrc_worker.schemas.audio import AudioUrlRequest

from fastapi import APIRouter, Response
from starlette.concurrency import run_in_threadpool

router = APIRouter()


@router.post("/audio-url")
async def post_audio_url(payload: AudioUrlRequest) -> Response:
    audio, content_type = await run_in_threadpool(download_audio_url, str(payload.url))
    return Response(content=audio, media_type=content_type)
