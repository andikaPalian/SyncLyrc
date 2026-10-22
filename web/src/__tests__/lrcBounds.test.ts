import { describe, expect, it } from "vitest";
import { formatLrcDocument } from "@/domain/lrc/formatter";
import { parseLrcText } from "@/domain/lrc/parser";

describe("LRC export time bounds", () => {
  it("preserves imported timings when no duration header is available", () => {
    const doc = parseLrcText("[00:02.00]<00:02.00>Hello<00:04.60>");
    expect(formatLrcDocument(doc)).toContain("[00:02.00]<00:02.00>Hello<00:04.60>");
    doc.metadata.durationSeconds = 4.6;
    expect(formatLrcDocument(doc)).toContain("Hello<00:04.60>");
  });

  it("caps a closing word tag at the next line, including mixed line/word LRC", () => {
    const doc = parseLrcText("[length:04:02.01]\n[02:21.89]<02:21.89>Kukira <02:22.57>inikan <02:23.76>mudah<02:24.76>\n[02:24.58]Kau aku jadi kita");
    const before = structuredClone(doc);
    const output = formatLrcDocument(doc);
    expect(output).toContain("mudah<02:24.58>\n[02:24.58]Kau aku jadi kita");
    expect(doc).toEqual(before);
  });

  it("falls back to line timing when words cannot fit before the next line", () => {
    const doc = parseLrcText("[length:04:02.01]\n[03:21.13]<03:21.13>Kau <03:21.23>aku <03:21.44>jadi <03:21.77>kita<03:21.85>\n[03:21.29]<03:21.29>Kukira <03:21.46>kita <03:21.66>akan <03:21.77>bersama<03:21.91>");
    const output = formatLrcDocument(doc);
    expect(output).toContain("[03:21.13]Kau aku jadi kita\n[03:21.29]<03:21.29>Kukira");
    expect(output).not.toContain("<03:21.44>jadi");
  });

  it("does not emit a rounded closing tag beyond the audio duration", () => {
    const doc = parseLrcText("[length:00:10.01]\n[00:09.00]<00:09.00>Hello<00:11.00>");
    doc.metadata.durationSeconds = 10.009;
    expect(formatLrcDocument(doc)).toContain("Hello<00:10.00>");
  });

  it("uses line timestamps consistently when word export is disabled", () => {
    const doc = parseLrcText("[length:00:10.00]\n[00:02.00]<00:02.00>Hello<00:03.00>\n[00:06.00]<00:06.00>World<00:07.00>");
    doc.mode = "line";
    doc.lines[1].start = 3.5;
    const output = formatLrcDocument(doc);
    expect(output).toContain("[00:02.00]Hello\n[00:03.50]World");
    expect(output).not.toContain("\n[00:03.00]\n");
  });

  it("falls back instead of exporting word tags that collide at centisecond precision", () => {
    const doc = parseLrcText("[length:00:10.00]\n[00:02.00]<00:02.00>Hello <00:02.01>world<00:03.00>");
    doc.lines[0].words[1].start = 2.004;
    expect(formatLrcDocument(doc)).toContain("[00:02.00]Hello world");
    expect(formatLrcDocument(doc)).not.toContain("<00:02.00>");
  });
});
