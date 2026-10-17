import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatLrcDocument, formatTimestamp } from "@/domain/lrc/formatter";
import type { LrcDocument } from "@/types/lrc";

interface LrcEditorPanelProps {
  document: LrcDocument | null;
  currentTime: number;
  instrumentalGapSec: number;
  onSeek: (sec: number) => void;
  onUpdateLineTime: (lineIndex: number, newStart: number) => void;
  onUpdateWordTime: (
    lineIndex: number,
    wordIndex: number,
    start: number,
    end: number
  ) => void;
  onShiftAllSec: (deltaSec: number) => void;
}

export function LrcEditorPanel({
  document,
  currentTime,
  instrumentalGapSec,
  onSeek,
  onUpdateLineTime,
  onUpdateWordTime,
  onShiftAllSec,
}: LrcEditorPanelProps) {
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "raw">("editor");

  const lrcText = useMemo(() => {
    if (!document) return "";
    return formatLrcDocument(document, instrumentalGapSec);
  }, [document, instrumentalGapSec]);

  if (!document) {
    return (
      <section className="panel editor-panel empty-state">
        <div className="panel-heading"><span className="section-number">02</span><div><h2>Editor lirik</h2><p>Putar, sesuaikan waktu, lalu ekspor.</p></div></div>
        <div className="empty-preview">
          <div className="record-art" aria-hidden="true"><div className="record-label"><Icon name="music" /></div></div>
          <h3>Belum ada lirik</h3>
          <p>Pilih audio, lalu klik <strong>Buat LRC</strong><br />untuk mulai mengatur waktunya.</p>
        </div>
      </section>
    );
  }

  const flaggedLineSet = new Set(document.flags.map((f) => f.lineIndex));
  const visibleLines = showFlaggedOnly
    ? document.lines.filter((ln) => flaggedLineSet.has(ln.index))
    : document.lines;

  const handleDownload = () => {
    const blob = new Blob([lrcText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.metadata.title || "lyrics"}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(lrcText);
  };

  return (
    <section className="panel editor-panel">
      <div className="editor-header">
        <div>
          <div className="panel-heading"><span className="section-number">02</span><div><h2>Editor lirik</h2><p>{document.lines.length} baris · {(document.processingTimeMs / 1000).toFixed(1)} detik pemrosesan</p></div></div>
        </div>

        <div className="toolbar-buttons">
          <div className="view-switch" aria-label="Tampilan hasil">
          <button
            type="button"
            className={activeTab === "editor" ? "selected" : ""}
            aria-pressed={activeTab === "editor"}
            onClick={() => setActiveTab("editor")}
          >
            Editor
          </button>
          <button
            type="button"
            className={activeTab === "raw" ? "selected" : ""}
            aria-pressed={activeTab === "raw"}
            onClick={() => setActiveTab("raw")}
          >
            Teks LRC
          </button>
          </div>
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            <Icon name="copy" />Salin
          </button>
          <button type="button" className="btn-primary" onClick={handleDownload}>
            <Icon name="download" />Unduh LRC
          </button>
        </div>
      </div>

      {document.flags.length > 0 && (
        <div className="flags-box">
          <div className="flags-box-header">
            <strong>{document.flags.length} bagian perlu ditinjau</strong>
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={showFlaggedOnly}
                onChange={(e) => setShowFlaggedOnly(e.target.checked)}
              />
              Hanya bagian bertanda
            </label>
          </div>
          <ul>
            {document.flags.slice(0, 6).map((f, i) => (
              <li key={`${f.type}-${f.lineIndex}-${i}`}>{f.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="offset-bar">
        <span>Geser waktu</span>
        <button type="button" onClick={() => onShiftAllSec(-0.25)}>
          -0.25s
        </button>
        <button type="button" onClick={() => onShiftAllSec(-0.05)}>
          -0.05s
        </button>
        <button type="button" onClick={() => onShiftAllSec(0.05)}>
          +0.05s
        </button>
        <button type="button" onClick={() => onShiftAllSec(0.25)}>
          +0.25s
        </button>
      </div>

      {activeTab === "raw" ? (
        <pre className="lrc-raw-preview" tabIndex={0} aria-label="Isi file LRC">{lrcText}</pre>
      ) : (
        <div className="lines-list">
          {visibleLines.map((line) => {
            const isActiveLine =
              currentTime >= line.start && currentTime <= line.end + 0.15;
            const isFlagged = flaggedLineSet.has(line.index);

            return (
              <div
                key={line.index}
                className={`line-card ${isActiveLine ? "active-line" : ""} ${
                  isFlagged ? "flagged-line" : ""
                }`}
              >
                <div className="line-meta">
                  <span className="line-num">#{line.index + 1}</span>
                  <input
                    type="number"
                    min="0"
                    aria-label={`Waktu mulai baris ${line.index + 1}`}
                    step="0.05"
                    className="time-input"
                    value={line.start}
                    onChange={(e) =>
                      onUpdateLineTime(line.index, Number(e.target.value) || 0)
                    }
                  />
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => onUpdateLineTime(line.index, currentTime)}
                    title="Set waktu mulai baris ini ke posisi audio sekarang"
                  >
                    Gunakan {formatTimestamp(currentTime)}
                  </button>
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => onSeek(line.start)}
                  >
                    Putar
                  </button>
                </div>

                {line.words.length > 0 ? (
                  <div className="words-flow">
                    {line.words.map((w, wIdx) => {
                      const isActiveWord =
                        currentTime >= w.start && currentTime <= w.end;
                      const isLong = w.end - w.start > 5.0;
                      return (
                        <span
                          key={`${line.index}-${wIdx}`}
                          className={`word-chip ${
                            isActiveWord ? "word-active" : ""
                          } ${isLong ? "word-long" : ""}`}
                          title={`Klik untuk lompat ke ${formatTimestamp(
                            w.start
                          )} - ${formatTimestamp(w.end)}`}
                        >
                          <button type="button" className="word-text" onClick={() => onSeek(w.start)} aria-label={`Putar mulai kata ${w.word}`}>{w.word}</button>
                          <input
                            type="number"
                            min="0"
                            aria-label={`Waktu kata ${wIdx + 1} pada baris ${line.index + 1}`}
                            step="0.05"
                            className="word-time-input"
                            value={w.start}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onUpdateWordTime(
                                line.index,
                                wIdx,
                                Number(e.target.value) || 0,
                                w.end
                              )
                            }
                          />
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <button type="button" className="line-plain-text" onClick={() => onSeek(line.start)}>
                    {line.text}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
