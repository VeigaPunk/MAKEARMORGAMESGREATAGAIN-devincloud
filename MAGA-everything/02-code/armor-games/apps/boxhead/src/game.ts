import { Application, Assets, Container, Graphics, Sprite, Text, TilingSprite, type Texture } from 'pixi.js';
import { Input, Sfx, load, save } from '@maga/arcade-core';
import {
  AmmoCrate, Barrel, BlastRing, BloodDecal, MuzzleFlash, Player, Projectile, Zombie,
  clamp, dist, type Vec,
} from './entities';
import {
  ROOMS, WEAPONS, WEAPON_ORDER, ScoreSystem, planWave,
  type ArenaRoom, type EnemyKind, type WavePlan, type WeaponTier,
} from './world';
import { PAL, themeColors } from './palette';
import { COMBAT_SONG, DM_SONG, MENU_SONG, Music, registerBoxheadPresets } from './audio';
import { TouchControls } from './touch';

/**
 * BLOCKHEAD: ARENA NIGHTS — top-down arena survival (original evocation of a
 * 2007 Flash classic; the original's name appears only in records).
 * Solo / local co-op / deathmatch · endless waves · kill-streak weapon ladder.
 */

const STAGE_W = 640;
const STAGE_H = 400;
const CRATE_AMMO = 20;
const CRATE_CAP = 2;
const CRATE_EVERY = 12;
const BARREL_RADIUS = 58;
const BARREL_AOE = 10;
const BARREL_PLAYER_DAMAGE = 25;
const BLAST_PLAYER_DAMAGE = 25;
const DM_TARGET_KILLS = 5;   // deathmatch rule: first to 5 kills
const DM_RESPAWN = 1.5;      // seconds dead before respawn
const DM_SPAWN_INVULN = 3;   // respawn invulnerability window
const SPAWN_GRACE = 1.5;     // run-start invulnerability
const MAX_ALIVE = 95;        // field cap — waves trickle past it
const BLOOD_CAP = 200;       // persistent decals per run
const DEVIL_ORB_SPEED = 95;
const DEVIL_ORB_DAMAGE = 15;
const DEVIL_RANGE_HOLD = 190;  // devils hold at this distance and shell players
const DEVIL_RANGE_BACK = 120;  // ...and back off inside this

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
  weapon: WeaponTier;
}

interface MenuHit {
  x: number;
  y: number;
  w: number;
  h: number;
  cb: () => void;
}

export class Game {
  private world = new Container();
  private menu = new Container();
  private hud = new Container();
  private decals = new Container();

  private state: GameState = 'title';
  private mode: Mode = 'solo';
  private room: ArenaRoom = ROOMS[0];

  private slots: PlayerSlot[] = [];
  private zombies: Zombie[] = [];
  private bullets: Projectile[] = [];
  private orbs: Projectile[] = []; // devil fireballs
  private crates: AmmoCrate[] = [];
  private barrels: Barrel[] = [];
  private blasts: BlastRing[] = [];
  private flashes: MuzzleFlash[] = [];
  private splats: BloodDecal[] = [];

  private plan: WavePlan | null = null;
  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;
  private wave = 0;
  private breather = 0; // interwave countdown (banner showing)
  private crateTimer = 8;
  /** D-08 enabler: ?stress tops the field up to ~100 movers so the F3
   *  50–100-mover budget is measurable. Debug-only. */
  private stress = new URLSearchParams(location.search).has('stress');
  private high = 0;
  private bestWave = 0;
  private scoreSys = new ScoreSystem();
  private shake = 0;

  private hudText!: Text;
  private dmText!: Text;
  private p1Text!: Text;
  private p2Text!: Text;
  private p1Bar = new Graphics();
  private p2Bar = new Graphics();
  private banner!: Text;
  private toast!: Text;
  private bannerTimer: number | null = null;
  private toastTimer = 0;
  private menuChip = new Container();
  private menuHits: MenuHit[] = [];
  /** direct-authored art (public/art/*.svg); menus/arena work without them,
   *  these decorate once the async load resolves. */
  private logoTex: Texture | null = null;
  private floorTex: Texture | null = null;
  private music = new Music();
  private musicState: 'none' | 'menu' | 'combat' | 'dm' = 'none';
  /** last Digit1..Digit8 keypress (room select 1-8; consumed by tick) */
  private digitPressed = 0;

  constructor(
    private app: Application,
    private input: Input,
    private sfx: Sfx,
    private touch: TouchControls,
  ) {
    registerBoxheadPresets();
    this.high = load('boxhead', 'highscore', 0);
    this.bestWave = load('boxhead', 'bestwave', 0);
    // rebind stub: load saved keymap JSON (merged over mode defaults).
    const savedKeys = load<{ p1?: Record<string, never>; p2?: Record<string, never> } | null>('boxhead', 'keymaps', null);
    if (savedKeys) input.setKeymaps(savedKeys);
    app.stage.addChild(this.world);
    app.stage.addChild(this.menu);
    app.stage.addChild(this.hud);
    app.stage.addChild(touch.view);

    this.buildHud();
    this.bindHotkeys();
    // authored art preload — decorative only; failures leave procedural look.
    Assets.load<Texture>('/art/boxhead-logo.svg')
      .then((t) => { this.logoTex = t; if (this.state === 'title') this.showTitle(); })
      .catch(() => { /* keep text-only title */ });
    Assets.load<Texture>('/art/floor-tile.svg')
      .then((t) => { this.floorTex = t; })
      .catch(() => { /* keep flat arena fill */ });
    window.addEventListener('keydown', (e) => {
      const m = /^Digit([1-8])$/.exec(e.code);
      if (m) this.digitPressed = Number(m[1]);
    });
  }

  // --- debug / verification hooks ------------------------------------------------
  get stateName(): GameState { return this.state; }
  get modeName(): Mode { return this.mode; }
  get waveNumber(): number { return this.wave; }
  get scoreValue(): number { return this.scoreSys.score; }
  get multValue(): number { return this.scoreSys.mult; }
  get enemiesAlive(): number { return this.zombies.length; }
  get roomsCount(): number { return ROOMS.length; }
  get weaponSnapshot(): { player: number; weapon: WeaponTier; ammo: number; owned: WeaponTier[] }[] {
    return this.slots.map((s, i) => ({
      player: i,
      weapon: s.weapon,
      ammo: s.p.ammo,
      owned: this.scoreSys.ownedWeapons(),
    }));
  }
  get playerSnapshot(): { player: number; hp: number; alive: boolean; kills: number }[] {
    return this.slots.map((s, i) => ({ player: i, hp: s.p.hp, alive: s.alive, kills: s.kills }));
  }

  get player(): Player { return this.slots[0].p; }

  // --- HUD scaffold ---------------------------------------------------------------
  private buildHud(): void {
    this.hudText = new Text({ text: '', style: { fill: PAL.amber, fontSize: 12, fontFamily: 'monospace', lineHeight: 16 } });
    this.hudText.x = 14;
    this.hudText.y = 8;
    this.dmText = new Text({ text: '', style: { fill: PAL.ink, fontSize: 13, fontFamily: 'monospace' } });
    this.dmText.anchor.set(0.5);
    this.dmText.x = STAGE_W / 2;
    this.dmText.y = 14;
    this.p1Text = new Text({ text: '', style: { fill: PAL.ink, fontSize: 12, fontFamily: 'monospace' } });
    this.p1Text.x = 14;
    this.p1Text.y = 30;
    this.p2Text = new Text({ text: '', style: { fill: PAL.ink, fontSize: 12, fontFamily: 'monospace' } });
    this.p2Text.anchor.set(1, 0);
    this.p2Text.x = STAGE_W - 14;
    this.p2Text.y = 30;
    this.hud.addChild(this.hudText, this.dmText, this.p1Bar, this.p2Bar, this.p1Text, this.p2Text);

    this.banner = new Text({
      text: '',
      style: { fill: PAL.ink, fontSize: 17, fontFamily: 'monospace', align: 'center', lineHeight: 25 },
    });
    this.banner.anchor.set(0.5);
    this.banner.x = STAGE_W / 2;
    this.banner.y = STAGE_H / 2 - 30;
    this.hud.addChild(this.banner);

    this.toast = new Text({
      text: '',
      style: { fill: PAL.amber, fontSize: 14, fontFamily: 'monospace', align: 'center' },
    });
    this.toast.anchor.set(0.5);
    this.toast.x = STAGE_W / 2;
    this.toast.y = STAGE_H / 2 + 4;
    this.hud.addChild(this.toast);

    // touch MENU chip for end screens (D-14): phones have no M key.
    const chipBg = new Graphics()
      .roundRect(-64, -18, 128, 36, 6)
      .fill({ color: PAL.panel, alpha: 0.92 })
      .stroke({ width: 1, color: PAL.amber });
    const chipText = new Text({ text: 'MENU', style: { fill: PAL.amber, fontSize: 14, fontFamily: 'monospace' } });
    chipText.anchor.set(0.5);
    this.menuChip.addChild(chipBg, chipText);
    this.menuChip.x = STAGE_W / 2;
    this.menuChip.y = STAGE_H - 44;
    this.menuChip.visible = false;
    this.hud.addChild(this.menuChip);
  }

  /** app-level keys input.ts cannot express: weapon slots 1-5, room slots
   *  4-8, pause-restart R. Keyboard-safe in DOM inputs. */
  private bindHotkeys(): void {
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const digit = /^Digit([1-8])$/.exec(e.code);
      const num = /^Numpad([0-5])$/.exec(e.code);
      if (this.state === 'room' && digit) {
        const idx = Number(digit[1]) - 1;
        if (idx < ROOMS.length) this.pickRoom(idx);
        return;
      }
      if (this.state === 'playing' || this.state === 'paused') {
        if (e.code === 'KeyR' && this.state === 'paused') {
          this.startRun(ROOMS.indexOf(this.room));
          return;
        }
        const tier = digit ? WEAPON_ORDER[Number(digit[1]) - 1] : undefined;
        if (tier) {
          this.selectWeapon(0, tier); // digit row always belongs to P1
          return;
        }
        if (num) {
          // versus: numpad belongs to P2 (1-3 pick, 0 cycles); solo: P1
          if (this.mode === 'solo') {
            const t2 = WEAPON_ORDER[Number(num[1]) - 1];
            if (t2) this.selectWeapon(0, t2);
          } else if (num[1] === '0') {
            this.cycleWeapon(1);
          } else {
            const t2 = WEAPON_ORDER[Number(num[1]) - 1];
            if (t2) this.selectWeapon(1, t2);
          }
        }
      }
    });
  }

  // --- menus -----------------------------------------------------------------
  private clearMenu(): void {
    this.menu.removeChildren().forEach((c) => c.destroy());
    this.menuHits = [];
  }

  private menuLine(text: string, x: number, y: number, opts: { fill?: number; size?: number } = {}): void {
    const t = new Text({
      text,
      style: {
        fill: opts.fill ?? PAL.ink,
        fontSize: opts.size ?? 15,
        fontFamily: 'monospace',
        align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    this.menu.addChild(t);
  }

  private addHit(x: number, y: number, w: number, h: number, cb: () => void): void {
    this.menuHits.push({ x: x - w / 2, y: y - h / 2, w, h, cb });
  }

  /** shared menu hygiene: no banner bleed (D-18), no frozen world behind
   *  menus (D-56), no stale HUD, moody menu bed. */
  private enterMenuState(next: GameState): void {
    this.state = next;
    this.banner.text = '';
    this.bannerTimer = null;
    this.toast.text = '';
    this.toastTimer = 0;
    this.menuChip.visible = false;
    this.hud.visible = false;
    this.world.visible = false;
    this.world.x = 0;
    this.world.y = 0;
    this.clearMenu();
    this.setMusic('menu');
  }

  private setMusic(which: 'menu' | 'combat' | 'dm' | 'none'): void {
    if (this.musicState === which) return;
    this.musicState = which;
    if (which === 'none') this.music.stop(this.sfx);
    else this.music.play(this.sfx, which === 'menu' ? MENU_SONG : which === 'dm' ? DM_SONG : COMBAT_SONG);
  }

  private showTitle(): void {
    this.enterMenuState('title');
    if (this.logoTex) {
      const logo = new Sprite(this.logoTex);
      logo.anchor.set(0.5);
      logo.x = STAGE_W / 2;
      logo.y = 66;
      logo.scale.set(0.62);
      this.menu.addChild(logo);
      this.menuLine('ARENA NIGHTS', STAGE_W / 2, 126, { fill: PAL.ink, size: 18 });
    } else {
      this.menuLine('BLOCKHEAD', STAGE_W / 2, 84, { fill: PAL.amber, size: 34 });
      this.menuLine('ARENA NIGHTS', STAGE_W / 2, 118, { fill: PAL.ink, size: 18 });
    }
    this.menuLine('ENDLESS ZOMBIE WAVES · SOLO / CO-OP / DEATHMATCH', STAGE_W / 2, 172, { fill: PAL.muted, size: 12 });
    this.menuLine(`BEST SCORE ${this.high} · BEST WAVE ${this.bestWave}`, STAGE_W / 2, 200, { fill: PAL.amber, size: 14 });
    this.menuLine('PRESS SPACE / ENTER / TAP', STAGE_W / 2, 288, { fill: PAL.accent, size: 15 });
  }

  private showModeSelect(): void {
    this.enterMenuState('mode');
    this.menuLine('SELECT MODE', STAGE_W / 2, 66, { fill: PAL.amber, size: 24 });
    const rows: [string, string, Mode][] = [
      ['1 — SOLO SURVIVAL', 'one player vs endless waves', 'solo'],
      ['2 — LOCAL CO-OP', 'two players, one keyboard, shared streak', 'coop'],
      ['3 — LOCAL DEATHMATCH', 'first to 5 kills · crates on', 'deathmatch'],
    ];
    rows.forEach(([label, sub, m], i) => {
      const y = 130 + i * 56;
      this.menuLine(label, STAGE_W / 2, y, { fill: PAL.ink, size: 16 });
      this.menuLine(sub, STAGE_W / 2, y + 18, { fill: PAL.muted, size: 11 });
      this.addHit(STAGE_W / 2, y + 8, STAGE_W - 120, 46, () => this.pickMode(m));
    });
    this.menuLine('WEAPONS: number keys 1-5 (P2: numpad 1-3, 0 cycles) · ESC/P pause', STAGE_W / 2, 336, { fill: PAL.muted, size: 11 });
    this.addHit(STAGE_W / 2, 300, STAGE_W, 60, () => this.pickMode('solo'));
  }

  private pickMode(m: Mode): void {
    this.mode = m;
    this.sfx.preset(m === 'solo' ? 'ui.confirm' : 'ui.join');
    this.showRoomSelect();
  }

  private showRoomSelect(): void {
    this.enterMenuState('room');
    this.menuLine('SELECT ROOM', STAGE_W / 2, 52, { fill: PAL.amber, size: 22 });
    ROOMS.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 168 + col * 304;
      const y = 108 + row * 52;
      this.menuLine(`${i + 1} · ${r.name}`, x, y, { fill: PAL.ink, size: 14 });
      this.menuLine(r.blurb, x, y + 16, { fill: PAL.muted, size: 10 });
      this.addHit(x, y + 6, 288, 46, () => this.pickRoom(i));
    });
    this.menuLine(`BEST SCORE ${this.high} · BEST WAVE ${this.bestWave}`, STAGE_W / 2, 344, { fill: PAL.amber, size: 13 });
    this.menuLine('Press 1-8 (or tap a room) · ESC back', STAGE_W / 2, 368, { fill: PAL.muted, size: 11 });
  }

  private pickRoom(idx: number): void {
    this.sfx.preset('ui.confirm');
    this.startRun(idx);
  }

  // --- run lifecycle ------------------------------------------------------------
  private startRun(roomIdx: number): void {
    this.room = ROOMS[clamp(roomIdx, 0, ROOMS.length - 1)];
    this.clearMenu();
    this.clearField();
    this.world.visible = true;
    this.hud.visible = true;
    this.world.x = 0;
    this.world.y = 0;

    // room geometry — theme-tinted asphalt floor, checker seam, wall blocks
    const theme = themeColors(this.room.theme);
    this.world.removeChildren().forEach((c) => c.destroy());
    const arena = new Graphics();
    arena.rect(10, 10, STAGE_W - 20, STAGE_H - 20).fill(theme.floor).stroke({ width: 2, color: PAL.panelEdge });
    const cell = 32;
    for (let cy = 0; cy < Math.ceil((STAGE_H - 20) / cell); cy++) {
      for (let cx = 0; cx < Math.ceil((STAGE_W - 20) / cell); cx++) {
        if ((cx + cy) % 2 === 0) continue;
        arena.rect(10 + cx * cell, 10 + cy * cell, cell, cell).fill(theme.floorAlt);
      }
    }
    for (const o of this.room.obstacles) {
      arena.rect(o.x, o.y, o.w, o.h).fill(theme.wall).stroke({ width: 1, color: PAL.wallEdge });
    }
    this.world.addChild(arena);
    if (this.floorTex) {
      // authored grime overlay (transparent tile) above the checker floor
      const floor = new TilingSprite({ texture: this.floorTex, width: STAGE_W - 20, height: STAGE_H - 20 });
      floor.x = 10;
      floor.y = 10;
      floor.alpha = 0.5;
      this.world.addChild(floor);
    }
    this.decals = new Container();
    this.world.addChild(this.decals);

    const twoPlayer = this.mode !== 'solo';
    this.input.setMode(twoPlayer ? 'versus' : 'solo');

    this.slots = [this.makeSlot(this.room.spawn, PAL.p1)];
    this.world.addChild(this.slots[0].p.g);
    if (twoPlayer) {
      this.slots.push(this.makeSlot(this.room.spawn2, PAL.p2));
      this.world.addChild(this.slots[1].p.g);
    }

    for (const b of this.room.barrels) {
      const barrel = new Barrel({ ...b });
      this.barrels.push(barrel);
      this.world.addChild(barrel.g);
    }

    this.scoreSys.reset();
    this.scoreSys.onUnlock = (w) => this.handleUnlock(w);
    this.wave = 0;
    this.plan = null;
    this.spawnQueue = [];
    this.breather = 0;
    this.crateTimer = 8; // D-10: stale timer carried an instant crate into retries
    this.state = 'playing';
    this.banner.text = '';
    this.bannerTimer = null;
    this.toast.text = '';
    this.setMusic(this.mode === 'deathmatch' ? 'dm' : 'combat');
    if (this.mode === 'deathmatch') {
      this.spawnQueue = [];
    } else {
      this.nextWave();
    }
  }

  private makeSlot(spawn: Vec, accent: number): PlayerSlot {
    const p = new Player(spawn.x, spawn.y, accent);
    p.setInvuln(SPAWN_GRACE);
    return {
      p,
      cooldown: 0,
      lastPointerAim: null,
      pointerAimAge: 99,
      kills: 0,
      respawnTimer: 0,
      alive: true,
      weapon: 'pistol',
    };
  }

  /** endless waves — no MAX_WAVE, no victory: plan, banner + sting, breather */
  private nextWave(): void {
    this.wave += 1;
    const coop = this.mode === 'coop';
    this.plan = planWave(this.wave, coop);
    const q: EnemyKind[] = [];
    for (let i = 0; i < this.plan.walkers; i++) q.push('walker');
    for (let i = 0; i < this.plan.runners; i++) q.push('runner');
    for (let i = 0; i < this.plan.bruisers; i++) q.push('bruiser');
    // devils seeded through the wave so they arrive with pressure
    for (let i = 0; i < this.plan.devils; i++) {
      q.splice(Math.floor(Math.random() * (q.length + 1)), 0, 'devil');
    }
    this.spawnQueue = q;
    const devilDebut = this.wave === (coop ? 6 : 8);
    this.showBanner(`WAVE ${this.wave}${devilDebut ? '\nDEVILS INBOUND' : ''}`, 2.6);
    this.sfx.preset('ui.wave');
    this.breather = this.wave === 1 ? 1.2 : 3; // interwave breather with banner
    this.spawnTimer = 0.4;
  }

  private showBanner(text: string, autoClearSeconds: number | null): void {
    this.banner.text = text;
    this.bannerTimer = autoClearSeconds;
  }

  private showToast(text: string): void {
    this.toast.text = text;
    this.toastTimer = 1.8;
  }

  private gameOver(): void {
    this.state = 'dead';
    const newBestScore = this.scoreSys.score > this.high;
    const newBestWave = this.wave > this.bestWave;
    this.persistHigh();
    this.persistBestWave();
    this.music.stop(this.sfx);
    this.musicState = 'none'; // retry must restart the combat bed
    this.sfx.preset('ui.gameover');
    this.showBanner(
      `OVERRUN ON WAVE ${this.wave} (${this.room.name})\n` +
      `SCORE ${this.scoreSys.score} · BEST ${this.high}\n` +
      `WAVE ${this.wave} · BEST WAVE ${this.bestWave}` +
      (newBestScore || newBestWave ? '\nNEW BEST!' : '') +
      `\nSPACE / tap — retry · M — menu`,
      null,
    );
    if (newBestScore || newBestWave) window.setTimeout(() => this.sfx.preset('ui.best'), 700);
  }

  private dmEnd(winner: number): void {
    this.state = 'victory';
    this.music.stop(this.sfx);
    this.musicState = 'none'; // rematch must restart the DM bed
    this.sfx.preset('ui.best');
    this.showBanner(
      `P${winner + 1} WINS THE DEATHMATCH ${this.slots[winner].kills}–${this.slots[1 - winner].kills}\n` +
      `FIRST TO ${DM_TARGET_KILLS} KILLS\n` +
      `SPACE / tap — rematch · M — menu`,
      null,
    );
  }

  private persistHigh(): void {
    if (this.scoreSys.score > this.high) {
      this.high = this.scoreSys.score;
      save('boxhead', 'highscore', this.high);
    }
  }

  private persistBestWave(): void {
    if (this.wave > this.bestWave) {
      this.bestWave = this.wave;
      save('boxhead', 'bestwave', this.bestWave);
    }
  }

  private clearField(): void {
    for (const z of this.zombies) z.destroy();
    for (const b of this.bullets) b.destroy();
    for (const o of this.orbs) o.destroy();
    for (const c of this.crates) c.g.destroy();
    for (const bl of this.blasts) bl.destroy();
    for (const f of this.flashes) f.destroy();
    for (const s of this.splats) s.g.destroy();
    for (const s of this.slots) s.p.g.destroy();
    this.zombies = [];
    this.bullets = [];
    this.orbs = [];
    this.crates = [];
    this.barrels = [];
    this.blasts = [];
    this.flashes = [];
    this.splats = [];
    this.slots = [];
    this.spawnQueue = [];
    this.shake = 0;
  }

  // --- main tick -----------------------------------------------------------------
  tick(dt: number): void {
    // touch zones exist only during gameplay — menus/end screens get raw taps
    this.touch.setActive(this.state === 'playing');
    // digits pressed on any other screen must never leak into the room picker
    if (this.state !== 'room') this.digitPressed = 0;
    this.menuChip.visible = this.state === 'dead' || this.state === 'victory';

    if (this.state === 'playing' && this.input.wasPressed('pause')) {
      this.state = 'paused';
      // D-55: copy promises only keys that actually work — Enter is fire, so
      // it is deliberately NOT offered as a menu exit here.
      this.showBanner('PAUSED\nESC / P — resume · R — restart · M — menu', null);
    } else if (this.state === 'paused') {
      if (this.input.wasPressed('pause')) {
        this.state = 'playing';
        this.banner.text = '';
      } else if (this.input.wasPressed('action') || this.input.pointer.tapped) {
        // tap or M/E — exit to menus (banner area acts as the button)
        this.showModeSelect();
      }
    } else switch (this.state) {
      case 'title':
        if (this.input.wasPressed('fire') || this.input.wasPressed('action') || this.input.pointer.tapped) this.showModeSelect();
        break;
      case 'mode':
        if (this.input.wasPressed('slot1')) this.pickMode('solo');
        else if (this.input.wasPressed('slot2')) this.pickMode('coop');
        else if (this.input.wasPressed('slot3')) this.pickMode('deathmatch');
        else if (this.input.wasPressed('pause')) this.showTitle();
        else if (this.input.pointer.tapped) this.menuTap();
        break;
      case 'room': {
        // keys 1-8: 1-3 ride the arcade-core slots; 4-8 are local (menu copy promises all eight)
        const digit = this.digitPressed;
        if (digit >= 1 && digit <= ROOMS.length) this.pickRoom(digit - 1);
        this.digitPressed = 0;
        break;
      }
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

    // timed HUD elements
    if (this.bannerTimer !== null) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerTimer = null;
        if (this.state === 'playing') this.banner.text = '';
      }
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.text = '';
    }
    this.touch.tick();
    this.input.endFrame();
  }

  private menuTap(): void {
    const p = this.input.pointer;
    for (const h of this.menuHits) {
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        h.cb();
        return;
      }
    }
  }
  private tickPlaying(dt: number): void {
    // dt cap stays for movement/spawn physics; invulnerability is wall-clock
    // (D-58) so a throttled-resume frame cannot multi-hit a player.
    const gameplayDt = Math.min(dt, 0.05);
    this.updatePlayers(gameplayDt);
    if (this.mode !== 'deathmatch') {
      this.updateSpawning(gameplayDt);
      this.updateZombies(gameplayDt);
      this.updateOrbs(gameplayDt);
    }
    this.updateBullets(gameplayDt);
    this.updateProps(gameplayDt);
    this.scoreSys.tick(gameplayDt);
    this.updateShake(gameplayDt);
    this.updateHud();

    if (this.mode === 'deathmatch') {
      // handled in bullet/AoE collisions (dmEnd)
    } else if (this.slots.every((s) => !s.alive)) {
      this.gameOver();
    }
  }

  private updateShake(dt: number): void {
    if (this.shake > 0.15) {
      this.world.x = (Math.random() * 2 - 1) * this.shake;
      this.world.y = (Math.random() * 2 - 1) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 14);
    } else if (this.world.x !== 0 || this.world.y !== 0) {
      this.world.x = 0;
      this.world.y = 0;
      this.shake = 0;
    }
  }

  // --- players -------------------------------------------------------------------
  private updatePlayers(dt: number): void {
    // touch weapon button cycles P1's owned ladder
    if (this.touch.consumeWeaponSwitch()) this.cycleWeapon(0);

    this.slots.forEach((slot, idx) => {
      if (!slot.alive) {
        if (this.mode === 'deathmatch') {
          slot.respawnTimer -= dt;
          if (slot.respawnTimer <= 0) this.respawn(idx);
        }
        return;
      }
      slot.p.tickFlash();

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
        // D-15: on touch only the FIRE button shoots
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
    slot.p.setInvuln(DM_SPAWN_INVULN);
    slot.p.ammo = 40;
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
    const spec = WEAPONS[slot.weapon];
    if (slot.p.ammo < spec.ammoPerShot) {
      slot.cooldown = 0.25;
      this.sfx.preset('bh.dry');
      // auto-fallback: the infinite pistol is one blip away
      if (slot.weapon !== 'pistol' && this.scoreSys.owns('pistol')) {
        slot.weapon = 'pistol';
        this.showToast('OUT OF AMMO — PISTOL');
      }
      return;
    }
    slot.p.ammo -= spec.ammoPerShot;
    slot.cooldown = spec.fireDelay;

    const dir = this.aimDir(slot);
    const from = { x: slot.p.pos.x + dir.x * 14, y: slot.p.pos.y + dir.y * 14 };
    const angle = Math.atan2(dir.y, dir.x);
    this.flashes.push(new MuzzleFlash(from, angle, spec.kind !== 'bullet'));
    this.world.addChild(this.flashes[this.flashes.length - 1].g);

    for (let i = 0; i < spec.pellets; i++) {
      const t = spec.pellets === 1 ? 0 : i / (spec.pellets - 1) - 0.5; // -0.5..0.5
      const a = angle + t * spec.spread;
      const speed = spec.speed * (t === 0 || spec.pellets <= 2 ? 1 : 0.88);
      const b = new Projectile(
        { ...from },
        { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
        spec.kind,
        spec.life,
      );
      b.owner = owner;
      b.damage = spec.damage;
      b.radius = spec.radius;
      b.aoeDamage = spec.aoeDamage;
      this.bullets.push(b);
      this.world.addChild(b.g);
    }
    this.sfx.preset(
      slot.weapon === 'pistol' ? 'bh.pistol' :
      slot.weapon === 'uzi' ? 'bh.uzi' :
      slot.weapon === 'shotgun' ? 'bh.shotgun' :
      slot.weapon === 'grenades' ? 'bh.gthrow' : 'bh.rfire',
    );
  }

  private handleUnlock(w: WeaponTier): void {
    // auto-upgrade both living players to the new tier + notification
    for (const s of this.slots) s.weapon = w;
    this.showToast(`${WEAPONS[w].name} UNLOCKED — AUTO-EQUIPPED`);
    this.sfx.preset('bh.unlock');
  }

  private selectWeapon(slotIdx: number, tier: WeaponTier): void {
    const slot = this.slots[slotIdx];
    if (!slot) return;
    if (!this.scoreSys.owns(tier)) {
      this.sfx.preset('bh.dry');
      return;
    }
    if (slot.weapon !== tier) {
      slot.weapon = tier;
      this.sfx.preset('ui.move');
    }
  }

  private cycleWeapon(slotIdx: number): void {
    const slot = this.slots[slotIdx];
    if (!slot) return;
    const owned = this.scoreSys.ownedWeapons();
    if (owned.length < 2) return;
    const at = owned.indexOf(slot.weapon);
    slot.weapon = owned[(at + 1) % owned.length];
    this.sfx.preset('ui.move');
  }

  // --- waves & zombies ---------------------------------------------------------------
  private updateSpawning(dt: number): void {
    if (this.breather > 0) {
      this.breather -= dt;
      return;
    }
    if (this.spawnQueue.length > 0) {
      if (this.zombies.length < MAX_ALIVE) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const kind = this.spawnQueue.shift()!;
          this.spawnZombie(kind);
          this.spawnTimer = this.plan?.spawnEvery ?? 1;
        }
      }
      return;
    }
    if (this.zombies.length === 0 && this.wave > 0) {
      this.nextWave();
    }
    // D-08: ?stress keeps ~100 movers on the field, including new tiers.
    if (this.stress && this.zombies.length < 100) {
      const r = Math.random();
      this.spawnZombie(r < 0.3 ? 'runner' : r < 0.42 ? 'bruiser' : r < 0.47 ? 'devil' : 'walker');
    }
  }

  private spawnZombie(kind: EnemyKind): void {
    const edge = Math.floor(Math.random() * 4);
    const pos: Vec =
      edge === 0 ? { x: 22, y: 22 + Math.random() * (STAGE_H - 44) } :
      edge === 1 ? { x: STAGE_W - 22, y: 22 + Math.random() * (STAGE_H - 44) } :
      edge === 2 ? { x: 22 + Math.random() * (STAGE_W - 44), y: 22 } :
                   { x: 22 + Math.random() * (STAGE_W - 44), y: STAGE_H - 22 };
    const z = new Zombie(pos, this.plan?.speed ?? 45, kind);
    this.zombies.push(z);
    this.world.addChild(z.g);
    if (kind === 'devil') this.sfx.preset('bh.dspawn');
  }

  private nearestPlayer(from: Vec): Player | null {
    let best: Player | null = null;
    let bd = Infinity;
    for (const s of this.slots) {
      if (!s.alive) continue;
      const d = dist(from, s.p.pos);
      if (d < bd) { bd = d; best = s.p; }
    }
    return best;
  }

  private updateZombies(dt: number): void {
    for (const z of this.zombies) {
      const target = this.nearestPlayer(z.pos);
      if (!target) continue;
      const d = dist(z.pos, target.pos);
      if (z.ranged) {
        // devils hold range and shell the nearest player
        if (d > DEVIL_RANGE_HOLD) {
          z.chase(target.pos, dt, { w: STAGE_W, h: STAGE_H }, this.room.obstacles, this.zombies);
        } else if (d < DEVIL_RANGE_BACK) {
          const away = { x: z.pos.x * 2 - target.pos.x, y: z.pos.y * 2 - target.pos.y };
          z.chase(away, dt, { w: STAGE_W, h: STAGE_H }, this.room.obstacles, this.zombies);
        } else {
          z.chase(z.pos, dt, { w: STAGE_W, h: STAGE_H }, this.room.obstacles, this.zombies);
        }
        z.fireTimer -= dt;
        if (z.fireTimer <= 0 && d < DEVIL_RANGE_HOLD + 60) {
          z.fireTimer = 2.4;
          this.devilFire(z, target.pos);
        }
      } else {
        z.chase(target.pos, dt, { w: STAGE_W, h: STAGE_H }, this.room.obstacles, this.zombies);
      }
      for (const s of this.slots) {
        if (!s.alive || s.p.invulnLeft() > 0) continue;
        if (dist(z.pos, s.p.pos) < z.hitR + 3) {
          s.p.hp -= z.contact;
          s.p.setInvuln(0.8);
          this.scoreSys.playerHit();
          this.sfx.preset('bh.zattack');
          if (s.p.hp <= 0) this.killPlayer(s);
        }
      }
    }
  }

  private devilFire(z: Zombie, at: Vec): void {
    const d = dist(z.pos, at) || 1;
    const dir = { x: (at.x - z.pos.x) / d, y: (at.y - z.pos.y) / d };
    const orb = new Projectile(
      { x: z.pos.x + dir.x * 12, y: z.pos.y + dir.y * 12 },
      { x: dir.x * DEVIL_ORB_SPEED, y: dir.y * DEVIL_ORB_SPEED },
      'fireball',
      4,
    );
    orb.damage = DEVIL_ORB_DAMAGE;
    this.orbs.push(orb);
    this.world.addChild(orb.g);
    this.sfx.preset('bh.dfire');
  }

  private updateOrbs(dt: number): void {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const alive = o.tick(dt) && !o.hitSolid(this.room.obstacles, { w: STAGE_W, h: STAGE_H });
      if (!alive) {
        o.destroy();
        this.orbs.splice(i, 1);
        continue;
      }
      for (const s of this.slots) {
        if (!s.alive || s.p.invulnLeft() > 0) continue;
        if (dist(o.pos, s.p.pos) < 11) {
          s.p.hp -= o.damage;
          s.p.setInvuln(0.8);
          this.scoreSys.playerHit();
          this.sfx.preset('bh.hurt');
          o.destroy();
          this.orbs.splice(i, 1);
          if (s.p.hp <= 0) this.killPlayer(s);
          break;
        }
      }
    }
  }

  private killPlayer(s: PlayerSlot): void {
    s.alive = false;
    s.p.hp = 0;
    s.p.g.visible = false;
    this.sfx.preset('bh.pdeath');
    this.music.duck();
    if (this.mode === 'deathmatch') s.respawnTimer = DM_RESPAWN;
  }

  /** shared zombie damage path — score, blood, audio, removal */
  private hurtZombie(z: Zombie, dmg: number): void {
    z.hp -= dmg;
    if (z.hp <= 0) {
      this.scoreSys.kill(z.kind);
      this.addBlood(z.pos);
      z.destroy();
      const i = this.zombies.indexOf(z);
      if (i >= 0) this.zombies.splice(i, 1);
      this.sfx.preset(z.kind === 'devil' ? 'bh.ddeath' : 'bh.zdeath');
    } else {
      z.hitFlash = 0.12;
      this.sfx.preset('bh.zhit');
    }
  }

  private addBlood(pos: Vec): void {
    const d = new BloodDecal(pos);
    this.splats.push(d);
    this.decals.addChild(d.g);
    if (this.splats.length > BLOOD_CAP) {
      const old = this.splats.shift()!;
      old.g.destroy();
    }
  }

  // --- bullets -------------------------------------------------------------------
  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
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
        for (const z of [...this.zombies]) {
          if (dist(z.pos, b.pos) < z.hitR) {
            this.hurtZombie(z, b.damage);
            dead = true;
            break;
          }
        }
      }

      if (!dead && this.mode === 'deathmatch') {
        // bullets hit players only in deathmatch; never the shooter
        for (let k = 0; k < this.slots.length; k++) {
          if (k === b.owner) continue;
          const slot = this.slots[k];
          if (!slot.alive || slot.p.invulnLeft() > 0) continue;
          if (dist(slot.p.pos, b.pos) < 11) {
            slot.p.hp -= 10;
            dead = true;
            if (slot.p.hp <= 0) {
              this.killPlayer(slot);
              this.slots[b.owner].kills += 1;
              this.scoreSys.kill('walker'); // streak drives the DM weapon ladder too
              if (this.slots[b.owner].kills >= DM_TARGET_KILLS) this.dmEnd(b.owner);
            } else {
              slot.p.setInvuln(0.35);
              this.sfx.preset('bh.hurt');
            }
            break;
          }
        }
      }

      if (dead) {
        // grenades/rockets detonate on ANY termination — hit, wall, or expiry
        if (b.kind === 'grenade') this.detonate(b.pos, b.radius, b.aoeDamage, b.owner, 3, 'bh.gboom');
        else if (b.kind === 'rocket') this.detonate(b.pos, b.radius, b.aoeDamage, b.owner, 6, 'bh.rboom');
        b.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  // --- props ---------------------------------------------------------------------
  private updateProps(dt: number): void {
    // D-57: the crate clock only runs while the field has room — a full field
    // can no longer accumulate a negative timer and dump an instant crate.
    if (this.crates.length < CRATE_CAP) {
      this.crateTimer -= dt;
      if (this.crateTimer <= 0) {
        this.crateTimer = CRATE_EVERY;
        const pos = this.freeSpot();
        if (pos) {
          const c = new AmmoCrate(pos);
          this.crates.push(c);
          this.world.addChild(c.g);
        }
      }
    }
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      for (const s of this.slots) {
        if (!s.alive) continue;
        if (dist(c.pos, s.p.pos) < 15) {
          s.p.ammo += CRATE_AMMO; // refills the wielded weapon's magazine
          this.sfx.preset('bh.pickup');
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

    // VFX
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      if (!this.blasts[i].tick(dt)) {
        this.blasts[i].destroy();
        this.blasts.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      if (!this.flashes[i].tick(dt)) {
        this.flashes[i].destroy();
        this.flashes.splice(i, 1);
      }
    }
  }

  private explodeBarrel(barrel: Barrel): void {
    barrel.explode();
    this.detonate(barrel.pos, BARREL_RADIUS, BARREL_AOE, undefined, 5, 'bh.barrel');
    this.music.duck();
  }

  /** shared AoE: barrels, grenade shells, rockets.
   *  D-19 ruling: a fired weapon's OWNER is exempt from its blast; partners
   *  still take friendly fire (co-op chaos, recorded for ARCADE review).
   *  Barrels (owner undefined) hit everyone. DM AoE kills credit the shooter. */
  private detonate(pos: Vec, radius: number, aoe: number, owner: number | undefined, shakeMag: number, sound: string): void {
    const ring = new BlastRing(pos, radius);
    this.blasts.push(ring);
    this.world.addChild(ring.g);
    this.sfx.preset(sound);
    this.shake = Math.max(this.shake, shakeMag);

    for (const z of [...this.zombies]) {
      if (dist(z.pos, pos) < radius) this.hurtZombie(z, aoe);
    }
    for (let k = 0; k < this.slots.length; k++) {
      const s = this.slots[k];
      if (!s.alive || s.p.invulnLeft() > 0) continue;
      if (owner !== undefined && k === owner) continue;
      if (dist(s.p.pos, pos) < radius * 0.8) {
        s.p.hp -= BLAST_PLAYER_DAMAGE;
        s.p.setInvuln(0.8);
        if (this.mode !== 'deathmatch') this.scoreSys.playerHit();
        this.sfx.preset('bh.hurt');
        if (s.p.hp <= 0) {
          this.killPlayer(s);
          if (this.mode === 'deathmatch' && owner !== undefined) {
            this.slots[owner].kills += 1;
            this.scoreSys.kill('walker');
            if (this.slots[owner].kills >= DM_TARGET_KILLS) this.dmEnd(owner);
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

  // --- HUD ---------------------------------------------------------------------
  private drawHpBar(bar: Graphics, x: number, y: number, pct: number, accent: number): void {
    const w = 90;
    bar.clear()
      .rect(x, y, w, 6).fill(PAL.panel)
      .stroke({ width: 1, color: PAL.panelEdge })
      .rect(x + 1, y + 1, Math.max(0, (w - 2) * pct), 4)
      .fill(pct > 0.3 ? PAL.ok : PAL.warn)
      .rect(x, y - 1, 3, 8).fill(accent);
  }

  private weaponLabel(s: PlayerSlot): string {
    const spec = WEAPONS[s.weapon];
    return `${spec.name} ${spec.ammoPerShot === 0 ? '∞' : s.p.ammo}`;
  }

  private updateHud(): void {
    if (this.mode === 'deathmatch') {
      this.dmText.text = `P1 ${this.slots[0].kills} — ${this.slots[1]?.kills ?? 0} P2 · FIRST TO ${DM_TARGET_KILLS}`;
      this.hudText.text = 'DEATHMATCH';
    } else {
      this.dmText.text = '';
      this.hudText.text =
        `WAVE ${this.wave}   SCORE ${this.scoreSys.score}   x${this.scoreSys.mult}   BEST ${this.high}` +
        (this.breather > 0 ? '   — next wave…' : '');
    }
    const s1 = this.slots[0];
    this.drawHpBar(this.p1Bar, 14, 46, Math.max(0, s1.p.hp) / 100, PAL.p1);
    this.p1Text.text = `P1 ${Math.max(0, s1.p.hp)}  ${s1.alive ? this.weaponLabel(s1) : 'DOWN'}`;
    const s2 = this.slots[1];
    if (s2) {
      this.p2Bar.visible = true;
      this.p2Text.visible = true;
      this.drawHpBar(this.p2Bar, STAGE_W - 104, 46, Math.max(0, s2.p.hp) / 100, PAL.p2);
      this.p2Text.text = `${s2.alive ? this.weaponLabel(s2) : 'DOWN'}  ${Math.max(0, s2.p.hp)} P2`;
    } else {
      this.p2Bar.visible = false;
      this.p2Text.visible = false;
    }
  }
}
