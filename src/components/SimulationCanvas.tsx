'use client';

import { useRef, useEffect, useCallback } from 'react';
import { World } from '../lib/simulation/world';
import { getColor } from '../lib/simulation/genome';

interface SimulationCanvasProps {
  worldRef: React.RefObject<World | null>;
  selectedSpeciesId: string | null;
  extinctionFlash: boolean;
}

export function SimulationCanvas({
  worldRef,
  selectedSpeciesId,
  extinctionFlash,
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    // Initial size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    return () => observer.disconnect();
  }, []);

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const world = worldRef.current;
    if (!world) return;

    const cw = canvas.width;
    const ch = canvas.height;

    // Scale factor: world is 1200x800, canvas may differ
    const scaleX = cw / world.width;
    const scaleY = ch / world.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (cw - world.width * scale) / 2;
    const offsetY = (ch - world.height * scale) / 2;

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

      // Skip if outside viewport
      if (x + creature.radius < 0 || x - creature.radius > world.width) continue;
      if (y + creature.radius < 0 || y - creature.radius > world.height) continue;

      ctx.save();

      const color = getColor(creature.genome);
      const isPredator = creature.aggression > 0.6;
      const isSelected =
        selectedSpeciesId !== null &&
        creature.speciesId === selectedSpeciesId;

      // Shadow for predators
      if (isPredator) {
        ctx.shadowColor = 'rgba(255,40,40,0.5)';
        ctx.shadowBlur = 6;
      }

      // Fill circle
      ctx.beginPath();
      ctx.arc(x, y, creature.radius, 0, Math.PI * 2);

      if (isPredator) {
        // Slightly reddish/darker for predators
        const h = creature.genome[4] * 360;
        const s = 50 + creature.genome[5] * 40;
        ctx.fillStyle = `hsl(${(h * 0.3 + 0 * 0.7).toFixed(0)}, ${(s * 0.7).toFixed(0)}%, 35%)`;
      } else {
        ctx.fillStyle = color;
      }
      ctx.fill();

      // Selection ring (white) for selected species
      if (isSelected) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 8;
        ctx.stroke();
      }

      // Energy bar (thin arc overlay for low energy)
      if (creature.energy < 30) {
        ctx.strokeStyle = `rgba(255,200,0,${1 - creature.energy / 30})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x, y, creature.radius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (creature.energy / 30));
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }, [worldRef, selectedSpeciesId, extinctionFlash]);

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

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#0d1117]">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
