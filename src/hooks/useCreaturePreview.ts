import { useEffect, useCallback, RefObject } from 'react';
import { Genome, getColor, getSize, getAggression } from '../lib/simulation/genome';

export function useCreaturePreview(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  genome: Genome
) {
  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      const t = timestamp / 1000;

      // Heartbeat pulse: ±4%
      const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.04;
      const baseRadius = getSize(genome);
      const maxCanvas = Math.min(w, h) * 0.38;
      const radius = Math.min(maxCanvas, (baseRadius / 14) * maxCanvas) * pulse;

      const color = getColor(genome);
      const aggression = getAggression(genome);
      const isPredator = aggression > 0.6;
      const hue = genome[4] * 360;
      const sat = 50 + genome[5] * 40;

      ctx.clearRect(0, 0, w, h);

      // Background gradient
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      bg.addColorStop(0, 'rgba(15, 25, 35, 0.9)');
      bg.addColorStop(1, 'rgba(6, 10, 16, 1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Outer glow
      const glowColor = isPredator
        ? 'rgba(255, 40, 40, 0.25)'
        : `hsla(${hue.toFixed(0)}, 60%, 50%, 0.18)`;
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 2.5);
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Shadow / soft halo
      ctx.save();
      ctx.shadowBlur = isPredator ? 22 : 16;
      ctx.shadowColor = isPredator
        ? 'rgba(255,50,50,0.7)'
        : `hsla(${hue.toFixed(0)}, 70%, 55%, 0.55)`;

      // Body
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      if (isPredator) {
        ctx.fillStyle = `hsl(${(hue * 0.3).toFixed(0)}, ${(sat * 0.7).toFixed(0)}%, 35%)`;
      } else {
        ctx.fillStyle = color;
      }
      ctx.fill();
      ctx.restore();

      // Subtle body highlight (top-left)
      const hlGrad = ctx.createRadialGradient(
        cx - radius * 0.3, cy - radius * 0.3, 0,
        cx, cy, radius
      );
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = hlGrad;
      ctx.fill();

      // Eyes based on aggression
      const eyeOff = radius * 0.32;
      const eyeSize = radius * 0.18;
      if (isPredator) {
        // Menacing slit eyes
        ctx.fillStyle = 'rgba(255, 60, 40, 0.92)';
        ctx.save();
        ctx.translate(cx - eyeOff * 0.55, cy - eyeOff * 0.28);
        ctx.rotate(-0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeSize, eyeSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(cx + eyeOff * 0.55, cy - eyeOff * 0.28);
        ctx.rotate(0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeSize, eyeSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Gentle round eyes
        [[-1, 1]].forEach(() => {
          for (const sign of [-1, 1]) {
            const ex = cx + sign * eyeOff * 0.5;
            const ey = cy - eyeOff * 0.28;
            ctx.fillStyle = 'rgba(255,255,255,0.88)';
            ctx.beginPath();
            ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(20,20,20,0.9)';
            ctx.beginPath();
            ctx.arc(ex, ey, eyeSize * 0.52, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Heartbeat pulse ring
      const ringPhase = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0..1
      if (ringPhase > 0.5) {
        const alpha = (ringPhase - 0.5) * 2 * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4 + (1 - ringPhase) * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canvasRef, ...Array.from(genome)]
  );

  useEffect(() => {
    let rafId: number;
    function loop(ts: number) {
      draw(ts);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);
}
