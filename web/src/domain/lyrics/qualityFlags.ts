import type { QualityFlag } from "@/types/domain";
import type { LrcLine } from "@/types/lrc";

export function evaluateQualityFlags(
  lines: LrcLine[],
  longWordThresholdSec = 5.0,
  usedFallbackWithoutWorker = false
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (usedFallbackWithoutWorker) {
    flags.push({
      type: "groq_only",
      lineIndex: 0,
      message: "Worker lokal tidak aktif; timestamp kata memakai estimasi transkripsi.",
    });
  }

  for (const line of lines) {
    if (line.interpolated) {
      flags.push({
        type: "interpolated_line",
        lineIndex: line.index,
        message: `Baris #${line.index + 1} diinterpolasi karena tidak terdeteksi di transkripsi.`,
      });
    }
    if (!line.aligned || line.words.length === 0) {
      flags.push({
        type: "align_failed",
        lineIndex: line.index,
        message: `Baris #${line.index + 1} gagal diselaraskan per kata (jatuh ke format per kalimat).`,
      });
    }
    for (const w of line.words) {
      const dur = Number((w.end - w.start).toFixed(2));
      if (dur > longWordThresholdSec) {
        flags.push({
          type: "long_word",
          lineIndex: line.index,
          word: w.word,
          durationSeconds: dur,
          message: `Kata "${w.word}" pada baris #${line.index + 1} berdurasi tidak wajar (${dur}s).`,
        });
      }
    }
  }

  return flags;
}
