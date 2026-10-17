import { useState } from "react";
import { loadAudioUrl } from "@/services/audio/audioUrlService";

export function useAudioSource(workerBaseUrl: string) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioLink, setAudioLink] = useState("");
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const selectFile = (file: File | null) => {
    setAudioError(null);
    setAudioFile(file);
  };
  const loadLink = async () => {
    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      setAudioFile(await loadAudioUrl(audioLink, workerBaseUrl));
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Gagal memuat audio.");
    } finally {
      setIsLoadingAudio(false);
    }
  };
  return { audioFile, audioLink, setAudioLink, isLoadingAudio, audioError, selectFile, loadLink };
}
