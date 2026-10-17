import { useCallback, useEffect, useRef, useState } from "react";

export function useAudioKaraoke(audioFile: File | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    if (!audioFile) {
      setAudioUrl(null);
      setCurrentTime(0);
      setIsPlaying(false);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      if (audioRef.current && !audioRef.current.paused) {
        setCurrentTime(audioRef.current.currentTime);
        rafId = requestAnimationFrame(tick);
      }
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const seekTo = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, seconds);
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  return {
    audioRef,
    audioUrl,
    currentTime,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    seekTo,
    togglePlay,
  };
}
