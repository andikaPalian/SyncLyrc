import { useCallback, useState } from "react";
import { loadAppSettings, saveAppSettings } from "@/services/storage/settingsRepository";
import type { AppSettings } from "@/types/api";

export function useAppSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(() => loadAppSettings());

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveAppSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
