import { ChangeEvent, useMemo, useState } from 'react';

type Clip = {
  id: string;
  name: string;
  url: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
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

const filterPresets = {
  none: 'none',
  warm: 'sepia(0.35) saturate(1.25) contrast(1.1)',
  cinematic: 'contrast(1.2) saturate(1.55) hue-rotate(-8deg)',
  vintage: 'sepia(0.7) saturate(0.8) brightness(1.08)',
};

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

export default function App() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('Summer Reels V1');
  const [filterName, setFilterName] = useState<keyof typeof filterPresets>('none');
  const [textInput, setTextInput] = useState('Your slogan here');
  const [audioTrack, setAudioTrack] = useState<AudioTrack | null>(null);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<Overlay[]>([
    { id: crypto.randomUUID(), text: 'Memories', x: 30, y: 70 },
  ]);

  const activeClip = useMemo(
    () => clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null,
    [activeClipId, clips]
  );

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

  const exportProject = () => {
    const projectData = {
      title: projectTitle,
      filter: filterName,
      audioTrack: audioTrack ? { id: audioTrack.id, name: audioTrack.name } : null,
      clips: clips.map(({ id, name, duration, trimStart, trimEnd }) => ({
        id,
        name,
        duration,
        trimStart,
        trimEnd,
      })),
      overlays,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], {
      type: 'application/json',
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectTitle.replace(/\s+/g, '-').toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
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
              <audio controls src={audioTrack.url} />
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Filters</h3>
          <div className="chip-row">
            {Object.entries(filterPresets).map(([key, value]) => (
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
          <button className="primary-button" onClick={exportProject}>
            Export project
          </button>
        </header>

        <section className="preview-card">
          {activeClip ? (
            <>
              <div className="preview-header">
                <strong>{activeClip.name}</strong>
                <span>{formatSeconds(activeClip.duration)}</span>
              </div>

              <div className="video-wrap">
                <video
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
                    onChange={(event) =>
                      updateActiveClip({
                        trimStart: Number(event.target.value),
                      })
                    }
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
                    onChange={(event) =>
                      updateActiveClip({
                        trimEnd: Number(event.target.value),
                      })
                    }
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
                      width: `${Math.max(
                        ((clip.trimEnd - clip.trimStart) / Math.max(clip.duration, 1)) * 100,
                        18
                      )}%`,
                    }}
                  >
                    <span>{clip.name}</span>
                    <small>
                      {formatSeconds(clip.trimStart)} → {formatSeconds(clip.trimEnd)}
                    </small>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
