import type { LrcFormatMode, QualityFlag, WordTimestamp } from "./domain";

export interface LrcMetadata {
  title: string;
  artist: string;
  album: string;
  durationSeconds: number;
  by: string;
  offsetMs: number;
  reviewed: boolean;
}

export interface LrcLine {
  index: number;
  start: number;
  end: number;
  text: string;
  words: WordTimestamp[];
  aligned: boolean;
  interpolated: boolean;
}

export interface LrcDocument {
  metadata: LrcMetadata;
  mode: LrcFormatMode;
  lines: LrcLine[];
  flags: QualityFlag[];
  sourceEngine: string;
  processingTimeMs: number;
}
