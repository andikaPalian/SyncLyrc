import {
  AppError,
  type WorkerAlignLinePayload,
  type WorkerAlignResponse,
  type WorkerHealthResponse,
} from "@/types/api";
import type { ProcessingDevice, SupportedLanguage } from "@/types/domain";

export class WorkerAlignmentClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async checkHealth(): Promise<WorkerHealthResponse | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/health`, {
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as WorkerHealthResponse;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async alignLines(params: {
    wavBlob: Blob;
    lines: WorkerAlignLinePayload[];
    language: SupportedLanguage;
    device?: ProcessingDevice;
  }): Promise<WorkerAlignResponse> {
    const form = new FormData();
    form.append("audio", params.wavBlob, "audio_16k.wav");
    form.append("lines", JSON.stringify(params.lines));
    form.append("language", params.language === "en" ? "en" : "id");
    form.append("device", params.device ?? "cpu");

    const res = await fetch(`${this.baseUrl}/api/v1/align`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg =
        errBody?.error?.message || `Alignment gagal (HTTP ${res.status}).`;
      throw new AppError(errBody?.error?.code || "ALIGNMENT_ERROR", msg, errBody);
    }

    return (await res.json()) as WorkerAlignResponse;
  }
}
