'use client';

import { useState, useRef } from 'react';
import {
  createRandomGenome,
  GENOME_PRESETS,
  getAggression,
} from '../lib/simulation/genome';
import { BIOMES } from '../lib/simulation/biome';
import { useCreaturePreview } from '../hooks/useCreaturePreview';

interface CreatureGenesisProps {
  onClose: () => void;
  onRelease: (genome: Float32Array) => void;
  onBiomeHover: (biomeId: number | null) => void;
}

const GENE_META = [
  { label: 'Speed',      low: 'Plodder',   mid: 'Jogger',    high: 'Sprinter',    gradient: 'linear-gradient(to right,#0a3040,#22d3ee)' },
  { label: 'Size',       low: 'Tiny',       mid: 'Average',   high: 'Massive',     gradient: 'linear-gradient(to right,#3b1507,#fb923c)' },
  { label: 'Vision',     low: 'Blind',      mid: 'Keen',      high: 'Eagle-eyed',  gradient: 'linear-gradient(to right,#1e0a40,#a78bfa)' },
  { label: 'Metabolism', low: 'Efficient',  mid: 'Moderate',  high: 'Ravenous',    gradient: 'linear-gradient(to right,#3b0a22,#f472b6)' },
  { label: 'Hue',        low: '← Red',      mid: '↔ Green',   high: '→ Violet',    gradient: 'linear-gradient(to right,hsl(0,70%,40%),hsl(60,70%,40%),hsl(120,70%,40%),hsl(180,70%,40%),hsl(240,70%,40%),hsl(300,70%,40%),hsl(360,70%,40%))' },
  { label: 'Saturation', low: 'Muted',      mid: 'Vivid',     high: 'Blazing',     gradient: 'linear-gradient(to right,#1a1a2e,#fbbf24)' },
  { label: 'Aggression', low: 'Gentle',     mid: 'Cautious',  high: 'Ferocious',   gradient: 'linear-gradient(to right,#052e16,#7f1d1d)' },
  { label: 'Camouflage', low: 'Visible',    mid: 'Blended',   high: 'Invisible',   gradient: 'linear-gradient(to right,#0f172a,#34d399)' },
] as const;

const BIOME_ICONS = ['🌾', '🌲', '🏜️', '🌊', '❄️'] as const;
const BIOME_LABELS = ['Savanna', 'Forest', 'Desert', 'Ocean', 'Tundra'] as const;

function getDescriptor(meta: (typeof GENE_META)[number], v: number): string {
  if (v < 0.33) return meta.low;
  if (v < 0.67) return meta.mid;
  return meta.high;
}

function computeBiomeScore(genes: number[], biomeId: number): number {
  const biome = BIOMES[biomeId];
  const speed = genes[0];
  const size  = genes[1];
  const camo  = genes[7];
  const speedScore = Math.min(1, (speed * 0.8 + 0.2) / biome.move_cost);
  const camoScore  = Math.min(1, 0.35 + camo * biome.camo_advantage * 0.65);
  const foodScore  = Math.min(1, biome.food / (0.3 + size * 0.7));
  return Math.max(0, Math.round(((speedScore + camoScore + foodScore) / 3) * 100));
}

function scoreColor(score: number) {
  if (score >= 70) return { text: 'text-emerald-400', bar: '#10b981', border: 'border-emerald-700/40', bg: 'bg-emerald-950/40' };
  if (score >= 40) return { text: 'text-yellow-400',  bar: '#eab308', border: 'border-yellow-700/40',  bg: 'bg-yellow-950/40' };
  return            { text: 'text-red-400',    bar: '#ef4444', border: 'border-red-700/40',    bg: 'bg-red-950/40' };
}

export function CreatureGenesis({ onClose, onRelease, onBiomeHover }: CreatureGenesisProps) {
  const [genes, setGenes] = useState<number[]>(() => Array.from(createRandomGenome()));
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const genome = new Float32Array(genes);
  useCreaturePreview(canvasRef, genome);

  const isPredator = getAggression(genome) > 0.6;
  const creatureHue = genes[4] * 360;
  const creatureSat = 50 + genes[5] * 40;
  const creatureColor = `hsl(${creatureHue.toFixed(0)}, ${creatureSat.toFixed(0)}%, 45%)`;

  function handleGeneChange(i: number, v: number) {
    setGenes(prev => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    setSelectedPreset('');
  }

  function handleRandomize() {
    setGenes(Array.from(createRandomGenome()));
    setSelectedPreset('');
  }

  function handlePreset(name: string) {
    const preset = GENOME_PRESETS.find(p => p.name === name);
    if (preset) {
      setGenes(Array.from(preset.genome));
      setSelectedPreset(name);
    }
  }

  function handleRelease() {
    onRelease(new Float32Array(genes));
  }

  const biomeScores = BIOMES.map((_, i) => computeBiomeScore(genes, i));
  const bestBiomeId = biomeScores.indexOf(Math.max(...biomeScores));

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden select-none"
      style={{
        width: '320px',
        background: 'rgba(8, 14, 22, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(100, 220, 255, 0.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(100,220,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-cyan-500/70 uppercase tracking-[0.2em]">
            Genesis Lab
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
            style={{
              background: isPredator ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: isPredator ? '#fca5a5' : '#6ee7b7',
              border: `1px solid ${isPredator ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            }}>
            {isPredator ? '⚔ Predator' : '◎ Prey'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-300 transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
        >
          ×
        </button>
      </div>

      {/* ── Section 1: Gene Designer ── */}
      <div className="flex flex-col gap-1 px-4 pt-3 pb-2 shrink-0" style={{ flex: '4' }}>
        {/* Toolbar: Randomize + Presets */}
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={handleRandomize}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-gray-400 hover:text-cyan-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            🎲 Randomize
          </button>
          <select
            value={selectedPreset}
            onChange={e => handlePreset(e.target.value)}
            className="flex-1 px-2 py-1 rounded text-[10px] font-mono text-gray-400 appearance-none cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: selectedPreset ? '#67e8f9' : '#9ca3af',
            }}
          >
            <option value="">Presets…</option>
            {GENOME_PRESETS.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-2">
          {GENE_META.map((meta, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
                  {meta.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-gray-600 italic">
                    {getDescriptor(meta, genes[i])}
                  </span>
                  <span className="text-[9px] font-mono text-cyan-400/60 w-6 text-right">
                    {genes[i].toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="relative h-3 flex items-center">
                {/* Gradient track background */}
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    background: meta.gradient,
                    height: '3px',
                    left: 0, right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.45,
                  }}
                />
                <input
                  type="range"
                  min="0" max="1" step="0.01"
                  value={genes[i]}
                  onChange={e => handleGeneChange(i, parseFloat(e.target.value))}
                  className="relative w-full appearance-none bg-transparent cursor-pointer h-3
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:shadow-[0_0_5px_rgba(100,220,255,0.6)]
                    [&::-webkit-slider-runnable-track]:h-[3px]
                    [&::-webkit-slider-runnable-track]:rounded-full
                    [&::-webkit-slider-runnable-track]:bg-transparent"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(100,220,255,0.07)' }} />

      {/* ── Section 2: Live Preview ── */}
      <div className="flex flex-col items-center py-3 px-4 shrink-0 gap-2" style={{ flex: '3' }}>
        <div className="text-[9px] font-mono text-gray-600 uppercase tracking-[0.15em] self-start">
          Live Preview
        </div>
        <div className="flex items-center gap-4">
          {/* Canvas */}
          <div
            className="rounded-xl overflow-hidden shrink-0"
            style={{
              width: 120, height: 120,
              border: '1px solid rgba(100,220,255,0.1)',
              boxShadow: `0 0 20px ${creatureColor}22, inset 0 0 10px rgba(0,0,0,0.5)`,
            }}
          >
            <canvas ref={canvasRef} width={120} height={120} />
          </div>

          {/* Stat badges + info */}
          <div className="flex flex-col gap-2 flex-1">
            <div
              className="px-2 py-1 rounded text-[9px] font-mono text-center"
              style={{
                background: isPredator ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                border: `1px solid ${isPredator ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
                color: isPredator ? '#fca5a5' : '#6ee7b7',
              }}
            >
              {isPredator ? '⚔ Predator' : '◎ Prey'}
            </div>
            <div
              className="px-2 py-1 rounded text-[9px] font-mono text-center"
              style={{
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.2)',
                color: '#c4b5fd',
              }}
            >
              Generation 0
            </div>
            <div
              className="px-2 py-1 rounded text-[9px] font-mono text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#9ca3af',
              }}
            >
              <span>r={`${(4 + genes[1] * 10).toFixed(1)}`}px</span>
              <span className="mx-1 text-gray-700">·</span>
              <span>v={`${(1 + genes[0] * 4).toFixed(1)}`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(100,220,255,0.07)' }} />

      {/* ── Section 3: Biome Compatibility ── */}
      <div className="flex flex-col py-3 px-4 shrink-0 gap-2" style={{ flex: '3' }}>
        <div className="text-[9px] font-mono text-gray-600 uppercase tracking-[0.15em]">
          Biome Compatibility
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {biomeScores.map((score, biomeId) => {
            const { text, bar, border, bg } = scoreColor(score);
            const isBest = biomeId === bestBiomeId;
            return (
              <button
                key={biomeId}
                onMouseEnter={() => onBiomeHover(biomeId)}
                onMouseLeave={() => onBiomeHover(null)}
                className={`flex flex-col items-center py-1.5 px-1 rounded-lg transition-all ${bg} cursor-default`}
                style={{
                  border: `1px solid ${isBest ? 'rgba(100,220,255,0.35)' : border.replace('border-', '')}`,
                  boxShadow: isBest ? '0 0 8px rgba(100,220,255,0.2)' : 'none',
                }}
              >
                <span className="text-base leading-none mb-1">{BIOME_ICONS[biomeId]}</span>
                <span className="text-[8px] font-mono text-gray-600">{BIOME_LABELS[biomeId]}</span>
                {/* Score bar */}
                <div className="w-full mt-1.5" style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px' }}>
                  <div
                    style={{
                      width: `${score}%`,
                      height: '100%',
                      borderRadius: '1px',
                      background: bar,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span className={`text-[9px] font-mono mt-0.5 ${text}`}>{score}%</span>
              </button>
            );
          })}
        </div>
        <div className="text-[8px] font-mono text-gray-700 text-center">
          Best fit: <span className="text-cyan-500/70">{BIOME_LABELS[bestBiomeId]} {BIOME_ICONS[bestBiomeId]}</span> — hover to highlight on map
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(100,220,255,0.07)' }} />

      {/* ── Release Button ── */}
      <div className="px-4 py-3 shrink-0">
        <button
          onClick={handleRelease}
          className="w-full py-2.5 rounded-lg font-mono text-xs font-bold tracking-wider transition-all group"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.15))',
            border: '1px solid rgba(6,182,212,0.3)',
            color: '#67e8f9',
            boxShadow: '0 0 12px rgba(6,182,212,0.1)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(6,182,212,0.28), rgba(16,185,129,0.28))';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(6,182,212,0.25)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(16,185,129,0.15))';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(6,182,212,0.1)';
          }}
        >
          🧬 Release into World
        </button>
      </div>
    </div>
  );
}
