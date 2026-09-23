/**
 * SANDALS OF STEEL: REIGN OF THE COLOSSUS — content tables.
 * Every number here is a tuned shippable value (see ship-records economy sim).
 */

export type StatKey = 'strength' | 'agility' | 'attack' | 'defence' | 'vitality' | 'charisma';

export const STAT_KEYS: StatKey[] = ['strength', 'agility', 'attack', 'defence', 'vitality', 'charisma'];

export const STAT_INFO: Record<StatKey, { label: string; blurb: string }> = {
  strength: { label: 'Strength', blurb: 'Melee damage, knockback' },
  agility: { label: 'Agility', blurb: 'Dodge + critical chance' },
  attack: { label: 'Attack', blurb: 'Hit chance with steel' },
  defence: { label: 'Defence', blurb: 'Block + damage soak' },
  vitality: { label: 'Vitality', blurb: 'Hit points' },
  charisma: { label: 'Charisma', blurb: 'Crowd gains, shop discounts' },
};

/** point-buy at creation; +3 per level-up */
export const CREATE_POINTS = 20;
export const STAT_BASE = 3;
export const STAT_MAX_CREATE = 12;
export const LEVEL_BONUS_POINTS = 3;

/** cumulative XP needed to REACH level n (index 1 = level 1 → 0) */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 30 * n + 6 * n * n;
}
export const LEVEL_CAP = 12;

export const START_GOLD = 90;

/* ---------------- economy ---------------- */
export function purseFor(bout: number): number { return 30 + 12 * bout; }
export function xpFor(bout: number): number { return 26 + 10 * bout; }
export const DEFEAT_PURSE_LOSS = 0.25;
export const DEFEAT_XP_FRAC = 0.25;
export const SURRENDER_PURSE_LOSS = 0.25;
export const HEAL_COST_PER_HP = 0.35;
export const POTION_CAP = 6;
export const FLASK_CAP = 5;
export const POTION_PRICE = 24;
export const FLASK_PRICE = 22;
export const AMMO_PACK = 8;
export const STONE_PRICE = 10;
export const ARROW_PRICE = 16;
export const NG_PLUS_ENEMY = 0.25;

/* ---------------- items ---------------- */
export type Slot = 'weapon' | 'helm' | 'chest' | 'shield' | 'boots' | 'ranged';
export type ShopId = 'smith' | 'armoury' | 'alchemist' | 'fletcher';

export interface Item {
  id: string;
  name: string;
  shop: ShopId;
  slot: Slot;
  tier: number;
  price: number;
  gate: number;
  def?: number;
  dmg?: number;
  rangedDmg?: number;
  ammoKind?: 'stone' | 'arrow';
  /** render silhouette key */
  art: string;
}

export const ITEMS: Item[] = [
  // Weaponsmith — weapon ladder (6)
  { id: 'w0', name: 'Rusted Gladius', shop: 'smith', slot: 'weapon', tier: 0, price: 0, gate: 1, dmg: 6, art: 'gladius' },
  { id: 'w1', name: 'Honed Gladius', shop: 'smith', slot: 'weapon', tier: 1, price: 70, gate: 1, dmg: 10, art: 'gladius' },
  { id: 'w2', name: 'Legion Spatha', shop: 'smith', slot: 'weapon', tier: 2, price: 135, gate: 3, dmg: 14, art: 'spatha' },
  { id: 'w3', name: 'Wolftooth Cleaver', shop: 'smith', slot: 'weapon', tier: 3, price: 185, gate: 5, dmg: 19, art: 'cleaver' },
  { id: 'w4', name: 'Mastiff Brand', shop: 'smith', slot: 'weapon', tier: 4, price: 330, gate: 6, dmg: 25, art: 'brand' },
  { id: 'w5', name: 'Colossus Cleaver', shop: 'smith', slot: 'weapon', tier: 5, price: 470, gate: 8, dmg: 33, art: 'colossuscleaver' },
  // Armoury — helm
  { id: 'h0', name: 'Bare Head', shop: 'armoury', slot: 'helm', tier: 0, price: 0, gate: 1, def: 0, art: 'none' },
  { id: 'h1', name: 'Leather Cap', shop: 'armoury', slot: 'helm', tier: 1, price: 45, gate: 1, def: 2, art: 'cap' },
  { id: 'h2', name: 'Bronze Helm', shop: 'armoury', slot: 'helm', tier: 2, price: 110, gate: 3, def: 4, art: 'bronze' },
  { id: 'h3', name: 'Colossus Visor', shop: 'armoury', slot: 'helm', tier: 3, price: 260, gate: 7, def: 7, art: 'visor' },
  // Armoury — chest
  { id: 'c0', name: 'Rag Tunic', shop: 'armoury', slot: 'chest', tier: 0, price: 0, gate: 1, def: 1, art: 'rags' },
  { id: 'c1', name: 'Studded Leather', shop: 'armoury', slot: 'chest', tier: 1, price: 95, gate: 2, def: 4, art: 'studs' },
  { id: 'c2', name: 'Legion Cuirass', shop: 'armoury', slot: 'chest', tier: 2, price: 175, gate: 4, def: 7, art: 'cuirass' },
  { id: 'c3', name: 'Colossus Plate', shop: 'armoury', slot: 'chest', tier: 3, price: 380, gate: 8, def: 11, art: 'plate' },
  // Armoury — shield
  { id: 's0', name: 'Empty Hand', shop: 'armoury', slot: 'shield', tier: 0, price: 0, gate: 1, def: 0, art: 'none' },
  { id: 's1', name: 'Wood Buckler', shop: 'armoury', slot: 'shield', tier: 1, price: 40, gate: 1, def: 2, art: 'buckler' },
  { id: 's2', name: 'Steel Scutum', shop: 'armoury', slot: 'shield', tier: 2, price: 125, gate: 3, def: 5, art: 'scutum' },
  { id: 's3', name: 'Tower Aegis', shop: 'armoury', slot: 'shield', tier: 3, price: 280, gate: 6, def: 8, art: 'aegis' },
  // Armoury — boots
  { id: 'b0', name: 'Rusty Sandals', shop: 'armoury', slot: 'boots', tier: 0, price: 0, gate: 1, def: 1, art: 'sandals' },
  { id: 'b1', name: 'Marching Boots', shop: 'armoury', slot: 'boots', tier: 1, price: 75, gate: 2, def: 3, art: 'boots' },
  { id: 'b2', name: 'Greaved Sabatons', shop: 'armoury', slot: 'boots', tier: 2, price: 175, gate: 5, def: 6, art: 'sabatons' },
  // Fletcher — ranged
  { id: 'r0', name: "Shepherd's Sling", shop: 'fletcher', slot: 'ranged', tier: 1, price: 60, gate: 1, rangedDmg: 8, ammoKind: 'stone', art: 'sling' },
  { id: 'r1', name: 'Yew Warbow', shop: 'fletcher', slot: 'ranged', tier: 2, price: 240, gate: 4, rangedDmg: 15, ammoKind: 'arrow', art: 'bow' },
];

export function itemById(id: string): Item | undefined { return ITEMS.find(i => i.id === id); }

/* ---------------- opponents ---------------- */
export interface BoutDef {
  name: string;
  taunt: string;
  portrait: 0 | 1 | 2;
  hp: number;
  str: number;
  agi: number;
  atk: number;
  def: number;
  armor: number;      // folded into mitigation/block like player armour def
  wdmg: number;
  weaponArt: string;
  armorTier: number;  // render tier
  ranged: boolean;    // carries a sling
  potions: number;
  move: number;
  meleeRange: number;
  scale: number;      // render size (colossus is huge)
  colossus?: boolean;
}

export const BOUTS: BoutDef[] = [
  { name: 'Tin Can Tim', taunt: 'I may be tin, but I am ALL sharp edges!', portrait: 0,
    hp: 55, str: 4, agi: 3, atk: 4, def: 1, armor: 1, wdmg: 5, weaponArt: 'gladius', armorTier: 0,
    ranged: false, potions: 0, move: 15, meleeRange: 10, scale: 0.95 },
  { name: 'Baron Bonk', taunt: 'Prepare thy skull for the honour of a Bonking.', portrait: 1,
    hp: 75, str: 6, agi: 4, atk: 5, def: 2, armor: 2, wdmg: 7, weaponArt: 'club', armorTier: 0,
    ranged: false, potions: 1, move: 15, meleeRange: 10, scale: 1.0 },
  { name: 'The Sand Snorter', taunt: 'HHRRRNK — hrrrk — Behold my sandy fury!', portrait: 2,
    hp: 82, str: 7, agi: 6, atk: 6, def: 3, armor: 3, wdmg: 9, weaponArt: 'trident', armorTier: 1,
    ranged: false, potions: 1, move: 17, meleeRange: 10, scale: 1.02 },
  { name: 'Sister Sledge', taunt: 'I have buried three husbands and room for a fourth.', portrait: 1,
    hp: 108, str: 9, agi: 8, atk: 8, def: 4, armor: 4, wdmg: 11, weaponArt: 'mace', armorTier: 1,
    ranged: false, potions: 1, move: 16, meleeRange: 10, scale: 0.98 },
  { name: 'The Gaul With No Name', taunt: 'Names are for tombstones. Pick one you like.', portrait: 0,
    hp: 128, str: 11, agi: 7, atk: 10, def: 5, armor: 5, wdmg: 13, weaponArt: 'spatha', armorTier: 1,
    ranged: false, potions: 1, move: 16, meleeRange: 11, scale: 1.03 },
  { name: 'Prince Prism', taunt: 'You fight a PRINCE. Lose beautifully, peasant.', portrait: 2,
    hp: 150, str: 12, agi: 10, atk: 11, def: 6, armor: 6, wdmg: 15, weaponArt: 'brand', armorTier: 2,
    ranged: false, potions: 2, move: 17, meleeRange: 11, scale: 1.0 },
  { name: 'Boulder Birch', taunt: 'BIRCH. SMASH. That is the whole speech.', portrait: 0,
    hp: 185, str: 15, agi: 5, atk: 11, def: 8, armor: 7, wdmg: 17, weaponArt: 'boulder', armorTier: 2,
    ranged: false, potions: 2, move: 14, meleeRange: 13, scale: 1.18 },
  { name: 'Duchess Doom', taunt: 'Every sash on my robe is a defeated fool. Add yours.', portrait: 1,
    hp: 196, str: 15, agi: 12, atk: 13, def: 8, armor: 8, wdmg: 18, weaponArt: 'sabre', armorTier: 2,
    ranged: true, potions: 2, move: 18, meleeRange: 11, scale: 1.02 },
  { name: 'Hepta the Unbroken', taunt: 'Broken seven times. Unbroken seven times. Your turn.', portrait: 2,
    hp: 205, str: 18, agi: 10, atk: 14, def: 10, armor: 9, wdmg: 20, weaponArt: 'cleaver', armorTier: 3,
    ranged: false, potions: 3, move: 16, meleeRange: 11, scale: 1.08 },
  { name: 'The Velvet Viper', taunt: 'Hiss all you like. My venom does the talking.', portrait: 1,
    hp: 218, str: 17, agi: 14, atk: 14, def: 10, armor: 9, wdmg: 21, weaponArt: 'sabre', armorTier: 3,
    ranged: true, potions: 3, move: 19, meleeRange: 11, scale: 1.0 },
  { name: 'THE COLOSSUS OF STEEL', taunt: 'I AM THE EMPEROR\'S WALL. BREAK UPON ME.', portrait: 0,
    hp: 224, str: 19, agi: 8, atk: 15, def: 10, armor: 11, wdmg: 22, weaponArt: 'colossuscleaver', armorTier: 3,
    ranged: false, potions: 3, move: 16, meleeRange: 14, scale: 1.45, colossus: true },
];

/* ---------------- combat text (authored, slapstick) ---------------- */
export const MISS_LINES_PLAYER: string[] = [
  'Your swing parts the air like a curtain. The air files a complaint.',
  'You slash a majestic figure — of someone hitting absolutely nothing.',
  'Your blade whistles a full octave. The sand sleeps on.',
  'A fly nods approvingly as your sword misses it AND the opponent.',
  'You attack the concept of the enemy. The concept is unharmed.',
  'Your weapon traces a lovely rainbow. Rainbows do no damage.',
  'You lunge! You miss! You pretend it was a feint!',
  'Somewhere, a swordsmith weeps softly into his anvil.',
  'Your attack impresses the crowd the way a sunset impresses a rock.',
  'You swing so hard you briefly visit yesterday. Still no hit.',
  'Your blade finds only honest dirt. The dirt forgives you.',
  'The opponent politely checks that you are, in fact, aiming at them.',
];

export const MISS_LINES_ENEMY: string[] = [
  'swings with great confidence and zero accuracy. The crowd snickers.',
  'attacks the space where you were two heartbeats ago.',
  'trips over the concept of footing and saves it with dignity. Mostly.',
  'delivers a ferocious blow to a passing butterfly. The butterfly wins.',
  'swings so wide the front row ducks.',
  'attacks your shadow. Your shadow was asking for it.',
  'misses and insists the wind took it. The wind denies everything.',
  'almost lands a hit on your reputation. Almost.',
  'practices an elaborate victory pose, having hit nothing.',
  'slices a pebble in twain. The pebble had a family.',
  'gets tangled in their own weapon strap. The strap wins.',
  'punches the sand in frustration. The sand punches back philosophically.',
];

export const BLOCK_LINES: string[] = [
  'Steel rings on steel — turned aside!',
  'A textbook block! The front row applauds the CLANK.',
  'Blow caught flat on the guard. Sparks, no blood.',
  'Parried so cleanly the opponent checks their own blade for damage.',
];

export const CROWD_FAVOR_LINES: string[] = [
  'CROWD FAVOR! The stands erupt — a healer\'s flask flies to your hand!',
  'CROWD FAVOR! Coins and petals rain down. You feel INVINCIBLE!',
  'CROWD FAVOR! The crowd chants your name. Your next blow surges!',
];

/* ---------------- spells ---------------- */
export interface Spell { id: 'ember' | 'mend' | 'warcry'; name: string; cost: number; gate: number; blurb: string }
export const SPELLS: Spell[] = [
  { id: 'ember', name: 'Ember Bolt', cost: 8, gate: 3, blurb: 'Hurl fire — reliable magic damage' },
  { id: 'mend', name: 'Mend', cost: 10, gate: 4, blurb: 'Knit flesh — restore health' },
  { id: 'warcry', name: 'War Cry', cost: 6, gate: 5, blurb: 'Chill the foe — lower their attack & defence' },
];

/* ---------------- looks ---------------- */
export interface LookPreset { name: string; portrait: string; skin: string; hair: string; garment: string }
export const LOOK_PRESETS: LookPreset[] = [
  { name: 'Scarlet', portrait: 'portrait-scarlet.svg', skin: '#d9a06b', hair: '#2a1a10', garment: '#a03028' },
  { name: 'Azure', portrait: 'portrait-azure.svg', skin: '#e8bf94', hair: '#141414', garment: '#2e5f9e' },
  { name: 'Gold', portrait: 'portrait-gold.svg', skin: '#b97f4e', hair: '#6a4a1e', garment: '#c9a020' },
];
