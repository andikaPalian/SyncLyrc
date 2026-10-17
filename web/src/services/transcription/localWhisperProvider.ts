import { AppError } from "@/types/api";
import type {
  LocalWhisperModelSize,
  ProcessingDevice,
  TranscriptionResult,
  TranscriptionSegment,
  WordTimestamp,
} from "@/types/domain";
import type { TranscribeOptions, TranscriptionProvider } from "./transcriptionProvider";

interface WorkerTranscribeRaw {
  text: string;
  language: string;
  duration_seconds: number;
  model_used: string;
  processing_ms: number;
  segments: {
    id: number;
    start: number;
    end: number;
    text: string;
    avg_logprob: number;
    no_speech_prob: number;
  }[];
  words: {
    word: string;
    start: number;
    end: number;
    probability: number;
  }[];
}

export class LocalWhisperProvider implements TranscriptionProvider {
  readonly name = "local-faster-whisper";
  private readonly baseUrl: string;
  private readonly modelSize: LocalWhisperModelSize;
  private readonly device: ProcessingDevice;

  constructor(baseUrl: string, modelSize: LocalWhisperModelSize, device: ProcessingDevice = "cpu") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.modelSize = modelSize;
    this.device = device;
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("audio", options.wavBlob, "audio_16k.wav");
    form.append("language", options.language === "en" ? "en" : "id");
    form.append("model_size", this.modelSize);
    form.append("device", this.device);
    if (options.prompt) {
      form.append("prompt", options.prompt);
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/transcribe`, {
        method: "POST",
        body: form,
      });
    } catch (err) {
      throw new AppError(
        "WORKER_UNREACHABLE",
        "Tidak dapat menghubungi Worker lokal di 127.0.0.1:8765. Jalankan worker/scripts/run.ps1 terlebih dahulu.",
        err
      );
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg =
        errBody?.error?.message || `Worker transkripsi gagal (HTTP ${res.status}).`;
      throw new AppError(errBody?.error?.code || "LOCAL_TRANSCRIBE_FAILED", msg, errBody);
    }

    const data = (await res.json()) as WorkerTranscribeRaw;
    const segments: TranscriptionSegment[] = (data.segments || []).map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      text: s.text,
      avgLogprob: s.avg_logprob ?? 0,
      noSpeechProb: s.no_speech_prob ?? 0,
    }));

    const words: WordTimestamp[] = (data.words || []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
      score: w.probability ?? 1,
    }));

    return {
      text: data.text || "",
      language: data.language || "id",
      durationSeconds: data.duration_seconds || 0,
      modelUsed: data.model_used || `local:faster-whisper-${this.modelSize}`,
      fallbackUsed: false,
      segments,
      words,
    };
  }
}
