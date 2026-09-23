import { load, save } from '@maga/arcade-core';
import type { ContentPack } from './packs';

/**
 * Shared vertical-shmup simulation — ported 1:1 from
 * `prototypes/chicken-invaders.html` (maga-proto mechanics proof) with two
 * recorded defect fixes:
 *
 *  - P-1 (crash): proto `spawnWave()` referenced undeclared `ox/cw/oy/ch2`
 *    → ReferenceError on first startGame; the proto cannot boot. Formation
 *    geometry is declared here as tunables (FORM_CW/FORM_CH/FORM_OY, ox
 *    centered per wave).
 *  - P-2 (logic): proto boss radial telegraph fired the 12-egg radial every
 *    frame while `warn` decayed through a ~3-frame window (≈36 eggs). Here
 *    the radial fires exactly once when the telegraph expires.
 *
 * All combat constants are DECLARED GUESSES — dossier: every numeric is TBD
 * from ARCADE playtest. Renderer-agnostic: apps draw `sim` state via Pixi.
 */

export const STAGE_W = 960;
export const STAGE_H = 540;

// ---------------- tunables (ALL TBD from ARCADE playtest — declared, not measured) ----------------
export const DT = 1 / 120;
const SHIP_ACC = 2600, SHIP_DAMP = 7.5, SHIP_MAXV = 400;   // inertia / float feel
const SHIP_R = 13, SHIP_Y0 = STAGE_H - 60;
const FIRE_EVERY = 0.17, BULLET_V = -560, BULLET_DMG = 1;
const MISSILE_V = -330, MISSILE_DMG = 12, MISSILE_START = 2, MISSILE_CAP = 6;
const EGG_V = 170, EGG_R = 6;
const PICKUP_V = 95, GIFT_CHANCE = 0.12;
const LIVES_START = 3, RESPAWN_S = 1.2, INVULN_S = 2.0;    // spec #6: back in fight <=2s
const CHAPTER_CLEAR_S = 2.6;
// formation grid (P-1 fix — proto left these undeclared)
const FORM_CW = 72, FORM_CH = 56, FORM_OY = 70;

export interface WaveDef { pattern: 'straight' | 'swoop' | 'dive'; rows: number; cols: number; hp: number; eggEvery: number }

// chapter -> wave list; boss appended after last wave. rows/cols = formation grid.
const CHAPTERS: WaveDef[][] = [
  [{ pattern: 'straight', rows: 2, cols: 6, hp: 2, eggEvery: 2.4 },
   { pattern: 'swoop', rows: 2, cols: 6, hp: 2, eggEvery: 1.9 }],
  [{ pattern: 'dive', rows: 2, cols: 7, hp: 3, eggEvery: 1.7 },
   { pattern: 'swoop', rows: 3, cols: 6, hp: 3, eggEvery: 1.4 }],
];
const BOSS_HP = [60, 100];

// ---------------- entities ----------------
export interface Ship { x: number; y: number; vx: number; vy: number; alive: boolean; invuln: number }
export interface Chicken { bx: number; by: number; x: number; y: number; hp: number; dive: number; dvx: number; dvy: number; enter: number; type: number }
export interface Boss { x: number; y: number; hp: number; max: number; t: number; volley: number; radial: number; warn: number; radialArmed: boolean; type: number }
export interface Bullet { x: number; y: number; vx: number; vy: number }
export interface Missile { x: number; y: number; vy: number }
export interface Egg { x: number; y: number; vx: number; vy: number }
export interface Pickup { x: number; y: number; vy: number; kind: 'gift' | 'food' }
export interface Particle { x: number; y: number; vx: number; vy: number; s: number; life: number; col: number }
export interface Star { x: number; y: number; s: number; v: number }

export type SimMode = 'title' | 'play' | 'clear' | 'gameover' | 'win';
export type SimEvent =
  | 'shoot' | 'missile' | 'hit' | 'death' | 'pickup' | 'ui'
  | 'bossSpawn' | 'bossDown' | 'chapterClear' | 'gameOver' | 'win';

export interface DeathRecord { cause: string; x: number; y: number; t: number }

/** title hit regions (stage-space rects) — pack button dropped: each app is one pack */
export const BTN = {
  start: { x: STAGE_W / 2 - 110, y: 330, w: 220, h: 44 },
  ch1: { x: STAGE_W / 2 - 120, y: 284, w: 110, h: 32 },
  ch2: { x: STAGE_W / 2 + 10, y: 284, w: 110, h: 32 },
};
const inR = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
  x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

export class ShmupSim {
  readonly pack: ContentPack;
  readonly stars: Star[] = [];

  mode: SimMode = 'title';
  ship: Ship = { x: STAGE_W / 2, y: SHIP_Y0, vx: 0, vy: 0, alive: true, invuln: 0 };
  bullets: Bullet[] = [];
  missiles: Missile[] = [];
  eggs: Egg[] = [];
  pickups: Pickup[] = [];
  chickens: Chicken[] = [];
  boss: Boss | null = null;
  parts: Particle[] = [];

  chapter = 1;
  waveIdx = 0;
  score = 0;
  lives = LIVES_START;
  missileN = MISSILE_START;
  weaponLv = 0;
  killsInChapter = 0;
  unlocked: number;

  waveT = 0;
  eggT = 1.2;
  diveT = 1.5;
  clearT = 0;
  deadT = 0;
  jokeT = 0;
  paused = false;
  fireHeld = false;
  fireT = 0;
  lastDeath: DeathRecord | null = null;
  titleSel = 1;

  /** drained by the app each frame → SFX */
  events: SimEvent[] = [];

  constructor(pack: ContentPack, private game: string) {
    this.pack = pack;
    this.unlocked = load(game, 'chapter-unlocked', 1);
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random() * STAGE_W, y: Math.random() * STAGE_H, s: Math.random() * 2 + 0.5, v: 12 + Math.random() * 40 });
    }
  }

  // ---------------- title / flow input ----------------
  selectChapter(n: number): void {
    if (this.mode !== 'title') return;
    if (n === 1 || (n === 2 && this.unlocked >= 2)) { this.titleSel = n; this.events.push('ui'); }
  }

  startGame(ch: number): void {
    this.chapter = ch; this.waveIdx = 0; this.score = 0; this.lives = LIVES_START;
    this.missileN = MISSILE_START; this.weaponLv = 0; this.killsInChapter = 0;
    this.ship = { x: STAGE_W / 2, y: SHIP_Y0, vx: 0, vy: 0, alive: true, invuln: 0 };
    this.bullets = []; this.missiles = []; this.eggs = []; this.pickups = []; this.parts = [];
    this.boss = null; this.fireT = 0; this.deadT = 0; this.jokeT = 2.2;
    this.mode = 'play'; this.paused = false;
    this.spawnWave();
  }

  /** stage-space click on the title screen */
  titleClick(x: number, y: number): void {
    if (this.mode !== 'title') return;
    if (inR(x, y, BTN.ch1)) return this.selectChapter(1);
    if (inR(x, y, BTN.ch2)) return this.selectChapter(2);
    if (inR(x, y, BTN.start)) this.startGame(this.titleSel);
  }

  /** end screens (gameover/win): any confirm returns to title */
  confirmEnd(): void {
    if (this.mode === 'gameover' || this.mode === 'win') { this.mode = 'title'; this.events.push('ui'); }
  }
  get wavesTotal(): number { return CHAPTERS[this.chapter - 1].length; }

  togglePause(): void {
    if (this.mode === 'play') { this.paused = !this.paused; this.events.push('ui'); }
  }

  // ---------------- combat input ----------------
  /** movement intent, set by the app each frame; applied inside step() so
   *  accel is timestep-exact regardless of render rate */
  moveAxis = { x: 0, y: 0 };

  setFire(held: boolean): void { this.fireHeld = held; }

  fireMissile(): void {
    if (this.mode !== 'play' || this.paused || !this.ship.alive || this.missileN <= 0) return;
    this.missileN--;
    this.missiles.push({ x: this.ship.x, y: this.ship.y - 18, vy: MISSILE_V });
    this.events.push('missile');
  }

  // ---------------- spawning ----------------
  private spawnWave(): void {
    const w = CHAPTERS[this.chapter - 1][this.waveIdx];
    // P-1 fix: formation geometry declared (proto used undeclared ox/cw/oy/ch2)
    const cw = FORM_CW, ch2 = FORM_CH;
    const ox = (STAGE_W - (w.cols - 1) * cw) / 2;
    const oy = FORM_OY;
    this.chickens = []; this.waveT = 0; this.eggT = 1.2; this.diveT = 1.5;
    for (let r = 0; r < w.rows; r++) for (let c = 0; c < w.cols; c++) {
      const type = (r * w.cols + c) % this.pack.enemyTypes.length;
      const variant = this.pack.enemyTypes[type];
      this.chickens.push({
        bx: ox + c * cw, by: oy + r * ch2, x: ox + c * cw, y: -60 - r * 30,
        hp: Math.max(w.hp, variant.hp), dive: 0, dvx: 0, dvy: 0, enter: 1, type,
      });
    }
  }

  private spawnBoss(): void {
    const hp = BOSS_HP[this.chapter - 1];
    this.boss = { x: STAGE_W / 2, y: -80, hp, max: hp, t: 0, volley: 2.0, radial: 5.0, warn: 0, radialArmed: false, type: this.chapter - 1 };
    this.chickens = [];
    this.events.push('bossSpawn');
  }

  private burst(x: number, y: number, n: number, col: number): void {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x, y, vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420 - 80,
        s: 2 + Math.random() * 5, life: 0.4 + Math.random() * 0.5, col,
      });
    }
  }

  private dropPickup(x: number, y: number): void {
    this.killsInChapter++;
    let kind: Pickup['kind'] | null = null;
    if (this.killsInChapter === 1) kind = 'gift';        // deterministic: 1st kill = weapon cycle
    else if (this.killsInChapter === 2) kind = 'food';   // deterministic: 2nd kill = missile refill
    else if (Math.random() < GIFT_CHANCE) kind = Math.random() < 0.6 ? 'gift' : 'food';
    if (kind) this.pickups.push({ x, y, vy: PICKUP_V, kind });
  }

  private fireGuns(): void {
    const y = this.ship.y - 16, v = BULLET_V;
    if (this.weaponLv === 0) this.bullets.push({ x: this.ship.x, y, vx: 0, vy: v });
    else if (this.weaponLv === 1) {
      this.bullets.push({ x: this.ship.x - 9, y, vx: 0, vy: v }, { x: this.ship.x + 9, y, vx: 0, vy: v });
    } else {
      this.bullets.push(
        { x: this.ship.x, y, vx: 0, vy: v },
        { x: this.ship.x - 8, y, vx: -70, vy: v * 0.96 },
        { x: this.ship.x + 8, y, vx: 70, vy: v * 0.96 });
    }
    this.events.push('shoot');
  }

  private hitShip(cause: string): void {
    if (!this.ship.alive || this.ship.invuln > 0) return;
    this.ship.alive = false; this.deadT = 0; this.lives--;
    this.lastDeath = { cause, x: this.ship.x | 0, y: this.ship.y | 0, t: +this.waveT.toFixed(1) };
    this.burst(this.ship.x, this.ship.y, 30, this.pack.ship);
    this.events.push('death');
  }

  private killChicken(c: Chicken): void {
    this.burst(c.x, c.y, 16, this.pack.foe);
    this.score += 100;
    this.dropPickup(c.x, c.y);
    this.events.push('hit');
  }

  // ---------------- fixed-step simulation ----------------
  step(dt: number): void {
    // chapter-clear countdown runs even while 'clear' freezes the field
    if (this.mode === 'clear') {
      this.clearT += dt;
      if (this.clearT >= CHAPTER_CLEAR_S) {
        this.chapter++; this.waveIdx = 0; this.killsInChapter = 0; this.jokeT = 2.2;
        this.mode = 'play'; this.spawnWave();
      }
      return;
    }
    if (this.mode !== 'play' || this.paused) return;
    this.waveT += dt;
    for (const s of this.stars) { s.y += s.v * dt; if (s.y > STAGE_H) { s.y = -2; s.x = Math.random() * STAGE_W; } }

    // ship: inertial movement (feel target: float, not tank)
    if (this.ship.alive) {
      this.ship.vx += this.moveAxis.x * SHIP_ACC * dt;
      this.ship.vy += this.moveAxis.y * SHIP_ACC * dt;
      this.ship.vx -= this.ship.vx * SHIP_DAMP * dt;
      this.ship.vy -= this.ship.vy * SHIP_DAMP * dt;
      this.ship.vx = Math.max(-SHIP_MAXV, Math.min(SHIP_MAXV, this.ship.vx));
      this.ship.vy = Math.max(-SHIP_MAXV, Math.min(SHIP_MAXV, this.ship.vy));
      this.ship.x = Math.max(20, Math.min(STAGE_W - 20, this.ship.x + this.ship.vx * dt));
      this.ship.y = Math.max(STAGE_H - 220, Math.min(STAGE_H - 30, this.ship.y + this.ship.vy * dt));
      this.ship.invuln = Math.max(0, this.ship.invuln - dt);
      this.fireT -= dt;
      if (this.fireHeld && this.fireT <= 0) { this.fireGuns(); this.fireT = FIRE_EVERY; }
    } else {
      this.deadT += dt;
      if (this.deadT >= RESPAWN_S) {
        if (this.lives > 0) {
          this.ship.alive = true; this.ship.x = STAGE_W / 2; this.ship.y = SHIP_Y0;
          this.ship.vx = this.ship.vy = 0; this.ship.invuln = INVULN_S;
        } else { this.mode = 'gameover'; this.events.push('gameOver'); return; }
      }
    }
    this.jokeT = Math.max(0, this.jokeT - dt);

    // chickens: formation patterns (Galaxian-ish, readable — not danmaku)
    // P-3 fix: during the boss phase waveIdx runs past the wave list —
    // wdef is undefined (proto crashed here too; its boss was unreachable).
    const wdef = CHAPTERS[this.chapter - 1][Math.min(this.waveIdx, CHAPTERS[this.chapter - 1].length - 1)];
    for (const c of this.chickens) {
      if (this.pack.enemyTypes[c.type].speed <= 0) continue;
      if (c.enter) { // fly-in
        c.y += (c.by - c.y) * Math.min(1, 3 * dt) + 40 * dt;
        if (Math.abs(c.y - c.by) < 4) { c.y = c.by; c.enter = 0; }
        c.x = c.bx; continue;
      }
      if (c.dive) { // diving at ship
        c.x += c.dvx * dt; c.y += c.dvy * dt;
        if (c.y > STAGE_H + 30) { c.dive = 0; c.y = -40; c.enter = 1; }
        continue;
      }
      if (wdef.pattern === 'straight') {
        const motionT = this.waveT * this.pack.enemyTypes[c.type].speed;
        c.x = c.bx + Math.sin(motionT * 0.7) * 130;
        c.y = c.by + motionT * 4;
      } else if (wdef.pattern === 'swoop') {
        const motionT = this.waveT * this.pack.enemyTypes[c.type].speed;
        c.x = c.bx + Math.sin(motionT * 1.1 + c.bx * 0.01) * 170;
        c.y = c.by + Math.sin(motionT * 0.9 + c.bx * 0.02) * 36 + motionT * 6;
      } else { // dive formation: mild sway; individuals peel off
        const motionT = this.waveT * this.pack.enemyTypes[c.type].speed;
        c.x = c.bx + Math.sin(motionT * 0.5) * 70;
        c.y = c.by + motionT * 3;
      }
    }
    // dive scheduler
    if (wdef.pattern === 'dive') {
      this.diveT -= dt;
      if (this.diveT <= 0) {
        const cand = this.chickens.filter(c => !c.dive && !c.enter);
        if (cand.length) {
          const c = cand[(Math.random() * cand.length) | 0];
          c.dive = 1;
          const dx = this.ship.x - c.x, dy = this.ship.y - c.y, d = Math.hypot(dx, dy) || 1;
          const sp = 240; c.dvx = dx / d * sp; c.dvy = Math.max(160, dy / d * sp);
        }
        this.diveT = 1.4 + Math.random();
      }
    }
    // egg drops (aimed-ish, readable speed)
    this.eggT -= dt;
    if (this.eggT <= 0 && this.chickens.length) {
      const c = this.chickens[(Math.random() * this.chickens.length) | 0];
      if (!c.enter && c.y < this.ship.y - 40) {
        const dx = this.ship.x - c.x, dy = this.ship.y - c.y, d = Math.hypot(dx, dy) || 1;
        const spread = (Math.random() - 0.5) * 0.35;
        this.eggs.push({ x: c.x, y: c.y + 12, vx: (dx / d + spread) * EGG_V * 0.5, vy: EGG_V });
      }
      this.eggT = wdef.eggEvery * (0.7 + Math.random() * 0.6);
    }
    // wave cleared?
    if (!this.chickens.length && !this.boss) {
      this.waveIdx++;
      if (this.waveIdx < CHAPTERS[this.chapter - 1].length) this.spawnWave();
      else this.spawnBoss();
    }

    if (this.boss) {
      const boss = this.boss;
      boss.t += dt;
      boss.y += (110 - boss.y) * Math.min(1, 1.5 * dt);
      boss.x = STAGE_W / 2 + Math.sin(boss.t * 0.7) * 240;
      boss.volley -= dt; boss.radial -= dt; boss.warn = Math.max(0, boss.warn - dt);
      if (boss.volley <= 0) { // aimed 3-egg volley
        for (let i = -1; i <= 1; i++) {
          const dx = this.ship.x - boss.x, dy = this.ship.y - boss.y, d = Math.hypot(dx, dy) || 1;
          this.eggs.push({ x: boss.x, y: boss.y + 30, vx: dx / d * EGG_V * 0.6 + i * 60, vy: EGG_V * 1.05 });
        }
        boss.volley = 2.4;
      }
      if (boss.radial <= 0) { boss.warn = 0.7; boss.radial = 6.0; boss.radialArmed = true; }
      // P-2 fix: radial fires exactly once when the telegraph expires
      // (proto re-fired every frame inside a ~3-frame window → ~36 eggs).
      if (boss.radialArmed && boss.warn <= 0) {
        boss.radialArmed = false;
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          this.eggs.push({
            x: boss.x, y: boss.y + 20,
            vx: Math.cos(a) * EGG_V * 0.7,
            vy: Math.abs(Math.sin(a)) * EGG_V * 0.7 + 60,
          });
        }
      }
      if (boss.hp <= 0) {
        this.burst(boss.x, boss.y, 60, this.pack.foe2); this.score += 1000; this.boss = null;
        this.unlocked = Math.max(this.unlocked, Math.min(2, this.chapter + 1));
        save(this.game, 'chapter-unlocked', this.unlocked);
        this.mode = this.chapter >= 2 ? 'win' : 'clear'; this.clearT = 0;
        this.events.push(this.mode === 'win' ? 'win' : 'chapterClear');
        this.events.push('bossDown');
      }
    }

    // projectiles
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const m of this.missiles) m.y += m.vy * dt;
    for (const e of this.eggs) { e.x += e.vx * dt; e.y += e.vy * dt; }
    for (const p of this.pickups) p.y += p.vy * dt;
    this.bullets = this.bullets.filter(b => b.y > -20 && b.x > -20 && b.x < STAGE_W + 20);
    this.missiles = this.missiles.filter(m => m.y > -40);
    this.eggs = this.eggs.filter(e => e.y < STAGE_H + 20 && e.x > -20 && e.x < STAGE_W + 20);
    this.pickups = this.pickups.filter(p => p.y < STAGE_H + 20);

    // bullet/missile vs chickens
    const hitC = (b: { x: number; y: number }, dmg: number): boolean => {
      for (const c of this.chickens) {
        if (Math.abs(b.x - c.x) < 24 && Math.abs(b.y - c.y) < 18) {
          c.hp -= dmg; this.burst(b.x, b.y, 4, this.pack.foe);
          if (c.hp <= 0) { this.killChicken(c); this.chickens = this.chickens.filter(k => k !== c); }
          return true;
        }
      }
      return false;
    };
    this.bullets = this.bullets.filter(b => !hitC(b, BULLET_DMG));
    this.missiles = this.missiles.filter(m => !hitC(m, MISSILE_DMG));
    // vs boss
    if (this.boss) {
      const boss = this.boss;
      const hitB = (b: { x: number; y: number }) => Math.abs(b.x - boss.x) < 56 && Math.abs(b.y - boss.y) < 40;
      for (const b of this.bullets) if (hitB(b)) { boss.hp -= BULLET_DMG; b.y = -99; this.burst(b.x, b.y, 3, this.pack.foe2); }
      for (const m of this.missiles) if (hitB(m)) { boss.hp -= MISSILE_DMG; m.y = -99; this.burst(m.x, m.y, 12, this.pack.foe2); }
      this.bullets = this.bullets.filter(b => b.y > -20);
      this.missiles = this.missiles.filter(m => m.y > -40);
      // boss body collision
      if (this.ship.alive && this.ship.invuln <= 0 && Math.abs(this.ship.x - boss.x) < 50 && Math.abs(this.ship.y - boss.y) < 36) this.hitShip('boss');
    }
    // chicken body collision
    if (this.ship.alive && this.ship.invuln <= 0) {
      for (const c of this.chickens) {
        if (Math.abs(this.ship.x - c.x) < 26 && Math.abs(this.ship.y - c.y) < 20) { this.hitShip('chicken'); break; }
      }
    }
    // eggs vs ship
    if (this.ship.alive && this.ship.invuln <= 0) {
      for (const e of this.eggs) {
        if (Math.hypot(e.x - this.ship.x, e.y - this.ship.y) < SHIP_R + EGG_R) { this.hitShip('egg'); e.y = STAGE_H + 99; break; }
      }
    }
    // pickups vs ship
    if (this.ship.alive) {
      for (const p of this.pickups) {
        if (Math.abs(p.x - this.ship.x) < 26 && Math.abs(p.y - this.ship.y) < 22) {
          p.y = STAGE_H + 99; this.score += 50;
          if (p.kind === 'gift') this.weaponLv = (this.weaponLv + 1) % this.pack.weapons.length; // cycle/upgrade
          else this.missileN = Math.min(MISSILE_CAP, this.missileN + 1);
          this.events.push('pickup');
        }
      }
    }
    this.pickups = this.pickups.filter(p => p.y < STAGE_H + 20);

    // particles
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
  }

  /** PROOF/debug snapshot — same shape as the proto's `window.__proto` */
  snapshot(): Record<string, unknown> {
    return {
      mode: this.mode, pack: this.pack.id, chapter: this.chapter,
      wave: this.waveIdx + 1, wavesTotal: CHAPTERS[this.chapter - 1].length,
      score: this.score, lives: this.lives, missiles: this.missileN,
      weapon: this.weaponLv, weaponName: this.pack.weapons[this.weaponLv],
      shipX: this.ship.x, shipY: this.ship.y, shipAlive: this.ship.alive, invuln: this.ship.invuln,
      chickens: this.chickens.map(c => ({ x: c.x, y: c.y, hp: c.hp, dive: !!c.dive })),
      eggs: this.eggs.length,
      pickups: this.pickups.map(p => ({ x: p.x, y: p.y, kind: p.kind })),
      bossHp: this.boss ? this.boss.hp : null, bossMax: this.boss ? this.boss.max : null,
      bossX: this.boss ? this.boss.x : null, bossWarn: this.boss ? this.boss.warn : 0,
      unlocked: this.unlocked, paused: this.paused,
      kills: this.killsInChapter, titleSel: this.titleSel, lastDeath: this.lastDeath,
    };
  }
}
