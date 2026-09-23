/**
 * Gladiator, persistence, shops, progression. Schema-gated save (D-51/52/53
 * posture: every dynamic string lands in the DOM via textContent; the save
 * itself is untrusted and validated here before any field is trusted).
 */
import {
  StatKey, STAT_KEYS, STAT_BASE, CREATE_POINTS, STAT_MAX_CREATE, LEVEL_BONUS_POINTS,
  LEVEL_CAP, xpForLevel, START_GOLD, ITEMS, Item, Slot, itemById, BOUTS,
  DEFEAT_PURSE_LOSS, DEFEAT_XP_FRAC, SURRENDER_PURSE_LOSS, HEAL_COST_PER_HP,
  POTION_CAP, FLASK_CAP, POTION_PRICE, FLASK_PRICE, AMMO_PACK, STONE_PRICE, ARROW_PRICE,
  LookPreset, LOOK_PRESETS,
} from './data';
import { Look, maxHpOf, maxManaOf } from './engine';
import { save, load } from '@maga/arcade-core';

export type EquippedMap = Record<Slot, string>;
export interface Stats6 { strength: number; agility: number; attack: number; defence: number; vitality: number; charisma: number }

export interface Gladiator {
  name: string;
  look: Look;
  stats: Stats6;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  mana: number;
  potions: number;
  flasks: number;
  stones: number;
  arrows: number;
  owned: string[];
  equipped: EquippedMap;
}

export interface CareerStats { boutsWon: number; boutsLost: number; critsLanded: number; crowdFavors: number; surrenders: number }

export interface SaveData {
  glad: Gladiator;
  defeated: number;
  ngPlus: number;
  career: CareerStats;
  complete: boolean;
}

export interface Settings { volume: number; muted: boolean }

const SAVE_KEY = 'slot';

export function statsTo6(stats: Stats6): Record<StatKey, number> {
  return {
    strength: stats.strength, agility: stats.agility, attack: stats.attack,
    defence: stats.defence, vitality: stats.vitality, charisma: stats.charisma,
  };
}

export function newGladiator(name: string, look: Look, stats: Stats6): Gladiator {
  const g: Gladiator = {
    name, look: { ...look }, stats: { ...stats }, level: 1, xp: 0, gold: START_GOLD,
    hp: 0, mana: 0, potions: 1, flasks: 0, stones: 0, arrows: 0,
    owned: ['w0', 'c0', 'b0', 'h0', 's0'],
    equipped: { weapon: 'w0', helm: 'h0', chest: 'c0', shield: 's0', boots: 'b0', ranged: '' },
  };
  g.hp = maxHpOf(stats.vitality, 1, look.build);
  g.mana = maxManaOf(1);
  return g;
}

export function gladiatorMaxHp(g: Gladiator): number { return maxHpOf(g.stats.vitality, g.level, g.look.build); }
export function gladiatorMaxMana(g: Gladiator): number { return maxManaOf(g.level); }

export function totalArmorDef(g: Gladiator): number {
  let d = 0;
  for (const slot of ['helm', 'chest', 'shield', 'boots'] as Slot[]) {
    const it = itemById(g.equipped[slot]);
    if (it) d += it.def ?? 0;
  }
  return d;
}
export function weaponDmg(g: Gladiator): number { return itemById(g.equipped.weapon)?.dmg ?? 6; }
export function meleeRangeOf(g: Gladiator): number { return 9 + g.look.height * 6; }
export function moveOf(g: Gladiator): number { return Math.max(8, 17 + g.stats.agility * 0.35 - g.look.build * 4); }
export function rangedInfo(g: Gladiator): { dmg: number; ammo: number; kind: 'stone' | 'arrow' } | null {
  const it = itemById(g.equipped.ranged);
  if (!it || !it.rangedDmg) return null;
  return it.ammoKind === 'stone'
    ? { dmg: it.rangedDmg, ammo: g.stones, kind: 'stone' }
    : { dmg: it.rangedDmg, ammo: g.arrows, kind: 'arrow' };
}

/** charisma discount: up to 30% off at high charisma */
export function priceFor(g: Gladiator, price: number): number {
  return Math.max(1, Math.round(price * (1 - Math.min(0.30, g.stats.charisma * 0.018))));
}

export function levelUpCheck(g: Gladiator): number {
  let gained = 0;
  while (g.level < LEVEL_CAP && g.xp >= xpForLevel(g.level + 1)) {
    g.level++;
    gained += LEVEL_BONUS_POINTS;
  }
  if (gained > 0) g.hp = Math.min(gladiatorMaxHp(g), g.hp + gained * 4);
  return gained;
}

export function healCost(g: Gladiator): number {
  return Math.ceil((gladiatorMaxHp(g) - g.hp) * HEAL_COST_PER_HP);
}

/* ---------------- persistence ---------------- */

/** strict schema gate — anything malformed → fresh start (never executes) */
export function validSave(s: unknown): s is SaveData {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) return false;
  const sv = s as Record<string, unknown>;
  const g = sv.glad;
  if (typeof g !== 'object' || g === null || Array.isArray(g)) return false;
  const gl = g as Record<string, unknown>;
  if (typeof gl.name !== 'string' || gl.name.length === 0 || gl.name.length > 40) return false;
  const look = gl.look;
  if (typeof look !== 'object' || look === null || Array.isArray(look)) return false;
  const lk = look as Record<string, unknown>;
  if (!Number.isInteger(lk.preset) || (lk.preset as number) < 0 || (lk.preset as number) > 2) return false;
  for (const k of ['skin', 'hair', 'height', 'build'] as const) {
    if (typeof lk[k] !== 'number' || !(lk[k] >= 0 && lk[k] <= 1)) return false;
  }
  const stats = gl.stats;
  if (typeof stats !== 'object' || stats === null || Array.isArray(stats)) return false;
  const st = stats as Record<string, unknown>;
  for (const k of ['strength', 'agility', 'attack', 'defence', 'vitality', 'charisma'] as const) {
    if (!Number.isInteger(st[k]) || (st[k] as number) < STAT_BASE || (st[k] as number) > 60) return false;
  }
  for (const k of ['level', 'xp', 'gold', 'hp', 'mana', 'potions', 'flasks', 'stones', 'arrows'] as const) {
    if (!Number.isInteger(gl[k]) || (gl[k] as number) < 0) return false;
  }
  if ((gl.level as number) < 1 || (gl.level as number) > LEVEL_CAP) return false;
  if ((gl.hp as number) < 1 || (gl.hp as number) > gladiatorMaxHp(gl as unknown as Gladiator)) return false;
  if (!Array.isArray(gl.owned) || !gl.owned.every(x => typeof x === 'string')) return false;
  const eq = gl.equipped;
  if (typeof eq !== 'object' || eq === null || Array.isArray(eq)) return false;
  const eqm = eq as Record<string, unknown>;
  for (const slot of ['weapon', 'helm', 'chest', 'shield', 'boots', 'ranged'] as const) {
    if (typeof eqm[slot] !== 'string') return false;
    if (eqm[slot] !== '' && !itemById(eqm[slot] as string)) return false;
  }
  if ((gl.potions as number) > POTION_CAP || (gl.flasks as number) > FLASK_CAP) return false;
  if (!Number.isInteger(sv.defeated) || (sv.defeated as number) < 0 || (sv.defeated as number) > BOUTS.length) return false;
  if (!Number.isInteger(sv.ngPlus) || (sv.ngPlus as number) < 0 || (sv.ngPlus as number) > 9) return false;
  if (typeof sv.complete !== 'boolean') return false;
  const car = sv.career;
  if (typeof car !== 'object' || car === null || Array.isArray(car)) return false;
  const cm = car as Record<string, unknown>;
  for (const k of ['boutsWon', 'boutsLost', 'critsLanded', 'crowdFavors', 'surrenders'] as const) {
    if (!Number.isInteger(cm[k]) || (cm[k] as number) < 0) return false;
  }
  return true;
}

export interface GameState {
  glad: Gladiator | null;
  defeated: number;
  ngPlus: number;
  career: CareerStats;
  complete: boolean;
  pointsToSpend: number;
}

export function freshCareer(): CareerStats {
  return { boutsWon: 0, boutsLost: 0, critsLanded: 0, crowdFavors: 0, surrenders: 0 };
}

export function loadGame(): GameState | null {
  const raw = load<unknown>('swords-and-sandals', SAVE_KEY, null);
  if (!validSave(raw)) return null;
  return {
    glad: raw.glad, defeated: raw.defeated, ngPlus: raw.ngPlus,
    career: raw.career, complete: raw.complete,
    pointsToSpend: 0,
  };
}

export function persistGame(st: GameState): void {
  if (!st.glad) return;
  const data: SaveData = {
    glad: st.glad, defeated: st.defeated, ngPlus: st.ngPlus,
    career: st.career, complete: st.complete,
  };
  save('swords-and-sandals', SAVE_KEY, data);
}

export function loadSettings(): Settings {
  const raw = load<unknown>('swords-and-sandals', 'settings', null);
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    if (typeof r.volume === 'number' && typeof r.muted === 'boolean' && r.volume >= 0 && r.volume <= 1) {
      return { volume: r.volume, muted: r.muted };
    }
  }
  return { volume: 0.55, muted: false };
}
export function persistSettings(s: Settings): void { save('swords-and-sandals', 'settings', s); }

/* ---------------- shops ---------------- */
export type ShopMsg = { kind: 'ok' | 'no'; text: string } | null;

export function buyItem(g: Gladiator, id: string): ShopMsg {
  const it = itemById(id);
  if (!it) return { kind: 'no', text: 'The merchant looks confused.' };
  if (it.price === 0 || g.owned.includes(id)) {
    g.equipped[it.slot] = id;
    return { kind: 'ok', text: `Equipped ${it.name}.` };
  }
  const price = priceFor(g, it.price);
  if (g.level < it.gate) return { kind: 'no', text: `${it.name} requires level ${it.gate}.` };
  if (g.gold < price) return { kind: 'no', text: 'Not enough gold.' };
  g.gold -= price;
  g.owned.push(id);
  g.equipped[it.slot] = id;
  return { kind: 'ok', text: `Bought and equipped ${it.name} for ${price}g.` };
}

export function buyPotion(g: Gladiator): ShopMsg {
  if (g.potions >= POTION_CAP) return { kind: 'no', text: `Potion belt full (${POTION_CAP}).` };
  const price = priceFor(g, POTION_PRICE);
  if (g.gold < price) return { kind: 'no', text: 'Not enough gold.' };
  g.gold -= price; g.potions++;
  return { kind: 'ok', text: `Bought a healing potion for ${price}g.` };
}

export function buyFlask(g: Gladiator): ShopMsg {
  if (g.flasks >= FLASK_CAP) return { kind: 'no', text: `Flask satchel full (${FLASK_CAP}).` };
  const price = priceFor(g, FLASK_PRICE);
  if (g.gold < price) return { kind: 'no', text: 'Not enough gold.' };
  g.gold -= price; g.flasks++;
  return { kind: 'ok', text: `Bought a mana flask for ${price}g.` };
}

export function buyAmmo(g: Gladiator, kind: 'stone' | 'arrow'): ShopMsg {
  if (kind === 'stone') {
    const price = priceFor(g, STONE_PRICE);
    if (g.gold < price) return { kind: 'no', text: 'Not enough gold.' };
    g.gold -= price; g.stones += AMMO_PACK;
    return { kind: 'ok', text: `Bought ${AMMO_PACK} sling stones for ${price}g.` };
  }
  const price = priceFor(g, ARROW_PRICE);
  if (g.gold < price) return { kind: 'no', text: 'Not enough gold.' };
  g.gold -= price; g.arrows += AMMO_PACK;
  return { kind: 'ok', text: `Bought ${AMMO_PACK} arrows for ${price}g.` };
}

/* ---------------- creation helpers ---------------- */
export function statTotal(stats: Stats6): number {
  return STAT_KEYS.reduce((n, k) => n + statsTo6(stats)[k], 0);
}

export function creationValid(name: string, stats: Stats6): boolean {
  return name.trim().length >= 1 && statTotal(stats) === STAT_BASE * 6 + CREATE_POINTS
    && STAT_KEYS.every(k => statsTo6(stats)[k] >= STAT_BASE && statsTo6(stats)[k] <= STAT_MAX_CREATE);
}

export function presetOf(look: Look): LookPreset { return LOOK_PRESETS[Math.max(0, Math.min(2, Math.round(look.preset)))]; }

/** items listed for a shop, in tier order */
export function shopItems(shop: 'smith' | 'armoury' | 'alchemist' | 'fletcher'): Item[] {
  return ITEMS.filter(i => i.shop === shop).sort((a, b) => a.tier - b.tier || a.price - b.price);
}

export function defeatPenalty(g: Gladiator): number {
  const lost = Math.round(g.gold * DEFEAT_PURSE_LOSS);
  g.gold -= lost;
  return lost;
}
export function surrenderPenalty(g: Gladiator): number {
  const lost = Math.round(g.gold * SURRENDER_PURSE_LOSS);
  g.gold -= lost;
  return lost;
}
export function defeatXp(boutNumber: number): number { return Math.round((26 + 10 * boutNumber) * DEFEAT_XP_FRAC); }
