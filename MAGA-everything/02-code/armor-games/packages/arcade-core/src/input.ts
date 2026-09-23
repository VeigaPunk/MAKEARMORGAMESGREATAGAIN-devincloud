/**
 * Unified input for MAGA replicas: one API over keyboard (desktop) and
 * pointer/touch (mobile). Games read abstract actions, never raw events.
 *
 * BH-2: two independent keyboard players on one keyboard (local co-op /
 * deathmatch). P1 keeps the original backward-compatible API (`isDown`,
 * `wasPressed`, `moveAxis`); P2 gets the `*2` variants.
 *
 * Modes: `solo` (default) gives P1 both WASD and arrows; `versus` splits the
 * keyboard — P1 WASD, P2 arrows + shoot cluster. Call `setMode()` when the
 * game mode is chosen. Default keymaps are PROVISIONAL — exact originals TBD
 * from ARCADE capture (see app README).
 */

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'fire' | 'action'
  | 'slot1' | 'slot2' | 'slot3'
  | 'pause'
  | 'fireUp' | 'fireLeft' | 'fireDown' | 'fireRight';

export type Keymap = Record<string, Action>;

/** P1 in versus/2P: WASD move only (arrows belong to P2) */
export const KEYMAP_P1_VERSUS: Keymap = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'fire', KeyJ: 'fire', Enter: 'fire',
  KeyE: 'action', KeyK: 'action', KeyM: 'action',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3',
  Escape: 'pause', KeyP: 'pause',
};

/** P1 in solo: WASD + arrows (single player owns the whole keyboard) */
export const KEYMAP_P1_SOLO: Keymap = {
  ...KEYMAP_P1_VERSUS,
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};

/**
 * P2 (versus only): arrows move + shoot cluster. Numpad 8/4/5/6 fire up/left/
 * down/right (directional fire, like P1 facing-fire); IJKL as the no-numpad
 * fallback. TBD ARCADE — replace with captured original 2P keymap.
 */
export const KEYMAP_P2: Keymap = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Numpad8: 'fireUp', Numpad4: 'fireLeft', Numpad5: 'fireDown', Numpad6: 'fireRight',
  KeyI: 'fireUp', KeyJ: 'fireLeft', KeyK: 'fireDown', KeyL: 'fireRight',
};

export interface PointerState {
  /** true while a finger/mouse button is held down */
  active: boolean;
  /** position in canvas logical units, updated on down/move */
  x: number;
  y: number;
  /** true if the last press was a short tap (action trigger) */
  tapped: boolean;
  /** true after the first real pointer event (headless/boot position is not a real aim) */
  seen: boolean;
}

interface PlayerState {
  down: Set<Action>;
  pressed: Set<Action>;
}

export type InputMode = 'solo' | 'versus';

export class Input {
  private p1: PlayerState = { down: new Set(), pressed: new Set() };
  private p2: PlayerState = { down: new Set(), pressed: new Set() };
  private mode: InputMode = 'solo';
  private overrides: { p1?: Keymap; p2?: Keymap } = {};
  private map1: Keymap = { ...KEYMAP_P1_SOLO };
  private map2: Keymap = { ...KEYMAP_P2 };
  readonly pointer: PointerState = { active: false, x: 0, y: 0, tapped: false, seen: false };

  /** switch keyboard ownership: solo = P1 gets everything; versus = split */
  setMode(mode: InputMode): void {
    this.mode = mode;
    this.rebuild();
  }

  private rebuild(): void {
    const base1 = this.mode === 'solo' ? KEYMAP_P1_SOLO : KEYMAP_P1_VERSUS;
    this.map1 = { ...base1, ...this.overrides.p1 };
    this.map2 = { ...KEYMAP_P2, ...this.overrides.p2 };
  }

  /** attach to the canvas (or window) that receives events */
  attach(canvas: HTMLCanvasElement, toLogical: (cx: number, cy: number) => { x: number; y: number }): void {
    window.addEventListener('keydown', (e) => {
      // rebind hook: maps are live, lookups happen per event; a code may be
      // bound on both players (user rebind) — feed every bound player
      const a1 = this.map1[e.code];
      const a2 = this.map2[e.code];
      if (a1 === undefined && a2 === undefined) return;
      e.preventDefault();
      if (a1 !== undefined) {
        if (!this.p1.down.has(a1)) this.p1.pressed.add(a1);
        this.p1.down.add(a1);
      }
      if (a2 !== undefined) {
        if (!this.p2.down.has(a2)) this.p2.pressed.add(a2);
        this.p2.down.add(a2);
      }
    });
    window.addEventListener('keyup', (e) => {
      const a1 = this.map1[e.code];
      const a2 = this.map2[e.code];
      if (a1) this.p1.down.delete(a1);
      if (a2) this.p2.down.delete(a2);
    });

    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return toLogical(e.clientX - r.left, e.clientY - r.top);
    };
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      this.pointer.active = true;
      this.pointer.seen = true;
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.pointer.tapped = false;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic/edge pointers */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      this.pointer.seen = true;
      // track hover always (aim), drag intent only while held (moveAxis)
      this.pointer.x = p.x; this.pointer.y = p.y;
    });
    const release = () => {
      this.pointer.active = false;
      this.pointer.tapped = true; // short-press semantics: tap = action
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  // --- P1 (backward-compatible API) -------------------------------------------
  isDown(a: Action): boolean { return this.p1.down.has(a); }
  /** true only on the frame the action went down */
  wasPressed(a: Action): boolean { return this.p1.pressed.has(a); }
  /** 8-way movement vector from keys or pointer drag, normalized.
   *  `pointerDrag=false` disables the drag fallback — touch games with a
   *  virtual stick pass false so field taps never move the player (D-15). */
  moveAxis(centerX: number, centerY: number, dragRadius: number, pointerDrag = true): { x: number; y: number } {
    let x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let y = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);
    if (x === 0 && y === 0 && pointerDrag && this.pointer.active) {
      const dx = this.pointer.x - centerX;
      const dy = this.pointer.y - centerY;
      const d = Math.hypot(dx, dy);
      if (d > dragRadius * 0.25) {
        x = dx / d; y = dy / d;
      }
    }
    return { x, y };
  }

  // --- P2 (versus mode) ---------------------------------------------------------
  isDown2(a: Action): boolean { return this.p2.down.has(a); }
  wasPressed2(a: Action): boolean { return this.p2.pressed.has(a); }
  /** P2 movement from the arrow-key cluster (no pointer fallback) */
  moveAxis2(): { x: number; y: number } {
    return {
      x: (this.isDown2('right') ? 1 : 0) - (this.isDown2('left') ? 1 : 0),
      y: (this.isDown2('down') ? 1 : 0) - (this.isDown2('up') ? 1 : 0),
    };
  }
  /**
   * P2 directional fire vector from the shoot cluster. Null when no shoot key
   * is held — games should only fire while a direction is held (facing-fire).
   */
  fireAxis2(): { x: number; y: number } | null {
    const x = (this.isDown2('fireRight') ? 1 : 0) - (this.isDown2('fireLeft') ? 1 : 0);
    const y = (this.isDown2('fireDown') ? 1 : 0) - (this.isDown2('fireUp') ? 1 : 0);
    if (x === 0 && y === 0) return null;
    const d = Math.hypot(x, y);
    return { x: x / d, y: y / d };
  }

  // --- rebind (BH-2.5) ----------------------------------------------------------
  /** Persist/load-friendly: replace keymaps on top of mode defaults. */
  setKeymaps(maps: { p1?: Keymap; p2?: Keymap }): void {
    this.overrides = { ...this.overrides, ...maps };
    this.rebuild();
  }
  /** current effective keymaps (for rebind UI / persistence) */
  getKeymaps(): { p1: Keymap; p2: Keymap } {
    return { p1: { ...this.map1 }, p2: { ...this.map2 } };
  }

  /** call at end of every frame */
  endFrame(): void {
    this.p1.pressed.clear();
    this.p2.pressed.clear();
    this.pointer.tapped = false;
  }
}
