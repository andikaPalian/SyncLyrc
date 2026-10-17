import type { TranscriptionSegment, WordTimestamp } from "@/types/domain";

const HALLUCINATION_PATTERNS = [
  /^terima\s+kasih\s+telah\s+menonton[.!]*$/i,
  /^selamat\s+menonton[.!]*$/i,
  /^subtitles?\s+by\b/i,
  /^amara\.org/i,
  /^thanks?\s+for\s+watching[.!]*$/i,
  /^please\s+subscribe[.!]*$/i,
  /^copyright\b/i,
];

export function isHallucinatedSegment(seg: TranscriptionSegment): boolean {
  const trimmed = seg.text.trim();
  if (!trimmed) return true;
  if (seg.noSpeechProb > 0.65 && seg.avgLogprob < -1.0) {
    return true;
  }
  return HALLUCINATION_PATTERNS.some((re) => re.test(trimmed));
}

export function filterHallucinations(
  segments: TranscriptionSegment[],
  words: WordTimestamp[]
): { segments: TranscriptionSegment[]; words: WordTimestamp[] } {
  const keptSegments = segments.filter((s) => !isHallucinatedSegment(s));
  if (keptSegments.length === segments.length) {
    return { segments, words };
  }

  const keptWords = words.filter((w) => {
    const mid = (w.start + w.end) / 2;
    return keptSegments.some((s) => mid >= s.start - 0.15 && mid <= s.end + 0.15);
  });

  return { segments: keptSegments, words: keptWords };
}
