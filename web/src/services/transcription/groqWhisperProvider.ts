import { AppError } from "@/types/api";
import type {
  TranscriptionResult,
  TranscriptionSegment,
  WordTimestamp,
} from "@/types/domain";
import type { TranscribeOptions, TranscriptionProvider } from "./transcriptionProvider";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const PRIMARY_MODEL = "whisper-large-v3-turbo";
const FALLBACK_MODEL = "whisper-large-v3";

interface GroqVerboseJson {
  text?: string;
  language?: string;
  duration?: number;
  segments?: {
    id?: number;
    start: number;
    end: number;
    text: string;
    avg_logprob?: number;
    no_speech_prob?: number;
  }[];
  words?: {
    word: string;
    start: number;
    end: number;
  }[];
}

export class GroqWhisperProvider implements TranscriptionProvider {
  readonly name = "groq-whisper";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new AppError(
        "MISSING_GROQ_KEY",
        "Groq API Key belum diisi di Pengaturan (atau ganti ke Mode Full Lokal)."
      );
    }

    const firstTry = await this.callGroqModel(PRIMARY_MODEL, options);
    if (firstTry.rateLimited) {
      const secondTry = await this.callGroqModel(FALLBACK_MODEL, options);
      if (secondTry.rateLimited) {
        throw new AppError(
          "GROQ_RATE_LIMIT",
          `Kuota kedua model Groq penuh (HTTP 429). Tunggu ${secondTry.retryAfterSec} detik atau gunakan Mode Full Lokal.`
        );
      }
      return { ...secondTry.result!, fallbackUsed: true };
    }

    return firstTry.result!;
  }

  private async callGroqModel(
    model: string,
    options: TranscribeOptions
  ): Promise<{
    rateLimited: boolean;
    retryAfterSec: number;
    result?: TranscriptionResult;
  }> {
    const form = new FormData();
    form.append("file", options.wavBlob, "audio_16k.wav");
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
    form.append("temperature", "0");
    form.append("language", options.language === "en" ? "en" : "id");
    if (options.prompt) {
      form.append("prompt", options.prompt);
    }

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: form,
    });

    if (res.status === 429) {
      const retryHeader = res.headers.get("retry-after");
      const retryAfterSec = retryHeader ? Number(retryHeader) || 60 : 60;
      return { rateLimited: true, retryAfterSec };
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const msg =
        errBody?.error?.message || `Panggilan Groq gagal (HTTP ${res.status}).`;
      throw new AppError("GROQ_API_ERROR", msg, errBody);
    }

    const data = (await res.json()) as GroqVerboseJson;
    const segments: TranscriptionSegment[] = (data.segments || []).map((s, idx) => ({
      id: s.id ?? idx,
      start: s.start,
      end: s.end,
      text: s.text,
      avgLogprob: s.avg_logprob ?? 0,
      noSpeechProb: s.no_speech_prob ?? 0,
    }));

    const words: WordTimestamp[] = (data.words || []).map((w) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
      score: 1.0,
    }));

    return {
      rateLimited: false,
      retryAfterSec: 0,
      result: {
        text: data.text || "",
        language: data.language || "id",
        durationSeconds: data.duration || 0,
        modelUsed: `groq:${model}`,
        fallbackUsed: false,
        segments,
        words,
      },
    };
  }
}
