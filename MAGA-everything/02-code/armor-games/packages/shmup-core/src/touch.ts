import { Container, Graphics } from 'pixi.js';

/**
 * Shmup touch controls — spec layouts A (twin thumbs) + B (one-thumb)
 * unified: left ~55% of the stage is a relative drag-pad for ship XY
 * (drag vector → acceleration; dragging also auto-fires for one-thumb
 * play), bottom-right holds FIRE and MISSILE buttons ≥44px.
 *
 * Zones claim pointer events BEFORE Input's canvas-level tap handling —
 * same pattern as boxhead TouchControls: zone-claimed touches call
 * stopImmediatePropagation so Input never sees them as taps (D-15).
 * Zones only exist during gameplay (`setActive`) so menus/end screens
 * keep raw tap semantics (D-14).
 */

const FIRE_R = 30;
const MISSILE_R = 24;
const DRAG_MAX = 90; // px of finger travel = full deflection

export class ShmupTouch {
  readonly view = new Container();
  /** normalized drag vector while a finger is on the pad, else null */
  drag: { x: number; y: number } | null = null;
  /** true while the FIRE button is held */
  fire = false;
  /** edge-triggered missile request — app consumes via takeMissile() */
  private missileQueued = false;

  private shown = false;
  private coarse = false;
  private active = false;
  private dragPointer = -1;
  private dragOrigin = { x: 0, y: 0 };
  private firePointer = -1;
  private missilePointer = -1;
  private baseAlpha = 0.42;

  private padBase!: Graphics;
  private padKnob!: Graphics;
  private fireBtn!: Graphics;
  private missileBtn!: Graphics;

  constructor(
    private stageW: number,
    private stageH: number,
    canvas: HTMLCanvasElement,
    toLogical: (cx: number, cy: number) => { x: number; y: number },
  ) {
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.build();

    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return toLogical(e.clientX - r.left, e.clientY - r.top);
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active) return; // menus: leave taps to Input
      const p = toLocal(e);
      if (this.inFireZone(p) && this.firePointer < 0) {
        this.firePointer = e.pointerId; this.fire = true;
        e.stopImmediatePropagation(); e.preventDefault();
      } else if (this.inMissileZone(p) && this.missilePointer < 0) {
        this.missilePointer = e.pointerId; this.missileQueued = true;
        e.stopImmediatePropagation(); e.preventDefault();
      } else if (this.inDragZone(p) && this.dragPointer < 0) {
        this.dragPointer = e.pointerId; this.dragOrigin = p; this.drag = { x: 0, y: 0 };
        this.coarse = true;
        e.stopImmediatePropagation(); e.preventDefault();
      }
      this.applyVisibility();
    }, { capture: true });

    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragPointer || !this.drag) return;
      const p = toLocal(e);
      const dx = p.x - this.dragOrigin.x, dy = p.y - this.dragOrigin.y;
      const d = Math.hypot(dx, dy);
      const k = d > DRAG_MAX ? DRAG_MAX / d : 1;
      this.drag = { x: (dx * k) / DRAG_MAX, y: (dy * k) / DRAG_MAX };
      e.stopImmediatePropagation();
    }, { capture: true });

    const release = (e: PointerEvent) => {
      if (e.pointerId === this.dragPointer) { this.dragPointer = -1; this.drag = null; }
      if (e.pointerId === this.firePointer) { this.firePointer = -1; this.fire = false; }
      if (e.pointerId === this.missilePointer) this.missilePointer = -1;
    };
    window.addEventListener('pointerup', release, { capture: true });
    window.addEventListener('pointercancel', release, { capture: true });
  }

  /** gameplay gate — menus/end screens leave every touch to Input (D-14) */
  setActive(v: boolean): void {
    this.active = v;
    if (!v) { this.drag = null; this.fire = false; this.dragPointer = -1; this.firePointer = -1; this.missilePointer = -1; }
    this.applyVisibility();
  }

  /** one-shot missile press */
  takeMissile(): boolean {
    const q = this.missileQueued; this.missileQueued = false; return q;
  }

  private fireHome() { return { x: this.stageW - 66, y: this.stageH - 70 }; }
  private missileHome() { return { x: this.stageW - 150, y: this.stageH - 52 }; }

  private inDragZone(p: { x: number; y: number }): boolean {
    return p.x < this.stageW * 0.55 && p.y > this.stageH * 0.35;
  }
  private inFireZone(p: { x: number; y: number }): boolean {
    const h = this.fireHome();
    return Math.hypot(p.x - h.x, p.y - h.y) <= FIRE_R + 14;
  }
  private inMissileZone(p: { x: number; y: number }): boolean {
    const h = this.missileHome();
    return Math.hypot(p.x - h.x, p.y - h.y) <= MISSILE_R + 14;
  }

  private build(): void {
    this.padBase = new Graphics();
    this.padKnob = new Graphics();
    this.fireBtn = new Graphics();
    this.missileBtn = new Graphics();
    this.view.addChild(this.padBase, this.padKnob, this.fireBtn, this.missileBtn);
    this.view.visible = false;
    this.view.eventMode = 'none'; // pure display; canvas-level zones own hit tests
    this.redraw();
  }

  private redraw(): void {
    // drag pad: shown at the active touch origin (or a hint ring at rest)
    const o = this.drag ? this.dragOrigin : { x: this.stageW * 0.27, y: this.stageH - 90 };
    this.padBase.clear()
      .circle(o.x, o.y, 40).stroke({ width: 2, color: 0x8a8aa0, alpha: 0.9 })
      .circle(o.x, o.y, 40).fill({ color: 0x30303f, alpha: 0.5 });
    const kx = o.x + (this.drag?.x ?? 0) * 40;
    const ky = o.y + (this.drag?.y ?? 0) * 40;
    this.padKnob.clear()
      .circle(kx, ky, 16).fill({ color: 0xf5c542, alpha: 0.85 }).stroke({ width: 1, color: 0x000000 });

    const f = this.fireHome();
    this.fireBtn.clear()
      .circle(f.x, f.y, FIRE_R)
      .fill({ color: this.fire ? 0xd43a3a : 0x8a2430, alpha: 0.85 })
      .stroke({ width: 2, color: 0xf5c542, alpha: 0.9 });
    const m = this.missileHome();
    this.missileBtn.clear()
      .circle(m.x, m.y, MISSILE_R)
      .fill({ color: this.missilePointer >= 0 ? 0xd4a53a : 0x6a5a20, alpha: 0.85 })
      .stroke({ width: 2, color: 0xf5c542, alpha: 0.9 });
  }

  private applyVisibility(): void {
    const want = this.coarse && this.active;
    if (want !== this.shown) { this.shown = want; this.view.visible = want; }
    this.view.alpha = this.baseAlpha;
  }

  /** call each frame; re-checks the coarse-pointer media query cheaply */
  tick(): void {
    this.coarse = matchMedia('(pointer: coarse)').matches || this.coarse;
    this.applyVisibility();
    this.redraw();
  }
}
