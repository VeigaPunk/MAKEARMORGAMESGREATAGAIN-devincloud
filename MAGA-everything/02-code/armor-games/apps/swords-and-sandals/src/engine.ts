/**
 * Turn-based bout engine — distance line, crowd meter, spells, rage.
 * Pure: no DOM, no audio. RNG injectable so the economy sim (node) drives
 * the exact same code as the browser. The UI consumes `events` for
 * animation/sound; `log` carries bout narration.
 */
import {
  BOUTS, BoutDef, MISS_LINES_PLAYER, MISS_LINES_ENEMY, BLOCK_LINES, CROWD_FAVOR_LINES,
  SPELLS, xpForLevel,
} from './data';

export type Side = 'player' | 'enemy';
export type PlayerAction =
  | 'advance' | 'withdraw'
  | 'quick' | 'power' | 'ranged'
  | 'ember' | 'mend' | 'warcry'
  | 'potion' | 'flask' | 'taunt' | 'surrender';

export interface Look { preset: number; skin: number; hair: number; height: number; build: number }

export interface Fighter {
  name: string;
  hp: number; maxHp: number;
  str: number; agi: number; atk: number; def: number; cha: number;
  weaponDmg: number; armorDef: number;
  meleeRange: number; move: number;
  hasRanged: boolean; rangedDmg: number; rangedAmmo: number;
  mana: number; maxMana: number;
  potions: number; flasks: number;
  pos: number;
  look: Look; scale: number;
  isPlayer: boolean;
}

export type Event =
  | { t: 'hit'; side: Side; target: Side; dmg: number; crit: boolean; blocked: boolean; favor: boolean }
  | { t: 'miss'; side: Side; target: Side }
  | { t: 'move'; side: Side; from: number; to: number }
  | { t: 'potion'; side: Side; heal: number }
  | { t: 'flask'; side: Side; mana: number }
  | { t: 'spell'; side: Side; spell: 'ember' | 'mend' | 'warcry'; amount: number }
  | { t: 'taunt'; side: Side }
  | { t: 'ranged'; side: Side }
  | { t: 'lunge'; side: Side; kind: 'quick' | 'power' }
  | { t: 'crowd'; delta: number; favor: boolean }
  | { t: 'knockback'; side: Side; from: number; to: number }
  | { t: 'phase2' }
  | { t: 'surrender' }
  | { t: 'end'; result: 'win' | 'lose' };

export interface Bout {
  player: Fighter;
  enemy: Fighter;
  def: BoutDef;
  boutNumber: number;
  crowd: number;
  favorBuff: boolean;      // crowd favor dmg buff armed for next hit
  turn: number;
  phase: 'player' | 'enemy' | 'over';
  result: 'win' | 'lose' | null;
  surrendered: boolean;
  log: string[];
  events: Event[];
  rage: number;            // enemy enraged turns remaining (taunt response)
  warcry: number;          // enemy debuffed turns remaining
  phase2: boolean;
  enemyPotions: number;
  playerLevel: number;
  rng: () => number;
}

/* ---------- tuning constants (sim-verified, see ship-records) ---------- */
const HIT_BASE_P = 0.72, HIT_BASE_E = 0.64, HIT_SCALE = 0.032, HIT_MIN = 0.28, HIT_MAX = 0.95;
const QUICK_HIT = 0.08, POWER_HIT = -0.12;
const STR_MELEE_P = 1.9, STR_MELEE_E = 1.2, VARIANCE = 0.30;
const POWER_MUL = 1.8, CRIT_MUL = 1.6, CRIT_MUL_POWER = 2.6;
const FAVOR_MUL = 1.6;
const CROWD_HIT = 5, CROWD_CRIT = 6, CROWD_TAUNT = 13, CROWD_MISS = -7, CROWD_WITHDRAW = -5,
  CROWD_HURT = -4, CROWD_BLOCK = 2, CROWD_SPELL = 3, CROWD_DECAY = -1;
const EMBER_DMG = 12, EMBER_PER_LEVEL = 2.2, EMBER_HIT = 0.85;
const MEND_BASE = 18, MEND_PER_LEVEL = 3;
const WARCRY_TURNS = 3, WARCRY_ATK = -3, WARCRY_DEF = -3;
const RAGE_TURNS = 3, RAGE_ATK = 3, RAGE_DEF = -2;
const POTION_HEAL = 40, POTION_PER_LEVEL = 3, FLASK_MANA = 18;
const MANA_REGEN = 2;
const RANGED_MIN_GAP = 30, RANGED_HIT = 0.62, RANGED_HIT_SCALE = 0.028;
const MIN_GAP = 4;
const KNOCK_MIN = 3, KNOCK_STR_SCALE = 0.35;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- player fighter from gladiator (game.ts owns the save shape) ---------- */
export interface PlayerBuild {
  name: string;
  stats: { str: number; agi: number; atk: number; def: number; vit: number; cha: number };
  level: number;
  hp: number;
  weaponDmg: number;
  armorDef: number;
  meleeRange: number;
  move: number;
  hasRanged: boolean;
  rangedDmg: number;
  rangedAmmo: number;
  potions: number;
  flasks: number;
  mana: number;
  look: Look;
  scale: number;
}

export function maxHpOf(vit: number, level: number, build: number): number {
  return 30 + vit * 6 + (level - 1) * 4 + Math.round(build * 12);
}
export function maxManaOf(level: number): number { return 12 + level * 4; }

export function makePlayerFighter(b: PlayerBuild): Fighter {
  const maxHp = maxHpOf(b.stats.vit, b.level, b.look.build);
  const maxMana = maxManaOf(b.level);
  return {
    name: b.name,
    hp: Math.max(1, Math.min(b.hp, maxHp)), maxHp,
    str: b.stats.str, agi: b.stats.agi, atk: b.stats.atk, def: b.stats.def, cha: b.stats.cha,
    weaponDmg: b.weaponDmg, armorDef: b.armorDef,
    meleeRange: b.meleeRange, move: b.move,
    hasRanged: b.hasRanged, rangedDmg: b.rangedDmg, rangedAmmo: b.rangedAmmo,
    mana: Math.max(0, Math.min(b.mana, maxMana)), maxMana,
    potions: b.potions, flasks: b.flasks,
    pos: 18,
    look: b.look, scale: b.scale,
    isPlayer: true,
  };
}

export function makeEnemyFighter(def: BoutDef, ngPlus: number, rng: () => number): Fighter {
  const m = 1 + 0.25 * ngPlus;
  const hp = Math.round(def.hp * m);
  return {
    name: def.name,
    hp, maxHp: hp,
    str: Math.round(def.str * m), agi: Math.round(def.agi * m), atk: Math.round(def.atk * m),
    def: Math.round(def.def * m),
    cha: 0,
    weaponDmg: def.wdmg, armorDef: Math.round(def.armor * m),
    meleeRange: def.meleeRange, move: def.move,
    hasRanged: def.ranged, rangedDmg: Math.round(9 * m), rangedAmmo: 7,
    mana: 0, maxMana: 0,
    potions: def.potions + ngPlus, flasks: 0,
    pos: 82 + Math.round(rng() * 8),
    look: { preset: def.portrait, skin: 0.5, hair: 0.5, height: 0.55, build: 0.6 },
    scale: def.scale,
    isPlayer: false,
  };
}

export function startBout(player: Fighter, def: BoutDef, boutNumber: number, playerLevel: number, ngPlus: number, rng: () => number): Bout {
  const enemy = makeEnemyFighter(def, ngPlus, rng);
  const crowd = Math.round(10 + player.cha * 0.8);
  return {
    player, enemy, def, boutNumber,
    crowd: Math.max(0, Math.min(100, crowd)),
    favorBuff: false, turn: 1, phase: 'player', result: null, surrendered: false,
    log: [`${def.name} enters to a wall of noise. "${def.taunt}"`],
    events: [],
    rage: 0, warcry: 0, phase2: false,
    enemyPotions: enemy.potions,
    playerLevel, rng,
  };
}

export function dist(b: Bout): number { return b.enemy.pos - b.player.pos; }
export function isOver(b: Bout): boolean { return b.phase === 'over'; }
export function inMelee(b: Bout, side: Side): boolean { return dist(b) <= (side === 'player' ? b.player.meleeRange : b.enemy.meleeRange); }
export function canRanged(b: Bout, side: Side): boolean {
  const f = side === 'player' ? b.player : b.enemy;
  return f.hasRanged && f.rangedAmmo > 0 && dist(b) >= RANGED_MIN_GAP;
}
export function spellGate(id: 'ember' | 'mend' | 'warcry', level: number): boolean {
  return level >= (SPELLS.find(s => s.id === id)!.gate);
}

function pushLog(b: Bout, line: string): void {
  b.log.push(line);
  if (b.log.length > 40) b.log.shift();
}
function pick<T>(arr: T[], rng: () => number): T { return arr[Math.floor(rng() * arr.length)]; }
function enemyAtkVal(b: Bout): number {
  const raw = b.enemy.atk + (b.rage > 0 ? RAGE_ATK : 0) + (b.warcry > 0 ? WARCRY_ATK : 0);
  return Math.max(1, raw);
}
function enemyDefVal(b: Bout): number {
  const raw = b.enemy.def + (b.rage > 0 ? RAGE_DEF : 0) + (b.warcry > 0 ? WARCRY_DEF : 0);
  return Math.max(0, raw);
}
function dodgeOf(f: Fighter): number { return Math.max(1, f.agi - f.look.height * 2); }

function addCrowd(b: Bout, delta: number): void {
  b.crowd = Math.max(0, Math.min(100, b.crowd + delta));
  b.events.push({ t: 'crowd', delta, favor: false });
}

/** crowd crossing 100 → favor: free heal + armed buff */
function checkFavor(b: Bout): void {
  if (b.crowd >= 100) {
    const heal = Math.max(4, Math.round(b.player.maxHp * 0.18));
    b.player.hp = Math.min(b.player.maxHp, b.player.hp + heal);
    b.favorBuff = true;
    b.crowd = 25;
    b.events.push({ t: 'crowd', delta: 0, favor: true });
    b.events.push({ t: 'potion', side: 'player', heal });
    pushLog(b, pick(CROWD_FAVOR_LINES, b.rng) + ` (+${heal} HP, next blow empowered)`);
  }
}

function applyDamage(b: Bout, target: Side, dmg: number, crit: boolean, blocked: boolean, favor: boolean): void {
  const f = target === 'player' ? b.player : b.enemy;
  f.hp = Math.max(0, f.hp - dmg);
  b.events.push({ t: 'hit', side: target === 'player' ? 'enemy' : 'player', target, dmg, crit, blocked, favor });
  // knockback on heavy blows with room to slide
  const knock = Math.round(KNOCK_MIN + b[ target === 'player' ? 'enemy' : 'player' ].str * KNOCK_STR_SCALE);
  if ((crit || knock >= 8) && f.pos < 96 && target === 'enemy') {
    const to = Math.min(100, f.pos + knock);
    if (to > f.pos) { b.events.push({ t: 'knockback', side: 'enemy', from: f.pos, to }); f.pos = to; }
  }
  if (target === 'enemy' && b.def.colossus && !b.phase2 && f.hp <= 0) {
    // PHASE 2 — the Colossus re-forges mid-bout
    b.phase2 = true;
    f.hp = Math.round(f.maxHp * 0.5);
    f.atk += 3; f.def = Math.max(0, f.def - 2);
    b.crowd = Math.min(100, b.crowd + 20);
    b.events.push({ t: 'phase2' });
    pushLog(b, 'The Colossus falls to one knee... AND RISES, armor cracked, furnace-eyed! THE EMPEROR\'S CHAMPION ENTERS PHASE TWO!');
    return;
  }
  if (f.hp <= 0) {
    b.phase = 'over';
    b.result = target === 'enemy' ? 'win' : 'lose';
    b.events.push({ t: 'end', result: b.result });
  }
}

function meleeAttack(b: Bout, side: Side, kind: 'quick' | 'power'): void {
  const A = side === 'player' ? b.player : b.enemy;
  const D = side === 'player' ? b.enemy : b.player;
  const target: Side = side === 'player' ? 'enemy' : 'player';
  const atkVal = side === 'player' ? A.atk : enemyAtkVal(b);
  const defVal = side === 'player' ? enemyDefVal(b) : D.def;
  b.events.push({ t: 'lunge', side, kind });
  const hitMod = kind === 'quick' ? QUICK_HIT : POWER_HIT;
  const hitBase = side === 'player' ? HIT_BASE_P : HIT_BASE_E;
  const strMul = side === 'player' ? STR_MELEE_P : STR_MELEE_E;
  const hc = Math.max(HIT_MIN, Math.min(HIT_MAX, hitBase + (atkVal - dodgeOf(D)) * HIT_SCALE + hitMod));
  if (b.rng() >= hc) {
    b.events.push({ t: 'miss', side, target });
    const line = side === 'player'
      ? pick(MISS_LINES_PLAYER, b.rng)
      : `${D.name} ${pick(MISS_LINES_ENEMY, b.rng)}`;
    pushLog(b, line);
    if (side === 'player') addCrowd(b, CROWD_MISS); else addCrowd(b, 3);
    return;
  }
  const crit = b.rng() < 0.04 + A.agi * 0.012 + (kind === 'power' ? 0.02 : 0);
  let raw = (A.weaponDmg + A.str * strMul) * (kind === 'power' ? POWER_MUL : 1) * (crit ? (kind === 'power' ? CRIT_MUL_POWER : CRIT_MUL) : 1);
  let favor = false;
  if (side === 'player' && b.favorBuff) { raw *= FAVOR_MUL; b.favorBuff = false; favor = true; }
  raw *= 1 - VARIANCE / 2 + b.rng() * VARIANCE;
  const mitigation = defVal * 0.7 + D.armorDef * 0.55;
  let dmg = Math.max(1, Math.round(raw - mitigation));
  const blockChance = 0.028 * (defVal + D.armorDef * 0.5);
  const blocked = b.rng() < blockChance;
  if (blocked) {
    dmg = Math.max(1, Math.ceil(dmg * 0.5));
    pushLog(b, side === 'player'
      ? `${D.name} blocks! ${pick(BLOCK_LINES, b.rng)} (${dmg} chips through)`
      : `You block! ${pick(BLOCK_LINES, b.rng)} (${dmg} chips through)`);
    if (side === 'enemy') addCrowd(b, CROWD_BLOCK);
  } else {
    pushLog(b, side === 'player'
      ? `${crit ? 'CRITICAL! ' : ''}${A.name} ${kind === 'power' ? 'hammers' : 'strikes'} ${D.name} for ${dmg}.`
      : `${crit ? 'CRITICAL! ' : ''}${A.name} ${kind === 'power' ? 'hammers' : 'strikes'} you for ${dmg}.`);
  }
  if (side === 'player') addCrowd(b, CROWD_HIT + A.cha * 0.35 + (crit ? CROWD_CRIT + A.cha * 0.3 : 0));
  else addCrowd(b, CROWD_HURT);
  applyDamage(b, target, dmg, crit, blocked, favor);
  if (b.phase !== 'over' && side === 'player') checkFavor(b);
}

function rangedAttack(b: Bout, side: Side): void {
  const A = side === 'player' ? b.player : b.enemy;
  const D = side === 'player' ? b.enemy : b.player;
  const target: Side = side === 'player' ? 'enemy' : 'player';
  A.rangedAmmo--;
  b.events.push({ t: 'ranged', side });
  const hc = Math.max(HIT_MIN, Math.min(HIT_MAX, RANGED_HIT + ((side === 'player' ? A.atk : enemyAtkVal(b)) - dodgeOf(D)) * RANGED_HIT_SCALE));
  if (b.rng() >= hc) {
    b.events.push({ t: 'miss', side, target });
    pushLog(b, side === 'player'
      ? `Your ${A.hasRanged && A.rangedDmg >= 14 ? 'arrow' : 'stone'} sails wide. Somewhere, a pigeon is grateful.`
      : `${A.name}'s shot whistles past your ear. The crowd 'ooooh's.`);
    if (side === 'player') addCrowd(b, -3);
    return;
  }
  const crit = b.rng() < 0.05 + A.agi * 0.01;
  let raw = (A.rangedDmg + A.agi * 0.9) * (crit ? 1.7 : 1) * (1 - VARIANCE / 2 + b.rng() * VARIANCE);
  if (side === 'player' && b.favorBuff) { raw *= FAVOR_MUL; b.favorBuff = false; }
  const dmg = Math.max(1, Math.round(raw - D.armorDef * 0.4));
  pushLog(b, side === 'player'
    ? `${crit ? 'BULLSEYE! ' : ''}Your ${A.rangedDmg >= 14 ? 'arrow' : 'stone'} hits ${D.name} for ${dmg}.`
    : `${crit ? 'A cruel hit! ' : ''}${A.name}'s shot thuds into you for ${dmg}.`);
  if (side === 'player') addCrowd(b, 4 + A.cha * 0.2 + (crit ? 3 : 0)); else addCrowd(b, CROWD_HURT);
  applyDamage(b, target, dmg, crit, false, false);
  if (b.phase !== 'over' && side === 'player') checkFavor(b);
}

function moveFighter(b: Bout, side: Side, dir: 1 | -1): void {
  const f = side === 'player' ? b.player : b.enemy;
  const other = side === 'player' ? b.enemy : b.player;
  const from = f.pos;
  let step = f.move * (dir === -1 ? 0.9 : 1);
  if (dir === 1 && side === 'player') step = Math.min(step, other.pos - MIN_GAP - f.pos);
  if (dir === -1 && side === 'enemy') step = Math.min(step, other.pos + MIN_GAP - f.pos);
  let to = f.pos + dir * step;
  to = Math.max(0, Math.min(100, to));
  if (Math.abs(to - from) < 0.5) {
    pushLog(b, side === 'player' ? 'No room to move — the wall is at your back!' : `${f.name} is pinned against the wall!`);
    return;
  }
  f.pos = to;
  b.events.push({ t: 'move', side, from, to });
}

/* ---------- player action entry ---------- */
export function playerAct(b: Bout, action: PlayerAction): boolean {
  if (b.phase !== 'player') return false;
  const p = b.player;
  switch (action) {
    case 'advance':
      if (dist(b) <= p.meleeRange) { pushLog(b, 'Already locked in melee — no room to advance.'); return false; }
      moveFighter(b, 'player', 1);
      pushLog(b, `${p.name} advances. (${Math.round(dist(b))} paces apart)`);
      break;
    case 'withdraw':
      if (p.pos <= 1) { pushLog(b, 'The arena wall blocks your retreat!'); return false; }
      moveFighter(b, 'player', -1);
      addCrowd(b, CROWD_WITHDRAW);
      pushLog(b, `${p.name} withdraws. The crowd jeers a little. (${Math.round(dist(b))} paces apart)`);
      break;
    case 'quick':
      if (!inMelee(b, 'player')) { pushLog(b, 'Too far for steel — ADVANCE first.'); return false; }
      meleeAttack(b, 'player', 'quick');
      break;
    case 'power':
      if (!inMelee(b, 'player')) { pushLog(b, 'Too far for steel — ADVANCE first.'); return false; }
      meleeAttack(b, 'player', 'power');
      break;
    case 'ranged':
      if (!canRanged(b, 'player')) { pushLog(b, dist(b) < RANGED_MIN_GAP ? 'Too close — you would shoot past them.' : 'No ranged weapon or ammo.'); return false; }
      rangedAttack(b, 'player');
      break;
    case 'ember': case 'mend': case 'warcry': {
      const sp = SPELLS.find(s => s.id === action)!;
      if (!spellGate(action, b.playerLevel)) { pushLog(b, `${sp.name} unlocks at level ${sp.gate}.`); return false; }
      if (p.mana < sp.cost) { pushLog(b, 'Not enough mana.'); return false; }
      p.mana -= sp.cost;
      if (action === 'ember') {
        b.events.push({ t: 'spell', side: 'player', spell: 'ember', amount: 0 });
        if (b.rng() < EMBER_HIT - dodgeOf(b.enemy) * 0.008) {
          const dmg = Math.max(2, Math.round((EMBER_DMG + b.playerLevel * EMBER_PER_LEVEL) * (1 - VARIANCE / 2 + b.rng() * VARIANCE) - b.enemy.armorDef * 0.25));
          pushLog(b, `Ember Bolt sears ${b.enemy.name} for ${dmg}!`);
          addCrowd(b, CROWD_SPELL);
          applyDamage(b, 'enemy', dmg, false, false, false);
        } else {
          b.events.push({ t: 'miss', side: 'player', target: 'enemy' });
          pushLog(b, 'The Ember Bolt fizzles against the arena dust.');
        }
      } else if (action === 'mend') {
        const heal = MEND_BASE + b.playerLevel * MEND_PER_LEVEL;
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + heal);
        b.events.push({ t: 'spell', side: 'player', spell: 'mend', amount: p.hp - before });
        pushLog(b, `Mend knits your wounds (+${p.hp - before} HP).`);
      } else {
        b.warcry = WARCRY_TURNS;
        addCrowd(b, CROWD_SPELL);
        b.events.push({ t: 'spell', side: 'player', spell: 'warcry', amount: WARCRY_TURNS });
        pushLog(b, `WAR CRY! ${b.enemy.name} shrinks ${WARCRY_TURNS} turns of reduced attack and defence.`);
      }
      break;
    }
    case 'potion':
      if (p.potions <= 0) { pushLog(b, 'No potions left.'); return false; }
      if (p.hp >= p.maxHp) { pushLog(b, 'Already at full health.'); return false; }
      p.potions--;
      { const heal = POTION_HEAL + b.playerLevel * POTION_PER_LEVEL;
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + heal);
        b.events.push({ t: 'potion', side: 'player', heal: p.hp - before });
        pushLog(b, `${p.name} quaffs a potion (+${p.hp - before} HP).`); }
      break;
    case 'flask':
      if (p.flasks <= 0) { pushLog(b, 'No mana flasks left.'); return false; }
      if (p.mana >= p.maxMana) { pushLog(b, 'Mana already full.'); return false; }
      p.flasks--;
      { const before = p.mana;
        p.mana = Math.min(p.maxMana, p.mana + FLASK_MANA);
        b.events.push({ t: 'flask', side: 'player', mana: p.mana - before });
        pushLog(b, `${p.name} drinks a mana flask (+${p.mana - before} mana).`); }
      break;
    case 'taunt': {
      const gain = Math.round(CROWD_TAUNT + p.cha * 0.8);
      addCrowd(b, gain);
      b.rage = RAGE_TURNS;
      b.events.push({ t: 'taunt', side: 'player' });
      const taunts = [
        `${p.name} kisses their blade at ${b.enemy.name}. The crowd HOWLS! (+${gain} crowd)`,
        `"Is that all, ${b.enemy.name}?" — the stands chant along! (+${gain} crowd)`,
        `${p.name} strikes a heroic pose. ${b.enemy.name} turns PURPLE with rage! (+${gain} crowd)`,
        `${p.name} inspects an imaginary spot of rust. ${b.enemy.name} SNARLS! (+${gain} crowd)`,
      ];
      pushLog(b, pick(taunts, b.rng));
      pushLog(b, `${b.enemy.name} flies into a rage: harder swings, sloppy guard (${RAGE_TURNS} turns).`);
      break;
    }
    case 'surrender':
      b.phase = 'over';
      b.result = 'lose';
      b.surrendered = true;
      b.events.push({ t: 'surrender' });
      b.events.push({ t: 'end', result: 'lose' });
      pushLog(b, `${p.name} raises one finger: "I yield." The crowd boos the mercy.`);
      return true;
  }
  if (isOver(b)) return true;
  b.phase = 'enemy';
  return true;
}

/** called once at the start of each player turn: regen/decay/timers */
export function beginPlayerTurn(b: Bout): void {
  if (b.phase !== 'player') return;
  b.turn++;
  b.player.mana = Math.min(b.player.maxMana, b.player.mana + MANA_REGEN);
  addCrowd(b, CROWD_DECAY);
  if (b.warcry > 0) {
    b.warcry--;
    if (b.warcry === 0) pushLog(b, `${b.enemy.name} shakes off the War Cry.`);
  }
}

/* ---------- enemy AI ---------- */
export function enemyAct(b: Bout): void {
  if (b.phase !== 'enemy') return;
  const e = b.enemy, p = b.player, d = dist(b);
  if (b.rage > 0) b.rage--;
  if (e.hp < e.maxHp * 0.35 && b.enemyPotions > 0) {
    b.enemyPotions--;
    const before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + 40);
    b.events.push({ t: 'potion', side: 'enemy', heal: e.hp - before });
    pushLog(b, `${e.name} drinks a murky potion (+${e.hp - before} HP). The crowd boos.`);
  } else if (e.hasRanged && e.rangedAmmo > 0 && d >= RANGED_MIN_GAP && b.rng() < 0.55) {
    rangedAttack(b, 'enemy');
  } else if (d > e.meleeRange) {
    moveFighter(b, 'enemy', -1);
    pushLog(b, `${e.name} closes in. (${Math.round(dist(b))} paces apart)`);
  } else if (b.rage > 0 && b.rng() < 0.65) {
    meleeAttack(b, 'enemy', 'power');
  } else if (b.rng() < 0.35) {
    meleeAttack(b, 'enemy', 'power');
  } else {
    meleeAttack(b, 'enemy', 'quick');
  }
  if (!isOver(b)) b.phase = 'player';
}

export function boutDef(index: number): BoutDef { return BOUTS[Math.max(0, Math.min(BOUTS.length - 1, index))]; }
export { xpForLevel };
