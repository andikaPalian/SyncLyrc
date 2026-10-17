from __future__ import annotations

from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import InvalidAudioError
from synclrc_worker.services.audio_service import MAX_AUDIO_BYTES

import ipaddress
import socket
import httpx


def validate_public_audio_url(url: httpx.URL) -> None:
    if url.scheme not in ("http", "https") or not url.host or url.username or url.password:
        raise InvalidAudioError("Gunakan link audio langsung HTTP/HTTPS tanpa username atau password.")
    addresses = socket.getaddrinfo(url.host, url.port or (443 if url.scheme == "https" else 80))
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise InvalidAudioError("Link audio harus mengarah ke server publik, bukan jaringan lokal.")


def download_audio_url(raw_url: str) -> tuple[bytes, str]:
    try:
        url = httpx.URL(raw_url)
        with httpx.Client(timeout=30, follow_redirects=False, trust_env=False) as client:
            for _ in range(6):
                validate_public_audio_url(url)
                with client.stream("GET", url) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise InvalidAudioError("Redirect link audio tidak valid.")
                        url = response.url.join(location)
                        continue
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "application/octet-stream").split(";")[0].lower()
                    if not (content_type.startswith("audio/") or content_type in ("application/octet-stream", "video/mp4", "video/webm")):
                        raise InvalidAudioError("Link tidak mengembalikan file audio. Gunakan URL MP3/WAV/FLAC/M4A langsung.")
                    chunks: list[bytes] = []
                    size = 0
                    for chunk in response.iter_bytes(chunk_size=64 * 1024):
                        size += len(chunk)
                        if size > MAX_AUDIO_BYTES:
                            raise InvalidAudioError("Ukuran audio dari link melebihi batas 25 MB.")
                        chunks.append(chunk)
                    if size == 0:
                        raise InvalidAudioError("File audio dari link kosong.")
                    return b"".join(chunks), content_type
        raise InvalidAudioError("Link audio terlalu banyak melakukan redirect.")
    except (httpx.HTTPError, httpx.InvalidURL, OSError, ValueError) as exc:
        raise InvalidAudioError("Gagal mengunduh audio dari link. Periksa URL dan koneksi internet.", details=str(exc)) from exc
