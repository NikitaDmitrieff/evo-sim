import {
  Genome,
  crossover,
  mutate,
  getSpeed,
  getSize,
  getVisionRadius,
  getMetabolicRate,
  getAggression,
  getCamouflage,
} from './genome';
import { BiomeProperties, CELL_SIZE } from './biome';

let idCounter = 0;

export interface FoodPellet {
  x: number;
  y: number;
  energy: number;
}

export interface WorldInterface {
  width: number;
  height: number;
  mutationRate: number;
  getCreaturesInRadius(
    pos: { x: number; y: number },
    radius: number,
    excludeId: string
  ): Creature[];
  getFoodInRadius(
    pos: { x: number; y: number },
    radius: number
  ): FoodPellet[];
  consumeFoodAt(
    pos: { x: number; y: number },
    radius: number,
    callback: (energy: number) => void
  ): void;
  spawnFoodAt(x: number, y: number, energy: number): void;
  getBiomeId(gridX: number, gridY: number): number;
  getBiome(gridX: number, gridY: number): BiomeProperties;
}

export class Creature {
  id: string;
  genome: Genome;
  energy: number;
  age: number;
  speciesId: string;
  ancestorId: string | null;
  position: { x: number; y: number };
  velocity: { dx: number; dy: number };
  dead: boolean;

  // Derived phenotype
  radius: number;
  speed: number;
  visionRadius: number;
  metabolicRate: number;
  aggression: number;
  camouflage: number;

  // Biome tracking
  biomeHistory: number[];
  biomeResidencyTicks: number;

  constructor(
    genome: Genome,
    position: { x: number; y: number },
    ancestorId: string | null = null
  ) {
    this.id = `c${++idCounter}`;
    this.genome = genome;
    this.energy = 50;
    this.age = 0;
    this.speciesId = 'primordial';
    this.ancestorId = ancestorId;
    this.position = { ...position };
    this.velocity = {
      dx: (Math.random() - 0.5) * 2,
      dy: (Math.random() - 0.5) * 2,
    };
    this.dead = false;

    this.radius = getSize(genome);
    this.speed = getSpeed(genome);
    this.visionRadius = getVisionRadius(genome);
    this.metabolicRate = getMetabolicRate(genome);
    this.aggression = getAggression(genome);
    this.camouflage = getCamouflage(genome);

    this.biomeHistory = [];
    this.biomeResidencyTicks = 0;
  }

  update(world: WorldInterface): Creature | null {
    if (this.dead) return null;

    this.age++;

    // Look up current biome and apply modifiers
    const gridX = Math.floor(this.position.x / CELL_SIZE);
    const gridY = Math.floor(this.position.y / CELL_SIZE);
    const biome = world.getBiome(gridX, gridY);

    const effectiveVisionRadius = this.visionRadius * biome.visibility_mod;
    const effectiveSpeed = this.speed * (1 / biome.move_cost);
    const effectiveCamouflage = this.camouflage * biome.camo_advantage;

    const nearby = world.getCreaturesInRadius(
      this.position,
      effectiveVisionRadius,
      this.id
    );
    const food = world.getFoodInRadius(this.position, effectiveVisionRadius);

    // Determine movement target
    const threats = nearby.filter(
      (c) => c.aggression > 0.6 && c.radius > this.radius * 0.8
    );

    if (threats.length > 0) {
      // Flee from nearest threat
      const threat = threats.reduce((closest, c) => {
        const d1 =
          (c.position.x - this.position.x) ** 2 +
          (c.position.y - this.position.y) ** 2;
        const d2 =
          (closest.position.x - this.position.x) ** 2 +
          (closest.position.y - this.position.y) ** 2;
        return d1 < d2 ? c : closest;
      });
      const dx = this.position.x - threat.position.x;
      const dy = this.position.y - threat.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.velocity.dx = (dx / dist) * effectiveSpeed;
      this.velocity.dy = (dy / dist) * effectiveSpeed;
    } else if (this.aggression > 0.6 && nearby.length > 0) {
      // Predatory behavior: hunt smaller creatures
      const visiblePrey = nearby.filter(
        (c) =>
          c.radius < this.radius * 1.2 &&
          Math.random() > effectiveCamouflage * 0.5
      );
      if (visiblePrey.length > 0) {
        const prey = visiblePrey.reduce((closest, c) => {
          const d1 =
            (c.position.x - this.position.x) ** 2 +
            (c.position.y - this.position.y) ** 2;
          const d2 =
            (closest.position.x - this.position.x) ** 2 +
            (closest.position.y - this.position.y) ** 2;
          return d1 < d2 ? c : closest;
        });
        const dx = prey.position.x - this.position.x;
        const dy = prey.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.velocity.dx = (dx / dist) * effectiveSpeed;
        this.velocity.dy = (dy / dist) * effectiveSpeed;

        // Attack on contact
        if (dist < this.radius + prey.radius + 2) {
          if (Math.random() < this.aggression) {
            prey.energy -= 25;
            this.energy += 18;
            if (prey.energy <= 0) {
              prey.dead = true;
              world.spawnFoodAt(prey.position.x, prey.position.y, 20);
            }
          }
        }
      } else if (food.length > 0) {
        this.steerToward(food[0].x, food[0].y, effectiveSpeed);
      } else {
        this.wander(effectiveSpeed);
      }
    } else if (food.length > 0) {
      // Seek nearest food
      const nearest = food.reduce((closest, f) => {
        const d1 =
          (f.x - this.position.x) ** 2 + (f.y - this.position.y) ** 2;
        const d2 =
          (closest.x - this.position.x) ** 2 +
          (closest.y - this.position.y) ** 2;
        return d1 < d2 ? f : closest;
      });
      this.steerToward(nearest.x, nearest.y, effectiveSpeed);
    } else {
      this.wander(effectiveSpeed);
    }

    // Move
    this.position.x = Math.max(
      this.radius,
      Math.min(world.width - this.radius, this.position.x + this.velocity.dx)
    );
    this.position.y = Math.max(
      this.radius,
      Math.min(world.height - this.radius, this.position.y + this.velocity.dy)
    );

    // Bounce off walls
    if (
      this.position.x <= this.radius ||
      this.position.x >= world.width - this.radius
    ) {
      this.velocity.dx *= -1;
    }
    if (
      this.position.y <= this.radius ||
      this.position.y >= world.height - this.radius
    ) {
      this.velocity.dy *= -1;
    }

    // Update biome history after moving
    const newGridX = Math.floor(this.position.x / CELL_SIZE);
    const newGridY = Math.floor(this.position.y / CELL_SIZE);
    const currentBiomeId = world.getBiomeId(newGridX, newGridY);
    const lastBiomeId =
      this.biomeHistory.length > 0
        ? this.biomeHistory[this.biomeHistory.length - 1]
        : -1;
    if (currentBiomeId !== lastBiomeId) {
      this.biomeHistory.push(currentBiomeId);
      if (this.biomeHistory.length > 5) this.biomeHistory.shift();
      this.biomeResidencyTicks = 0;
    } else {
      this.biomeResidencyTicks++;
    }

    // Consume food pellets
    world.consumeFoodAt(this.position, this.radius + 2, (energy) => {
      this.energy = Math.min(100, this.energy + energy);
    });

    // Metabolic cost scaled by biome move_cost
    const baseCost =
      0.05 +
      this.metabolicRate * 0.08 +
      (this.radius / 14) * 0.04 +
      (this.speed / 5) * 0.04;
    this.energy -= baseCost * biome.move_cost;

    if (this.energy <= 0) {
      this.dead = true;
      world.spawnFoodAt(this.position.x, this.position.y, 15);
      return null;
    }

    // Reproduce
    if (this.energy > 80 && Math.random() < 0.008) {
      this.energy -= 40;
      const mateOptions = nearby.filter(
        (c) => c.speciesId === this.speciesId && !c.dead
      );
      let childGenome: Genome;
      if (mateOptions.length > 0) {
        const mate =
          mateOptions[Math.floor(Math.random() * mateOptions.length)];
        childGenome = mutate(
          crossover(this.genome, mate.genome),
          world.mutationRate
        );
      } else {
        childGenome = mutate(this.genome, world.mutationRate);
      }

      const child = new Creature(
        childGenome,
        {
          x: Math.max(
            this.radius,
            Math.min(
              world.width - this.radius,
              this.position.x + (Math.random() - 0.5) * 20
            )
          ),
          y: Math.max(
            this.radius,
            Math.min(
              world.height - this.radius,
              this.position.y + (Math.random() - 0.5) * 20
            )
          ),
        },
        this.id
      );
      child.speciesId = this.speciesId;
      return child;
    }

    return null;
  }

  private steerToward(tx: number, ty: number, spd: number) {
    const dx = tx - this.position.x;
    const dy = ty - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.velocity.dx = (dx / dist) * spd;
    this.velocity.dy = (dy / dist) * spd;
  }

  private wander(spd: number) {
    this.velocity.dx += (Math.random() - 0.5) * 0.4;
    this.velocity.dy += (Math.random() - 0.5) * 0.4;
    const mag =
      Math.sqrt(this.velocity.dx ** 2 + this.velocity.dy ** 2) || 1;
    this.velocity.dx = (this.velocity.dx / mag) * spd;
    this.velocity.dy = (this.velocity.dy / mag) * spd;
  }
}
