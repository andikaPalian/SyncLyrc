from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import InvalidAudioError
from synclrc_worker.main import app
from synclrc_worker.services import audio_url_service

import httpx
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def public_dns(monkeypatch):
    monkeypatch.setattr(audio_url_service.socket, "getaddrinfo", lambda *args: [(2, 1, 6, "", ("8.8.8.8", 443))])


@pytest.mark.parametrize("url", ["file:///D:/secret", "http://127.0.0.1/audio.wav", "http://10.0.0.1/a", "http://[::1]/a", "https://user:password@example.com/a"])
def test_reject_unsafe_audio_urls(url):
    with pytest.raises(InvalidAudioError):
        audio_url_service.validate_public_audio_url(httpx.URL(url))


def test_download_audio_and_validate_redirects(monkeypatch, public_dns):
    requests = []

    def handler(request):
        requests.append(request.url.path)
        if request.url.path == "/redirect":
            return httpx.Response(302, headers={"location": "/song.mp3"})
        return httpx.Response(200, headers={"content-type": "audio/mpeg"}, content=b"audio-data")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(audio_url_service.httpx, "Client", lambda **kwargs: client)
    assert audio_url_service.download_audio_url("https://example.com/redirect") == (b"audio-data", "audio/mpeg")
    assert requests == ["/redirect", "/song.mp3"]


@pytest.mark.parametrize("content_type,content,limit", [("text/html", b"page", 25), ("audio/mpeg", b"", 25), ("audio/wav", b"123456", 5)])
def test_reject_non_audio_empty_and_large_downloads(monkeypatch, public_dns, content_type, content, limit):
    client = httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(200, headers={"content-type": content_type}, content=content)))
    monkeypatch.setattr(audio_url_service.httpx, "Client", lambda **kwargs: client)
    monkeypatch.setattr(audio_url_service, "MAX_AUDIO_BYTES", limit)
    with pytest.raises(InvalidAudioError):
        audio_url_service.download_audio_url("https://example.com/audio")


def test_redirect_to_local_address_is_rejected(monkeypatch):
    def resolve(host, port):
        return [(2, 1, 6, "", ("127.0.0.1" if host == "localhost" else "8.8.8.8", port))]

    monkeypatch.setattr(audio_url_service.socket, "getaddrinfo", resolve)
    client = httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(302, headers={"location": "http://localhost/private"})))
    monkeypatch.setattr(audio_url_service.httpx, "Client", lambda **kwargs: client)
    with pytest.raises(InvalidAudioError, match="server publik"):
        audio_url_service.download_audio_url("https://example.com/audio")


def test_audio_url_api_returns_bytes_and_uniform_validation(monkeypatch):
    from synclrc_worker.api.routes import audio

    monkeypatch.setattr(audio, "download_audio_url", lambda url: (b"wave", "audio/wav"))
    client = TestClient(app)
    response = client.post("/api/v1/audio-url", json={"url": "https://example.com/song.wav"})
    assert response.content == b"wave"
    assert response.headers["content-type"] == "audio/wav"
    invalid = client.post("/api/v1/audio-url", json={"url": "file:///secret"})
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"
