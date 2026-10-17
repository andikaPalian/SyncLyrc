import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { DEFAULT_SETTINGS } from "@/services/storage/settingsRepository";
import type { WorkerHealthResponse } from "@/types/api";

const health: WorkerHealthResponse = {
  status: "ok", version: "3.1.0", device: "cpu", cache_root: "D:/cache",
  drive_d_free_gb: 10, drive_c_free_gb: 1, loaded_whisper_models: [], loaded_align_models: [],
  available_devices: ["cpu"], gpu_name: null, gpu_memory_gb: null, gpu_unavailable_reason: "PyTorch masih versi CPU",
};

describe("model and device settings", () => {
  it.each([false, true])("enables the GPU choice only when the worker is ready: %s", (available) => {
    const html = renderToStaticMarkup(<SettingsModal
      open settings={DEFAULT_SETTINGS} checking={false} busy={false}
      health={available ? { ...health, available_devices: ["cpu", "cuda"], gpu_name: "RTX test", gpu_memory_gb: 4, gpu_unavailable_reason: null } : health}
      onClose={() => {}} onUpdate={() => {}} onRefreshHealth={() => {}}
    />);
    expect(html).toContain('value="small"');
    expect(html).toContain('value="large-v3-turbo"');
    expect(html).toContain(available ? "RTX test" : "PyTorch masih versi CPU");
    expect(/<option value="cuda"[^>]*disabled/.test(html)).toBe(!available);
  });
});
