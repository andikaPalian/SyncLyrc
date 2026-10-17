from __future__ import annotations

import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

WORKER_ROOT = Path("D:/synclyrc/worker").resolve()
REPO_ROOT = WORKER_ROOT.parent
CACHE_ROOT = WORKER_ROOT / ".cache"

REQUIRED_SUBDIRS = (
    "pip",
    "tmp",
    "hf",
    "hf/hub",
    "torch",
    "nltk",
    "numba",
    "models",
    "models/whisper",
    "models/wav2vec2",
)

for subdir in REQUIRED_SUBDIRS:
    (CACHE_ROOT / subdir).mkdir(parents=True, exist_ok=True)

ENV_LOCK = {
    "PIP_CACHE_DIR": str(CACHE_ROOT / "pip"),
    "TMP": str(CACHE_ROOT / "tmp"),
    "TEMP": str(CACHE_ROOT / "tmp"),
    "HF_HOME": str(CACHE_ROOT / "hf"),
    "HF_HUB_CACHE": str(CACHE_ROOT / "hf" / "hub"),
    "TORCH_HOME": str(CACHE_ROOT / "torch"),
    "NLTK_DATA": str(CACHE_ROOT / "nltk"),
    "NUMBA_CACHE_DIR": str(CACHE_ROOT / "numba"),
    "SYNCLRC_MODELS_DIR": str(CACHE_ROOT / "models"),
}

for key, val in ENV_LOCK.items():
    os.environ[key] = val

# CTranslate2 also needs to find the CUDA DLLs bundled with a CUDA PyTorch wheel.
_TORCH_LIB = Path(sys.prefix) / "Lib" / "site-packages" / "torch" / "lib"
if os.name == "nt" and _TORCH_LIB.is_dir():
    os.environ["PATH"] = str(_TORCH_LIB) + os.pathsep + os.environ.get("PATH", "")
    _TORCH_DLL_DIRECTORY = os.add_dll_directory(str(_TORCH_LIB))


@dataclass(frozen=True)
class WorkerSettings:
    worker_root: Path = WORKER_ROOT
    cache_root: Path = CACHE_ROOT
    whisper_models_dir: Path = CACHE_ROOT / "models" / "whisper"
    wav2vec2_models_dir: Path = CACHE_ROOT / "models" / "wav2vec2"
    nltk_data_dir: Path = CACHE_ROOT / "nltk"
    web_dist_dir: Path = REPO_ROOT / "web" / "dist"
    device: str = "cpu"
    sample_rate: int = 16000
    default_align_model_id: str = "cahya/wav2vec2-large-xlsr-indonesian"

    def disk_free_gb(self, drive: str) -> float:
        try:
            usage = shutil.disk_usage(f"{drive}:\\")
            return round(usage.free / (1024**3), 2)
        except OSError:
            return -1.0


settings = WorkerSettings()
