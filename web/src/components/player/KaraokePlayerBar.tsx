import type { RefObject } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatTimestamp } from "@/domain/lrc/formatter";

interface KaraokePlayerBarProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioUrl: string | null;
  currentTime: number;
  isPlaying: boolean;
  title: string;
  artist: string;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (sec: number) => void;
  onTogglePlay: () => void;
}

export function KaraokePlayerBar({ audioRef, audioUrl, currentTime, isPlaying, title, artist, onPlayStateChange, onTimeUpdate, onTogglePlay }: KaraokePlayerBarProps) {
  if (!audioUrl) return null;
  return (
    <footer className="player-bar" aria-label="Pemutar audio">
      <div className="player-track"><span className="track-art" aria-hidden="true"><Icon name="music" /></span><div><strong>{title || "Audio terpilih"}</strong><span>{artist || "Pratinjau audio"}</span></div></div>
      <button type="button" className="play-button" onClick={onTogglePlay} aria-label={isPlaying ? "Jeda audio" : "Putar audio"}><Icon name={isPlaying ? "pause" : "play"} /></button>
      <span className="player-clock" aria-label="Posisi pemutaran">{formatTimestamp(currentTime)}</span>
      <audio ref={audioRef} src={audioUrl} controls className="native-audio" aria-label="Kontrol audio" onPlay={() => onPlayStateChange(true)} onPause={() => onPlayStateChange(false)} onEnded={() => onPlayStateChange(false)} onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)} />
    </footer>
  );
}
