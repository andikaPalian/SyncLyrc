import type { LrcLine } from "@/types/lrc";

export function normalizeLrcLines(lines: LrcLine[], durationSeconds: number): LrcLine[] {
  if (lines.length === 0) return [];
  const duration = durationSeconds > 0 && Number.isFinite(durationSeconds)
    ? durationSeconds
    : Math.max(1, ...lines.map(line => Number.isFinite(line.end) ? line.end + 1 : 1));
  const durationCs = Math.floor(duration * 100 + 1e-8);
  if (durationCs < lines.length) {
    throw new Error("Audio terlalu singkat untuk jumlah baris lirik. Kurangi baris atau gunakan audio yang sesuai.");
  }
  let previous = -1;
  const starts = lines.map((line, index) => {
    const requested = Number.isFinite(line.start) ? Math.round(line.start * 100) : 0;
    const start = Math.max(previous + 1, Math.min(durationCs - (lines.length - index), requested));
    previous = start;
    return start;
  });
  return lines.map((line, index) => {
    const start = starts[index];
    const limit = starts[index + 1] ?? durationCs;
    const moved = !Number.isFinite(line.start) || Math.round(line.start * 100) !== start;
    const wordStarts = line.words.map(word => Math.round(word.start * 100));
    const words = line.words.map((word, wordIndex) => ({
      ...word,
      start: wordStarts[wordIndex] / 100,
      end: Math.min(Math.round(word.end * 100), wordStarts[wordIndex + 1] ?? limit, limit) / 100,
    }));
    const aligned = line.aligned && !moved && words.length > 0 && words.every((word, wordIndex) =>
      Number.isFinite(word.start) && Number.isFinite(word.end) &&
      word.start >= start / 100 && word.end > word.start &&
      (wordIndex === 0 || word.start > words[wordIndex - 1].start)
    );
    const requestedEnd = aligned ? words[words.length - 1].end * 100
      : Number.isFinite(line.end) ? Math.round(line.end * 100) : limit;
    return {
      ...line,
      start: start / 100,
      end: Math.max(start + 1, Math.min(limit, requestedEnd)) / 100,
      words: aligned ? words : [],
      aligned,
      interpolated: line.interpolated || moved,
    };
  });
}
