/**
 * SANDALS OF STEEL: REIGN OF THE COLOSSUS — app shell.
 * DOM chrome is built exclusively with createElement + textContent
 * (D-51/52/53: no dynamic string ever reaches innerHTML). Combat runs the
 * pure engine; canvas renders the arena; audio beds switch per screen.
 */
import {
  STAT_KEYS, STAT_INFO, StatKey, CREATE_POINTS, STAT_BASE, STAT_MAX_CREATE,
  LEVEL_CAP, xpForLevel, BOUTS, SPELLS, LOOK_PRESETS, POTION_CAP, FLASK_CAP,
  AMMO_PACK, purseFor, xpFor, itemById, Slot, POTION_PRICE, FLASK_PRICE,
} from './data';
import {
  Gladiator, Stats6, GameState, newGladiator, gladiatorMaxHp, gladiatorMaxMana, totalArmorDef,
  weaponDmg, meleeRangeOf, moveOf, rangedInfo, priceFor, levelUpCheck, healCost,
  loadGame, persistGame, loadSettings, persistSettings, Settings,
  buyItem, buyPotion, buyFlask, buyAmmo, ShopMsg, creationValid, statsTo6,
  defeatPenalty, surrenderPenalty, defeatXp, shopItems,
} from './game';
import {
  Bout, PlayerAction, startBout, playerAct, enemyAct, beginPlayerTurn, isOver,
  dist, inMelee, canRanged, spellGate, makePlayerFighter, Event,
} from './engine';
import { Scene, SceneKind, gearFromEquipped, gearFromBout, STAGE_W, STAGE_H } from './render';
import { Sfx, load as loadStore } from '@maga/arcade-core';
import { registerAudioPresets, playBed, Bed, playFanfare } from './audio';

/* ---------------- DOM helpers (safe builders only) ---------------- */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function buttonRow(parent: HTMLElement, label: string, sub: string | undefined, fn: () => void, disabled = false, key?: string): HTMLButtonElement {
  const b = el('button', 'actionbtn');
  const l = el('span', 'btnlabel', label + (key ? `  [${key}]` : ''));
  b.appendChild(l);
  if (sub) b.appendChild(el('small', undefined, sub));
  b.disabled = disabled;
  b.addEventListener('click', () => { if (!b.disabled) { sfx.preset('ui'); fn(); } });
  parent.appendChild(b);
  return b;
}

/* ---------------- module state ---------------- */
const stage = document.querySelector<HTMLCanvasElement>('#stage')!;
stage.width = STAGE_W; stage.height = STAGE_H;
const hudEl = document.querySelector<HTMLElement>('#hud')!;
const chromeEl = document.querySelector<HTMLElement>('#chrome')!;
const actionsEl = document.querySelector<HTMLElement>('#actions')!;
const logEl = document.querySelector<HTMLElement>('#log')!;
const overlayEl = document.querySelector<HTMLElement>('#overlay')!;
const sfx = new Sfx();
registerAudioPresets();
const scene = new Scene(stage);
const settings: Settings = loadSettings();
sfx.volume = settings.volume;
sfx.setMuted(settings.muted);

type Mode = 'title' | 'create' | 'hub' | 'combat' | 'shop' | 'end';
let mode: Mode = 'title';
let st: GameState = loadGame() ?? { glad: null, defeated: 0, ngPlus: 0, career: { boutsWon: 0, boutsLost: 0, critsLanded: 0, crowdFavors: 0, surrenders: 0 }, complete: false, pointsToSpend: 0 };
let bout: Bout | null = null;
let endKind: 'win' | 'lose' | 'complete' | null = null;
let shopWhich: 'smith' | 'armoury' | 'alchemist' | 'fletcher' = 'smith';
let shopMsg: ShopMsg = null;
let bed: Bed = 'none';
let enemyTimer = 0;
let turnToken = 0;

/* creation form state */
let cr = {
  name: '',
  look: { preset: 0, skin: 0.5, hair: 0.5, height: 0.5, build: 0.5 },
  stats: { strength: STAT_BASE, agility: STAT_BASE, attack: STAT_BASE, defence: STAT_BASE, vitality: STAT_BASE, charisma: STAT_BASE } as Stats6,
  points: CREATE_POINTS,
};

const g = (): Gladiator => st.glad!;

/* ---------------- bed switching ---------------- */
function setBed(b: Bed): void {
  if (b === bed) return;
  bed = b;
  playBed(sfx, b);
}

/* ---------------- render root ---------------- */
function render(): void {
  turnToken++;
  if (enemyTimer) { clearTimeout(enemyTimer); enemyTimer = 0; }
  hudEl.replaceChildren();
  chromeEl.replaceChildren();
  actionsEl.replaceChildren();
  logEl.replaceChildren();
  overlayEl.classList.remove('show');
  overlayEl.replaceChildren();

  if (st.glad) {
    const gl = g();
    const left = el('span', 'hudname', gl.name);
    const lv = el('span', undefined, `Lv ${gl.level} · XP ${gl.xp}/${xpForLevel(Math.min(LEVEL_CAP, gl.level + 1))}`);
    const right = el('span', undefined, `HP ${Math.ceil(gl.hp)}/${gladiatorMaxHp(gl)} · Mana ${Math.floor(gl.mana)}/${gladiatorMaxMana(gl)} · Gold ${gl.gold}g`);
    hudEl.append(left, lv, right);
  } else {
    hudEl.append(el('span', 'hudname', 'SANDALS OF STEEL'));
  }

  scene.state.kind = (mode === 'title' ? 'title' : mode === 'create' ? 'create' : mode === 'hub' ? 'hub' : mode === 'combat' ? 'arena' : mode === 'shop' ? 'shop' : 'end') as SceneKind;
  scene.state.bout = bout;
  scene.state.crowd = bout?.crowd ?? 0;
  scene.state.previewLook = st.glad ? st.glad.look : cr.look;
  scene.state.playerGear = st.glad ? gearFromEquipped(st.glad.equipped) : null;
  scene.state.enemyGear = bout ? gearFromBout(bout.def) : null;
  scene.state.shop = shopWhich;
  scene.state.endKind = endKind ?? undefined;

  if (mode === 'title') renderTitle();
  else if (mode === 'create') renderCreate();
  else if (mode === 'hub') renderHub();
  else if (mode === 'combat') renderCombat();
  else if (mode === 'shop') renderShop();
  else renderEnd();

  if (mode === 'title' || mode === 'create') setBed('menu');
  else if (mode === 'hub') setBed('menu');
  else if (mode === 'combat') setBed('combat');
  else if (mode === 'shop') setBed('shop');
}

/* ---------------- title ---------------- */
function renderTitle(): void {
  const wrap = el('div', 'titlewrap');
  const h1 = el('h1', undefined, 'SANDALS OF STEEL');
  const h2 = el('h2', undefined, 'REIGN OF THE COLOSSUS');
  const p = el('p', 'sub', 'A turn-based gladiator RPG of ladders, gold and crowd favor.');
  wrap.append(h1, h2, p);
  chromeEl.appendChild(wrap);
  if (st.glad) {
    const saveInfo = el('p', 'saveinfo');
    saveInfo.append(
      document.createTextNode('Saved gladiator: '),
      el('b', undefined, st.glad.name),
      document.createTextNode(` — Lv ${st.glad.level}, bout ${Math.min(st.defeated + 1, BOUTS.length)} of ${BOUTS.length}${st.ngPlus > 0 ? ` (NG+${st.ngPlus})` : ''}`),
    );
    chromeEl.appendChild(saveInfo);
    buttonRow(actionsEl, 'CONTINUE', 'return to the hub', () => { mode = 'hub'; render(); });
    buttonRow(actionsEl, 'NEW GLADIATOR', 'erases the current save', () => { st.glad = null; st.defeated = 0; st.ngPlus = 0; st.complete = false; st.career = { boutsWon: 0, boutsLost: 0, critsLanded: 0, crowdFavors: 0, surrenders: 0 }; resetCreate(); mode = 'create'; render(); });
  } else {
    buttonRow(actionsEl, 'NEW GLADIATOR', 'create a fighter', () => { resetCreate(); mode = 'create'; render(); });
  }
  buttonRow(actionsEl, 'SETTINGS', 'volume / mute', showSettings);
}

function resetCreate(): void {
  cr = {
    name: '',
    look: { preset: 0, skin: 0.5, hair: 0.5, height: 0.5, build: 0.5 },
    stats: { strength: STAT_BASE, agility: STAT_BASE, attack: STAT_BASE, defence: STAT_BASE, vitality: STAT_BASE, charisma: STAT_BASE } as Stats6,
    points: CREATE_POINTS,
  };
}

/* ---------------- creation ---------------- */
function statRow(parent: HTMLElement, key: StatKey, val: number, points: number, onPlus: () => void, onMinus: () => void): void {
  const row = el('div', 'staterow');
  const info = STAT_INFO[key];
  const lab = el('div', 'statlabel');
  lab.append(el('b', undefined, info.label), document.createTextNode(' — ' + info.blurb));
  const num = el('span', 'statnum', String(val));
  const ctrl = el('div', 'stattrl');
  const minus = el('button', 'statbtn', '−');
  const plus = el('button', 'statbtn', '+');
  minus.disabled = val <= STAT_BASE;
  plus.disabled = points <= 0 || val >= STAT_MAX_CREATE;
  minus.addEventListener('click', () => { sfx.preset('ui'); onMinus(); });
  plus.addEventListener('click', () => { sfx.preset('ui'); onPlus(); });
  ctrl.append(minus, num, plus);
  row.append(lab, ctrl);
  parent.appendChild(row);
}

function dialRow(parent: HTMLElement, label: string, value: number, onChange: (v: number) => void, left: string, right: string): void {
  const row = el('div', 'dialrow');
  row.append(el('span', 'diallabel', label));
  const inp = el('input', 'dial') as HTMLInputElement;
  inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.value = String(Math.round(value * 100));
  inp.addEventListener('input', () => onChange(Number(inp.value) / 100));
  const ends = el('span', 'dialends');
  ends.append(el('small', undefined, left), inp, el('small', undefined, right));
  row.appendChild(ends);
  parent.appendChild(row);
}

function renderCreate(): void {
  const wrap = el('div', 'createwrap');
  wrap.appendChild(el('h1', undefined, 'CREATE YOUR GLADIATOR'));

  const nameRow = el('div', 'namerow');
  nameRow.appendChild(el('label', undefined, 'Name'));
  const nameInput = el('input', 'nameinput') as HTMLInputElement;
  nameInput.maxLength = 40;
  nameInput.autocomplete = 'off';
  nameInput.placeholder = 'Type a legend...';
  nameInput.value = cr.name;
  nameInput.addEventListener('input', () => { cr.name = nameInput.value; });
  nameRow.appendChild(nameInput);
  wrap.appendChild(nameRow);

  const looks = el('div', 'grid looks');
  LOOK_PRESETS.forEach((p, i) => {
    const b = el('button', 'lookbtn' + (Math.round(cr.look.preset) === i ? ' sel' : ''));
    const img = el('img') as HTMLImageElement;
    img.src = p.portrait;
    img.alt = `${p.name} portrait`;
    b.appendChild(img);
    b.appendChild(el('span', undefined, p.name));
    b.addEventListener('click', () => { sfx.preset('ui'); cr.look.preset = i; render(); });
    looks.appendChild(b);
  });
  wrap.appendChild(looks);

  const dials = el('div', 'dials');
  dialRow(dials, 'Skin', cr.look.skin, v => { cr.look.skin = v; }, 'fair', 'deep');
  dialRow(dials, 'Hair', cr.look.hair, v => { cr.look.hair = v; }, 'light', 'dark');
  dialRow(dials, 'Height', cr.look.height, v => { cr.look.height = v; }, 'short · +dodge', 'tall · +reach');
  dialRow(dials, 'Build', cr.look.build, v => { cr.look.build = v; }, 'lean · +speed', 'brawny · +HP');
  wrap.appendChild(dials);

  const derived = el('p', 'derived');
  derived.textContent = `Preview — HP ${30 + cr.stats.vitality * 5 + Math.round(cr.look.build * 12)} · reach ${(9 + cr.look.height * 6).toFixed(1)} paces · move ${(17 + cr.stats.agility * 0.35 - cr.look.build * 4).toFixed(1)}`;
  wrap.appendChild(derived);

  const statsBox = el('div', 'statbox');
  statsBox.appendChild(el('p', undefined, `Skill points remaining: ${cr.points} (base ${STAT_BASE} each)`));
  for (const k of STAT_KEYS) {
    statRow(statsBox, k, statsTo6(cr.stats)[k], cr.points, () => {
      if (cr.points > 0 && statsTo6(cr.stats)[k] < STAT_MAX_CREATE) { cr.stats[k]++; cr.points--; render(); }
    }, () => {
      if (statsTo6(cr.stats)[k] > STAT_BASE) { cr.stats[k]--; cr.points++; render(); }
    });
  }
  wrap.appendChild(statsBox);
  chromeEl.appendChild(wrap);

  const canBegin = creationValid(cr.name, cr.stats);
  buttonRow(actionsEl, 'ENTER THE ARENA', canBegin ? `purse ${50}g · bout 1: ${BOUTS[0].name}` : 'spend all points & name your fighter', () => {
    if (!creationValid(cr.name, cr.stats)) return;
    st.glad = newGladiator(cr.name.trim(), cr.look, cr.stats);
    st.defeated = 0; st.ngPlus = 0; st.complete = false;
    st.pointsToSpend = 0;
    persistGame(st);
    mode = 'hub';
    render();
  }, !canBegin);
  buttonRow(actionsEl, 'BACK', undefined, () => { mode = 'title'; render(); });
}

/* ---------------- hub ---------------- */
function renderHub(): void {
  const gl = g();
  const wrap = el('div', 'hubwrap');
  const left = el('div', 'hubleft');
  left.appendChild(el('h1', undefined, 'THE ARENA GROUNDS'));
  const kit = el('p', 'kit');
  kit.append(
    el('b', undefined, itemById(gl.equipped.weapon)?.name ?? '—'),
    document.createTextNode(` · armour +${totalArmorDef(gl)} · potions ${gl.potions}/${POTION_CAP} · flasks ${gl.flasks}/${FLASK_CAP}`),
  );
  const ranged = rangedInfo(gl);
  if (ranged) kit.append(document.createTextNode(` · ${itemById(gl.equipped.ranged)!.name} (${ranged.ammo} ${ranged.kind === 'stone' ? 'stones' : 'arrows'})`));
  left.appendChild(kit);

  if (st.pointsToSpend > 0) {
    const train = el('div', 'trainbox');
    train.appendChild(el('h3', undefined, `TRAINING — ${st.pointsToSpend} point${st.pointsToSpend > 1 ? 's' : ''} to spend`));
    for (const k of STAT_KEYS) {
      statRow(train, k, statsTo6(gl.stats)[k], st.pointsToSpend, () => {
        if (st.pointsToSpend > 0) { gl.stats[k]++; st.pointsToSpend--; persistGame(st); render(); }
      }, () => {
        if (statsTo6(gl.stats)[k] > STAT_BASE) { gl.stats[k]--; st.pointsToSpend++; persistGame(st); render(); }
      });
    }
    left.appendChild(train);
  }

  const heal = el('div', 'healbox');
  const hc = healCost(gl);
  if (gl.hp < gladiatorMaxHp(gl)) {
    heal.appendChild(el('span', undefined, `Healer: restore ${Math.ceil(gladiatorMaxHp(gl) - gl.hp)} HP for ${hc}g`));
  } else {
    heal.appendChild(el('span', undefined, 'The healer nods — you are unbroken.'));
  }
  left.appendChild(heal);
  wrap.appendChild(left);

  // NEXT OPPONENT card
  const right = el('div', 'oppCard');
  if (st.defeated >= BOUTS.length) {
    right.appendChild(el('h3', undefined, 'THE LADDER IS YOURS'));
    right.appendChild(el('p', undefined, 'Every champion has fallen. The Emperor looks away.'));
  } else {
    const o = BOUTS[st.defeated];
    right.appendChild(el('h3', undefined, `NEXT OPPONENT — bout ${st.defeated + 1}/${BOUTS.length}${st.ngPlus > 0 ? ` · NG+${st.ngPlus}` : ''}`));
    const head = el('div', 'opphead');
    const img = el('img', 'oppport') as HTMLImageElement;
    img.src = LOOK_PRESETS[o.portrait].portrait;
    img.alt = `${o.name} portrait`;
    const meta = el('div', 'oppmeta');
    const nm = el('div', 'oppname', o.name);
    const stats = el('div', 'oppstats');
    const m = 1 + 0.25 * st.ngPlus;
    stats.textContent = `HP ${Math.round(o.hp * m)} · Str ${Math.round(o.str * m)} · Agi ${Math.round(o.agi * m)} · Atk ${Math.round(o.atk * m)} · Def ${Math.round(o.def * m)}${o.ranged ? ' · carries a sling' : ''}${o.colossus ? ' · TWO PHASES' : ''}`;
    meta.append(nm, stats);
    head.append(img, meta);
    right.appendChild(head);
    right.appendChild(el('p', 'taunt', `"${o.taunt}"`));
    right.appendChild(el('p', 'purse', `Purse ${purseFor(st.defeated + 1)}g · XP ${xpFor(st.defeated + 1)}`));
  }
  const car = el('p', 'career');
  car.textContent = `Career: ${st.career.boutsWon}W/${st.career.boutsLost}L · crits ${st.career.critsLanded} · crowd favors ${st.career.crowdFavors}`;
  right.appendChild(car);
  wrap.appendChild(right);
  chromeEl.appendChild(wrap);

  if (st.defeated < BOUTS.length) {
    buttonRow(actionsEl, 'TO BATTLE', `face ${BOUTS[st.defeated].name}`, startFight, gl.hp <= 0, 'Enter');
  } else if (st.complete) {
    buttonRow(actionsEl, 'NEW GAME+', 'ladder resets · enemies +25% · keep your gladiator', startNewGamePlus);
  }
  buttonRow(actionsEl, 'HEAL', hc > 0 && gl.gold >= hc ? `${hc}g` : hc > 0 ? `need ${hc}g` : 'not needed', () => {
    const cost = healCost(gl);
    if (cost > 0 && gl.gold >= cost) {
      gl.gold -= cost;
      gl.hp = gladiatorMaxHp(gl);
      sfx.preset('mend');
      persistGame(st);
      render();
    }
  }, hc === 0 || gl.gold < hc);
  buttonRow(actionsEl, 'WEAPONSMITH', 'blades of rising fury', () => openShop('smith'), false, 'q');
  buttonRow(actionsEl, 'ARMOURY', 'helm · chest · shield · boots', () => openShop('armoury'), false, 'w');
  buttonRow(actionsEl, 'ALCHEMIST', 'potions & mana flasks', () => openShop('alchemist'), false, 'e');
  buttonRow(actionsEl, 'FLETCHER', 'slings, bows, ammunition', () => openShop('fletcher'), false, 'r');
  buttonRow(actionsEl, 'SETTINGS', 'volume / mute', showSettings);
}

function openShop(which: 'smith' | 'armoury' | 'alchemist' | 'fletcher'): void {
  shopWhich = which;
  shopMsg = null;
  mode = 'shop';
  render();
}

/* ---------------- combat ---------------- */
function startFight(): void {
  const gl = g();
  const player = makePlayerFighter({
    name: gl.name,
    stats: { str: gl.stats.strength, agi: gl.stats.agility, atk: gl.stats.attack, def: gl.stats.defence, vit: gl.stats.vitality, cha: gl.stats.charisma },
    level: gl.level,
    hp: gl.hp,
    weaponDmg: weaponDmg(gl),
    armorDef: totalArmorDef(gl),
    meleeRange: meleeRangeOf(gl),
    move: moveOf(gl),
    hasRanged: !!rangedInfo(gl),
    rangedDmg: rangedInfo(gl)?.dmg ?? 0,
    rangedAmmo: rangedInfo(gl)?.ammo ?? 0,
    potions: gl.potions,
    flasks: gl.flasks,
    mana: gl.mana,
    look: gl.look,
    scale: 1,
  });
  bout = startBout(player, BOUTS[st.defeated], st.defeated + 1, gl.level, st.ngPlus, Math.random);
  mode = 'combat';
  endKind = null;
  scene.state.bout = bout;
  render();
  renderCombatLog();
}

function renderCombat(): void {
  const b = bout!;
  const gl = g();
  const wrap = el('div', 'combatwrap');
  const bars = el('div', 'combatbars');
  bars.append(
    fightBar(gl.name, b.player.hp, b.player.maxHp, '#d84a3a'),
    barEl('Mana', b.player.mana, b.player.maxMana, '#3a8ad8'),
    barEl('Crowd', b.crowd, 100, '#e8a03a'),
    fightBar(b.enemy.name, b.enemy.hp, b.enemy.maxHp, '#d84a3a'),
  );
  wrap.appendChild(bars);
  const meta = el('p', 'combatmeta');
  const statusBits: string[] = [`distance ${Math.round(dist(b))} paces · turn ${b.turn}`];
  if (b.favorBuff) statusBits.push('CROWD FAVOR armed — next blow +60%');
  if (b.rage > 0) statusBits.push(`${b.enemy.name} ENRAGED (${b.rage})`);
  if (b.warcry > 0) statusBits.push(`${b.enemy.name} debuffed (${b.warcry})`);
  if (b.phase2) statusBits.push('COLOSSUS PHASE TWO');
  meta.textContent = statusBits.join(' · ');
  wrap.appendChild(meta);
  chromeEl.appendChild(wrap);

  const yourMove = b.phase === 'player';
  const meleeOk = inMelee(b, 'player');
  const ranged = canRanged(b, 'player');
  const rInfo = rangedInfo(gl);
  buttonRow(actionsEl, 'QUICK ATTACK', meleeOk ? 'high hit · low damage' : `too far — ${Math.round(dist(b) - b.player.meleeRange)} to close`, () => doAction('quick'), !yourMove || !meleeOk, '1');
  buttonRow(actionsEl, 'POWER ATTACK', meleeOk ? 'low hit · heavy · crits x2.6' : 'too far', () => doAction('power'), !yourMove || !meleeOk, '2');
  buttonRow(actionsEl, 'ADVANCE', `move ${b.player.move.toFixed(0)} · gap ${Math.round(dist(b))}`, () => doAction('advance'), !yourMove || meleeOk, '3');
  buttonRow(actionsEl, 'WITHDRAW', 'crowd disapproves', () => doAction('withdraw'), !yourMove || b.player.pos <= 1, '4');
  buttonRow(actionsEl, 'RANGED', ranged ? `${rInfo?.kind === 'stone' ? 'stone' : 'arrow'} · ${b.player.rangedAmmo} left` : 'need range 30+ & ammo', () => doAction('ranged'), !yourMove || !ranged, '5');
  for (const sp of SPELLS) {
    const open = spellGate(sp.id, gl.level);
    const affordable = b.player.mana >= sp.cost;
    buttonRow(actionsEl, sp.name.toUpperCase(), !open ? `unlocks at level ${sp.gate}` : `${sp.cost} mana · ${sp.blurb}`, () => doAction(sp.id), !yourMove || !open || !affordable, String(SPELLS.indexOf(sp) + 6));
  }
  buttonRow(actionsEl, `POTION ×${b.player.potions}`, 'heal in battle', () => doAction('potion'), !yourMove || b.player.potions <= 0 || b.player.hp >= b.player.maxHp, '9');
  buttonRow(actionsEl, `FLASK ×${b.player.flasks}`, `+18 mana`, () => doAction('flask'), !yourMove || b.player.flasks <= 0 || b.player.mana >= b.player.maxMana);
  buttonRow(actionsEl, 'TAUNT', 'crowd surges · foe enrages', () => doAction('taunt'), !yourMove, '0');
  buttonRow(actionsEl, 'SURRENDER', 'forfeit 25% of purse', () => doAction('surrender'), !yourMove);
}

function fightBar(name: string, hp: number, max: number, color: string): HTMLElement {
  const row = el('div', 'fightbar');
  row.appendChild(el('span', 'barname', name));
  const track = el('div', 'bartrack');
  const fill = el('div', 'barfill');
  fill.style.width = `${Math.max(0, Math.min(100, (hp / max) * 100))}%`;
  fill.style.background = color;
  track.appendChild(fill);
  row.append(track, el('span', 'barval', `${Math.max(0, Math.ceil(hp))}/${max}`));
  return row;
}
function barEl(name: string, v: number, max: number, color: string): HTMLElement {
  const row = el('div', 'minibar');
  row.appendChild(el('span', 'barname', name));
  const track = el('div', 'bartrack');
  const fill = el('div', 'barfill');
  fill.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  fill.style.background = color;
  track.appendChild(fill);
  row.append(track, el('span', 'barval', `${Math.round(v)}`));
  return row;
}

function renderCombatLog(): void {
  if (!bout) return;
  logEl.replaceChildren();
  const title = el('div', 'logtitle', `BOUT ${bout.boutNumber} — ${bout.def.name}`);
  logEl.appendChild(title);
  for (const line of bout.log.slice(-9)) logEl.appendChild(el('div', 'logline', line));
  logEl.scrollTop = logEl.scrollHeight;
}

function doAction(action: PlayerAction): void {
  const b = bout;
  if (!b || b.phase !== 'player') return;
  const ok = playerAct(b, action);
  if (!ok) { renderCombatLog(); return; }
  processEvents(b);
  syncGladFromBout(b);
  render();
  renderCombatLog();
  if (isOver(b)) {
    finishBout(b);
    return;
  }
  const token = ++turnToken;
  enemyTimer = window.setTimeout(() => {
    if (token !== turnToken || !bout) return;
    enemyAct(bout);
    processEvents(bout);
    syncGladFromBout(bout);
    render();
    renderCombatLog();
    if (bout.phase === 'over') { finishBout(bout); return; }
    beginPlayerTurn(bout);
    render();
    renderCombatLog();
  }, 850);
}

/** copy fighter mutable fields back to the gladiator (potions/mana/ammo/hp) */
function syncGladFromBout(b: Bout): void {
  const gl = g();
  gl.hp = b.player.hp;
  gl.mana = b.player.mana;
  gl.potions = b.player.potions;
  gl.flasks = b.player.flasks;
  const r = rangedInfo(gl);
  if (r) {
    if (r.kind === 'stone') gl.stones = b.player.rangedAmmo;
    else gl.arrows = b.player.rangedAmmo;
  }
}

/** engine events → scene cues + sfx + career counters */
function processEvents(b: Bout): void {
  const px = Scene.posToX(b.player.pos), ex = Scene.posToX(b.enemy.pos);
  for (const ev of b.events) {
    applyEvent(ev, b, px, ex);
  }
  b.events.length = 0;
}

function applyEvent(ev: Event, b: Bout, px: number, ex: number): void {
  const gl = g();
  switch (ev.t) {
    case 'lunge':
      scene.startAttack(ev.side, ev.kind);
      sfx.preset('whoosh');
      break;
    case 'hit': {
      const targetX = ev.target === 'player' ? px : ex;
      scene.addFloat(ev.crit ? `CRIT ${ev.dmg}${ev.favor ? '!!' : ''}` : `${ev.dmg}${ev.favor ? '!' : ''}${ev.blocked ? ' blk' : ''}`,
        targetX, 340, ev.crit ? '#ffd23a' : ev.target === 'player' ? '#ff6a5a' : '#ffffff', ev.crit);
      scene.kickCrowd(ev.crit ? 1 : 0.45);
      if (ev.blocked) sfx.preset('clank');
      else if (ev.crit) { sfx.preset('crunch'); scene.kickShake(9); }
      else { sfx.preset('hit'); scene.kickShake(4); }
      if (ev.side === 'player' && ev.crit) st.career.critsLanded++;
      break;
    }
    case 'miss':
      scene.addFloat('MISS', ev.target === 'player' ? px : ex, 340, '#c9c9c9');
      sfx.preset('whoosh');
      break;
    case 'ranged':
      scene.startAttack(ev.side, 'ranged');
      sfx.preset('bowshot');
      break;
    case 'potion':
      scene.addFloat(`+${ev.heal}`, ev.side === 'player' ? px : ex, 330, '#7dff8a');
      if (ev.side === 'player') sfx.preset('glug');
      break;
    case 'flask':
      scene.addFloat(`+${ev.mana} mana`, px, 320, '#8ab4ff');
      sfx.preset('glug');
      break;
    case 'spell':
      if (ev.spell === 'ember') { sfx.preset('ember'); scene.addFloat('EMBER', ex, 320, '#ff9a2a'); scene.kickCrowd(0.5); }
      else if (ev.spell === 'mend') sfx.preset('mend');
      else sfx.preset('warcry');
      break;
    case 'taunt':
      scene.addFloat('TAUNT!', px, 300, '#ffd23a');
      scene.kickCrowd(1);
      sfx.preset('taunt');
      break;
    case 'crowd':
      if (ev.favor) {
        st.career.crowdFavors++;
        scene.addFloat('CROWD FAVOR!', px, 280, '#ffd23a', true);
        scene.kickCrowd(1);
        sfx.preset('roar');
      }
      break;
    case 'phase2':
      scene.kickShake(12);
      scene.kickCrowd(1);
      sfx.preset('roar');
      scene.addFloat('PHASE TWO', ex, 300, '#ff5a3a', true);
      break;
    case 'surrender':
      break;
    case 'end':
      if (ev.result === 'win') { sfx.preset('roar'); playFanfare(sfx); bed = 'none'; }
      else sfx.preset('death');
      break;
    default:
      break;
  }
  void gl;
}

function finishBout(b: Bout): void {
  const gl = g();
  if (b.result === 'win') {
    const boutNo = b.boutNumber;
    const tip = Math.round(b.crowd * 0.35);
    const purse = purseFor(boutNo) + tip;
    gl.gold += purse;
    gl.xp += xpFor(boutNo);
    st.career.boutsWon++;
    st.defeated++;
    const gained = levelUpCheck(gl);
    st.pointsToSpend += gained;
    sfx.preset('coin');
    if (st.defeated >= BOUTS.length) {
      st.complete = true;
      endKind = 'complete';
    } else {
      endKind = 'win';
    }
    persistGame(st);
    mode = 'end';
    render();
    renderEndSummary(`Victory over ${b.def.name}! Purse ${purseFor(boutNo)}g + crowd tip ${tip}g. XP +${xpFor(boutNo)}${gained > 0 ? `. LEVEL UP — ${gained} points to spend.` : ''}`);
  } else {
    if (b.surrendered) {
      const lost = surrenderPenalty(gl);
      st.career.surrenders++;
      endKind = 'lose';
      persistGame(st);
      mode = 'end';
      render();
      renderEndSummary(`You surrendered. The crowd jeers; the purse-master keeps ${lost}g. Your bones, at least, are intact.`);
    } else {
      const lost = defeatPenalty(gl);
      gl.xp += defeatXp(b.boutNumber);
      gl.hp = Math.max(1, Math.round(gladiatorMaxHp(gl) * 0.35));
      levelUpCheck(gl);
      st.career.boutsLost++;
      endKind = 'lose';
      persistGame(st);
      mode = 'end';
      render();
      renderEndSummary(`Defeat! The healers drag you out for ${lost}g. You keep your progress and earn ${defeatXp(b.boutNumber)} XP. Train, shop, and try again.`);
    }
  }
  bout = null;
  scene.state.bout = null;
}

function renderEnd(): void {
  const wrap = el('div', 'endwrap');
  if (endKind === 'complete') {
    wrap.appendChild(el('h1', undefined, 'CHAMPION OF THE ARENA'));
    wrap.appendChild(el('p', 'sub', 'THE COLOSSUS OF STEEL is broken. The Emperor throws you his own laurel. The crowd will sing of this for a hundred years.'));
  } else if (endKind === 'win') {
    wrap.appendChild(el('h1', undefined, 'VICTORY'));
  } else {
    wrap.appendChild(el('h1', undefined, 'DEFEAT'));
  }
  chromeEl.appendChild(wrap);
}

function renderEndSummary(text: string): void {
  const box = chromeEl.querySelector('.endwrap');
  if (box) box.appendChild(el('p', 'endsum', text));
  buttonRow(actionsEl, 'RETURN TO HUB', 'shops · healer · next bout', () => { mode = 'hub'; render(); });
  if (endKind === 'complete') {
    buttonRow(actionsEl, 'NEW GAME+', 'ladder resets · enemies +25% · keep your gladiator', startNewGamePlus);
  }
}

function startNewGamePlus(): void {
  st.defeated = 0;
  st.complete = false;
  st.ngPlus++;
  persistGame(st);
  mode = 'hub';
  render();
}

/* ---------------- shops ---------------- */
function renderShop(): void {
  const gl = g();
  const names = { smith: 'THE WEAPONSMITH', armoury: 'THE ARMOURY', alchemist: 'THE ALCHEMIST', fletcher: 'THE FLETCHER' };
  const wrap = el('div', 'shopwrap');
  wrap.appendChild(el('h1', undefined, names[shopWhich]));
  const disc = Math.min(30, Math.round(gl.stats.charisma * 1.8));
  const info = el('p', 'shopinfo');
  info.append(
    document.createTextNode(`Gold ${gl.gold}g · Level ${gl.level}`),
    el('span', 'disc', disc > 0 ? ` · charisma discount −${disc}%` : ''),
  );
  wrap.appendChild(info);
  if (shopMsg) wrap.appendChild(el('p', `shopmsg ${shopMsg.kind}`, shopMsg.text));
  const grid = el('div', 'grid shopgrid');

  if (shopWhich === 'alchemist') {
    const potionPrice = priceFor(gl, POTION_PRICE);
    shopCard(grid, 'Healing Potion', `restores 40+ HP · cap ${POTION_CAP} · ${potionPrice}g · have ×${gl.potions}`,
      () => buyPotion(gl), gl.gold < potionPrice || gl.potions >= POTION_CAP);
    const flaskPrice = priceFor(gl, FLASK_PRICE);
    shopCard(grid, 'Mana Flask', `+18 mana · cap ${FLASK_CAP} · ${flaskPrice}g · have ×${gl.flasks}`,
      () => buyFlask(gl), gl.gold < flaskPrice || gl.flasks >= FLASK_CAP);
  } else if (shopWhich === 'fletcher') {
    for (const it of shopItems('fletcher')) {
      const owned = gl.owned.includes(it.id);
      shopCard(grid, it.name, owned ? 'owned' : `ranged dmg ${it.rangedDmg} · ${priceFor(gl, it.price)}g · level ${it.gate}`,
        () => buyItem(gl, it.id), owned || gl.level < it.gate || gl.gold < priceFor(gl, it.price), owned);
    }
    shopCard(grid, `Sling Stones ×${AMMO_PACK}`, `${priceFor(gl, 10)}g · for slings`, () => buyAmmo(gl, 'stone'), gl.gold < priceFor(gl, 10));
    shopCard(grid, `Arrows ×${AMMO_PACK}`, `${priceFor(gl, 16)}g · for warbows`, () => buyAmmo(gl, 'arrow'), gl.gold < priceFor(gl, 16));
    const stock = el('p', 'stockinfo');
    stock.textContent = `Quiver: ${gl.stones} stones · ${gl.arrows} arrows`;
    wrap.appendChild(stock);
  } else {
    for (const it of shopItems(shopWhich)) {
      const owned = gl.owned.includes(it.id);
      const equipped = gl.equipped[it.slot as Slot] === it.id;
      const label = it.price === 0 ? 'starting kit' : equipped ? 'equipped' : owned ? 'equip' : `${priceFor(gl, it.price)}g · lvl ${it.gate}`;
      shopCard(grid, it.name, `${it.slot} · ${it.def !== undefined ? `def +${it.def}` : `dmg +${it.dmg}`} · ${label}`,
        () => buyItem(gl, it.id), (it.price > 0 && !owned && (gl.level < it.gate || gl.gold < priceFor(gl, it.price))), equipped);
    }
  }
  wrap.appendChild(grid);
  chromeEl.appendChild(wrap);
  buttonRow(actionsEl, 'BACK TO HUB', undefined, () => { shopMsg = null; mode = 'hub'; render(); }, false, 'Esc');
}

function shopCard(parent: HTMLElement, name: string, sub: string, onBuy: () => ShopMsg, disabled: boolean, active = false): void {
  const card = el('div', 'shopcard' + (active ? ' active' : ''));
  card.appendChild(el('div', 'cardname', name));
  card.appendChild(el('div', 'cardsub', sub));
  const b = el('button', 'buybtn', active ? 'WORN' : 'BUY');
  b.disabled = disabled;
  b.addEventListener('click', () => {
    sfx.preset('ui');
    shopMsg = onBuy();
    if (shopMsg && shopMsg.kind === 'ok') sfx.preset('coin');
    persistGame(st);
    render();
  });
  card.appendChild(b);
  parent.appendChild(card);
}

/* ---------------- settings + confirm overlay ---------------- */
function showSettings(): void {
  overlayEl.replaceChildren();
  const box = el('div', 'overlaybox');
  box.appendChild(el('h3', undefined, 'SETTINGS'));
  const volRow = el('div', 'dialrow');
  volRow.appendChild(el('span', 'diallabel', 'Volume'));
  const slider = el('input', 'dial') as HTMLInputElement;
  slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = String(Math.round(settings.volume * 100));
  slider.addEventListener('input', () => {
    settings.volume = Number(slider.value) / 100;
    sfx.volume = settings.volume;
    persistSettings(settings);
  });
  volRow.appendChild(slider);
  box.appendChild(volRow);
  const muteBtn = el('button', 'actionbtn wide', settings.muted ? 'SOUND: OFF' : 'SOUND: ON');
  muteBtn.addEventListener('click', () => {
    settings.muted = !settings.muted;
    sfx.setMuted(settings.muted);
    persistSettings(settings);
    muteBtn.textContent = settings.muted ? 'SOUND: OFF' : 'SOUND: ON';
  });
  box.appendChild(muteBtn);
  const close = el('button', 'actionbtn wide', 'CLOSE');
  close.addEventListener('click', () => { sfx.preset('ui'); overlayEl.classList.remove('show'); });
  box.appendChild(close);
  overlayEl.appendChild(box);
  overlayEl.classList.add('show');
}

function showCombatEscape(): void {
  overlayEl.replaceChildren();
  const box = el('div', 'overlaybox');
  box.appendChild(el('h3', undefined, 'RETREAT FROM THE BOUT?'));
  box.appendChild(el('p', undefined, 'Leaving mid-bout counts as surrender: you forfeit 25% of your purse but keep your health.'));
  const stay = el('button', 'actionbtn wide', 'KEEP FIGHTING');
  stay.addEventListener('click', () => { sfx.preset('ui'); overlayEl.classList.remove('show'); });
  const flee = el('button', 'actionbtn wide danger', 'SURRENDER & LEAVE');
  flee.addEventListener('click', () => {
    sfx.preset('ui');
    overlayEl.classList.remove('show');
    if (bout && bout.phase === 'player') doAction('surrender');
  });
  box.append(stay, flee);
  overlayEl.appendChild(box);
  overlayEl.classList.add('show');
}

/* ---------------- keyboard ---------------- */
document.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
  if (e.key === 'Escape') {
    if (overlayEl.classList.contains('show')) { overlayEl.classList.remove('show'); return; }
    if (mode === 'combat') { showCombatEscape(); return; }
    if (mode === 'shop') { mode = 'hub'; render(); return; }
    return;
  }
  if (mode === 'combat' && bout && bout.phase === 'player' && !overlayEl.classList.contains('show')) {
    const map: Record<string, PlayerAction> = {
      '1': 'quick', '2': 'power', '3': 'advance', '4': 'withdraw', '5': 'ranged',
      '6': 'ember', '7': 'mend', '8': 'warcry', '9': 'potion', '0': 'taunt',
    };
    const act = map[e.key];
    if (act) { e.preventDefault(); doAction(act); }
  } else if (e.key === 'Enter' && mode === 'title') {
    if (st.glad) { mode = 'hub'; render(); }
  } else if (e.key === 'Enter' && mode === 'hub' && st.defeated < BOUTS.length) {
    startFight();
  }
});

/* ---------------- audio unlock gesture ---------------- */
for (const evtName of ['pointerdown', 'keydown']) {
  document.addEventListener(evtName, () => {
    if (bed === 'none') setBed(mode === 'combat' ? 'combat' : mode === 'shop' ? 'shop' : 'menu');
  }, { once: true });
}

/* ---------------- boot + debug hooks ---------------- */
const muteBtn = document.querySelector<HTMLButtonElement>('#mute');
if (muteBtn) {
  muteBtn.textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON';
  muteBtn.addEventListener('click', () => {
    settings.muted = !settings.muted;
    sfx.setMuted(settings.muted);
    persistSettings(settings);
    muteBtn.textContent = settings.muted ? 'SOUND OFF' : 'SOUND ON';
  });
}

let lastFrame = performance.now();
function frame(t: number): void {
  const dt = Math.min(50, t - lastFrame);
  lastFrame = t;
  scene.frame(dt, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (location.search.includes('debug')) {
  (window as unknown as { __maga: unknown }).__maga = {
    get mode() { return mode; },
    get bout() { return st.defeated + 1; },
    get gold() { return st.glad?.gold ?? 0; },
    get xp() { return st.glad?.xp ?? 0; },
    get level() { return st.glad?.level ?? 0; },
    get stats() { return st.glad ? { ...statsTo6(st.glad.stats) } : null; },
    get crowd() { return bout?.crowd ?? 0; },
    get opponentHp() { return bout ? bout.enemy.hp : 0; },
    get name() { return st.glad?.name ?? null; },
    get ngPlus() { return st.ngPlus; },
    get potions() { return st.glad?.potions ?? 0; },
    get defeated() { return st.defeated; },
    get career() { return { ...st.career }; },
    get equipped() { return st.glad ? { ...st.glad.equipped } : null; },
    get boutPhase() { return bout?.phase ?? null; },
    get playerHp() { return bout?.player.hp ?? st.glad?.hp ?? 0; },
    get savePresent() { return loadStore<unknown>('swords-and-sandals', 'slot', null) !== null; },
  };
}

render();
