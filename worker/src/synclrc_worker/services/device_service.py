from synclrc_worker.core.config import settings
from synclrc_worker.core.exceptions import SyncLrcWorkerError
from synclrc_worker.schemas.device import DeviceCapabilities, ProcessingDevice

import ctypes
import os
from functools import lru_cache


@lru_cache(maxsize=1)
def get_device_capabilities() -> DeviceCapabilities:
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() == 0:
            return DeviceCapabilities(gpu_unavailable_reason="GPU NVIDIA dengan driver CUDA tidak terdeteksi.")
        import torch

        if torch.version.cuda is None:
            return DeviceCapabilities(gpu_unavailable_reason="GPU NVIDIA terdeteksi, tetapi PyTorch masih versi CPU. Pasang PyTorch CUDA yang kompatibel untuk mengaktifkan GPU.")
        if not torch.cuda.is_available():
            return DeviceCapabilities(gpu_unavailable_reason="CUDA belum siap. Periksa driver NVIDIA dan instalasi PyTorch CUDA.")
        if os.name == "nt":
            for library in ("cublas64_12.dll", "cudnn64_9.dll"):
                ctypes.WinDLL(library)
        if not ctranslate2.get_supported_compute_types("cuda"):
            raise RuntimeError("GPU tidak mendukung komputasi Whisper.")
        (torch.ones(1, device="cuda") + 1).sum().item()
        properties = torch.cuda.get_device_properties(0)
        return DeviceCapabilities(
            available_devices=["cpu", "cuda"],
            gpu_name=properties.name,
            gpu_memory_gb=round(properties.total_memory / 1024**3, 1),
        )
    except Exception as exc:
        return DeviceCapabilities(gpu_unavailable_reason=f"GPU belum siap digunakan: {exc}")


def require_device(device: ProcessingDevice) -> None:
    if device == "cuda":
        capabilities = get_device_capabilities()
        if "cuda" not in capabilities.available_devices:
            raise SyncLrcWorkerError("GPU_UNAVAILABLE", capabilities.gpu_unavailable_reason or "GPU tidak tersedia. Pilih CPU.", status_code=409)


def whisper_compute_type(device: ProcessingDevice) -> str:
    if device == "cpu":
        return "int8"
    import ctranslate2

    supported = ctranslate2.get_supported_compute_types("cuda")
    return next((kind for kind in ("int8_float16", "float16", "float32") if kind in supported), "auto")
