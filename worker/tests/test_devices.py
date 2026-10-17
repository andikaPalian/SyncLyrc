from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import GpuExecutionError
from synclrc_worker.schemas.device import DeviceCapabilities
from synclrc_worker.services import alignment_service, device_service, transcription_service
from synclrc_worker.schemas.alignment import AlignLineInput
from synclrc_worker.main import app

import io
import sys
from types import SimpleNamespace
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient


@pytest.fixture
def fake_gpu(monkeypatch):
    device_service.get_device_capabilities.cache_clear()
    tensor = SimpleNamespace(sum=lambda: SimpleNamespace(item=lambda: 2))

    class Tensor:
        def __add__(self, value):
            return tensor

    torch = SimpleNamespace(
        version=SimpleNamespace(cuda="12.6"), ones=lambda *args, **kwargs: Tensor(),
        cuda=SimpleNamespace(is_available=lambda: True, get_device_properties=lambda index: SimpleNamespace(name="Test GPU", total_memory=4 * 1024**3)),
    )
    monkeypatch.setitem(sys.modules, "torch", torch)
    monkeypatch.setitem(sys.modules, "ctranslate2", SimpleNamespace(get_cuda_device_count=lambda: 1, get_supported_compute_types=lambda device: {"int8_float16", "float16", "float32"}))
    monkeypatch.setattr(device_service.ctypes, "WinDLL", lambda name: None)
    yield torch
    device_service.get_device_capabilities.cache_clear()
    transcription_service._WHISPER_REGISTRY.clear()
    alignment_service._ALIGN_REGISTRY.clear()


def test_supported_gpu_and_precision(fake_gpu):
    capabilities = device_service.get_device_capabilities()
    assert capabilities.available_devices == ["cpu", "cuda"]
    assert capabilities.gpu_name == "Test GPU"
    assert capabilities.gpu_memory_gb == 4
    assert device_service.whisper_compute_type("cpu") == "int8"
    assert device_service.whisper_compute_type("cuda") == "int8_float16"


def test_cpu_torch_disables_gpu_even_when_nvidia_exists(fake_gpu):
    fake_gpu.version.cuda = None
    capabilities = device_service.get_device_capabilities()
    assert capabilities.available_devices == ["cpu"]
    assert "versi CPU" in capabilities.gpu_unavailable_reason


def test_missing_driver_or_cuda_dll_disables_gpu(fake_gpu, monkeypatch):
    fake_gpu.cuda.is_available = lambda: False
    assert device_service.get_device_capabilities().available_devices == ["cpu"]
    device_service.get_device_capabilities.cache_clear()
    fake_gpu.cuda.is_available = lambda: True

    def missing(name):
        raise OSError("missing CUDA DLL")

    monkeypatch.setattr(device_service.ctypes, "WinDLL", missing)
    assert "missing CUDA DLL" in device_service.get_device_capabilities().gpu_unavailable_reason


def test_model_and_device_reach_whisper_and_replace_cached_model(fake_gpu, monkeypatch):
    created = []

    def model(name, **kwargs):
        result = SimpleNamespace(name=name, **kwargs)
        created.append(result)
        return result

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=model))
    cpu = transcription_service._get_whisper_model("small", "cpu")
    gpu = transcription_service._get_whisper_model("large-v3-turbo", "cuda")
    assert cpu.device == "cpu" and cpu.compute_type == "int8"
    assert gpu.device == "cuda" and gpu.compute_type == "int8_float16"
    assert gpu.download_root == str(settings.whisper_models_dir)
    assert transcription_service._get_whisper_model("large-v3-turbo", "cuda") is gpu
    assert len(created) == 2
    assert transcription_service.loaded_whisper_models() == ["large-v3-turbo@cuda"]


def test_device_reaches_alignment_model_and_inference(fake_gpu, monkeypatch):
    loaded, used = [], []
    monkeypatch.setattr(alignment_service, "_ensure_nltk_punkt", lambda: None)

    def load(**kwargs):
        loaded.append(kwargs)
        return object(), {}

    def align(*args, **kwargs):
        used.append(args[4])
        return {"segments": [{"words": [{"word": "hello", "start": 0.1, "end": 0.4}]}]}

    monkeypatch.setitem(sys.modules, "whisperx.alignment", SimpleNamespace(load_align_model=load, align=align))
    for device in ("cpu", "cuda", "cuda"):
        result = alignment_service.align_lyric_lines(np.zeros(16000, dtype=np.float32), [AlignLineInput(text="Hello", start=0, end=1)], "en", device=device)
        assert result.lines[0].aligned
    assert [item["device"] for item in loaded] == ["cpu", "cuda"]
    assert all(item["model_dir"] == str(settings.wav2vec2_models_dir) for item in loaded)
    assert used == ["cpu", "cuda", "cuda"]
    assert len(alignment_service._ALIGN_REGISTRY) == 1


def test_api_rejects_unavailable_gpu_and_invalid_device(monkeypatch):
    monkeypatch.setattr(device_service, "get_device_capabilities", lambda: DeviceCapabilities(gpu_unavailable_reason="GPU belum siap"))
    buffer = io.BytesIO()
    sf.write(buffer, np.zeros(1600, dtype=np.float32), 16000, format="WAV")
    client = TestClient(app)
    for route, fields in (("transcribe", {}), ("align", {"lines": '[{"text":"hello","start":0,"end":0.1}]'})):
        response = client.post(f"/api/v1/{route}", data={**fields, "device": "cuda"}, files={"audio": ("test.wav", buffer.getvalue(), "audio/wav")})
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "GPU_UNAVAILABLE"
        invalid = client.post(f"/api/v1/{route}", data={**fields, "device": "mps"}, files={"audio": ("test.wav", buffer.getvalue(), "audio/wav")})
        assert invalid.status_code == 422


def test_gpu_memory_error_is_actionable():
    error = GpuExecutionError(RuntimeError("CUDA out of memory"))
    assert error.code == "GPU_OUT_OF_MEMORY"
    assert "small" in error.message and "CPU" in error.message
