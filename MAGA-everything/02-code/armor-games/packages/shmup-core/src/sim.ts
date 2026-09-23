import { load, save } from '@maga/arcade-core';
import type { BossType, ContentPack, WaveSpec } from './packs';

/**
 * Shared vertical-shmup simulation — one engine, pack-driven campaigns.
 * The replica pack (GALACTIC CHICKEN: NEXT WAVE) runs a 10-chapter solar
 * arc (110 waves); the cluck pack (CLUCK HORIZON) runs 3 sectors. All
 * content — wave tables, boss patterns, weapon ladders, strings — comes
 * from the ContentPack; this file is pure mechanics.
 */

export const STAGE_W = 960;
export const STAGE_H = 540;

export const DT = 1 / 120;

// ---------------- tunables ----------------
const SHIP_ACC = 2600, SHIP_DAMP = 7.5, SHIP_MAXV = 400;
const SHIP_R = 13, SHIP_Y0 = STAGE_H - 60;
const BULLET_V = -560;
const MISSILE_V = -330, MISSILE_DMG = 14, MISSILE_R = 105, MISSILE_FUSE_Y = 26;
const MISSILE_START = 3, MISSILE_CAP = 9;
const EGG_V = 172, EGG_V_PER_CHAPTER = 6, EGG_V_CAP = 238, EGG_R = 6;
const PICKUP_V = 95;
const LIVES_START = 3, RESPAWN_S = 1.1, INVULN_S = 2.0;
const FOOD_PER_LIFE = 8, GIFT_MAX_PTS = 500;
const GIFT_CHANCE = 0.11, FOOD_CHANCE = 0.13, MISSILE_DROP_CHANCE = 0.05;
const CHAPTER_CLEAR_S = 2.6, BOSS_INTRO_S = 2.4;
const FORM_CW = 72, FORM_CH = 54, FORM_OY = 64;
const MAX_EGGS = 90, MAX_MINIONS = 14;
const SWOOP_T = 1.15;

// ---------------- entities ----------------
export interface Ship { x: number; y: number; vx: number; vy: number; alive: boolean; invuln: number }
export interface Chicken {
  bx: number; by: number; x: number; y: number;
  hp: number; hpMax: number;
  dive: number; dvx: number; dvy: number;
  enter: number; t: number; type: number;
  /** swoop entry side: -1 from left, 1 from right, 0 = descend */
  side: number;
}
export interface Boss {
  x: number; y: number; hp: number; max: number; t: number;
  def: BossType; typeIdx: number;
  intro: number; volley: number; alt: number; warn: number; armed: boolean;
  burstN: number; burstT: number; minionT: number; wallGap: number;
  phase: number; phaseFlash: number;
}
export interface Bullet { x: number; y: number; vx: number; vy: number }
export interface Missile { x: number; y: number; vy: number }
export interface Egg { x: number; y: number; vx: number; vy: number }
export interface Pickup { x: number; y: number; vy: number; kind: 'gift' | 'food' | 'missile' }
export interface Particle { x: number; y: number; vx: number; vy: number; s: number; life: number; col: number }
export interface Star { x: number; y: number; s: number; v: number }

export type SimMode = 'title' | 'play' | 'clear' | 'gameover' | 'win';
export type SimEvent =
  | 'shoot' | 'missile' | 'hit' | 'death' | 'pickup' | 'ui'
  | 'gift' | 'food' | 'extraLife' | 'explode'
  | 'bossSpawn' | 'bossPhase' | 'bossDown' | 'chapterClear' | 'gameOver' | 'win';

export interface DeathRecord { cause: string; x: number; y: number; t: number }
export interface Toast { msg: string; t: number }

export interface Rect { x: number; y: number; w: number; h: number }

/** title-screen START button (chapter chips are computed per pack length) */
export const BTN = { start: { x: STAGE_W / 2 - 110, y: 356, w: 220, h: 44 } as Rect };

const CHIP_W = 150, CHIP_H = 30, CHIP_GAP = 8, CHIP_COLS = 5;

/** title-screen chapter chip rect — grid of 5 columns, centered rows */
export function chapterChipRect(i: number, total: number): Rect {
  const row = Math.floor(i / CHIP_COLS);
  const col = i % CHIP_COLS;
  const rowCols = Math.min(CHIP_COLS, total - row * CHIP_COLS);
  const rowW = rowCols * CHIP_W + (rowCols - 1) * CHIP_GAP;
  return { x: (STAGE_W - rowW) / 2 + col * (CHIP_W + CHIP_GAP), y: 244 + row * (CHIP_H + CHIP_GAP), w: CHIP_W, h: CHIP_H };
}

const inR = (x: number, y: number, r: Rect) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

/** deterministic per-wave rng — stable layouts across runs/boots */
function waveRng(chapter: number, wave: number): () => number {
  let s = (chapter * 7349 + wave * 131 + 17) >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 4294967296;
  };
}

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
  high: number;
  lives = LIVES_START;
  missileN = MISSILE_START;
  /** 0-based index into pack.weapons; power level = weaponLv + 1 */
  weaponLv = 0;
  foodCount = 0;
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
  toast: Toast | null = null;
  lastDeath: DeathRecord | null = null;
  titleSel = 1;

  /** drained by the app each frame → SFX */
  events: SimEvent[] = [];

  constructor(pack: ContentPack, private game: string) {
    this.pack = pack;
    const rawUnlocked = load(game, 'chapter-unlocked', 1);
    this.unlocked = Number.isInteger(rawUnlocked) && rawUnlocked >= 1 && rawUnlocked <= pack.chapters.length ? rawUnlocked : 1;
    this.high = load(game, 'highscore', 0);
    this.titleSel = Math.min(this.unlocked, pack.chapters.length);
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random() * STAGE_W, y: Math.random() * STAGE_H, s: Math.random() * 2 + 0.5, v: 12 + Math.random() * 40 });
    }
  }

  // ---------------- campaign accessors ----------------
  get chapterDef() { return this.pack.chapters[this.chapter - 1]; }
  get chaptersTotal() { return this.pack.chapters.length; }
  get wavesTotal() { return this.chapterDef.waves.length; }
  get weaponName() { return this.pack.weapons[this.weaponLv].name; }

  // ---------------- title / flow input ----------------
  selectChapter(n: number): void {
    if (this.mode !== 'title') return;
    if (n >= 1 && n <= this.chaptersTotal && n <= this.unlocked && n !== this.titleSel) {
      this.titleSel = n;
      this.events.push('ui');
    }
  }

  /** arrows on the title: step the chapter selection within unlocked range */
  moveChapterSel(dir: number): void {
    if (this.mode !== 'title') return;
    const n = Math.max(1, Math.min(Math.min(this.unlocked, this.chaptersTotal), this.titleSel + dir));
    if (n !== this.titleSel) { this.titleSel = n; this.events.push('ui'); }
  }

  startGame(ch: number): void {
    this.chapter = Math.max(1, Math.min(ch, this.unlocked));
    this.waveIdx = 0; this.score = 0; this.lives = LIVES_START;
    this.missileN = MISSILE_START; this.weaponLv = 0; this.foodCount = 0;
    this.killsInChapter = 0;
    this.ship = { x: STAGE_W / 2, y: SHIP_Y0, vx: 0, vy: 0, alive: true, invuln: 0 };
    this.bullets = []; this.missiles = []; this.eggs = []; this.pickups = []; this.parts = [];
    this.boss = null; this.fireT = 0; this.deadT = 0;
    this.jokeT = 2.6; this.toast = { msg: `CHAPTER ${this.chapter} — ${this.chapterDef.name}`, t: 2.4 };
    this.mode = 'play'; this.paused = false;
    this.spawnWave();
  }

  /** stage-space click on the title screen */
  titleClick(x: number, y: number): void {
    if (this.mode !== 'title') return;
    for (let i = 0; i < this.chaptersTotal; i++) {
      if (inR(x, y, chapterChipRect(i, this.chaptersTotal))) return this.selectChapter(i + 1);
    }
    if (inR(x, y, BTN.start)) this.startGame(this.titleSel);
  }

  /** end screens: win → title; game over → continue from chapter start (spec) */
  confirmEnd(): void {
    if (this.mode === 'win') { this.persistHigh(); this.mode = 'title'; this.events.push('ui'); }
    else if (this.mode === 'gameover') { this.persistHigh(); this.startGame(this.chapter); }
  }

  /** abandon a run: pause menu Q, game-over Esc — back to the title */
  quitToTitle(): void {
    if (this.mode === 'gameover' || this.mode === 'win') this.persistHigh();
    if (this.mode !== 'title') { this.mode = 'title'; this.paused = false; this.events.push('ui'); }
  }

  togglePause(): void {
    if (this.mode === 'play') { this.paused = !this.paused; this.events.push('ui'); }
  }

  persistHigh(): void {
    if (this.score > this.high) { this.high = this.score; save(this.game, 'highscore', this.high); }
  }

  // ---------------- combat input ----------------
  moveAxis = { x: 0, y: 0 };

  setFire(held: boolean): void { this.fireHeld = held; }

  fireMissile(): void {
    if (this.mode !== 'play' || this.paused || !this.ship.alive || this.missileN <= 0) return;
    this.missileN--;
    this.missiles.push({ x: this.ship.x, y: this.ship.y - 18, vy: MISSILE_V });
    this.events.push('missile');
  }

  // ---------------- spawning ----------------
  private eggV(): number {
    return Math.min(EGG_V_CAP, EGG_V + (this.chapter - 1) * EGG_V_PER_CHAPTER);
  }

  private spawnWave(): void {
    const w = this.chapterDef.waves[this.waveIdx] as WaveSpec;
    const ox = (STAGE_W - (w.cols - 1) * FORM_CW) / 2;
    const rng = waveRng(this.chapter, this.waveIdx);
    const total = this.chapterDef.mix[0] + this.chapterDef.mix[1] + this.chapterDef.mix[2];
    this.chickens = []; this.waveT = 0; this.eggT = 1.1; this.diveT = 1.4;
    for (let r = 0; r < w.rows; r++) {
      for (let c = 0; c < w.cols; c++) {
        const roll = rng() * total;
        const type = roll < this.chapterDef.mix[0] ? 0 : roll < this.chapterDef.mix[0] + this.chapterDef.mix[1] ? 1 : 2;
        const variant = this.pack.enemyTypes[type];
        // type hp stays distinct (HEN/SCOUT/ACE); wave bonus adds on top
        const hp = Math.max(1, variant.hp + w.hp - 2);
        const bx = ox + c * FORM_CW, by = FORM_OY + r * FORM_CH;
        const swoop = w.pattern === 'swoop';
        this.chickens.push({
          bx, by, x: swoop ? 0 : bx, y: swoop ? by + 90 : -60 - r * 30,
          hp, hpMax: hp, dive: 0, dvx: 0, dvy: 0, enter: 1, t: 0, type,
          side: swoop ? ((r + c) % 2 === 0 ? -1 : 1) : 0,
        });
      }
    }
  }

  private spawnBoss(): void {
    const def = this.chapterDef.boss;
    this.boss = {
      x: STAGE_W / 2, y: -90, hp: def.hp, max: def.hp, t: 0,
      def, typeIdx: this.chapter - 1,
      intro: BOSS_INTRO_S, volley: 1.4, alt: 3.0, warn: 0, armed: false,
      burstN: 0, burstT: 0, minionT: 2.5, wallGap: 0,
      phase: 1, phaseFlash: 0,
    };
    this.chickens = [];
    this.toast = { msg: `WARNING! ${def.name}`, t: BOSS_INTRO_S };
    this.events.push('bossSpawn');
  }

  /** summoned minions dive straight from the boss body */
  private summonMinion(boss: Boss): void {
    if (this.chickens.length >= MAX_MINIONS) return;
    let type = 0; // the fastest archetype makes the best dive minion
    for (let i = 1; i < this.pack.enemyTypes.length; i++) {
      if (this.pack.enemyTypes[i].speed > this.pack.enemyTypes[type].speed) type = i;
    }
    const variant = this.pack.enemyTypes[type];
    const hp = variant.hp;
    const dx = this.ship.x - boss.x, dy = this.ship.y - boss.y, d = Math.hypot(dx, dy) || 1;
    const sp = 250;
    this.chickens.push({
      bx: boss.x, by: 90, x: boss.x, y: boss.y + 20, hp, hpMax: hp,
      dive: 1, dvx: dx / d * sp, dvy: Math.max(170, dy / d * sp),
      enter: 0, t: 0, type, side: 0,
    });
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
    if (this.killsInChapter === 1) kind = 'gift';       // deterministic: 1st kill = power up
    else if (this.killsInChapter === 2) kind = 'food';  // deterministic: 2nd kill = food
    else {
      const r = Math.random();
      if (r < GIFT_CHANCE) kind = 'gift';
      else if (r < GIFT_CHANCE + FOOD_CHANCE) kind = 'food';
      else if (r < GIFT_CHANCE + FOOD_CHANCE + MISSILE_DROP_CHANCE) kind = 'missile';
    }
    if (kind) this.pickups.push({ x, y, vy: PICKUP_V, kind });
  }

  private fireGuns(): void {
    const w = this.pack.weapons[this.weaponLv];
    const y = this.ship.y - 16, v = BULLET_V;
    if (w.spread <= 0 && w.n <= 2) {
      // parallel battery
      for (let i = 0; i < w.n; i++) {
        this.bullets.push({ x: this.ship.x + (w.n === 1 ? 0 : i === 0 ? -9 : 9), y, vx: 0, vy: v });
      }
    } else {
      // fan: symmetric angles around straight-up (vx = sin(a)·|v|, vy = cos(a)·v)
      const half = (w.n - 1) / 2;
      for (let i = 0; i < w.n; i++) {
        const a = ((i - half) * w.spread * Math.PI) / 180;
        this.bullets.push({ x: this.ship.x + (i - half) * 5, y, vx: Math.sin(a) * -v, vy: Math.cos(a) * v });
      }
    }
    this.events.push('shoot');
  }

  /** push an egg if the field cap allows (danmaku safety) */
  private egg(x: number, y: number, vx: number, vy: number): void {
    if (this.eggs.length < MAX_EGGS) this.eggs.push({ x, y, vx, vy });
  }

  private aimedEgg(x: number, y: number, speed: number, offDeg = 0): void {
    const dx = this.ship.x - x, dy = this.ship.y - y, d = Math.hypot(dx, dy) || 1;
    const a = Math.atan2(dy, dx) + (offDeg * Math.PI) / 180;
    this.egg(x, y, Math.cos(a) * speed, Math.sin(a) * speed);
  }

  private hitShip(cause: string): void {
    if (!this.ship.alive || this.ship.invuln > 0) return;
    this.ship.alive = false; this.deadT = 0; this.lives--;
    this.weaponLv = Math.max(0, this.weaponLv - 1); // lose ONE power level, not all
    this.lastDeath = { cause, x: this.ship.x | 0, y: this.ship.y | 0, t: +this.waveT.toFixed(1) };
    this.burst(this.ship.x, this.ship.y, 30, this.pack.ship);
    this.events.push('death');
  }

  /** D-43: per-type score scaled by spawn hp */
  private killChicken(c: Chicken): void {
    const variant = this.pack.enemyTypes[c.type];
    this.burst(c.x, c.y, 16, this.pack.foe);
    this.score += Math.round((variant.score * c.hpMax) / variant.hp / 10) * 10;
    this.dropPickup(c.x, c.y);
    this.events.push('hit');
  }

  /** D-42: a speed<=0 enemy is fully frozen — no motion, no eggs, no body
   *  collision, and it never blocks wave clear (it stays shootable). */
  private frozen(c: Chicken): boolean {
    return this.pack.enemyTypes[c.type].speed <= 0;
  }

  private explodeMissile(x: number, y: number): void {
    this.burst(x, y, 26, 0xffd43b);
    this.events.push('explode');
    for (const c of this.chickens) {
      if (Math.hypot(c.x - x, c.y - y) < MISSILE_R) {
        c.hp -= MISSILE_DMG;
        if (c.hp <= 0) { this.killChicken(c); this.chickens = this.chickens.filter(k => k !== c); }
      }
    }
    if (this.boss && Math.hypot(this.boss.x - x, this.boss.y - y) < MISSILE_R + 30) {
      this.boss.hp -= MISSILE_DMG;
    }
  }

  // ---------------- boss patterns ----------------
  private stepBoss(dt: number): void {
    const b = this.boss!;
    const def = b.def;
    const v = this.eggV();
    b.t += dt;
    b.warn = Math.max(0, b.warn - dt);
    b.phaseFlash = Math.max(0, b.phaseFlash - dt);

    // intro: descend into the arena, telegraph the name — no fire
    if (b.intro > 0) {
      b.intro -= dt;
      b.y += (110 - b.y) * Math.min(1, 1.6 * dt);
      b.x = STAGE_W / 2;
      return;
    }

    // mothership phase tracking (multi-phase final boss)
    let pattern = def.pattern;
    if (pattern === 'mothership') {
      const ratio = b.hp / b.max;
      const phase = ratio > 2 / 3 ? 1 : ratio > 1 / 3 ? 2 : 3;
      if (phase !== b.phase) {
        b.phase = phase; b.phaseFlash = 0.7;
        this.burst(b.x, b.y, 24, this.pack.foe2);
        this.events.push('bossPhase');
      }
    }

    // movement per pattern
    if (pattern === 'sweep') {
      b.x = STAGE_W / 2 + Math.sin(b.t * 1.7) * 330;
      b.y += (110 - b.y) * Math.min(1, 2 * dt);
    } else if (pattern === 'bouncer') {
      b.x = STAGE_W / 2 + Math.sin(b.t * 0.9) * 260;
      b.y = 110 + (Math.sin(b.t * 1.1) * 0.5 + 0.5) * 190;
    } else if (pattern === 'rising') {
      // inflates downward as it takes damage — rising pressure
      const target = 110 + (1 - b.hp / b.max) * 170;
      b.y += (target - b.y) * Math.min(1, 1.2 * dt);
      b.x = STAGE_W / 2 + Math.sin(b.t * 0.8) * 200;
    } else {
      const rate = pattern === 'mothership' && b.phase === 3 ? 1.15 : 0.7;
      b.x = STAGE_W / 2 + Math.sin(b.t * rate) * 240;
      b.y += (110 - b.y) * Math.min(1, 1.5 * dt);
    }

    const mothershipMode = def.pattern === 'mothership'
      ? (b.phase === 1 ? 'fan+aimed' : b.phase === 2 ? 'spiral+summon' : 'wall+nova')
      : def.pattern;

    // primary attack
    b.volley -= dt;
    if (b.volley <= 0) {
      switch (mothershipMode) {
        case 'fan':
        case 'fan+aimed': {
          for (let i = -2; i <= 2; i++) this.aimedEgg(b.x, b.y + 30, v * 0.78, i * 17);
          b.volley = b.phase === 3 ? 1.6 : 2.1;
          break;
        }
        case 'aimed':
        case 'spiral+summon': {
          if (mothershipMode === 'spiral+summon') { this.aimedEgg(b.x, b.y + 30, v, 0); b.volley = 1.9; break; }
          b.burstN = 3; b.burstT = 0; b.volley = 1.7; // burst handled below
          break;
        }
        case 'cross': {
          for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
            const d = Math.hypot(dx, dy);
            this.egg(b.x, b.y, (dx / d) * v * 0.6, (dy / d) * v * 0.6);
            this.egg(b.x, b.y, (dx / d) * v * 0.95, (dy / d) * v * 0.95);
          }
          b.volley = 2.3;
          break;
        }
        case 'sweep': {
          this.aimedEgg(b.x, b.y + 30, v, -8);
          this.aimedEgg(b.x, b.y + 30, v, 8);
          b.volley = 2.8;
          break;
        }
        case 'bouncer': {
          for (let i = -1; i <= 1; i++) this.aimedEgg(b.x, b.y + 30, v * 0.85, i * 14);
          b.volley = 0.55;
          break;
        }
        case 'nova': {
          for (let i = -1; i <= 1; i++) this.aimedEgg(b.x, b.y + 30, v * 1.05, i * 10);
          b.volley = 2.0;
          break;
        }
        case 'wall':
        case 'wall+nova': {
          this.aimedEgg(b.x, b.y + 30, v, 0);
          b.volley = mothershipMode === 'wall' ? 2.6 : 1.8;
          break;
        }
        case 'summon': {
          this.aimedEgg(b.x, b.y + 30, v * 0.9, 0);
          b.volley = 2.2;
          break;
        }
        default: b.volley = 2.0;
      }
    }

    // aimed burst rounds (TIDE ROOSTER etc.)
    if (b.burstN > 0) {
      b.burstT -= dt;
      if (b.burstT <= 0) {
        this.aimedEgg(b.x, b.y + 30, this.eggV() * 1.05);
        b.burstN--; b.burstT = 0.11;
      }
    }

    // secondary attack
    b.alt -= dt;
    if (b.alt <= 0) {
      switch (mothershipMode) {
        case 'spiral': {
          const base = b.t * 2.4;
          for (let k = 0; k < 3; k++) {
            const a = base + (k * 2 * Math.PI) / 3;
            this.egg(b.x, b.y + 20, Math.cos(a) * v * 0.72, Math.abs(Math.sin(a)) * v * 0.72 + 50);
          }
          b.alt = 0.18;
          break;
        }
        case 'sweep': {
          this.egg(b.x, b.y + 26, 0, v * 0.85); // rain trail while strafing
          b.alt = 0.24;
          break;
        }
        case 'summon': {
          this.summonMinion(b); this.summonMinion(b); this.summonMinion(b);
          b.alt = 5.0;
          break;
        }
        case 'spiral+summon': {
          const base = b.t * 2.6;
          for (let k = 0; k < 3; k++) {
            const a = base + (k * 2 * Math.PI) / 3;
            this.egg(b.x, b.y + 20, Math.cos(a) * v * 0.75, Math.abs(Math.sin(a)) * v * 0.75 + 55);
          }
          b.alt = 0.2;
          break;
        }
        case 'rising': {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            this.egg(b.x, b.y + 16, Math.cos(a) * v * 0.66, Math.abs(Math.sin(a)) * v * 0.66 + 45);
          }
          b.alt = 2.6;
          break;
        }
        case 'wall':
        case 'wall+nova': {
          // telegraphed full-width wall with one gap
          b.warn = 0.75; b.armed = true;
          b.wallGap = 1 + Math.floor(Math.random() * 11);
          b.alt = mothershipMode === 'wall' ? 3.4 : 3.0;
          break;
        }
        case 'nova': {
          b.warn = 0.7; b.armed = true; b.alt = 5.5;
          break;
        }
        default: b.alt = 4.0;
      }
    }

    // summon cadence runs on its own timer so it can stack with spirals
    if (mothershipMode === 'summon' || mothershipMode === 'spiral+summon') {
      b.minionT -= dt;
      if (b.minionT <= 0) {
        this.summonMinion(b);
        this.summonMinion(b);
        if (mothershipMode === 'summon') this.summonMinion(b);
        b.minionT = 5.0;
      }
    }

    // telegraphed release fires exactly once when the warn expires (P-2);
    // the mothership finale releases wall AND ring together
    if (b.armed && b.warn <= 0) {
      b.armed = false;
      if (mothershipMode === 'wall' || mothershipMode === 'wall+nova') {
        const slots = 13;
        for (let i = 0; i < slots; i++) {
          if (Math.abs(i - b.wallGap) < 2) continue; // the gap
          this.egg(36 + (i * (STAGE_W - 72)) / (slots - 1), 20, 0, v * 0.8);
        }
      }
      if (mothershipMode === 'nova' || mothershipMode === 'wall+nova') {
        const n = mothershipMode === 'wall+nova' ? 16 : 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.egg(b.x, b.y + 20, Math.cos(a) * v * 0.7, Math.abs(Math.sin(a)) * v * 0.7 + 60);
        }
      }
    }

    if (b.hp <= 0) {
      this.burst(b.x, b.y, 60, this.pack.foe2);
      this.score += 1000 + 500 * this.chapter;
      this.missileN = Math.min(MISSILE_CAP, this.missileN + 1); // +1 per boss
      this.boss = null;
      this.chickens = []; // sweep leftover minions
      this.unlocked = Math.max(this.unlocked, Math.min(this.chaptersTotal, this.chapter + 1));
      save(this.game, 'chapter-unlocked', this.unlocked);
      this.persistHigh();
      this.mode = this.chapter >= this.chaptersTotal ? 'win' : 'clear';
      this.clearT = 0;
      if (this.mode === 'win') {
        this.toast = { msg: this.pack.jokes ? this.pack.jokes[this.chaptersTotal] ?? 'CAMPAIGN COMPLETE' : 'CAMPAIGN COMPLETE — THE SUN IS FREE', t: 4 };
      } else {
        this.toast = { msg: `CHAPTER ${this.chapter} CLEAR — next: ${this.pack.chapters[this.chapter].name}`, t: CHAPTER_CLEAR_S };
      }
      this.events.push(this.mode === 'win' ? 'win' : 'chapterClear');
      this.events.push('bossDown');
    }
  }

  // ---------------- fixed-step simulation ----------------
  step(dt: number): void {
    // chapter-clear countdown runs even while 'clear' freezes the field
    if (this.mode === 'clear') {
      this.clearT += dt;
      this.decayToast(dt);
      if (this.clearT >= CHAPTER_CLEAR_S) {
        this.chapter++; this.waveIdx = 0; this.killsInChapter = 0;
        this.jokeT = 2.6;
        this.toast = { msg: `CHAPTER ${this.chapter} — ${this.chapterDef.name}`, t: 2.4 };
        this.mode = 'play'; this.spawnWave();
      }
      return;
    }
    if (this.mode !== 'play' || this.paused) return;
    this.waveT += dt;
    this.decayToast(dt);
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
      if (this.fireHeld && this.fireT <= 0) { this.fireGuns(); this.fireT = this.pack.weapons[this.weaponLv].every; }
    } else {
      this.deadT += dt;
      if (this.deadT >= RESPAWN_S) {
        if (this.lives > 0) {
          this.ship.alive = true; this.ship.x = STAGE_W / 2; this.ship.y = SHIP_Y0;
          this.ship.vx = this.ship.vy = 0; this.ship.invuln = INVULN_S;
        } else {
          this.mode = 'gameover';
          this.persistHigh();
          this.toast = { msg: 'GAME OVER', t: 3 };
          this.events.push('gameOver');
          return;
        }
      }
    }
    this.jokeT = Math.max(0, this.jokeT - dt);

    // chickens: formation patterns
    const wdef = this.chapterDef.waves[Math.min(this.waveIdx, this.wavesTotal - 1)];
    for (const c of this.chickens) {
      c.t += dt;
      if (this.frozen(c)) continue; // D-42: whole-enemy freeze
      if (c.enter) { // fly-in
        if (c.side !== 0) { // swoop entry: bezier arc from the flank
          const p = Math.min(1, c.t / SWOOP_T);
          const sx = c.side < 0 ? -40 : STAGE_W + 40;
          c.x = sx + (c.bx - sx) * p;
          c.y = (c.by + 90) + (c.by - (c.by + 90)) * p - Math.sin(p * Math.PI) * 90;
          if (p >= 1) { c.enter = 0; c.x = c.bx; c.y = c.by; }
        } else {
          c.y += (c.by - c.y) * Math.min(1, 3 * dt) + 40 * dt;
          if (Math.abs(c.y - c.by) < 4) { c.y = c.by; c.enter = 0; }
          c.x = c.bx;
        }
        continue;
      }
      if (c.dive) { // diving at ship
        c.x += c.dvx * dt; c.y += c.dvy * dt;
        if (c.y > STAGE_H + 30) { c.dive = 0; c.y = -40; c.x = c.bx; c.enter = 1; c.t = 0; c.side = 0; }
        continue;
      }
      const mt = this.waveT * this.pack.enemyTypes[c.type].speed * wdef.speed;
      switch (wdef.pattern) {
        case 'grid':
          c.x = c.bx + Math.sin(mt * 0.7) * 70;
          c.y = c.by + Math.sin(mt * 0.5 + c.bx * 0.013) * 10;
          break;
        case 'sine':
          c.x = c.bx + Math.sin(mt * 1.55 + c.bx * 0.017) * 150;
          c.y = c.by + Math.cos(mt * 1.55 + c.bx * 0.017) * 16;
          break;
        case 'swoop':
          c.x = c.bx + Math.sin(mt * 1.1 + c.bx * 0.01) * 170;
          c.y = c.by + Math.sin(mt * 0.9 + c.bx * 0.02) * 34;
          break;
        case 'sweep':
          c.x = c.bx + Math.sin(mt * 0.8) * 255;
          c.y = c.by + Math.sin(mt * 1.2 + c.bx * 0.01) * 12;
          break;
        case 'dive':
          c.x = c.bx + Math.sin(mt * 0.5) * 70;
          c.y = c.by;
          break;
        case 'barrage':
          c.x = c.bx + Math.sin(mt * 0.95) * 115;
          c.y = Math.min(c.by + mt * 3, 300);
          break;
      }
    }
    // dive scheduler — aces peel off first when present
    if (wdef.pattern === 'dive') {
      this.diveT -= dt;
      if (this.diveT <= 0) {
        const cand = this.chickens.filter(c => !c.dive && !c.enter && !this.frozen(c));
        const aces = cand.filter(c => this.pack.enemyTypes[c.type].goggles);
        const pickFrom = aces.length && Math.random() < 0.6 ? aces : cand;
        if (pickFrom.length) {
          const c = pickFrom[(Math.random() * pickFrom.length) | 0];
          c.dive = 1;
          const dx = this.ship.x - c.x, dy = this.ship.y - c.y, d = Math.hypot(dx, dy) || 1;
          const sp = 240 * wdef.speed;
          c.dvx = (dx / d) * sp; c.dvy = Math.max(160, (dy / d) * sp);
        }
        this.diveT = Math.max(0.5, 1.4 + Math.random() - this.chapter * 0.05);
      }
    }
    // egg drops (aimed-ish, readable speed; frozen + entering birds hold fire)
    this.eggT -= dt;
    if (this.eggT <= 0 && this.chickens.length) {
      const droppers = this.chickens.filter(c => !c.enter && !this.frozen(c) && c.y < this.ship.y - 40);
      if (droppers.length) {
        const c = droppers[(Math.random() * droppers.length) | 0];
        const v = this.eggV();
        const spread = (Math.random() - 0.5) * 0.35;
        const dx = this.ship.x - c.x, dy = this.ship.y - c.y, d = Math.hypot(dx, dy) || 1;
        this.egg(c.x, c.y + 12, (dx / d + spread) * v * 0.5, v);
      }
      this.eggT = (this.boss ? Math.max(2.4, wdef.eggEvery) : wdef.eggEvery) * (0.7 + Math.random() * 0.6);
    }
    // wave cleared? (D-42: frozen statues never block the advance)
    if (!this.boss && this.chickens.every(c => this.frozen(c))) {
      this.waveIdx++;
      if (this.waveIdx < this.wavesTotal) this.spawnWave();
      else this.spawnBoss();
    }

    if (this.boss) this.stepBoss(dt);

    // projectiles
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const e of this.eggs) { e.x += e.vx * dt; e.y += e.vy * dt; }
    for (const p of this.pickups) p.y += p.vy * dt;
    for (const m of this.missiles) {
      m.y += m.vy * dt;
      // proximity fuse: any bird/boss near the nose, or the top of the lane
      const near = this.chickens.some(c => Math.abs(c.x - m.x) < 30 && Math.abs(c.y - m.y) < 26)
        || (this.boss && Math.abs(this.boss.x - m.x) < 70 && Math.abs(this.boss.y - m.y) < 50);
      if (near || m.y <= MISSILE_FUSE_Y) {
        this.explodeMissile(m.x, m.y);
        m.y = -999; // spent — dropped by the filter below
      }
    }
    this.bullets = this.bullets.filter(b => b.y > -20 && b.x > -20 && b.x < STAGE_W + 20);
    this.missiles = this.missiles.filter(m => m.y > -40);
    this.eggs = this.eggs.filter(e => e.y < STAGE_H + 20 && e.x > -20 && e.x < STAGE_W + 20);
    this.pickups = this.pickups.filter(p => p.y < STAGE_H + 20);

    // bullet vs chickens
    const dmg = this.pack.weapons[this.weaponLv].dmg;
    const hitC = (b: { x: number; y: number }, d: number): boolean => {
      for (const c of this.chickens) {
        const variant = this.pack.enemyTypes[c.type];
        const rx = 24 * variant.scale, ry = 18 * variant.scale;
        if (Math.abs(b.x - c.x) < rx && Math.abs(b.y - c.y) < ry) {
          c.hp -= d; this.burst(b.x, b.y, 4, this.pack.foe);
          if (c.hp <= 0) { this.killChicken(c); this.chickens = this.chickens.filter(k => k !== c); }
          return true;
        }
      }
      return false;
    };
    this.bullets = this.bullets.filter(b => !hitC(b, dmg));
    // vs boss
    if (this.boss) {
      const boss = this.boss;
      const hitB = (b: { x: number; y: number }) =>
        Math.abs(b.x - boss.x) < 56 * (boss.def.scale / 3) && Math.abs(b.y - boss.y) < 40 * (boss.def.scale / 3);
      for (const b of this.bullets) if (hitB(b)) { boss.hp -= dmg; b.y = -99; this.burst(b.x, b.y, 3, this.pack.foe2); }
      this.bullets = this.bullets.filter(b => b.y > -20);
      // boss body collision
      if (this.ship.alive && this.ship.invuln <= 0
        && Math.abs(this.ship.x - boss.x) < 50 * (boss.def.scale / 3)
        && Math.abs(this.ship.y - boss.y) < 36 * (boss.def.scale / 3)) this.hitShip('boss');
    }
    // chicken body collision (D-42: frozen statues are intangible)
    if (this.ship.alive && this.ship.invuln <= 0) {
      for (const c of this.chickens) {
        if (this.frozen(c)) continue;
        if (Math.abs(this.ship.x - c.x) < 26 && Math.abs(this.ship.y - c.y) < 20) { this.hitShip('chicken'); break; }
      }
    }
    // eggs vs ship
    if (this.ship.alive && this.ship.invuln <= 0) {
      for (const e of this.eggs) {
        if (Math.hypot(e.x - this.ship.x, e.y - this.ship.y) < SHIP_R + EGG_R) { this.hitShip('egg'); e.y = STAGE_H + 99; break; }
      }
    }
    this.eggs = this.eggs.filter(e => e.y < STAGE_H + 20);

    // pickups vs ship
    if (this.ship.alive) {
      for (const p of this.pickups) {
        if (Math.abs(p.x - this.ship.x) < 26 && Math.abs(p.y - this.ship.y) < 22) {
          p.y = STAGE_H + 99;
          this.collect(p.kind);
        }
      }
    }
    this.pickups = this.pickups.filter(p => p.y < STAGE_H + 20);

    // particles
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
  }

  private collect(kind: Pickup['kind']): void {
    const pack = this.pack;
    if (kind === 'gift') {
      if (this.weaponLv < pack.weapons.length - 1) {
        this.weaponLv++;
        this.toast = { msg: `${pack.gift.name}: ${pack.weapons[this.weaponLv].name}`, t: 1.7 };
      } else {
        // max power: gifts convert to score
        this.score += GIFT_MAX_PTS;
        this.toast = { msg: `${pack.gift.name}: +${GIFT_MAX_PTS}`, t: 1.7 };
      }
      this.events.push('gift');
    } else if (kind === 'food') {
      this.score += pack.food.pts;
      this.foodCount++;
      if (this.foodCount % FOOD_PER_LIFE === 0) {
        this.lives++;
        this.toast = { msg: `${pack.food.name} x${FOOD_PER_LIFE} — EXTRA LIFE`, t: 2.0 };
        this.events.push('extraLife');
      } else {
        this.toast = { msg: `${pack.food.name} +${pack.food.pts}`, t: 1.2 };
      }
      this.events.push('food');
    } else {
      this.missileN = Math.min(MISSILE_CAP, this.missileN + 1);
      this.toast = { msg: '+1 MISSILE', t: 1.2 };
      this.events.push('pickup');
    }
  }

  private decayToast(dt: number): void {
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }
  }

  /** PROOF/debug snapshot — `window.__maga.state`; wave is clamped so the
   *  boss interlude never leaks wave N+1 of N (D-41). */
  snapshot(): Record<string, unknown> {
    const b = this.boss;
    return {
      mode: this.mode, pack: this.pack.id,
      chapter: this.chapter, chapterName: this.chapterDef.name, chaptersTotal: this.chaptersTotal,
      wave: Math.min(this.waveIdx + 1, this.wavesTotal), wavesTotal: this.wavesTotal,
      score: this.score, high: Math.max(this.high, this.score),
      lives: this.lives, missiles: this.missileN,
      power: this.weaponLv + 1, powerMax: this.pack.weapons.length,
      weaponName: this.weaponName, weaponLv: this.weaponLv,
      food: this.foodCount, foodGoal: FOOD_PER_LIFE,
      shipX: this.ship.x, shipY: this.ship.y, shipAlive: this.ship.alive, invuln: this.ship.invuln,
      chickens: this.chickens.map(c => ({
        x: +c.x.toFixed(0), y: +c.y.toFixed(0), hp: c.hp, hpMax: c.hpMax,
        type: this.pack.enemyTypes[c.type].name, frozen: this.frozen(c), dive: !!c.dive,
      })),
      eggs: this.eggs.length,
      pickups: this.pickups.map(p => ({ x: +p.x.toFixed(0), y: +p.y.toFixed(0), kind: p.kind })),
      boss: b ? b.def.name : null, bossPattern: b ? b.def.pattern : null,
      bossHp: b ? +b.hp.toFixed(1) : null, bossMax: b ? b.max : null,
      bossPhase: b ? b.phase : null, bossIntro: b ? +b.intro.toFixed(2) : null,
      bossWarn: b ? b.warn : 0,
      unlocked: this.unlocked, paused: this.paused,
      kills: this.killsInChapter, titleSel: this.titleSel, lastDeath: this.lastDeath,
      toast: this.toast ? this.toast.msg : null,
    };
  }
}
