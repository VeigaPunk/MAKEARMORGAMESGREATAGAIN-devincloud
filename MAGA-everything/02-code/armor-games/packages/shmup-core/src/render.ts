import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { BTN, STAGE_H, STAGE_W, chapterChipRect, type ShmupSim } from './sim';
import type { BossCrest } from './packs';

/**
 * PixiJS 8 renderer for the shared shmup engine — draws `ShmupSim` state
 * each frame. All art is authored in Graphics/Text (zero external assets;
 * only exception: the cluck title wordmark SVG, inlined at build time).
 * Every color/label comes from the content pack (D-39) — boss names render
 * in the HUD + intro banner (D-37).
 */

const MONO = 'monospace';

/** color set every bird (enemy or boss) carries — always pack-driven (D-39) */
interface BirdColors { color: number; headColor: number; comb: number; beak: number; goggles?: boolean }

function gradientTexture(bg0: number, bg1: number): Texture {
  const cv = document.createElement('canvas');
  cv.width = 1; cv.height = STAGE_H;
  const g = cv.getContext('2d')!;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const grad = g.createLinearGradient(0, 0, 0, STAGE_H);
  grad.addColorStop(0, hex(bg1));
  grad.addColorStop(1, hex(bg0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, STAGE_H);
  return Texture.from(cv);
}

export class ShmupRenderer {
  readonly view = new Container();
  private bg = new Graphics();
  private field = new Graphics();   // stars, pickups, chickens, boss, eggs, shots, ship, particles
  private hudG = new Graphics();    // pips, lives, missiles, boss bar
  private hud = new Container();
  private menuLayer = new Container();
  private btnLabels: Text[] = [];
  private startLabel!: Text;
  private bannerBg = new Graphics();
  private bannerText: Text;
  private bannerSub: Text;
  private warnText: Text;
  private toastText: Text;
  private hudText: Text;
  private hudRight: Text;
  private jokeText: Text;
  private hintText: Text;
  private bossNameText: Text;
  private weaponNameText: Text;
  private titleTexts: Text[] = [];
  private lastHud = '';
  private lastRight = '';
  private lastJoke = '';
  private lastBanner = '';
  private lastToast = '';
  private lastWeaponName = '';
  private bgChapter = -1;
  private bgTexCache = new Map<string, Texture>();

  constructor(private sim: ShmupSim) {
    this.bannerText = new Text({
      text: '', style: { fill: 0xffffff, fontSize: 26, fontFamily: MONO, fontWeight: 'bold', align: 'center' },
    });
    this.bannerText.anchor.set(0.5, 0.5);
    this.bannerText.x = STAGE_W / 2; this.bannerText.y = STAGE_H / 2 - 8;
    this.view.addChild(this.bg, this.field, this.hudG, this.hud, this.menuLayer, this.bannerBg, this.bannerText);

    this.hudText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: MONO, lineHeight: 20 } });
    this.hudText.x = 14; this.hudText.y = 8;
    this.hudRight = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: MONO, align: 'right', lineHeight: 20 } });
    this.hudRight.anchor.set(1, 0);
    this.hudRight.x = STAGE_W - 14; this.hudRight.y = 8;
    this.jokeText = new Text({ text: '', style: { fill: 0x8ce99a, fontSize: 14, fontFamily: MONO, align: 'center' } });
    this.jokeText.anchor.set(0.5, 0);
    this.jokeText.x = STAGE_W / 2; this.jokeText.y = STAGE_H - 120;
    this.hintText = new Text({
      text: 'ARROWS/WASD move · SPACE/Z/LMB fire · X/SHIFT/RMB missile · ESC pause',
      style: { fill: 0x888899, fontSize: 11, fontFamily: MONO },
    });
    this.hintText.x = 14; this.hintText.y = STAGE_H - 18;
    this.toastText = new Text({ text: '', style: { fill: 0xffe066, fontSize: 16, fontFamily: MONO, fontWeight: 'bold', align: 'center' } });
    this.toastText.anchor.set(0.5, 1);
    this.toastText.x = STAGE_W / 2; this.toastText.y = STAGE_H - 40;
    this.bossNameText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 13, fontFamily: MONO, fontWeight: 'bold', align: 'center' } });
    this.bossNameText.anchor.set(0.5, 1);
    this.bossNameText.x = STAGE_W / 2; this.bossNameText.y = 12;
    this.weaponNameText = new Text({ text: '', style: { fill: 0xffe066, fontSize: 12, fontFamily: MONO, fontWeight: 'bold' } });
    this.weaponNameText.x = 14; this.weaponNameText.y = 66;
    this.hud.addChild(this.hudText, this.hudRight, this.jokeText, this.hintText, this.toastText, this.bossNameText, this.weaponNameText);

    this.bannerSub = new Text({
      text: '', style: { fill: 0xccccee, fontSize: 14, fontFamily: MONO, align: 'center' },
    });
    this.bannerSub.anchor.set(0.5, 0.5);
    this.bannerSub.x = STAGE_W / 2; this.bannerSub.y = STAGE_H / 2 + 22;
    this.warnText = new Text({
      text: '', style: { fill: 0xff6b6b, fontSize: 40, fontFamily: MONO, fontWeight: 'bold', align: 'center', lineHeight: 46 },
    });
    this.warnText.anchor.set(0.5, 0.5);
    this.warnText.x = STAGE_W / 2; this.warnText.y = STAGE_H / 2 - 20;
    this.view.addChild(this.bannerSub, this.warnText);

    this.buildTitle(sim.pack.title);
  }

  // ---------------- backdrop ----------------
  private drawBackdrop(): void {
    const ch = this.sim.chapter;
    if (ch === this.bgChapter) return;
    this.bgChapter = ch;
    const [a, b] = this.sim.chapterDef.tint;
    const key = `${a}:${b}`;
    let tex = this.bgTexCache.get(key);
    if (!tex) { tex = gradientTexture(a, b); this.bgTexCache.set(key, tex); }
    this.bg.clear();
    this.bg.rect(0, 0, STAGE_W, STAGE_H).fill({ texture: tex });
  }

  // ---------------- title ----------------
  private buildTitle(title: string): void {
    const pack = this.sim.pack;
    const mk = (text: string, y: number, size: number, fill: number, bold = false): Text => {
      const t = new Text({
        text, style: { fill, fontSize: size, fontFamily: MONO, align: 'center', fontWeight: bold ? 'bold' : 'normal' },
      });
      t.anchor.set(0.5, 0.5); t.x = STAGE_W / 2; t.y = y;
      this.titleTexts.push(t); this.menuLayer.addChild(t);
      return t;
    };
    const titleText = mk(title, 110, 44, pack.accent, true);
    // cluck pack: authored wordmark replaces the text title when the asset
    // resolves (served from the app's public/art/; inlined for file:// ship).
    if (pack.id === 'cluck') {
      Assets.load<Texture>('/art/title-cluck-horizon.svg')
        .then((tex) => {
          const s = new Sprite(tex);
          s.anchor.set(0.5); s.x = STAGE_W / 2; s.y = 110;
          s.scale.set(Math.min(1, (STAGE_W - 80) / tex.width));
          this.menuLayer.addChild(s);
          titleText.visible = false;
        })
        .catch(() => { /* asset absent — text title stays */ });
    }
    mk(pack.sub, 142, 15, 0xaaaabb);
    mk(`HIGH SCORE ${this.sim.high}`, 168, 13, 0xffe066);

    // persistent chip labels — drawTitle only restyles them
    for (let i = 0; i < pack.chapters.length; i++) {
      const r = chapterChipRect(i, pack.chapters.length);
      const t = new Text({ text: '', style: { fontSize: 11, fontFamily: MONO, fontWeight: 'bold' } });
      t.anchor.set(0.5, 0.5); t.x = r.x + r.w / 2; t.y = r.y + r.h / 2 + 1;
      this.menuLayer.addChild(t);
      this.btnLabels.push(t);
    }
    const startR = BTN.start;
    this.startLabel = new Text({ text: 'START', style: { fontSize: 16, fontFamily: MONO, fontWeight: 'bold' } });
    this.startLabel.anchor.set(0.5, 0.5);
    this.startLabel.x = startR.x + startR.w / 2; this.startLabel.y = startR.y + startR.h / 2 + 1;
    this.menuLayer.addChild(this.startLabel);

    // D-39: enemy roster + gift/food names come straight from the pack
    mk(`FOES: ${pack.enemyTypes.map(e => e.name).join(' · ')}`, 412, 12, 0x9999bb);
    mk(`GIFTS STEP POWER 1→${pack.weapons.length} · EVERY 8 ${pack.food.name}S = EXTRA LIFE`, 432, 12, 0x9999bb);
    mk('ARROWS select chapter · ENTER/SPACE start · digits jump', 458, 13, 0x888899);
    mk('ARROWS/WASD move · SPACE/Z/LMB fire · X/SHIFT/RMB missile · ESC pause', 480, 11, 0x666677);
    mk(pack.id === 'replica'
      ? 'formula replica — INTERNAL-NO-PUBLIC · clearance required to ship'
      : 'original IP — INTERNAL-NO-PUBLIC · trademark search open', 502, 11, 0x666677);
    this.menuLayer.visible = false;
  }

  private drawTitleButtons(): void {
    const g = this.field, sim = this.sim, pack = sim.pack;
    for (let i = 0; i < pack.chapters.length; i++) {
      const r = chapterChipRect(i, pack.chapters.length);
      const locked = i + 1 > sim.unlocked;
      const on = sim.titleSel === i + 1;
      g.roundRect(r.x, r.y, r.w, r.h, 4)
        .fill({ color: on ? pack.accent : locked ? 0x181820 : 0x222233 })
        .stroke({ width: 1, color: locked ? 0x444455 : 0xffffff });
      const label = locked ? `CH ${i + 1} LOCKED` : `${i + 1} ${pack.chapters[i].name}`;
      this.btnLabels[i].text = label;
      this.btnLabels[i].style.fill = on ? 0x111111 : locked ? 0x666677 : 0xddddee;
    }
    g.roundRect(BTN.start.x, BTN.start.y, BTN.start.w, BTN.start.h, 4)
      .fill({ color: pack.accent })
      .stroke({ width: 1, color: 0xffffff });
    this.startLabel.style.fill = 0x111111;
  }

  // ---------------- entities ----------------
  private drawCrest(x: number, y: number, k: number, crest: BossCrest, col: number, t: number): void {
    const g = this.field;
    switch (crest) {
      case 'crown':
        for (let i = -1; i <= 1; i++) {
          g.poly([x + i * 7 * k - 4 * k, y, x + i * 7 * k + 4 * k, y, x + i * 7 * k, y - 9 * k]).fill(0xffd43b);
        }
        break;
      case 'horns':
        g.poly([x - 8 * k, y + 2 * k, x - 16 * k, y - 8 * k, x - 5 * k, y - 3 * k]).fill(0xe8590c);
        g.poly([x + 8 * k, y + 2 * k, x + 16 * k, y - 8 * k, x + 5 * k, y - 3 * k]).fill(0xe8590c);
        break;
      case 'antenna':
        g.rect(x - k, y - 10 * k, 2 * k, 10 * k).fill(0xadb5bd);
        g.circle(x, y - 11 * k, 2.5 * k).fill(col);
        break;
      case 'collar':
        g.ellipse(x, y + 3 * k, 12 * k, 3.5 * k).stroke({ width: 2 * k, color: 0xffd43b });
        break;
      case 'flames': {
        const fl = Math.sin(t * 12) * 2 * k;
        g.poly([x - 8 * k, y, x - 2 * k, y, x - 5 * k, y - (10 + fl) * k]).fill(0xff922b);
        g.poly([x + 2 * k, y, x + 8 * k, y, x + 5 * k, y - (12 - fl) * k]).fill(0xffd43b);
        break;
      }
      default: // comb
        for (let i = -1; i <= 1; i++) {
          g.ellipse(x + i * 5 * k, y - 3 * k, 2.5 * k, 4 * k).fill(col);
        }
    }
  }

  private drawBird(x: number, y: number, k: number, c: BirdColors, boss = false, crest: BossCrest = 'comb', t = 0): void {
    const g = this.field;
    g.ellipse(x, y, 16 * k, 13 * k).fill(c.color);
    // wings
    g.poly([x - 15 * k, y - 2 * k, x - 26 * k, y - 8 * k, x - 13 * k, y + 5 * k]).fill(c.headColor);
    g.poly([x + 15 * k, y - 2 * k, x + 26 * k, y - 8 * k, x + 13 * k, y + 5 * k]).fill(c.headColor);
    g.ellipse(x, y - 12 * k, 8 * k, 7 * k).fill(c.headColor);
    this.drawCrest(x, y - 18 * k, k, crest, c.comb, t);
    g.poly([x - 3 * k, y - 11 * k, x + 3 * k, y - 11 * k, x, y - 7 * k]).fill(c.beak);
    if (c.goggles) { // ace: goggle strap + lenses (D-44)
      g.rect(x - 9 * k, y - 16 * k, 18 * k, 3 * k).fill(0x343a40);
      g.circle(x - 3.5 * k, y - 14.5 * k, 2.6 * k).fill(0xa5d8ff).stroke({ width: 0.8 * k, color: 0x343a40 });
      g.circle(x + 3.5 * k, y - 14.5 * k, 2.6 * k).fill(0xa5d8ff).stroke({ width: 0.8 * k, color: 0x343a40 });
    } else {
      g.rect(x - 3 * k, y - 14 * k, 2 * k, 2 * k).fill(0x111111);
      g.rect(x + 1.5 * k, y - 14 * k, 2 * k, 2 * k).fill(0x111111);
    }
    if (boss) { // armored belly plate distinguishes boss silhouettes further
      g.ellipse(x, y + 6 * k, 9 * k, 5 * k).fill({ color: c.beak, alpha: 0.85 });
    }
  }

  private drawShip(): void {
    const g = this.field, pack = this.sim.pack, s = this.sim.ship;
    g.poly([s.x, s.y - 18, s.x - 14, s.y + 12, s.x - 5, s.y + 8, s.x + 5, s.y + 8, s.x + 14, s.y + 12]).fill(pack.ship);
    g.rect(s.x - 3, s.y - 8, 6, 8).fill(0xffffff);
    g.rect(s.x - 9, s.y + 12, 4, 5).fill(pack.accent);
    g.rect(s.x + 5, s.y + 12, 4, 5).fill(pack.accent);
  }

  private drawPickup(p: { x: number; y: number; kind: string }): void {
    const g = this.field, pack = this.sim.pack;
    if (p.kind === 'gift') {
      g.rect(p.x - 9, p.y - 7, 18, 14).fill(pack.gift.color).stroke({ width: 1, color: 0xffffff });
      g.rect(p.x - 9, p.y - 1.5, 18, 3).fill(pack.gift.ribbon);
      g.rect(p.x - 1.5, p.y - 7, 3, 14).fill(pack.gift.ribbon);
    } else if (p.kind === 'food') {
      g.circle(p.x, p.y + 1, 7).fill(pack.food.color).stroke({ width: 1, color: 0xffffff });
      g.rect(p.x - 2, p.y - 10, 4, 6).fill(pack.food.bone);
      g.circle(p.x - 3, p.y - 10, 2).fill(pack.food.bone);
      g.circle(p.x + 3, p.y - 10, 2).fill(pack.food.bone);
    } else { // missile refill
      g.rect(p.x - 4, p.y - 8, 8, 13).fill(0xdfe7ef);
      g.poly([p.x - 4, p.y - 8, p.x + 4, p.y - 8, p.x, p.y - 14]).fill(pack.accent);
      g.rect(p.x - 4, p.y + 5, 8, 3).fill(pack.accent);
    }
  }

  /** full redraw — call once per rendered frame */
  draw(): void {
    const sim = this.sim, g = this.field, pack = sim.pack;
    g.clear();
    this.drawBackdrop();

    // stars
    for (const s of sim.stars) {
      g.rect(s.x, s.y, s.s, s.s).fill({ color: 0xffffff, alpha: 0.35 + s.s / 4 });
    }

    if (sim.mode === 'title') {
      this.menuLayer.visible = true;
      this.drawTitleButtons();
      this.setBanner('', '');
      this.warnText.text = '';
      this.hudText.text = ''; this.hudRight.text = ''; this.jokeText.text = '';
      this.toastText.text = ''; this.bossNameText.text = ''; this.weaponNameText.text = '';
      this.hudG.clear();
      this.lastHud = this.lastRight = this.lastJoke = this.lastToast = this.lastWeaponName = '';
      return;
    }
    this.menuLayer.visible = false;

    // pickups (D-39: visuals from the pack)
    for (const p of sim.pickups) this.drawPickup(p);
    // chickens (D-44: per-type scale + ace goggles)
    for (const c of sim.chickens) {
      this.drawBird(c.x, c.y, pack.enemyTypes[c.type].scale, pack.enemyTypes[c.type]);
    }
    // boss
    if (sim.boss) {
      const b = sim.boss;
      if (b.warn > 0) {
        g.circle(b.x, b.y, 62 + Math.sin(b.t * 30) * 6).stroke({ width: 3, color: pack.accent });
      }
      if (b.phaseFlash > 0) {
        g.circle(b.x, b.y, 70 + Math.sin(b.t * 22) * 10).stroke({ width: 4, color: 0xffe066 });
      }
      const inflating = b.def.pattern === 'rising' ? 1 + (1 - b.hp / b.max) * 0.35 : 1;
      this.drawBird(b.x, b.y, (b.def.scale / 3) * inflating, b.def, true, b.def.crest, b.t);
    }
    // eggs
    for (const e of sim.eggs) {
      g.ellipse(e.x, e.y, 5, 8).fill(pack.egg).stroke({ width: 1, color: pack.eggStroke });
    }
    // bullets / missiles
    for (const b of sim.bullets) g.rect(b.x - 2, b.y - 8, 4, 12).fill(0x8ce99a);
    for (const m of sim.missiles) {
      g.rect(m.x - 4, m.y - 12, 8, 20).fill(0xffd43b);
      g.rect(m.x - 4, m.y + 6, 8, 4).fill(0xff6b6b);
    }
    // ship (blink while invulnerable)
    if (sim.ship.alive && (sim.ship.invuln <= 0 || ((sim.waveT * 16) | 0) % 2 === 0)) this.drawShip();
    // particles
    for (const p of sim.parts) {
      g.rect(p.x, p.y, p.s, p.s).fill({ color: p.col, alpha: Math.max(0, p.life * 2) });
    }

    // ---- HUD text (updates only on change) ----
    const hud = `SCORE ${sim.score}\nHI ${Math.max(sim.high, sim.score)}`;
    if (hud !== this.lastHud) { this.hudText.text = hud; this.lastHud = hud; }
    const bossLine = sim.boss ? sim.boss.def.name : `WAVE ${Math.min(sim.waveIdx + 1, sim.wavesTotal)}/${sim.wavesTotal}`;
    const right = `CH ${sim.chapter} · ${sim.chapterDef.name} · ${bossLine}\n[${pack.id.toUpperCase()} · ${sim.unlocked}/${sim.chaptersTotal}]\nFOOD ${sim.foodCount % 8}/8 · MSL ${sim.missileN}`;
    if (right !== this.lastRight) { this.hudRight.text = right; this.lastRight = right; }
    const joke = sim.jokeT > 0 && pack.jokes ? (pack.jokes[sim.chapter - 1] ?? '') : '';
    if (joke !== this.lastJoke) { this.jokeText.text = joke; this.lastJoke = joke; }
    const toast = sim.toast ? sim.toast.msg : '';
    if (toast !== this.lastToast) { this.toastText.text = toast; this.lastToast = toast; }

    this.drawHudGraphics();

    // boss bar + name (D-37)
    if (sim.boss) {
      const b = sim.boss;
      const bw = 340;
      this.hudG.rect(STAGE_W / 2 - bw / 2, 18, bw, 10).fill(0x333333);
      this.hudG.rect(STAGE_W / 2 - bw / 2, 18, bw * Math.max(0, b.hp) / b.max, 10).fill(pack.accent);
      this.hudG.rect(STAGE_W / 2 - bw / 2, 18, bw, 10).stroke({ width: 1, color: 0xffffff });
      const name = b.def.pattern === 'mothership' ? `${b.def.name} — PHASE ${b.phase}` : b.def.name;
      if (this.bossNameText.text !== name) this.bossNameText.text = name;
    } else if (this.bossNameText.text !== '') {
      this.bossNameText.text = '';
    }

    // boss intro warning banner (D-37: the name, front and center)
    if (sim.boss && sim.boss.intro > 0) {
      const flash = ((sim.boss.intro * 6) | 0) % 2 === 0;
      this.warnText.text = flash ? `WARNING!\n${sim.boss.def.name}` : '';
    } else if (this.warnText.text !== '') {
      this.warnText.text = '';
    }

    // banners
    let banner = '', sub = '';
    if (sim.paused) { banner = 'PAUSED'; sub = 'ESC resume · ↑/↓ volume · M mute · Q quit to title'; }
    else if (sim.mode === 'clear') banner = `CHAPTER ${sim.chapter} CLEAR`;
    else if (sim.mode === 'gameover') { banner = 'GAME OVER'; sub = `FIRE/click — continue chapter ${sim.chapter} · ESC — title`; }
    else if (sim.mode === 'win') { banner = 'ALL CHAPTERS CLEAR'; sub = 'FIRE/click — back to title'; }
    this.setBanner(banner, sub);
  }


  /** pips, lives, missiles — cheap vector rows redrawn each frame */
  private drawHudGraphics(): void {
    const sim = this.sim, pack = sim.pack, g = this.hudG;
    g.clear();
    // power pips (one per weapon level)
    const pipW = 11, pipH = 8, gap = 3;
    for (let i = 0; i < pack.weapons.length; i++) {
      const filled = i <= sim.weaponLv;
      g.rect(14 + i * (pipW + gap), 52, pipW, pipH)
        .fill({ color: filled ? pack.accent : 0x2a2a3a })
        .stroke({ width: 1, color: filled ? 0xffffff : 0x555566 });
    }
    // lives: mini ship glyphs (row caps at 8; the count lives in HUD text)
    for (let i = 0; i < Math.min(sim.lives, 8); i++) {
      const x = 20 + i * 20, y = 84;
      g.poly([x, y - 8, x - 7, y + 6, x + 7, y + 6]).fill(pack.ship);
    }
    // weapon name under the pips
    if (this.lastWeaponName !== sim.weaponName) {
      this.lastWeaponName = sim.weaponName;
      this.weaponNameText.text = sim.weaponName;
    }
    // missile pips
    for (let i = 0; i < sim.missileN; i++) {
      const x = 18 + i * 16, y = 104;
      g.rect(x, y, 5, 12).fill(0xdfe7ef);
      g.poly([x, y, x + 5, y, x + 2.5, y - 5]).fill(pack.accent);
    }
  }

  private setBanner(t: string, sub: string): void {
    if (t === this.lastBanner && sub === this.lastSub) return;
    this.lastBanner = t;
    this.lastSub = sub;
    this.bannerBg.clear();
    if (t) this.bannerBg.rect(0, STAGE_H / 2 - 40, STAGE_W, 80).fill({ color: 0x000000, alpha: 0.6 });
    this.bannerText.text = t;
    this.bannerSub.text = sub;
  }
  private lastSub = '';
}
