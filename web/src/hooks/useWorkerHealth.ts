import { useCallback, useEffect, useState } from "react";
import { WorkerAlignmentClient } from "@/services/alignment/workerAlignmentClient";
import type { WorkerHealthResponse } from "@/types/api";

export function useWorkerHealth(workerBaseUrl: string) {
  const [health, setHealth] = useState<WorkerHealthResponse | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  const refreshHealth = useCallback(async () => {
    setChecking(true);
    const client = new WorkerAlignmentClient(workerBaseUrl);
    const res = await client.checkHealth();
    setHealth(res);
    setChecking(false);
  }, [workerBaseUrl]);

  useEffect(() => {
    void refreshHealth();
    const timer = window.setInterval(() => {
      void refreshHealth();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refreshHealth]);

  return { health, checking, refreshHealth };
}
