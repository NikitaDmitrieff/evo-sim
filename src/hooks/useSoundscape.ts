'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { World, SpeciationEvent } from '../lib/simulation/world';
import { EcosystemSoundscape, SoundscapeSettings } from '../lib/audio/EcosystemSoundscape';

export interface SoundscapeControls {
  initialized: boolean;
  settings: SoundscapeSettings;
  setMuted: (v: boolean) => void;
  setMasterVolume: (v: number) => void;
  setSpeciesVoicesMix: (v: number) => void;
  setEventsMix: (v: number) => void;
  setPulseMix: (v: number) => void;
}

interface SoundscapeInput {
  worldRef: React.RefObject<World | null>;
  speciationEvents: SpeciationEvent[];
  /** Changing tick triggers an audio update; pass stats.tick */
  tick: number;
}

export function useSoundscape({ worldRef, speciationEvents, tick }: SoundscapeInput): SoundscapeControls {
  const soundscapeRef = useRef<EcosystemSoundscape | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [settings, setSettings] = useState<SoundscapeSettings>({
    muted: false,
    masterVolume: 0.7,
    speciesVoicesMix: 0.7,
    eventsMix: 0.8,
    pulseMix: 0.6,
  });

  // Create the soundscape instance once
  useEffect(() => {
    soundscapeRef.current = new EcosystemSoundscape();
    return () => {
      soundscapeRef.current?.destroy();
      soundscapeRef.current = null;
    };
  }, []);

  // Lazily initialize AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    const handler = () => {
      const sc = soundscapeRef.current;
      if (sc && !sc.isInitialized()) {
        sc.initializeAudio();
        setInitialized(true);
      }
    };
    window.addEventListener('click', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  // Call update on every stats tick
  useEffect(() => {
    const sc = soundscapeRef.current;
    const world = worldRef.current;
    if (!sc || !sc.isInitialized() || !world) return;
    sc.update(world, speciationEvents);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, speciationEvents]);

  // ─── Setters (stable references via useCallback) ──────────────────────────

  const setMuted = useCallback((v: boolean) => {
    soundscapeRef.current?.setMuted(v);
    setSettings(prev => ({ ...prev, muted: v }));
  }, []);

  const setMasterVolume = useCallback((v: number) => {
    soundscapeRef.current?.setMasterVolume(v);
    setSettings(prev => ({ ...prev, masterVolume: v }));
  }, []);

  const setSpeciesVoicesMix = useCallback((v: number) => {
    soundscapeRef.current?.setSpeciesVoicesMix(v);
    setSettings(prev => ({ ...prev, speciesVoicesMix: v }));
  }, []);

  const setEventsMix = useCallback((v: number) => {
    soundscapeRef.current?.setEventsMix(v);
    setSettings(prev => ({ ...prev, eventsMix: v }));
  }, []);

  const setPulseMix = useCallback((v: number) => {
    soundscapeRef.current?.setPulseMix(v);
    setSettings(prev => ({ ...prev, pulseMix: v }));
  }, []);

  return {
    initialized,
    settings,
    setMuted,
    setMasterVolume,
    setSpeciesVoicesMix,
    setEventsMix,
    setPulseMix,
  };
}
