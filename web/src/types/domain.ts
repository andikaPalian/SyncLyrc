export type TranscriptionEngineMode = "local" | "groq";
export type LocalWhisperModelSize = "small" | "medium" | "large-v3-turbo";
export type ProcessingDevice = "cpu" | "cuda";
export type LrcFormatMode = "word" | "line";
export type SupportedLanguage = "id" | "en" | "toraja" | "bugis" | "makassar";

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avgLogprob: number;
  noSpeechProb: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  durationSeconds: number;
  modelUsed: string;
  fallbackUsed: boolean;
  segments: TranscriptionSegment[];
  words: WordTimestamp[];
}

export interface LyricLineWindow {
  index: number;
  text: string;
  start: number;
  end: number;
  interpolated: boolean;
  matchedWords: WordTimestamp[];
}

export type QualityFlagType =
  | "long_word"
  | "align_failed"
  | "interpolated_line"
  | "groq_only";

export interface QualityFlag {
  type: QualityFlagType;
  lineIndex: number;
  word?: string;
  durationSeconds?: number;
  message: string;
}
