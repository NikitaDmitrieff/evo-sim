import { Creature, FoodPellet, WorldInterface } from './creature';
import { createRandomGenome, geneticDistance } from './genome';
import {
  BIOMES,
  BIOME_COUNT,
  BIOME_NAMES,
  BiomeProperties,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  getBiomeAt,
  getBiomeIdAt,
} from './biome';

export interface SpeciationEvent {
  parentSpeciesId: string;
  childSpeciesId: string;
  tick: number;
  ancestorId: string | null;
  color: string;
  label: string;
  isAllopatric: boolean;
  sourceBiomeId: number;
}

export interface ExtinctionRecord {
  tick: number;
  speciesId: string;
}

export interface AdaptiveRadiationEvent {
  biomeType: number;
  epicenterX: number;
  epicenterY: number;
  seedPopulation: number;
  speciesColors: string[];
}

export interface BiomeStat {
  biomeId: number;
  name: string;
  creatureCount: number;
  dominantSpeciesId: string;
  dominantSpeciesLabel: string;
  avgFitness: number;
  avgSpeed: number;
  avgSize: number;
  avgCamouflage: number;
  speciationCount: number;
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
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  const gi = Math.abs(hash) % GENUS_PARTS.length;
  const ei = Math.abs(hash >> 4) % EPITHET_PARTS.length;
  return `${GENUS_PARTS[gi]} ${EPITHET_PARTS[ei]}`;
}

function modalValue(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [v, c] of counts.entries()) {
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}

export class World implements WorldInterface {
  readonly width = 1200;
  readonly height = 800;

  mutationRate = 0.02;
  foodAbundance = 1;

  creatures: Map<string, Creature> = new Map();
  foodPellets: FoodPellet[] = [];
  extinctionHistory: ExtinctionRecord[] = [];

  biomeGrid: Uint8Array = new Uint8Array(GRID_COLS * GRID_ROWS); // all zeros = Savanna
  migrationLog: Map<string, number> = new Map();

  tick = 0;
  generation = 0;

  private speciationListeners: Array<(event: SpeciationEvent) => void> = [];
  private adaptiveRadiationListeners: Array<(event: AdaptiveRadiationEvent) => void> = [];
  private nextSpeciesId = 1;
  speciesColors: Map<string, string> = new Map();
  speciesLabels: Map<string, string> = new Map();
  private lastSpeciationCheck = 0;
  private livingSpeciesCache: Set<string> = new Set();
  private speciationEventsByBiome: Map<number, number> = new Map();

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

  onAdaptiveRadiation(listener: (event: AdaptiveRadiationEvent) => void): () => void {
    this.adaptiveRadiationListeners.push(listener);
    return () => {
      this.adaptiveRadiationListeners = this.adaptiveRadiationListeners.filter(
        (l) => l !== listener
      );
    };
  }

  private emitSpeciation(event: SpeciationEvent) {
    this.speciationListeners.forEach((l) => l(event));
  }

  private emitAdaptiveRadiation(event: AdaptiveRadiationEvent) {
    this.adaptiveRadiationListeners.forEach((l) => l(event));
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
    this.biomeGrid = new Uint8Array(GRID_COLS * GRID_ROWS);
    this.migrationLog = new Map();
    this.speciationEventsByBiome = new Map();

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

    // Spawn food weighted by biome food density
    const rate = 2 * this.foodAbundance;
    const spawnAttempts = Math.ceil(rate * 1.5);
    for (let i = 0; i < spawnAttempts; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const gx = Math.floor(x / CELL_SIZE);
      const gy = Math.floor(y / CELL_SIZE);
      const biomeFood = BIOMES[getBiomeIdAt(this.biomeGrid, gx, gy)].food;
      if (Math.random() < biomeFood) {
        this.foodPellets.push({ x, y, energy: 8 + Math.random() * 12 });
      }
    }

    // Cap food
    if (this.foodPellets.length > 600) {
      this.foodPellets.splice(0, this.foodPellets.length - 600);
    }

    // Update creatures and track migration
    const newCreatures: Creature[] = [];
    for (const creature of this.creatures.values()) {
      const prevBiomeId =
        creature.biomeHistory.length > 0
          ? creature.biomeHistory[creature.biomeHistory.length - 1]
          : 0;

      const child = creature.update(this);
      if (child) newCreatures.push(child);

      if (!creature.dead) {
        const newBiomeId =
          creature.biomeHistory.length > 0
            ? creature.biomeHistory[creature.biomeHistory.length - 1]
            : 0;
        if (prevBiomeId !== newBiomeId) {
          const key = `${prevBiomeId}→${newBiomeId}`;
          this.migrationLog.set(key, (this.migrationLog.get(key) ?? 0) + 1);
        }
      }
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

  paintBiome(
    gridX: number,
    gridY: number,
    brushRadius: number,
    biomeType: number
  ) {
    for (let dy = -brushRadius; dy <= brushRadius; dy++) {
      for (let dx = -brushRadius; dx <= brushRadius; dx++) {
        if (dx * dx + dy * dy <= brushRadius * brushRadius) {
          const gx = Math.max(0, Math.min(GRID_COLS - 1, gridX + dx));
          const gy = Math.max(0, Math.min(GRID_ROWS - 1, gridY + dy));
          this.biomeGrid[gy * GRID_COLS + gx] = biomeType;
        }
      }
    }

    // Check for adaptive radiation (>15 creatures within 150px)
    const epicenterX = (gridX + 0.5) * CELL_SIZE;
    const epicenterY = (gridY + 0.5) * CELL_SIZE;
    const nearby = this.getCreaturesInRadius(
      { x: epicenterX, y: epicenterY },
      150,
      ''
    );
    if (nearby.length > 15) {
      const colorSet = new Set<string>();
      for (const c of nearby) {
        const col = this.speciesColors.get(c.speciesId);
        if (col) colorSet.add(col);
      }
      const speciesColors = Array.from(colorSet).slice(0, 5);
      this.emitAdaptiveRadiation({
        biomeType,
        epicenterX,
        epicenterY,
        seedPopulation: nearby.length,
        speciesColors,
      });
    }
  }

  getBiomeStats(): BiomeStat[] {
    const biomeData: Array<{
      creatures: Creature[];
      speciesCounts: Map<string, number>;
    }> = Array.from({ length: BIOME_COUNT }, () => ({
      creatures: [],
      speciesCounts: new Map(),
    }));

    for (const creature of this.creatures.values()) {
      if (creature.dead) continue;
      const gx = Math.floor(creature.position.x / CELL_SIZE);
      const gy = Math.floor(creature.position.y / CELL_SIZE);
      const biomeId = getBiomeIdAt(this.biomeGrid, gx, gy);
      const data = biomeData[biomeId];
      data.creatures.push(creature);
      data.speciesCounts.set(
        creature.speciesId,
        (data.speciesCounts.get(creature.speciesId) ?? 0) + 1
      );
    }

    return biomeData.map((data, biomeId) => {
      const creatures = data.creatures;
      const n = creatures.length;

      let dominantSpeciesId = '';
      let maxCount = 0;
      for (const [sid, count] of data.speciesCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          dominantSpeciesId = sid;
        }
      }

      const avgFitness =
        n > 0
          ? creatures.reduce(
              (sum, c) => sum + c.energy / Math.max(1, c.age),
              0
            ) / n
          : 0;
      const avgSpeed = n > 0 ? creatures.reduce((sum, c) => sum + c.speed, 0) / n : 0;
      const avgSize = n > 0 ? creatures.reduce((sum, c) => sum + c.radius, 0) / n : 0;
      const avgCamouflage =
        n > 0 ? creatures.reduce((sum, c) => sum + c.camouflage, 0) / n : 0;

      return {
        biomeId,
        name: BIOME_NAMES[biomeId],
        creatureCount: n,
        dominantSpeciesId,
        dominantSpeciesLabel:
          this.speciesLabels.get(dominantSpeciesId) ?? dominantSpeciesId,
        avgFitness,
        avgSpeed,
        avgSize,
        avgCamouflage,
        speciationCount: this.speciationEventsByBiome.get(biomeId) ?? 0,
      };
    });
  }

  // WorldInterface implementations
  getBiomeId(gridX: number, gridY: number): number {
    return getBiomeIdAt(this.biomeGrid, gridX, gridY);
  }

  getBiome(gridX: number, gridY: number): BiomeProperties {
    return getBiomeAt(this.biomeGrid, gridX, gridY);
  }

  private checkSpeciation() {
    const creatures = Array.from(this.creatures.values());
    if (creatures.length < 3) return;

    const threshold = 0.35;
    const assigned = new Map<string, number>();
    const clusters: Creature[][] = [];

    for (const creature of creatures) {
      if (assigned.has(creature.id)) continue;

      const clusterId = clusters.length;
      const cluster: Creature[] = [creature];
      assigned.set(creature.id, clusterId);

      for (const other of creatures) {
        if (assigned.has(other.id)) continue;

        const genDist = geneticDistance(creature.genome, other.genome);

        // Biome isolation penalty: if both are biome residents in different biomes
        const creatureBiome =
          creature.biomeHistory.length > 0
            ? creature.biomeHistory[creature.biomeHistory.length - 1]
            : 0;
        const otherBiome =
          other.biomeHistory.length > 0
            ? other.biomeHistory[other.biomeHistory.length - 1]
            : 0;
        const biomeIsolated =
          creature.biomeResidencyTicks >= 200 &&
          other.biomeResidencyTicks >= 200 &&
          creatureBiome !== otherBiome;

        const effectiveDist = genDist + (biomeIsolated ? 0.15 : 0);

        if (effectiveDist < threshold) {
          cluster.push(other);
          assigned.set(other.id, clusterId);
        }
      }

      clusters.push(cluster);
    }

    for (const cluster of clusters) {
      if (cluster.length < 4) continue;

      const speciesCounts = new Map<string, Creature[]>();
      for (const c of cluster) {
        const arr = speciesCounts.get(c.speciesId) || [];
        arr.push(c);
        speciesCounts.set(c.speciesId, arr);
      }

      if (speciesCounts.size <= 1) continue;

      let dominantId = '';
      let dominantCount = 0;
      for (const [sid, arr] of speciesCounts.entries()) {
        if (arr.length > dominantCount) {
          dominantCount = arr.length;
          dominantId = sid;
        }
      }

      for (const [sid, arr] of speciesCounts.entries()) {
        if (sid === dominantId) continue;
        if (arr.length < 3) continue;

        // Determine if allopatric (biome-driven speciation)
        const parentCreatures = speciesCounts.get(dominantId) || [];
        const parentBiomes = parentCreatures.map(
          (c) => c.biomeHistory[c.biomeHistory.length - 1] ?? 0
        );
        const childBiomes = arr.map(
          (c) => c.biomeHistory[c.biomeHistory.length - 1] ?? 0
        );
        const parentModal = modalValue(parentBiomes);
        const childModal = modalValue(childBiomes);
        const isAllopatric = parentModal !== childModal;
        const sourceBiomeId = parentModal;

        const newSpeciesId = `species_${this.nextSpeciesId++}`;
        const rep = arr[0];
        const h = rep.genome[4] * 360;
        const s = 50 + rep.genome[5] * 40;
        const color = `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, 45%)`;
        const label = generateSpeciesLabel(newSpeciesId);

        this.speciesColors.set(newSpeciesId, color);
        this.speciesLabels.set(newSpeciesId, label);

        if (isAllopatric) {
          this.speciationEventsByBiome.set(
            sourceBiomeId,
            (this.speciationEventsByBiome.get(sourceBiomeId) ?? 0) + 1
          );
        }

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
          isAllopatric,
          sourceBiomeId,
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
