import { newGladiator, gladiatorMaxHp } from './game';
import { makePlayerFighter } from './engine';
const g = newGladiator('S', { preset: 0, skin: .5, hair: .5, height: .55, build: .5 }, { strength: 8, agility: 6, attack: 8, defence: 4, vitality: 8, charisma: 4 });
const r = { dmg: 0, ammo: 0, kind: 'stone' as const };
const f = makePlayerFighter({ name: 'S', level: 1, hp: g.hp,
  stats: { str: 8, agi: 6, atk: 8, def: 4, vit: 8, cha: 4 },
  weaponDmg: 6, armorDef: 2, meleeRange: 12, move: 17,
  hasRanged: false, rangedDmg: 0, rangedAmmo: 0, potions: 1, flasks: 0, mana: 16,
  look: g.look, scale: 1 });
console.log('fighter maxHp:', f.maxHp, 'glad maxHp:', gladiatorMaxHp(g));
