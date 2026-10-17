import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalWhisperProvider } from "@/services/transcription/localWhisperProvider";
import { WorkerAlignmentClient } from "@/services/alignment/workerAlignmentClient";
import { loadAppSettings, saveAppSettings } from "@/services/storage/settingsRepository";

afterEach(() => vi.unstubAllGlobals());

describe("processing device", () => {
  it("sends the selected model and device to transcription and alignment", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ text: "hello", segments: [], words: [], lines: [] })));
    vi.stubGlobal("fetch", fetcher);
    await new LocalWhisperProvider("http://localhost", "large-v3-turbo", "cuda").transcribe({ wavBlob: new Blob(["wav"]), language: "en" });
    const asrBody = fetcher.mock.calls[0][1].body as FormData;
    expect(asrBody.get("model_size")).toBe("large-v3-turbo");
    expect(asrBody.get("device")).toBe("cuda");
    await new WorkerAlignmentClient("http://localhost").alignLines({ wavBlob: new Blob(["wav"]), language: "en", lines: [], device: "cuda" });
    expect((fetcher.mock.calls[1][1].body as FormData).get("device")).toBe("cuda");
  });

  it("preserves old CPU settings and saves the selected device", () => {
    let stored = JSON.stringify({ localModelSize: "small" });
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
    expect(loadAppSettings().processingDevice).toBe("cpu");
    saveAppSettings({ ...loadAppSettings(), processingDevice: "cuda", localModelSize: "large-v3-turbo" });
    expect(loadAppSettings()).toMatchObject({ processingDevice: "cuda", localModelSize: "large-v3-turbo" });
    stored = JSON.stringify({ processingDevice: "invalid" });
    expect(loadAppSettings().processingDevice).toBe("cpu");
  });
});
