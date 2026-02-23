'use client';

import { useState, useEffect } from 'react';
import { SimStats } from '../hooks/useSimulation';
import { World, BiomeStat } from '../lib/simulation/world';

interface GodPanelProps {
  stats: SimStats;
  isPaused: boolean;
  speed: number;
  worldRef: React.RefObject<World | null>;
  onTogglePause: () => void;
  onSetSpeed: (s: number) => void;
  onSetMutationRate: (r: number) => void;
  onSetFoodAbundance: (a: number) => void;
  onExtinctionEvent: () => void;
  onRestart: () => void;
  onCreateToggle: () => void;
  genesisOpen: boolean;
}

const SPEED_OPTIONS = [1, 5, 20] as const;

export function GodPanel({
  stats,
  isPaused,
  speed,
  worldRef,
  onTogglePause,
  onSetSpeed,
  onSetMutationRate,
  onSetFoodAbundance,
  onExtinctionEvent,
  onRestart,
  onCreateToggle,
  genesisOpen,
}: GodPanelProps) {
  const [mutationRate, setMutationRate] = useState(0.02);
  const [foodAbundance, setFoodAbundance] = useState(1);
  const [biomesOpen, setBiomesOpen] = useState(false);
  const [biomeStats, setBiomeStats] = useState<BiomeStat[]>([]);

  useEffect(() => {
    if (biomesOpen && worldRef.current) {
      setBiomeStats(worldRef.current.getBiomeStats());
    } else {
      setBiomeStats([]);
    }
  }, [biomesOpen, worldRef]);

  function handleMutationChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setMutationRate(v);
    onSetMutationRate(v);
  }

  function handleFoodChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setFoodAbundance(v);
    onSetFoodAbundance(v);
  }

  return (
    <div className="relative h-full">
      {/* Biomes popup */}
      {biomesOpen && (
        <div className="absolute bottom-full left-0 right-0 bg-[#0d1117] border border-gray-700 rounded-t-lg p-3 z-20 max-h-64 overflow-y-auto">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
            Biome Statistics
          </div>
          <div className="grid grid-cols-1 gap-2">
            {biomeStats.map((bs) => (
              <div key={bs.biomeId} className="bg-gray-900/60 rounded p-2 text-[10px] font-mono">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-300 font-bold">{bs.name}</span>
                  <span className="text-gray-500">
                    {bs.creatureCount} creatures
                    {bs.speciationCount > 0 && (
                      <span className="text-purple-400 ml-1">
                        {bs.speciationCount}⊕
                      </span>
                    )}
                  </span>
                </div>
                {bs.dominantSpeciesLabel && bs.creatureCount > 0 && (
                  <div className="text-gray-500 mb-1">
                    Dominant:{' '}
                    <span className="text-emerald-400 italic">{bs.dominantSpeciesLabel}</span>
                  </div>
                )}
                {bs.creatureCount > 0 && (
                  <div className="space-y-0.5">
                    <TraitBar label="Speed" value={bs.avgSpeed} max={5} color="sky" />
                    <TraitBar label="Size" value={bs.avgSize} max={14} color="orange" />
                    <TraitBar label="Camo" value={bs.avgCamouflage} max={1} color="purple" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="h-full flex items-center gap-4 px-4 bg-[#0d1117] border-t border-gray-800 text-xs text-gray-400 overflow-x-auto">
        {/* Stats */}
        <div className="flex gap-4 shrink-0 font-mono">
          <Stat label="GEN" value={stats.generation} />
          <Stat label="TICK" value={stats.tick} />
          <Stat label="POP" value={stats.population} />
          <Stat label="PRED" value={stats.predatorCount} />
          <Stat label="PREY" value={stats.preyCount} />
          <Stat label="SPP" value={stats.livingSpecies} />
          <Stat label="EXT†" value={stats.extinctSpecies} />
          <Stat label="AVG_v" value={stats.avgSpeed.toFixed(1)} />
          <Stat label="FPS" value={stats.fps} />
        </div>

        <div className="w-px h-6 bg-gray-700 shrink-0" />

        {/* Biomes toggle */}
        <button
          onClick={() => setBiomesOpen((o) => !o)}
          className={`px-2 py-0.5 rounded border text-xs font-mono transition-colors shrink-0 ${
            biomesOpen
              ? 'bg-teal-800 border-teal-600 text-teal-200'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-teal-700 hover:text-teal-400'
          }`}
        >
          🌍 Biomes
        </button>

        {/* Create Creature toggle */}
        <button
          onClick={onCreateToggle}
          className={`px-2 py-0.5 rounded border text-xs font-mono transition-colors shrink-0 ${
            genesisOpen
              ? 'bg-cyan-900 border-cyan-600 text-cyan-200'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-cyan-700 hover:text-cyan-400'
          }`}
        >
          🧬 Create
        </button>

        <div className="w-px h-6 bg-gray-700 shrink-0" />

        {/* Mutation rate */}
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500">Mutation</span>
          <input
            type="range"
            min="0.001"
            max="0.1"
            step="0.001"
            value={mutationRate}
            onChange={handleMutationChange}
            className="w-20 accent-emerald-500"
          />
          <span className="text-gray-400 font-mono w-10">{mutationRate.toFixed(3)}</span>
        </label>

        {/* Food abundance */}
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500">Food</span>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            value={foodAbundance}
            onChange={handleFoodChange}
            className="w-20 accent-green-500"
          />
          <span className="text-gray-400 font-mono w-8">{foodAbundance.toFixed(1)}x</span>
        </label>

        <div className="w-px h-6 bg-gray-700 shrink-0" />

        {/* Speed */}
        <div className="flex gap-1 shrink-0">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSetSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                speed === s
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Pause/Resume */}
        <button
          onClick={onTogglePause}
          className={`px-3 py-0.5 rounded border text-xs font-mono transition-colors shrink-0 ${
            isPaused
              ? 'bg-yellow-600 border-yellow-500 text-white hover:bg-yellow-500'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        {/* Extinction Event */}
        <button
          onClick={onExtinctionEvent}
          className="px-3 py-0.5 rounded border border-red-800 text-red-400 bg-gray-900 hover:bg-red-950 hover:border-red-600 text-xs font-mono transition-colors shrink-0"
        >
          ☄ Extinction
        </button>

        {/* Restart */}
        <button
          onClick={onRestart}
          className="px-3 py-0.5 rounded border border-gray-700 text-gray-500 bg-gray-900 hover:border-gray-500 hover:text-gray-300 text-xs font-mono transition-colors shrink-0"
        >
          ↺ Restart
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-gray-600 text-[9px] leading-none">{label}</span>
      <span className="text-gray-300 font-mono text-xs leading-none mt-0.5">
        {value}
      </span>
    </div>
  );
}

function TraitBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorMap: Record<string, string> = {
    sky: 'bg-sky-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
  };
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-600 w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded">
        <div
          className={`h-full rounded ${colorMap[color] ?? 'bg-gray-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-gray-500 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}
