/** Pure arena rules. RNG is supplied so progression can be replayed without bypassing combat. */
export const STATS = ['strength', 'agility', 'vitality', 'defense'] as const;
export type Stat = typeof STATS[number];
export const LOOKS = ['Scarlet', 'Azure', 'Gold'] as const;
export type Look = typeof LOOKS[number];
export interface Gladiator {
  name: string; look: Look; stats: Record<Stat, number>; hp: number; maxHp: number;
  gold: number; xp: number; level: number; weapon: number; armor: number; potions: number;
}
export interface SaveData { gladiator: Gladiator; defeated: number; owned: string[] }
export const tournaments = ['The Sand Pit', 'The Bronze Circuit', 'The Imperial Games'];
export const opponents = [
  { name: 'Tin Can Tim', hp: 34, strength: 5, defense: 1, reward: 28, rhythm: 3, burst: 4, style: 'A clumsy club fighter. Watch for his overhead swing.' },
  { name: 'Baron Bonk', hp: 48, strength: 7, defense: 3, reward: 42, rhythm: 3, burst: 4, style: 'A showman with a sharp sword and a predictable wind-up.' },
  { name: 'The Sand Snorter', hp: 62, strength: 9, defense: 4, reward: 58, rhythm: 3, burst: 4, style: 'A sturdy shield bearer. Break through with heavy strikes.' },
  { name: 'Emperor’s Champion', hp: 78, strength: 11, defense: 5, reward: 80, rhythm: 3, burst: 4, style: 'The Sand Pit title holder. His gilded axe means business.' },
  { name: 'Cassia Quickblade', hp: 90, strength: 12, defense: 5, reward: 95, rhythm: 2, burst: 3, style: 'Fast flurries every second turn. Stay light on your feet.' },
  { name: 'Gaius Ironwall', hp: 102, strength: 13, defense: 6, reward: 115, rhythm: 4, burst: 7, style: 'Patient and armored. A crushing fourth-turn counter.' },
  { name: 'Darius the Anvil', hp: 116, strength: 15, defense: 7, reward: 135, rhythm: 3, burst: 5, style: 'A hammering veteran. Good armor will earn its keep.' },
  { name: 'The Bronze Minotaur', hp: 130, strength: 17, defense: 8, reward: 160, rhythm: 4, burst: 8, style: 'The Bronze Circuit champion. Brace for his fourth-turn charge.' },
  { name: 'Vesper of the Dunes', hp: 146, strength: 18, defense: 9, reward: 190, rhythm: 2, burst: 3, style: 'A relentless duelist. Her flurries arrive every other turn.' },
  { name: 'The Ivory Sentinel', hp: 162, strength: 20, defense: 10, reward: 225, rhythm: 4, burst: 8, style: 'Imperial armor and perfect patience. Prepare for the counter.' },
  { name: 'Praetor Bloodsun', hp: 180, strength: 22, defense: 11, reward: 270, rhythm: 3, burst: 6, style: 'The emperor’s final guardian. There is no room for rusty gear.' },
  { name: 'Aurex, the Sun Emperor', hp: 208, strength: 22, defense: 12, reward: 340, rhythm: 3, burst: 6, style: 'The final crown. His third-turn sun strike tests every champion.' },
];
export const items = [
  { name: 'Bent Bronze Sword', kind: 'weapon' as const, price: 22, gate: 1, bonus: 3 },
  { name: 'Lucky Sandals', kind: 'armor' as const, price: 38, gate: 2, bonus: 3 },
  { name: 'Imperial Buckler', kind: 'armor' as const, price: 65, gate: 2, bonus: 5 },
  { name: 'Legionnaire’s Edge', kind: 'weapon' as const, price: 95, gate: 3, bonus: 6 },
  { name: 'Bronze Legion Plate', kind: 'armor' as const, price: 145, gate: 4, bonus: 8 },
  { name: 'Minotaur’s Cleaver', kind: 'weapon' as const, price: 190, gate: 4, bonus: 10 },
  { name: 'Sunforged Aegis', kind: 'armor' as const, price: 270, gate: 5, bonus: 12 },
  { name: 'The Emperor’s Verdict', kind: 'weapon' as const, price: 300, gate: 6, bonus: 15 },
];
export const isHeavyTurn = (opponent: typeof opponents[number], round: number) => round % opponent.rhythm === 0;
export interface Combat { opponent: typeof opponents[number]; hp: number; round: number; cooldown: number; finished: boolean }
export type Action = 'attack' | 'special' | 'potion' | 'guard';
export interface TurnResult { messages: string[]; outcome: 'playing' | 'victory' | 'defeat'; damage: number }
export const maxHealth = (g: Gladiator) => 36 + g.stats.vitality * 5 + (g.level - 1) * 6;
export function freshSave(): SaveData {
  const gladiator: Gladiator = { name: '', look: 'Scarlet', stats: { strength: 2, agility: 2, vitality: 2, defense: 2 }, hp: 46, maxHp: 46, gold: 0, xp: 0, level: 1, weapon: 0, armor: 0, potions: 2 };
  return { gladiator, defeated: 0, owned: [] };
}
export function recover(g: Gladiator) { g.maxHp = maxHealth(g); g.hp = g.maxHp; g.potions = 2; }
const integer = (x: unknown, min: number, max: number): x is number => Number.isSafeInteger(x) && Number(x) >= min && Number(x) <= max;
/** Reject corrupt payloads before any value reaches rendering. Old valid slot saves migrate. */
export function readSave(value: unknown): SaveData | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as SaveData, g = s.gladiator;
  if (!g || typeof g !== 'object' || !integer(s.defeated, 0, opponents.length) || typeof g.name !== 'string' || g.name.length > 24 || !LOOKS.includes(g.look)) return null;
  if (!g.stats || !STATS.every(k => integer(g.stats[k], 2, 8)) || STATS.reduce((sum, k) => sum + g.stats[k], 0) !== 14) return null;
  if (!(['hp', 'maxHp', 'gold', 'xp', 'level', 'weapon', 'armor', 'potions'] as const).every(k => integer(g[k], 0, 10000))) return null;
  if (g.level !== 1 + Math.floor(g.xp / 40) || g.xp !== s.defeated * 22 || g.potions > 2 || g.hp > g.maxHp) return null;
  if (s.owned !== undefined && (!Array.isArray(s.owned) || s.owned.some(x => !items.some(it => it.name === x)) || new Set(s.owned).size !== s.owned.length)) return null;
  const owned = s.owned?.slice() ?? items.filter(it => g[it.kind] >= it.bonus).map(it => it.name);
  const result: SaveData = { defeated: s.defeated, owned, gladiator: { ...g, stats: { ...g.stats } } };
  // Recompute equipment and health from supported data; never trust arbitrary saved bonuses.
  for (const kind of ['weapon', 'armor'] as const) result.gladiator[kind] = Math.max(0, ...items.filter(it => it.kind === kind && owned.includes(it.name)).map(it => it.bonus));
  recover(result.gladiator);
  return result;
}
export function buy(s: SaveData, index: number): boolean {
  const it = items[index], g = s.gladiator;
  if (!it || s.owned.includes(it.name) || g.gold < it.price || g.level < it.gate || g[it.kind] >= it.bonus) return false;
  g.gold -= it.price; s.owned.push(it.name); g[it.kind] = it.bonus;
  return true;
}
export function startCombat(s: SaveData): Combat | null {
  const opponent = opponents[s.defeated];
  if (!opponent) return null;
  recover(s.gladiator);
  return { opponent, hp: opponent.hp, round: 0, cooldown: 0, finished: false };
}
export function playTurn(s: SaveData, c: Combat, action: Action, random = Math.random): TurnResult {
  const g = s.gladiator, messages: string[] = [];
  const result: TurnResult = { messages, outcome: 'playing', damage: 0 };
  if (c.finished || c.hp <= 0 || (action === 'special' && c.cooldown > 0) || (action === 'potion' && (g.potions < 1 || g.hp === g.maxHp))) return result;
  c.round++;
  c.cooldown = Math.max(0, c.cooldown - 1);
  let guard = action === 'guard' ? 8 : 0;
  if (action === 'potion') {
    g.potions--; g.hp = Math.min(g.maxHp, g.hp + 26); guard = 3;
    messages.push('Potion restores up to 26 HP. You brace for the reply.');
  } else if (action === 'guard') messages.push('You raise your guard. Incoming damage reduced by 8.');
  else {
    const special = action === 'special';
    if (special) { c.cooldown = 2; guard = 2; }
    const chance = Math.min(.97, (special ? .76 : .84) + g.stats.agility * .02);
    if (random() < chance) {
      const crit = random() < .08 + g.stats.agility * .01;
      result.damage = Math.max(1, (special ? 10 : 5) + g.stats.strength + g.weapon + (g.level - 1) * 2 + (crit ? 5 : 0) - c.opponent.defense);
      c.hp = Math.max(0, c.hp - result.damage);
      messages.push(`${crit ? 'Critical hit! ' : ''}${special ? 'Shield breaker' : 'Attack'} deals ${result.damage} damage.`);
    } else messages.push('Your strike misses. Keep your guard up.');
  }
  if (c.hp === 0) {
    c.finished = true; s.defeated++; g.gold += c.opponent.reward; g.xp += 22;
    const oldLevel = g.level; g.level = 1 + Math.floor(g.xp / 40); recover(g);
    messages.push(`Victory over ${c.opponent.name}! +${c.opponent.reward} gold · +22 XP.`);
    if (g.level > oldLevel) messages.push(`Level ${g.level}! +6 maximum HP and +2 attack damage.`);
    result.outcome = 'victory'; return result;
  }
  const heavy = isHeavyTurn(c.opponent, c.round);
  const damage = Math.max(1, c.opponent.strength + Math.floor(random() * 3) + (heavy ? c.opponent.burst : 0) - g.stats.defense - g.armor - guard);
  g.hp = Math.max(0, g.hp - damage);
  messages.push(`${c.opponent.name}${heavy ? ' unleashes a heavy strike' : ' replies'} for ${damage}.`);
  if (g.hp === 0) {
    c.finished = true; recover(g); result.outcome = 'defeat';
    messages.push('Defeat. The healer restores your health and two potions. Retry without losing gold.');
  }
  return result;
}
