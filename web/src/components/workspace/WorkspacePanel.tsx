import { Icon } from "@/components/ui/Icon";
import type { LrcFormatMode, SupportedLanguage } from "@/types/domain";

interface WorkspacePanelProps {
  audioFile: File | null;
  audioLink: string;
  isLoadingAudio: boolean;
  onChangeAudioLink: (value: string) => void;
  onLoadAudioLink: () => void;
  title: string;
  artist: string;
  album: string;
  language: SupportedLanguage;
  mode: LrcFormatMode;
  manualLyrics: string;
  isRunning: boolean;
  stageMessage: string;
  error: string | null;
  onSelectFile: (file: File | null) => void;
  onChangeTitle: (v: string) => void;
  onChangeArtist: (v: string) => void;
  onChangeAlbum: (v: string) => void;
  onChangeLanguage: (v: SupportedLanguage) => void;
  onChangeMode: (v: LrcFormatMode) => void;
  onChangeLyrics: (v: string) => void;
  onGenerate: (bypassCache: boolean) => void;
}

export function WorkspacePanel({ audioFile, audioLink, isLoadingAudio, onChangeAudioLink, onLoadAudioLink, title, artist, album, language, mode, manualLyrics, isRunning, stageMessage, error, onSelectFile, onChangeTitle, onChangeArtist, onChangeAlbum, onChangeLanguage, onChangeMode, onChangeLyrics, onGenerate }: WorkspacePanelProps) {
  const busy = isRunning || isLoadingAudio;
  return (
    <section className="panel workspace-panel" aria-labelledby="input-heading">
      <div className="panel-heading"><span className="section-number">01</span><div><h2 id="input-heading">Audio & lirik</h2><p>Unggah audio atau tempel link.</p></div></div>
      <div className="workspace-body">
        <div className="upload-area">
          <input className="file-input" id="audio-input" type="file" accept=".mp3,.wav,.flac,.m4a,audio/*" disabled={busy} onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)} />
          <label htmlFor="audio-input" className="upload-label">
            <span className="upload-symbol"><Icon name={audioFile ? "music" : "upload"} /></span>
            <strong>{audioFile ? audioFile.name : "Pilih file audio"}</strong>
            <span className="hint">{audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(2)} MB · Klik untuk mengganti` : "MP3, WAV, FLAC, atau M4A"}</span>
          </label>
        </div>
        <div className="field-group">
          <label htmlFor="audio-link">Atau gunakan link audio</label>
          <div className="link-input-row">
            <input id="audio-link" type="url" value={audioLink} placeholder="https://contoh.com/lagu.mp3" aria-describedby="audio-link-hint" disabled={busy} onChange={(e) => onChangeAudioLink(e.target.value)} />
            <button type="button" className="btn-secondary" disabled={!audioLink.trim() || busy} onClick={onLoadAudioLink} aria-label="Muat audio dari link"><Icon name="arrow" /></button>
          </div>
          <small id="audio-link-hint" className="hint">Link file audio langsung, maks. 25 MB. YouTube dan Spotify belum didukung.</small>
        </div>
        <fieldset disabled={busy} className="lyric-fields">
          <legend className="sr-only">Lirik dan format keluaran</legend>
          <div className="grid-2">
            <div className="field-group">
              <label htmlFor="lang-select">Bahasa lagu</label>
              <select id="lang-select" value={language} onChange={(e) => onChangeLanguage(e.target.value as SupportedLanguage)}>
                <option value="id">Indonesia</option><option value="en">Inggris</option><option value="toraja">Toraja</option><option value="bugis">Bugis</option><option value="makassar">Makassar</option>
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="mode-select">Timestamp</label>
              <select id="mode-select" value={mode} onChange={(e) => onChangeMode(e.target.value as LrcFormatMode)}><option value="word">Per kata</option><option value="line">Per kalimat</option></select>
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="manual-lyrics">Lirik manual <span className="optional-label">{language === "id" || language === "en" ? "Opsional" : "Diperlukan"}</span></label>
            <textarea id="manual-lyrics" rows={6} value={manualLyrics} placeholder="Tempel lirik di sini, satu baris per kalimat…" aria-describedby="lyrics-hint" onChange={(e) => onChangeLyrics(e.target.value)} />
            <small id="lyrics-hint" className="hint">Kosongkan untuk mengenali lirik dari audio. Lagu bahasa daerah memerlukan lirik manual.</small>
          </div>
          <details className="metadata-details">
            <summary>Informasi lagu</summary>
            <div className="metadata-fields">
              <div className="field-group"><label htmlFor="song-title">Judul</label><input id="song-title" type="text" value={title} placeholder="Nama lagu" onChange={(e) => onChangeTitle(e.target.value)} /></div>
              <div className="grid-2">
                <div className="field-group"><label htmlFor="song-artist">Artis</label><input id="song-artist" type="text" value={artist} placeholder="Nama artis" onChange={(e) => onChangeArtist(e.target.value)} /></div>
                <div className="field-group"><label htmlFor="song-album">Album</label><input id="song-album" type="text" value={album} placeholder="Nama album" onChange={(e) => onChangeAlbum(e.target.value)} /></div>
              </div>
            </div>
          </details>
        </fieldset>
        {error && <div className="alert-error" role="alert">{error}</div>}
        {busy && <div className="progress-banner" role="status">{isLoadingAudio ? "Memuat audio dari link…" : stageMessage}</div>}
        <div className="action-row">
          <button type="button" className="btn-primary generate-button" disabled={!audioFile || busy} onClick={() => onGenerate(false)}>{isRunning ? "Memproses…" : "Buat LRC"}<Icon name="arrow" /></button>
          <button type="button" className="btn-text" disabled={!audioFile || busy} onClick={() => onGenerate(true)} aria-label="Proses ulang" title="Proses ulang tanpa hasil tersimpan"><Icon name="refresh" /></button>
        </div>
      </div>
    </section>
  );
}
