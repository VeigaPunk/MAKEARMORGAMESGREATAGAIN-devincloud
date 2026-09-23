/**
 * Economy ladder simulation — node entry (bundled+run via esbuild, see
 * ship-records for the recorded run). Drives the REAL bout engine with a
 * deterministic "average play" policy to prove the ladder is winnable by
 * play with margin but not trivially (final bout ≈ 40% first-try for a
 * decent build).
 *
 */
import { BOUTS, purseFor, xpFor, POTION_CAP, xpForLevel, itemById } from './data';
import {
  Gladiator, Stats6, newGladiator, gladiatorMaxHp, gladiatorMaxMana, totalArmorDef,
  weaponDmg, meleeRangeOf, moveOf, rangedInfo, priceFor, healCost, buyItem, buyPotion, buyAmmo,
} from './game';
import {
  Bout, startBout, playerAct, enemyAct, beginPlayerTurn, dist, inMelee, canRanged,
  makePlayerFighter, mulberry32, spellGate, isOver,
} from './engine';

/* ---------- deterministic "decent build" ---------- */
const START_STATS: Stats6 = { strength: 8, agility: 6, attack: 8, defence: 4, vitality: 8, charisma: 4 };
const LEVEL_PRIORITY: Array<keyof Stats6> = ['strength', 'attack', 'vitality', 'agility', 'defence'];

/** shopping priority: id list in buy order (level gates enforced by buyItem) */
const BUY_ORDER = ['w1', 'r0', 'w2', 'h1', 's1', 'c1', 'b1', 'w3', 'c2', 'h2', 's2', 'r1', 'b2', 'h3', 's3', 'c3', 'w4', 'w5'];

interface SimResult {
  bout: number; enemy: string; attempts: number; won: boolean;
  level: number; gold: number; hp: number; maxHp: number; weapon: string; armor: number; potions: number;
}

function simFighterFrom(g: Gladiator) {
  const r = rangedInfo(g);
  return makePlayerFighter({
    name: g.name, level: g.level, hp: g.hp,
    stats: { str: g.stats.strength, agi: g.stats.agility, atk: g.stats.attack, def: g.stats.defence, vit: g.stats.vitality, cha: g.stats.charisma },
    weaponDmg: weaponDmg(g), armorDef: totalArmorDef(g),
    meleeRange: meleeRangeOf(g), move: moveOf(g),
    hasRanged: !!r, rangedDmg: r?.dmg ?? 0, rangedAmmo: r?.ammo ?? 0,
    potions: g.potions, flasks: g.flasks, mana: g.mana,
    look: g.look, scale: 1,
  });
}

interface LadderRun { rows: SimResult[]; completed: boolean; firstTryFinal: boolean; defeats: number }

function syncBack(g: Gladiator, b: Bout): void {
  g.hp = b.player.hp;
  g.mana = b.player.mana;
  g.potions = b.player.potions;
  g.flasks = b.player.flasks;
  const r = rangedInfo(g);
  if (r) {
    if (r.kind === 'stone') g.stones = b.player.rangedAmmo; else g.arrows = b.player.rangedAmmo;
  }
}

function policy(g: Gladiator, b: Bout): void {
  let guard = 0;
  while (b.phase === 'player' && guard++ < 250) {
    const d = dist(b);
    const melee = inMelee(b, 'player');
    const knowEmber = spellGate('ember', g.level);
    const knowMend = spellGate('mend', g.level);
    const knowCry = spellGate('warcry', g.level);
    let acted = false;
    if (b.player.hp < b.player.maxHp * 0.3 && b.player.potions > 0) { playerAct(b, 'potion'); acted = true; }
    else if (b.player.hp < b.player.maxHp * 0.45 && knowMend && b.player.mana >= 10) { playerAct(b, 'mend'); acted = true; }
    else if (b.player.mana < 8 && b.player.flasks > 0 && knowEmber) { playerAct(b, 'flask'); acted = true; }
    else if (!melee) {
      if (canRanged(b, 'player') && b.rng() < 0.6) { playerAct(b, 'ranged'); acted = true; }
      else if (knowEmber && b.player.mana >= 8 && b.rng() < 0.5) { playerAct(b, 'ember'); acted = true; }
      else { playerAct(b, 'advance'); acted = true; }
    } else {
      if (knowCry && b.player.mana >= 6 && b.warcry === 0 && b.rng() < 0.2) { playerAct(b, 'warcry'); acted = true; }
      else if (b.crowd < 25 && b.player.hp > b.player.maxHp * 0.6 && b.rng() < 0.25) { playerAct(b, 'taunt'); acted = true; }
      else if (b.rng() < 0.4) { playerAct(b, 'power'); acted = true; }
      else { playerAct(b, 'quick'); acted = true; }
    }
    if (!acted) break;
    if (isOver(b)) break;
    enemyAct(b);
    if (isOver(b)) break;
    beginPlayerTurn(b);
  }
}

function shop(g: Gladiator, boutNo: number): void {
  // potions first (keep 2, 3 from bout 6)
  const wantPotions = boutNo >= 6 ? 3 : 2;
  while (g.potions < wantPotions && g.gold >= priceFor(g, 24) && g.potions < POTION_CAP) buyPotion(g);
  // ammo resupply
  const r = rangedInfo(g);
  if (r && r.ammo < 4) buyAmmo(g, r.kind);
  // gear in priority order, keeping a 30g potion reserve
  for (const id of BUY_ORDER) {
    if (g.owned.includes(id)) continue; // never downgrade by re-equipping
    const price = priceFor(g, priceOf(id));
    if (g.gold - 30 < price) continue;
    buyItem(g, id);
  }
  // heal to full
  const hc = healCost(g);
  if (hc > 0 && g.gold >= hc) { g.gold -= hc; g.hp = gladiatorMaxHp(g); }
}

function priceOf(id: string): number { return itemById(id)?.price ?? 0; }

function applyLevels(g: Gladiator, points: number): void {
  let i = 0;
  while (points-- > 0) {
    const k = LEVEL_PRIORITY[i % LEVEL_PRIORITY.length];
    g.stats[k]++;
    i++;
  }
  g.hp = Math.min(gladiatorMaxHp(g), g.hp + 8);
  g.mana = gladiatorMaxMana(g);
}

function runLadder(seed: number, verbose: boolean): LadderRun {
  const rng = mulberry32(seed * 7919 + 13);
  const g = newGladiator('SIMULATOR', { preset: 0, skin: 0.5, hair: 0.5, height: 0.55, build: 0.5 }, START_STATS);
  g.gold = 50;
  const rows: SimResult[] = [];
  let defeats = 0;
  let firstTryFinal = false;
  for (let i = 0; i < BOUTS.length; i++) {
    shop(g, i + 1);
    let attempts = 0;
    let won = false;
    while (attempts < 4) {
      attempts++;
      const b = startBout(simFighterFrom(g), BOUTS[i], i + 1, g.level, 0, rng);
      policy(g, b);
      if (b.result === 'win') {
        won = true;
        if (i === BOUTS.length - 1 && attempts === 1) firstTryFinal = true;
        const tip = Math.round(b.crowd * 0.35);
        g.gold += purseFor(i + 1) + tip;
        g.xp += xpFor(i + 1);
        let lv = 1;
        while (lv < 12 && g.xp >= xpForLevel(lv + 1)) lv++;
        const gained = (lv - g.level) * 3;
        g.level = Math.max(g.level, lv);
        if (gained > 0) applyLevels(g, gained);
        break;
      } else {
        defeats++;
        g.gold = Math.round(g.gold * 0.75);
        g.xp += Math.round(xpFor(i + 1) * 0.25);
        g.hp = Math.max(1, Math.round(gladiatorMaxHp(g) * 0.35));
        // heal what we can afford before retry
        shop(g, i + 1);
        if (attempts >= 4) break;
      }
    }
    rows.push({
      bout: i + 1, enemy: BOUTS[i].name, attempts, won,
      level: g.level, gold: g.gold, hp: Math.round(g.hp), maxHp: gladiatorMaxHp(g),
      weapon: g.equipped.weapon, armor: totalArmorDef(g), potions: g.potions,
    });
    if (!won) break;
  }
  const completed = rows.length === BOUTS.length && rows[rows.length - 1].won;
  if (verbose) {
    console.log(`\n=== seed ${seed} — ${completed ? 'LADDER COMPLETE' : 'ELIMINATED at bout ' + rows[rows.length - 1].bout} (${defeats} defeats) ===`);
    for (const r of rows) {
      console.log(`bout ${String(r.bout).padStart(2)} vs ${r.enemy.padEnd(22)} tries ${r.attempts} ${r.won ? 'WIN ' : 'LOSS'} | Lv${String(r.level).padStart(2)} gold ${String(r.gold).padStart(4)} hp ${r.hp}/${r.maxHp} wpn ${r.weapon} armor +${r.armor} pots ${r.potions}`);
    }
  }
  return { rows, completed, firstTryFinal, defeats };
}

const seeds = Array.from({ length: 30 }, (_, i) => i);
let completions = 0, finalsFirstTry = 0, totalDefeats = 0;
const defeatByBout = new Map<number, number>();
for (const s of seeds) {
  const r = runLadder(s, false);
  if (r.completed) completions++;
  if (r.firstTryFinal) finalsFirstTry++;
  totalDefeats += r.defeats;
  for (const row of r.rows) if (row.attempts > 1) {
    const extra = row.won ? row.attempts - 1 : row.attempts;
    defeatByBout.set(row.bout, (defeatByBout.get(row.bout) ?? 0) + extra);
  }
}
console.log(`economy sim — ${seeds.length} seeds, decent melee build, average policy`);
console.log(`ladder completed: ${completions}/${seeds.length}`);
console.log(`final bout (Colossus) won first-try: ${finalsFirstTry}/${seeds.length}`);
console.log(`total defeats across seeds: ${totalDefeats}`);
console.log('defeats by bout:', [...defeatByBout.entries()].map(([b, n]) => `b${b}:${n}`).join(' '));
// full trajectory of a representative (seed 0) run
runLadder(0, true);
