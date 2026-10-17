import type { AppSettings } from "@/types/api";

const SETTINGS_KEY = "synclrc_settings_v3";

const envGroqKey =
  (import.meta.env?.VITE_GROQ_API_KEY as string | undefined)?.trim() || "";
const envWorkerUrl =
  (import.meta.env?.VITE_WORKER_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:8765";

export const DEFAULT_SETTINGS: AppSettings = {
  engineMode: envGroqKey ? "groq" : "local",
  localModelSize: "small",
  processingDevice: "cpu",
  workerBaseUrl: envWorkerUrl,
  groqApiKey: envGroqKey,
  sendPromptHint: true,
  longWordThresholdSec: 5.0,
  instrumentalGapSec: 3.0,
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      processingDevice: saved.processingDevice === "cuda" ? "cuda" : "cpu",
      groqApiKey: saved.groqApiKey || envGroqKey,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
