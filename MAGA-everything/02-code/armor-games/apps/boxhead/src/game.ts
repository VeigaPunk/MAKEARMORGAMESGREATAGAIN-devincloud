import { Application, Assets, Container, Graphics, Sprite, Text, TilingSprite, type Texture } from 'pixi.js';
import { Input, Sfx, load, save } from '@maga/arcade-core';
import {
  AmmoCrate, Barrel, BlastRing, Player, Projectile, Zombie,
  clamp, dist, type Vec,
} from './entities';
import { ROOMS, WAVE_TABLES, ScoreSystem, ammoPerShot, fireDelay, type ArenaRoom } from './world';
import { TouchControls } from './touch';

/**
 * Boxhead native replica — BH-2: local 2P (co-op + deathmatch) + touch layout C.
 * Combat tables are TBD ARCADE placeholders (see world.ts).
 * Keyboard-only combat per concept spec: shots fire in facing direction;
 * mouse aim is optional sugar on desktop.
 */

const STAGE_W = 640;
const STAGE_H = 400; // provisional, UNVERIFIED until ARCADE measures the original
const MAX_WAVE = 3;
const CRATE_AMMO = 16;
const BARREL_RADIUS = 55;
const BARREL_PLAYER_DAMAGE = 25;
const DM_TARGET_KILLS = 5; // deathmatch scoring rule STUB — TBD ARCADE
const DM_RESPAWN = 1.4;

const P1_COLOR = 0xe8e8f0;
const P2_COLOR = 0x7ab8ff;

type GameState = 'title' | 'mode' | 'room' | 'playing' | 'paused' | 'dead' | 'victory';
type Mode = 'solo' | 'coop' | 'deathmatch';

/** per-player runtime state */
interface PlayerSlot {
  p: Player;
  cooldown: number;
  lastPointerAim: Vec | null;
  pointerAimAge: number;
  kills: number; // deathmatch scoring
  respawnTimer: number; // deathmatch
  alive: boolean;
}

export class Game {
  private world = new Container();
  private menu = new Container();
  private hud = new Container();

  private state: GameState = 'title';
  private mode: Mode = 'solo';
  private room: ArenaRoom = ROOMS[0];

  private slots: PlayerSlot[] = [];
  private zombies: Zombie[] = [];
  private bullets: Projectile[] = [];
  private crates: AmmoCrate[] = [];
  private barrels: Barrel[] = [];
  private blasts: BlastRing[] = [];

  private spawnQueue = 0;
  private spawnTimer = 0;
  private wave = 0;
  private waveBreak = 0;
  private crateTimer = 8;
  /** D-08 enabler: ?stress tops the field up to ~100 movers so the F3
   *  50–100-mover budget is measurable (wave tables cap at 14). Debug-only. */
  private stress = new URLSearchParams(location.search).has('stress');
  private high = 0;
  private scoreSys = new ScoreSystem();

  private hudText!: Text;
  private banner!: Text;
  private menuChip = new Container();
  /** direct-authored art (public/art/*.svg); menus/arena work without them,
   *  these decorate once the async load resolves. */
  private logoTex: Texture | null = null;
  private floorTex: Texture | null = null;

  constructor(
    private app: Application,
    private input: Input,
    private sfx: Sfx,
    private touch: TouchControls,
  ) {
    this.high = load('boxhead', 'highscore', 0);
    // BH-2.5 rebind stub: load saved keymap JSON (merged over mode defaults).
    // We deliberately do NOT persist the resolved defaults — saving mode-mixed
    // maps would pollute the other mode on the next boot (solo keeps arrows on
    // P1, versus gives them to P2). Save only genuine user rebinds here.
    const savedKeys = load<{ p1?: Record<string, never>; p2?: Record<string, never> } | null>('boxhead', 'keymaps', null);
    if (savedKeys) input.setKeymaps(savedKeys);
    app.stage.addChild(this.world);
    app.stage.addChild(this.menu);
    app.stage.addChild(this.hud);
    app.stage.addChild(touch.view);

    this.hudText = new Text({ text: '', style: { fill: 0xf5c542, fontSize: 12, fontFamily: 'monospace', lineHeight: 16 } });
    this.hudText.x = 14;
    this.hudText.y = 10;
    this.hud.addChild(this.hudText);

    this.banner = new Text({
      text: '',
      style: { fill: 0xffffff, fontSize: 17, fontFamily: 'monospace', align: 'center', lineHeight: 25 },
    });
    this.banner.anchor = 0.5;
    this.banner.x = STAGE_W / 2;
    this.banner.y = STAGE_H / 2 - 30;
    this.hud.addChild(this.banner);

    // touch MENU chip for end screens (D-14): phones have no M key.
    const chipBg = new Graphics()
      .roundRect(-64, -18, 128, 36, 6)
      .fill({ color: 0x1a1a24, alpha: 0.92 })
      .stroke({ width: 1, color: 0xf5c542 });
    const chipText = new Text({ text: 'MENU', style: { fill: 0xf5c542, fontSize: 14, fontFamily: 'monospace' } });
    chipText.anchor = 0.5;
    this.menuChip.addChild(chipBg, chipText);
    this.menuChip.x = STAGE_W / 2;
    this.menuChip.y = STAGE_H - 44;
    this.menuChip.visible = false;
    this.hud.addChild(this.menuChip);
    // authored art preload — decorative only; failures leave procedural look.
    Assets.load<Texture>('/art/boxhead-logo.svg')
      .then((t) => { this.logoTex = t; if (this.state === 'title') this.showTitle(); })
      .catch(() => { /* keep text-only title */ });
    Assets.load<Texture>('/art/floor-tile.svg')
      .then((t) => { this.floorTex = t; })
      .catch(() => { /* keep flat arena fill */ });
    this.showTitle();
  }

  get player(): Player { return this.slots[0].p; }

  // --- menus -----------------------------------------------------------------
  private clearMenu(): void {
    this.menu.removeChildren().forEach((c) => c.destroy());
  }

  private menuText(lines: string[], yStart = 120): void {
    lines.forEach((line, i) => {
      const t = new Text({
        text: line,
        style: {
          fill: i === 0 ? 0xf5c542 : 0xe8e8f0,
          fontSize: i === 0 ? 26 : 15,
          fontFamily: 'monospace',
          align: 'center',
        },
      });
      t.anchor = 0.5;
      t.x = STAGE_W / 2;
      t.y = yStart + i * 30;
      this.menu.addChild(t);
    });
  }

  private showTitle(): void {
    this.state = 'title';
    this.sfx.stopMusic();
    this.clearMenu();
    this.world.visible = false;
    this.hud.visible = false;
    if (this.logoTex) {
      const logo = new Sprite(this.logoTex);
      logo.anchor.set(0.5);
      logo.x = STAGE_W / 2;
      logo.y = 72;
      logo.scale.set(0.72);
      this.menu.addChild(logo);
    }
    this.menuText([
      'BOXHEAD — 2PLAY ROOMS (native replica)',
      'INTERNAL-NO-PUBLIC build · localhost only',
      '',
      'PRESS SPACE / ENTER / TAP TO CONTINUE',
    ], 150);
  }

  private showModeSelect(): void {
    this.state = 'mode';
    // D-18: end-of-run banner + stale HUD must not bleed onto menus
    this.banner.text = '';
    this.hud.visible = false;
    this.clearMenu();
    this.menuText([
      'SELECT MODE',
      '1 — SOLO SURVIVAL (WASD or arrows + Space/J)',
      '2 — LOCAL CO-OP (P1 WASD+Space · P2 arrows+IJKL/numpad)',
      '3 — LOCAL DEATHMATCH (first to 5 kills — rule TBD ARCADE)',
      '',
      'Press 1 / 2 / 3 (or tap to pick Solo)',
    ], 96);
  }

  private showRoomSelect(): void {
    this.state = 'room';
    this.clearMenu();
    this.menuText([
      'SELECT ROOM',
      `1 — ${ROOMS[0].name}`,
      `2 — ${ROOMS[1].name}`,
      '',
      'Press 1 / 2 (or tap to pick room 1)',
    ], 120);
  }

  // --- run lifecycle ------------------------------------------------------------
  private startRun(roomIdx: number): void {
    this.room = ROOMS[clamp(roomIdx, 0, ROOMS.length - 1)];
    this.clearMenu();
    this.clearField();
    this.world.visible = true;
    this.hud.visible = true;

    // room geometry
    this.world.removeChildren().forEach((c) => c.destroy());
    const arena = new Graphics();
    arena.rect(10, 10, STAGE_W - 20, STAGE_H - 20).fill(0x101018).stroke({ width: 2, color: 0x2a2a3a });
    for (const o of this.room.obstacles) {
      arena.rect(o.x, o.y, o.w, o.h).fill(0x2c2c3c).stroke({ width: 1, color: 0x44445c });
    }
    this.world.addChild(arena);
    if (this.floorTex) {
      // authored floor tile over the flat fill — same base color (0x101018),
      // so this only adds the subtle grid/grime layer; entities draw above.
      const floor = new TilingSprite({ texture: this.floorTex, width: STAGE_W - 20, height: STAGE_H - 20 });
      floor.x = 10;
      floor.y = 10;
      floor.alpha = 0.85;
      this.world.addChild(floor);
    }

    const twoPlayer = this.mode !== 'solo';
    this.input.setMode(twoPlayer ? 'versus' : 'solo');

    this.slots = [{
      p: new Player(this.room.spawn.x, this.room.spawn.y, P1_COLOR),
      cooldown: 0, lastPointerAim: null, pointerAimAge: 99, kills: 0, respawnTimer: 0, alive: true,
    }];
    this.world.addChild(this.slots[0].p.g);
    if (twoPlayer) {
      this.slots.push({
        p: new Player(this.room.spawn2.x, this.room.spawn2.y, P2_COLOR),
        cooldown: 0, lastPointerAim: null, pointerAimAge: 99, kills: 0, respawnTimer: 0, alive: true,
      });
      this.world.addChild(this.slots[1].p.g);
    }

    for (const b of this.room.barrels) {
      const barrel = new Barrel({ ...b });
      this.barrels.push(barrel);
      this.world.addChild(barrel.g);
    }

    this.scoreSys = new ScoreSystem();
    this.wave = 0;
    this.crateTimer = 8; // D-10: stale timer carried an instant crate into retries
    this.state = 'playing';
    this.banner.text = '';
    // BH-3.2 music slot: placeholder combat bed — MAESTRO replaces the pattern.
    this.sfx.startMusic([110, 0, 110, 0, 131, 0, 98, 0], 160);
    if (this.mode === 'deathmatch') {
      this.spawnQueue = 0;
    } else {
      this.nextWave();
    }
  }

  private nextWave(): void {
    this.wave += 1;
    if (this.wave > MAX_WAVE) {
      this.state = 'victory';
      this.persistHigh();
      this.sfx.stopMusic();
      this.banner.text =
        `WAVE ${MAX_WAVE} CLEARED (${this.mode === 'coop' ? 'CO-OP' : 'SOLO'})\n` +
        `SCORE ${this.scoreSys.score} · BEST ${this.high}\n` +
        `SPACE / tap — run it again · M — menu`;
      this.sfx.preset('pickup');
      return;
    }
    const def = WAVE_TABLES[this.wave - 1];
    this.spawnQueue = def.count;
    this.spawnTimer = 0.5;
    this.waveBreak = 0;
    this.sfx.preset('ui');
  }

  private gameOver(): void {
    this.state = 'dead';
    this.persistHigh();
    this.sfx.stopMusic();
    this.banner.text =
      `OVERRUN ON WAVE ${this.wave} (${this.room.name})\n` +
      `SCORE ${this.scoreSys.score} · BEST ${this.high}\n` +
      `SPACE / tap — retry · M — menu`;
  }

  private dmEnd(winner: number): void {
    this.state = 'victory';
    this.sfx.stopMusic();
    this.banner.text =
      `P${winner + 1} WINS THE DEATHMATCH ${this.slots[winner].kills}–${this.slots[1 - winner].kills}\n` +
      `(scoring rule is a STUB — TBD ARCADE)\n` +
      `SPACE / tap — rematch · M — menu`;
  }

  private persistHigh(): void {
    if (this.scoreSys.score > this.high) {
      this.high = this.scoreSys.score;
      save('boxhead', 'highscore', this.high);
    }
  }

  private clearField(): void {
    for (const z of this.zombies) z.destroy();
    for (const b of this.bullets) b.destroy();
    for (const c of this.crates) c.g.destroy();
    for (const bl of this.blasts) bl.destroy();
    for (const s of this.slots) s.p.g.destroy();
    this.zombies = [];
    this.bullets = [];
    this.crates = [];
    this.barrels = [];
    this.blasts = [];
    this.slots = [];
    this.spawnQueue = 0;
  }

  // --- main tick -----------------------------------------------------------------
  tick(dt: number): void {
    // touch zones exist only during gameplay — menus/end screens get raw taps
    this.touch.setActive(this.state === 'playing');
    this.menuChip.visible = this.state === 'dead' || this.state === 'victory';
    if (this.state === 'playing' && this.input.wasPressed('pause')) {
      this.state = 'paused';
      this.banner.text = 'PAUSED\nESC / P — resume · M / ENTER — menu';
    } else if (this.state === 'paused') {
      if (this.input.wasPressed('pause')) {
        this.state = 'playing';
        this.banner.text = '';
      } else if (this.input.wasPressed('action') || this.input.pointer.tapped) {
        // Pause remains keyboard- and touch-accessible; tapping the banner quits.
        this.showModeSelect();
      }
    } else switch (this.state) {
      case 'title':
        if (this.input.wasPressed('fire') || this.input.wasPressed('action') || this.input.pointer.tapped) this.showModeSelect();
        break;
      case 'mode':
        if (this.input.wasPressed('slot1') || this.input.wasPressed('fire') || this.input.pointer.tapped) {
          this.mode = 'solo';
          this.showRoomSelect();
        } else if (this.input.wasPressed('slot2')) {
          this.mode = 'coop';
          this.showRoomSelect();
        } else if (this.input.wasPressed('slot3')) {
          this.mode = 'deathmatch';
          this.showRoomSelect();
        }
        break;
      case 'room':
        if (this.input.wasPressed('slot2')) this.startRun(1);
        else if (this.input.wasPressed('slot1') || this.input.wasPressed('fire') || this.input.pointer.tapped) this.startRun(0);
        break;
      case 'playing':
        this.tickPlaying(dt);
        break;
      case 'dead':
      case 'victory': {
        // D-14: touch has no keys — tap retries, MENU chip tap exits
        const p = this.input.pointer;
        const chipTap = p.tapped && Math.abs(p.x - STAGE_W / 2) < 64 && Math.abs(p.y - (STAGE_H - 44)) < 20;
        if (this.input.wasPressed('action') || chipTap) this.showModeSelect();
        else if (this.input.wasPressed('fire') || p.tapped) this.startRun(ROOMS.indexOf(this.room));
        break;
      }
    }
    this.touch.tick();
    this.input.endFrame();
  }

  private tickPlaying(dt: number): void {
    // D-16: cap gameplay time so tab-throttled frames cannot consume invulnerability
    // in one jump and let stacked movers deliver several hits at once.
    const gameplayDt = Math.min(dt, 0.05);
    dt = gameplayDt;
    this.updatePlayers(dt);
    if (this.mode !== 'deathmatch') {
      this.updateSpawning(dt);
      this.updateZombies(dt);
    }
    this.updateBullets(dt);
    this.updateProps(dt);
    this.scoreSys.tick(dt);
    this.updateHud();

    if (this.mode === 'deathmatch') {
      // handled in bullet/player collisions (dmEnd)
    } else if (this.slots.every((s) => !s.alive)) {
      this.gameOver();
    }
  }


  // --- players -------------------------------------------------------------------
  private updatePlayers(dt: number): void {
    this.slots.forEach((slot, idx) => {
      if (!slot.alive) {
        if (this.mode === 'deathmatch') {
          slot.respawnTimer -= dt;
          if (slot.respawnTimer <= 0) this.respawn(idx);
        }
        return;
      }
      slot.p.tickFlash(dt);

      const coarse = matchMedia('(pointer: coarse)').matches;
      let axis: Vec;
      if (idx === 0) {
        // keyboard or virtual stick; on touch the stick owns movement — field
        // taps must not drag the player (D-15)
        axis = this.touch.stick ?? this.input.moveAxis(slot.p.pos.x, slot.p.pos.y, 30, !coarse);
      } else {
        axis = this.input.moveAxis2();
      }
      slot.p.move(axis, dt, { w: STAGE_W, h: STAGE_H }, this.room.obstacles);

      slot.cooldown -= dt;

      if (idx === 0) {
        // optional mouse aim on desktop (last pointer position wins for 2s)
        const p = this.input.pointer;
        slot.pointerAimAge += dt;
        if (!coarse && p.seen && (p.active || dist(p, slot.p.pos) > 24)) {
          slot.lastPointerAim = { x: p.x, y: p.y };
          slot.pointerAimAge = 0;
        }
        // D-15: on touch only the FIRE button shoots — any-canvas-touch firing
        // made the movement stick drain ammo
        const wantsFire = this.input.isDown('fire') || this.touch.fire;
        if (wantsFire && slot.cooldown <= 0) this.tryFire(slot, idx);
      } else {
        const fa = this.input.fireAxis2();
        if (fa) slot.p.facing = fa; // P2 aims with the shoot cluster itself
        if (fa && slot.cooldown <= 0) this.tryFire(slot, idx);
      }
    });
  }

  private respawn(idx: number): void {
    const slot = this.slots[idx];
    const s = idx === 0 ? this.room.spawn : this.room.spawn2;
    slot.p.pos = { ...s };
    slot.p.hp = 100;
    slot.p.invuln = 2;
    slot.p.ammo = 24;
    slot.alive = true;
    slot.p.g.visible = true;
    slot.p.g.x = s.x;
    slot.p.g.y = s.y;
  }

  private aimDir(slot: PlayerSlot): Vec {
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      // auto-aim nearest zombie; in deathmatch aim at the opponent
      const target = this.mode === 'deathmatch'
        ? (this.slots.find((s) => s !== slot && s.alive)?.p.pos ?? null)
        : this.nearestZombie(slot.p.pos)?.pos ?? null;
      if (target) {
        const d = dist(target, slot.p.pos) || 1;
        return { x: (target.x - slot.p.pos.x) / d, y: (target.y - slot.p.pos.y) / d };
      }
    }
    if (slot.lastPointerAim && slot.pointerAimAge < 2 && !coarse) {
      const d = dist(slot.lastPointerAim, slot.p.pos);
      if (d > 4) {
        return { x: (slot.lastPointerAim.x - slot.p.pos.x) / d, y: (slot.lastPointerAim.y - slot.p.pos.y) / d };
      }
    }
    return slot.p.facing;
  }

  private tryFire(slot: PlayerSlot, owner: number): void {
    const weapon = this.scoreSys.weaponForMult();
    const cost = ammoPerShot(weapon);
    if (slot.p.ammo < cost) {
      slot.cooldown = 0.25;
      this.sfx.blip({ wave: 'square', freq: 140, freqEnd: 90, duration: 0.05, volume: 0.5 }); // dry click
      return;
    }
    slot.p.ammo -= cost;
    slot.cooldown = fireDelay(weapon);

    const dir = this.aimDir(slot);
    const from = { x: slot.p.pos.x + dir.x * 14, y: slot.p.pos.y + dir.y * 14 };
    const speed = 340;
    const shoot = (d: Vec, kind: 'bullet' | 'grenade' = 'bullet') => {
      const b = new Projectile({ ...from }, { x: d.x * speed, y: d.y * speed }, kind);
      (b as Projectile & { owner?: number }).owner = owner;
      if (kind === 'grenade') (b as Projectile & { grenade?: boolean }).grenade = true;
      this.bullets.push(b);
      this.world.addChild(b.g);
    };
    if (weapon === 'grenades') {
      // lobbed AoE shell — detonates on first contact/expiry (D-03)
      shoot(dir, 'grenade');
    } else {
      shoot(dir);
      if (weapon === 'shotgun') {
        const a = Math.atan2(dir.y, dir.x);
        for (const off of [-0.24, 0.24]) {
          shoot({ x: Math.cos(a + off), y: Math.sin(a + off) });
        }
      }
    }
    this.sfx.preset('shoot');
  }

  // --- zombies -------------------------------------------------------------------
  private updateSpawning(dt: number): void {
    if (this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const def = WAVE_TABLES[this.wave - 1];
        const runner = def.runners > 0 && this.spawnQueue <= def.runners;
        this.spawnZombie(runner, def.speed);
        this.spawnQueue -= 1;
        this.spawnTimer = def.spawnEvery;
      }
    } else if (this.zombies.length === 0) {
      this.waveBreak += dt;
      if (this.waveBreak > 2.5) this.nextWave();
    }
    // D-08: ?stress keeps ~100 movers on the field, including runner variants.
    if (this.stress && this.zombies.length < 100) this.spawnZombie(Math.random() < 0.35, 60 + Math.random() * 40);
  }

  private spawnZombie(runner: boolean, speed: number): void {
    const edge = Math.floor(Math.random() * 4);
    const pos: Vec =
      edge === 0 ? { x: 22, y: 22 + Math.random() * (STAGE_H - 44) } :
      edge === 1 ? { x: STAGE_W - 22, y: 22 + Math.random() * (STAGE_H - 44) } :
      edge === 2 ? { x: 22 + Math.random() * (STAGE_W - 44), y: 22 } :
                   { x: 22 + Math.random() * (STAGE_W - 44), y: STAGE_H - 22 };
    const z = new Zombie(pos, speed, runner);
    this.zombies.push(z);
    this.world.addChild(z.g);
  }

  private updateZombies(dt: number): void {
    for (const z of this.zombies) {
      // chase the nearest living player
      let target: Player | null = null;
      let bd = Infinity;
      for (const s of this.slots) {
        if (!s.alive) continue;
        const d = dist(z.pos, s.p.pos);
        if (d < bd) { bd = d; target = s.p; }
      }
      if (!target) continue;
      z.chase(target.pos, dt, { w: STAGE_W, h: STAGE_H }, this.room.obstacles, this.zombies);
      for (const s of this.slots) {
        if (!s.alive || s.p.invuln > 0) continue;
        if (dist(z.pos, s.p.pos) < 14) {
          s.p.hp -= 10; // TBD ARCADE
          s.p.invuln = 0.8;
          this.scoreSys.playerHit();
          this.sfx.preset('hit');
          if (s.p.hp <= 0) {
            s.alive = false;
            s.p.g.visible = false;
            this.sfx.preset('death');
          }
        }
      }
    }
  }

  // --- bullets -------------------------------------------------------------------
  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const owner = (b as Projectile & { owner?: number }).owner ?? 0;
      const alive = b.tick(dt) && !b.hitSolid(this.room.obstacles, { w: STAGE_W, h: STAGE_H });
      let dead = !alive;

      if (!dead) {
        for (const barrel of this.barrels) {
          if (!barrel.exploded && barrel.fuse < 0 && dist(barrel.pos, b.pos) < 10) {
            barrel.fuse = 0;
            dead = true;
            break;
          }
        }
      }

      if (!dead) {
        for (let j = this.zombies.length - 1; j >= 0; j--) {
          const z = this.zombies[j];
          if (dist(z.pos, b.pos) < 11) {
            z.hp -= 1;
            dead = true;
            if (z.hp <= 0) {
              this.scoreSys.kill();
              z.destroy();
              this.zombies.splice(j, 1);
            } else {
              z.hitFlash = 0.1;
            }
            break;
          }
        }
      }

      if (!dead) {
        // players hit by bullets only in deathmatch; a bullet never hits its
        // owner (it spawns 14px out, inside the 11px hitbox radius)
        if (this.mode === 'deathmatch') {
          for (let k = 0; k < this.slots.length; k++) {
            if (k === owner) continue;
            const slot = this.slots[k];
            if (!slot.alive || slot.p.invuln > 0) continue;
            if (dist(slot.p.pos, b.pos) < 11) {
              slot.p.hp -= 10; // TBD ARCADE
              dead = true;
              if (slot.p.hp <= 0) {
                slot.alive = false;
                slot.p.g.visible = false;
                slot.respawnTimer = DM_RESPAWN;
                const killer = this.slots[1 - k];
                killer.kills += 1;
                this.sfx.preset('death');
                if (killer.kills >= DM_TARGET_KILLS) this.dmEnd(1 - k);
              } else {
                slot.p.invuln = 0.35;
                this.sfx.preset('hit');
              }
              break;
            }
          }
        }
      }

      if (dead) {
        // grenades detonate on ANY termination — hit, wall, or expiry (D-03)
        if ((b as Projectile & { grenade?: boolean }).grenade) this.detonate(b.pos, 60, (b as Projectile & { owner?: number }).owner);
        b.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  // --- props ---------------------------------------------------------------------
  private updateProps(dt: number): void {
    // DD-77 / DD-18: spec has no DM pickups; crates are enabled in all modes
    // as the deadlock fix pending ARCADE ruling on the no-pickup divergence.
      this.crateTimer -= dt;
      if (this.crateTimer <= 0 && this.crates.length < 2) {
        this.crateTimer = 12;
        const pos = this.freeSpot();
        if (pos) {
          const c = new AmmoCrate(pos);
          this.crates.push(c);
          this.world.addChild(c.g);
        }
      }
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const c = this.crates[i];
        for (const s of this.slots) {
          if (!s.alive) continue;
          if (dist(c.pos, s.p.pos) < 15) {
            s.p.ammo += CRATE_AMMO;
            this.sfx.preset('pickup');
            c.take();
            this.crates.splice(i, 1);
            break;
          }
        }
      }

    // barrels: fuses and chain reactions
    for (const barrel of this.barrels) {
      if (barrel.exploded) continue;
      if (barrel.fuse >= 0) {
        barrel.fuse += dt;
        if (barrel.fuse > 0.12) this.explodeBarrel(barrel);
      }
    }

    // blast VFX
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      if (!this.blasts[i].tick(dt)) {
        this.blasts[i].destroy();
        this.blasts.splice(i, 1);
      }
    }
  }

  private explodeBarrel(barrel: Barrel): void {
    barrel.explode();
    this.detonate(barrel.pos, BARREL_RADIUS);
  }
  /** shared AoE: barrels and grenade shells (D-03). Kills zombies in radius,
   *  damages players in 0.8×radius, chains unlit barrels.
   *  D-19 ruling: a grenade's OWNER is exempt from its blast (fired weapon,
   *  not environmental hazard like barrels); partners still take friendly
   *  fire — era-consistent co-op chaos, recorded for ARCADE review. */
  private detonate(pos: Vec, radius: number, owner?: number): void {

    const ring = new BlastRing(pos, radius);
    this.blasts.push(ring);
    this.world.addChild(ring.g);
    this.sfx.blip({ wave: 'sawtooth', freq: 90, freqEnd: 30, duration: 0.35, volume: 0.9 });

    for (let j = this.zombies.length - 1; j >= 0; j--) {
      const z = this.zombies[j];
      if (dist(z.pos, pos) < radius) {
        this.scoreSys.kill();
        z.destroy();
        this.zombies.splice(j, 1);
      }
    }
    for (const s of this.slots) {
      if (!s.alive || s.p.invuln > 0) continue;
      if (owner !== undefined && this.slots.indexOf(s) === owner) continue; // D-19: shooter exempt from own grenade
      if (dist(s.p.pos, pos) < radius * 0.8) {
        s.p.hp -= BARREL_PLAYER_DAMAGE;
        s.p.invuln = 0.8;
        if (this.mode !== 'deathmatch') this.scoreSys.playerHit();
        this.sfx.preset('hit');
        if (s.p.hp <= 0) {
          s.alive = false;
          s.p.g.visible = false;
          this.sfx.preset('death');
          if (this.mode === 'deathmatch') {
            // no kill credit for AoE (stub) — just respawn
            s.respawnTimer = DM_RESPAWN;
          }
        }
      }
    }
    // chain other barrels
    for (const other of this.barrels) {
      if (!other.exploded && other.fuse < 0 && dist(other.pos, pos) < radius) {
        other.fuse = 0;
      }
    }
  }

  private freeSpot(): Vec | null {
    for (let tries = 0; tries < 20; tries++) {
      const pos = { x: 40 + Math.random() * (STAGE_W - 80), y: 40 + Math.random() * (STAGE_H - 80) };
      if (this.slots.some((s) => dist(pos, s.p.pos) < 60)) continue;
      const r = { x: pos.x - 8, y: pos.y - 6, w: 16, h: 12 };
      if (this.room.obstacles.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y)) continue;
      return pos;
    }
    return null;
  }

  private nearestZombie(from: Vec): Zombie | null {
    let best: Zombie | null = null;
    let bd = Infinity;
    for (const z of this.zombies) {
      const d = dist(z.pos, from);
      if (d < bd) { bd = d; best = z; }
    }
    return best;
  }

  private updateHud(): void {
    const w = this.scoreSys.weaponForMult();
    if (this.mode === 'deathmatch') {
      this.hudText.text =
        `DEATHMATCH — P1 ${this.slots[0].kills} · P2 ${this.slots[1]?.kills ?? 0}  (target ${DM_TARGET_KILLS})\n` +
        `P1 HP ${Math.max(0, this.slots[0].p.hp)} AMMO ${this.slots[0].p.ammo}` +
        (this.slots[1] ? `   P2 HP ${Math.max(0, this.slots[1].p.hp)} AMMO ${this.slots[1].p.ammo}` : '');
      return;
    }
    const second = this.slots[1];
    this.hudText.text =
      `WAVE ${this.wave}/${MAX_WAVE}  SCORE ${this.scoreSys.score}  x${this.scoreSys.mult}  ` +
      `HP ${Math.max(0, this.player.hp)}  AMMO ${this.player.ammo}  [${w.toUpperCase()}]  BEST ${this.high}` +
      (second ? `\nP2 HP ${Math.max(0, second.p.hp)}  AMMO ${second.p.ammo}` : '') +
      (this.spawnQueue === 0 && this.zombies.length === 0 ? '  — wave clear…' : '');
  }
}
