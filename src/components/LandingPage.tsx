'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Organism {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  hue: number;
  isPredator: boolean;
  phase: number;
  opacity: number;
}

interface FoodDot {
  x: number; y: number;
  age: number;
}

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const conceptsRef = useRef<HTMLElement>(null);
  const guideRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  const [conceptsVisible, setConceptsVisible] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  // Hero fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Intersection observers for lower sections
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.target === conceptsRef.current) setConceptsVisible(true);
          if (e.target === guideRef.current) setGuideVisible(true);
          if (e.target === ctaRef.current) setCtaVisible(true);
        }
      },
      { threshold: 0.15 }
    );
    if (conceptsRef.current) obs.observe(conceptsRef.current);
    if (guideRef.current) obs.observe(guideRef.current);
    if (ctaRef.current) obs.observe(ctaRef.current);
    return () => obs.disconnect();
  }, []);

  // Canvas — animated primordial soup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let organisms: Organism[] = [];
    let food: FoodDot[] = [];

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(72, Math.floor((canvas.width * canvas.height) / 13000));
      organisms = Array.from({ length: count }, () => {
        const isPredator = Math.random() < 0.24;
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * (isPredator ? 0.72 : 0.38),
          vy: (Math.random() - 0.5) * (isPredator ? 0.72 : 0.38),
          r: isPredator ? 8 + Math.random() * 6 : 3 + Math.random() * 4.5,
          hue: isPredator ? Math.random() * 22 : 108 + Math.random() * 72,
          isPredator,
          phase: Math.random() * Math.PI * 2,
          opacity: 0.42 + Math.random() * 0.36,
        };
      });
      food = Array.from({ length: 45 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        age: Math.random() * 280,
      }));
    };

    init();

    const onResize = () => { init(); };
    window.addEventListener('resize', onResize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Food pellets (amber sparkles)
      for (const f of food) {
        f.age += 1;
        if (f.age > 320) {
          f.x = Math.random() * canvas.width;
          f.y = Math.random() * canvas.height;
          f.age = 0;
        }
        const alpha = Math.sin(f.age * 0.028) * 0.22 + 0.12;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251,191,36,${alpha})`;
        ctx.fill();
      }

      // Connection lines between nearby organisms
      for (let i = 0; i < organisms.length; i++) {
        for (let j = i + 1; j < organisms.length; j++) {
          const dx = organisms[i].x - organisms[j].x;
          const dy = organisms[i].y - organisms[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 88) {
            ctx.beginPath();
            ctx.moveTo(organisms[i].x, organisms[i].y);
            ctx.lineTo(organisms[j].x, organisms[j].y);
            ctx.strokeStyle = `rgba(100,210,135,${(1 - d / 88) * 0.042})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Organisms
      for (const o of organisms) {
        o.x += o.vx;
        o.y += o.vy;
        o.phase += 0.017;
        if (o.x < o.r || o.x > canvas.width  - o.r) { o.vx *= -1; o.x = Math.max(o.r, Math.min(canvas.width  - o.r, o.x)); }
        if (o.y < o.r || o.y > canvas.height - o.r) { o.vy *= -1; o.y = Math.max(o.r, Math.min(canvas.height - o.r, o.y)); }

        const pr = o.r + Math.sin(o.phase) * 1.6;

        // Glow halo
        const grd = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, pr * 4.5);
        grd.addColorStop(0,   `hsla(${o.hue},76%,55%,${o.opacity * 0.44})`);
        grd.addColorStop(0.4, `hsla(${o.hue},66%,45%,${o.opacity * 0.14})`);
        grd.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(o.x, o.y, pr * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.arc(o.x, o.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${o.hue},72%,56%,${o.opacity})`;
        ctx.fill();

        // Membrane ring
        ctx.beginPath();
        ctx.arc(o.x, o.y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${o.hue},82%,74%,${o.opacity * 0.55})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Radial vignette
      const vig = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.28,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.9,
      );
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(8,13,19,0.82)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleEnter = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    setTimeout(onEnter, 750);
  }, [isLeaving, onEnter]);

  return (
    <div
      className="fixed inset-0 bg-[#080d13] overflow-y-auto overflow-x-hidden z-50"
      style={{
        opacity: isLeaving ? 0 : 1,
        transform: isLeaving ? 'scale(1.045)' : 'scale(1)',
        filter: isLeaving ? 'blur(6px)' : 'none',
        transition: isLeaving
          ? 'opacity 0.75s ease, transform 0.75s ease, filter 0.75s ease'
          : 'none',
      }}
    >

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Horizontal rule top accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

        <div
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl"
          style={{ opacity: heroVisible ? 1 : 0, transition: 'opacity 0.7s ease' }}
        >
          <div
            className="font-jet text-[10px] tracking-[0.42em] text-emerald-500/65 uppercase mb-7"
            style={{ animation: heroVisible ? 'fadeUp 0.85s ease 0.1s both' : 'none' }}
          >
            Generative Ecosystem Simulation
          </div>

          <h1
            className="font-garamond text-[clamp(4.5rem,13vw,9.5rem)] leading-[0.875] text-white tracking-tight mb-6"
            style={{ animation: heroVisible ? 'fadeUp 0.9s ease 0.22s both' : 'none' }}
          >
            Eco<em className="text-emerald-400 not-italic">Sim</em>
          </h1>

          <p
            className="font-garamond italic text-[clamp(1.05rem,2.4vw,1.45rem)] text-gray-400 max-w-lg mb-9 leading-relaxed"
            style={{ animation: heroVisible ? 'fadeUp 0.9s ease 0.38s both' : 'none' }}
          >
            A living world where creatures evolve, compete, and diverge into new species —
            driven entirely by a genetic code and the pressure of survival.
          </p>

          <div
            className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1 font-jet text-[9.5px] text-gray-600 uppercase tracking-widest mb-10"
            style={{ animation: heroVisible ? 'fadeUp 0.9s ease 0.52s both' : 'none' }}
          >
            <span>50 initial organisms</span>
            <span className="text-gray-800">·</span>
            <span>Real-time evolution</span>
            <span className="text-gray-800">·</span>
            <span>Infinite generations</span>
          </div>

          <button
            onClick={handleEnter}
            className="group font-jet text-[11px] tracking-[0.32em] uppercase text-emerald-950 bg-emerald-400 px-9 py-3.5 rounded-sm hover:bg-emerald-300 active:scale-95 transition-all duration-300 cursor-pointer"
            style={{
              animation: heroVisible
                ? 'fadeUp 0.9s ease 0.64s both, landingPulse 3.2s ease 1.6s infinite'
                : 'none',
            }}
          >
            Enter the World
            <span className="ml-2.5 inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
          </button>
        </div>

        <div
          className="absolute bottom-8 font-jet text-[9px] text-gray-700 uppercase tracking-widest pointer-events-none"
          style={{ animation: heroVisible ? 'scrollDrift 2.6s ease 2.2s infinite' : 'none' }}
        >
          scroll to learn more ↓
        </div>
      </section>

      {/* ── CONCEPTS ─────────────────────────────────────────────── */}
      <section
        ref={conceptsRef}
        className="relative z-10 py-28 px-6 bg-[#080d13] border-t border-gray-800/40"
        style={{
          opacity: conceptsVisible ? 1 : 0,
          transform: conceptsVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.9s ease, transform 0.9s ease',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="font-jet text-[10px] tracking-[0.4em] text-gray-600 uppercase text-center mb-3">
            Core Mechanics
          </div>
          <h2 className="font-garamond text-[clamp(2rem,5vw,3.4rem)] text-gray-100 text-center mb-16 leading-tight">
            Three forces shape this world
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* EVOLVE */}
            <div className="group bg-[#0d1117] border border-gray-800/55 rounded p-7 hover:border-emerald-800/50 transition-all duration-500">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                <div className="font-jet text-[10px] text-emerald-500 uppercase tracking-widest">01 · Evolution</div>
              </div>
              <h3 className="font-garamond text-[1.45rem] text-white mb-3 leading-snug">Survival of the Fittest</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Each creature carries a genome encoding speed, size, vision, aggression, and camouflage.
                Successful traits propagate; failing ones vanish.
              </p>
              <div className="mt-6 flex items-center gap-1.5">
                {[3, 5, 4, 7, 5, 8, 6, 9].map((sz, i) => (
                  <div
                    key={i}
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: sz * 3.5, height: sz * 3.5,
                      background: `hsla(142,65%,52%,${0.2 + i * 0.1})`,
                      border: '1px solid rgba(52,211,153,0.25)',
                    }}
                  />
                ))}
              </div>
              <div className="mt-2.5 font-jet text-[9px] text-gray-700">genome[0..7] → phenotype across generations</div>
            </div>

            {/* SPECIATE */}
            <div className="group bg-[#0d1117] border border-gray-800/55 rounded p-7 hover:border-purple-800/50 transition-all duration-500">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.7)]" />
                <div className="font-jet text-[10px] text-purple-400 uppercase tracking-widest">02 · Speciation</div>
              </div>
              <h3 className="font-garamond text-[1.45rem] text-white mb-3 leading-snug">Life Diverges</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                When genetic distance grows large enough, a population splits into distinct species.
                Watch the phylogenetic tree branch in real time.
              </p>
              <div className="mt-6 h-10">
                <svg viewBox="0 0 170 42" className="w-full h-full">
                  <line x1="85" y1="4"  x2="85" y2="20" stroke="rgba(168,85,247,0.5)"  strokeWidth="1.2" />
                  <line x1="85" y1="20" x2="42" y2="40" stroke="rgba(168,85,247,0.5)"  strokeWidth="1.1" />
                  <line x1="85" y1="20" x2="128" y2="40" stroke="rgba(52,211,153,0.6)" strokeWidth="1.1" />
                  <circle cx="85"  cy="4"  r="3.5" fill="rgba(168,85,247,0.7)" />
                  <circle cx="85"  cy="20" r="2.5" fill="rgba(168,85,247,0.35)" />
                  <circle cx="42"  cy="40" r="3.5" fill="rgba(168,85,247,0.7)" />
                  <circle cx="128" cy="40" r="3.5" fill="rgba(52,211,153,0.7)" />
                </svg>
              </div>
              <div className="font-jet text-[9px] text-gray-700">Velox rapida → Ferox nova, Mitis brevis</div>
            </div>

            {/* EXTINCTION */}
            <div className="group bg-[#0d1117] border border-gray-800/55 rounded p-7 hover:border-red-900/55 transition-all duration-500">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />
                <div className="font-jet text-[10px] text-red-400 uppercase tracking-widest">03 · Extinction</div>
              </div>
              <h3 className="font-garamond text-[1.45rem] text-white mb-3 leading-snug">Collapse &amp; Rebuild</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Mass extinctions wipe 70% of all living creatures. Survivors diverge rapidly to fill
                ecological vacuums. You can trigger one at will.
              </p>
              <div className="mt-6 flex items-end gap-1 h-9">
                {[7, 9, 6, 8, 10, 2, 1, 3, 5, 7, 9].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h * 3.6}px`,
                      background: i < 5
                        ? `rgba(248,113,113,${0.35 + h * 0.04})`
                        : `rgba(248,113,113,${0.12 + h * 0.02})`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-2.5 font-jet text-[9px] text-gray-700">−70% population → adaptive radiation</div>
            </div>

          </div>
        </div>
      </section>

      {/* ── INTERFACE GUIDE ──────────────────────────────────────── */}
      <section
        ref={guideRef}
        className="relative z-10 py-28 px-6 bg-[#0a0f16] border-t border-gray-800/40"
        style={{
          opacity: guideVisible ? 1 : 0,
          transform: guideVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.9s ease 0.08s, transform 0.9s ease 0.08s',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="font-jet text-[10px] tracking-[0.4em] text-gray-600 uppercase text-center mb-3">
            The Interface
          </div>
          <h2 className="font-garamond text-[clamp(2rem,5vw,3.4rem)] text-gray-100 text-center mb-3 leading-tight">
            Two panels, one world
          </h2>
          <p className="font-garamond italic text-gray-500 text-center mb-16 text-lg">
            Everything you need to observe — and shape — life
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">

            {/* Simulation Canvas preview */}
            <div>
              <div className="bg-[#0d1117] border border-gray-800/60 rounded aspect-video relative overflow-hidden mb-5">
                {/* Fake canvas */}
                <div className="absolute inset-0">
                  {/* Creatures */}
                  {([
                    { x: 18, y: 32,  r: 7,  color: '#34d399' },
                    { x: 52, y: 58,  r: 5,  color: '#34d399' },
                    { x: 33, y: 72,  r: 4.5,color: '#6ee7b7' },
                    { x: 68, y: 22,  r: 11, color: '#f87171' },
                    { x: 79, y: 62,  r: 9,  color: '#ef4444' },
                    { x: 13, y: 55,  r: 5,  color: '#34d399' },
                    { x: 59, y: 82,  r: 6,  color: '#a78bfa' },
                    { x: 44, y: 42,  r: 4,  color: '#6ee7b7' },
                    { x: 88, y: 40,  r: 7,  color: '#a78bfa' },
                    { x: 26, y: 85,  r: 5,  color: '#34d399' },
                  ] as { x: number; y: number; r: number; color: string }[]).map((c, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        left: `${c.x}%`, top: `${c.y}%`,
                        width: c.r * 2, height: c.r * 2,
                        background: c.color,
                        opacity: 0.68,
                        boxShadow: `0 0 ${c.r * 1.8}px ${c.color}55`,
                        transform: 'translate(-50%,-50%)',
                      }}
                    />
                  ))}
                  {/* Food */}
                  {[{ x: 24, y: 47 }, { x: 48, y: 19 }, { x: 63, y: 48 }, { x: 37, y: 62 }, { x: 86, y: 73 }, { x: 72, y: 34 }]
                    .map((f, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 rounded-full bg-amber-400/50"
                        style={{ left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%,-50%)' }}
                      />
                    ))}
                  {/* HUD overlay */}
                  <div className="absolute top-2 left-2 bg-black/55 backdrop-blur-sm rounded px-2 py-1.5 font-jet text-[7px] text-gray-400 leading-relaxed border border-gray-800/50">
                    <div className="text-gray-600 text-[6px] uppercase tracking-wider mb-0.5">EcoSim</div>
                    <div>Gen <span className="text-emerald-400">14</span> · Tick <span className="text-gray-300">7 240</span></div>
                    <div>Pop <span className="text-white">91</span> · <span className="text-red-400">22P</span>/<span className="text-green-400">69H</span></div>
                    <div>Spp <span className="text-purple-400">5 living</span> · <span className="text-gray-600">3†</span></div>
                  </div>
                </div>
              </div>
              <h3 className="font-garamond text-xl text-white mb-3">
                Simulation Canvas{' '}
                <span className="font-jet text-[11px] text-gray-600 font-normal">— left 70%</span>
              </h3>
              <ul className="space-y-2.5">
                {[
                  { dot: 'bg-emerald-400', text: 'Herbivores seek food pellets and flee when predators are near' },
                  { dot: 'bg-red-400',     text: 'Predators hunt smaller creatures and drain energy on contact' },
                  { dot: 'bg-amber-400',   text: 'Food pellets continuously respawn across the world' },
                  { dot: 'bg-purple-400',  text: 'Each color represents a distinct species lineage' },
                ].map(({ dot, text }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full ${dot} mt-1.5 flex-shrink-0`} />
                    <span className="text-gray-500 text-[0.84rem]">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Phylogenetic Tree preview */}
            <div>
              <div className="bg-[#0d1117] border border-gray-800/60 rounded aspect-video relative overflow-hidden mb-5">
                <div className="absolute inset-0 flex items-center justify-center p-5">
                  <svg viewBox="0 0 200 130" className="w-full h-full opacity-75">
                    {/* Trunk */}
                    <line x1="100" y1="8"  x2="100" y2="35" stroke="#34d399" strokeWidth="1.6" />
                    {/* First fork */}
                    <line x1="100" y1="35" x2="55"  y2="65" stroke="#34d399" strokeWidth="1.3" />
                    <line x1="100" y1="35" x2="145" y2="58" stroke="#a855f7" strokeWidth="1.3" />
                    {/* Second level */}
                    <line x1="55"  y1="65" x2="30"  y2="100" stroke="#34d399" strokeWidth="1.1" />
                    <line x1="55"  y1="65" x2="78"  y2="100" stroke="#6ee7b7" strokeWidth="1.1" />
                    <line x1="145" y1="58" x2="120" y2="100" stroke="#a855f7" strokeWidth="1.1" />
                    <line x1="145" y1="58" x2="166" y2="100" stroke="#f87171" strokeWidth="1.1" />
                    {/* Extinct branch */}
                    <line x1="120" y1="100" x2="108" y2="118" stroke="#a855f7" strokeWidth="0.9" strokeDasharray="3,2.5" opacity="0.5" />
                    {/* Nodes */}
                    <circle cx="100" cy="8"   r="4.5" fill="#34d399" />
                    <circle cx="100" cy="35"  r="3"   fill="rgba(52,211,153,0.4)" />
                    <circle cx="55"  cy="65"  r="3"   fill="rgba(52,211,153,0.4)" />
                    <circle cx="145" cy="58"  r="3"   fill="rgba(168,85,247,0.4)" />
                    <circle cx="30"  cy="100" r="4.5" fill="#34d399" />
                    <circle cx="78"  cy="100" r="4.5" fill="#6ee7b7" />
                    <circle cx="120" cy="100" r="4.5" fill="#a855f7" />
                    <circle cx="166" cy="100" r="4.5" fill="#f87171" />
                    <circle cx="108" cy="118" r="3.5" fill="rgba(168,85,247,0.25)" />
                    {/* Labels */}
                    <text x="7"   y="118" fill="#34d399" fontSize="5.5" fontFamily="monospace" opacity="0.7">Velox min.</text>
                    <text x="58"  y="118" fill="#6ee7b7" fontSize="5.5" fontFamily="monospace" opacity="0.7">Agilis rar.</text>
                    <text x="100" y="128" fill="#a855f7" fontSize="5.5" fontFamily="monospace" opacity="0.38">† Ferox max.</text>
                    <text x="148" y="118" fill="#f87171" fontSize="5.5" fontFamily="monospace" opacity="0.7">Robustus f.</text>
                  </svg>
                </div>
              </div>
              <h3 className="font-garamond text-xl text-white mb-3">
                Phylogenetic Tree{' '}
                <span className="font-jet text-[11px] text-gray-600 font-normal">— right 30%</span>
              </h3>
              <ul className="space-y-2.5">
                {[
                  { icon: '▶', color: 'text-gray-400', text: 'Each branch marks a speciation event — a lineage splitting into two' },
                  { icon: '†', color: 'text-gray-600', text: 'Faded dashed nodes are extinct species' },
                  { icon: '●', color: 'text-yellow-500', text: 'Click any node to highlight that species in the canvas' },
                ].map(({ icon, color, text }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`${color} text-xs mt-0.5 w-4 text-center flex-shrink-0`}>{icon}</span>
                    <span className="text-gray-500 text-[0.84rem]">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* God Panel */}
          <div className="bg-[#080d13] border border-gray-800/55 rounded p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="font-jet text-[10px] text-gray-500 uppercase tracking-widest">The God Panel</div>
              <div className="flex-1 h-px bg-gray-800/60" />
              <div className="font-jet text-[9px] text-gray-700">bottom bar — always visible</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { color: 'text-emerald-400', label: 'Mutation Rate',   desc: 'How rapidly genomes mutate each generation' },
                { color: 'text-amber-400',   label: 'Food Abundance',  desc: 'Resource pressure on population size' },
                { color: 'text-sky-400',     label: 'Sim Speed',       desc: 'Fast-forward or slow down the world clock' },
                { color: 'text-red-400',     label: 'Extinction Event',desc: 'Kill 70% of all creatures instantly' },
              ].map(({ color, label, desc }, i) => (
                <div key={i} className="border-l-2 border-gray-800/60 pl-3.5">
                  <div className={`font-jet text-[9.5px] ${color} uppercase tracking-widest mb-1.5`}>{label}</div>
                  <div className="text-gray-600 text-xs leading-relaxed">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section
        ref={ctaRef}
        className="relative z-10 py-36 px-6 text-center bg-[#080d13] border-t border-gray-800/40"
        style={{
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? 'translateY(0)' : 'translateY(28px)',
          transition: 'opacity 0.9s ease, transform 0.9s ease',
        }}
      >
        {/* Faint radial glow */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(52,211,153,0.12),transparent)' }}
        />

        <blockquote className="font-garamond italic text-[clamp(1.5rem,4.5vw,2.6rem)] text-gray-300 max-w-xl mx-auto mb-4 leading-relaxed">
          &ldquo;You are the observer.<br />You are the god.&rdquo;
        </blockquote>
        <p className="font-jet text-[9.5px] text-gray-700 uppercase tracking-widest mb-14">
          No two simulations ever unfold the same way
        </p>
        <button
          onClick={handleEnter}
          className="group font-jet text-[11px] tracking-[0.32em] uppercase text-emerald-950 bg-emerald-400 px-10 py-4 rounded-sm hover:bg-emerald-300 active:scale-95 transition-all duration-300 cursor-pointer"
          style={{ boxShadow: '0 0 36px rgba(52,211,153,0.22), 0 0 72px rgba(52,211,153,0.08)' }}
        >
          Begin Simulation
          <span className="ml-3 inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
        </button>
      </section>

    </div>
  );
}
