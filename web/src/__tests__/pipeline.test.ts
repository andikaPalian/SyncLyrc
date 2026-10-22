import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSyncLrcPipeline, type SyncPipelineInput } from "@/services/pipeline/syncLrcPipeline";
import { decodeAudioToWav16kMono } from "@/services/audio/audioDecoderService";
import { LocalWhisperProvider } from "@/services/transcription/localWhisperProvider";
import { WorkerAlignmentClient } from "@/services/alignment/workerAlignmentClient";
import { getCachedLrc, saveCachedLrc } from "@/services/storage/lrcCacheRepository";
import { DEFAULT_SETTINGS } from "@/services/storage/settingsRepository";
import { formatLrcDocument } from "@/domain/lrc/formatter";
import type { TranscriptionResult } from "@/types/domain";

vi.mock("@/services/audio/audioDecoderService", () => ({ decodeAudioToWav16kMono: vi.fn() }));
vi.mock("@/services/storage/lrcCacheRepository", () => ({ getCachedLrc: vi.fn(), saveCachedLrc: vi.fn() }));

const asr: TranscriptionResult = {
  text: "Hello world", language: "en", durationSeconds: 4, modelUsed: "local:test", fallbackUsed: false,
  segments: [{ id: 0, text: "Hello world", start: 0.5, end: 3, avgLogprob: -0.1, noSpeechProb: 0.1 }],
  words: [{ word: "Hello", start: 0.5, end: 1 }, { word: "world", start: 1.2, end: 3 }],
};
const input: SyncPipelineInput = {
  file: new File(["test"], "song.wav"), manualLyrics: "", language: "en", mode: "word",
  title: "Song", artist: "Artist", album: "Album", settings: DEFAULT_SETTINGS,
};

describe("WhisperX pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getCachedLrc).mockResolvedValue(null);
    vi.mocked(saveCachedLrc).mockResolvedValue();
    vi.mocked(decodeAudioToWav16kMono).mockResolvedValue({ wavBlob: new Blob(["wav"]), wavBuffer: new ArrayBuffer(4), durationSeconds: 4 });
    vi.spyOn(LocalWhisperProvider.prototype, "transcribe").mockResolvedValue(asr);
    vi.spyOn(WorkerAlignmentClient.prototype, "alignLines").mockResolvedValue({
      model_used: "wav2vec2", processing_ms: 10, separated: false,
      lines: [{ index: 0, aligned: true, words: [{ word: "Hello", start: 0.7, end: 1.1, score: 0.9 }, { word: "world", start: 1.3, end: 2.8, score: 0.9 }] }],
    });
  });

  it.each(["id", "en"] as const)("aligns automatic %s lyrics with WhisperX and exports both formats", async (language) => {
    const doc = await runSyncLrcPipeline({ ...input, language });
    expect(WorkerAlignmentClient.prototype.alignLines).toHaveBeenCalledWith(expect.objectContaining({ language }));
    expect(doc.sourceEngine).toContain("+whisperx");
    expect(doc.lines[0].start).toBe(0.7);
    expect(formatLrcDocument(doc)).toContain("<00:00.70>Hello");
    expect(formatLrcDocument({ ...doc, mode: "line" })).toContain("[00:00.70]Hello world");
    expect(formatLrcDocument({ ...doc, mode: "line" })).not.toContain("<00:");
  });

  it("aligns manual lyrics and flags failed alignment without inventing word timestamps", async () => {
    vi.mocked(WorkerAlignmentClient.prototype.alignLines).mockResolvedValue({ model_used: "test", processing_ms: 0, separated: false, lines: [{ index: 0, aligned: false, words: [] }] });
    const doc = await runSyncLrcPipeline({ ...input, manualLyrics: "Hello world" });
    expect(doc.lines[0].words).toEqual([]);
    expect(doc.flags.some((flag) => flag.type === "align_failed")).toBe(true);
  });

  it("reports silence instead of saving an empty success result", async () => {
    vi.mocked(LocalWhisperProvider.prototype.transcribe).mockResolvedValue({ ...asr, words: [], segments: [] });
    await expect(runSyncLrcPipeline(input)).rejects.toThrow("Tidak ada lirik terdeteksi");
  });

  it("refreshes metadata on cache hits and invalidates cache when the model changes", async () => {
    const doc = await runSyncLrcPipeline(input);
    const firstKey = vi.mocked(getCachedLrc).mock.lastCall?.[0];
    vi.mocked(getCachedLrc).mockResolvedValue(doc);
    const cached = await runSyncLrcPipeline({ ...input, mode: "line", title: "New title", artist: "New artist" });
    expect(cached.mode).toBe("line");
    expect(cached.metadata.title).toBe("New title");
    expect(cached.metadata.artist).toBe("New artist");
    await runSyncLrcPipeline({ ...input, settings: { ...input.settings, localModelSize: "medium" } });
    expect(vi.mocked(getCachedLrc).mock.lastCall?.[0]).not.toBe(firstKey);
    await runSyncLrcPipeline({ ...input, settings: { ...input.settings, processingDevice: "cuda" } });
    expect(vi.mocked(getCachedLrc).mock.lastCall?.[0]).not.toBe(firstKey);
  });

  it("passes the selected GPU to alignment and records the device in the result", async () => {
    const doc = await runSyncLrcPipeline({ ...input, settings: { ...input.settings, processingDevice: "cuda" } });
    expect(WorkerAlignmentClient.prototype.alignLines).toHaveBeenCalledWith(expect.objectContaining({ device: "cuda" }));
    expect(doc.sourceEngine).toContain("whisperx@cuda");
  });

  it("normalizes manual windows and rejects conflicting word alignment before saving", async () => {
    vi.mocked(decodeAudioToWav16kMono).mockResolvedValue({wavBlob: new Blob(["wav"]), wavBuffer: new ArrayBuffer(4), durationSeconds: 1});
    vi.mocked(LocalWhisperProvider.prototype.transcribe).mockResolvedValue({...asr, words: [], segments: []});
    vi.mocked(WorkerAlignmentClient.prototype.alignLines).mockResolvedValue({model_used: "test", processing_ms: 0, separated: false, lines: [
      {index: 0, aligned: true, words: [{word: "first", start: 0.8, end: 2, score: 0.9}]},
      {index: 1, aligned: true, words: [{word: "second", start: 0.2, end: 0.4, score: 0.9}]},
    ]});
    const doc = await runSyncLrcPipeline({...input, manualLyrics: "first\nsecond"});
    expect(doc.lines[0].end).toBeLessThanOrEqual(doc.lines[1].start);
    expect(doc.lines[1].end).toBeLessThanOrEqual(1);
    expect(doc.lines[1].aligned).toBe(false);
    expect(vi.mocked(saveCachedLrc).mock.lastCall?.[1]).toEqual(doc);
    const windows = vi.mocked(WorkerAlignmentClient.prototype.alignLines).mock.lastCall?.[0].lines ?? [];
    expect(windows).toHaveLength(2);
    expect(windows[0].end).toBeLessThanOrEqual(windows[1].start);
  });

  it("stops unrelated manual lyrics before alignment or caching a misleading success", async () => {
    vi.mocked(LocalWhisperProvider.prototype.transcribe).mockResolvedValue({...asr,
      words: Array.from({length: 12}, (_,index) => ({word: "sunshine", start: index * 0.2, end: index * 0.2 + 0.1})),
    });
    await expect(runSyncLrcPipeline({...input, manualLyrics: "different lyrics\nunrelated verse\nmissing refrain"})).rejects.toThrow("Sebagian besar lirik manual tidak cocok");
    expect(WorkerAlignmentClient.prototype.alignLines).not.toHaveBeenCalled();
    expect(saveCachedLrc).not.toHaveBeenCalled();
  });

  it("keeps the exact audio duration when constraining the last aligned word", async () => {
    vi.mocked(decodeAudioToWav16kMono).mockResolvedValue({wavBlob: new Blob(["wav"]), wavBuffer: new ArrayBuffer(4), durationSeconds: 4.009977});
    vi.mocked(WorkerAlignmentClient.prototype.alignLines).mockResolvedValue({model_used: "test", processing_ms: 0, separated: false, lines: [
      {index: 0, aligned: true, words: [{word: "Hello", start: 3.8, end: 4.01, score: 0.9}]},
    ]});
    const doc = await runSyncLrcPipeline(input);
    expect(doc.metadata.durationSeconds).toBe(4.009977);
    expect(doc.lines[0].end).toBe(4);
    expect(formatLrcDocument(doc)).toContain("Hello<00:04.00>");
  });
});
