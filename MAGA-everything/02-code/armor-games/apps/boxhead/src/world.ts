import type { Rect } from './entities';

/**
 * ArenaRoom — room layouts (BH-1.2: two rooms minimum).
 * Obstacles are AABBs; bullets and bodies collide with them.
 * Layouts are placeholders until ARCADE verifies the original room roster.
 */

export interface ArenaRoom {
  id: string;
  name: string;
  obstacles: Rect[];
  /** barrel anchor points (subset used per run is fine) */
  barrels: { x: number; y: number }[];
  /** player 1 spawn */
  spawn: { x: number; y: number };
  /** player 2 spawn (BH-2 co-op/deathmatch) */
  spawn2: { x: number; y: number };
}

export const ROOMS: ArenaRoom[] = [
  {
    id: 'open-yard',
    name: 'OPEN YARD',
    obstacles: [
      { x: 200, y: 140, w: 60, h: 40 },
      { x: 380, y: 220, w: 60, h: 40 },
    ],
    barrels: [
      { x: 150, y: 300 },
      { x: 500, y: 110 },
    ],
    spawn: { x: 320, y: 200 },
    spawn2: { x: 220, y: 200 },
  },
  {
    id: 'pillars',
    name: 'PILLARS',
    obstacles: [
      { x: 140, y: 110, w: 36, h: 36 },
      { x: 464, y: 110, w: 36, h: 36 },
      { x: 140, y: 254, w: 36, h: 36 },
      { x: 464, y: 254, w: 36, h: 36 },
    ],
    barrels: [
      { x: 320, y: 110 },
      { x: 320, y: 300 },
    ],
    spawn: { x: 320, y: 200 },
    spawn2: { x: 320, y: 300 },
  },
];

/**
 * WaveDirector — escalating spawn tables.
 * ALL NUMBERS ARE TBD ARCADE PLACEHOLDERS — replace with captured originals.
 */
export interface WaveTable {
  count: number;
  speed: number;
  runners: number;
  spawnEvery: number;
}

export const WAVE_TABLES: WaveTable[] = [
  { count: 5, speed: 34, runners: 0, spawnEvery: 1.4 },
  { count: 9, speed: 40, runners: 2, spawnEvery: 1.1 },
  { count: 14, speed: 46, runners: 4, spawnEvery: 0.85 },
];

/**
 * ScoreSystem — streak multiplier + weapon ladder stubs.
 * Thresholds are PLACEHOLDERS (TBD ARCADE playtest).
 */
export type WeaponTier = 'pistol' | 'shotgun' | 'uzi' | 'grenades';

export class ScoreSystem {
  score = 0;
  mult = 1;
  private multTimer = 0;

  kill(): number {
    const gained = 100 * this.mult;
    this.score += gained;
    this.mult = Math.min(20, this.mult + 1);
    this.multTimer = 3.5;
    return gained;
  }

  playerHit(): void {
    this.mult = 1;
  }

  tick(dt: number): void {
    if (this.mult > 1) {
      this.multTimer -= dt;
      if (this.multTimer <= 0) {
        this.mult = Math.max(1, this.mult - 1);
        this.multTimer = 1.2;
      }
    }
  }

  /** weapon ladder stub — PLACEHOLDER thresholds */
  weaponForMult(): WeaponTier {
    if (this.mult >= 14) return 'grenades';
    if (this.mult >= 8) return 'uzi';
    if (this.mult >= 4) return 'shotgun';
    return 'pistol';
  }
}

/** per-weapon fire behavior stubs (TBD ARCADE tables) */
export function fireDelay(w: WeaponTier): number {
  switch (w) {
    case 'uzi': return 0.14;
    case 'shotgun': return 0.5;
    case 'grenades': return 0.8; // stub: grenades not implemented yet, fires single
    default: return 0.34;
  }
}

export function ammoPerShot(w: WeaponTier): number {
  return w === 'grenades' ? 2 : 1; // TBD ARCADE — AoE costs more per lob
}
