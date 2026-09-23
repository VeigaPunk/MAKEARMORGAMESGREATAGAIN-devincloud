import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, readSave, buy, startCombat, playTurn, items, opponents } from '../src/model.ts';
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function created(stats = { strength: 5, agility: 3, vitality: 3, defense: 3 }) { const s = freshSave(); s.gladiator.name = 'Maximus'; s.gladiator.stats = stats; return s; }
function campaign(stats, seed) {
  let s = created(stats); const random = rng(seed); let losses = 0, turns = 0;
  while (s.defeated < opponents.length && losses < 12) {
    for (let i = 0; i < items.length; i++) buy(s, i);
    const c = startCombat(s);
    while (!c.finished && turns < 1000) {
      const action = s.gladiator.hp <= s.gladiator.maxHp - 26 && s.gladiator.potions > 0 ? 'potion' : c.cooldown === 0 ? 'special' : 'attack';
      const r = playTurn(s, c, action, random); turns++;
      if (r.outcome === 'defeat') losses++;
    }
    s = readSave(JSON.parse(JSON.stringify(s))); assert.ok(s, 'legitimate progression remains reloadable');
  }
  return { s, losses, turns };
}
test('every legal six-point build completes through combat, rewards, shop, and reload', () => {
  let campaigns = 0, maxLosses = 0;
  for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) for (let c = 0; c <= 6 - a - b; c++) {
    const stats = { strength: 2 + a, agility: 2 + b, vitality: 2 + c, defense: 8 - a - b - c };
    for (let seed = 1; seed <= 100; seed++) {
      const { s, losses } = campaign(stats, seed); maxLosses = Math.max(losses, maxLosses);
      assert.equal(s.defeated, opponents.length, JSON.stringify({ stats, seed, losses }));
      assert.equal(s.gladiator.xp, opponents.length * 22); assert.ok(s.owned.length >= 6); assert.equal(startCombat(s), null); campaigns++;
    }
  }
  console.log(`${campaigns} seeded campaigns; all 84 builds complete; maximum defeats before completion: ${maxLosses}`);
});
test('no duplicate rewards or purchases, and invalid actions spend no turns', () => {
  const s = created(); const c = startCombat(s); const rand = rng(7);
  while (!c.finished) playTurn(s, c, c.cooldown ? 'attack' : 'special', rand);
  assert.equal(s.defeated, 1); const gold = s.gladiator.gold;
  playTurn(s, c, 'attack', rand); assert.equal(s.gladiator.gold, gold);
  assert.ok(buy(s, 0)); assert.equal(buy(s, 0), false); assert.equal(s.gladiator.gold, gold - 22);
  const next = startCombat(s); playTurn(s, next, 'potion', rand); assert.equal(next.round, 0);
  playTurn(s, next, 'special', rand); playTurn(s, next, 'special', rand); assert.equal(next.round, 1);
});
test('save validation rejects malformed/injected appearance and impossible numerical state', () => {
  const valid = created(); assert.ok(readSave(valid));
  for (const mutate of [s => s.gladiator.look = '<img onerror=alert(1)>', s => s.gladiator.gold = -1, s => s.gladiator.hp = Infinity, s => s.gladiator.stats.agility = NaN, s => s.defeated = 99, s => s.gladiator.xp = 90, s => s.owned = ['fake'], s => s.gladiator.stats.strength = 999]) {
    const s = structuredClone(valid); mutate(s); assert.equal(readSave(s), null);
  }
  valid.gladiator.name = '<img src=x onerror=1>'; assert.ok(readSave(valid), 'names remain inert text, not executable HTML');
  for (const value of [null, [], {}, true, 'bad']) assert.equal(readSave(value), null);
});

test('defeat restores a playable retry without corrupting campaign or consuming rewards', () => {
  const s = created(); const c = startCombat(s); const rand = rng(1);
  while (!c.finished) playTurn(s, c, 'guard', rand);
  assert.equal(s.defeated, 0); assert.equal(s.gladiator.gold, 0); assert.equal(s.gladiator.xp, 0);
  assert.equal(s.gladiator.hp, s.gladiator.maxHp); assert.equal(s.gladiator.potions, 2);
  assert.ok(readSave(s)); assert.ok(startCombat(s));
});
test('a four-win checkpoint migrates into the second tournament instead of ending the campaign', () => {
  const s = created(); s.defeated = 4; s.gladiator.xp = 88; s.gladiator.level = 3;
  s.owned = ['Bent Bronze Sword']; s.gladiator.weapon = 2;
  const loaded = readSave(s); assert.ok(loaded); assert.equal(loaded.gladiator.weapon, 3);
  assert.equal(startCombat(loaded).opponent.name, 'Cassia Quickblade');
});
