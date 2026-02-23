// genes[0]: speed (0–1, maps to 1–5 px/tick)
// genes[1]: size (0–1, maps to 4–14px radius)
// genes[2]: visionRadius (0–1, maps to 30–150px)
// genes[3]: metabolicRate (0–1, higher = more energy burn)
// genes[4..5]: color hue + saturation seed (maps to HSL)
// genes[6]: aggression (0–1, probability of attacking nearby creatures)
// genes[7]: camouflage (0–1, affects detection probability)
export type Genome = Float32Array;

export function createRandomGenome(): Genome {
  const g = new Float32Array(8);
  for (let i = 0; i < 8; i++) {
    g[i] = Math.random();
  }
  return g;
}

function gaussianRandom(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function mutate(genome: Genome, rate: number): Genome {
  const mutated = new Float32Array(genome);
  for (let i = 0; i < 8; i++) {
    const noise = gaussianRandom() * rate;
    mutated[i] = Math.max(0, Math.min(1, mutated[i] + noise));
  }
  return mutated;
}

export function crossover(a: Genome, b: Genome): Genome {
  const child = new Float32Array(8);
  const point = Math.floor(Math.random() * 8);
  for (let i = 0; i < 8; i++) {
    child[i] = i < point ? a[i] : b[i];
  }
  return child;
}

export function geneticDistance(a: Genome, b: Genome): number {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function getSpeed(genome: Genome): number {
  return 1 + genome[0] * 4;
}

export function getSize(genome: Genome): number {
  return 4 + genome[1] * 10;
}

export function getVisionRadius(genome: Genome): number {
  return 30 + genome[2] * 120;
}

export function getMetabolicRate(genome: Genome): number {
  return genome[3];
}

export function getColor(genome: Genome): string {
  const h = genome[4] * 360;
  const s = 50 + genome[5] * 40;
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, 45%)`;
}

export function getAggression(genome: Genome): number {
  return genome[6];
}

export function getCamouflage(genome: Genome): number {
  return genome[7];
}

export interface GenomePreset {
  name: string;
  genome: Float32Array;
}

export const GENOME_PRESETS: GenomePreset[] = [
  // [speed, size, vision, metabolism, hue, saturation, aggression, camouflage]
  { name: 'Apex Predator',   genome: Float32Array.from([0.85, 0.80, 0.70, 0.50, 0.05, 0.90, 0.92, 0.10]) },
  { name: 'Tiny Scavenger',  genome: Float32Array.from([0.75, 0.05, 0.85, 0.20, 0.45, 0.60, 0.05, 0.30]) },
  { name: 'Ghost',           genome: Float32Array.from([0.45, 0.35, 0.50, 0.25, 0.55, 0.35, 0.08, 0.92]) },
  { name: 'Marathon Runner', genome: Float32Array.from([0.95, 0.25, 0.60, 0.05, 0.30, 0.70, 0.15, 0.40]) },
  { name: 'Armored Tank',    genome: Float32Array.from([0.10, 0.95, 0.35, 0.65, 0.85, 0.50, 0.78, 0.25]) },
];
