import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { AppSettings, WorkerHealthResponse } from "@/types/api";
import type { LocalWhisperModelSize, ProcessingDevice, TranscriptionEngineMode } from "@/types/domain";

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  health: WorkerHealthResponse | null;
  checking: boolean;
  busy: boolean;
  onRefreshHealth: () => void;
  onClose: () => void;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export function SettingsModal({
  open,
  settings,
  health,
  checking,
  busy,
  onRefreshHealth,
  onClose,
  onUpdate,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  const gpuAvailable = health?.available_devices?.includes("cuda") ?? false;

  return (
    <dialog className="settings-dialog" ref={dialogRef} aria-labelledby="settings-title" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header"><div><h2 id="settings-title">Pengaturan</h2><p>Model, perangkat, dan keluaran.</p></div><button type="button" className="icon-button" aria-label="Tutup pengaturan" onClick={onClose}><Icon name="close" /></button></div>

        <div className="field-group">
          <label htmlFor="engine-mode">Sumber transkripsi</label>
          <select
            id="engine-mode"
            value={settings.engineMode}
            disabled={busy}
            onChange={(e) =>
              onUpdate({ engineMode: e.target.value as TranscriptionEngineMode })
            }
          >
            <option value="local">
              Lokal
            </option>
            <option value="groq">
              Groq (memerlukan internet)
            </option>
          </select>
        </div>

        {settings.engineMode === "local" ? (
          <div className="field-group">
            <label htmlFor="local-model-size">
              Model transkripsi
            </label>
            <select
              id="local-model-size"
              value={settings.localModelSize}
              disabled={busy}
              onChange={(e) =>
                onUpdate({
                  localModelSize: e.target.value as LocalWhisperModelSize,
                })
              }
            >
              <option value="small">Small · 460 MB</option>
              <option value="medium">Medium · 1,5 GB</option>
              <option value="large-v3-turbo">Large v3 Turbo · 1,6 GB</option>
            </select>
            <small className="hint">Model diunduh saat pertama dipakai. Ukuran unduhan berbeda dari kebutuhan memori saat memproses audio.</small>
          </div>
        ) : (
          <div className="field-group">
            <label htmlFor="groq-key">Groq API Key (Disimpan di browser lokal)</label>
            <input
              id="groq-key"
              type="password"
              value={settings.groqApiKey}
              placeholder="gsk_..."
              onChange={(e) => onUpdate({ groqApiKey: e.target.value })}
            />
          </div>
        )}

        <div className="field-group">
          <label htmlFor="processing-device">Perangkat</label>
          <select
            id="processing-device"
            value={settings.processingDevice}
            disabled={busy}
            aria-describedby="device-hint"
            onChange={(e) => onUpdate({ processingDevice: e.target.value as ProcessingDevice })}
          >
            <option value="cpu">CPU</option>
            <option value="cuda" disabled={!gpuAvailable}>GPU NVIDIA (CUDA){gpuAvailable ? "" : " — belum tersedia"}</option>
          </select>
          <small id="device-hint" className="hint" role="status">
            {checking ? "Memeriksa kesiapan GPU..." : gpuAvailable
              ? `${health?.gpu_name} (${health?.gpu_memory_gb} GB VRAM). Model besar dapat kehabisan VRAM; pilih small atau CPU jika pemrosesan gagal.`
              : health?.gpu_unavailable_reason || "Hubungkan worker untuk memeriksa dukungan GPU."}
            {settings.engineMode === "groq" ? " Transkripsi lewat Groq; perangkat ini menyelaraskan waktunya." : " Digunakan untuk mengenali lirik dan menyelaraskan waktunya."}
          </small>
          <button type="button" className="btn-secondary" disabled={checking || busy} onClick={onRefreshHealth}><Icon name="refresh" />Periksa perangkat</button>
        </div>

        <details className="advanced-settings"><summary>Pengaturan lanjutan</summary><div>
        <div className="field-group">
          <label htmlFor="worker-url">Alamat layanan lokal</label>
          <input
            id="worker-url"
            type="text"
            value={settings.workerBaseUrl}
            disabled={busy}
            onChange={(e) => onUpdate({ workerBaseUrl: e.target.value })}
          />
        </div>

        <div className="grid-2">
          <div className="field-group">
            <label htmlFor="long-word-sec">Tandai kata lebih dari (detik)</label>
            <input
              id="long-word-sec"
              type="number"
              step="0.5"
              value={settings.longWordThresholdSec}
              onChange={(e) =>
                onUpdate({ longWordThresholdSec: Number(e.target.value) || 5.0 })
              }
            />
          </div>
          <div className="field-group">
            <label htmlFor="gap-sec">Tandai jeda mulai (detik)</label>
            <input
              id="gap-sec"
              type="number"
              step="0.5"
              value={settings.instrumentalGapSec}
              onChange={(e) =>
                onUpdate({ instrumentalGapSec: Number(e.target.value) || 3.0 })
              }
            />
          </div>
        </div>
        <p className="hint setting-help">Kata panjang diberi tanda untuk diperiksa. Jeda antarbaris diberi timestamp kosong pada file LRC.</p>
        </div></details>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Simpan & Tutup
          </button>
        </div>
      </div>
    </dialog>
  );
}
