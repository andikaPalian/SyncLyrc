import type { LyricLineWindow, WordTimestamp } from "@/types/domain";
import { tokenizeLyricLines } from "./normalizer";

interface MatchedWindow { start: number; end: number; matched: WordTimestamp[] }

export function buildManualWindows(
  lines: string[], hits: (MatchedWindow | null)[], audioDurationSec: number
): LyricLineWindow[] {
  const tokens = tokenizeLyricLines(lines);
  const anchors = hits.map((hit, index) => {
    const count = tokens.filter(token => token.lineIndex === index).length;
    return hit && hit.matched.length >= Math.max(1, Math.ceil(count / 2)) ? hit : null;
  });
  const windows = lines.map((text, index) => ({
    index, text, start: anchors[index]?.start ?? 0, end: anchors[index]?.end ?? 0,
    interpolated: !anchors[index], matchedWords: anchors[index]?.matched ?? [],
  }));
  let index = 0;
  while (index < windows.length) {
    if (!windows[index].interpolated) { index++; continue; }
    const first = index;
    while (index < windows.length && windows[index].interpolated) index++;
    const start = first > 0 ? windows[first - 1].end : 0;
    const end = index < windows.length ? windows[index].start : audioDurationSec;
    const total = windows.slice(first, index).reduce((sum, line) => sum + line.text.length, 0);
    let cursor = start;
    for (let missing = first; missing < index; missing++) {
      const span = Math.max(0, end - start) * windows[missing].text.length / total;
      windows[missing].start = cursor;
      windows[missing].end = cursor + span;
      cursor += span;
    }
  }
  // Padding must share the actual gap, never cover a neighboring lyric line.
  return windows.map((line, index) => ({
    ...line,
    start: Math.max(0, line.start - Math.min(0.3, Math.max(0, line.start - (windows[index - 1]?.end ?? 0)) / 2)),
    end: Math.min(audioDurationSec, line.end + Math.min(0.3, Math.max(0, (windows[index + 1]?.start ?? audioDurationSec) - line.end) / 2)),
  }));
}
