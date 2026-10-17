import type { LyricLineWindow, TranscriptionSegment, WordTimestamp } from "@/types/domain";
import type { LrcLine } from "@/types/lrc";
import { normalizeWord, parseManualLyricLines, tokenizeLyricLines } from "./normalizer";

export function normalizedSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - dp[n][m] / Math.max(n, m);
}

export function matchLyricsToTranscribedWords(
  rawLyrics: string,
  transcribedWords: WordTimestamp[],
  audioDurationSec: number
): LyricLineWindow[] {
  const lines = parseManualLyricLines(rawLyrics);
  if (lines.length === 0) return [];

  const lyricTokens = tokenizeLyricLines(lines);
  const asrNorm = transcribedWords.map((w) => normalizeWord(w.word));

  const n = lyricTokens.length;
  const m = transcribedWords.length;
  const GAP = -0.45;
  const MIN_SIM = 0.48;

  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const trace = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1=diag, 2=up, 3=left

  for (let i = 1; i <= n; i++) {
    score[i][0] = i * GAP;
    trace[i][0] = 2;
  }
  for (let j = 1; j <= m; j++) {
    score[0][j] = j * GAP;
    trace[0][j] = 3;
  }

  for (let i = 1; i <= n; i++) {
    const lNorm = lyricTokens[i - 1].normalized;
    for (let j = 1; j <= m; j++) {
      const sim = normalizedSimilarity(lNorm, asrNorm[j - 1]);
      const matchScore = sim >= MIN_SIM ? sim : -0.9;
      const diag = score[i - 1][j - 1] + matchScore;
      const up = score[i - 1][j] + GAP;
      const left = score[i][j - 1] + GAP;

      if (diag >= up && diag >= left) {
        score[i][j] = diag;
        trace[i][j] = 1;
      } else if (up >= left) {
        score[i][j] = up;
        trace[i][j] = 2;
      } else {
        score[i][j] = left;
        trace[i][j] = 3;
      }
    }
  }

  const tokenMatches = new Map<number, WordTimestamp>();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const dir = trace[i][j];
    if (dir === 1) {
      const sim = normalizedSimilarity(
        lyricTokens[i - 1].normalized,
        asrNorm[j - 1]
      );
      if (sim >= MIN_SIM) {
        tokenMatches.set(i - 1, transcribedWords[j - 1]);
      }
      i--;
      j--;
    } else if (dir === 2) {
      i--;
    } else {
      j--;
    }
  }

  const rawWindows: ( { start: number; end: number; matched: WordTimestamp[] } | null )[] =
    lines.map(() => null);

  lyricTokens.forEach((tok, idx) => {
    const matched = tokenMatches.get(idx);
    if (!matched) return;
    const wItem: WordTimestamp = {
      word: tok.original,
      start: matched.start,
      end: Math.max(matched.end, matched.start + 0.05),
      score: matched.score,
    };
    const curr = rawWindows[tok.lineIndex];
    if (!curr) {
      rawWindows[tok.lineIndex] = {
        start: matched.start,
        end: matched.end,
        matched: [wItem],
      };
    } else {
      curr.start = Math.min(curr.start, matched.start);
      curr.end = Math.max(curr.end, matched.end);
      curr.matched.push(wItem);
    }
  });

  const PADDING = 0.3;
  const result: LyricLineWindow[] = lines.map((text, idx) => {
    const hit = rawWindows[idx];
    if (hit) {
      return {
        index: idx,
        text,
        start: Number(Math.max(0, hit.start - PADDING).toFixed(3)),
        end: Number(
          Math.min(audioDurationSec, Math.max(hit.end + PADDING, hit.start + 0.25)).toFixed(3)
        ),
        interpolated: false,
        matchedWords: hit.matched,
      };
    }
    return {
      index: idx,
      text,
      start: 0,
      end: 0,
      interpolated: true,
      matchedWords: [],
    };
  });

  // Interpolate missing windows proportionally between anchored neighbors
  let idx = 0;
  while (idx < result.length) {
    if (!result[idx].interpolated) {
      idx++;
      continue;
    }
    const startIdx = idx;
    while (idx < result.length && result[idx].interpolated) {
      idx++;
    }
    const endIdx = idx - 1;
    const prevEnd = startIdx > 0 ? result[startIdx - 1].end : 0;
    const nextStart =
      idx < result.length ? result[idx].start : Math.max(prevEnd + 1, audioDurationSec);
    const span = Math.max(0.5 * (endIdx - startIdx + 1), nextStart - prevEnd);

    const weights = [];
    let totalWeight = 0;
    for (let k = startIdx; k <= endIdx; k++) {
      const w = Math.max(4, result[k].text.length);
      weights.push(w);
      totalWeight += w;
    }

    let cursor = prevEnd;
    for (let k = startIdx; k <= endIdx; k++) {
      const share = (weights[k - startIdx] / totalWeight) * span;
      result[k].start = Number(cursor.toFixed(3));
      result[k].end = Number(Math.min(audioDurationSec, cursor + share).toFixed(3));
      cursor += share;
    }
  }

  // Keep starts ordered; padded windows may overlap for adjacent sung lines.
  for (let k = 1; k < result.length; k++) {
    if (result[k].start < result[k - 1].start + 0.05) {
      result[k].start = Number((result[k - 1].start + 0.05).toFixed(3));
    }
    if (result[k].end <= result[k].start) {
      result[k].end = Number(Math.min(audioDurationSec, result[k].start + 0.5).toFixed(3));
    }
  }

  for (const window of result) {
    window.start = Math.max(0, Math.min(window.start, audioDurationSec - 0.02));
    window.end = Math.min(audioDurationSec, Math.max(window.end, window.start + 0.02));
  }

  return result;
}

export function buildAutomaticLinesFromAsr(
  segments: TranscriptionSegment[],
  words: WordTimestamp[]
): LrcLine[] {
  if (segments.length > 0) {
    return segments.map((s, idx) => ({
      index: idx,
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      words: words.filter((w) => {
        const midpoint = (w.start + w.end) / 2;
        return midpoint >= s.start && midpoint < s.end;
      }),
      aligned: false,
      interpolated: false,
    }));
  }

  const lines: LrcLine[] = [];
  let bucket: WordTimestamp[] = [];

  const flushBucket = (): void => {
    if (bucket.length === 0) return;
    lines.push({
      index: lines.length,
      start: bucket[0].start,
      end: bucket[bucket.length - 1].end,
      text: bucket.map((w) => w.word).join(" "),
      words: [...bucket],
      aligned: true,
      interpolated: false,
    });
    bucket = [];
  };

  for (const w of words) {
    if (bucket.length > 0) {
      const prev = bucket[bucket.length - 1];
      const gap = w.start - prev.end;
      if (gap >= 1.0 || bucket.length >= 10) {
        flushBucket();
      }
    }
    bucket.push(w);
  }
  flushBucket();
  return lines;
}

export function interpolateWordsWithinWindow(
  lineText: string,
  start: number,
  end: number
): WordTimestamp[] {
  const rawTokens = lineText.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return [];
  const span = Math.max(0.2, end - start);
  const step = span / rawTokens.length;
  return rawTokens.map((word, idx) => ({
    word,
    start: Number((start + idx * step).toFixed(3)),
    end: Number((start + (idx + 1) * step).toFixed(3)),
    score: 0.5,
  }));
}
