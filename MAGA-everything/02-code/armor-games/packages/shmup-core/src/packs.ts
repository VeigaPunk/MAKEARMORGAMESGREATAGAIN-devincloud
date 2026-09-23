/**
 * Content packs for the shared shmup skeleton (spec 06 §FORGE:
 * "shared shmup skeleton + content packs"). `replica` = CI2-era formula
 * recreate (INTERNAL-NO-PUBLIC, InterAction clearance required to ship);
 * `cluck` = Cluck Horizon original IP. Colors are Pixi hex numbers;
 * names/strings come straight from the proto packs.
 */
export interface EnemyType {
  name: string;
  color: number;
  headColor: number;
  speed: number; // TBD ARCADE behavior tint multiplier
  hp: number; // TBD ARCADE per-type durability
}

export interface BossType { name: string; color: number; headColor: number }

export interface ContentPack {
  id: 'replica' | 'cluck';
  title: string;
  sub: string;
  weapons: string[];
  gift: string;
  food: string;
  enemyTypes: [EnemyType, EnemyType, EnemyType];
  bosses: [BossType, BossType];
  ship: number;
  foe: number;
  foe2: number;
  egg: number;
  bg0: number;
  bg1: number;
  accent: number;
  jokes: string[] | null;
}

export const PACKS: Record<ContentPack['id'], ContentPack> = {
  replica: {
    id: 'replica',
    title: 'CHICKEN INVADERS',
    sub: 'The Next Wave — formula replica slice',
    weapons: ['PEA SHOOTER', 'TWIN BOLT', 'TRI-SPREAD'],
    gift: 'GIFT',
    food: 'DRUMSTICK',
    enemyTypes: [
      { name: 'CHICKEN', color: 0xffd43b, headColor: 0xff8787, speed: 1, hp: 2 },
      { name: 'CHICKEN SCOUT', color: 0xffd43b, headColor: 0xff8787, speed: 1, hp: 2 },
      { name: 'CHICKEN ACE', color: 0xffd43b, headColor: 0xff8787, speed: 1, hp: 2 },
    ],
    bosses: [
      { name: 'BIG HEN', color: 0xffd43b, headColor: 0xff8787 },
      { name: 'MOTHER HEN', color: 0xffd43b, headColor: 0xff8787 },
    ],
    ship: 0x4dabf7,
    foe: 0xffd43b,
    foe2: 0xff8787,
    egg: 0xfff3bf,
    bg0: 0x0b0018,
    bg1: 0x1a0b2e,
    accent: 0xff6b6b,
    jokes: null,
  },
  cluck: {
    id: 'cluck',
    title: 'CLUCK HORIZON',
    sub: 'courier vs the flock — original IP slice',
    weapons: ['SOUP LASER', 'SPATULA SPREAD', 'WHISK BARRAGE'],
    gift: 'CRATE',
    food: 'RATIONS',
    enemyTypes: [
      { name: 'FLOCKBIRD', color: 0xffa94d, headColor: 0xffe066, speed: 1, hp: 2 },
      { name: 'FLOCKBIRD GLIDER', color: 0xffe066, headColor: 0xffa94d, speed: 1.15, hp: 2 },
      { name: 'FLOCKBIRD BRUISER', color: 0xffe677, headColor: 0xffc92a, speed: 0.85, hp: 3 },
    ],
    bosses: [
      { name: 'MOTHER GOOSE', color: 0xffa94d, headColor: 0xffe066 },
      { name: 'ROOSTER REGENT', color: 0xffe677, headColor: 0xffc92a },
    ],
    ship: 0x20c997,
    foe: 0xffa94d,
    foe2: 0xffe066,
    egg: 0xffe8cc,
    bg0: 0x001a1a,
    bg1: 0x00332b,
    accent: 0x20c997,
    jokes: [
      'Courier log: the flock took my route. Rude.',
      'Courier log: eggs again. Sending them the invoice.',
    ],
  },
};
