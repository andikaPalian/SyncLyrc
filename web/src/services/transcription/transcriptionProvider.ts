import type { SupportedLanguage, TranscriptionResult } from "@/types/domain";

export interface TranscribeOptions {
  wavBlob: Blob;
  language: SupportedLanguage;
  prompt?: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(options: TranscribeOptions): Promise<TranscriptionResult>;
}
