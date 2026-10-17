import { useCallback, useState } from "react";
import { evaluateQualityFlags } from "@/domain/lyrics/qualityFlags";
import {
  runSyncLrcPipeline,
  type SyncPipelineInput,
} from "@/services/pipeline/syncLrcPipeline";
import type { LrcDocument, LrcLine } from "@/types/lrc";

export function useSyncPipeline(longWordThresholdSec: number) {
  const [document, setDocument] = useState<LrcDocument | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stageMessage, setStageMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (input: Omit<SyncPipelineInput, "onProgress">) => {
      setIsRunning(true);
      setError(null);
      setStageMessage("Memulai pipeline...");
      try {
        const doc = await runSyncLrcPipeline({
          ...input,
          onProgress: (msg) => setStageMessage(msg),
        });
        setDocument(doc);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses LRC.";
        setError(msg);
      } finally {
        setIsRunning(false);
        setStageMessage("");
      }
    },
    []
  );

  const updateLineTime = useCallback(
    (lineIndex: number, newStart: number) => {
      setDocument((prev) => {
        if (!prev) return prev;
        const clampedStart = Math.max(0, Number(newStart.toFixed(2)));
        const lines: LrcLine[] = prev.lines.map((ln) => {
          if (ln.index !== lineIndex) return ln;
          const delta = clampedStart - ln.start;
          const words = ln.words.map((w) => ({
            ...w,
            start: Math.max(0, Number((w.start + delta).toFixed(2))),
            end: Math.max(0.02, Number((w.end + delta).toFixed(2))),
          }));
          return {
            ...ln,
            start: clampedStart,
            end: Math.max(clampedStart + 0.1, Number((ln.end + delta).toFixed(2))),
            words,
          };
        });
        return {
          ...prev,
          metadata: {
            ...prev.metadata,
            reviewed: true,
            by: `SyncLyrc ${prev.sourceEngine}; ditinjau`,
          },
          lines,
          flags: evaluateQualityFlags(lines, longWordThresholdSec),
        };
      });
    },
    [longWordThresholdSec]
  );

  const updateWordTime = useCallback(
    (lineIndex: number, wordIndex: number, start: number, end: number) => {
      setDocument((prev) => {
        if (!prev) return prev;
        const lines = prev.lines.map((ln) => {
          if (ln.index !== lineIndex) return ln;
          const words = ln.words.map((w, idx) =>
            idx === wordIndex
              ? {
                  ...w,
                  start: Math.max(0, Number(start.toFixed(2))),
                  end: Math.max(start + 0.02, Number(end.toFixed(2))),
                }
              : w
          );
          return {
            ...ln,
            start: words[0]?.start ?? ln.start,
            end: words[words.length - 1]?.end ?? ln.end,
            words,
          };
        });
        return {
          ...prev,
          metadata: {
            ...prev.metadata,
            reviewed: true,
            by: `SyncLyrc ${prev.sourceEngine}; ditinjau`,
          },
          lines,
          flags: evaluateQualityFlags(lines, longWordThresholdSec),
        };
      });
    },
    [longWordThresholdSec]
  );

  const shiftAllLinesSec = useCallback(
    (deltaSec: number) => {
      setDocument((prev) => {
        if (!prev) return prev;
        const lines = prev.lines.map((ln) => ({
          ...ln,
          start: Math.max(0, Number((ln.start + deltaSec).toFixed(2))),
          end: Math.max(0.05, Number((ln.end + deltaSec).toFixed(2))),
          words: ln.words.map((w) => ({
            ...w,
            start: Math.max(0, Number((w.start + deltaSec).toFixed(2))),
            end: Math.max(0.05, Number((w.end + deltaSec).toFixed(2))),
          })),
        }));
        return {
          ...prev,
          metadata: {
            ...prev.metadata,
            reviewed: true,
            by: `SyncLyrc ${prev.sourceEngine}; ditinjau`,
          },
          lines,
          flags: evaluateQualityFlags(lines, longWordThresholdSec),
        };
      });
    },
    [longWordThresholdSec]
  );

  return {
    document,
    setDocument,
    isRunning,
    stageMessage,
    error,
    generate,
    updateLineTime,
    updateWordTime,
    shiftAllLinesSec,
  };
}
