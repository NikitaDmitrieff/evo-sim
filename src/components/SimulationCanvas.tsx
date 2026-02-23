'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { World } from '../lib/simulation/world';
import { getColor } from '../lib/simulation/genome';
import {
  BIOME_NAMES,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
} from '../lib/simulation/biome';


interface RadiationBurst {
  x: number;
  y: number;
  startTime: number;
  biomeType: number;
  colors: string[];
}

export interface InjectionAnimation {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTime: number;
}

interface SimulationCanvasProps {
  worldRef: React.RefObject<World | null>;
  selectedSpeciesId: string | null;
  extinctionFlash: boolean;
  selectedBiome: number | null;
  brushSize: number;
  showMigrationFlow: boolean;
  radiationBursts: RadiationBurst[];
  injectionAnimations?: InjectionAnimation[];
  designedCreatureTimestamps?: Map<string, number>;
  highlightBiomeType?: number | null;
}

function drawBiomeTile(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  biomeType: number,
  tick: number
) {
  const px = gx * CELL_SIZE;
  const py = gy * CELL_SIZE;

  switch (biomeType) {
    case 1: { // Dense Forest
      ctx.fillStyle = 'rgba(34,85,34,0.35)';
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      // Subtle noise texture
      ctx.fillStyle = 'rgba(20,60,20,0.15)';
      const s1 = (gx * 7 + gy * 13) >>> 0;
      for (let i = 0; i < 3; i++) {
        const nx = px + ((s1 * (i + 1) * 17) % CELL_SIZE);
        const ny = py + ((s1 * (i + 1) * 23) % CELL_SIZE);
        ctx.fillRect(nx, ny, 1.5, 1.5);
      }
      break;
    }
    case 2: { // Desert
      ctx.fillStyle = 'rgba(210,180,100,0.35)';
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      // Stippled dots
      ctx.fillStyle = 'rgba(180,150,70,0.3)';
      const s2 = (gx * 11 + gy * 17) >>> 0;
      for (let i = 0; i < 2; i++) {
        const nx = px + ((s2 * (i + 1) * 19) % CELL_SIZE);
        const ny = py + ((s2 * (i + 1) * 29) % CELL_SIZE);
        ctx.beginPath();
        ctx.arc(nx, ny, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 3: { // Deep Ocean — wave shimmer
      const shimmer = Math.sin(tick * 0.05 + gx * 0.3 + gy * 0.3) * 0.1 + 0.4;
      ctx.fillStyle = `rgba(20,80,180,${shimmer.toFixed(2)})`;
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      break;
    }
    case 4: { // Arctic Tundra
      ctx.fillStyle = 'rgba(200,220,240,0.45)';
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
      // Snowflake particles
      const snowPhase = Math.floor(tick / 10);
      const s4 = (gx * 3 + gy * 7 + snowPhase) >>> 0;
      if (s4 % 5 === 0) {
        const sx = px + ((s4 * 13) % CELL_SIZE);
        const sy = py + ((s4 * 17) % CELL_SIZE);
        ctx.strokeStyle = 'rgba(220,235,255,0.6)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy);
        ctx.lineTo(sx + 2, sy);
        ctx.moveTo(sx, sy - 2);
        ctx.lineTo(sx, sy + 2);
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
}

function drawBiomeLayer(
  ctx: CanvasRenderingContext2D,
  biomeGrid: Uint8Array,
  tick: number
) {
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const biomeType = biomeGrid[gy * GRID_COLS + gx];
      if (biomeType === 0) continue; // Savanna is default background
      drawBiomeTile(ctx, gx, gy, biomeType, tick);
    }
  }

  // Biome borders — batch all line segments
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const current = biomeGrid[gy * GRID_COLS + gx];
      const px = gx * CELL_SIZE;
      const py = gy * CELL_SIZE;

      if (gx < GRID_COLS - 1) {
        const right = biomeGrid[gy * GRID_COLS + gx + 1];
        if (right !== current) {
          ctx.moveTo(px + CELL_SIZE, py);
          ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
        }
      }
      if (gy < GRID_ROWS - 1) {
        const below = biomeGrid[(gy + 1) * GRID_COLS + gx];
        if (below !== current) {
          ctx.moveTo(px, py + CELL_SIZE);
          ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE);
        }
      }
    }
  }
  ctx.stroke();
}

function drawMigrationFlow(
  ctx: CanvasRenderingContext2D,
  biomeGrid: Uint8Array,
  migrationLog: Map<string, number>
) {
  if (migrationLog.size === 0) return;

  // Compute biome centroids
  const centroidSums = new Map<number, { sx: number; sy: number; count: number }>();
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const id = biomeGrid[gy * GRID_COLS + gx];
      const cur = centroidSums.get(id) ?? { sx: 0, sy: 0, count: 0 };
      cur.sx += gx * CELL_SIZE + CELL_SIZE / 2;
      cur.sy += gy * CELL_SIZE + CELL_SIZE / 2;
      cur.count++;
      centroidSums.set(id, cur);
    }
  }
  const centroids = new Map<number, { x: number; y: number }>();
  for (const [id, { sx, sy, count }] of centroidSums.entries()) {
    if (count > 0) centroids.set(id, { x: sx / count, y: sy / count });
  }

  // Find max flow for scaling
  let maxFlow = 0;
  for (const count of migrationLog.values()) {
    if (count > maxFlow) maxFlow = count;
  }
  if (maxFlow === 0) return;

  for (const [key, count] of migrationLog.entries()) {
    const parts = key.split('→');
    if (parts.length !== 2) continue;
    const fromId = parseInt(parts[0]);
    const toId = parseInt(parts[1]);
    const from = centroids.get(fromId);
    const to = centroids.get(toId);
    if (!from || !to) continue;

    const thickness = 1 + (count / maxFlow) * 5;
    const alpha = 0.3 + (count / maxFlow) * 0.4;

    ctx.strokeStyle = `rgba(255,220,100,${alpha.toFixed(2)})`;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // Arrowhead
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const headLen = 8 + thickness;
    ctx.fillStyle = `rgba(255,220,100,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle - Math.PI / 6),
      to.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      to.x - headLen * Math.cos(angle + Math.PI / 6),
      to.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
}

function drawBiomeHighlight(
  ctx: CanvasRenderingContext2D,
  biomeGrid: Uint8Array,
  biomeType: number
) {
  ctx.fillStyle = 'rgba(255, 255, 120, 0.14)';
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      if (biomeGrid[gy * GRID_COLS + gx] === biomeType) {
        ctx.fillRect(gx * CELL_SIZE, gy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  // Pulsing border on matched cells
  ctx.strokeStyle = 'rgba(255,255,80,0.28)';
  ctx.lineWidth = 1;
  for (let gy = 0; gy < GRID_ROWS; gy++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      if (biomeGrid[gy * GRID_COLS + gx] === biomeType) {
        const px = gx * CELL_SIZE;
        const py = gy * CELL_SIZE;
        const hasN = gy === 0 || biomeGrid[(gy - 1) * GRID_COLS + gx] !== biomeType;
        const hasS = gy === GRID_ROWS - 1 || biomeGrid[(gy + 1) * GRID_COLS + gx] !== biomeType;
        const hasW = gx === 0 || biomeGrid[gy * GRID_COLS + gx - 1] !== biomeType;
        const hasE = gx === GRID_COLS - 1 || biomeGrid[gy * GRID_COLS + gx + 1] !== biomeType;
        ctx.beginPath();
        if (hasN) { ctx.moveTo(px, py); ctx.lineTo(px + CELL_SIZE, py); }
        if (hasS) { ctx.moveTo(px, py + CELL_SIZE); ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE); }
        if (hasW) { ctx.moveTo(px, py); ctx.lineTo(px, py + CELL_SIZE); }
        if (hasE) { ctx.moveTo(px + CELL_SIZE, py); ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE); }
        ctx.stroke();
      }
    }
  }
}

function drawInjectionAnimations(
  ctx: CanvasRenderingContext2D,
  animations: InjectionAnimation[],
  now: number
) {
  const DURATION = 1500;
  for (const anim of animations) {
    const elapsed = now - anim.startTime;
    if (elapsed > DURATION) continue;
    const t = elapsed / DURATION;

    // Ease-in-out quad
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const x = anim.startX + (anim.targetX - anim.startX) * ease;
    const y = anim.startY + (anim.targetY - anim.startY) * ease;

    const dx = anim.targetX - anim.startX;
    const dy = anim.targetY - anim.startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ndx = dx / dist;
    const ndy = dy / dist;

    const trailLen = 50 + t * 20;
    const tx0 = x - ndx * trailLen;
    const ty0 = y - ndy * trailLen;

    ctx.save();

    // Trail
    const grad = ctx.createLinearGradient(tx0, ty0, x, y);
    grad.addColorStop(0, 'rgba(255,200,50,0)');
    grad.addColorStop(0.6, 'rgba(255,220,80,0.35)');
    grad.addColorStop(1, 'rgba(255,245,150,0.85)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Meteor head glow
    ctx.shadowColor = 'rgba(255,220,50,0.9)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(255,255,220,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawRadiationBursts(
  ctx: CanvasRenderingContext2D,
  bursts: RadiationBurst[],
  now: number
) {
  const DURATION = 2000;
  for (const burst of bursts) {
    const elapsed = now - burst.startTime;
    if (elapsed > DURATION) continue;
    const progress = elapsed / DURATION;

    for (let ring = 0; ring < 3; ring++) {
      const ringProgress = Math.max(0, progress - ring * 0.15);
      if (ringProgress <= 0) continue;
      const radius = ringProgress * 180;
      const alpha = (1 - ringProgress) * 0.5;
      const color = burst.colors[ring % burst.colors.length] ?? 'rgba(255,200,50,0.4)';

      ctx.strokeStyle = color.replace('hsl', 'hsla').replace(')', `, ${alpha.toFixed(2)})`);
      if (!color.startsWith('hsl')) {
        ctx.strokeStyle = `rgba(255,200,80,${alpha.toFixed(2)})`;
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

export function SimulationCanvas({
  worldRef,
  selectedSpeciesId,
  extinctionFlash,
  selectedBiome,
  brushSize,
  showMigrationFlow,
  radiationBursts,
  injectionAnimations,
  designedCreatureTimestamps,
  highlightBiomeType,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const isPaintingRef = useRef(false);
  const nowRef = useRef(0);

  const [biomeTooltip, setBiomeTooltip] = useState<{
    x: number;
    y: number;
    biomeId: number;
  } | null>(null);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });
    observer.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    return () => observer.disconnect();
  }, []);

  // Convert canvas pixel coords to world grid coords
  const canvasToGrid = useCallback(
    (clientX: number, clientY: number): { gridX: number; gridY: number; worldX: number; worldY: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const worldX = (cx - offsetXRef.current) / scaleRef.current;
      const worldY = (cy - offsetYRef.current) / scaleRef.current;
      const gridX = Math.floor(worldX / CELL_SIZE);
      const gridY = Math.floor(worldY / CELL_SIZE);
      return { gridX, gridY, worldX, worldY };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || selectedBiome === null) return;
      isPaintingRef.current = true;
      const coords = canvasToGrid(e.clientX, e.clientY);
      if (!coords) return;
      worldRef.current?.paintBiome(coords.gridX, coords.gridY, brushSize, selectedBiome);
    },
    [selectedBiome, brushSize, worldRef, canvasToGrid]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPaintingRef.current || selectedBiome === null) return;
      const coords = canvasToGrid(e.clientX, e.clientY);
      if (!coords) return;
      worldRef.current?.paintBiome(coords.gridX, coords.gridY, brushSize, selectedBiome);
    },
    [selectedBiome, brushSize, worldRef, canvasToGrid]
  );

  const handleMouseUp = useCallback(() => {
    isPaintingRef.current = false;
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const coords = canvasToGrid(e.clientX, e.clientY);
      if (!coords) return;
      const world = worldRef.current;
      if (!world) return;
      const biomeId = world.getBiomeId(
        Math.max(0, Math.min(GRID_COLS - 1, coords.gridX)),
        Math.max(0, Math.min(GRID_ROWS - 1, coords.gridY))
      );
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setBiomeTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        biomeId,
      });
      setTimeout(() => setBiomeTooltip(null), 2000);
    },
    [worldRef, canvasToGrid]
  );

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const world = worldRef.current;
    if (!world) return;

    nowRef.current = Date.now();

    const cw = canvas.width;
    const ch = canvas.height;

    const scaleX = cw / world.width;
    const scaleY = ch / world.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (cw - world.width * scale) / 2;
    const offsetY = (ch - world.height * scale) / 2;

    // Update refs for mouse coord conversion
    scaleRef.current = scale;
    offsetXRef.current = offsetX;
    offsetYRef.current = offsetY;

    ctx.save();
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, cw, ch);

    // World background
    ctx.fillStyle = '#111820';
    ctx.fillRect(offsetX, offsetY, world.width * scale, world.height * scale);

    // Extinction flash overlay
    if (extinctionFlash) {
      ctx.fillStyle = 'rgba(255, 60, 20, 0.25)';
      ctx.fillRect(offsetX, offsetY, world.width * scale, world.height * scale);
    }

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw biome layer
    drawBiomeLayer(ctx, world.biomeGrid, world.tick);

    // Biome highlight overlay (from Genesis panel hover)
    if (highlightBiomeType != null) {
      drawBiomeHighlight(ctx, world.biomeGrid, highlightBiomeType);
    }

    // Migration flow overlay
    if (showMigrationFlow) {
      drawMigrationFlow(ctx, world.biomeGrid, world.migrationLog);
    }

    // Draw food pellets
    ctx.fillStyle = '#3a7d44';
    for (const food of world.foodPellets) {
      if (
        food.x < -4 ||
        food.x > world.width + 4 ||
        food.y < -4 ||
        food.y > world.height + 4
      )
        continue;
      ctx.beginPath();
      ctx.arc(food.x, food.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw creatures
    for (const creature of world.creatures.values()) {
      if (creature.dead) continue;
      const { x, y } = creature.position;

      if (x + creature.radius < 0 || x - creature.radius > world.width) continue;
      if (y + creature.radius < 0 || y - creature.radius > world.height) continue;

      ctx.save();

      const color = getColor(creature.genome);
      const isPredator = creature.aggression > 0.6;
      const isSelected =
        selectedSpeciesId !== null &&
        creature.speciesId === selectedSpeciesId;

      if (isPredator) {
        ctx.shadowColor = 'rgba(255,40,40,0.5)';
        ctx.shadowBlur = 6;
      }

      ctx.beginPath();
      ctx.arc(x, y, creature.radius, 0, Math.PI * 2);

      if (isPredator) {
        const h = creature.genome[4] * 360;
        const s = 50 + creature.genome[5] * 40;
        ctx.fillStyle = `hsl(${(h * 0.3 + 0 * 0.7).toFixed(0)}, ${(s * 0.7).toFixed(0)}%, 35%)`;
      } else {
        ctx.fillStyle = color;
      }
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 8;
        ctx.stroke();
      }

      if (creature.energy < 30) {
        ctx.strokeStyle = `rgba(255,200,0,${1 - creature.energy / 30})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          creature.radius + 3,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * (creature.energy / 30)
        );
        ctx.stroke();
      }

      // Designed creature DNA marker (visible 10s)
      if (designedCreatureTimestamps) {
        const injectedAt = designedCreatureTimestamps.get(creature.id);
        if (injectedAt !== undefined && nowRef.current - injectedAt < 10000) {
          const age = nowRef.current - injectedAt;
          const fadeAlpha = Math.max(0, 1 - age / 10000);
          const pulseAlpha = fadeAlpha * (0.6 + Math.sin(age * 0.006) * 0.4);
          ctx.strokeStyle = `rgba(100,255,200,${pulseAlpha.toFixed(2)})`;
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(x, y, creature.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
          // DNA emoji above creature
          const fontSize = Math.max(8, creature.radius * 0.9);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.globalAlpha = fadeAlpha * 0.9;
          ctx.fillText('🧬', x, y - creature.radius - 3);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
    }

    // Draw radiation bursts
    if (radiationBursts.length > 0) {
      drawRadiationBursts(ctx, radiationBursts, nowRef.current);
    }

    // Draw injection meteor animations
    if (injectionAnimations && injectionAnimations.length > 0) {
      drawInjectionAnimations(ctx, injectionAnimations, nowRef.current);
    }

    ctx.restore();
  }, [worldRef, selectedSpeciesId, extinctionFlash, showMigrationFlow, radiationBursts, injectionAnimations, designedCreatureTimestamps, highlightBiomeType]);

  // Attach draw to rAF
  useEffect(() => {
    let rafId: number;
    function loop() {
      draw();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  const cursor =
    selectedBiome !== null
      ? 'crosshair'
      : 'default';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#0d1117]"
      style={{ cursor }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      />
      {/* Biome info tooltip */}
      {biomeTooltip && (
        <div
          className="absolute z-20 bg-black/80 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 pointer-events-none font-mono"
          style={{ left: biomeTooltip.x + 8, top: biomeTooltip.y - 24 }}
        >
          {BIOME_NAMES[biomeTooltip.biomeId]}
        </div>
      )}
    </div>
  );
}
