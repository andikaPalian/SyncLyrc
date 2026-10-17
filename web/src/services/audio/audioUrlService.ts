import { AppError } from "@/types/api";

export async function loadAudioUrl(url: string, workerBaseUrl: string): Promise<File> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new AppError("INVALID_AUDIO_URL", "Masukkan link audio HTTP/HTTPS yang valid.");
  }

  let response: Response;
  try {
    response = await fetch(`${workerBaseUrl.replace(/\/+$/, "")}/api/v1/audio-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: parsed.href }),
    });
  } catch (err) {
    throw new AppError("WORKER_UNREACHABLE", "Tidak dapat memuat link. Jalankan Worker lokal terlebih dahulu.", err);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AppError("AUDIO_URL_ERROR", body?.error?.message || "Gagal mengunduh audio dari link.");
  }
  const blob = await response.blob();
  const name = parsed.pathname.split("/").filter(Boolean).at(-1) || "audio-link";
  return new File([blob], name, { type: blob.type });
}
