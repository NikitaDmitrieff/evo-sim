'use client';

import { SoundscapeControls } from '../hooks/useSoundscape';

interface AudioPanelProps {
  controls: SoundscapeControls;
}

interface MixKnob {
  label: string;
  value: number;
  setter: (v: number) => void;
}

export function AudioPanel({ controls }: AudioPanelProps) {
  const {
    initialized,
    settings,
    setMuted,
    setMasterVolume,
    setSpeciesVoicesMix,
    setEventsMix,
    setPulseMix,
  } = controls;

  const mixKnobs: MixKnob[] = [
    { label: 'Voices', value: settings.speciesVoicesMix, setter: setSpeciesVoicesMix },
    { label: 'Events', value: settings.eventsMix, setter: setEventsMix },
    { label: 'Pulse', value: settings.pulseMix, setter: setPulseMix },
  ];

  return (
    <div
      className="fixed bottom-4 left-4 z-50 rounded-xl pointer-events-auto"
      style={{
        background: 'rgba(5, 8, 14, 0.62)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        padding: '10px 12px 11px',
        minWidth: '172px',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <button
          onClick={() => setMuted(!settings.muted)}
          className="text-sm leading-none transition-opacity"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          title={settings.muted ? 'Unmute' : 'Mute'}
          aria-label={settings.muted ? 'Unmute soundscape' : 'Mute soundscape'}
        >
          <span style={{ color: settings.muted ? '#4b5563' : '#6ee7b7', fontSize: '13px' }}>
            {settings.muted ? '🔇' : '🔊'}
          </span>
        </button>
        <span
          className="font-mono uppercase tracking-widest"
          style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em' }}
        >
          Soundscape
        </span>
        {!initialized && (
          <span
            className="font-mono"
            style={{ fontSize: '8px', color: 'rgba(255,255,255,0.18)', fontStyle: 'italic', marginLeft: 'auto' }}
          >
            off
          </span>
        )}
      </div>

      {/* Master volume */}
      <div className="mb-2.5">
        <div
          className="font-mono mb-1"
          style={{ fontSize: '8px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em' }}
        >
          MASTER
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.masterVolume}
          onChange={e => setMasterVolume(parseFloat(e.target.value))}
          className="w-full"
          style={{
            height: '2px',
            cursor: 'pointer',
            accentColor: '#6ee7b7',
          }}
        />
      </div>

      {/* Mix knobs (vertical sliders) */}
      <div
        className="flex gap-3 justify-between pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {mixKnobs.map(({ label, value, setter }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div style={{ height: '52px', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={e => setter(parseFloat(e.target.value))}
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                  width: '18px',
                  height: '48px',
                  cursor: 'pointer',
                  accentColor: '#93c5fd',
                }}
              />
            </div>
            <span
              className="font-mono text-center"
              style={{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
