import { World, SpeciationEvent } from '../simulation/world';

export interface SoundscapeSettings {
  muted: boolean;
  masterVolume: number;
  speciesVoicesMix: number;
  eventsMix: number;
  pulseMix: number;
}

interface SpeciesVoice {
  osc: OscillatorNode;
  harmonyOsc: OscillatorNode;
  envGain: GainNode;
  harmonyGain: GainNode;
  fadingOut: boolean;
}

export class EcosystemSoundscape {
  private ctx: AudioContext | null = null;
  private _initialized = false;

  // Audio graph nodes (initialized in buildGraph)
  private masterGain!: GainNode;
  private speciesMixGain!: GainNode;
  private eventsMixGain!: GainNode;
  private pulseMixGain!: GainNode;
  private speciesBus!: GainNode;
  private dryGain!: GainNode;
  private wetGain!: GainNode;
  private convolver!: ConvolverNode;
  private pulseOsc!: OscillatorNode;
  private pulseEnv!: GainNode;

  // Species voices
  private voiceMap = new Map<string, SpeciesVoice>();

  // Pulse scheduler
  private nextBeatTime = 0;
  private currentBPM = 90;

  // User settings
  private settings: SoundscapeSettings = {
    muted: false,
    masterVolume: 0.7,
    speciesVoicesMix: 0.7,
    eventsMix: 0.8,
    pulseMix: 0.6,
  };

  // State tracking
  private popHistory: Array<{ time: number; pop: number }> = [];
  private processedSpeciation = new Set<string>();
  private processedMutations = new Set<string>();
  private traitCache = new Map<string, number[]>();
  private lastMutationCheckTick = 0;
  private extinctionCooldownUntil = 0;
  private mutationCooldownUntil = 0;
  private predatorRatio = 0.5;

  initializeAudio(): void {
    if (this._initialized || typeof window === 'undefined') return;
    try {
      this.ctx = new AudioContext();
      this.buildGraph();
      this._initialized = true;
    } catch (e) {
      console.error('[EcosystemSoundscape] Failed to initialize:', e);
    }
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  private buildGraph(): void {
    const ctx = this.ctx!;

    // Master gain — user volume control
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.connect(ctx.destination);

    // Per-channel mix gains
    this.speciesMixGain = ctx.createGain();
    this.speciesMixGain.gain.value = this.settings.speciesVoicesMix;
    this.speciesMixGain.connect(this.masterGain);

    this.eventsMixGain = ctx.createGain();
    this.eventsMixGain.gain.value = this.settings.eventsMix;
    this.eventsMixGain.connect(this.masterGain);

    this.pulseMixGain = ctx.createGain();
    this.pulseMixGain.gain.value = this.settings.pulseMix;
    this.pulseMixGain.connect(this.masterGain);

    // Species bus — population-driven gain, then split to dry+reverb
    this.speciesBus = ctx.createGain();
    this.speciesBus.gain.value = 0.3;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.65;
    this.speciesBus.connect(this.dryGain);
    this.dryGain.connect(this.speciesMixGain);

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.createReverbBuffer(ctx, 2.0);
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0.25;
    this.speciesBus.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.speciesMixGain);

    // Pulse: low-frequency oscillator → lowpass filter → envelope
    const pulseFilter = ctx.createBiquadFilter();
    pulseFilter.type = 'lowpass';
    pulseFilter.frequency.value = 110;
    pulseFilter.Q.value = 2.5;

    this.pulseEnv = ctx.createGain();
    this.pulseEnv.gain.value = 0;

    this.pulseOsc = ctx.createOscillator();
    this.pulseOsc.type = 'sine';
    this.pulseOsc.frequency.value = 80;
    this.pulseOsc.connect(pulseFilter);
    pulseFilter.connect(this.pulseEnv);
    this.pulseEnv.connect(this.pulseMixGain);
    this.pulseOsc.start();

    this.nextBeatTime = ctx.currentTime + 0.2;
  }

  private createReverbBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }
    return buf;
  }

  update(world: World, speciationEvents: SpeciationEvent[]): void {
    if (!this.ctx || !this._initialized) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const population = world.creatures.size;

    // Track population history
    this.popHistory.push({ time: now, pop: population });
    if (this.popHistory.length > 600) this.popHistory.shift();

    // Compute predator/prey ratio from world
    let predCount = 0;
    let preyCount = 0;
    for (const c of world.creatures.values()) {
      if (c.aggression > 0.6) predCount++;
      else preyCount++;
    }
    const totalCount = predCount + preyCount;
    this.predatorRatio = totalCount > 0 ? predCount / totalCount : 0.5;

    // Population → species bus gain (master volume per spec)
    const popFactor = Math.min(1.0, population / 80);
    this.speciesBus.gain.setTargetAtTime(popFactor * 0.55 + 0.05, now, 2.0);

    // Growth rate → reverb wet mix
    const growthRate = this.computeGrowthRate();
    const wetAmount = 0.08 + Math.min(0.55, Math.abs(growthRate) * 4);
    this.wetGain.gain.setTargetAtTime(wetAmount, now, 2.0);

    // Pulse BPM from food regeneration cycle
    this.currentBPM = 60 + world.foodAbundance * 30;
    this.schedulePulse(now);

    // Species voices
    this.updateSpeciesVoices(world, now);

    // Evolutionary events
    this.checkEvolutionaryEvents(world, speciationEvents, now);
  }

  private computeGrowthRate(): number {
    if (this.popHistory.length < 20) return 0;
    const recent = this.popHistory.slice(-5);
    const old = this.popHistory.slice(-20, -15);
    if (old.length === 0) return 0;
    const recentAvg = recent.reduce((s, p) => s + p.pop, 0) / recent.length;
    const oldAvg = old.reduce((s, p) => s + p.pop, 0) / old.length;
    return oldAvg > 0 ? (recentAvg - oldAvg) / oldAvg : 0;
  }

  private updateSpeciesVoices(world: World, now: number): void {
    const ctx = this.ctx!;

    // Aggregate per-species data in one pass
    const speciesData = new Map<string, { count: number; speedSum: number; aggressionSum: number }>();
    for (const creature of world.creatures.values()) {
      const sid = creature.speciesId;
      const d = speciesData.get(sid);
      if (d) {
        d.count++;
        d.speedSum += creature.genome[0];
        d.aggressionSum += creature.aggression;
      } else {
        speciesData.set(sid, { count: 1, speedSum: creature.genome[0], aggressionSum: creature.aggression });
      }
    }

    const totalPop = world.creatures.size;
    // Balanced predator ratio (centered around 0.3) → consonant minor third (×1.26)
    // Imbalanced → tritone (×√2 ≈ 1.4142)
    const isBalanced = Math.abs(this.predatorRatio - 0.3) < 0.2;
    const harmonyRatio = isBalanced ? 1.2599 : 1.4142;

    for (const [sid, data] of speciesData.entries()) {
      const avgSpeed = data.speedSum / data.count;
      const avgAggression = data.aggressionSum / data.count;

      // Classify: predator → sawtooth, prey → sine, scavenger/omnivore → triangle
      const oscType: OscillatorType =
        avgAggression > 0.6 ? 'sawtooth' :
        avgAggression < 0.3 ? 'sine' :
        'triangle';

      // Dominant trait (speed) → frequency: 110–550 Hz
      const freq = 110 + avgSpeed * 440;
      // Population share → voice volume
      const voiceGain = totalPop > 0 ? (data.count / totalPop) * 0.22 : 0;

      if (!this.voiceMap.has(sid)) {
        // New species: create voice with 2-second fade-in
        const osc = ctx.createOscillator();
        osc.type = oscType;
        osc.frequency.value = freq;

        const harmonyOsc = ctx.createOscillator();
        harmonyOsc.type = oscType;
        harmonyOsc.frequency.value = freq * harmonyRatio;

        const harmonyGain = ctx.createGain();
        harmonyGain.gain.value = 0.4;

        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0, now);
        envGain.gain.linearRampToValueAtTime(voiceGain, now + 2.0);

        osc.connect(envGain);
        harmonyOsc.connect(harmonyGain);
        harmonyGain.connect(envGain);
        envGain.connect(this.speciesBus);

        osc.start(now);
        harmonyOsc.start(now);

        this.voiceMap.set(sid, { osc, harmonyOsc, envGain, harmonyGain, fadingOut: false });
      } else {
        const voice = this.voiceMap.get(sid)!;
        if (voice.fadingOut) continue;

        voice.osc.type = oscType;
        voice.harmonyOsc.type = oscType;
        voice.osc.frequency.setTargetAtTime(freq, now, 3.0);
        voice.harmonyOsc.frequency.setTargetAtTime(freq * harmonyRatio, now, 3.0);
        voice.envGain.gain.setTargetAtTime(voiceGain, now, 2.0);
      }
    }

    // Fade out extinct species voices
    for (const [sid, voice] of this.voiceMap.entries()) {
      if (!speciesData.has(sid) && !voice.fadingOut) {
        voice.fadingOut = true;
        voice.envGain.gain.setTargetAtTime(0, now, 1.5);
        const stopAt = now + 6;
        try { voice.osc.stop(stopAt); } catch { /* already stopped */ }
        try { voice.harmonyOsc.stop(stopAt); } catch { /* already stopped */ }
        setTimeout(() => { this.voiceMap.delete(sid); }, 6500);
      }
    }
  }

  private schedulePulse(now: number): void {
    const interval = 60 / this.currentBPM;
    // Schedule beats in a 0.5-second lookahead window
    while (this.nextBeatTime < now + 0.5) {
      if (this.nextBeatTime >= now) {
        const t = this.nextBeatTime;
        this.pulseEnv.gain.setValueAtTime(0.75, t);
        this.pulseEnv.gain.exponentialRampToValueAtTime(0.001, t + interval * 0.22);
      }
      this.nextBeatTime += interval;
    }
  }

  private checkEvolutionaryEvents(
    world: World,
    speciationEvents: SpeciationEvent[],
    now: number
  ): void {
    // Speciation → ascending arpeggio in new species' timbre
    for (const evt of speciationEvents) {
      const key = `${evt.tick}_${evt.childSpeciesId}`;
      if (!this.processedSpeciation.has(key)) {
        this.processedSpeciation.add(key);
        this.playSpeciationArpeggio(evt.childSpeciesId, now);
      }
    }

    // Mass extinction: >30% population loss in 5 seconds real time
    if (now > this.extinctionCooldownUntil) {
      const fiveSecondsAgo = now - 5;
      const oldSample = this.popHistory.find(p => p.time >= fiveSecondsAgo);
      if (oldSample && oldSample.pop > 15) {
        const loss = (oldSample.pop - world.creatures.size) / oldSample.pop;
        if (loss > 0.3) {
          this.playExtinctionRumble(now);
          this.extinctionCooldownUntil = now + 15;
        }
      }
    }

    // Mutation chime: check trait frequencies every 300 ticks
    if (
      world.tick - this.lastMutationCheckTick >= 300 &&
      now > this.mutationCooldownUntil
    ) {
      this.lastMutationCheckTick = world.tick;
      this.checkMutationChime(world, now);
    }
  }

  private checkMutationChime(world: World, now: number): void {
    // One pass: compute per-species trait sums and counts
    const speciesGroups = new Map<string, { count: number; sums: number[] }>();
    for (const creature of world.creatures.values()) {
      const sid = creature.speciesId;
      let d = speciesGroups.get(sid);
      if (!d) {
        d = { count: 0, sums: new Array(8).fill(0) };
        speciesGroups.set(sid, d);
      }
      d.count++;
      for (let i = 0; i < 8; i++) d.sums[i] += creature.genome[i];
    }

    for (const [sid, d] of speciesGroups.entries()) {
      if (d.count < 5) continue;
      const avgs = d.sums.map(s => s / d.count);
      const cached = this.traitCache.get(sid);

      if (cached) {
        for (let gene = 0; gene < 8; gene++) {
          const shift = Math.abs(avgs[gene] - cached[gene]);
          // Trait shifted >6% and is meaningfully expressed (>10% frequency proxy)
          if (shift > 0.06 && avgs[gene] > 0.1) {
            const mutKey = `${sid}_${gene}_${Math.floor(avgs[gene] * 10)}`;
            if (!this.processedMutations.has(mutKey)) {
              this.processedMutations.add(mutKey);
              // Different pitch per gene: C4 (261 Hz) and up
              this.playMutationChime(261 + gene * 44, now);
              this.mutationCooldownUntil = now + 2;
              return;
            }
          }
        }
      }

      this.traitCache.set(sid, avgs);
    }
  }

  private playMutationChime(baseFreq: number, now: number): void {
    const ctx = this.ctx!;
    // Bell-like partials: fundamental, 2.756×, 5.404×
    [1, 2.756, 5.404].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * ratio;
      const amp = 0.13 / (i + 1);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(gain);
      gain.connect(this.eventsMixGain);
      osc.start(now);
      osc.stop(now + 1.8);
    });
  }

  private playExtinctionRumble(now: number): void {
    const ctx = this.ctx!;
    const dur = 3.0;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // BiquadFilter on noise buffer per spec
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 80;
    filter.Q.value = 7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1.0, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.eventsMixGain);
    src.start(now);
  }

  private playSpeciationArpeggio(speciesId: string, now: number): void {
    const ctx = this.ctx!;

    // Derive consistent timbre and pitch from species ID hash
    let hash = 0;
    for (const ch of speciesId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
    const baseFreq = 220 + (Math.abs(hash) % 16) * 22; // 220–550 Hz
    const types: OscillatorType[] = ['triangle', 'sine', 'sawtooth'];
    const oscType = types[Math.abs(hash >> 8) % 3];

    // Ascending arpeggio: root, major third, perfect fifth, octave
    [1, 1.25, 1.5, 2.0].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = oscType;
      osc.frequency.value = baseFreq * ratio;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain);
      gain.connect(this.eventsMixGain);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  }

  // ─── User-facing setters ───────────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (!this.ctx) return;
    const target = muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  setMasterVolume(vol: number): void {
    this.settings.masterVolume = vol;
    if (!this.ctx || this.settings.muted) return;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.15);
  }

  setSpeciesVoicesMix(mix: number): void {
    this.settings.speciesVoicesMix = mix;
    if (!this.ctx) return;
    this.speciesMixGain.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.15);
  }

  setEventsMix(mix: number): void {
    this.settings.eventsMix = mix;
    if (!this.ctx) return;
    this.eventsMixGain.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.15);
  }

  setPulseMix(mix: number): void {
    this.settings.pulseMix = mix;
    if (!this.ctx) return;
    this.pulseMixGain.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.15);
  }

  getSettings(): SoundscapeSettings {
    return { ...this.settings };
  }

  destroy(): void {
    for (const voice of this.voiceMap.values()) {
      try { voice.osc.stop(); } catch { /* already stopped */ }
      try { voice.harmonyOsc.stop(); } catch { /* already stopped */ }
    }
    this.voiceMap.clear();
    try { this.pulseOsc.stop(); } catch { /* already stopped */ }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this._initialized = false;
  }
}
