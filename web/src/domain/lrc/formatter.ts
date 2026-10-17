import type { LrcDocument } from "@/types/lrc";

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
  const { metadata, mode, lines } = doc;
  const statusNote = metadata.reviewed ? "ditinjau" : "perlu ditinjau";
  const byText = (metadata.by || `SyncLyrc ${doc.sourceEngine}; ${statusNote}`).replace(/^SyncLRC\b/, "SyncLyrc");

  const out: string[] = [
    `[ti:${metadata.title || "Untitled"}]`,
    `[ar:${metadata.artist || "Unknown"}]`,
    `[al:${metadata.album || "-"}]`,
    `[length:${formatTimestamp(metadata.durationSeconds)}]`,
    `[by:${byText}]`,
    `[offset:${Math.round(metadata.offsetMs)}]`,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const canRenderWordLevel =
      mode === "word" && line.aligned && line.words.length > 0;

    if (canRenderWordLevel) {
      const firstStart = line.words[0].start;
      const lastEnd = line.words[line.words.length - 1].end;
      const wordFragments = line.words
        .map((w, idx) => {
          const trailing = idx < line.words.length - 1 ? " " : "";
          return `<${formatTimestamp(w.start)}>${w.word}${trailing}`;
        })
        .join("");
      out.push(
        `[${formatTimestamp(firstStart)}]${wordFragments}<${formatTimestamp(
          lastEnd
        )}>`
      );
    } else {
      out.push(`[${formatTimestamp(line.start)}]${line.text}`);
    }

    const lineEnd =
      line.words.length > 0
        ? line.words[line.words.length - 1].end
        : line.end;
    const nextLine = lines[i + 1];
    if (nextLine) {
      const nextStart =
        nextLine.words.length > 0 ? nextLine.words[0].start : nextLine.start;
      if (nextStart - lineEnd >= instrumentalGapSec) {
        out.push(`[${formatTimestamp(lineEnd)}]`);
      }
    }
  }

  return out.join("\n");
}
