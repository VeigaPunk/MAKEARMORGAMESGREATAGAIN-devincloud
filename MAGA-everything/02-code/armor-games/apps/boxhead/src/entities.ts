import { Graphics } from 'pixi.js';

/**
 * Boxhead entities — chunky placeholder boxes (PIXEL replaces per recipes).
 * All combat numbers are TBD ARCADE placeholders unless noted.
 */

export type Vec = { x: number; y: number };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const OUTLINE = { width: 1, color: 0x000000 };

// --- Player ------------------------------------------------------------------
export class Player {
  g = new Graphics();
  pos: Vec;
  /** facing = last move direction; shots fire this way (keyboard-only combat) */
  facing: Vec = { x: 1, y: 0 };
  hp = 100;
  ammo = 24;
  private protectedUntil = 0;
  get invuln(): number { return Math.max(0, (this.protectedUntil - performance.now()) / 1000); }
  set invuln(seconds: number) { this.protectedUntil = performance.now() + Math.max(0, seconds) * 1000; }
  speed = 125; // TBD ARCADE

  constructor(x: number, y: number, color = 0xe8e8f0) {
    this.pos = { x, y };
    this.draw(color);
    this.g.x = x;
    this.g.y = y;
  }

  draw(color: number): void {
    this.g.clear()
      .ellipse(1, 5, 10, 6).fill({ color: 0x000000, alpha: 0.35 })
      .rect(-6, 4, 5, 6).fill(0x1b2026).stroke(OUTLINE)
      .rect(1, 4, 5, 6).fill(0x1b2026).stroke(OUTLINE)
      .rect(-8, -5, 16, 11).fill(color).stroke(OUTLINE)
      .rect(-4, -4, 8, 10).fill(0x465052).stroke(OUTLINE)
      .rect(-3, -1, 6, 2).fill(0x9ead86)
      .rect(-5, -13, 10, 9).fill(color).stroke(OUTLINE)
      .rect(-5, -13, 10, 3).fill(0x727d79)
      .rect(-3, -9, 6, 2).fill(0x172329)
      .rect(5, -11, 3, 10).fill(0x2b3139).stroke(OUTLINE)
      .rect(5, -13, 3, 3).fill(0xaab6b9);
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

  tickFlash(_dt: number): void {
    if (this.invuln > 0) {
      this.g.alpha = Math.sin(this.invuln * 30) > 0 ? 1 : 0.4;
    } else {
      this.g.alpha = 1;
    }
  }
}

// --- Zombie ------------------------------------------------------------------
export class Zombie {
  g = new Graphics();
  hp: number;
  speed: number; // TBD ARCADE
  runner: boolean;
  hitFlash = 0;
  dead = false;

  constructor(public pos: Vec, speed: number, runner: boolean) {
    this.speed = runner ? speed * 1.8 : speed;
    this.hp = runner ? 1 : 2; // TBD ARCADE
    this.runner = runner;
    const color = runner ? 0xd43a3a : 0x6a8f3a;
    this.g.ellipse(1, 7, 10, 5).fill({color: 0x000000, alpha: 0.4})
      .rect(-5, 5, 4, 6).fill(0x242825).stroke(OUTLINE)
      .rect(2, 5, 4, 6).fill(0x242825).stroke(OUTLINE)
      .rect(-7, -4, 14, 12).fill(runner ? 0x762a30 : 0x4c5944).stroke(OUTLINE)
      .rect(-10, -7, 3, 9).fill(color).stroke(OUTLINE)
      .rect(7, -7, 3, 9).fill(color).stroke(OUTLINE)
      .rect(-5, -12, 10, 9).fill(color).stroke(OUTLINE)
      .rect(-3, -9, 2, 2).fill(0xffe69b)
      .rect(2, -9, 2, 2).fill(0xffe69b)
      .rect(-1, -5, 4, 1).fill(0x281d19);
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  chase(target: Vec, dt: number, bounds: { w: number; h: number }, solids: Rect[], crowd: Zombie[]): void {
    const d = dist(this.pos, target) || 1;
    const vx = ((target.x - this.pos.x) / d) * this.speed * dt;
    const vy = ((target.y - this.pos.y) / d) * this.speed * dt;
    this.step(vx, 0, bounds, solids);
    this.step(0, vy, bounds, solids);

    // gentle separation so the swarm doesn't collapse into one blob
    for (const o of crowd) {
      if (o === this || o.dead) continue;
      const sd = dist(this.pos, o.pos);
      if (sd > 0 && sd < 14) {
        this.pos.x += ((this.pos.x - o.pos.x) / sd) * 20 * dt;
        this.pos.y += ((this.pos.y - o.pos.y) / sd) * 20 * dt;
      }
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      this.g.alpha = this.hitFlash > 0 ? 0.5 : 1;
    }
    this.g.x = this.pos.x;
    this.g.y = this.pos.y;
    this.g.rotation = Math.atan2(target.y - this.pos.y, target.x - this.pos.x) + Math.PI / 2;
  }

  private step(dx: number, dy: number, bounds: { w: number; h: number }, solids: Rect[]): void {
    const nx = this.pos.x + dx;
    const ny = this.pos.y + dy;
    const r = { x: nx - 6, y: ny - 4, w: 12, h: 12 };
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
export class Projectile {
  g = new Graphics();
  life = 1.4;

  constructor(public pos: Vec, public vel: Vec, kind: 'bullet' | 'grenade' = 'bullet') {
    if (kind === 'grenade') {
      // lobbed shell — bigger, darker, reads as AoE ordnance not a tracer
      this.g.circle(0, 0, 4).fill(0x3a5f2a).stroke({ width: 1, color: 0x000000 });
    } else {
      this.g.rect(-2, -1, 5, 2).fill(0xf5c542);
    }
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  tick(dt: number): boolean {
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.life -= dt;
    this.g.x = this.pos.x;
    this.g.y = this.pos.y;
    this.g.rotation = Math.atan2(this.vel.y, this.vel.x);
    return this.life > 0;
  }

  hitSolid(solids: Rect[], bounds: { w: number; h: number }): boolean {
    if (this.pos.x < 12 || this.pos.x > bounds.w - 12 || this.pos.y < 12 || this.pos.y > bounds.h - 12) return true;
    const r = { x: this.pos.x - 2, y: this.pos.y - 1, w: 4, h: 2 };
    return solids.some((s) => rectsOverlap(r, s));
  }

  destroy(): void {
    this.g.destroy();
  }
}

// --- AmmoCrate -----------------------------------------------------------------
export class AmmoCrate {
  g = new Graphics();
  taken = false;

  constructor(public pos: Vec) {
    // readable pickup: yellow box with dark band
    this.g.rect(-7, -5, 14, 10).fill(0xf5c542).stroke(OUTLINE)
      .rect(-7, -1.5, 14, 3).fill(0x8a6d1a)
      .rect(-2, -4, 4, 8).fill(0xfff1a1)
      .rect(-9, 6, 18, 2).fill({color:0xf5c542,alpha:0.35});
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  take(): void {
    this.taken = true;
    this.g.destroy();
  }
}

// --- Barrel --------------------------------------------------------------------
export class Barrel {
  g = new Graphics();
  exploded = false;
  fuse = -1; // chain-lighting delay

  constructor(public pos: Vec) {
    this.g.rect(-6, -8, 12, 16).fill(0xb03030).stroke(OUTLINE)
      .rect(-6, -5, 12, 2).fill(0x503f38)
      .rect(-6, 4, 12, 2).fill(0x503f38)
      .poly([-3,2,0,-3,3,2]).fill(0xffd35d)
      .rect(-4, -7, 3, 1).fill(0xf6755d);
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

  constructor(pos: Vec, readonly radius: number, readonly color = 0xf5c542) {
    this.g.x = pos.x;
    this.g.y = pos.y;
  }

  tick(dt: number): boolean {
    this.t += dt;
    const k = this.t / this.dur;
    this.g.clear().circle(0, 0, Math.max(1, this.radius * k)).stroke({ width: 3, color: this.color, alpha: 1 - k });
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
