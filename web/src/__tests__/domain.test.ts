import { describe, expect, it } from "vitest";
import { encodeWavPcm16 } from "@/domain/audio/wavEncoder";
import { formatLrcDocument, formatTimestamp } from "@/domain/lrc/formatter";
import { parseLrcText } from "@/domain/lrc/parser";
import { filterHallucinations } from "@/domain/lyrics/hallucinationFilter";
import { buildAutomaticLinesFromAsr, matchLyricsToTranscribedWords } from "@/domain/lyrics/matcher";
import { normalizeWord, tokenizeLyricLines } from "@/domain/lyrics/normalizer";
import { evaluateQualityFlags } from "@/domain/lyrics/qualityFlags";
import type { LrcDocument } from "@/types/lrc";

describe("SyncLRC Domain Suite", () => {
  it("keeps missing manual lyric windows valid even when a clip is too short", () => {
    const windows = matchLyricsToTranscribedWords("one two\nthree four\nfive six", [], 0.1);
    for (const window of windows) {
      expect(window.start).toBeGreaterThanOrEqual(0);
      expect(window.end).toBeGreaterThan(window.start);
      expect(window.end).toBeLessThanOrEqual(0.1);
      expect(window.interpolated).toBe(true);
    }
  });

  it("preserves ASR utterance boundaries for automatic line timestamps", () => {
    const segments = [
      { id: 0, start: 0, end: 1, text: "Hello.", avgLogprob: 0, noSpeechProb: 0 },
      { id: 1, start: 1, end: 2, text: "World!", avgLogprob: 0, noSpeechProb: 0 },
    ];
    const lines = buildAutomaticLinesFromAsr(segments, [
      { word: "Hello.", start: 0, end: 0.9 }, { word: "World!", start: 1, end: 2 },
    ]);
    expect(lines.map((line) => line.text)).toEqual(["Hello.", "World!"]);
    expect(lines[1].start).toBe(1);
  });

  it("encodes valid 44-byte RIFF PCM16 WAV header", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1]);
    const buf = encodeWavPcm16(samples, 16000);
    expect(buf.byteLength).toBe(44 + 8);
    const view = new DataView(buf);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1);
  });

  it("normalizes Toraja/Bugis glottal stops while preserving original spelling", () => {
    expect(normalizeWord("To'bara'")).toBe("tobara");
    const tokens = tokenizeLyricLines(["To'bara' marendeng!"]);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].original).toBe("To'bara'");
    expect(tokens[0].normalized).toBe("tobara");
  });

  it("matches lyric lines to ASR words and interpolates missing lines monotonically", () => {
    const rawLyrics = "Kata satu dua\nBaris tengah hilang\nKata tiga empat";
    const asrWords = [
      { word: "kata", start: 10.0, end: 10.5 },
      { word: "satu", start: 10.6, end: 11.0 },
      { word: "dua", start: 11.1, end: 11.8 },
      { word: "kata", start: 20.0, end: 20.4 },
      { word: "tiga", start: 20.5, end: 21.0 },
      { word: "empat", start: 21.1, end: 21.8 },
    ];

    const windows = matchLyricsToTranscribedWords(rawLyrics, asrWords, 30.0);
    expect(windows).toHaveLength(3);
    expect(windows[0].interpolated).toBe(false);
    expect(windows[1].interpolated).toBe(true);
    expect(windows[2].interpolated).toBe(false);
    expect(windows[1].start).toBeGreaterThanOrEqual(windows[0].end);
    expect(windows[1].end).toBeLessThanOrEqual(windows[2].start);
  });

  it("filters Whisper hallucinations on instrumental segments", () => {
    const segs = [
      {
        id: 0,
        start: 0,
        end: 4,
        text: "Terima kasih telah menonton.",
        avgLogprob: -0.4,
        noSpeechProb: 0.2,
      },
      {
        id: 1,
        start: 5,
        end: 8,
        text: "Lirik asli lagu",
        avgLogprob: -0.2,
        noSpeechProb: 0.1,
      },
    ];
    const words = [
      { word: "Terima", start: 0.5, end: 1.0 },
      { word: "Lirik", start: 5.2, end: 5.8 },
    ];
    const out = filterHallucinations(segs, words);
    expect(out.segments).toHaveLength(1);
    expect(out.words).toHaveLength(1);
    expect(out.words[0].word).toBe("Lirik");
  });

  it("keeps 'Terima kasih' when it is a real Indonesian lyric", () => {
    const segment = { id: 0, start: 0, end: 2, text: "Terima kasih", avgLogprob: -0.2, noSpeechProb: 0.1 };
    expect(filterHallucinations([segment], []).segments).toEqual([segment]);
  });

  it("formats and parses word-level LRC matching exact PRD reference format", () => {
    expect(formatTimestamp(12.5)).toBe("00:12.50");
    expect(formatTimestamp(59.996)).toBe("01:00.00");

    const doc: LrcDocument = {
      metadata: {
        title: "Judul lagu",
        artist: "Nama artis",
        album: "Nama album",
        durationSeconds: 233.5,
        by: "Sumber dan catatan, mis. perlu ditinjau",
        offsetMs: 0,
        reviewed: false,
      },
      mode: "word",
      sourceEngine: "local:faster-whisper+whisperx",
      processingTimeMs: 100,
      flags: [],
      lines: [
        {
          index: 0,
          start: 12.5,
          end: 14.6,
          text: "Kata satu dua",
          aligned: true,
          interpolated: false,
          words: [
            { word: "Kata", start: 12.5, end: 13.1 },
            { word: "satu", start: 13.1, end: 13.8 },
            { word: "dua", start: 13.8, end: 14.6 },
          ],
        },
        {
          index: 1,
          start: 20.05,
          end: 21.4,
          text: "Kata tiga",
          aligned: true,
          interpolated: false,
          words: [
            { word: "Kata", start: 20.05, end: 20.7 },
            { word: "tiga", start: 20.7, end: 21.4 },
          ],
        },
      ],
    };

    const lrcText = formatLrcDocument(doc, 3.0);
    expect(formatLrcDocument({ ...doc, metadata: { ...doc.metadata, by: "SyncLRC local; perlu ditinjau" } })).toContain("[by:SyncLyrc local; perlu ditinjau]");
    expect(lrcText).toContain(
      "[00:12.50]<00:12.50>Kata <00:13.10>satu <00:13.80>dua<00:14.60>"
    );
    expect(lrcText).toContain("\n[00:14.60]\n");
    expect(lrcText).toContain(
      "[00:20.05]<00:20.05>Kata <00:20.70>tiga<00:21.40>"
    );

    const parsed = parseLrcText(lrcText);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0].words[2].end).toBeCloseTo(14.6, 2);

    const flags = evaluateQualityFlags([
      {
        index: 0,
        start: 0,
        end: 8,
        text: "Kata",
        aligned: true,
        interpolated: false,
        words: [{ word: "Kata", start: 0, end: 7.5 }],
      },
    ]);
    expect(flags.some((f) => f.type === "long_word")).toBe(true);
  });
});
