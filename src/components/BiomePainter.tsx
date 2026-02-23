'use client';

import { useEffect } from 'react';
import { BIOME_NAMES } from '../lib/simulation/biome';

const BIOME_COLORS = [
  '#c8a84b', // Savanna: golden
  '#225522', // Dense Forest: dark green
  '#d4b464', // Desert: sandy
  '#1450b4', // Deep Ocean: blue
  '#c8dcf0', // Arctic Tundra: pale blue
];

const BIOME_ICONS = ['🌾', '🌲', '🏜', '🌊', '❄'];

interface BiomePainterProps {
  selectedBiome: number | null;
  brushSize: number;
  onSelectBiome: (biome: number | null) => void;
  onSetBrushSize: (size: number) => void;
}

export function BiomePainter({
  selectedBiome,
  brushSize,
  onSelectBiome,
  onSetBrushSize,
}: BiomePainterProps) {
  // Keyboard shortcuts: 1-5 for biomes, Escape to deselect, [ / ] for brush
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key) - 1;
        onSelectBiome(selectedBiome === idx ? null : idx);
      } else if (e.key === 'Escape') {
        onSelectBiome(null);
      } else if (e.key === '[') {
        onSetBrushSize(Math.max(1, brushSize - 1));
      } else if (e.key === ']') {
        onSetBrushSize(Math.min(5, brushSize + 1));
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedBiome, brushSize, onSelectBiome, onSetBrushSize]);

  return (
    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-1.5 bg-black/70 backdrop-blur-sm border border-gray-700/60 rounded-lg p-1.5 pointer-events-auto">
      {/* Biome buttons */}
      {BIOME_NAMES.map((name, idx) => {
        const isSelected = selectedBiome === idx;
        return (
          <button
            key={idx}
            title={`${name} (key ${idx + 1})`}
            onClick={() => onSelectBiome(isSelected ? null : idx)}
            className={`w-8 h-8 rounded flex items-center justify-center text-base transition-all border ${
              isSelected
                ? 'border-white shadow-[0_0_8px_2px_rgba(255,255,255,0.4)] scale-110'
                : 'border-gray-600 hover:border-gray-400 hover:scale-105'
            }`}
            style={{
              backgroundColor: isSelected
                ? `${BIOME_COLORS[idx]}cc`
                : `${BIOME_COLORS[idx]}66`,
            }}
          >
            {BIOME_ICONS[idx]}
          </button>
        );
      })}

      {/* Eraser */}
      <button
        title="Eraser — reset to Savanna (key 1)"
        onClick={() => onSelectBiome(0)}
        className={`w-8 h-8 rounded flex items-center justify-center text-base transition-all border ${
          selectedBiome === 0
            ? 'border-white shadow-[0_0_8px_2px_rgba(255,255,255,0.4)] scale-110'
            : 'border-gray-600 hover:border-gray-400'
        } bg-gray-800`}
      >
        🧹
      </button>

      <div className="w-full h-px bg-gray-700 my-0.5" />

      {/* Brush size */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] text-gray-500 font-mono">
          {brushSize}r
        </span>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={brushSize}
          onChange={(e) => onSetBrushSize(parseInt(e.target.value))}
          className="w-6 h-16 accent-gray-400"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
      </div>
    </div>
  );
}
