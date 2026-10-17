import { Icon } from "@/components/ui/Icon";
import type { AppSettings, WorkerHealthResponse } from "@/types/api";

interface AppHeaderProps {
  health: WorkerHealthResponse | null;
  checking: boolean;
  settings: AppSettings;
  onRefreshHealth: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({ health, checking, settings, onRefreshHealth, onOpenSettings }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <span className="brand-mark"><Icon name="music" /></span>
        <div><h1>SyncLyrc</h1><p>Editor lirik & timestamp</p></div>
      </div>
      <div className="header-actions">
        <span className="engine-summary">{settings.engineMode === "local" ? settings.localModelSize : "Groq"} / {settings.processingDevice === "cuda" ? "GPU" : "CPU"}</span>
        <button type="button" className={`connection-status ${health ? "online" : "offline"}`} onClick={onRefreshHealth} title="Periksa koneksi ke layanan lokal" aria-live="polite">
          <span className="status-dot" />{checking ? "Memeriksa…" : health ? "Lokal aktif" : "Belum terhubung"}
        </button>
        <button type="button" className="btn-secondary settings-button" onClick={onOpenSettings}><Icon name="settings" />Pengaturan</button>
      </div>
    </header>
  );
}
