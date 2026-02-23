export const BIOME_COUNT = 5;
export const GRID_COLS = 120;
export const GRID_ROWS = 80;
export const CELL_SIZE = 10; // 10x10 px per cell on the 1200x800 canvas

export const BIOME_NAMES = [
  'Savanna',
  'Dense Forest',
  'Desert',
  'Deep Ocean',
  'Arctic Tundra',
] as const;

export interface BiomeProperties {
  food: number;
  visibility_mod: number;
  move_cost: number;
  camo_advantage: number;
}

export const BIOMES: BiomeProperties[] = [
  { food: 1.0, visibility_mod: 1.0, move_cost: 1.0, camo_advantage: 0.8 }, // 0: Savanna
  { food: 1.4, visibility_mod: 0.4, move_cost: 1.3, camo_advantage: 1.6 }, // 1: Dense Forest
  { food: 0.3, visibility_mod: 1.8, move_cost: 0.8, camo_advantage: 0.5 }, // 2: Desert
  { food: 0.7, visibility_mod: 0.6, move_cost: 0.5, camo_advantage: 1.2 }, // 3: Deep Ocean
  { food: 0.5, visibility_mod: 1.2, move_cost: 1.6, camo_advantage: 1.0 }, // 4: Arctic Tundra
];

export function getBiomeAt(
  biomeGrid: Uint8Array,
  gridX: number,
  gridY: number
): BiomeProperties {
  const gx = Math.max(0, Math.min(GRID_COLS - 1, gridX));
  const gy = Math.max(0, Math.min(GRID_ROWS - 1, gridY));
  return BIOMES[biomeGrid[gy * GRID_COLS + gx]];
}

export function getBiomeIdAt(
  biomeGrid: Uint8Array,
  gridX: number,
  gridY: number
): number {
  const gx = Math.max(0, Math.min(GRID_COLS - 1, gridX));
  const gy = Math.max(0, Math.min(GRID_ROWS - 1, gridY));
  return biomeGrid[gy * GRID_COLS + gx];
}
