import { describe, expect, it } from "vitest";
import { matchLyricsToTranscribedWords } from "@/domain/lyrics/matcher";
import { normalizeLrcLines } from "@/domain/lrc/timing";
import { formatLrcDocument } from "@/domain/lrc/formatter";
import { parseLrcText } from "@/domain/lrc/parser";

describe("manual lyric windows", () => {
  it("does not turn a single common word into an anchor for an entire missing sentence", () => {
    const lines = matchLyricsToTranscribedWords("Alpha\nmy long missing sentence here\nOmega", [
      {word: "Alpha", start: 1, end: 2}, {word: "my", start: 9.7, end: 9.8}, {word: "Omega", start: 10, end: 11},
    ], 12);
    expect(lines[1].interpolated).toBe(true);
    expect(lines[1].start).toBe(2);
    expect(lines[1].end).toBe(10);
  });

  it("keeps a tight gap inside its real neighbors instead of imposing half a second", () => {
    const lines = matchLyricsToTranscribedWords("Alpha\nunheard sentence\nOmega", [
      {word: "Alpha", start: 1, end: 2}, {word: "Omega", start: 2.1, end: 3},
    ], 4);
    expect(lines[1].end).toBeLessThanOrEqual(lines[2].start);
    expect(lines[2].start).toBeCloseTo(2.1);
  });

  it("keeps repeated chorus occurrences in the matching audio occurrence", () => {
    const lines = matchLyricsToTranscribedWords("hello world\nother verse\nhello world", [
      {word: "hello", start: 1, end: 1.5}, {word: "world", start: 1.5, end: 2},
      {word: "other", start: 10, end: 10.5}, {word: "verse", start: 10.5, end: 11},
      {word: "hello", start: 20, end: 20.5}, {word: "world", start: 20.5, end: 21},
    ], 25);
    expect(lines.map(line => line.interpolated)).toEqual([false, false, false]);
    expect(lines[0].start).toBeCloseTo(0.7);
    expect(lines[2].start).toBeCloseTo(19.7);
  });
});

describe("stored and edited timing", () => {
  it("bounds imported line-only lyrics at the next cue, instrumental marker, and audio end", () => {
    const doc = parseLrcText("[length:00:05.00]\n[00:01.00]first\n[00:01.50]\n[00:02.00]second\n[00:02.10]third\n[00:04.90]last");
    expect(doc.lines.map(line => line.end)).toEqual([1.5, 2.1, 4.6, 5]);
  });
  it("repairs reversed/out-of-duration starts without deleting or reordering lyric text", () => {
    const doc = parseLrcText("[length:00:05.00]\n[00:04.00]<00:04.00>first<00:06.00>\n[00:02.00]<00:02.00>second<00:03.00>\n[00:06.00]third");
    const lines = normalizeLrcLines(doc.lines, 5);
    expect(lines.map(line => line.text)).toEqual(["first", "second", "third"]);
    expect(lines.map(line => line.start)).toEqual([4, 4.01, 4.99]);
    expect(lines[1].aligned).toBe(false);
    expect(lines[1].interpolated).toBe(true);
    lines.forEach((line,index) => {
      expect(line.end).toBeGreaterThan(line.start);
      expect(line.end).toBeLessThanOrEqual(lines[index+1]?.start ?? 5);
      expect(line.start).toBeLessThan(5);
    });
    expect(normalizeLrcLines(lines,5)).toEqual(lines);
  });

  it.each([3000, -3000])("bakes offset %i into bounded timestamps", offsetMs => {
    const doc = parseLrcText("[length:00:05.00]\n[00:02.00]<00:02.00>hello<00:04.00>");
    doc.metadata.offsetMs = offsetMs;
    const output = formatLrcDocument(doc);
    expect(output).toContain("[offset:0]");
    const result = parseLrcText(output);
    expect(result.lines[0].start).toBeGreaterThanOrEqual(0);
    expect(result.lines[0].start).toBeLessThan(5);
    expect(result.lines[0].end).toBeLessThanOrEqual(5);
  });
});
