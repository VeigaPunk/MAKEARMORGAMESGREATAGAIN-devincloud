import { Graphics } from 'pixi.js';
import { PAL } from './palette';
import { ENEMIES, type EnemyKind } from './world';

/**
 * BLOCKHEAD entities — procedural chunky-box art (PIXEL native recipes).
 * Invulnerability is a wall-clock deadline (D-58): throttle-resume bursts
 * cannot decay it early, so stacked movers can never multi-hit inside one
 * resumed frame.
 */

export type Vec = { x: number; y: number };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const OUTLINE = { width: 1, color: PAL.void };

// --- Player ------------------------------------------------------------------
export class Player {
  g = new Graphics();
  pos: Vec;
  /** facing = last move direction; shots fire this way (keyboard combat) */
  facing: Vec = { x: 1, y: 0 };
  hp = 100;
  ammo = 40;
  speed = 130;
  /** performance.now() ms deadline — see D-58 */
  private invulnUntil = 0;

  constructor(x: number, y: number, private accent: number) {
    this.pos = { x, y };
    this.draw();
    this.g.x = x;
    this.g.y = y;
  }

  private draw(): void {
    this.g.clear()
      .rect(-6, -4, 12, 12).fill(PAL.playerBody).stroke(OUTLINE)
      .rect(-6, -4, 2, 12).fill(this.accent)
      .rect(-4, -11, 8, 7).fill(PAL.playerHead).stroke(OUTLINE)
      .rect(2, -9, 2, 2).fill(PAL.void)
      .rect(-2, -9, 2, 2).fill(PAL.void);
  }

  setInvuln(seconds: number): void {
    this.invulnUntil = Math.max(this.invulnUntil, performance.now() + seconds * 1000);
  }

  invulnLeft(): number {
    return Math.max(0, (this.invulnUntil - performance.now()) / 1000);
  }

  move(axis: Vec, dt: number, bounds: { w: number; h: number }, solids: Rect[]): void {
    if (axis.x !== 0 || axis.y !== 0) {
      const d = Math.hypot(axis.x, axis.y) || 1;
      this.facing = { x: axis.x / d, y: axis.y / d };
    }
    // axis-separated moves so we slide along walls/obstacles
    this.tryMove(this.pos.x + axis.x * this.speed * dt, this.pos.y, bounds, solids);
    this.tryMove(this.pos.x, this.pos.y + axis.y * this.speed * dt, bounds, solids);
    this.g.x = this.pos.x;
    this.g.y = this.pos.y;
    this.g.rotation = Math.atan2(this.facing.y, this.facing.x) + Math.PI / 2;
  }

  private tryMove(nx: number, ny: number, bounds: { w: number; h: number }, solids: Rect[]): void {
    const r = { x: nx - 6, y: ny - 4, w: 12, h: 12 };
    if (nx < 16 || nx > bounds.w - 16 || ny < 16 || ny > bounds.h - 16) return;
    for (const s of solids) if (rectsOverlap(r, s)) return;
    this.pos.x = nx;
    this.pos.y = ny;
  }

  tickFlash(): void {
    const left = this.invulnLeft();
    if (left > 0) this.g.alpha = Math.sin(left * 30) > 0 ? 1 : 0.4;
    else this.g.alpha = 1;
  }
}

// --- Zombie ------------------------------------------------------------------
export class Zombie {
  g = new Graphics();
  hp: number;
  speed: number;
  readonly kind: EnemyKind;
  readonly hitR: number;
  readonly contact: number;
  readonly ranged: boolean;
  hitFlash = 0;
  dead = false;
  /** devil ranged-attack cooldown */
  fireTimer = 2;

  constructor(public pos: Vec, baseSpeed: number, kind: EnemyKind) {
    const spec = ENEMIES[kind];
    this.kind = kind;
    this.speed = baseSpeed * spec.speedMul;
    this.hp = spec.hp;
    this.hitR = spec.hitR;
    this.contact = spec.contact;
    this.ranged = spec.ranged;
    this.draw();
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  private draw(): void {
    if (this.kind === 'bruiser') {
      this.g.rect(-11, -9, 22, 19).fill(PAL.zombieDark).stroke(OUTLINE)
        .rect(-8, -16, 16, 9).fill(PAL.zombieDark).stroke(OUTLINE)
        .rect(-6, -14, 3, 3).fill(PAL.zombieEye)
        .rect(3, -14, 3, 3).fill(PAL.zombieEye)
        .rect(-4, -1, 8, 3).fill(PAL.void);
      return;
    }
    if (this.kind === 'devil') {
      this.g.rect(-6, -5, 12, 13).fill(PAL.devil).stroke(OUTLINE)
        .rect(-4, -12, 8, 8).fill(PAL.devil).stroke(OUTLINE)
        .rect(-5, -15, 3, 4).fill(PAL.devilHorn)
        .rect(2, -15, 3, 4).fill(PAL.devilHorn)
        .rect(-3, -10, 2, 3).fill(PAL.warn)
        .rect(1, -10, 2, 3).fill(PAL.warn);
      return;
    }
    const body = this.kind === 'runner' ? PAL.runner : PAL.zombie;
    const eye = this.kind === 'runner' ? PAL.void : PAL.zombieEye;
    this.g.rect(-6, -4, 12, 12).fill(body).stroke(OUTLINE)
      .rect(-4, -11, 8, 7).fill(body).stroke(OUTLINE)
      .rect(-3, -9, 2, 2).fill(eye)
      .rect(1, -9, 2, 2).fill(eye);
  }

  chase(target: Vec, dt: number, bounds: { w: number; h: number }, solids: Rect[], crowd: Zombie[]): void {
    const d = dist(this.pos, target) || 1;
    const vx = ((target.x - this.pos.x) / d) * this.speed * dt;
    const vy = ((target.y - this.pos.y) / d) * this.speed * dt;
    this.step(vx, 0, bounds, solids);
    this.step(0, vy, bounds, solids);

    // gentle separation so the swarm doesn't collapse into one blob
    const sep = this.kind === 'bruiser' ? 22 : 14;
    for (const o of crowd) {
      if (o === this || o.dead) continue;
      const sd = dist(this.pos, o.pos);
      if (sd > 0 && sd < sep) {
        this.pos.x += ((this.pos.x - o.pos.x) / sd) * 20 * dt;
        this.pos.y += ((this.pos.y - o.pos.y) / sd) * 20 * dt;
      }
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0) {
        this.g.alpha = 1;
        this.g.tint = 0xffffff;
      } else {
        this.g.alpha = 0.75;
        this.g.tint = 0xff8a7a; // red hit flash reads through the swarm
      }
    }
    this.g.x = this.pos.x;
    this.g.y = this.pos.y;
  }

  private step(dx: number, dy: number, bounds: { w: number; h: number }, solids: Rect[]): void {
    const nx = this.pos.x + dx;
    const ny = this.pos.y + dy;
    const box = ENEMIES[this.kind].box;
    const r = { x: nx - box.hx, y: ny - box.hy, w: box.hx * 2, h: box.hy * 2 };
    if (nx < 16 || nx > bounds.w - 16 || ny < 16 || ny > bounds.h - 16) return;
    for (const s of solids) if (rectsOverlap(r, s)) return;
    this.pos.x = nx;
    this.pos.y = ny;
  }

  destroy(): void {
    this.dead = true;
    this.g.destroy();
  }
}

// --- Projectile ----------------------------------------------------------------
export type ProjKind = 'bullet' | 'grenade' | 'rocket' | 'fireball';

export class Projectile {
  g = new Graphics();
  life: number;
  /** firing player index (-1 = devil fireball) */
  owner = 0;
  damage = 1;
  radius = 0;
  aoeDamage = 0;
  private t = 0;

  constructor(public pos: Vec, public vel: Vec, readonly kind: ProjKind, life: number) {
    this.life = life;
    if (kind === 'grenade') {
      this.g.circle(0, 0, 4).fill(0x3a5f2a).stroke(OUTLINE);
    } else if (kind === 'rocket') {
      this.g.rect(-5, -2, 10, 4).fill(PAL.barrelBand).stroke(OUTLINE)
        .circle(4, 0, 3).fill(PAL.warn);
      this.g.blendMode = 'normal';
    } else if (kind === 'fireball') {
      // devil energy ball — additive orange glow
      this.g.circle(0, 0, 8).fill({ color: PAL.warn, alpha: 0.4 })
        .circle(0, 0, 4.5).fill({ color: PAL.warn, alpha: 0.8 })
        .circle(0, 0, 2.5).fill(PAL.muzzle);
      this.g.blendMode = 'add';
    } else {
      this.g.rect(-2, -1, 5, 2).fill(PAL.bullet)
        .rect(-1, -0.5, 2, 1).fill(PAL.bulletCore);
    }
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  tick(dt: number): boolean {
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.life -= dt;
    this.t += dt;
    this.g.x = this.pos.x;
    this.g.y = this.pos.y;
    this.g.rotation = Math.atan2(this.vel.y, this.vel.x);
    if (this.kind === 'rocket') this.g.alpha = 0.85 + Math.sin(this.t * 42) * 0.15;
    if (this.kind === 'fireball') {
      const pulse = 1 + Math.sin(this.t * 18) * 0.18;
      this.g.scale.set(pulse);
    }
    return this.life > 0;
  }

  hitSolid(solids: Rect[], bounds: { w: number; h: number }): boolean {
    if (this.pos.x < 12 || this.pos.x > bounds.w - 12 || this.pos.y < 12 || this.pos.y > bounds.h - 12) return true;
    const r = { x: this.pos.x - 2, y: this.pos.y - 2, w: 4, h: 4 };
    return solids.some((s) => rectsOverlap(r, s));
  }

  destroy(): void {
    this.g.destroy();
  }
}

// --- FX -------------------------------------------------------------------------
/** muzzle flash — plus-shaped pop at the gun tip, ~60 ms */
export class MuzzleFlash {
  g = new Graphics();
  t = 0;
  readonly dur = 0.06;

  constructor(pos: Vec, angle: number, big = false) {
    const len = big ? 13 : 9;
    this.g.rotation = angle;
    this.g.x = pos.x;
    this.g.y = pos.y;
    this.g.rect(0, -1.5, len, 3).fill(PAL.muzzle)
      .rect(1, -3, 4, 6).fill(PAL.muzzle)
      .rect(len - 3, -2, 3, 4).fill({ color: PAL.warn, alpha: 0.8 });
  }

  tick(dt: number): boolean {
    this.t += dt;
    this.g.alpha = 1 - this.t / this.dur;
    return this.t < this.dur;
  }

  destroy(): void {
    this.g.destroy();
  }
}

/** persistent blood decal — stays on the floor for the whole run (capped) */
export class BloodDecal {
  readonly g = new Graphics();

  constructor(pos: Vec) {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const ox = (Math.random() - 0.5) * 16;
      const oy = (Math.random() - 0.5) * 16;
      const s = 2 + Math.random() * 3;
      this.g.rect(pos.x + ox, pos.y + oy, s, s)
        .fill(Math.random() < 0.6 ? PAL.blood : PAL.bloodDark);
    }
  }
}

// --- Props ----------------------------------------------------------------------
export class AmmoCrate {
  g = new Graphics();
  taken = false;

  constructor(public pos: Vec) {
    this.g.rect(-7, -5, 14, 10).fill(PAL.crate).stroke(OUTLINE)
      .rect(-7, -2, 14, 3).fill(PAL.crateBand)
      .rect(-1, -5, 2, 10).fill(PAL.crateBand)
      .rect(-3, -3.5, 6, 2).fill(PAL.crateMark);
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  take(): void {
    this.taken = true;
    this.g.destroy();
  }
}

export class Barrel {
  g = new Graphics();
  exploded = false;
  fuse = -1; // chain-lighting delay

  constructor(public pos: Vec) {
    this.g.rect(-6, -8, 12, 16).fill(PAL.barrel).stroke(OUTLINE)
      .rect(-6, -4, 12, 3).fill(PAL.barrelBand)
      .rect(-6, 3, 12, 3).fill(PAL.barrelBand)
      .rect(-2, -10, 4, 3).fill(PAL.warn);
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  explode(): void {
    this.exploded = true;
    this.g.destroy();
  }
}

/** expanding ring VFX for explosions */
export class BlastRing {
  g = new Graphics();
  t = 0;
  readonly dur = 0.35;

  constructor(pos: Vec, readonly radius: number) {
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  tick(dt: number): boolean {
    this.t += dt;
    const k = this.t / this.dur;
    this.g.clear().circle(0, 0, Math.max(1, this.radius * k))
      .stroke({ width: 3, color: PAL.amber, alpha: 1 - k })
      .circle(0, 0, Math.max(1, this.radius * k * 0.55))
      .fill({ color: PAL.muzzle, alpha: Math.max(0, 0.5 - k) });
    return k < 1;
  }

  destroy(): void {
    this.g.destroy();
  }
}

// --- shared ---------------------------------------------------------------------
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
