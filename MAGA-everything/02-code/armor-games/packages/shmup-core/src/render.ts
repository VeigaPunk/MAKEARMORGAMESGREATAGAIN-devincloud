import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { BTN, STAGE_H, STAGE_W, type ShmupSim } from './sim';

/**
 * PixiJS 8 renderer for the shared shmup skeleton — draws `ShmupSim` state
 * each frame. Port of the proto's Canvas2D draw() to Pixi Graphics/Text.
 * Placeholder vector art (PIXEL replaces per recipes); palette comes from
 * the content pack so replica and cluck read distinctly.
 */

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
  private hud = new Container();
  private menuLayer = new Container();
  private btnLabels!: { ch1: Text; ch2: Text; start: Text };
  private bannerBg = new Graphics();
  private bannerText: Text;
  private hudText: Text;
  private hudRight: Text;
  private jokeText: Text;
  private hintText: Text;
  private titleTexts: Text[] = [];
  private lastHud = '';
  private lastRight = '';
  private lastJoke = '';
  private lastBanner = '';

  constructor(private sim: ShmupSim) {
    const pack = sim.pack;
    // gradient backdrop as a 1px-wide texture stretched to the stage
    const bgTex = gradientTexture(pack.bg0, pack.bg1);
    this.bg.rect(0, 0, STAGE_W, STAGE_H).fill({ texture: bgTex });

    this.hudText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace', lineHeight: 20 } });
    this.hudText.x = 14; this.hudText.y = 8;
    this.hudRight = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace', align: 'right', lineHeight: 20 } });
    this.hudRight.anchor.set(1, 0);
    this.hudRight.x = STAGE_W - 14; this.hudRight.y = 8;
    this.jokeText = new Text({ text: '', style: { fill: 0x8ce99a, fontSize: 14, fontFamily: 'monospace', align: 'center' } });
    this.jokeText.anchor.set(0.5, 0);
    this.jokeText.x = STAGE_W / 2; this.jokeText.y = STAGE_H - 120;
    this.hintText = new Text({
      text: 'ARROWS/WASD move · SPACE/Z/LMB fire · X/SHIFT/RMB missile · ESC pause — INTERNAL mechanics proof',
      style: { fill: 0x888899, fontSize: 11, fontFamily: 'monospace' },
    });
    this.hintText.x = 14; this.hintText.y = STAGE_H - 18;
    this.hud.addChild(this.hudText, this.hudRight, this.jokeText, this.hintText);

    this.bannerText = new Text({
      text: '', style: { fill: 0xffffff, fontSize: 26, fontFamily: 'monospace', fontWeight: 'bold', align: 'center' },
    });
    this.bannerText.anchor.set(0.5, 0.5);
    this.bannerText.x = STAGE_W / 2; this.bannerText.y = STAGE_H / 2 + 1;

    this.view.addChild(this.bg, this.field, this.hud, this.menuLayer, this.bannerBg, this.bannerText);
    this.buildTitle();
  }

  // ---------------- title ----------------
  private buildTitle(): void {
    const pack = this.sim.pack;
    const mk = (text: string, y: number, size: number, fill: number, bold = false): Text => {
      const t = new Text({
        text, style: { fill, fontSize: size, fontFamily: 'monospace', align: 'center', fontWeight: bold ? 'bold' : 'normal' },
      });
      t.anchor.set(0.5, 0.5); t.x = STAGE_W / 2; t.y = y;
      this.titleTexts.push(t); this.menuLayer.addChild(t);
      return t;
    };
    const titleText = mk(pack.title, 120, 44, pack.accent, true);
    // cluck pack: authored wordmark replaces the text title when the asset
    // resolves (served from the app's public/art/; replica keeps text).
    if (pack.id === 'cluck') {
      Assets.load<Texture>('/art/title-cluck-horizon.svg')
        .then((tex) => {
          const s = new Sprite(tex);
          s.anchor.set(0.5); s.x = STAGE_W / 2; s.y = 120;
          s.scale.set(Math.min(1, (STAGE_W - 80) / tex.width));
          this.menuLayer.addChild(s);
          titleText.visible = false;
        })
        .catch(() => { /* asset absent — text title stays */ });
    }
    mk(pack.sub, 152, 15, 0xaaaabb);
    mk('— INTERNAL mechanics proof · not for public ship —', 178, 12, 0x666677);
    mk('ENTER start · 1/2 chapter · click works too', 460, 13, 0x888899);
    mk(this.sim.pack.id === 'replica'
      ? 'replica = CI2-era formula · INTERNAL-NO-PUBLIC'
      : 'original = Cluck Horizon IP · INTERNAL-NO-PUBLIC', 482, 12, 0x666677);
    // persistent button labels — drawTitleButtons only restyles them
    const mkBtn = (r: { x: number; y: number; w: number; h: number }): Text => {
      const t = new Text({ text: '', style: { fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold' } });
      t.anchor.set(0.5, 0.5); t.x = r.x + r.w / 2; t.y = r.y + r.h / 2 + 1;
      this.menuLayer.addChild(t);
      return t;
    };
    this.btnLabels = { ch1: mkBtn(BTN.ch1), ch2: mkBtn(BTN.ch2), start: mkBtn(BTN.start) };
    this.menuLayer.visible = false;
  }

  private drawTitleButtons(): void {
    const g = this.field, sim = this.sim;
    const btn = (r: { x: number; y: number; w: number; h: number }, label: Text, text: string, on: boolean) => {
      g.roundRect(r.x, r.y, r.w, r.h, 4)
        .fill({ color: on ? sim.pack.accent : 0x222233 })
        .stroke({ width: 1, color: 0xffffff });
      label.text = text;
      label.style.fill = on ? 0x111111 : 0xddddee;
    };
    btn(BTN.ch1, this.btnLabels.ch1, 'CH 1', sim.titleSel === 1);
    btn(BTN.ch2, this.btnLabels.ch2, sim.unlocked >= 2 ? 'CH 2' : 'CH 2 LOCKED', sim.titleSel === 2 && sim.unlocked >= 2);
    btn(BTN.start, this.btnLabels.start, 'START', true);
  }

  // ---------------- entities ----------------
  private drawBird(x: number, y: number, k: number, type = 0, boss = false): void {
    const g = this.field, pack = this.sim.pack;
    const variant = boss ? pack.bosses[type] : pack.enemyTypes[type];
    g.ellipse(x, y, 16 * k, 13 * k).fill(variant.color);
    g.ellipse(x, y - 12 * k, 8 * k, 7 * k).fill(variant.headColor);
    g.ellipse(x, y - 19 * k, 4 * k, 3 * k).fill(0xff8787);
    g.poly([x - 3 * k, y - 11 * k, x + 3 * k, y - 11 * k, x, y - 7 * k]).fill(0xffa94d);
    g.rect(x - 3 * k, y - 14 * k, 2 * k, 2 * k).fill(0x111111);
    g.rect(x + 1.5 * k, y - 14 * k, 2 * k, 2 * k).fill(0x111111);
  }

  private drawShip(): void {
    const g = this.field, pack = this.sim.pack, s = this.sim.ship;
    g.poly([s.x, s.y - 18, s.x - 14, s.y + 12, s.x - 5, s.y + 8, s.x + 5, s.y + 8, s.x + 14, s.y + 12]).fill(pack.ship);
    g.rect(s.x - 3, s.y - 8, 6, 8).fill(0xffffff);
    g.rect(s.x - 9, s.y + 12, 4, 5).fill(pack.accent);
    g.rect(s.x + 5, s.y + 12, 4, 5).fill(pack.accent);
  }

  /** full redraw — call once per rendered frame */
  draw(): void {
    const sim = this.sim, g = this.field;
    g.clear();


    // stars
    for (const s of sim.stars) {
      g.rect(s.x, s.y, s.s, s.s).fill({ color: 0xffffff, alpha: 0.35 + s.s / 4 });
    }

    if (sim.mode === 'title') {
      this.menuLayer.visible = true;
      this.drawTitleButtons();
      this.setBanner('');
      this.hudText.text = ''; this.hudRight.text = ''; this.jokeText.text = '';
      this.lastHud = this.lastRight = this.lastJoke = '';
      return;
    }
    this.menuLayer.visible = false;

    // pickups
    for (const p of sim.pickups) {
      if (p.kind === 'gift') {
        g.rect(p.x - 9, p.y - 7, 18, 14).fill(0xe599f7).stroke({ width: 1, color: 0xffffff });
        g.rect(p.x - 9, p.y - 1.5, 18, 3).fill(0x9c36b5);
      } else {
        g.circle(p.x, p.y, 8).fill(0xffa94d).stroke({ width: 1, color: 0xffffff });
        g.rect(p.x - 2, p.y - 11, 4, 6).fill(0xe8590c);
      }
    }
    // chickens
    for (const c of sim.chickens) this.drawBird(c.x, c.y, 1, c.type);
    // boss
    if (sim.boss) {
      const b = sim.boss;
      if (b.warn > 0) {
        g.circle(b.x, b.y, 62 + Math.sin(b.t * 30) * 6).stroke({ width: 3, color: sim.pack.accent });
      }
      this.drawBird(b.x, b.y, 3.2, b.type, true);
      g.rect(STAGE_W / 2 - 160, 14, 320, 10).fill(0x333333);
      g.rect(STAGE_W / 2 - 160, 14, 320 * Math.max(0, b.hp) / b.max, 10).fill(sim.pack.accent);
      g.rect(STAGE_W / 2 - 160, 14, 320, 10).stroke({ width: 1, color: 0xffffff });
    }
    // eggs
    for (const e of sim.eggs) {
      g.ellipse(e.x, e.y, 5, 8).fill(sim.pack.egg).stroke({ width: 1, color: 0x948b6b });
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

    // HUD (Text objects update only on change)
    const hud = `SCORE ${sim.score}\nLIVES ${'♥'.repeat(Math.max(0, sim.lives))}\n${sim.pack.weapons[sim.weaponLv]}\nMISSILES ${sim.missileN}`;
    if (hud !== this.lastHud) { this.hudText.text = hud; this.lastHud = hud; }
    const right = `CH ${sim.chapter} · ${sim.boss ? 'BOSS' : `WAVE ${sim.waveIdx + 1}/${sim.wavesTotal}`}\n[${sim.pack.id.toUpperCase()}]`;
    if (right !== this.lastRight) { this.hudRight.text = right; this.lastRight = right; }
    const joke = sim.jokeT > 0 && sim.pack.jokes ? (sim.pack.jokes[sim.chapter - 1] ?? '') : '';
    if (joke !== this.lastJoke) { this.jokeText.text = joke; this.lastJoke = joke; }

    // banners
    let banner = '';
    if (sim.paused) banner = 'PAUSED';
    else if (sim.mode === 'clear') banner = `CHAPTER ${sim.chapter} CLEAR — next: chapter ${sim.chapter + 1}`;
    else if (sim.mode === 'gameover') banner = 'GAME OVER — R / click for title';
    else if (sim.mode === 'win') banner = 'ALL CHAPTERS CLEAR — R / click for title';
    this.setBanner(banner);
  }

  private setBanner(t: string): void {
    if (t === this.lastBanner) return;
    this.lastBanner = t;
    this.bannerBg.clear();
    if (t) this.bannerBg.rect(0, STAGE_H / 2 - 40, STAGE_W, 80).fill({ color: 0x000000, alpha: 0.6 });
    this.bannerText.text = t;
  }
}
