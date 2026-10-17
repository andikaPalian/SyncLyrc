import { computeSha256Hex } from "@/domain/audio/hash";
import { filterHallucinations } from "@/domain/lyrics/hallucinationFilter";
import {
  buildAutomaticLinesFromAsr,
  matchLyricsToTranscribedWords,
} from "@/domain/lyrics/matcher";
import { buildSpellingPrompt, parseManualLyricLines } from "@/domain/lyrics/normalizer";
import { evaluateQualityFlags } from "@/domain/lyrics/qualityFlags";
import { decodeAudioToWav16kMono } from "@/services/audio/audioDecoderService";
import { WorkerAlignmentClient } from "@/services/alignment/workerAlignmentClient";
import { getCachedLrc, saveCachedLrc } from "@/services/storage/lrcCacheRepository";
import { GroqWhisperProvider } from "@/services/transcription/groqWhisperProvider";
import { LocalWhisperProvider } from "@/services/transcription/localWhisperProvider";
import { AppError, type AppSettings } from "@/types/api";
import type { LrcFormatMode, SupportedLanguage } from "@/types/domain";
import type { LrcDocument, LrcLine } from "@/types/lrc";

export interface SyncPipelineInput {
  file: File;
  manualLyrics: string;
  mode: LrcFormatMode;
  language: SupportedLanguage;
  title: string;
  artist: string;
  album: string;
  bypassCache?: boolean;
  settings: AppSettings;
  onProgress?: (stage: string) => void;
}

export async function runSyncLrcPipeline(
  input: SyncPipelineInput
): Promise<LrcDocument> {
  const t0 = performance.now();
  const report = (msg: string): void => input.onProgress?.(msg);

  report("Menyiapkan audio…");
  const decoded = await decodeAudioToWav16kMono(input.file);

  const hashKey = await computeSha256Hex([
    "whisperx-v3",
    decoded.wavBuffer,
    input.manualLyrics.trim(),
    input.language,
    input.settings.engineMode,
    input.settings.localModelSize,
    input.settings.processingDevice,
    String(input.settings.sendPromptHint),
  ]);

  if (!input.bypassCache) {
    const cached = await getCachedLrc(hashKey);
    if (cached) {
      report("Membuka hasil tersimpan…");
      return {
        ...cached,
        mode: input.mode,
        metadata: {
          ...cached.metadata,
          title: input.title || input.file.name.replace(/\.[^.]+$/, ""),
          artist: input.artist || "Unknown Artist",
          album: input.album || "-",
        },
        flags: evaluateQualityFlags(cached.lines, input.settings.longWordThresholdSec),
      };
    }
  }

  const manualLines = parseManualLyricLines(input.manualLyrics);
  const promptHint =
    input.settings.sendPromptHint && manualLines.length > 0
      ? buildSpellingPrompt(input.manualLyrics)
      : undefined;

  const provider =
    input.settings.engineMode === "groq"
      ? new GroqWhisperProvider(input.settings.groqApiKey)
      : new LocalWhisperProvider(
          input.settings.workerBaseUrl,
          input.settings.localModelSize,
          input.settings.processingDevice
        );

  report(
    input.settings.engineMode === "groq"
      ? "Mengenali lirik lewat Groq…"
      : "Mengenali lirik dari audio…"
  );
  const asrResult = await provider.transcribe({
    wavBlob: decoded.wavBlob,
    language: input.language,
    prompt: promptHint,
  });

  const filtered = filterHallucinations(asrResult.segments, asrResult.words);

  let lines: LrcLine[] = [];

  if (manualLines.length === 0) {
    report("Menyusun baris lirik…");
    lines = buildAutomaticLinesFromAsr(filtered.segments, filtered.words);
  } else {
    report("Mencocokkan lirik dengan audio…");
    const windows = matchLyricsToTranscribedWords(
      input.manualLyrics,
      filtered.words,
      decoded.durationSeconds
    );

    lines = windows.map((win) => ({ ...win, words: [], aligned: false }));
  }

  if (lines.length === 0) {
    throw new AppError("NO_LYRICS", "Tidak ada lirik terdeteksi. Coba model lebih besar atau masukkan lirik manual.");
  }

  report("Menyelaraskan waktu setiap kata…");
  const alignRes = await new WorkerAlignmentClient(input.settings.workerBaseUrl).alignLines({
    wavBlob: decoded.wavBlob,
    language: input.language,
    lines: lines.map(({ text, start, end }) => ({ text, start, end })),
    device: input.settings.processingDevice,
  });
  lines = lines.map((line) => {
    const result = alignRes.lines.find((item) => item.index === line.index);
    const aligned = Boolean(result?.aligned && result.words.length);
    const words = aligned && result ? result.words : [];
    return {
      ...line,
      start: words[0]?.start ?? line.start,
      end: words.at(-1)?.end ?? line.end,
      words,
      aligned,
    };
  });
  const sourceEngine = `${asrResult.modelUsed}+whisperx@${input.settings.processingDevice}`;
  const flags = evaluateQualityFlags(
    lines,
    input.settings.longWordThresholdSec
  );
  const elapsedMs = Math.round(performance.now() - t0);

  const doc: LrcDocument = {
    metadata: {
      title: input.title || input.file.name.replace(/\.[^.]+$/, ""),
      artist: input.artist || "Unknown Artist",
      album: input.album || "-",
      durationSeconds: decoded.durationSeconds,
      by: `SyncLyrc ${sourceEngine}; perlu ditinjau`,
      offsetMs: 0,
      reviewed: false,
    },
    mode: input.mode,
    lines,
    flags,
    sourceEngine,
    processingTimeMs: elapsedMs,
  };

  await saveCachedLrc(hashKey, doc);
  return doc;
}
