from __future__ import annotations

import argparse
import re
import statistics
from pathlib import Path

from synclrc_worker.services.alignment_service import normalize_token_for_alignment

_WORD_TAG_RE = re.compile(r"<(\d{2}):(\d{2})\.(\d{2})>([^<]+)")


def parse_lrc_words(path: Path) -> list[tuple[str, str, float]]:
    words: list[tuple[str, str, float]] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        for match in _WORD_TAG_RE.finditer(raw_line):
            mm, ss, cs, text = match.groups()
            tok = text.strip()
            norm = normalize_token_for_alignment(tok)
            if norm:
                sec = int(mm) * 60 + int(ss) + int(cs) / 100.0
                words.append((tok, norm, sec))
    return words


def evaluate_pair(ref_path: Path, hyp_path: Path) -> dict[str, float | int]:
    ref_words = parse_lrc_words(ref_path)
    hyp_words = parse_lrc_words(hyp_path)
    n, m = len(ref_words), len(hyp_words)

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref_words[i - 1][1] == hyp_words[j - 1][1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    i, j = n, m
    deltas: list[float] = []
    while i > 0 and j > 0:
        if ref_words[i - 1][1] == hyp_words[j - 1][1]:
            deltas.append(abs(ref_words[i - 1][2] - hyp_words[j - 1][2]))
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1

    if not deltas:
        return {"matched": 0, "total_ref": n, "median_err_s": 999.0, "within_0_5s_pct": 0.0}

    within = sum(1 for d in deltas if d <= 0.5)
    return {
        "matched": len(deltas),
        "total_ref": n,
        "median_err_s": round(statistics.median(deltas), 3),
        "within_0_5s_pct": round((within / len(deltas)) * 100.0, 2),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate word-level LRC accuracy.")
    parser.add_argument("--ref", type=Path, required=True, help="Reference .lrc file")
    parser.add_argument("--hyp", type=Path, required=True, help="Hypothesis .lrc file")
    args = parser.parse_args()
    metrics = evaluate_pair(args.ref, args.hyp)
    for k, v in metrics.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
