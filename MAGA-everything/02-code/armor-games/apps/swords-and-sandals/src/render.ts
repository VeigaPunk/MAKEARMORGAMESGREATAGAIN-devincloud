/**
 * Canvas art layer — colosseum backdrop (ported from the r1 prototype pass,
 * it was good), articulated paper-doll fighters with gear, crowd that
 * bounces on big hits, floating damage numbers, screen shake, shop
 * interiors. Pure 2D canvas; no external assets (rights posture).
 */
import { LOOK_PRESETS } from './data';
import { Fighter, Bout } from './engine';

export const STAGE_W = 960, STAGE_H = 560;
const SAND_Y = 366;

export interface FighterGear { helm: string; chest: string; shield: string; boots: string; weapon: string; scale: number }

interface FloatTxt { x: number; y: number; t: number; txt: string; color: string; crit: boolean }
interface AttackAnim { side: 'player' | 'enemy'; kind: 'quick' | 'power' | 'ranged'; t: number; dur: number }

export type SceneKind = 'title' | 'create' | 'hub' | 'arena' | 'shop' | 'end';

export interface SceneState {
  kind: SceneKind;
  shop?: 'smith' | 'armoury' | 'alchemist' | 'fletcher';
  bout: Bout | null;
  playerGear: FighterGear | null;
  enemyGear: FighterGear | null;
  crowd: number;
  previewLook?: { preset: number; skin: number; hair: number; height: number; build: number };
  previewGear?: FighterGear;
  endKind?: 'win' | 'lose' | 'complete';
}

/* ---------- color helpers ---------- */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function shade(rgb: string, f: number): string {
  const m = rgb.match(/\d+/g)!;
  return `rgb(${Math.min(255, Math.round(+m[0] * f))},${Math.min(255, Math.round(+m[1] * f))},${Math.min(255, Math.round(+m[2] * f))})`;
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private backdrop: HTMLCanvasElement | null = null;
  private crowdPts: { x: number; y: number; ph: number; c: string }[] = [];
  private motes: { x: number; y: number; r: number; ph: number; sp: number }[] = [];
  private confetti: { x: number; y: number; ph: number; c: string }[] = [];
  private floats: FloatTxt[] = [];
  private attacks: AttackAnim[] = [];
  private shake = 0;
  private crowdExcite = 0;
  private shownP = 18;
  private shownE = 84;
  state: SceneState = { kind: 'title', bout: null, playerGear: null, enemyGear: null, crowd: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  addFloat(txt: string, x: number, y: number, color: string, crit = false): void {
    this.floats.push({ x, y, t: 0, txt, color, crit });
  }
  startAttack(side: 'player' | 'enemy', kind: 'quick' | 'power' | 'ranged'): void {
    this.attacks.push({ side, kind, t: 0, dur: kind === 'power' ? 30 : 20 });
  }
  kickShake(mag: number): void { this.shake = Math.max(this.shake, mag); }
  kickCrowd(v: number): void { this.crowdExcite = Math.min(1, Math.max(this.crowdExcite, v)); }

  /** map bout position (0..100) → stage x */
  static posToX(pos: number): number { return 120 + (pos / 100) * 720; }

  frame(dtMs: number, t: number): void {
    if (!this.backdrop) this.buildBackdrop();
    const c = this.ctx;
    for (const a of this.attacks) a.t += dtMs / 16;
    this.attacks = this.attacks.filter(a => a.t < a.dur);
    for (const f of this.floats) f.t += dtMs / 16;
    this.floats = this.floats.filter(f => f.t < 55);
    this.shake *= Math.pow(0.88, dtMs / 16);
    if (this.shake < 0.4) this.shake = 0;
    this.crowdExcite = Math.max(0, this.crowdExcite - dtMs / 9000);

    const st = this.state;
    if (st.bout) {
      this.shownP += (st.bout.player.pos - this.shownP) * Math.min(1, dtMs / 140);
      this.shownE += (st.bout.enemy.pos - this.shownE) * Math.min(1, dtMs / 140);
    }
    c.save();
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    if (st.kind === 'shop') {
      this.drawShopInterior(st.shop ?? 'smith', t);
    } else {
      c.drawImage(this.backdrop!, 0, 0);
      this.drawCrowdOverlay(t);
      if (st.kind === 'title') this.drawTitle(t);
      else if (st.kind === 'create') this.drawCreate(t);
      else if (st.kind === 'hub') this.drawHub(t);
      else if (st.kind === 'arena' && st.bout) this.drawArena(t);
      else if (st.kind === 'end') this.drawEnd(t);
    }
    this.drawFloats();
    c.restore();
  }

  /* ================= backdrop (static, cached) ================= */
  private buildBackdrop(): void {
    const cv = document.createElement('canvas');
    cv.width = STAGE_W; cv.height = STAGE_H;
    const a = cv.getContext('2d')!;
    let g = a.createLinearGradient(0, 0, 0, 280);
    g.addColorStop(0, '#f4d98f'); g.addColorStop(0.55, '#e8b96a'); g.addColorStop(1, '#d99a52');
    a.fillStyle = g; a.fillRect(0, 0, STAGE_W, 280);
    g = a.createRadialGradient(700, 56, 10, 700, 56, 250);
    g.addColorStop(0, 'rgba(255,246,214,.95)'); g.addColorStop(1, 'rgba(255,246,214,0)');
    a.fillStyle = g; a.fillRect(0, 0, STAGE_W, 280);
    // colosseum: 3 tiers of arched stands
    const tiers = [
      { y: 44, h: 84, c1: '#c8a068', c2: '#a87f4c' },
      { y: 128, h: 84, c1: '#b89058', c2: '#96703f' },
      { y: 212, h: 84, c1: '#a87f4c', c2: '#84603a' },
    ];
    const bannerCols = ['#8a2a22', '#3a5a8a', '#7a5a20', '#5a3a6a'];
    tiers.forEach((ti, idx) => {
      g = a.createLinearGradient(0, ti.y, 0, ti.y + ti.h);
      g.addColorStop(0, ti.c1); g.addColorStop(1, ti.c2);
      a.fillStyle = g; a.fillRect(0, ti.y, STAGE_W, ti.h);
      a.fillStyle = 'rgba(255,240,200,.35)'; a.fillRect(0, ti.y, STAGE_W, 4);
      a.fillStyle = 'rgba(60,35,15,.4)'; a.fillRect(0, ti.y + ti.h - 6, STAGE_W, 6);
      for (let x = 10; x < STAGE_W - 30; x += 56) {
        a.fillStyle = 'rgba(52,32,16,.85)';
        a.beginPath();
        a.moveTo(x, ti.y + ti.h - 8); a.lineTo(x, ti.y + 32); a.arc(x + 20, ti.y + 32, 20, Math.PI, 0);
        a.lineTo(x + 40, ti.y + ti.h - 8); a.closePath(); a.fill();
        a.strokeStyle = 'rgba(255,230,180,.25)'; a.lineWidth = 2;
        a.beginPath();
        a.moveTo(x, ti.y + ti.h - 8); a.lineTo(x, ti.y + 32); a.arc(x + 20, ti.y + 32, 20, Math.PI, 0);
        a.lineTo(x + 40, ti.y + ti.h - 8); a.stroke();
        for (let k = 0; k < 9; k++) {
          const px = x + 6 + ((x * 7 + k * 29 + idx * 13) % 28), py = ti.y + 28 + ((x + k * 47) % (ti.h - 44));
          this.crowdPts.push({ x: px, y: py, ph: ((x + k * 17) % 628) / 100, c: (x + k) % 2 === 0 ? '#e8c890' : '#5a3a20' });
        }
      }
      for (let x = 56 + idx * 28; x < STAGE_W - 40; x += 224) {
        a.fillStyle = bannerCols[((x / 56) + idx) % 4 | 0];
        a.beginPath();
        a.moveTo(x, ti.y + ti.h - 6); a.lineTo(x + 26, ti.y + ti.h - 6); a.lineTo(x + 26, ti.y + ti.h + 26);
        a.lineTo(x + 13, ti.y + ti.h + 16); a.lineTo(x, ti.y + ti.h + 26); a.closePath(); a.fill();
        a.fillStyle = 'rgba(255,220,140,.5)'; a.fillRect(x, ti.y + ti.h - 6, 26, 4);
      }
    });
    // arena wall above the sand
    g = a.createLinearGradient(0, 296, 0, SAND_Y);
    g.addColorStop(0, '#9a7448'); g.addColorStop(1, '#7a5836');
    a.fillStyle = g; a.fillRect(0, 296, STAGE_W, SAND_Y - 296);
    a.fillStyle = '#c8a068'; a.fillRect(0, 296, STAGE_W, 6);
    a.strokeStyle = 'rgba(60,35,15,.35)'; a.lineWidth = 2;
    for (let x = 40; x < STAGE_W; x += 80) { a.beginPath(); a.moveTo(x, 302); a.lineTo(x, SAND_Y); a.stroke(); }
    // sun-baked sand
    g = a.createRadialGradient(480, 460, 60, 480, 460, 560);
    g.addColorStop(0, '#e8c078'); g.addColorStop(0.6, '#d8a860'); g.addColorStop(1, '#b8863f');
    a.fillStyle = g; a.fillRect(0, SAND_Y, STAGE_W, STAGE_H - SAND_Y);
    a.strokeStyle = 'rgba(120,80,35,.22)'; a.lineWidth = 2;
    for (let r = 60; r < 620; r += 42) { a.beginPath(); a.arc(480, 620, r, Math.PI * 1.15, Math.PI * 1.85); a.stroke(); }
    [[300, 490, 46], [640, 530, 60], [480, 420, 30]].forEach(s => {
      g = a.createRadialGradient(s[0], s[1], 4, s[0], s[1], s[2]);
      g.addColorStop(0, 'rgba(110,60,25,.2)'); g.addColorStop(1, 'rgba(110,60,25,0)');
      a.fillStyle = g; a.fillRect(s[0] - s[2], s[1] - s[2], s[2] * 2, s[2] * 2);
    });
    // arena decals: broken sword + lost shield
    a.save(); a.translate(370, 510); a.rotate(0.5);
    a.fillStyle = '#7a7f88'; a.fillRect(-2, -26, 4, 22);
    a.fillStyle = '#5a5f68'; a.beginPath(); a.moveTo(-2, -26); a.lineTo(2, -26); a.lineTo(0, -33); a.closePath(); a.fill();
    a.fillStyle = '#6a4a20'; a.fillRect(-7, -6, 14, 4); a.fillRect(-2, -2, 4, 10); a.restore();
    a.save(); a.translate(600, 495); a.rotate(-0.35);
    a.fillStyle = '#8a5a28'; a.beginPath(); a.arc(0, 0, 17, 0, 7); a.fill();
    a.strokeStyle = '#5a3a18'; a.lineWidth = 3; a.beginPath(); a.arc(0, 0, 17, 0, 7); a.stroke();
    a.fillStyle = '#c9a86a'; a.beginPath(); a.arc(0, 0, 5, 0, 7); a.fill(); a.restore();
    // torch braziers (flames drawn per-frame)
    [56, 904].forEach(bx => {
      a.fillStyle = '#3a2a18'; a.fillRect(bx - 4, 308, 8, 42);
      a.fillStyle = '#54340f';
      a.beginPath(); a.moveTo(bx - 16, 308); a.lineTo(bx + 16, 308); a.lineTo(bx + 9, 290); a.lineTo(bx - 9, 290); a.closePath(); a.fill();
      a.strokeStyle = '#c9a86a'; a.lineWidth = 2; a.beginPath(); a.moveTo(bx - 15, 306); a.lineTo(bx + 15, 306); a.stroke();
    });
    for (let i = 0; i < 26; i++) {
      this.motes.push({ x: Math.random() * STAGE_W, y: SAND_Y + Math.random() * 170, r: 0.8 + Math.random() * 1.6, ph: Math.random() * 6.28, sp: 0.12 + Math.random() * 0.3 });
    }
    for (let i = 0; i < 70; i++) {
      this.confetti.push({ x: Math.random() * STAGE_W, y: Math.random() * 340, ph: Math.random() * 6.28, c: ['#ffd23a', '#e8c37a', '#fff2c8', '#c9a86a'][i % 4] });
    }
    this.backdrop = cv;
  }

  private drawCrowdOverlay(t: number): void {
    const c = this.ctx;
    const ex = this.crowdExcite;
    for (const p of this.crowdPts) {
      const bob = Math.sin(t / 700 + p.ph) * (1 + ex * 5) - ex * 3;
      c.globalAlpha = 0.55 + 0.35 * Math.sin(t / 700 + p.ph);
      c.fillStyle = p.c;
      c.fillRect(p.x, p.y + bob, 3, 3 + ex * 2);
    }
    c.globalAlpha = 1;
    const fr = Math.floor(t / 140) % 2;
    [56, 904].forEach(bx => {
      const g = c.createRadialGradient(bx, 286, 4, bx, 286, 60);
      g.addColorStop(0, 'rgba(255,190,80,.4)'); g.addColorStop(1, 'rgba(255,190,80,0)');
      c.fillStyle = g; c.fillRect(bx - 60, 226, 120, 120);
      c.fillStyle = '#ff9a2a';
      c.beginPath(); c.moveTo(bx - 8, 290);
      c.quadraticCurveTo(bx - 10, 274, bx + (fr ? 3 : -3), 264);
      c.quadraticCurveTo(bx + 10, 274, bx + 8, 290); c.closePath(); c.fill();
      c.fillStyle = '#ffd23a';
      c.beginPath(); c.moveTo(bx - 4, 290);
      c.quadraticCurveTo(bx - 5, 280, bx + (fr ? -2 : 2), 273);
      c.quadraticCurveTo(bx + 5, 280, bx + 4, 290); c.closePath(); c.fill();
    });
    for (const m of this.motes) {
      const my = m.y - ((t * m.sp / 40) % 190);
      c.globalAlpha = 0.12 + 0.12 * Math.sin(t / 900 + m.ph);
      c.fillStyle = '#ffe9b8';
      c.beginPath(); c.arc(m.x, my < SAND_Y + 30 ? my + 190 : my, m.r, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ================= scene compositions ================= */
  private drawTitle(t: number): void {
    const c = this.ctx;
    const bob = Math.sin(t / 500) * 3;
    this.drawFighter({ x: 250, y: 470 }, { preset: 0, skin: 0.5, hair: 0.5, height: 0.55, build: 0.5 },
      { helm: 'bronze', chest: 'cuirass', shield: 'scutum', boots: 'boots', weapon: 'spatha', scale: 1.05 }, false, t, 0, false);
    this.drawFighter({ x: 710, y: 470 }, { preset: 2, skin: 0.4, hair: 0.4, height: 0.6, build: 0.7 },
      { helm: 'visor', chest: 'plate', shield: 'none', boots: 'sabatons', weapon: 'colossuscleaver', scale: 1.3 }, true, t, 0, false);
    void bob;
  }

  private drawCreate(t: number): void {
    if (!this.state.previewLook) return;
    this.drawFighter({ x: STAGE_W / 2, y: 470 }, this.state.previewLook,
      this.state.previewGear ?? { helm: 'none', chest: 'rags', shield: 'none', boots: 'sandals', weapon: 'gladius', scale: 1 }, false, t, 0, false);
  }

  private drawHub(t: number): void {
    if (!this.state.previewLook || !this.state.playerGear) return;
    this.drawFighter({ x: 300, y: 478 }, this.state.previewLook, this.state.playerGear, false, t, 0, false);
    // opponent silhouette on the far side, waiting
    this.drawFighter({ x: 700, y: 478 }, { preset: 1, skin: 0.3, hair: 0.6, height: 0.6, build: 0.65 },
      { helm: 'cap', chest: 'studs', shield: 'buckler', boots: 'boots', weapon: 'club', scale: 1.0 }, true, t, 0, false, 'quick', 0.75);
  }

  private drawEnd(t: number): void {
    const c = this.ctx;
    if (this.state.endKind === 'complete' || this.state.endKind === 'win') {
      for (const p of this.confetti) {
        const cy = (p.y + t * 0.06) % 360, cx2 = p.x + Math.sin(t / 600 + p.ph) * 14;
        c.globalAlpha = 0.8; c.fillStyle = p.c; c.fillRect(cx2, 40 + cy, 4, 7);
      }
      c.globalAlpha = 1;
    }
    if (this.state.previewLook && this.state.playerGear) {
      this.drawFighter({ x: STAGE_W / 2, y: 478 }, this.state.previewLook, this.state.playerGear, false, t, 0, this.state.endKind === 'lose');
    }
  }

  private drawArena(t: number): void {
    const b = this.state.bout!;
    const px = Scene.posToX(this.shownP), ex = Scene.posToX(this.shownE);
    const pa = this.attacks.find(a => a.side === 'player');
    const ea = this.attacks.find(a => a.side === 'enemy');
    // distance marker ticks (the fight line)
    const c = this.ctx;
    c.strokeStyle = 'rgba(90,58,24,.25)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(120, 520); c.lineTo(840, 520); c.stroke();
    const pF = b.player, eF = b.enemy;
    this.drawFighter({ x: px, y: 500 }, pF.look, this.state.playerGear!, false, t,
      pa ? pa.t / pa.dur : 0, pF.hp < pF.maxHp * 0.3, pa?.kind ?? 'quick');
    this.drawFighter({ x: ex, y: 500 }, eF.look, this.state.enemyGear!, true, t,
      ea ? ea.t / ea.dur : 0, eF.hp < eF.maxHp * 0.3, ea?.kind ?? 'quick', b.phase2 ? 1 : 0);
    // nameplates over fighters
    this.nameplate(px, 330, pF.name, '#ffd23a');
    this.nameplate(ex, 330, eF.name, '#ff9a8a');
  }

  private nameplate(x: number, y: number, name: string, col: string): void {
    const c = this.ctx;
    c.font = 'bold 15px Georgia';
    const w = Math.max(120, c.measureText(name).width + 26);
    const g = c.createLinearGradient(x - w / 2, y - 16, x - w / 2, y + 6);
    g.addColorStop(0, '#c8a068'); g.addColorStop(1, '#8a6238');
    c.fillStyle = g; rrect(c, x - w / 2, y - 16, w, 22, 4); c.fill();
    c.strokeStyle = '#5a3a18'; c.lineWidth = 1.5; rrect(c, x - w / 2, y - 16, w, 22, 4); c.stroke();
    c.textAlign = 'center'; c.fillStyle = col;
    c.fillText(name, x, y);
  }

  private drawFloats(): void {
    const c = this.ctx;
    for (const f of this.floats) {
      if (f.crit) {
        const s = 1 + Math.max(0, 1 - f.t / 8) * 0.6;
        c.save(); c.translate(f.x, f.y - f.t * 1.4); c.scale(s, s);
        c.fillStyle = 'rgba(255,180,40,.5)';
        for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillRect(-2, -26, 4, 12); }
        c.font = 'bold 22px Georgia'; c.textAlign = 'center';
        c.fillStyle = 'rgba(60,20,0,.8)'; c.fillText(f.txt, 1, 7);
        c.fillStyle = f.color; c.fillText(f.txt, 0, 6);
        c.restore();
      } else {
        c.font = 'bold 18px Georgia'; c.textAlign = 'center';
        c.fillStyle = 'rgba(30,12,0,.7)'; c.fillText(f.txt, f.x + 1, f.y - f.t * 1.2 + 1);
        c.fillStyle = f.color; c.fillText(f.txt, f.x, f.y - f.t * 1.2);
      }
    }
  }

  /* ================= shop interiors ================= */
  private drawShopInterior(shop: 'smith' | 'armoury' | 'alchemist' | 'fletcher', t: number): void {
    const c = this.ctx;
    // warm stone interior shell
    let g = c.createLinearGradient(0, 0, 0, STAGE_H);
    g.addColorStop(0, shop === 'alchemist' ? '#3a3040' : '#4a3a28');
    g.addColorStop(1, shop === 'alchemist' ? '#241c28' : '#2c2114');
    c.fillStyle = g; c.fillRect(0, 0, STAGE_W, STAGE_H);
    // back wall bricks
    c.strokeStyle = 'rgba(255,235,190,.08)'; c.lineWidth = 2;
    for (let y = 40; y < 380; y += 34) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(STAGE_W, y); c.stroke();
      for (let x = (y / 34) % 2 ? 30 : 0; x < STAGE_W; x += 60) {
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 34); c.stroke();
      }
    }
    // floor
    g = c.createLinearGradient(0, 380, 0, STAGE_H);
    g.addColorStop(0, '#6a5236'); g.addColorStop(1, '#4a3a24');
    c.fillStyle = g; c.fillRect(0, 380, STAGE_W, STAGE_H - 380);
    const fr = Math.floor(t / 160) % 2;
    if (shop === 'smith') {
      // forge glow + anvil + weapon rack
      const fg = c.createRadialGradient(760, 300, 20, 760, 300, 240);
      fg.addColorStop(0, `rgba(255,120,40,${0.5 + (fr ? 0.12 : 0)})`); fg.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = fg; c.fillRect(500, 60, 460, 480);
      c.fillStyle = '#54340f'; c.fillRect(742, 300, 36, 90);
      c.fillStyle = '#3a2a18'; c.fillRect(730, 384, 60, 26);
      c.fillStyle = '#2c2018'; rrect(c, 640, 340, 130, 26, 8); c.fill();
      c.fillStyle = '#5a5f68'; c.fillRect(690, 310, 30, 34);
      // hanging horseshoe glow
      c.fillStyle = '#e8842a'; c.fillRect(752, 260 + (fr ? 3 : 0), 16, 10);
      c.fillStyle = '#ffd23a'; c.fillRect(756, 256 + (fr ? 3 : 0), 8, 8);
      this.drawWeaponArt(c, 'spatha', 200, 340, 1.1, false);
      this.drawWeaponArt(c, 'cleaver', 260, 344, 1.1, false);
      this.drawWeaponArt(c, 'brand', 320, 342, 1.1, true);
    } else if (shop === 'armoury') {
      // armor stands
      for (let i = 0; i < 3; i++) {
        const x = 200 + i * 210;
        c.strokeStyle = '#5a3a18'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(x, 430); c.lineTo(x, 220); c.stroke();
        c.fillStyle = '#6a4a20'; c.fillRect(x - 26, 424, 52, 10);
        const chests = ['rags', 'studs', 'cuirass', 'plate'];
        const helms = ['none', 'cap', 'bronze', 'visor'];
        const shields = ['none', 'buckler', 'scutum', 'aegis'];
        this.drawChestArt(c, x, 250, chests[i === 2 ? 3 : i + 1], 1.1);
        if (i > 0) this.drawHelmArt(c, x, 205, helms[i === 2 ? 3 : i + 1], 1.1);
        if (i < 2) this.drawShieldArt(c, x + 55, 290, shields[i + 1], 1);
      }
    } else if (shop === 'alchemist') {
      // shelves of bottles, bubbling cauldron
      c.fillStyle = '#54340f'; c.fillRect(120, 180, 620, 12); c.fillRect(120, 280, 620, 12);
      for (let i = 0; i < 12; i++) {
        const x = 140 + i * 52, y = i % 2 ? 152 : 252;
        const cols = ['#7dd871', '#d87d71', '#71a8d8', '#d8c45e'];
        c.fillStyle = cols[i % 4];
        rrect(c, x, y, 22, 28 - (i % 3) * 4, 5); c.fill();
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 3, y + 3, 5, 8);
      }
      const cg = c.createRadialGradient(770, 400, 10, 770, 400, 130);
      cg.addColorStop(0, 'rgba(125,216,113,.5)'); cg.addColorStop(1, 'rgba(125,216,113,0)');
      c.fillStyle = cg; c.fillRect(640, 280, 260, 240);
      c.fillStyle = '#3a3a44'; c.beginPath(); c.ellipse(770, 400, 64, 22, 0, 0, 7); c.fill();
      c.fillStyle = '#7dd871'; c.beginPath(); c.ellipse(770, 400, 56, 16, 0, 0, 7); c.fill();
      for (let i = 0; i < 4; i++) {
        const bx2 = 740 + i * 18, by = 396 - ((t / 6 + i * 31) % 44);
        c.globalAlpha = 0.5;
        c.fillStyle = '#a8f0a0'; c.beginPath(); c.arc(bx2, by, 3 + (i % 3), 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    } else {
      // fletcher: bow rack + arrow bundles
      c.strokeStyle = '#5a3a18'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(140, 180); c.lineTo(640, 180); c.stroke();
      this.drawWeaponArt(c, 'bow', 220, 300, 1.4, false);
      this.drawWeaponArt(c, 'bow', 330, 300, 1.4, false);
      this.drawWeaponArt(c, 'sling', 440, 310, 1.4, false);
      for (let b = 0; b < 4; b++) {
        const x = 540 + b * 26;
        c.strokeStyle = '#c9a86a'; c.lineWidth = 2;
        for (let k = 0; k < 5; k++) {
          c.beginPath(); c.moveTo(x, 240 + k * 3); c.lineTo(x + 12, 380); c.stroke();
        }
        c.fillStyle = '#8a2a22'; c.beginPath(); c.moveTo(x - 2, 240); c.lineTo(x + 14, 240); c.lineTo(x + 6, 252); c.closePath(); c.fill();
      }
    }
    // hanging lamp
    c.strokeStyle = '#3a2a18'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(STAGE_W / 2, 0); c.lineTo(STAGE_W / 2, 70); c.stroke();
    const lg = c.createRadialGradient(STAGE_W / 2, 84, 4, STAGE_W / 2, 84, 200);
    lg.addColorStop(0, 'rgba(255,220,140,.35)'); lg.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = lg; c.fillRect(STAGE_W / 2 - 200, 0, 400, 300);
    c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(STAGE_W / 2, 84, 7 + (fr ? 1 : 0), 0, 7); c.fill();
  }

  /* ================= the articulated fighter ================= */
  private drawFighter(at: { x: number; y: number }, look: { preset: number; skin: number; hair: number; height: number; build: number },
    gear: FighterGear, flip: boolean, t: number, attackT: number, hurt: boolean, attackKind: 'quick' | 'power' | 'ranged' = 'quick',
    alpha = 1): void {
    const c = this.ctx;
    const preset = LOOK_PRESETS[Math.max(0, Math.min(2, Math.round(look.preset)))];
    const skin = lerpColor(lerpColor('#f2d3ac', preset.skin, 0.55), '#8a5a34', look.skin);
    const hair = lerpColor('#e8d8b0', '#1a1008', look.hair);
    const s = gear.scale * (0.94 + look.height * 0.14);
    const wide = 0.88 + look.build * 0.3;
    const bob = Math.sin(t / 460 + at.x) * 1.4;
    const lungeX = attackT > 0 ? (flip ? -1 : 1) * Math.sin(Math.min(1, attackT) * Math.PI) * 26 : 0;
    c.save();
    c.globalAlpha = alpha;
    // feet shadow (unflipped, unflickered)
    c.fillStyle = 'rgba(60,30,10,.3)';
    c.beginPath(); c.ellipse(at.x, at.y + 3, 30 * s, 7 * s, 0, 0, 7); c.fill();
    c.translate(at.x + lungeX, at.y);
    if (flip) c.scale(-1, 1);
    c.scale(s * wide, s * (0.95 + look.height * 0.1));
    if (hurt) c.globalAlpha = alpha * (0.55 + Math.sin(t / 40) * 0.3);
    c.lineCap = 'round';
    const legW = 9;
    const torsoTop = -70 + bob, torsoH = 42;
    // back arm (+ shield)
    c.strokeStyle = skin; c.lineWidth = 7;
    c.beginPath(); c.moveTo(-8, torsoTop + 8); c.lineTo(-16, torsoTop + 26); c.stroke();
    this.drawShieldArt(c, -18, torsoTop + 28, gear.shield);
    // legs
    c.strokeStyle = skin; c.lineWidth = legW;
    const stride = attackT > 0 ? 6 : 3;
    c.beginPath(); c.moveTo(-6, torsoTop + torsoH); c.lineTo(-9 - stride, -2); c.stroke();
    c.beginPath(); c.moveTo(6, torsoTop + torsoH); c.lineTo(10 + stride, -2); c.stroke();
    this.drawBootsArt(c, -9 - stride, 10 + stride, gear.boots);
    // torso by chest tier
    this.drawChestArt(c, 0, torsoTop, gear.chest, 1, preset.garment);
    // belt
    c.fillStyle = '#3a2a14'; c.fillRect(-15, torsoTop + torsoH - 2, 30, 7);
    c.fillStyle = '#c9a86a'; c.fillRect(-3, torsoTop + torsoH - 2, 6, 7);
    // front arm + weapon — 2-pose attack via arm rotation
    const armAng = attackT > 0
      ? -0.5 + Math.sin(Math.min(1, attackT) * Math.PI) * (attackKind === 'power' ? 1.9 : 1.4)
      : -0.5 + Math.sin(t / 460 + at.x) * 0.04;
    c.save();
    c.translate(8, torsoTop + 8);
    c.rotate(armAng);
    c.strokeStyle = skin; c.lineWidth = 7;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(11, 16); c.stroke();
    c.translate(12, 17);
    if (attackKind === 'ranged' && attackT > 0) this.drawWeaponArt(c, 'bow', 0, 0, 1, false);
    else this.drawWeaponArt(c, gear.weapon, 0, 0, 1, gear.weapon === 'brand' || gear.weapon === 'colossuscleaver');
    c.restore();
    // head
    c.fillStyle = skin;
    c.beginPath(); c.arc(0, torsoTop - 14, 13, 0, 7); c.fill();
    c.fillStyle = '#2a1a0e'; c.fillRect(4, torsoTop - 17, 3, 3);
    // hair tuft under helm
    c.fillStyle = hair; c.fillRect(-11, torsoTop - 16, 4, 8);
    this.drawHelmArt(c, 0, torsoTop - 16, gear.helm, 1);
    c.restore();
  }

  /* ---------- gear art (paper-doll pieces) ---------- */
  private drawHelmArt(c: CanvasRenderingContext2D, x: number, y: number, art: string, s = 1): void {
    if (art === 'none') return;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (art === 'cap') {
      c.fillStyle = '#7a5a30';
      c.beginPath(); c.arc(0, 0, 14, Math.PI, 0); c.fill();
      c.strokeStyle = '#4a3312'; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 14, Math.PI, 0); c.stroke();
    } else if (art === 'bronze') {
      c.fillStyle = '#c98a3a';
      c.beginPath(); c.arc(0, -1, 14, Math.PI, 0); c.fill();
      c.fillRect(-14, -2, 28, 5);
      c.strokeStyle = '#8a5a10'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, -1, 14, Math.PI, 0); c.stroke();
      c.fillStyle = '#8a2a22'; c.fillRect(-2, -14, 4, 12);
    } else if (art === 'visor') {
      const helm = '#d8b36a', trim = '#8a5a10';
      c.fillStyle = helm;
      c.beginPath(); c.arc(0, -1, 15, Math.PI, 0); c.fill();
      c.fillRect(-15, -2, 30, 6);
      c.fillRect(-15, 1, 5, 9); c.fillRect(10, 1, 5, 9);
      c.fillRect(-2, 1, 4, 8);
      c.strokeStyle = trim; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, -1, 15, Math.PI, 0); c.stroke();
      c.fillStyle = '#8a2a22'; c.fillRect(-3, -17, 6, 13);
      c.fillStyle = '#a03a30'; c.fillRect(-5, -17, 10, 4);
    }
    c.restore();
  }

  private drawChestArt(c: CanvasRenderingContext2D, x: number, y: number, art: string, s = 1, garment = '#a03028'): void {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (art === 'rags') {
      c.fillStyle = '#b8a888'; rrect(c, -14, 0, 28, 42, 6); c.fill();
      c.strokeStyle = '#8a7a5a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-14, 14); c.lineTo(14, 10); c.moveTo(-12, 26); c.lineTo(10, 30); c.stroke();
    } else if (art === 'studs') {
      c.fillStyle = '#7a5a30'; rrect(c, -14, 0, 28, 42, 6); c.fill();
      c.strokeStyle = '#54340f'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-14, 12); c.lineTo(14, 12); c.moveTo(-14, 24); c.lineTo(14, 24); c.stroke();
      c.fillStyle = '#c9a86a';
      c.beginPath(); c.arc(-8, 18, 2, 0, 7); c.arc(8, 18, 2, 0, 7); c.fill();
    } else if (art === 'cuirass') {
      c.fillStyle = '#9aa0a8'; rrect(c, -15, 0, 30, 42, 7); c.fill();
      c.strokeStyle = '#6a7078'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-15, 9 + i * 9); c.lineTo(15, 9 + i * 9); c.stroke(); }
      c.fillStyle = '#9aa0a8';
      for (let i = -1; i <= 1; i++) c.fillRect(i * 10 - 4, 32, 8, 10);
    } else if (art === 'plate') {
      c.fillStyle = '#d8b36a'; rrect(c, -15, 0, 30, 42, 7); c.fill();
      c.strokeStyle = '#8a5a10'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-15, 9 + i * 9); c.lineTo(15, 9 + i * 9); c.stroke(); }
      c.fillStyle = '#d8b36a';
      for (let i = -1; i <= 1; i++) c.fillRect(i * 10 - 4, 32, 8, 10);
      c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(0, 14, 4, 0, 7); c.fill();
    } else {
      // garment fallback (tinted tunic)
      c.fillStyle = garment; rrect(c, -14, 0, 28, 42, 6); c.fill();
      c.strokeStyle = shade(garment, 0.6); c.lineWidth = 2;
      c.beginPath(); c.moveTo(-14, 14); c.lineTo(14, 10); c.stroke();
    }
    c.restore();
  }

  private drawShieldArt(c: CanvasRenderingContext2D, x: number, y: number, art: string, s = 1): void {
    if (art === 'none') return;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (art === 'buckler') {
      c.fillStyle = '#8a5a28'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill();
      c.strokeStyle = '#5a3a18'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.stroke();
      c.fillStyle = '#c9a86a'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill();
    } else if (art === 'scutum') {
      c.fillStyle = '#8a2a22'; rrect(c, 2, -44, 26, 50, 7); c.fill();
      c.strokeStyle = '#c9a86a'; c.lineWidth = 3; rrect(c, 2, -44, 26, 50, 7); c.stroke();
      c.fillStyle = '#c9a86a'; c.beginPath(); c.arc(15, -19, 5, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,220,150,.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(15, -42); c.lineTo(15, 4); c.stroke();
    } else if (art === 'aegis') {
      c.fillStyle = '#5a5f68'; rrect(c, 0, -50, 30, 56, 8); c.fill();
      c.strokeStyle = '#d8b36a'; c.lineWidth = 3.5; rrect(c, 0, -50, 30, 56, 8); c.stroke();
      c.fillStyle = '#d8b36a';
      c.beginPath(); c.moveTo(15, -40); c.lineTo(20, -30); c.lineTo(15, -20); c.lineTo(10, -30); c.closePath(); c.fill();
      c.fillStyle = '#8a2a22'; c.fillRect(6, -16, 18, 14);
    }
    c.restore();
  }

  private drawBootsArt(c: CanvasRenderingContext2D, x1: number, x2: number, art: string): void {
    c.fillStyle = art === 'sabatons' ? '#9aa0a8' : art === 'boots' ? '#6a4a26' : '#b8a888';
    c.beginPath(); c.ellipse(x1 - 1, -2, 8, 4, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(x2 + 1, -2, 8, 4, 0, 0, 7); c.fill();
    if (art === 'sabatons') {
      c.fillStyle = '#6a7078';
      c.fillRect(x1 - 5, -8, 8, 6); c.fillRect(x2 - 3, -8, 8, 6);
    }
  }

  drawWeaponArt(c: CanvasRenderingContext2D, art: string, x: number, y: number, s: number, gold: boolean): void {
    const steel = gold ? '#e8c37a' : '#b8bec8', dark = gold ? '#a87f2c' : '#7a7f88';
    c.save(); c.translate(x, y); c.scale(s, s); c.lineCap = 'round';
    if (art === 'club') {
      c.strokeStyle = '#6a4a20'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(13, -24); c.stroke();
      c.fillStyle = '#7a5a30'; c.beginPath(); c.arc(16, -32, 9, 0, 7); c.fill();
      c.fillStyle = '#54340f'; c.beginPath(); c.arc(14, -34, 3, 0, 7); c.fill();
    } else if (art === 'boulder') {
      c.strokeStyle = '#6a4a20'; c.lineWidth = 9;
      c.beginPath(); c.moveTo(0, 2); c.lineTo(15, -30); c.stroke();
      c.fillStyle = '#8a8478'; c.beginPath(); c.arc(19, -40, 13, 0, 7); c.fill();
      c.strokeStyle = '#5a544a'; c.lineWidth = 2; c.beginPath(); c.arc(19, -40, 13, 0, 7); c.stroke();
    } else if (art === 'trident') {
      c.strokeStyle = '#5a3a18'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(0, 2); c.lineTo(15, -34); c.stroke();
      c.strokeStyle = steel; c.lineWidth = 3;
      for (const dx of [-7, 0, 7]) {
        c.beginPath(); c.moveTo(15 + dx, -34); c.lineTo(15 + dx * 1.15, -50); c.stroke();
      }
      c.strokeStyle = steel; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(8, -38); c.lineTo(22, -38); c.stroke();
    } else if (art === 'mace') {
      c.strokeStyle = '#5a3a18'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(0, 2); c.lineTo(14, -30); c.stroke();
      c.fillStyle = steel;
      c.beginPath(); c.arc(17, -36, 8, 0, 7); c.fill();
      for (let i = 0; i < 6; i++) {
        const an = i / 6 * Math.PI * 2;
        c.beginPath(); c.moveTo(17 + Math.cos(an) * 7, -36 + Math.sin(an) * 7);
        c.lineTo(17 + Math.cos(an) * 12, -36 + Math.sin(an) * 12);
        c.lineWidth = 3.5; c.strokeStyle = steel; c.stroke();
      }
    } else if (art === 'sabre') {
      c.strokeStyle = steel; c.lineWidth = 4.5;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(12, -18, 22, -36); c.stroke();
      c.strokeStyle = dark; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(2, -4); c.quadraticCurveTo(13, -20, 23, -38); c.stroke();
      c.strokeStyle = '#5a3a18'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-3, 4); c.lineTo(4, -4); c.stroke();
      c.fillStyle = '#c9a86a'; c.beginPath(); c.arc(-1, 3, 3, 0, 7); c.fill();
    } else if (art === 'cleaver') {
      c.strokeStyle = '#5a3a18'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(0, 2); c.lineTo(17, -38); c.stroke();
      c.fillStyle = steel;
      c.beginPath(); c.moveTo(17, -38); c.quadraticCurveTo(40, -44, 36, -22); c.quadraticCurveTo(25, -27, 13, -24); c.closePath(); c.fill();
      c.strokeStyle = dark; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(17, -38, 3, 0, 7); c.fill();
    } else if (art === 'colossuscleaver') {
      c.strokeStyle = '#5a3a18'; c.lineWidth = 8;
      c.beginPath(); c.moveTo(0, 4); c.lineTo(19, -44); c.stroke();
      c.fillStyle = '#e8c37a';
      c.beginPath(); c.moveTo(19, -44); c.quadraticCurveTo(52, -54, 46, -20); c.quadraticCurveTo(30, -28, 14, -24); c.closePath(); c.fill();
      c.strokeStyle = '#a87f2c'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(19, -44, 4, 0, 7); c.fill();
      c.fillStyle = '#8a2a22'; c.fillRect(9, -30, 30, 5);
    } else if (art === 'brand') {
      c.strokeStyle = '#5a3a18'; c.lineWidth = 5.5;
      c.beginPath(); c.moveTo(0, 2); c.lineTo(16, -34); c.stroke();
      c.strokeStyle = '#e8c37a'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(16, -34); c.lineTo(30, -58); c.stroke();
      c.strokeStyle = '#ff9a2a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(18, -38); c.lineTo(31, -60); c.stroke();
      c.strokeStyle = '#5a3a18'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-3, 4); c.lineTo(5, -5); c.stroke();
    } else if (art === 'sling') {
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(10, -8); c.stroke();
      c.strokeStyle = '#c9b088'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(10, -8); c.lineTo(14, -26); c.stroke();
      c.fillStyle = '#8a8478'; c.beginPath(); c.arc(14, -28, 4, 0, 7); c.fill();
    } else if (art === 'bow') {
      c.strokeStyle = '#8a5a28'; c.lineWidth = 4;
      c.beginPath(); c.arc(6, -14, 22, -Math.PI * 0.42, Math.PI * 0.42); c.stroke();
      c.strokeStyle = '#e8dcc0'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(6 + Math.cos(-1.32) * 22, -14 + Math.sin(-1.32) * 22);
      c.lineTo(6 + Math.cos(1.32) * 22, -14 + Math.sin(1.32) * 22); c.stroke();
    } else { // gladius / spatha
      const len = art === 'spatha' ? 40 : 32;
      c.strokeStyle = steel; c.lineWidth = 5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(17, -len); c.stroke();
      c.strokeStyle = dark; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(2, -4); c.lineTo(19, -len - 4); c.stroke();
      c.strokeStyle = '#5a3a18'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-3, 4); c.lineTo(4, -4); c.stroke();
      c.fillStyle = '#c9a86a'; c.beginPath(); c.arc(-1, 3, 3, 0, 7); c.fill();
    }
    c.restore();
  }
}

/** build render gear for the player from equipped ids */
export function gearFromEquipped(eq: { weapon: string; helm: string; chest: string; shield: string; boots: string }, scale = 1): FighterGear {
  const artOf = (id: string, dflt: string) => {
    if (!id) return dflt;
    return { w0: 'gladius', w1: 'gladius', w2: 'spatha', w3: 'cleaver', w4: 'brand', w5: 'colossuscleaver',
      h0: 'none', h1: 'cap', h2: 'bronze', h3: 'visor',
      c0: 'rags', c1: 'studs', c2: 'cuirass', c3: 'plate',
      s0: 'none', s1: 'buckler', s2: 'scutum', s3: 'aegis',
      b0: 'sandals', b1: 'boots', b2: 'sabatons' }[id] ?? dflt;
  };
  return {
    helm: artOf(eq.helm, 'none'), chest: artOf(eq.chest, 'rags'),
    shield: artOf(eq.shield, 'none'), boots: artOf(eq.boots, 'sandals'),
    weapon: artOf(eq.weapon, 'gladius'), scale,
  };
}

export function gearFromBout(def: { weaponArt: string; armorTier: number; scale: number }): FighterGear {
  const chests = ['rags', 'studs', 'cuirass', 'plate'];
  const helms = ['none', 'cap', 'bronze', 'visor'];
  return {
    helm: helms[Math.min(3, def.armorTier)], chest: chests[Math.min(3, def.armorTier)],
    shield: def.armorTier >= 2 ? 'scutum' : def.armorTier >= 1 ? 'buckler' : 'none',
    boots: def.armorTier >= 2 ? 'boots' : 'sandals',
    weapon: def.weaponArt, scale: def.scale,
  };
}

export type { Fighter, Bout };
