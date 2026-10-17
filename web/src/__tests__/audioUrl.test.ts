import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAudioUrl } from "@/services/audio/audioUrlService";

afterEach(() => vi.unstubAllGlobals());

describe("audio URL input", () => {
  it("loads a direct audio URL through the worker for decoding and playback", async () => {
    const request = vi.fn().mockResolvedValue(new Response(new Blob(["audio"], { type: "audio/mpeg" })));
    vi.stubGlobal("fetch", request);
    const file = await loadAudioUrl("https://example.com/song.mp3?token=test", "http://127.0.0.1:8765/");
    expect(file.name).toBe("song.mp3");
    expect(await file.text()).toBe("audio");
    expect(request).toHaveBeenCalledWith("http://127.0.0.1:8765/api/v1/audio-url", expect.objectContaining({
      method: "POST", body: JSON.stringify({ url: "https://example.com/song.mp3?token=test" }),
    }));
  });

  it("rejects invalid protocols and displays worker errors", async () => {
    await expect(loadAudioUrl("file:///secret", "http://localhost")).rejects.toThrow("HTTP/HTTPS");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Link bukan audio" } }), { status: 400 })));
    await expect(loadAudioUrl("https://example.com/page", "http://localhost")).rejects.toThrow("Link bukan audio");
  });
});
