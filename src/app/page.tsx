'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { SimulationCanvas } from '../components/SimulationCanvas';
import { PhyloTree } from '../components/PhyloTree';
import { GodPanel } from '../components/GodPanel';
import { BiomePainter } from '../components/BiomePainter';
import { useSoundscape } from '../hooks/useSoundscape';
import { AudioPanel } from '../components/AudioPanel';
import { BIOME_NAMES } from '../lib/simulation/biome';
import { AdaptiveRadiationEvent } from '../lib/simulation/world';

interface RadiationBurst {
  x: number;
  y: number;
  startTime: number;
  biomeType: number;
  colors: string[];
}

export default function Home() {
  const {
    worldRef,
    stats,
    speciationEvents,
    adaptiveRadiationEvents,
    isPaused,
    speed,
    restart,
    setMutationRate,
    setFoodAbundance,
    triggerExtinction,
    togglePause,
    setSpeed,
  } = useSimulation();

  const soundscapeControls = useSoundscape({
    worldRef,
    speciationEvents,
    tick: stats.tick,
  });

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [extinctionFlash, setExtinctionFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Biome painter state
  const [selectedBiome, setSelectedBiome] = useState<number | null>(null);
  const [brushSize, setBrushSize] = useState(2);

  // Migration flow overlay (toggled by M key)
  const [showMigrationFlow, setShowMigrationFlow] = useState(false);

  // Radiation bursts for canvas animation
  const [radiationBursts, setRadiationBursts] = useState<RadiationBurst[]>([]);

  // HUD notification for adaptive radiation
  const [radiationNotification, setRadiationNotification] = useState<string | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleExtinctionEvent() {
    triggerExtinction();
    setExtinctionFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setExtinctionFlash(false), 800);
  }

  const [speciesLabels, setSpeciesLabels] = useState<Map<string, string>>(
    new Map([['primordial', 'Primordial']])
  );
  const [speciesColors, setSpeciesColors] = useState<Map<string, string>>(
    new Map([['primordial', 'hsl(140, 65%, 45%)']])
  );
  const [extinctionHistory, setExtinctionHistory] = useState<Array<{ tick: number; speciesId: string }>>([]);

  // Sync from world on each speciation event
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    setSpeciesLabels(new Map(world.speciesLabels));
    setSpeciesColors(new Map(world.speciesColors));
    setExtinctionHistory([...world.extinctionHistory]);
  }, [speciationEvents.length, worldRef]);

  const handleRadiationEvent = useCallback((event: AdaptiveRadiationEvent) => {
    // Add burst animation
    const burst: RadiationBurst = {
      x: event.epicenterX,
      y: event.epicenterY,
      startTime: Date.now(),
      biomeType: event.biomeType,
      colors: event.speciesColors,
    };
    setRadiationBursts((prev) => [...prev.filter(b => Date.now() - b.startTime < 2000), burst]);

    // Find dominant species name for notification
    const world = worldRef.current;
    let speciesName = 'Unknown Species';
    if (world) {
      const nearby = world.getCreaturesInRadius(
        { x: event.epicenterX, y: event.epicenterY },
        150,
        ''
      );
      if (nearby.length > 0) {
        const speciesCounts = new Map<string, number>();
        for (const c of nearby) {
          speciesCounts.set(c.speciesId, (speciesCounts.get(c.speciesId) ?? 0) + 1);
        }
        let topId = '';
        let topCount = 0;
        for (const [sid, cnt] of speciesCounts.entries()) {
          if (cnt > topCount) { topCount = cnt; topId = sid; }
        }
        speciesName = world.speciesLabels.get(topId) ?? topId;
      }
    }

    const biomeName = BIOME_NAMES[event.biomeType] ?? 'Unknown Biome';
    setRadiationNotification(
      `Adaptive Radiation Detected — ${speciesName} entering ${biomeName}`
    );
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => setRadiationNotification(null), 4000);
  }, [worldRef, notifTimerRef]);

  // Handle adaptive radiation events
  useEffect(() => {
    if (adaptiveRadiationEvents.length === 0) return;
    const latest = adaptiveRadiationEvents[adaptiveRadiationEvents.length - 1];
    // Defer to avoid setState-in-effect cascade
    setTimeout(() => handleRadiationEvent(latest), 0);
  }, [adaptiveRadiationEvents, handleRadiationEvent]);

  // M key: toggle migration flow
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'm' || e.key === 'M') {
        setShowMigrationFlow((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0d1117] overflow-hidden">
      <AudioPanel controls={soundscapeControls} />
      {/* Main panels */}
      <div className="flex flex-1 min-h-0">
        {/* Left 70%: Simulation Canvas */}
        <div className="relative flex-[7] min-w-0 min-h-0">
          <SimulationCanvas
            worldRef={worldRef}
            selectedSpeciesId={selectedSpeciesId}
            extinctionFlash={extinctionFlash}
            selectedBiome={selectedBiome}
            brushSize={brushSize}
            showMigrationFlow={showMigrationFlow}
            radiationBursts={radiationBursts}
          />

          {/* Biome Painter toolbar */}
          <BiomePainter
            selectedBiome={selectedBiome}
            brushSize={brushSize}
            onSelectBiome={setSelectedBiome}
            onSetBrushSize={setBrushSize}
          />

          {/* Stats HUD overlay */}
          <div className="absolute top-3 left-12 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-xs font-mono text-gray-300 space-y-0.5 pointer-events-none border border-gray-800/50">
            <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">
              EcoSim
            </div>
            <div>
              <span className="text-gray-500">Gen </span>
              <span className="text-emerald-400">{stats.generation}</span>
              <span className="text-gray-600 mx-1">·</span>
              <span className="text-gray-500">Tick </span>
              <span className="text-gray-300">{stats.tick}</span>
            </div>
            <div>
              <span className="text-gray-500">Pop </span>
              <span className="text-white">{stats.population}</span>
              <span className="text-gray-600 mx-1">·</span>
              <span className="text-red-400">{stats.predatorCount}P</span>
              <span className="text-gray-600"> / </span>
              <span className="text-green-400">{stats.preyCount}H</span>
            </div>
            <div>
              <span className="text-gray-500">Spp </span>
              <span className="text-purple-400">{stats.livingSpecies} living</span>
              <span className="text-gray-600 mx-1">·</span>
              <span className="text-gray-600">{stats.extinctSpecies}†</span>
            </div>
            <div>
              <span className="text-gray-500">Avg v̄ </span>
              <span className="text-sky-400">{stats.avgSpeed.toFixed(2)}</span>
              <span className="text-gray-500"> sz </span>
              <span className="text-orange-400">{stats.avgSize.toFixed(1)}</span>
            </div>
            {selectedSpeciesId && (
              <div className="mt-1 pt-1 border-t border-gray-700">
                <span className="text-yellow-400">
                  ● {speciesLabels.get(selectedSpeciesId) ?? selectedSpeciesId}
                </span>
              </div>
            )}
            {showMigrationFlow && (
              <div className="mt-1 pt-1 border-t border-gray-700">
                <span className="text-teal-400 text-[9px]">Migration flow ON (M)</span>
              </div>
            )}
          </div>

          {/* Adaptive radiation notification */}
          {radiationNotification && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-900/80 border border-amber-600 rounded-lg px-4 py-2 text-xs font-mono text-amber-200 pointer-events-none backdrop-blur-sm animate-pulse">
              ⚡ {radiationNotification}
            </div>
          )}

          {/* Active biome indicator */}
          {selectedBiome !== null && (
            <div className="absolute top-3 right-3 bg-black/70 border border-gray-600 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-300 pointer-events-none">
              <span className="text-gray-500">Painting: </span>
              <span className="text-white">{BIOME_NAMES[selectedBiome]}</span>
              <span className="text-gray-500 ml-2">r={brushSize}</span>
            </div>
          )}
        </div>

        {/* Right 30%: Phylogenetic Tree */}
        <div className="flex-[3] min-w-0 min-h-0 bg-[#080d13] border-l border-gray-800 flex flex-col">
          <div className="px-3 pt-3 pb-1 border-b border-gray-800/60">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-widest">
              Phylogenetic Tree
            </div>
            <div className="text-[10px] text-gray-700 mt-0.5">
              Click a node to highlight species · ⛰ = allopatric
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PhyloTree
              speciationEvents={speciationEvents}
              extinctionHistory={extinctionHistory}
              currentTick={stats.tick}
              selectedSpeciesId={selectedSpeciesId}
              onSelectSpecies={setSelectedSpeciesId}
              speciesLabels={speciesLabels}
              speciesColors={speciesColors}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-12 shrink-0">
        <GodPanel
          stats={stats}
          isPaused={isPaused}
          speed={speed}
          worldRef={worldRef}
          onTogglePause={togglePause}
          onSetSpeed={setSpeed}
          onSetMutationRate={setMutationRate}
          onSetFoodAbundance={setFoodAbundance}
          onExtinctionEvent={handleExtinctionEvent}
          onRestart={restart}
        />
      </div>
    </div>
  );
}
