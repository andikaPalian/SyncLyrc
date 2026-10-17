from typing import Literal

from pydantic import BaseModel, Field

ProcessingDevice = Literal["cpu", "cuda"]


class DeviceCapabilities(BaseModel):
    available_devices: list[ProcessingDevice] = Field(default_factory=lambda: ["cpu"])
    gpu_name: str | None = None
    gpu_memory_gb: float | None = None
    gpu_unavailable_reason: str | None = None
