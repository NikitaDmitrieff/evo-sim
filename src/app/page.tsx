'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Cormorant_Garamond } from 'next/font/google';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  type: 'prey' | 'predator';
  hue: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    let tick = 0;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function spawn(
      x?: number,
      y?: number,
      type?: 'prey' | 'predator',
      hue?: number
    ): Particle {
      const isPred = type === 'predator' || (!type && Math.random() < 0.18);
      return {
        x: x ?? Math.random() * (canvas?.width ?? 800),
        y: y ?? Math.random() * (canvas?.height ?? 600),
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        r: isPred ? 3.5 + Math.random() * 2 : 2 + Math.random() * 2,
        type: isPred ? 'predator' : 'prey',
        hue: hue !== undefined ? hue + (Math.random() - 0.5) * 25 : isPred ? Math.random() * 30 : 110 + Math.random() * 70,
        life: 0,
        maxLife: 900 + Math.random() * 500,
        alpha: 0,
      };
    }

    function init() {
      if (!canvas) return;
      const count = Math.min(90, Math.floor((canvas.width * canvas.height) / 10000));
      particles = Array.from({ length: count }, () => spawn());
      // Stagger initial life so they don't all fade in at once
      particles.forEach((p, i) => {
        p.life = Math.floor((i / particles.length) * 400);
        p.alpha = Math.min(1, p.life / 60);
      });
    }

    function draw() {
      if (!canvas || !ctx) return;
      tick++;

      ctx.fillStyle = 'rgba(13, 17, 23, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const toAdd: Particle[] = [];

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Fade in/out
        if (p.life < 80) p.alpha = p.life / 80;
        else if (p.life > p.maxLife - 80) p.alpha = (p.maxLife - p.life) / 80;
        else p.alpha = 1;

        // Predator attraction to nearest prey
        if (p.type === 'predator') {
          let nearDist = Infinity;
          let ndx = 0, ndy = 0;
          for (const q of particles) {
            if (q.type !== 'prey') continue;
            const dx = q.x - p.x, dy = q.y - p.y;
            const d = dx * dx + dy * dy;
            if (d < nearDist) { nearDist = d; ndx = dx; ndy = dy; }
          }
          if (nearDist < 250 * 250) {
            const d = Math.sqrt(nearDist);
            p.vx += (ndx / d) * 0.018;
            p.vy += (ndy / d) * 0.018;
          }
        }

        // Prey mild flocking
        if (p.type === 'prey') {
          let cx = 0, cy = 0, sx = 0, sy = 0, n = 0;
          for (const q of particles) {
            if (q === p || q.type !== 'prey') continue;
            const dx = q.x - p.x, dy = q.y - p.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 90) {
              cx += dx; cy += dy; n++;
              if (d < 22) { sx -= dx / (d + 0.01); sy -= dy / (d + 0.01); }
            }
          }
          if (n > 0) {
            p.vx += cx / n * 0.0008 + sx * 0.008;
            p.vy += cy / n * 0.0008 + sy * 0.008;
          }
        }

        // Random drift
        p.vx += (Math.random() - 0.5) * 0.018;
        p.vy += (Math.random() - 0.5) * 0.018;

        // Speed clamp
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpd = p.type === 'predator' ? 1.3 : 0.85;
        if (spd > maxSpd) { p.vx = (p.vx / spd) * maxSpd; p.vy = (p.vy / spd) * maxSpd; }

        p.x = (p.x + p.vx + w) % w;
        p.y = (p.y + p.vy + h) % h;

        // Speciation: halfway through life, spawn offspring nearby
        if (p.type === 'prey' && p.life === Math.floor(p.maxLife * 0.48) && particles.length < 110) {
          toAdd.push(spawn(p.x + (Math.random() - 0.5) * 15, p.y + (Math.random() - 0.5) * 15, 'prey', p.hue));
        }

        // Remove dead
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }

        // Connection lines to nearby same-type particles
        for (let j = i - 1; j >= 0; j--) {
          const q = particles[j];
          if (q.type !== p.type) continue;
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 70) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${p.hue}, 70%, 60%, ${(1 - d / 70) * 0.12 * p.alpha * q.alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        // Glow
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        grd.addColorStop(0, `hsla(${p.hue}, 85%, 65%, ${p.alpha * 0.8})`);
        grd.addColorStop(1, `hsla(${p.hue}, 85%, 50%, 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 78%, ${p.alpha})`;
        ctx.fill();
      }

      particles.push(...toAdd);
      if (particles.length < 45) particles.push(spawn());

      animId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    init();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      <style>{`
        :root {
          --c-prey: #34d399;
          --c-predator: #f87171;
          --c-species: #a78bfa;
          --c-amber: #fbbf24;
          --c-muted: #4b5563;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 18px 2px rgba(52, 211, 153, 0.25), inset 0 0 12px rgba(52, 211, 153, 0.05); }
          50%       { box-shadow: 0 0 38px 6px rgba(52, 211, 153, 0.45), inset 0 0 20px rgba(52, 211, 153, 0.1); }
        }
        @keyframes scanLine {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
        @keyframes arrowSlide {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(5px); }
        }
        @keyframes borderShimmer {
          0%   { border-color: rgba(52,211,153,0.15); }
          50%  { border-color: rgba(52,211,153,0.4); }
          100% { border-color: rgba(52,211,153,0.15); }
        }
        @keyframes dotBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }

        .anim-1 { animation: fadeUp 0.9s cubic-bezier(.16,1,.3,1) 0.1s both; }
        .anim-2 { animation: fadeUp 0.9s cubic-bezier(.16,1,.3,1) 0.3s both; }
        .anim-3 { animation: fadeUp 0.9s cubic-bezier(.16,1,.3,1) 0.5s both; }
        .anim-4 { animation: fadeUp 0.9s cubic-bezier(.16,1,.3,1) 0.7s both; }
        .anim-5 { animation: fadeUp 0.9s cubic-bezier(.16,1,.3,1) 0.9s both; }
        .anim-fade { animation: fadeIn 1.2s ease 0.2s both; }

        .cta-btn {
          animation: glowPulse 3s ease-in-out infinite;
        }
        .cta-btn:hover {
          animation: none;
          box-shadow: 0 0 60px 12px rgba(52, 211, 153, 0.55), inset 0 0 30px rgba(52, 211, 153, 0.15);
          transform: scale(1.03);
        }
        .cta-btn .arrow {
          display: inline-block;
          animation: arrowSlide 1.5s ease-in-out infinite;
        }

        .scan-container {
          overflow: hidden;
          position: relative;
        }
        .scan-container::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(52,211,153,0.06) 50%, transparent 100%);
          width: 40%;
          animation: scanLine 6s linear 1.5s infinite;
        }

        .feature-card {
          border: 1px solid rgba(255,255,255,0.06);
          transition: border-color 0.4s ease, transform 0.3s ease, background 0.3s ease;
          animation: borderShimmer 4s ease-in-out infinite;
        }
        .feature-card:hover {
          border-color: rgba(52,211,153,0.3);
          transform: translateY(-3px);
          background: rgba(52,211,153,0.04);
          animation: none;
        }

        .live-dot {
          animation: dotBlink 2s ease-in-out infinite;
        }

        .section-reveal {
          animation: fadeUp 0.8s cubic-bezier(.16,1,.3,1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 30%;
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(52,211,153,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(52,211,153,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>

      <div className={`${cormorant.variable} relative min-h-screen bg-[#0d1117] text-white overflow-x-hidden`}>
        {/* Canvas background */}
        <canvas
          ref={canvasRef}
          className="fixed inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        />

        {/* Vignette overlay */}
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 1,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(13,17,23,0.75) 100%)',
          }}
        />

        {/* ─── HERO ─── */}
        <section
          className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center scan-container grid-bg"
          style={{ zIndex: 2 }}
        >
          {/* Status badge */}
          <div className="anim-1 mb-8 inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="font-mono text-[11px] tracking-[0.2em] text-emerald-400/80 uppercase">
              Genetic Simulation Engine
            </span>
          </div>

          {/* Title */}
          <h1
            className="anim-2 leading-none tracking-tight"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 'clamp(5rem, 14vw, 12rem)',
              fontWeight: 300,
              fontStyle: 'italic',
              letterSpacing: '-0.02em',
              color: 'transparent',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              backgroundImage: 'linear-gradient(135deg, #f0fdf4 0%, #86efac 40%, #34d399 70%, #059669 100%)',
            }}
          >
            evo-sim
          </h1>

          {/* Tagline */}
          <p
            className="anim-3 mt-6 max-w-2xl text-gray-400 leading-relaxed"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
              fontWeight: 300,
              fontStyle: 'italic',
              letterSpacing: '0.01em',
            }}
          >
            Watch life evolve in real time. Genetic drift, predator-prey dynamics,
            adaptive radiation, and mass extinction — all unfolding in your browser.
          </p>

          {/* Legend pills */}
          <div className="anim-4 mt-8 flex flex-wrap justify-center gap-3">
            {[
              { label: 'Herbivores', color: '#34d399' },
              { label: 'Predators', color: '#f87171' },
              { label: 'Speciation', color: '#a78bfa' },
              { label: 'Radiation Events', color: '#fbbf24' },
              { label: '5 Biomes', color: '#38bdf8' },
            ].map(({ label, color }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest uppercase px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-gray-400"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                />
                {label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="anim-5 mt-12">
            <Link
              href="/simulation"
              className="cta-btn inline-flex items-center gap-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-10 py-4 font-mono text-sm tracking-[0.15em] uppercase text-emerald-300 transition-all duration-300"
            >
              Launch Simulation
              <span className="arrow text-lg">→</span>
            </Link>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 anim-fade">
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Scroll to learn more</span>
              <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="animate-bounce">
                <path d="M8 4v16M2 14l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </section>

        {/* ─── WHAT IS EVO-SIM ─── */}
        <section
          className="relative py-32 px-6"
          style={{ zIndex: 2, background: 'linear-gradient(180deg, transparent, rgba(13,17,23,0.95) 20%, rgba(13,17,23,0.95) 80%, transparent)' }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="section-reveal mb-4">
              <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-500/60 uppercase">01 — Overview</span>
            </div>
            <h2
              className="section-reveal mb-8"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 300,
                fontStyle: 'italic',
                color: '#e5e7eb',
                lineHeight: 1.1,
              }}
            >
              What is evo-sim?
            </h2>
            <div className="section-reveal grid md:grid-cols-2 gap-8 text-gray-400" style={{ lineHeight: 1.8 }}>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', fontWeight: 300 }}>
                evo-sim is a real-time ecosystem simulation where digital creatures
                live, hunt, reproduce, and evolve. Each organism carries a genome —
                a set of traits like speed, size, and camouflage — that mutates with
                every generation.
              </p>
              <p style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', fontWeight: 300 }}>
                Over thousands of ticks you&apos;ll witness speciation events branch
                the phylogenetic tree, adaptive radiations colonize new biomes, and
                mass extinctions reshape the entire ecosystem. Evolution, compressed
                into minutes.
              </p>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="relative py-24 px-6" style={{ zIndex: 2 }}>
          <div className="max-w-6xl mx-auto">
            <div className="section-reveal mb-4">
              <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-500/60 uppercase">02 — Mechanics</span>
            </div>
            <h2
              className="section-reveal mb-14"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 300,
                fontStyle: 'italic',
                color: '#e5e7eb',
                lineHeight: 1.1,
              }}
            >
              How the simulation works
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: '⌀',
                  label: 'Genetics',
                  color: '#34d399',
                  desc: 'Every creature carries a genome encoding speed, size, sense range, camouflage, and aggression. Reproduction introduces random mutations that drive adaptation over generations.',
                },
                {
                  icon: '◈',
                  label: 'Food Chains',
                  color: '#f87171',
                  desc: 'Herbivores graze food tiles that regenerate slowly. Predators hunt herbivores but must balance caloric cost — run too fast, starve faster. Natural selection is ruthlessly real.',
                },
                {
                  icon: '⑂',
                  label: 'Speciation',
                  color: '#a78bfa',
                  desc: 'When genetic drift accumulates enough divergence, a new species is named and logged in the phylogenetic tree. Geographic isolation creates allopatric speciation events.',
                },
                {
                  icon: '⬡',
                  label: 'Biome Effects',
                  color: '#38bdf8',
                  desc: 'Five distinct biomes — Savanna, Dense Forest, Desert, Deep Ocean, and Arctic Tundra — each impose different food density, visibility, movement cost, and camouflage bonuses.',
                },
                {
                  icon: '⚡',
                  label: 'Adaptive Radiation',
                  color: '#fbbf24',
                  desc: 'When a species colonizes a new biome in large numbers, an adaptive radiation event fires — a burst of rapid evolution as creatures adapt to their new ecological niche.',
                },
                {
                  icon: '†',
                  label: 'Extinction',
                  color: '#6b7280',
                  desc: 'Species drop below minimum viable population and vanish. You can trigger mass extinction events via the God Panel — watching life rebuild from survivors is humbling.',
                },
              ].map(({ icon, label, color, desc }) => (
                <div
                  key={label}
                  className="section-reveal feature-card rounded-2xl p-6"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <div
                    className="font-mono text-2xl mb-4"
                    style={{ color, textShadow: `0 0 12px ${color}80` }}
                  >
                    {icon}
                  </div>
                  <h3
                    className="font-mono text-xs tracking-[0.2em] uppercase mb-3"
                    style={{ color }}
                  >
                    {label}
                  </h3>
                  <p
                    className="text-gray-500 leading-relaxed"
                    style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.05rem', fontWeight: 300 }}
                  >
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── BIOMES ─── */}
        <section className="relative py-24 px-6" style={{ zIndex: 2 }}>
          <div className="max-w-6xl mx-auto">
            <div className="section-reveal mb-4">
              <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-500/60 uppercase">03 — Terrain</span>
            </div>
            <h2
              className="section-reveal mb-12"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 300,
                fontStyle: 'italic',
                color: '#e5e7eb',
                lineHeight: 1.1,
              }}
            >
              Five living biomes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 section-reveal">
              {[
                { name: 'Savanna', hue: 45, food: '██████░░', move: '████████', vis: '████████' },
                { name: 'Dense Forest', hue: 130, food: '████████░', move: '█████░░░', vis: '████░░░░' },
                { name: 'Desert', hue: 30, food: '███░░░░░', move: '█████████', vis: '█████████' },
                { name: 'Deep Ocean', hue: 210, food: '██████░░', move: '█████░░░', vis: '██████░░' },
                { name: 'Arctic Tundra', hue: 190, food: '█████░░░', move: '████░░░░', vis: '███████░' },
              ].map(({ name, hue, food, move, vis }) => (
                <div
                  key={name}
                  className="rounded-xl p-4 border"
                  style={{
                    background: `hsla(${hue}, 40%, 15%, 0.3)`,
                    borderColor: `hsla(${hue}, 60%, 40%, 0.2)`,
                  }}
                >
                  <div
                    className="font-mono text-[11px] tracking-widest uppercase mb-4 font-semibold"
                    style={{ color: `hsl(${hue}, 70%, 65%)` }}
                  >
                    {name}
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Food', val: food },
                      { label: 'Move', val: move },
                      { label: 'Sight', val: vis },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div className="font-mono text-[9px] text-gray-600 uppercase mb-0.5">{label}</div>
                        <div className="font-mono text-[10px]" style={{ color: `hsl(${hue}, 60%, 50%)`, letterSpacing: '-0.05em' }}>
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CONTROLS ─── */}
        <section
          className="relative py-24 px-6"
          style={{
            zIndex: 2,
            background: 'linear-gradient(180deg, transparent, rgba(5,10,15,0.8) 20%, rgba(5,10,15,0.8) 80%, transparent)',
          }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="section-reveal mb-4">
              <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-500/60 uppercase">04 — Controls</span>
            </div>
            <h2
              className="section-reveal mb-12"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 300,
                fontStyle: 'italic',
                color: '#e5e7eb',
                lineHeight: 1.1,
              }}
            >
              What you can do
            </h2>

            <div className="section-reveal grid md:grid-cols-2 gap-8">
              {/* Keyboard */}
              <div>
                <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase text-emerald-500/70 mb-5">
                  Keyboard
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'Space', desc: 'Pause / Resume simulation' },
                    { key: '+  /  −', desc: 'Increase / Decrease speed' },
                    { key: 'M', desc: 'Toggle migration flow overlay' },
                  ].map(({ key, desc }) => (
                    <div
                      key={key}
                      className="flex items-center gap-4 py-3 border-b border-gray-800/60"
                    >
                      <kbd
                        className="font-mono text-[11px] tracking-wide px-2.5 py-1 rounded-md shrink-0 min-w-[72px] text-center"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#a3e635',
                          boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
                        }}
                      >
                        {key}
                      </kbd>
                      <span
                        style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', fontWeight: 300, color: '#9ca3af' }}
                      >
                        {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* God Panel */}
              <div>
                <h3 className="font-mono text-[11px] tracking-[0.25em] uppercase text-emerald-500/70 mb-5">
                  God Panel
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Mutation Rate', desc: 'Dial up/down the rate of genetic change per generation.' },
                    { label: 'Food Abundance', desc: 'Control food tile regeneration across the world.' },
                    { label: 'Extinction Event', desc: 'Wipe out a large fraction of the population instantly.' },
                    { label: 'Biome Painter', desc: 'Click and drag on the canvas to repaint terrain biomes.' },
                    { label: 'Restart', desc: 'Reset the world and begin evolution from scratch.' },
                  ].map(({ label, desc }) => (
                    <div
                      key={label}
                      className="flex items-start gap-4 py-3 border-b border-gray-800/60"
                    >
                      <span
                        className="font-mono text-[11px] tracking-wide shrink-0 mt-0.5"
                        style={{ color: '#a78bfa', minWidth: '130px' }}
                      >
                        {label}
                      </span>
                      <span
                        style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.05rem', fontWeight: 300, color: '#6b7280' }}
                      >
                        {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section
          className="relative py-40 px-6 flex flex-col items-center text-center scan-container"
          style={{ zIndex: 2 }}
        >
          <div className="section-reveal mb-6">
            <span className="font-mono text-[10px] tracking-[0.3em] text-gray-600 uppercase">Ready?</span>
          </div>
          <h2
            className="section-reveal mb-6"
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 300,
              fontStyle: 'italic',
              color: '#e5e7eb',
              lineHeight: 1.1,
            }}
          >
            Witness evolution unfold.
          </h2>
          <p
            className="section-reveal mb-12 max-w-lg text-gray-500"
            style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', fontWeight: 300, fontStyle: 'italic' }}
          >
            Every run is unique. Every extinction is permanent. Every species that survives earned it.
          </p>
          <div className="section-reveal">
            <Link
              href="/simulation"
              className="cta-btn inline-flex items-center gap-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-12 py-5 font-mono text-sm tracking-[0.15em] uppercase text-emerald-300 transition-all duration-300"
            >
              Start Simulation
              <span className="arrow text-lg">→</span>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer
          className="relative py-8 px-6 border-t border-gray-800/40 flex items-center justify-between"
          style={{ zIndex: 2 }}
        >
          <span className="font-mono text-[11px] tracking-widest uppercase text-gray-700">evo-sim</span>
          <span className="font-mono text-[11px] text-gray-700">
            Genetic simulation · Real-time evolution
          </span>
        </footer>
      </div>
    </>
  );
}
