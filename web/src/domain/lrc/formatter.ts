import type { LrcDocument } from "@/types/lrc";
import { normalizeLrcLines } from "./timing";

export function formatTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const totalCs = Math.round(clamped * 100);
  const minutes = Math.floor(totalCs / 6000);
  const remCs = totalCs % 6000;
  const secs = Math.floor(remCs / 100);
  const cs = remCs % 100;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}.${String(cs).padStart(2, "0")}`;
}

export function formatLrcDocument(
  doc: LrcDocument,
  instrumentalGapSec = 3.0
): string {
  const { metadata, mode } = doc;
  const offset = Number.isFinite(metadata.offsetMs) ? metadata.offsetMs / 1000 : 0;
  const shifted = offset === 0 ? doc.lines : doc.lines.map(line => ({
    ...line, start: line.start + offset, end: line.end + offset,
    words: line.words.map(word => ({ ...word, start: word.start + offset, end: word.end + offset })),
  }));
  const lines = normalizeLrcLines(shifted, metadata.durationSeconds);
  const statusNote = metadata.reviewed ? "ditinjau" : "perlu ditinjau";
  const byText = (metadata.by || `SyncLyrc ${doc.sourceEngine}; ${statusNote}`).replace(/^SyncLRC\b/, "SyncLyrc");

  const out: string[] = [
    `[ti:${metadata.title || "Untitled"}]`,
    `[ar:${metadata.artist || "Unknown"}]`,
    `[al:${metadata.album || "-"}]`,
    `[length:${formatTimestamp(metadata.durationSeconds)}]`,
    `[by:${byText}]`,
    `[offset:0]`,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = line.start;
    const lineEnd = line.end;
    const canRenderWordLevel = mode === "word" && line.aligned && line.words.length > 0;

    if (canRenderWordLevel) {
      const wordFragments = line.words
        .map((w, idx) => {
          const trailing = idx < line.words.length - 1 ? " " : "";
          return `<${formatTimestamp(w.start)}>${w.word}${trailing}`;
        })
        .join("");
      out.push(
        `[${formatTimestamp(start)}]${wordFragments}<${formatTimestamp(
          lineEnd
        )}>`
      );
    } else {
      out.push(`[${formatTimestamp(start)}]${line.text}`);
    }

    const nextLine = lines[i + 1];
    if (nextLine) {
      const nextStart = nextLine.start;
      if (nextStart > lineEnd && nextStart - lineEnd >= instrumentalGapSec) {
        out.push(`[${formatTimestamp(lineEnd)}]`);
      }
    }
  }

  return out.join("\n");
}
