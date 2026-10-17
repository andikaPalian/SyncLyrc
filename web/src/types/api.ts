import type { LocalWhisperModelSize, ProcessingDevice, TranscriptionEngineMode } from "./domain";

export interface WorkerHealthResponse {
  status: string;
  version: string;
  device: string;
  available_devices: ProcessingDevice[];
  gpu_name: string | null;
  gpu_memory_gb: number | null;
  gpu_unavailable_reason: string | null;
  cache_root: string;
  drive_d_free_gb: number;
  drive_c_free_gb: number;
  loaded_whisper_models: string[];
  loaded_align_models: string[];
}

export interface WorkerAlignLinePayload {
  text: string;
  start: number;
  end: number;
}

export interface WorkerAlignedWord {
  word: string;
  start: number;
  end: number;
  score: number;
}

export interface WorkerAlignedLineResult {
  index: number;
  aligned: boolean;
  words: WorkerAlignedWord[];
}

export interface WorkerAlignResponse {
  lines: WorkerAlignedLineResult[];
  model_used: string;
  processing_ms: number;
  separated: boolean;
}

export interface AppSettings {
  engineMode: TranscriptionEngineMode;
  localModelSize: LocalWhisperModelSize;
  processingDevice: ProcessingDevice;
  workerBaseUrl: string;
  groqApiKey: string;
  sendPromptHint: boolean;
  longWordThresholdSec: number;
  instrumentalGapSec: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}
