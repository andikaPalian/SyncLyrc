const APOSTROPHE_RE = /['’`ʼʻ]/g;
const NON_WORD_RE = /[^\p{L}\p{N}\s-]/gu;
const MULTI_SPACE_RE = /\s+/g;

export interface LyricToken {
  lineIndex: number;
  wordIndexInLine: number;
  original: string;
  normalized: string;
}

export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(APOSTROPHE_RE, "")
    .replace(NON_WORD_RE, "")
    .trim();
}

export function parseManualLyricLines(rawLyrics: string): string[] {
  return rawLyrics
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter((ln) => ln.length > 0 && !/^\[.*\]$/.test(ln));
}

export function tokenizeLyricLines(lines: string[]): LyricToken[] {
  const tokens: LyricToken[] = [];
  lines.forEach((line, lineIndex) => {
    const parts = line.split(MULTI_SPACE_RE).filter(Boolean);
    let wordIdx = 0;
    for (const part of parts) {
      const normalized = normalizeWord(part);
      if (normalized) {
        tokens.push({
          lineIndex,
          wordIndexInLine: wordIdx++,
          original: part,
          normalized,
        });
      }
    }
  });
  return tokens;
}

export function buildSpellingPrompt(rawLyrics: string, maxChars = 750): string {
  const seen = new Set<string>();
  const uniqueWords: string[] = [];
  for (const line of parseManualLyricLines(rawLyrics)) {
    for (const rawWord of line.split(MULTI_SPACE_RE)) {
      const clean = rawWord.replace(/[.,!?;:()"']/g, "").trim();
      const key = clean.toLowerCase();
      if (clean.length >= 2 && !seen.has(key)) {
        seen.add(key);
        uniqueWords.push(clean);
      }
    }
  }
  const joined = uniqueWords.join(", ");
  return joined.length <= maxChars ? joined : joined.slice(0, maxChars);
}
