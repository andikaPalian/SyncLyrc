import type { WordTimestamp } from "@/types/domain";
import type { LrcDocument, LrcLine, LrcMetadata } from "@/types/lrc";

const HEADER_RE = /^\[(ti|ar|al|length|by|offset):(.*)\]$/i;
const LINE_TIME_RE = /^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/;
const WORD_TAG_RE = /<(\d{2}):(\d{2})\.(\d{2})>([^<]*)/g;

export function parseTimestamp(mm: string, ss: string, cs: string): number {
  return Number(mm) * 60 + Number(ss) + Number(cs) / 100;
}

export function parseLrcText(lrcText: string): LrcDocument {
  const metadata: LrcMetadata = {
    title: "",
    artist: "",
    album: "",
    durationSeconds: 0,
    by: "",
    offsetMs: 0,
    reviewed: false,
  };

  const lines: LrcLine[] = [];
  const cueStarts: number[] = [];
  let hasWordTags = false;

  for (const raw of lrcText.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(HEADER_RE);
    if (headerMatch) {
      const key = headerMatch[1].toLowerCase();
      const val = headerMatch[2].trim();
      if (key === "ti") metadata.title = val;
      else if (key === "ar") metadata.artist = val;
      else if (key === "al") metadata.album = val;
      else if (key === "by") {
        metadata.by = val;
        metadata.reviewed = !val.toLowerCase().includes("perlu ditinjau");
      } else if (key === "offset") {
        metadata.offsetMs = Number(val) || 0;
      } else if (key === "length") {
        const parts = val.match(/(\d{2}):(\d{2})\.(\d{2})/);
        if (parts) {
          metadata.durationSeconds = parseTimestamp(parts[1], parts[2], parts[3]);
        }
      }
      continue;
    }

    const lineMatch = trimmed.match(LINE_TIME_RE);
    if (!lineMatch) continue;

    const lineStart = parseTimestamp(lineMatch[1], lineMatch[2], lineMatch[3]);
    cueStarts.push(lineStart);
    const body = lineMatch[4];
    if (!body.trim()) {
      // Instrumental break marker line
      continue;
    }

    const tagMatches = Array.from(body.matchAll(WORD_TAG_RE));
    if (tagMatches.length > 0) {
      hasWordTags = true;
      const words: WordTimestamp[] = [];
      for (let i = 0; i < tagMatches.length; i++) {
        const m = tagMatches[i];
        const t = parseTimestamp(m[1], m[2], m[3]);
        const wordText = m[4].trim();
        if (!wordText) {
          // Closing end-of-line tag <mm:ss.xx>
          if (words.length > 0) {
            words[words.length - 1].end = t;
          }
          continue;
        }
        const nextMatch = tagMatches[i + 1];
        const nextTime = nextMatch
          ? parseTimestamp(nextMatch[1], nextMatch[2], nextMatch[3])
          : t + 0.4;
        words.push({
          word: wordText,
          start: t,
          end: Math.max(t + 0.02, nextTime),
        });
      }

      const lineEnd =
        words.length > 0 ? words[words.length - 1].end : lineStart + 2.0;
      lines.push({
        index: lines.length,
        start: words.length > 0 ? words[0].start : lineStart,
        end: lineEnd,
        text: words.map((w) => w.word).join(" "),
        words,
        aligned: words.length > 0,
        interpolated: false,
      });
    } else {
      lines.push({
        index: lines.length,
        start: lineStart,
        end: lineStart + 2.5,
        text: body.trim(),
        words: [],
        aligned: false,
        interpolated: false,
      });
    }
  }

  for (const line of lines) {
    const boundary = Math.min(
      ...cueStarts.filter(start => start > line.start),
      metadata.durationSeconds > 0 ? metadata.durationSeconds : Number.POSITIVE_INFINITY
    );
    line.end = Math.max(line.start, Math.min(line.end, boundary));
  }

  return {
    metadata,
    mode: hasWordTags ? "word" : "line",
    lines,
    flags: [],
    sourceEngine: metadata.by || "imported",
    processingTimeMs: 0,
  };
}
