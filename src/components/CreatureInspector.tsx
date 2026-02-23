'use client';

import { useRef, useState, useEffect } from 'react';
import { Creature } from '../lib/simulation/creature';
import { World } from '../lib/simulation/world';
import { BIOME_NAMES, CELL_SIZE } from '../lib/simulation/biome';
import { useCreaturePreview } from '../hooks/useCreaturePreview';

const GENE_NAMES = ['Speed', 'Size', 'Vision', 'Metab.', 'Hue', 'Sat.', 'Aggr.', 'Camo.'];
const N_AXES = 8;
const SVG_W = 252;
const SVG_H = 162;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const MAX_R = Math.min(CX, CY) * 0.68;

const BIOME_SWATCH_COLORS = ['#6b7e6b', '#1f5c1f', '#c4a444', '#1450a0', '#8aaec8'];

interface CreatureInspectorProps {
  creature: Creature;
  speciesLabel: string;
  speciesColor: string;
  worldRef: React.RefObject<World | null>;
  onClose: () => void;
  speciesLabels: Map<string, string>;
}

interface LiveData {
  age: number;
  energy: number;
  offspringCount: number;
  killCount: number;
  foodEaten: number;
  biomeId: number;
  currentBehavior: Creature['currentBehavior'];
  behaviorTargetSpecies: string | null;
  siblings: number;
  siblingColors: string[];
  isDead: boolean;
  generation: number;
  avgGenome: number[];
}

function computeAvgGenome(world: World): number[] {
  const avg = new Array(8).fill(0);
  let count = 0;
  for (const c of world.creatures.values()) {
    if (c.dead) continue;
    for (let i = 0; i < 8; i++) avg[i] += c.genome[i];
    count++;
  }
  if (count > 0) for (let i = 0; i < 8; i++) avg[i] /= count;
  return avg;
}

function toOctagonPoints(values: number[], cx: number, cy: number, maxR: number): string {
  return values
    .map((v, i) => {
      const angle = (-Math.PI / 2) + (2 * Math.PI / N_AXES) * i;
      const r = v * maxR;
      return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
    })
    .join(' ');
}

export function CreatureInspector({
  creature,
  speciesLabel,
  speciesColor,
  worldRef,
  onClose,
  speciesLabels,
}: CreatureInspectorProps) {
  const portraitRef = useRef<HTMLCanvasElement>(null);
  useCreaturePreview(portraitRef, creature.genome);

  const [liveData, setLiveData] = useState<LiveData>({
    age: creature.age,
    energy: creature.energy,
    offspringCount: creature.offspringCount,
    killCount: creature.killCount,
    foodEaten: creature.foodEaten,
    biomeId: 0,
    currentBehavior: creature.currentBehavior,
    behaviorTargetSpecies: creature.behaviorTargetSpecies,
    siblings: 0,
    siblingColors: [],
    isDead: creature.dead,
    generation: 0,
    avgGenome: Array.from(creature.genome),
  });

  const [visible, setVisible] = useState(false);
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const update = () => {
      const world = worldRef.current;
      if (!world) return;

      const gx = Math.floor(creature.position.x / CELL_SIZE);
      const gy = Math.floor(creature.position.y / CELL_SIZE);
      const biomeId = world.getBiomeId(gx, gy);

      let siblings = 0;
      const siblingColors: string[] = [];
      if (creature.ancestorId) {
        for (const c of world.creatures.values()) {
          if (c.dead || c.id === creature.id) continue;
          if (c.ancestorId !== creature.ancestorId) continue;
          siblings++;
          const col = world.speciesColors.get(c.speciesId) ?? speciesColor;
          if (siblingColors.length < 14) siblingColors.push(col);
        }
      }

      setLiveData({
        age: creature.age,
        energy: creature.energy,
        offspringCount: creature.offspringCount,
        killCount: creature.killCount,
        foodEaten: creature.foodEaten,
        biomeId,
        currentBehavior: creature.currentBehavior,
        behaviorTargetSpecies: creature.behaviorTargetSpecies,
        siblings,
        siblingColors,
        isDead: creature.dead,
        generation: world.generation,
        avgGenome: computeAvgGenome(world),
      });
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [creature, worldRef, speciesColor]);

  const isPredator = creature.aggression > 0.6;
  const lineageIcon = creature.isDesigned ? '⚗️' : '🧬';

  const energyPct = Math.max(0, Math.min(100, liveData.energy));
  const energyColor =
    energyPct > 50 ? '#4ade80' : energyPct > 25 ? '#facc15' : '#f87171';

  const getBehavior = () => {
    const targetLabel =
      liveData.behaviorTargetSpecies
        ? (speciesLabels.get(liveData.behaviorTargetSpecies) ?? 'unknown')
        : null;
    switch (liveData.currentBehavior) {
      case 'fleeing':
        return { icon: '🏃', label: `Fleeing from ${targetLabel ?? 'threat'}` };
      case 'hunting':
        return { icon: '🎯', label: `Hunting ${targetLabel ?? 'prey'}` };
      case 'foraging':
        return { icon: '🍃', label: 'Foraging for food' };
      default:
        return { icon: '🌀', label: 'Wandering' };
    }
  };

  const behavior = getBehavior();

  const parentSpeciesLabel = creature.parentSpeciesId
    ? (speciesLabels.get(creature.parentSpeciesId) ?? creature.parentSpeciesId)
    : null;

  const creatureGenomeArr = Array.from(creature.genome);
  const creaturePoints = toOctagonPoints(creatureGenomeArr, CX, CY, MAX_R);
  const avgPoints = toOctagonPoints(liveData.avgGenome, CX, CY, MAX_R);
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <>
      <style>{`
        @keyframes creatureBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes breatheAura {
          0%, 100% { transform: scale(0.88); opacity: 0.08; }
          50% { transform: scale(1.12); opacity: 0.22; }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'flex-start',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            marginTop: 8,
            marginRight: 8,
            width: 280,
            maxHeight: 'calc(100% - 16px)',
            overflowY: 'auto',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: 'rgba(5,5,15,0.88)',
            border: `1px solid ${speciesColor}55`,
            borderRadius: 10,
            boxShadow: `0 0 24px ${speciesColor}18, 0 8px 40px rgba(0,0,0,0.6)`,
            transform: visible ? 'translateX(0)' : 'translateX(110%)',
            transition: 'transform 300ms ease-out',
            scrollbarWidth: 'thin',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderBottom: `1px solid ${speciesColor}28`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{lineageIcon}</span>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  color: speciesColor,
                  letterSpacing: '0.02em',
                }}
              >
                {speciesLabel}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: `${speciesColor}18`,
                  color: speciesColor,
                  letterSpacing: '0.05em',
                }}
              >
                GEN {liveData.generation}
              </span>
              <button
                onClick={onClose}
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.07)',
                  border: 'none',
                  borderRadius: 4,
                  color: 'rgba(150,160,180,0.8)',
                  fontSize: 14,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Portrait */}
          <div
            style={{
              height: 160,
              background: '#040810',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ animation: 'creatureBob 2s ease-in-out infinite', position: 'relative' }}>
              <canvas
                ref={portraitRef}
                width={240}
                height={140}
                style={{ display: 'block' }}
              />
              {/* Breathing aura ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: '50%',
                    border: `2px solid ${speciesColor}`,
                    animation: 'breatheAura 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>

            {/* Predator / Herbivore badge */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 10,
                fontSize: 9,
                fontFamily: 'monospace',
                padding: '2px 6px',
                borderRadius: 3,
                background: isPredator ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.15)',
                color: isPredator ? '#f87171' : '#4ade80',
                border: `1px solid ${isPredator ? '#f8717130' : '#4ade8030'}`,
                letterSpacing: '0.06em',
              }}
            >
              {isPredator ? 'PREDATOR' : 'HERBIVORE'}
            </div>
          </div>

          {/* Genome Radar Chart */}
          <div style={{ padding: '6px 8px 0' }}>
            <div
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                color: 'rgba(120,135,160,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 2,
              }}
            >
              Genome Profile
            </div>
            <svg
              width={SVG_W}
              height={SVG_H}
              style={{ overflow: 'visible', display: 'block' }}
            >
              {/* Background grid octagons */}
              {gridLevels.map((level) => (
                <polygon
                  key={level}
                  points={toOctagonPoints(new Array(8).fill(level), CX, CY, MAX_R)}
                  fill="none"
                  stroke="rgba(255,255,255,0.055)"
                  strokeWidth={0.5}
                />
              ))}

              {/* Axis lines */}
              {GENE_NAMES.map((_, i) => {
                const angle = (-Math.PI / 2) + (2 * Math.PI / N_AXES) * i;
                return (
                  <line
                    key={i}
                    x1={CX}
                    y1={CY}
                    x2={(CX + MAX_R * Math.cos(angle)).toFixed(2)}
                    y2={(CY + MAX_R * Math.sin(angle)).toFixed(2)}
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* Population average polygon (white dashed) */}
              <polygon
                points={avgPoints}
                fill="none"
                stroke="rgba(255,255,255,0.32)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />

              {/* Creature polygon */}
              <polygon
                points={creaturePoints}
                fill={speciesColor}
                fillOpacity={0.38}
                stroke={speciesColor}
                strokeWidth={1.5}
              />

              {/* Vertex dots + invisible hit areas */}
              {creatureGenomeArr.map((v, i) => {
                const angle = (-Math.PI / 2) + (2 * Math.PI / N_AXES) * i;
                const r = v * MAX_R;
                const px = CX + r * Math.cos(angle);
                const py = CY + r * Math.sin(angle);
                return (
                  <g key={i}>
                    <circle cx={px} cy={py} r={2.5} fill={speciesColor} opacity={0.85} />
                    <circle
                      cx={px}
                      cy={py}
                      r={9}
                      fill="transparent"
                      onMouseEnter={() => setHoveredAxis(i)}
                      onMouseLeave={() => setHoveredAxis(null)}
                      style={{ cursor: 'crosshair' }}
                    />
                  </g>
                );
              })}

              {/* Axis labels */}
              {GENE_NAMES.map((name, i) => {
                const angle = (-Math.PI / 2) + (2 * Math.PI / N_AXES) * i;
                const labelR = MAX_R + 13;
                const lx = CX + labelR * Math.cos(angle);
                const ly = CY + labelR * Math.sin(angle);
                const anchor =
                  lx < CX - 3 ? 'end' : lx > CX + 3 ? 'start' : 'middle';
                return (
                  <text
                    key={i}
                    x={lx.toFixed(2)}
                    y={ly.toFixed(2)}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontSize={7}
                    fill="rgba(140,155,180,0.72)"
                    fontFamily="monospace"
                  >
                    {name}
                  </text>
                );
              })}

              {/* Hover tooltip */}
              {hoveredAxis !== null && (() => {
                const i = hoveredAxis;
                const v = creatureGenomeArr[i];
                const avg = liveData.avgGenome[i];
                const delta = v - avg;
                const angle = (-Math.PI / 2) + (2 * Math.PI / N_AXES) * i;
                const r = v * MAX_R;
                const px = CX + r * Math.cos(angle);
                const py = CY + r * Math.sin(angle);
                const tw = 98;
                const th = 20;
                const tx = Math.max(2, Math.min(px - tw / 2, SVG_W - tw - 2));
                const ty = py < CY ? py + 8 : py - th - 6;
                const label = `${GENE_NAMES[i]}: ${v.toFixed(2)} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`;
                return (
                  <g>
                    <rect
                      x={tx}
                      y={ty}
                      width={tw}
                      height={th}
                      rx={3}
                      fill="rgba(5,8,20,0.96)"
                      stroke="rgba(120,140,180,0.25)"
                      strokeWidth={0.5}
                    />
                    <text
                      x={tx + tw / 2}
                      y={ty + th / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={7}
                      fill="rgba(200,220,255,0.92)"
                      fontFamily="monospace"
                    >
                      {label}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Vital Stats Grid */}
          <div style={{ padding: '4px 8px 8px' }}>
            <div
              style={{
                fontSize: 8,
                fontFamily: 'monospace',
                color: 'rgba(120,135,160,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 4,
              }}
            >
              Vitals
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 3,
              }}
            >
              {/* Age */}
              <StatPill label="⌛ Age">
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(220,230,255,0.9)' }}>
                  {liveData.age > 0 ? liveData.age : '—'}
                </span>
              </StatPill>

              {/* Energy */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 5,
                  padding: '5px 7px',
                }}
              >
                <div style={{ fontSize: 8, color: 'rgba(130,145,170,0.8)', marginBottom: 3 }}>⚡ Energy</div>
                <div
                  style={{
                    height: 3,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    marginBottom: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${energyPct}%`,
                      height: '100%',
                      background: energyColor,
                      borderRadius: 2,
                      transition: 'width 0.2s ease, background-color 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 9, color: energyColor }}>
                  {energyPct.toFixed(0)}
                </span>
              </div>

              {/* Offspring */}
              <StatPill label="🌱 Offspring">
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(220,230,255,0.9)' }}>
                  {liveData.offspringCount}
                </span>
              </StatPill>

              {/* Kills (predator) or Food Eaten cell */}
              {isPredator ? (
                <StatPill label="💀 Kills">
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f87171' }}>
                    {liveData.killCount}
                  </span>
                </StatPill>
              ) : (
                <StatPill label="💀 Kills">
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(100,115,140,0.6)' }}>
                    —
                  </span>
                </StatPill>
              )}

              {/* Food Eaten */}
              <StatPill label="🌿 Food Eaten">
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#4ade80' }}>
                  {liveData.foodEaten}
                </span>
              </StatPill>

              {/* Biome */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 5,
                  padding: '5px 7px',
                }}
              >
                <div style={{ fontSize: 8, color: 'rgba(130,145,170,0.8)', marginBottom: 3 }}>🌍 Biome</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: BIOME_SWATCH_COLORS[liveData.biomeId] ?? '#888',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(200,215,240,0.85)' }}>
                    {BIOME_NAMES[liveData.biomeId] ?? 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Behavioral State */}
          <div style={{ padding: '0 8px 8px' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 5,
                padding: '7px 10px',
                minHeight: 36,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{behavior.icon}</span>
              <span
                style={{
                  fontSize: 10,
                  color: 'rgba(190,205,230,0.85)',
                  fontWeight: 300,
                  letterSpacing: '0.01em',
                }}
              >
                {behavior.label}
              </span>
            </div>
          </div>

          {/* Lineage */}
          {(parentSpeciesLabel || liveData.siblings > 0) && (
            <div
              style={{
                padding: '0 8px 12px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                marginTop: 2,
                paddingTop: 8,
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  fontFamily: 'monospace',
                  color: 'rgba(120,135,160,0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 4,
                }}
              >
                Lineage
              </div>
              {parentSpeciesLabel && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(160,175,205,0.8)',
                    marginBottom: liveData.siblings > 0 ? 5 : 0,
                  }}
                >
                  Descended from{' '}
                  <span
                    style={{ color: speciesColor, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
                  >
                    {parentSpeciesLabel}
                  </span>
                </div>
              )}
              {liveData.siblings > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: 'rgba(120,135,160,0.7)',
                      marginBottom: 4,
                    }}
                  >
                    {liveData.siblings} sibling{liveData.siblings !== 1 ? 's' : ''} alive
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {liveData.siblingColors.map((col, i) => (
                      <div
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: col,
                          opacity: 0.8,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatPill({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 5,
        padding: '5px 7px',
      }}
    >
      <div style={{ fontSize: 8, color: 'rgba(130,145,170,0.8)', marginBottom: 2 }}>{label}</div>
      {children}
    </div>
  );
}
