import type { Rect } from './entities';
import { type RoomTheme } from './palette';

/**
 * Content tables — BLOCKHEAD: ARENA NIGHTS.
 * Rooms, weapon ladder, enemy tiers and the endless wave planner all live
 * here as plain data so tuning never touches engine code.
 */

export interface ArenaRoom {
  id: string;
  name: string;
  blurb: string;
  theme: RoomTheme;
  obstacles: Rect[];
  /** barrel anchor points */
  barrels: { x: number; y: number }[];
  /** player 1 spawn */
  spawn: { x: number; y: number };
  /** player 2 spawn (co-op / deathmatch) */
  spawn2: { x: number; y: number };
}

/** Eight authored arenas — original 2Play Rooms scope (varied wall layouts,
 *  chokepoints and open kiting floors). */
export const ROOMS: ArenaRoom[] = [
  {
    id: 'open-yard',
    name: 'OPEN YARD',
    blurb: 'open kiting floor',
    theme: 'warehouse',
    obstacles: [
      { x: 200, y: 140, w: 60, h: 40 },
      { x: 380, y: 220, w: 60, h: 40 },
    ],
    barrels: [{ x: 150, y: 300 }, { x: 500, y: 110 }],
    spawn: { x: 320, y: 200 },
    spawn2: { x: 220, y: 200 },
  },
  {
    id: 'pillars',
    name: 'PILLARS',
    blurb: 'four cover columns',
    theme: 'lab',
    obstacles: [
      { x: 140, y: 110, w: 36, h: 36 },
      { x: 464, y: 110, w: 36, h: 36 },
      { x: 140, y: 254, w: 36, h: 36 },
      { x: 464, y: 254, w: 36, h: 36 },
    ],
    barrels: [{ x: 240, y: 60 }, { x: 400, y: 340 }],
    spawn: { x: 320, y: 200 },
    spawn2: { x: 320, y: 320 },
  },
  {
    id: 'the-cross',
    name: 'THE CROSS',
    blurb: 'central cross, four quadrants',
    theme: 'warehouse',
    obstacles: [
      { x: 280, y: 186, w: 80, h: 28 },
      { x: 306, y: 120, w: 28, h: 66 },
    ],
    barrels: [{ x: 80, y: 80 }, { x: 560, y: 320 }],
    spawn: { x: 120, y: 200 },
    spawn2: { x: 520, y: 200 },
  },
  {
    id: 'corridors',
    name: 'CORRIDORS',
    blurb: 'twin lanes, centre gate',
    theme: 'yard',
    obstacles: [
      { x: 40, y: 120, w: 220, h: 24 },
      { x: 380, y: 120, w: 220, h: 24 },
      { x: 40, y: 260, w: 220, h: 24 },
      { x: 380, y: 260, w: 220, h: 24 },
    ],
    barrels: [{ x: 320, y: 70 }, { x: 320, y: 340 }],
    spawn: { x: 130, y: 65 },
    spawn2: { x: 510, y: 335 },
  },
  {
    id: 'fortress',
    name: 'FORTRESS',
    blurb: 'hollow keep, corner gates',
    theme: 'lab',
    obstacles: [
      { x: 250, y: 150, w: 140, h: 20 },
      { x: 250, y: 230, w: 140, h: 20 },
      { x: 250, y: 170, w: 20, h: 60 },
      { x: 370, y: 170, w: 20, h: 60 },
      { x: 80, y: 80, w: 32, h: 32 },
      { x: 528, y: 288, w: 32, h: 32 },
    ],
    barrels: [{ x: 320, y: 190 }, { x: 90, y: 320 }],
    spawn: { x: 100, y: 200 },
    spawn2: { x: 540, y: 200 },
  },
  {
    id: 'splits',
    name: 'SPLITS',
    blurb: 'flanking walls, mid gates',
    theme: 'yard',
    obstacles: [
      { x: 180, y: 24, w: 26, h: 150 },
      { x: 180, y: 226, w: 26, h: 150 },
      { x: 434, y: 24, w: 26, h: 150 },
      { x: 434, y: 226, w: 26, h: 150 },
    ],
    barrels: [{ x: 90, y: 90 }, { x: 550, y: 310 }],
    spawn: { x: 100, y: 200 },
    spawn2: { x: 540, y: 200 },
  },
  {
    id: 'maze-run',
    name: 'MAZE RUN',
    blurb: 'staggered blocks',
    theme: 'warehouse',
    obstacles: [
      { x: 120, y: 60, w: 90, h: 26 },
      { x: 430, y: 60, w: 90, h: 26 },
      { x: 120, y: 314, w: 90, h: 26 },
      { x: 430, y: 314, w: 90, h: 26 },
      { x: 275, y: 187, w: 90, h: 26 },
    ],
    barrels: [{ x: 320, y: 60 }, { x: 320, y: 340 }],
    spawn: { x: 60, y: 200 },
    spawn2: { x: 580, y: 200 },
  },
  {
    id: 'kill-floor',
    name: 'KILL FLOOR',
    blurb: 'nearly open, barrel-heavy',
    theme: 'lab',
    obstacles: [
      { x: 24, y: 24, w: 70, h: 26 },
      { x: 546, y: 24, w: 70, h: 26 },
      { x: 24, y: 350, w: 70, h: 26 },
      { x: 546, y: 350, w: 70, h: 26 },
    ],
    barrels: [{ x: 320, y: 200 }, { x: 150, y: 110 }, { x: 490, y: 290 }],
    spawn: { x: 320, y: 90 },
    spawn2: { x: 320, y: 310 },
  },
];

// --- weapons -------------------------------------------------------------------

export type WeaponTier = 'pistol' | 'uzi' | 'shotgun' | 'grenades' | 'rocket';

export interface WeaponSpec {
  /** HUD label */
  name: string;
  /** kill-streak multiplier that unlocks the tier (0 = owned from the start) */
  unlockMult: number;
  /** seconds between shots */
  fireDelay: number;
  /** ammo drained per trigger (0 = infinite fallback weapon) */
  ammoPerShot: number;
  /** projectiles per trigger (shotgun cone) */
  pellets: number;
  /** total cone spread in radians */
  spread: number;
  /** projectile speed px/s */
  speed: number;
  /** projectile lifetime seconds */
  life: number;
  /** direct-hit damage */
  damage: number;
  /** AoE radius (0 = none) */
  radius: number;
  /** damage dealt inside the AoE radius */
  aoeDamage: number;
  kind: 'bullet' | 'grenade' | 'rocket';
}

/** Weapon ladder by kill-streak multiplier — uzi ×5, shotgun ×10 (5-pellet
 *  spread, DD-17), grenades ×25 (owner-exempt AoE), rocket ×50 (big AoE). */
export const WEAPONS: Record<WeaponTier, WeaponSpec> = {
  pistol:   { name: 'PISTOL',   unlockMult: 0,  fireDelay: 0.3,  ammoPerShot: 0, pellets: 1, spread: 0,    speed: 340, life: 1.4,  damage: 1,  radius: 0,   aoeDamage: 0,  kind: 'bullet'  },
  uzi:      { name: 'UZI',      unlockMult: 5,  fireDelay: 0.09, ammoPerShot: 1, pellets: 1, spread: 0.07, speed: 380, life: 1.3,  damage: 1,  radius: 0,   aoeDamage: 0,  kind: 'bullet'  },
  shotgun:  { name: 'SHOTGUN',  unlockMult: 10, fireDelay: 0.5,  ammoPerShot: 2, pellets: 5, spread: 0.64, speed: 330, life: 0.95, damage: 1,  radius: 0,   aoeDamage: 0,  kind: 'bullet'  },
  grenades: { name: 'GRENADES', unlockMult: 25, fireDelay: 0.8,  ammoPerShot: 3, pellets: 1, spread: 0,    speed: 240, life: 1.1,  damage: 4,  radius: 62,  aoeDamage: 10, kind: 'grenade' },
  rocket:   { name: 'ROCKET',   unlockMult: 50, fireDelay: 1.1,  ammoPerShot: 4, pellets: 1, spread: 0,    speed: 175, life: 2.4,  damage: 10, radius: 78,  aoeDamage: 26, kind: 'rocket'  },
};

export const WEAPON_ORDER: WeaponTier[] = ['pistol', 'uzi', 'shotgun', 'grenades', 'rocket'];

// --- enemies -------------------------------------------------------------------

export type EnemyKind = 'walker' | 'runner' | 'bruiser' | 'devil';

export interface EnemySpec {
  hp: number;
  /** multiplier on the wave's base speed */
  speedMul: number;
  /** base score before the streak multiplier */
  score: number;
  /** contact damage */
  contact: number;
  /** bullet hit radius */
  hitR: number;
  /** collision half-extents (x, y) for movement */
  box: { hx: number; hy: number };
  ranged: boolean;
}

/** Enemy tiers — walker (green), runner (red, fast, low hp), bruiser (big,
 *  slow, high hp, more score), devil (ranged orange energy balls). */
export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  walker:  { hp: 2,  speedMul: 1,    score: 100, contact: 10, hitR: 11, box: { hx: 6, hy: 6 },  ranged: false },
  runner:  { hp: 1,  speedMul: 1.85, score: 120, contact: 8,  hitR: 10, box: { hx: 6, hy: 6 },  ranged: false },
  bruiser: { hp: 16, speedMul: 0.55, score: 400, contact: 22, hitR: 17, box: { hx: 11, hy: 10 }, ranged: false },
  devil:   { hp: 6,  speedMul: 0.8,  score: 300, contact: 12, hitR: 11, box: { hx: 6, hy: 7 },  ranged: true },
};

// --- endless wave planner --------------------------------------------------------

export interface WavePlan {
  wave: number;
  /** total spawn budget for the wave (movers + tier surcharges) */
  budget: number;
  walkers: number;
  runners: number;
  bruisers: number;
  devils: number;
  /** seconds between spawns */
  spawnEvery: number;
  /** base walker speed for the wave (tiers multiply) */
  speed: number;
}

/**
 * Endless wave planner — no MAX_WAVE, no victory screen. Budget scales
 * ~exponentially: wave n ≈ 8·1.18^n, with runner share growing, bruisers
 * from wave 4 (3 budget each) and devils from wave 8 solo / wave 6 co-op
 * (2 budget each). Speed and spawn cadence tighten with the wave number.
 */
export function planWave(n: number, coop: boolean): WavePlan {
  const budget = Math.round(8 * Math.pow(1.18, n));
  const devilWave = coop ? 6 : 8;
  const devils = n >= devilWave ? Math.min(4, 1 + Math.floor((n - devilWave) / 2)) : 0;
  const bruisers = n >= 4 ? Math.min(10, Math.floor((n - 1) / 3)) : 0;
  const runners = Math.round(budget * Math.min(0.45, 0.08 * n));
  const walkers = Math.max(0, budget - runners - bruisers * 3 - devils * 2);
  return {
    wave: n,
    budget,
    walkers,
    runners,
    bruisers,
    devils,
    spawnEvery: Math.max(0.28, 1.25 - n * 0.055),
    speed: Math.min(78, 33 + n * 1.4),
  };
}

// --- score / streak multiplier ----------------------------------------------------

/**
 * ScoreSystem — shared score + streak multiplier with the weapon ladder.
 * Weapons unlock at mult 5/10/25/50 and stay owned for the run; the streak
 * decays when kills dry up and resets when a player is hit.
 */
export class ScoreSystem {
  score = 0;
  mult = 1;
  private multTimer = 0;
  private owned = new Set<WeaponTier>(['pistol']);
  /** fired once per run when a tier first unlocks */
  onUnlock: ((w: WeaponTier) => void) | null = null;

  reset(): void {
    this.score = 0;
    this.mult = 1;
    this.multTimer = 0;
    this.owned = new Set<WeaponTier>(['pistol']);
  }

  kill(kind: EnemyKind): number {
    const gained = ENEMIES[kind].score * this.mult;
    this.score += gained;
    this.mult = Math.min(99, this.mult + 1);
    this.multTimer = 3.5;
    for (const w of WEAPON_ORDER) {
      if (WEAPONS[w].unlockMult === this.mult && !this.owned.has(w)) {
        this.owned.add(w);
        this.onUnlock?.(w);
      }
    }
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

  owns(w: WeaponTier): boolean {
    return this.owned.has(w);
  }

  ownedWeapons(): WeaponTier[] {
    return WEAPON_ORDER.filter((w) => this.owned.has(w));
  }
}
