import { useEffect, useState } from "react";
import { LrcEditorPanel } from "@/components/editor/LrcEditorPanel";
import { AppHeader } from "@/components/layout/AppHeader";
import { KaraokePlayerBar } from "@/components/player/KaraokePlayerBar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAudioSource } from "@/hooks/useAudioSource";
import { useAudioKaraoke } from "@/hooks/useAudioKaraoke";
import { useSyncPipeline } from "@/hooks/useSyncPipeline";
import { useWorkerHealth } from "@/hooks/useWorkerHealth";
import type { LrcFormatMode, SupportedLanguage } from "@/types/domain";

export function App() {
  const { settings, updateSettings } = useAppSettings();
  const { health, checking, refreshHealth } = useWorkerHealth(
    settings.workerBaseUrl
  );
  const {
    document,
    setDocument,
    isRunning,
    stageMessage,
    error,
    generate,
    updateLineTime,
    updateWordTime,
    shiftAllLinesSec,
  } = useSyncPipeline(settings.longWordThresholdSec);

  const { audioFile, audioLink, setAudioLink, isLoadingAudio, audioError, selectFile, loadLink } = useAudioSource(settings.workerBaseUrl);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("id");
  const [mode, setMode] = useState<LrcFormatMode>("word");
  const [manualLyrics, setManualLyrics] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    audioRef,
    audioUrl,
    currentTime,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    seekTo,
    togglePlay,
  } = useAudioKaraoke(audioFile);

  useEffect(() => {
    setDocument(null);
    setTitle(audioFile?.name.replace(/\.[^.]+$/, "") ?? "");
  }, [audioFile, setDocument]);

  const handleChangeMode = (next: LrcFormatMode) => {
    setMode(next);
    setDocument((prev) => prev ? { ...prev, mode: next } : prev);
  };

  const handleGenerate = (bypassCache: boolean) => {
    if (!audioFile) return;
    void generate({
      file: audioFile,
      manualLyrics,
      mode,
      language,
      title,
      artist,
      album,
      bypassCache,
      settings,
    });
  };

  return (
    <div className={`app-shell${audioUrl ? " has-audio" : ""}`}>
      <AppHeader
        health={health}
        checking={checking}
        settings={settings}
        onRefreshHealth={() => void refreshHealth()}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="main-grid">
        <WorkspacePanel
          audioFile={audioFile}
          audioLink={audioLink}
          isLoadingAudio={isLoadingAudio}
          onChangeAudioLink={setAudioLink}
          onLoadAudioLink={() => void loadLink()}
          title={title}
          artist={artist}
          album={album}
          language={language}
          mode={mode}
          manualLyrics={manualLyrics}
          isRunning={isRunning}
          stageMessage={stageMessage}
          error={audioError || error}
          onSelectFile={selectFile}
          onChangeTitle={setTitle}
          onChangeArtist={setArtist}
          onChangeAlbum={setAlbum}
          onChangeLanguage={setLanguage}
          onChangeMode={handleChangeMode}
          onChangeLyrics={setManualLyrics}
          onGenerate={handleGenerate}
        />

        <LrcEditorPanel
          document={document}
          currentTime={currentTime}
          instrumentalGapSec={settings.instrumentalGapSec}
          onSeek={seekTo}
          onUpdateLineTime={updateLineTime}
          onUpdateWordTime={updateWordTime}
          onShiftAllSec={shiftAllLinesSec}
        />
      </main>

      <KaraokePlayerBar
        audioRef={audioRef}
        audioUrl={audioUrl}
        currentTime={currentTime}
        isPlaying={isPlaying}
        title={title}
        artist={artist}
        onPlayStateChange={setIsPlaying}
        onTimeUpdate={setCurrentTime}
        onTogglePlay={togglePlay}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        health={health}
        checking={checking}
        busy={isRunning || isLoadingAudio}
        onRefreshHealth={() => void refreshHealth()}
        onClose={() => setSettingsOpen(false)}
        onUpdate={updateSettings}
      />
    </div>
  );
}
