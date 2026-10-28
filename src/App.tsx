import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

type TransitionStyle = 'none' | 'fade' | 'slide' | 'zoom' | 'dissolve';

type Clip = {
  id: string;
  name: string;
  url: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  transition: TransitionStyle;
  volume: number;
  speed: number;
};

type Overlay = {
  id: string;
  text: string;
  x: number;
  y: number;
};

type AudioTrack = {
  id: string;
  name: string;
  url: string;
};

type Caption = {
  id: string;
  text: string;
  x: number;
  y: number;
};

const filterPresets = {
  none: 'none',
  warm: 'sepia(0.35) saturate(1.25) contrast(1.1)',
  cinematic: 'contrast(1.2) saturate(1.55) hue-rotate(-8deg)',
  vintage: 'sepia(0.7) saturate(0.8) brightness(1.08)',
};

const transitionOptions: { label: string; value: TransitionStyle }[] = [
  { label: 'None', value: 'none' },
  { label: 'Fade', value: 'fade' },
  { label: 'Slide', value: 'slide' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Dissolve', value: 'dissolve' },
];

const formatSeconds = (value: number) => {
  if (!Number.isFinite(value)) return '00:00';
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
};

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_+/g, '_');

const ensureFFmpeg = async () => {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const util = await import('@ffmpeg/util');
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';

  await ffmpeg.load({
    coreURL: await util.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await util.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

const buildAutoCaptions = (source: string) => {
  const chunks = source
    .trim()
    .split(/\s+/)
    .reduce<string[]>((acc, word) => {
      const last = acc[acc.length - 1] ?? '';
      if ((last + ' ' + word).trim().length <= 30) {
        acc[acc.length - 1] = (last + ' ' + word).trim();
      } else {
        acc.push(word);
      }
      return acc;
    }, [])
    .filter(Boolean);

  return chunks.slice(0, 6).map((text, index) => ({
    id: `${index}-${crypto.randomUUID()}`,
    text,
    x: 50,
    y: 82 + (index % 2) * 6,
  }));
};

export default function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('Summer Reels V1');
  const [filterName, setFilterName] = useState<keyof typeof filterPresets>('none');
  const [textInput, setTextInput] = useState('Your slogan here');
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [audioVolume, setAudioVolume] = useState(70);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [captionText, setCaptionText] = useState('Our free editing journey begins here');
  const [captions, setCaptions] = useState<Caption[]>([
    { id: crypto.randomUUID(), text: 'Summer nights', x: 50, y: 84 },
  ]);
  const [overlays, setOverlays] = useState<Overlay[]>([
    { id: crypto.randomUUID(), text: 'Memories', x: 30, y: 70 },
  ]);
  const ffmpegRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activeClip = useMemo(
    () => clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null,
    [activeClipId, clips]
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = (activeClip?.volume ?? 80) / 100;
      videoRef.current.playbackRate = activeClip?.speed ?? 1;
    }
  }, [activeClip, activeClip?.speed, activeClip?.volume]);

  const updateActiveClip = (changes: Partial<Clip>) => {
    if (!activeClip) return;
    setClips((currentClips) =>
      currentClips.map((clip) =>
        clip.id === activeClip.id ? { ...clip, ...changes } : clip
      )
    );
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    const newClips = await Promise.all(
      files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const duration = await new Promise<number>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = url;
          video.onloadedmetadata = () => resolve(video.duration || 0);
        });

        return {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          url,
          duration,
          trimStart: 0,
          trimEnd: duration || 10,
          transition: 'fade' as TransitionStyle,
          volume: 80,
          speed: 1,
        } satisfies Clip;
      })
    );

    setClips((currentClips) => [...currentClips, ...newClips]);
    if (!activeClipId && newClips[0]) {
      setActiveClipId(newClips[0].id);
    }

    event.target.value = '';
  };

  const handleAudioUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAudioTrack({
      id: crypto.randomUUID(),
      name: file.name,
      url: URL.createObjectURL(file),
    });

    event.target.value = '';
  };

  const reorderClips = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    setClips((currentClips) => {
      const fromIndex = currentClips.findIndex((clip) => clip.id === fromId);
      const toIndex = currentClips.findIndex((clip) => clip.id === toId);

      if (fromIndex === -1 || toIndex === -1) return currentClips;

      const updated = [...currentClips];
      const [movedClip] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedClip);
      return updated;
    });
  };

  const splitCurrentClip = () => {
    if (!activeClip) return;

    const midpoint = (activeClip.trimStart + activeClip.trimEnd) / 2;
    const leftDuration = midpoint - activeClip.trimStart;
    const rightDuration = activeClip.trimEnd - midpoint;

    const leftClip: Clip = {
      ...activeClip,
      id: crypto.randomUUID(),
      name: `${activeClip.name} A`,
      trimStart: activeClip.trimStart,
      trimEnd: midpoint,
      duration: leftDuration || 1,
    };

    const rightClip: Clip = {
      ...activeClip,
      id: crypto.randomUUID(),
      name: `${activeClip.name} B`,
      trimStart: midpoint,
      trimEnd: activeClip.trimEnd,
      duration: rightDuration || 1,
    };

    setClips((currentClips) => {
      const index = currentClips.findIndex((clip) => clip.id === activeClip.id);
      const updated = [...currentClips];
      updated.splice(index, 1, leftClip, rightClip);
      return updated;
    });

    setActiveClipId(leftClip.id);
  };

  const addTextOverlay = () => {
    const nextOverlay: Overlay = {
      id: crypto.randomUUID(),
      text: textInput.trim() || 'Free edit',
      x: 18 + Math.random() * 38,
      y: 20 + Math.random() * 50,
    };
    setOverlays((current) => [...current, nextOverlay]);
  };

  const addCaption = () => {
    const nextCaption: Caption = {
      id: crypto.randomUUID(),
      text: captionText.trim() || 'Auto caption',
      x: 50,
      y: 82,
    };
    setCaptions((current) => [...current, nextCaption]);
  };

  const generateAutoCaptions = () => {
    const nextCaptions = buildAutoCaptions(captionText);
    setCaptions((current) => [...current, ...nextCaptions]);
  };

  const exportProject = async () => {
    if (clips.length === 0) {
      setExportMessage('Add at least one clip before exporting.');
      return;
    }

    try {
      setIsExporting(true);
      setExportMessage('Preparing FFmpeg export...');

      const ffmpeg = ffmpegRef.current ?? (await ensureFFmpeg());
      ffmpegRef.current = ffmpeg;

      const clipInputs = await Promise.all(
        clips.map(async (clip, index) => {
          const safeName = `clip_${index}_${sanitizeFileName(clip.name)}.mp4`;
          const input = await fetch(clip.url).then((res) => res.arrayBuffer());
          await ffmpeg.writeFile(safeName, new Uint8Array(input));
          return safeName;
        })
      );

      const finalName = `output_${Date.now()}.mp4`;

      if (audioTrack) {
        const safeAudioName = `audio_${sanitizeFileName(audioTrack.name)}`;
        const audioBuffer = await fetch(audioTrack.url).then((res) => res.arrayBuffer());
        await ffmpeg.writeFile(safeAudioName, new Uint8Array(audioBuffer));

        if (clipInputs.length === 1) {
          await ffmpeg.exec([
            '-i', clipInputs[0], '-i', safeAudioName,
            '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
            '-shortest', finalName,
          ]);
        } else {
          const concatFile = 'concat_list.txt';
          const concatContent = clipInputs.map((name) => `file '${name}'`).join('\n');
          await ffmpeg.writeFile(concatFile, new TextEncoder().encode(concatContent));
          await ffmpeg.exec([
            '-safe', '0', '-f', 'concat', '-i', concatFile,
            '-i', safeAudioName,
            '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
            '-shortest', finalName,
          ]);
        }
      } else if (clipInputs.length === 1) {
        await ffmpeg.exec([
          '-i', clipInputs[0],
          '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
          finalName,
        ]);
      } else {
        const concatFile = 'concat_list.txt';
        const concatContent = clipInputs.map((name) => `file '${name}'`).join('\n');
        await ffmpeg.writeFile(concatFile, new TextEncoder().encode(concatContent));
        await ffmpeg.exec([
          '-safe', '0', '-f', 'concat', '-i', concatFile,
          '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
          finalName,
        ]);
      }

      const outputData = await ffmpeg.readFile(finalName);
      const blob = new Blob([outputData as Uint8Array], { type: 'video/mp4' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${projectTitle.replace(/\s+/g, '-').toLowerCase() || 'clipflow-export'}.mp4`;
      link.click();
      URL.revokeObjectURL(href);

      setExportMessage('Export finished. MP4 downloaded.');
    } catch (error) {
      console.error(error);
      setExportMessage('Export failed. Try fewer clips or smaller files.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-mark">CF</div>
          <div>
            <p className="eyebrow">Open-source studio</p>
            <h1>ClipFlow</h1>
          </div>
        </div>

        <label className="input-label">
          Project name
          <input
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.target.value)}
          />
        </label>

        <div className="panel">
          <h3>Media</h3>
          <label className="upload-button">
            Import videos
            <input type="file" accept="video/*" multiple onChange={handleUpload} />
          </label>
        </div>

        <div className="panel">
          <h3>Audio</h3>
          <label className="upload-button">
            Add music track
            <input type="file" accept="audio/*" onChange={handleAudioUpload} />
          </label>
          {audioTrack && (
            <div className="audio-box">
              <span>{audioTrack.name}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={audioVolume}
                onChange={(event) => setAudioVolume(Number(event.target.value))}
              />
              <audio controls src={audioTrack.url} />
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Filters</h3>
          <div className="chip-row">
            {Object.entries(filterPresets).map(([key]) => (
              <button
                key={key}
                className={filterName === key ? 'chip active' : 'chip'}
                onClick={() => setFilterName(key as keyof typeof filterPresets)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>Text</h3>
          <input
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
          />
          <button className="primary-button" onClick={addTextOverlay}>
            Add overlay
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Editor</p>
            <h2>{projectTitle}</h2>
          </div>
          <button className="primary-button" onClick={exportProject} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export project'}
          </button>
        </header>

        <section className="preview-card">
          {activeClip ? (
            <>
              <div className="preview-header">
                <strong>{activeClip.name}</strong>
                <span>{formatSeconds(activeClip.duration)}</span>
              </div>

              <div
                className={`video-wrap transition-${activeClip.transition}`}
                style={{
                  transition: activeClip.transition !== 'none' ? 'all 0.35s ease' : 'none',
                }}
              >
                <video
                  ref={videoRef}
                  key={activeClip.id}
                  src={activeClip.url}
                  controls
                  style={{ filter: filterPresets[filterName] }}
                />
              </div>

              <div className="overlay-layer">
                {overlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    className="text-overlay"
                    style={{ left: `${overlay.x}%`, top: `${overlay.y}%` }}
                  >
                    {overlay.text}
                  </div>
                ))}
              </div>

              <div className="caption-layer">
                {captions.map((caption) => (
                  <div
                    key={caption.id}
                    className="caption-bubble"
                    style={{ left: `${caption.x}%`, top: `${caption.y}%` }}
                  >
                    {caption.text}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              Import a video to start editing.
            </div>
          )}
        </section>

        <section className="controls-grid">
          <div className="panel">
            <h3>Trim</h3>
            {activeClip && (
              <>
                <label>
                  Start {formatSeconds(activeClip.trimStart)}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(activeClip.duration - 1, 1)}
                    step={0.1}
                    value={activeClip.trimStart}
                    onChange={(event) => updateActiveClip({ trimStart: Number(event.target.value) })}
                  />
                </label>

                <label>
                  End {formatSeconds(activeClip.trimEnd)}
                  <input
                    type="range"
                    min={Math.min(activeClip.trimStart + 1, activeClip.duration)}
                    max={activeClip.duration}
                    step={0.1}
                    value={activeClip.trimEnd}
                    onChange={(event) => updateActiveClip({ trimEnd: Number(event.target.value) })}
                  />
                </label>

                <button className="secondary-button" onClick={splitCurrentClip}>
                  Split clip
                </button>
              </>
            )}
          </div>

          <div className="panel">
            <h3>Timeline</h3>
            <div className="timeline-content">
              {clips.length === 0 ? (
                <p>No footage yet</p>
              ) : (
                clips.map((clip) => (
                  <button
                    key={clip.id}
                    className={clip.id === activeClip?.id ? 'timeline-item active' : 'timeline-item'}
                    onClick={() => setActiveClipId(clip.id)}
                    draggable
                    onDragStart={() => setDraggedClipId(clip.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedClipId) {
                        reorderClips(draggedClipId, clip.id);
                        setDraggedClipId(null);
                      }
                    }}
                    onDragEnd={() => setDraggedClipId(null)}
                    style={{
                      width: `${Math.max(((clip.trimEnd - clip.trimStart) / Math.max(clip.duration, 1)) * 100, 18)}%`,
                    }}
                  >
                    <span>{clip.name}</span>
                    <small>
                      {clip.transition} • {formatSeconds(clip.trimStart)} → {formatSeconds(clip.trimEnd)}
                    </small>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {activeClip && (
          <section className="panel extra-panel">
            <h3>Transitions & speed</h3>
            <div className="stacked-controls">
              <div>
                <label>Transition</label>
                <div className="chip-row">
                  {transitionOptions.map((option) => (
                    <button
                      key={option.value}
                      className={activeClip.transition === option.value ? 'chip active' : 'chip'}
                      onClick={() => updateActiveClip({ transition: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label>Clip volume: {activeClip.volume}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={activeClip.volume}
                  onChange={(event) => updateActiveClip({ volume: Number(event.target.value) })}
                />
              </div>

              <div>
                <label>Playback speed: {activeClip.speed.toFixed(1)}x</label>
                <input
                  type="range"
                  min={0.25}
                  max={2}
                  step={0.25}
                  value={activeClip.speed}
                  onChange={(event) => updateActiveClip({ speed: Number(event.target.value) })}
                />
              </div>
            </div>
          </section>
        )}

        <section className="panel extra-panel">
          <h3>Auto captions</h3>
          <div className="caption-tools">
            <input
              value={captionText}
              onChange={(event) => setCaptionText(event.target.value)}
            />
            <button className="primary-button" onClick={addCaption}>Add caption</button>
            <button className="secondary-button" onClick={generateAutoCaptions}>Generate auto captions</button>
          </div>
        </section>

        {exportMessage && (
          <div className="export-status">
            {exportMessage}
          </div>
        )}
      </main>
    </div>
  );
}
