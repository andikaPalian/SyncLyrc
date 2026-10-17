import { encodeWavPcm16 } from "@/domain/audio/wavEncoder";
import { AppError } from "@/types/api";

const TARGET_SAMPLE_RATE = 16000;
const MAX_WAV_BYTES = 25 * 1024 * 1024; // 25 MB Groq limit

export interface DecodedAudio16k {
  wavBlob: Blob;
  wavBuffer: ArrayBuffer;
  durationSeconds: number;
}

export async function decodeAudioToWav16kMono(file: File): Promise<DecodedAudio16k> {
  const rawBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(rawBuffer.slice(0));
  } catch (err) {
    throw new AppError(
      "AUDIO_DECODE_ERROR",
      "Browser gagal men-decode file audio ini. Pastikan format mp3, wav, flac, atau m4a valid.",
      err
    );
  } finally {
    void audioCtx.close();
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  const monoPcm = rendered.getChannelData(0);
  const wavBuffer = encodeWavPcm16(monoPcm, TARGET_SAMPLE_RATE);

  if (wavBuffer.byteLength > MAX_WAV_BYTES) {
    throw new AppError(
      "AUDIO_TOO_LARGE",
      `Ukuran WAV 16 kHz (${(wavBuffer.byteLength / (1024 * 1024)).toFixed(
        1
      )} MB) melebihi batas 25 MB.`
    );
  }

  return {
    wavBlob: new Blob([wavBuffer], { type: "audio/wav" }),
    wavBuffer,
    durationSeconds: Number(decoded.duration.toFixed(2)),
  };
}
