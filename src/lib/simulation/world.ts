import { Creature, FoodPellet, WorldInterface } from './creature';
import { createRandomGenome, geneticDistance } from './genome';

export interface SpeciationEvent {
  parentSpeciesId: string;
  childSpeciesId: string;
  tick: number;
  ancestorId: string | null;
  color: string;
  label: string;
}

export interface ExtinctionRecord {
  tick: number;
  speciesId: string;
}

// Latin name components for species naming
const GENUS_PARTS = [
  'Velox', 'Rapidus', 'Magnus', 'Parvus', 'Obscura', 'Clara',
  'Robustus', 'Gracilis', 'Ferox', 'Mitis', 'Caecus', 'Acutus',
  'Lentus', 'Agilis', 'Fortis', 'Tenuis',
];
const EPITHET_PARTS = [
  'rapida', 'obscura', 'maxima', 'minima', 'ferox', 'mitis',
  'vulgaris', 'rara', 'nova', 'antiqua', 'brevis', 'longa',
  'major', 'minor', 'grandis', 'gracilis',
];

function generateSpeciesLabel(id: string): string {
  // Use hash of id to pick consistent names
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  const gi = Math.abs(hash) % GENUS_PARTS.length;
  const ei = Math.abs(hash >> 4) % EPITHET_PARTS.length;
  return `${GENUS_PARTS[gi]} ${EPITHET_PARTS[ei]}`;
}

export class World implements WorldInterface {
  readonly width = 1200;
  readonly height = 800;

  mutationRate = 0.02;
  foodAbundance = 1;

  creatures: Map<string, Creature> = new Map();
  foodPellets: FoodPellet[] = [];
  extinctionHistory: ExtinctionRecord[] = [];

  tick = 0;
  generation = 0;

  private speciationListeners: Array<(event: SpeciationEvent) => void> = [];
  private nextSpeciesId = 1;
  speciesColors: Map<string, string> = new Map();
  speciesLabels: Map<string, string> = new Map();
  private lastSpeciationCheck = 0;
  private livingSpeciesCache: Set<string> = new Set();

  constructor() {
    this.speciesColors.set('primordial', 'hsl(140, 65%, 45%)');
    this.speciesLabels.set('primordial', 'Primordial');
  }

  onSpeciation(listener: (event: SpeciationEvent) => void): () => void {
    this.speciationListeners.push(listener);
    return () => {
      this.speciationListeners = this.speciationListeners.filter(
        (l) => l !== listener
      );
    };
  }

  private emitSpeciation(event: SpeciationEvent) {
    this.speciationListeners.forEach((l) => l(event));
  }

  initialize(populationSize = 50, foodCount = 200) {
    this.creatures.clear();
    this.foodPellets = [];
    this.extinctionHistory = [];
    this.tick = 0;
    this.generation = 0;
    this.nextSpeciesId = 1;
    this.speciesColors = new Map([['primordial', 'hsl(140, 65%, 45%)']]);
    this.speciesLabels = new Map([['primordial', 'Primordial']]);
    this.lastSpeciationCheck = 0;
    this.livingSpeciesCache = new Set(['primordial']);

    const cx = this.width / 2;
    const cy = this.height / 2;

    for (let i = 0; i < populationSize; i++) {
      const creature = new Creature(createRandomGenome(), {
        x: cx + (Math.random() - 0.5) * 200,
        y: cy + (Math.random() - 0.5) * 200,
      });
      creature.speciesId = 'primordial';
      creature.energy = 40 + Math.random() * 40;
      this.creatures.set(creature.id, creature);
    }

    for (let i = 0; i < foodCount; i++) {
      this.foodPellets.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        energy: 10 + Math.random() * 10,
      });
    }
  }

  advance() {
    this.tick++;

    // Spawn food
    const rate = 2 * this.foodAbundance;
    for (let i = 0; i < Math.floor(rate); i++) {
      this.foodPellets.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        energy: 8 + Math.random() * 12,
      });
    }
    if (Math.random() < rate % 1) {
      this.foodPellets.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        energy: 8 + Math.random() * 12,
      });
    }

    // Cap food
    if (this.foodPellets.length > 600) {
      this.foodPellets.splice(0, this.foodPellets.length - 600);
    }

    // Update creatures
    const newCreatures: Creature[] = [];
    for (const creature of this.creatures.values()) {
      const child = creature.update(this);
      if (child) newCreatures.push(child);
    }

    for (const child of newCreatures) {
      this.creatures.set(child.id, child);
    }

    // Remove dead
    for (const [id, creature] of this.creatures.entries()) {
      if (creature.dead) {
        this.creatures.delete(id);
      }
    }

    // Increment generation
    if (this.tick % 500 === 0) {
      this.generation++;
    }

    // Speciation check
    if (this.tick - this.lastSpeciationCheck >= 200 && this.creatures.size >= 5) {
      this.lastSpeciationCheck = this.tick;
      this.checkSpeciation();
    }
  }

  private checkSpeciation() {
    const creatures = Array.from(this.creatures.values());
    if (creatures.length < 3) return;

    const threshold = 0.35;
    const assigned = new Map<string, number>(); // creatureId -> clusterId
    const clusters: Creature[][] = [];

    for (const creature of creatures) {
      if (assigned.has(creature.id)) continue;

      const clusterId = clusters.length;
      const cluster: Creature[] = [creature];
      assigned.set(creature.id, clusterId);

      for (const other of creatures) {
        if (assigned.has(other.id)) continue;
        if (geneticDistance(creature.genome, other.genome) < threshold) {
          cluster.push(other);
          assigned.set(other.id, clusterId);
        }
      }

      clusters.push(cluster);
    }

    // For each cluster, decide if a new speciation event occurs
    for (const cluster of clusters) {
      if (cluster.length < 4) continue;

      // Count species in cluster
      const speciesCounts = new Map<string, Creature[]>();
      for (const c of cluster) {
        const arr = speciesCounts.get(c.speciesId) || [];
        arr.push(c);
        speciesCounts.set(c.speciesId, arr);
      }

      if (speciesCounts.size <= 1) continue;

      // Find dominant species
      let dominantId = '';
      let dominantCount = 0;
      for (const [sid, arr] of speciesCounts.entries()) {
        if (arr.length > dominantCount) {
          dominantCount = arr.length;
          dominantId = sid;
        }
      }

      // Minority groups may form new species
      for (const [sid, arr] of speciesCounts.entries()) {
        if (sid === dominantId) continue;
        if (arr.length < 3) continue;

        // Assign a new species to this group
        const newSpeciesId = `species_${this.nextSpeciesId++}`;
        const rep = arr[0];
        const h = rep.genome[4] * 360;
        const s = 50 + rep.genome[5] * 40;
        const color = `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, 45%)`;
        const label = generateSpeciesLabel(newSpeciesId);

        this.speciesColors.set(newSpeciesId, color);
        this.speciesLabels.set(newSpeciesId, label);

        for (const c of arr) {
          c.speciesId = newSpeciesId;
        }

        this.emitSpeciation({
          parentSpeciesId: sid,
          childSpeciesId: newSpeciesId,
          tick: this.tick,
          ancestorId: rep.ancestorId,
          color,
          label,
        });
      }
    }

    // Check extinctions
    const livingSpecies = new Set(
      Array.from(this.creatures.values()).map((c) => c.speciesId)
    );
    this.livingSpeciesCache = livingSpecies;

    for (const [speciesId] of this.speciesColors.entries()) {
      if (
        !livingSpecies.has(speciesId) &&
        !this.extinctionHistory.find((e) => e.speciesId === speciesId)
      ) {
        this.extinctionHistory.push({ tick: this.tick, speciesId });
      }
    }
  }

  triggerExtinctionEvent() {
    const creatures = Array.from(this.creatures.values());
    const killCount = Math.floor(creatures.length * 0.7);
    // Shuffle and kill
    for (let i = creatures.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [creatures[i], creatures[j]] = [creatures[j], creatures[i]];
    }
    for (let i = 0; i < killCount; i++) {
      creatures[i].dead = true;
      this.creatures.delete(creatures[i].id);
    }
  }

  getStats() {
    const creatures = Array.from(this.creatures.values());
    const livingSpecies = new Set(creatures.map((c) => c.speciesId));

    let totalSpeed = 0;
    let totalSize = 0;
    let predatorCount = 0;
    let preyCount = 0;

    for (const c of creatures) {
      totalSpeed += c.speed;
      totalSize += c.radius;
      if (c.aggression > 0.6) predatorCount++;
      else preyCount++;
    }

    const n = creatures.length;
    return {
      population: n,
      predatorCount,
      preyCount,
      livingSpecies: livingSpecies.size,
      extinctSpecies: this.extinctionHistory.length,
      avgSpeed: n > 0 ? totalSpeed / n : 0,
      avgSize: n > 0 ? totalSize / n : 0,
      generation: this.generation,
      tick: this.tick,
    };
  }

  // WorldInterface
  getCreaturesInRadius(
    pos: { x: number; y: number },
    radius: number,
    excludeId: string
  ): Creature[] {
    const result: Creature[] = [];
    const r2 = radius * radius;
    for (const creature of this.creatures.values()) {
      if (creature.id === excludeId || creature.dead) continue;
      const dx = creature.position.x - pos.x;
      const dy = creature.position.y - pos.y;
      if (dx * dx + dy * dy <= r2) result.push(creature);
    }
    return result;
  }

  getFoodInRadius(
    pos: { x: number; y: number },
    radius: number
  ): FoodPellet[] {
    const r2 = radius * radius;
    return this.foodPellets.filter((f) => {
      const dx = f.x - pos.x;
      const dy = f.y - pos.y;
      return dx * dx + dy * dy <= r2;
    });
  }

  consumeFoodAt(
    pos: { x: number; y: number },
    radius: number,
    callback: (energy: number) => void
  ) {
    const r2 = radius * radius;
    for (let i = 0; i < this.foodPellets.length; i++) {
      const f = this.foodPellets[i];
      const dx = f.x - pos.x;
      const dy = f.y - pos.y;
      if (dx * dx + dy * dy <= r2) {
        callback(f.energy);
        this.foodPellets.splice(i, 1);
        return;
      }
    }
  }

  spawnFoodAt(x: number, y: number, energy: number) {
    this.foodPellets.push({ x, y, energy });
  }
}
