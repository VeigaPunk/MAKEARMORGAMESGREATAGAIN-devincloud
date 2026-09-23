/**
 * Content packs for the shared shmup engine — one engine, two packs, no fork
 * (architecture mandate). `replica` = GALACTIC CHICKEN: NEXT WAVE, a full
 * 10-chapter solar-arc campaign (CI2-scale; InterAction formula evocation,
 * INTERNAL-NO-PUBLIC, clearance required to ship). `cluck` = CLUCK HORIZON
 * original IP (3 sectors). All colors are Pixi hex numbers; every
 * player-facing string lives here and is consumed by sim/render/audio.
 */

// ---------------- wave + chapter vocabulary ----------------

export type WavePattern = 'grid' | 'sine' | 'swoop' | 'dive' | 'barrage' | 'sweep';

export interface WaveSpec {
  pattern: WavePattern;
  rows: number;
  cols: number;
  /** per-bird hp floor (type hp raises it further) */
  hp: number;
  /** avg seconds between egg drops */
  eggEvery: number;
  /** formation motion speed multiplier */
  speed: number;
}

export interface ChapterDef {
  name: string;
  /** backdrop gradient [top, bottom] — per-chapter palette */
  tint: [number, number];
  /** enemy-type mix weights [type0, type1, type2] */
  mix: [number, number, number];
  waves: WaveSpec[];
  boss: BossType;
}

// ---------------- weapons (gift ladder, per pack length) ----------------

export interface WeaponDef {
  name: string;
  /** projectiles per shot */
  n: number;
  /** damage per projectile */
  dmg: number;
  /** fire interval seconds */
  every: number;
  /** total fan degrees (0 = parallel offsets) */
  spread: number;
}

// ---------------- enemies + bosses ----------------

export interface EnemyType {
  name: string;
  color: number;
  headColor: number;
  /** D-39: comb + beak come from the pack, never hardcoded */
  comb: number;
  beak: number;
  speed: number;
  hp: number;
  /** D-43: per-type base score (scaled by hp at spawn) */
  score: number;
  /** D-44: visual size variant */
  scale: number;
  /** D-44: ace goggles visual */
  goggles?: boolean;
}

export type BossPattern =
  | 'fan' | 'aimed' | 'spiral' | 'wall' | 'summon'
  | 'nova' | 'sweep' | 'cross' | 'bouncer' | 'rising' | 'mothership';

export type BossCrest = 'comb' | 'crown' | 'horns' | 'antenna' | 'collar' | 'flames';

export interface BossType {
  /** D-37: rendered in the boss intro banner + HUD */
  name: string;
  pattern: BossPattern;
  color: number;
  headColor: number;
  comb: number;
  beak: number;
  hp: number;
  scale: number;
  crest: BossCrest;
}

// ---------------- pickups ----------------

export interface GiftSpec { name: string; color: number; ribbon: number }
export interface FoodSpec { name: string; pts: number; color: number; bone: number }

export interface ContentPack {
  id: 'replica' | 'cluck';
  title: string;
  sub: string;
  weapons: WeaponDef[];
  gift: GiftSpec;
  food: FoodSpec;
  enemyTypes: [EnemyType, EnemyType, EnemyType];
  chapters: ChapterDef[];
  ship: number;
  /** particle colors */
  foe: number;
  foe2: number;
  egg: number;
  eggStroke: number;
  accent: number;
  /** sector-entry one-liners (cluck); null for replica */
  jokes: string[] | null;
}

// ---------------- wave-table generator ----------------

interface WaveRamp {
  seq: WavePattern[];
  rows: [number, number];
  cols: [number, number];
  hp: number;
  egg: [number, number];
  spd: [number, number];
}

/** Expand an authored chapter shape into per-wave specs — density, egg rate
 *  and speed all ramp within the chapter; barrage waves triple the egg rate. */
function mkWaves(r: WaveRamp): WaveSpec[] {
  const n = r.seq.length;
  return r.seq.map((pattern, i) => {
    const f = n <= 1 ? 0 : i / (n - 1);
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * f);
    const egg = r.egg[0] + (r.egg[1] - r.egg[0]) * f;
    return {
      pattern,
      rows: lerp(r.rows[0], r.rows[1]),
      cols: lerp(r.cols[0], r.cols[1]),
      hp: r.hp,
      eggEvery: pattern === 'barrage' ? egg * 0.45 : egg,
      speed: r.spd[0] + (r.spd[1] - r.spd[0]) * f,
    };
  });
}

// ================= REPLICA — GALACTIC CHICKEN: NEXT WAVE =================
// Solar arc Pluto → Sun; 10 chapters × (10 waves + boss) = 110 waves.

const REPLICA_WEAPONS: WeaponDef[] = [
  { name: 'PEA', n: 1, dmg: 1, every: 0.2, spread: 0 },
  { name: 'TWIN BOLT', n: 2, dmg: 1, every: 0.19, spread: 0 },
  { name: 'TRI-SPREAD', n: 3, dmg: 1, every: 0.18, spread: 15 },
  { name: 'ION STREAM', n: 3, dmg: 1.25, every: 0.15, spread: 0 },
  { name: 'NEON RAKE', n: 4, dmg: 1.25, every: 0.15, spread: 17 },
  { name: 'QUAD ARRAY', n: 4, dmg: 1.5, every: 0.14, spread: 0 },
  { name: 'NEUTRON PULSE', n: 5, dmg: 1.5, every: 0.13, spread: 19 },
  { name: 'PLASMA FAN', n: 6, dmg: 1.5, every: 0.13, spread: 29 },
  { name: 'GEMINI LANCE', n: 6, dmg: 2, every: 0.12, spread: 0 },
  { name: 'NOVA SPRAY', n: 8, dmg: 2, every: 0.12, spread: 33 },
  { name: 'SOLAR CANNON', n: 9, dmg: 2.5, every: 0.11, spread: 28 },
];

const REPLICA_CHAPTERS: ChapterDef[] = [
  {
    name: 'PLUTO', tint: [0x0b0b14, 0x1c2430], mix: [8, 1.5, 0.2],
    waves: mkWaves({
      seq: ['grid', 'sine', 'grid', 'swoop', 'grid', 'sine', 'dive', 'grid', 'sine', 'swoop'],
      rows: [2, 3], cols: [5, 7], hp: 2, egg: [2.6, 2.2], spd: [0.9, 1.0],
    }),
    boss: { name: 'FROSTBITE HEN', pattern: 'fan', color: 0xdfe7ef, headColor: 0x91b7d8, comb: 0x228be6, beak: 0xffb35c, hp: 70, scale: 3.0, crest: 'comb' },
  },
  {
    name: 'NEPTUNE', tint: [0x020814, 0x0a2148], mix: [6, 3, 0.5],
    waves: mkWaves({
      seq: ['sine', 'swoop', 'grid', 'dive', 'sine', 'swoop', 'grid', 'barrage', 'dive', 'sine'],
      rows: [2, 3], cols: [6, 7], hp: 2, egg: [2.3, 1.9], spd: [0.95, 1.05],
    }),
    boss: { name: 'TIDE ROOSTER', pattern: 'aimed', color: 0x74c0fc, headColor: 0xe7f5ff, comb: 0x1c7ed6, beak: 0xffa94d, hp: 115, scale: 3.0, crest: 'comb' },
  },
  {
    name: 'URANUS', tint: [0x04141a, 0x0f3a40], mix: [5, 3, 1],
    waves: mkWaves({
      seq: ['swoop', 'sine', 'grid', 'dive', 'sine', 'sweep', 'grid', 'dive', 'sine', 'barrage'],
      rows: [2, 3], cols: [6, 7], hp: 3, egg: [2.1, 1.7], spd: [1.0, 1.1],
    }),
    boss: { name: 'SIDEWINDER CLUCK', pattern: 'spiral', color: 0x66d9e8, headColor: 0xc5f6fa, comb: 0x0b7285, beak: 0xff922b, hp: 160, scale: 3.0, crest: 'horns' },
  },
  {
    name: 'SATURN', tint: [0x141008, 0x3a2c10], mix: [5, 2.5, 1.5],
    waves: mkWaves({
      seq: ['sweep', 'grid', 'sine', 'sweep', 'dive', 'grid', 'sweep', 'sine', 'dive', 'barrage'],
      rows: [3, 3], cols: [6, 8], hp: 3, egg: [1.9, 1.5], spd: [1.05, 1.15],
    }),
    boss: { name: 'RING WARDEN', pattern: 'wall', color: 0xffe8a3, headColor: 0xfff3bf, comb: 0xe8590c, beak: 0xd9480f, hp: 210, scale: 3.2, crest: 'collar' },
  },
  {
    name: 'JUPITER', tint: [0x160a08, 0x402014], mix: [4, 3, 2],
    waves: mkWaves({
      seq: ['grid', 'grid', 'sine', 'dive', 'sweep', 'barrage', 'grid', 'dive', 'sweep', 'barrage'],
      rows: [3, 4], cols: [7, 8], hp: 4, egg: [1.7, 1.3], spd: [1.1, 1.2],
    }),
    boss: { name: 'STORM MAJOR', pattern: 'sweep', color: 0xffa94d, headColor: 0xffd8a8, comb: 0xd9480f, beak: 0xff922b, hp: 260, scale: 3.2, crest: 'antenna' },
  },
  {
    name: 'MARS', tint: [0x140606, 0x3a1210], mix: [4, 2, 4],
    waves: mkWaves({
      seq: ['dive', 'dive', 'grid', 'sine', 'dive', 'barrage', 'sweep', 'dive', 'grid', 'dive'],
      rows: [2, 3], cols: [6, 8], hp: 4, egg: [1.6, 1.25], spd: [1.15, 1.25],
    }),
    boss: { name: 'IRON BROOD', pattern: 'summon', color: 0xf03e3e, headColor: 0xffc9c9, comb: 0x212529, beak: 0xadb5bd, hp: 310, scale: 3.2, crest: 'horns' },
  },
  {
    name: 'EARTH', tint: [0x04101c, 0x103a2c], mix: [3, 3, 3],
    waves: mkWaves({
      seq: ['sine', 'grid', 'swoop', 'dive', 'barrage', 'sweep', 'sine', 'dive', 'grid', 'barrage'],
      rows: [3, 4], cols: [7, 8], hp: 5, egg: [1.4, 1.1], spd: [1.2, 1.3],
    }),
    boss: { name: 'MOTHER HEN', pattern: 'nova', color: 0xffd43b, headColor: 0xff8787, comb: 0xe03131, beak: 0xffa94d, hp: 370, scale: 3.4, crest: 'crown' },
  },
  {
    name: 'VENUS', tint: [0x161004, 0x403414], mix: [3, 3.5, 3],
    waves: mkWaves({
      seq: ['barrage', 'sine', 'barrage', 'grid', 'dive', 'barrage', 'sweep', 'barrage', 'dive', 'barrage'],
      rows: [3, 4], cols: [7, 9], hp: 5, egg: [1.25, 1.0], spd: [1.25, 1.35],
    }),
    boss: { name: 'ACID QUEEN', pattern: 'cross', color: 0x94d82d, headColor: 0xd8f5a2, comb: 0x2f9e44, beak: 0xc0eb75, hp: 440, scale: 3.4, crest: 'collar' },
  },
  {
    name: 'MERCURY', tint: [0x140c0c, 0x382020], mix: [2.5, 4, 3.5],
    waves: mkWaves({
      seq: ['sweep', 'sine', 'sweep', 'dive', 'sweep', 'sine', 'sweep', 'dive', 'sweep', 'barrage'],
      rows: [3, 4], cols: [7, 9], hp: 6, egg: [1.15, 0.9], spd: [1.3, 1.42],
    }),
    boss: { name: 'SOLAR HERALD', pattern: 'bouncer', color: 0xffc078, headColor: 0xffe8cc, comb: 0xe8590c, beak: 0xff922b, hp: 520, scale: 3.4, crest: 'flames' },
  },
  {
    name: 'SUN', tint: [0x1a0800, 0x582000], mix: [3, 3, 4],
    waves: mkWaves({
      seq: ['dive', 'barrage', 'sweep', 'dive', 'barrage', 'sine', 'dive', 'barrage', 'sweep', 'barrage'],
      rows: [3, 4], cols: [8, 9], hp: 6, egg: [1.0, 0.75], spd: [1.4, 1.55],
    }),
    boss: { name: 'EGGSTAR FURNACE', pattern: 'mothership', color: 0xffd43b, headColor: 0xff922b, comb: 0xfff3bf, beak: 0xe8590c, hp: 720, scale: 4.4, crest: 'flames' },
  },
];

// ================= CLUCK HORIZON — original IP =================
// Courier vs the flock: 3 sectors × (9 waves + boss), teal/orange palette.

const CLUCK_WEAPONS: WeaponDef[] = [
  { name: 'SOUP LASER', n: 1, dmg: 2, every: 0.16, spread: 0 },
  { name: 'WHISK BARRAGE', n: 2, dmg: 1, every: 0.09, spread: 0 },
  { name: 'SPATULA SPREAD', n: 3, dmg: 1, every: 0.17, spread: 24 },
  { name: 'TOASTER TESLA', n: 2, dmg: 1.5, every: 0.18, spread: 38 },
  { name: 'LADLE LANCE', n: 5, dmg: 1.75, every: 0.15, spread: 10 },
];

const CLUCK_CHAPTERS: ChapterDef[] = [
  {
    name: 'THE COOP ROAD', tint: [0x001a1a, 0x00332b], mix: [6, 3, 1],
    waves: mkWaves({
      seq: ['grid', 'sine', 'swoop', 'grid', 'dive', 'sine', 'grid', 'swoop', 'dive'],
      rows: [2, 3], cols: [5, 7], hp: 2, egg: [2.4, 2.0], spd: [0.95, 1.05],
    }),
    boss: { name: 'MOTHER GOOSE', pattern: 'aimed', color: 0xffa94d, headColor: 0xffe066, comb: 0xe8590c, beak: 0xff922b, hp: 80, scale: 3.0, crest: 'comb' },
  },
  {
    name: 'GRAVY LANE', tint: [0x061408, 0x1b390f], mix: [4, 3, 3],
    waves: mkWaves({
      seq: ['sine', 'dive', 'grid', 'sweep', 'barrage', 'swoop', 'sine', 'dive', 'barrage'],
      rows: [3, 3], cols: [6, 8], hp: 3, egg: [1.9, 1.5], spd: [1.05, 1.2],
    }),
    boss: { name: 'ROOSTER REGENT', pattern: 'summon', color: 0xffe677, headColor: 0xffc92a, comb: 0xd9480f, beak: 0xe8590c, hp: 150, scale: 3.2, crest: 'crown' },
  },
  {
    name: 'DEEP PANTRY', tint: [0x140c04, 0x332008], mix: [3, 3, 4],
    waves: mkWaves({
      seq: ['swoop', 'barrage', 'dive', 'sweep', 'barrage', 'grid', 'dive', 'sweep', 'barrage'],
      rows: [3, 4], cols: [7, 8], hp: 4, egg: [1.5, 1.15], spd: [1.15, 1.3],
    }),
    boss: { name: 'THE GRAND SOUFFLÉ', pattern: 'rising', color: 0xfab005, headColor: 0xffe066, comb: 0xd9480f, beak: 0x66d9e8, hp: 230, scale: 3.4, crest: 'collar' },
  },
];

export const PACKS: Record<ContentPack['id'], ContentPack> = {
  replica: {
    id: 'replica',
    title: 'GALACTIC CHICKEN',
    sub: 'NEXT WAVE — the flock returns',
    weapons: REPLICA_WEAPONS,
    gift: { name: 'GIFT', color: 0xe599f7, ribbon: 0x9c36b5 },
    food: { name: 'DRUMSTICK', pts: 100, color: 0xffa94d, bone: 0xe8590c },
    enemyTypes: [
      { name: 'HEN', color: 0xffd43b, headColor: 0xff8787, comb: 0xe03131, beak: 0xffa94d, speed: 1.0, hp: 2, score: 100, scale: 1 },
      { name: 'SCOUT', color: 0xfff3bf, headColor: 0xffc9c9, comb: 0xff6b6b, beak: 0xffc078, speed: 1.25, hp: 1, score: 120, scale: 0.8 },
      { name: 'ACE', color: 0xffb51e, headColor: 0xa5d8ff, comb: 0xe03131, beak: 0xff922b, speed: 0.9, hp: 3, score: 220, scale: 1.1, goggles: true },
    ],
    chapters: REPLICA_CHAPTERS,
    ship: 0x4dabf7,
    foe: 0xffd43b,
    foe2: 0xff8787,
    egg: 0xfff3bf,
    eggStroke: 0x948b6b,
    accent: 0xff6b6b,
    jokes: null,
  },
  cluck: {
    id: 'cluck',
    title: 'CLUCK HORIZON',
    sub: 'courier vs the flock — deliver or be devoured',
    weapons: CLUCK_WEAPONS,
    gift: { name: 'CRATE', color: 0x20c997, ribbon: 0x0ca678 },
    food: { name: 'RATIONS', pts: 100, color: 0xffa94d, bone: 0xe8590c },
    enemyTypes: [
      { name: 'FLOCKBIRD', color: 0xffa94d, headColor: 0xffe066, comb: 0xe8590c, beak: 0xff922b, speed: 1.0, hp: 2, score: 100, scale: 1 },
      { name: 'FLOCKBIRD GLIDER', color: 0xffe066, headColor: 0xffa94d, comb: 0xd9480f, beak: 0xffc078, speed: 1.15, hp: 2, score: 140, scale: 0.9 },
      { name: 'FLOCKBIRD BRUISER', color: 0xff6b6b, headColor: 0xffe066, comb: 0xc92a2a, beak: 0xd9480f, speed: 0.85, hp: 3, score: 200, scale: 1.2 },
    ],
    chapters: CLUCK_CHAPTERS,
    ship: 0x20c997,
    foe: 0xffa94d,
    foe2: 0xffe066,
    egg: 0xffe8cc,
    eggStroke: 0xb08968,
    accent: 0x20c997,
    jokes: [
      'Courier log: the flock took my route. Rude.',
      'Courier log: eggs again. Sending them the invoice.',
      'Courier log: Deep Pantry. The mixer hums. The fork is watching. Double hazard pay.',
      'Courier log: route complete. Union of Intergalactic Couriers sends regards.',
    ],
  },
};
