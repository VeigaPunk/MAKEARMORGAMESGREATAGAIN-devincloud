import { Input, Sfx, stepsFromBpm, fitIntegerScale, letterboxOffset, viewport, load, save, type Wave } from '@maga/arcade-core';
import {
  Sim, PANES, QUARTERS, FEEDS, TUNE,
  trafficNow, serveCap, slaughterCap, totalBacklash, reputation, targetNow,
  herdSize, isSick, ownedPlots,
  type PaneKey,
} from './sim';
import { drawIcon, drawWordmark } from './icons';

/**
 * BURGER TYCOON — four-pane supply-chain satire (Canvas2D + DOM chrome).
 * Systems twin of Molleindustria's McDonald's Videogame: the quarter clock,
 * the board, and the dirty levers live in ./sim (tuned by tools/sim.mjs).
 * This file owns presentation, input, audio and persistence only.
 */

const W = 960;
const H = 420;
const QUARTER_SECONDS = 90; // 1x — a full run is ~24 min, 2x/4x for veterans

// ---- DOM chrome ----
const wrap = document.getElementById('wrap')!;
const hudEl = document.getElementById('hud')!;
const tabsEl = document.getElementById('tabs')!;
const logEl = document.getElementById('log')!;
const muteBtn = document.getElementById('mute');

const cv = document.createElement('canvas');
cv.width = W;
cv.height = H;
wrap.insertBefore(cv, logEl);
const ctx = cv.getContext('2d')!;

// ---- arcade-core services ----
let cachedScale = 1;
const toLogical = (cx: number, cy: number) => ({ x: cx / cachedScale, y: cy / cachedScale });
const input = new Input();
input.attach(cv, toLogical);
const sfx = new Sfx();
// pane hotkeys 1–4 (Digit1-3 are slot1-3 in defaults; bind Digit4 to 'action')
input.setKeymaps({ p1: { Digit4: 'action' } });

// ---- presets & music (MAESTRO: zero assets, all authored) -----------------
Sfx.registerPreset('cash', (s) => {
  s.blip({ wave: 'triangle', freq: 880, freqEnd: 1760, duration: 0.07, volume: 0.8 });
  s.blip({ wave: 'square', freq: 1320, freqEnd: 2350, duration: 0.1, volume: 0.5 });
});
Sfx.registerPreset('scandal', (s) => {
  s.burst({ duration: 0.28, volume: 0.55, hp: 500 });
  s.blip({ wave: 'sawtooth', freq: 700, freqEnd: 170, duration: 0.4, volume: 0.8 });
});
Sfx.registerPreset('buy', (s) => {
  s.blip({ wave: 'square', freq: 340, freqEnd: 480, duration: 0.06, volume: 0.55 });
  s.blip({ wave: 'square', freq: 480, freqEnd: 640, duration: 0.06, volume: 0.45 });
});

/** staggered note sequence for stings (blip has no delay param) */
function jingle(notes: [number, number][], stepMs: number, wave: Wave = 'sawtooth'): void {
  notes.forEach(([freq, dur], i) => {
    window.setTimeout(() => sfx.blip({ wave, freq, freqEnd: freq * 0.92, duration: dur, volume: 0.7 }), i * stepMs);
  });
}
const stingFail = () => jingle([[233, 0.22], [196, 0.22], [165, 0.24], [110, 0.7]], 260);
const stingRestart = () => jingle([[262, 0.09], [330, 0.09], [392, 0.09], [523, 0.16]], 110, 'square');

const STEP_MS = stepsFromBpm(112);
// cheery muzak: C-F-G loop, bass + lead + drums (32 steps = 4 half-bars)
const SONG_MAJOR = {
  stepMs: STEP_MS,
  tracks: [
    {
      wave: 'square' as const, gain: 0.13, lp: 480,
      notes: [65, 0, 98, 0, 65, 0, 98, 0, 87, 0, 131, 0, 87, 0, 131, 0, 98, 0, 147, 0, 98, 0, 147, 0, 131, 0, 98, 0, 110, 0, 98, 0],
    },
    {
      wave: 'triangle' as const, gain: 0.16,
      notes: [330, 0, 392, 523, 0, 523, 0, 392, 440, 0, 523, 698, 0, 698, 0, 523, 494, 0, 587, 784, 0, 784, 0, 587, 659, 0, 587, 523, 0, 392, 330, 0],
    },
  ],
  drums: { steps: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.hh', gain: 0.4 },
};
// the same bed sours to minor as backlash stacks
const SONG_MINOR = {
  stepMs: STEP_MS,
  tracks: [
    {
      wave: 'square' as const, gain: 0.13, lp: 420,
      notes: [110, 0, 165, 0, 110, 0, 165, 0, 87, 0, 131, 0, 87, 0, 131, 0, 82, 0, 124, 0, 82, 0, 124, 0, 110, 0, 165, 0, 104, 0, 156, 0],
    },
    {
      wave: 'triangle' as const, gain: 0.15,
      notes: [440, 0, 523, 659, 0, 659, 0, 523, 349, 0, 440, 523, 0, 523, 0, 440, 415, 0, 494, 659, 0, 659, 0, 494, 523, 0, 494, 440, 0, 415, 392, 0],
    },
  ],
  drums: { steps: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.hh', gain: 0.36 },
};

// ---- persistence -----------------------------------------------------------
const GAME = 'burger-tycoon';
interface RunSave { v: number; s: unknown; events: string[] }
let muted = load(GAME, 'muted', false);
let volume = load(GAME, 'volume', 0.5);
sfx.setMuted(muted);
sfx.volume = volume;

// ---- game state ------------------------------------------------------------
const sim = new Sim();
let pane = 0;
let paused = false;
let speed = 1;
let musicVariant = 0;         // 0 major, 1 minor
let musicSwitchPending = false;
let musicStartedAt = 0;
let musicStarted = false;
let bootChoice: '' | 'resume' | 'new' = '';
let prevBacklashTotal = 0;
let prevOver = '';
let renderedEvents = '';
let bestQuarter = load(GAME, 'best-quarter', 0);
let sustainedCount = load(GAME, 'sustained-count', 0);

interface Hit { x: number; y: number; w: number; h: number; fn: () => void }
let hits: Hit[] = [];

const savedRun = load<RunSave | null>(GAME, 'run', null);
const hasSave = !!(savedRun && (savedRun as RunSave).s && !((savedRun as RunSave).s as { over?: string }).over);
if (hasSave) bootChoice = ''; else { bootChoice = 'new'; sim.reset(); }

function newRun(): void {
  sim.reset();
  pane = 0;
  prevBacklashTotal = 0;
  prevOver = '';
  stingRestart();
}


// ---- tabs / hud buttons ----------------------------------------------------
PANES.forEach((p, i) => {
  const b = document.createElement('button');
  b.textContent = `${i + 1} ${p.title}`;
  b.addEventListener('click', () => { pane = i; sfx.preset('ui'); });
  tabsEl.appendChild(b);
});

const speedBtns: HTMLButtonElement[] = [];
[1, 2, 4].forEach((sp) => {
  const b = document.createElement('button');
  b.textContent = `${sp}\u00d7`;
  b.addEventListener('click', () => { speed = sp; sfx.preset('ui'); });
  hudEl.appendChild(b);
  speedBtns.push(b);
});
const pauseBtn = document.createElement('button');
pauseBtn.textContent = 'PAUSE';
pauseBtn.addEventListener('click', () => { togglePause(); });
hudEl.appendChild(pauseBtn);

if (muteBtn) {
  const paint = () => { muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; };
  muteBtn.addEventListener('click', () => {
    sfx.setMuted(!sfx.muted);
    muted = sfx.muted;
    save(GAME, 'muted', muted);
    paint();
  });
  paint();
}

function togglePause(): void {
  if (bootChoice === '' || sim.s.over) return;
  paused = !paused;
  sfx.preset('ui');
}

function setPane(i: number): void {
  pane = Math.max(0, Math.min(PANES.length - 1, i));
}

// ---- music control ---------------------------------------------------------
function startMusic(): void {
  if (musicStarted) return;
  musicStarted = true;
  sfx.playSong(musicVariant === 0 ? SONG_MAJOR : SONG_MINOR);
  musicStartedAt = performance.now();
}

/** crossfade = same-step songs swapped exactly on the 32-step loop boundary */
function switchMusic(variant: number): void {
  if (!musicStarted || variant === musicVariant || musicSwitchPending) return;
  musicSwitchPending = true;
  const loopMs = 32 * STEP_MS;
  const elapsed = performance.now() - musicStartedAt;
  const delay = Math.max(30, loopMs - (elapsed % loopMs));
  window.setTimeout(() => {
    sfx.playSong(variant === 0 ? SONG_MAJOR : SONG_MINOR);
    musicStartedAt = performance.now();
    musicVariant = variant;
    musicSwitchPending = false;
  }, delay);
}

// ---- layout ----------------------------------------------------------------
function layout(): void {
  const vp = viewport();
  const chromeH = hudEl.offsetHeight + tabsEl.offsetHeight + logEl.offsetHeight;
  const avail = { width: vp.width, height: vp.height - chromeH };
  const s = fitIntegerScale(W, H, avail, 4);
  const off = letterboxOffset(W, H, s, avail);
  cachedScale = s;
  wrap.style.width = `${W * s}px`;
  wrap.style.left = `${off.x}px`;
  wrap.style.top = `${off.y}px`;
  cv.style.width = `${W * s}px`;
  cv.style.height = `${H * s}px`;
}
window.addEventListener('resize', layout);

// ---- input -----------------------------------------------------------------
function pollInput(): void {
  const p = input.pointer;
  if (input.wasPressed('slot1')) setPane(0);
  else if (input.wasPressed('slot2')) setPane(1);
  else if (input.wasPressed('slot3')) setPane(2);
  else if (input.wasPressed('action')) setPane(3);

  if (p.tapped) {
    startMusic();
    if (bootChoice === '') {
      // boot prompt: its big buttons live in the same hits registry —
      // RESUME/NEW must be clickable (was dead UI: taps skipped the loop)
      for (const h of hits) {
        if (p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) { h.fn(); break; }
      }
    } else if (sim.s.over) {
      newRun();
    } else {
      for (const h of hits) {
        if (p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) { h.fn(); break; }
      }
    }
  }

  if (bootChoice !== '' && !sim.s.over) {
    if (input.wasPressed('pause')) togglePause();
    if (input.wasPressed('fire')) { speed = speed === 4 ? 1 : speed * 2; sfx.preset('ui'); }
  }
  if (sim.s.over && (input.wasPressed('fire') || input.wasPressed('action') || input.wasPressed('pause'))) newRun();
}

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
  if (e.code === 'KeyM') {
    sfx.setMuted(!sfx.muted);
    muted = sfx.muted;
    save(GAME, 'muted', muted);
  } else if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
    volume = Math.max(0, Math.min(1, volume + (e.code === 'BracketRight' ? 0.1 : -0.1)));
    sfx.volume = volume;
    save(GAME, 'volume', volume);
  }
});

// ---- drawing helpers -------------------------------------------------------
const FONT = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px monospace`;

function bar(x: number, y: number, w: number, h: number, frac: number, col: string): void {
  ctx.fillStyle = '#00000022';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function label(x: number, y: number, text: string, col = '#222', px = 10, bold = false): void {
  ctx.fillStyle = col;
  ctx.font = FONT(px, bold);
  ctx.fillText(text, x, y);
}

function actionButtons(key: PaneKey, x: number, y: number, w: number, h: number, cols: number): number {
  const s = sim.s;
  const actions = sim.actions[key];
  const rows = Math.ceil(actions.length / cols);
  const gap = 4;
  const bw = (w - (cols - 1) * gap) / cols;
  const bh = Math.min(20, (h - (rows - 1) * gap) / rows);
  actions.forEach((a, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = x + col * (bw + gap);
    const by = y + row * (bh + gap);
    const txt = a.label(s);
    const hint = s.over ? 'game over' : a.hint(s);
    const broke = a.cost > 0 && s.cash < a.cost;
    const dead = hint !== null || broke;
    ctx.fillStyle = dead ? '#9a8f7d' : (a.cost > 0 ? '#4a6fa5' : '#5c7a4a');
    ctx.fillRect(bx, by, bw, bh);
    ctx.save();
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    ctx.fillStyle = dead ? '#00000055' : '#fff';
    ctx.font = FONT(8.5);
    ctx.fillText(txt, bx + 4, by + bh - 6);
    if (dead && hint) {
      ctx.fillStyle = '#ffe066';
      ctx.fillText(`\u00d7 ${hint}`, bx + 4, by + bh + 6 > by + bh ? by + 8 : by + 8);
    }
    ctx.restore();
    if (!dead) {
      hits.push({
        x: bx, y: by, w: bw, h: bh,
        fn: () => {
          const r = sim.act(key, i);
          sfx.preset(r !== null ? (a.cost > 0 ? 'buy' : 'ui') : 'hit');
        },
      });
    }
  });
  return rows * bh + (rows - 1) * gap;
}

// ---- pane scenes -----------------------------------------------------------
function sceneFarm(x: number, y: number, w: number, h: number): void {
  const s = sim.s;
  const grid = 3;
  const size = Math.min(40, Math.floor(Math.min((w - 8) / grid, (h - 16) / grid)) - 3);
  const ox = x + 4;
  const oy = y + 4;
  s.plots.forEach((p, i) => {
    const px = ox + (i % grid) * (size + 3);
    const py = oy + Math.floor(i / grid) * (size + 3);
    if (p.kind === 'jungle') {
      ctx.fillStyle = '#1f5c33'; ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#2f8f4a';
      for (let t = 0; t < 4; t++) ctx.fillRect(px + 3 + (t % 2) * (size / 2), py + 3 + Math.floor(t / 2) * (size / 2), size / 4, size / 4);
    } else if (p.kind === 'sale') {
      ctx.fillStyle = '#c9b993'; ctx.fillRect(px, py, size, size);
      label(px + size / 2 - 5, py + size / 2 + 5, '$', '#6b543a', 14, true);
    } else if (p.kind === 'empty') {
      ctx.fillStyle = '#8a6a45'; ctx.fillRect(px, py, size, size);
      ctx.fillStyle = '#75593a';
      ctx.fillRect(px + 2, py + size - 8, size - 4, 2);
      ctx.fillRect(px + 2, py + size - 4, size - 4, 2);
    } else if (p.kind === 'pasture') {
      ctx.fillStyle = '#7fb069'; ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = '#5c8a4a'; ctx.lineWidth = 1;
      for (let f = 1; f < 3; f++) {
        ctx.beginPath();
        ctx.moveTo(px, py + f * size / 3); ctx.lineTo(px + size, py + f * size / 3);
        ctx.stroke();
      }
      for (let c = 0; c < Math.min(6, Math.round(p.cattle)); c++) {
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(px + 4 + (c % 3) * (size / 3), py + 4 + Math.floor(c / 3) * (size / 2), 6, 4);
      }
    } else {
      // crop plot: growth fill + colored rows
      const soy = p.kind === 'soy';
      ctx.fillStyle = soy ? '#5f7a3a' : '#a08428';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = soy ? '#8cb86a' : '#d8b64a';
      ctx.fillRect(px + 2, py + 2 + (size - 6) * (1 - p.growth), size - 4, (size - 6) * p.growth);
      ctx.fillStyle = '#00000033';
      for (let r = 0; r < 3; r++) ctx.fillRect(px + 2, py + 4 + r * (size / 3), size - 4, 2);
    }
    ctx.strokeStyle = '#3a2d1e'; ctx.lineWidth = 1;
    ctx.strokeRect(px, py, size, size);
  });
  // side stats
  const sx = ox + grid * (size + 3) + 8;
  label(sx, oy + 12, `FEED STORE ${Math.round(s.crops)}`, '#333', 10, true);
  bar(sx, oy + 16, w - (sx - x) - 4, 7, s.crops / 150, '#2b8a3e');
  const pastureHead = s.plots.reduce((n, p) => n + (p.kind === 'pasture' ? p.cattle : 0), 0);
  label(sx, oy + 36, `PASTURE ${Math.round(pastureHead)} head`, '#333', 10, true);
  label(sx, oy + 50, `FIELDS ${ownedPlots(s)}/9 owned`, '#333', 10);
  label(sx, oy + 64, s.hormones ? 'HORMONES ON (risk!)' : 'hormones off', s.hormones ? '#c2255c' : '#555', 10, s.hormones);
}

function sceneFeed(x: number, y: number, w: number, h: number): void {
  const s = sim.s;
  // feed dial (3 lights)
  label(x + 4, y + 12, 'FEED DIAL', '#333', 10, true);
  FEEDS.forEach((f, i) => {
    const on = s.feedIdx === i;
    ctx.fillStyle = i === 2 ? (on ? '#c2255c' : '#00000022') : i === 1 ? (on ? '#b8860b' : '#00000022') : (on ? '#2b8a3e' : '#00000022');
    ctx.fillRect(x + 4 + i * 62, y + 16, 58, 13);
    ctx.fillStyle = on ? '#fff' : '#666';
    ctx.font = FONT(8.5);
    ctx.fillText(`${f.name} $${f.cost}/hd`, x + 8 + i * 62, y + 26);
  });
  // pens with cattle dots
  const penY = y + 36;
  const penH = h - 36 - 26;
  ctx.fillStyle = '#d9c9a8';
  ctx.fillRect(x + 4, penY, w - 8, penH);
  ctx.strokeStyle = '#8a6a45'; ctx.lineWidth = 2;
  ctx.strokeRect(x + 4, penY, w - 8, penH);
  const herd = herdSize(s);
  const cols = 12;
  for (let i = 0; i < Math.min(36, Math.ceil(herd)); i++) {
    const cx = x + 12 + (i % cols) * ((w - 24) / cols);
    const cy = penY + 10 + Math.floor(i / cols) * 18;
    const ready = i >= Math.ceil(herd - s.readyCattle);
    ctx.fillStyle = ready ? '#7c2418' : isSick(s) && i % 4 === 0 ? '#d9480b' : '#8a5a2b';
    ctx.fillRect(cx, cy, 10, 7);
    ctx.fillRect(cx + 2, cy - 3, 3, 3); // head
    ctx.fillRect(cx + 1, cy + 7, 2, 2); // legs
    ctx.fillRect(cx + 7, cy + 7, 2, 2);
  }
  label(x + 10, penY + penH - 6, `PENS ${Math.round(herd)}/${s.penCap} · slaughter cap ${slaughterCap(s).toFixed(1)}/Q${herd > s.penCap ? ' · OVERCROWDED' : ''}`, '#5b4a33', 9);
  if (isSick(s)) label(x + w - 84, penY + 12, '\u2623 SICK HERD', '#c2255c', 11, true);
  // disease + lagoon
  const ly = y + h - 20;
  label(x + 4, ly + 8, `DISEASE ${Math.round(s.disease)}`, '#333', 9, true);
  bar(x + 76, ly + 1, 80, 8, s.disease / 100, s.disease > 60 ? '#c2255c' : '#e8590c');
  label(x + 168, ly + 8, `LAGOON ${Math.round(s.waste)}`, '#333', 9, true);
  bar(x + 232, ly + 1, w - 236, 8, s.waste / 100, s.waste > 70 ? '#a61e4d' : '#b08968');
  label(x + 4, y + 28, `PATTY STOCK ${Math.round(s.patties)}`, '#333', 9);
}

function sceneRest(x: number, y: number, w: number, h: number): void {
  const s = sim.s;
  // counter + registers (cashiers) on top, kitchen (cooks) behind
  ctx.fillStyle = '#b03a2e';
  ctx.fillRect(x + 4, y + 4, w - 8, 14);
  for (let i = 0; i < s.cashiers; i++) {
    ctx.fillStyle = '#f4eddf';
    ctx.fillRect(x + 12 + i * 26, y + 7, 8, 8);
    ctx.fillStyle = '#4a6fa5';
    ctx.fillRect(x + 13 + i * 26, y + 8, 6, 4);
  }
  label(x + w - 120, y + 14, `CASHIERS ${s.cashiers}  COOKS ${s.cooks}`, '#fff', 9, true);
  // kitchen row
  ctx.fillStyle = '#495057';
  ctx.fillRect(x + 4, y + 20, w - 8, 10);
  for (let i = 0; i < s.cooks; i++) {
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(x + 12 + i * 20, y + 22, 7, 6);
  }
  // queue: waiting customers (animated by queue pressure)
  const qn = Math.round(s.queueFrac * 14);
  for (let i = 0; i < qn; i++) {
    const qx = x + 16 + (i % 7) * 24;
    const qy = y + 46 + Math.floor(i / 7) * 16 + Math.sin(performance.now() / 400 + i) * 1.5;
    ctx.fillStyle = ['#4a6fa5', '#c2255c', '#2b8a3e', '#a61e4d'][i % 4];
    ctx.fillRect(qx, qy, 8, 9);
    ctx.fillStyle = '#e8d5b5';
    ctx.fillRect(qx + 1, qy - 4, 6, 5);
  }
  if (s.strikeQ > 0) label(x + w / 2 - 60, y + 44, '\u26d4 STRIKE — CLOSED', '#c2255c', 13, true);
  else if (s.closedQ > 0) label(x + w / 2 - 90, y + 44, '\u26d4 SHUT BY INSPECTORS', '#c2255c', 13, true);
  // price tag + marketing badges
  ctx.fillStyle = '#ffd43b';
  ctx.fillRect(x + w - 86, y + 40, 80, 26);
  ctx.strokeStyle = '#3a2d1e';
  ctx.strokeRect(x + w - 86, y + 40, 80, 26);
  label(x + w - 78, y + 58, `$${s.price.toFixed(2)}`, '#222', 16, true);
  label(x + w - 44, y + 53, '/burger', '#5b4a33', 8);
  const badges: string[] = [];
  if (s.mkt.tv > 0) badges.push(`TV ${s.mkt.tv}Q`);
  if (s.mkt.toy > 0) badges.push(`TOYS ${s.mkt.toy}Q`);
  if (s.mkt.jingle > 0) badges.push(`JINGLE ${s.mkt.jingle}Q`);
  if (s.mkt.mascot) badges.push('SPEEDY');
  badges.forEach((btxt, i) => {
    ctx.fillStyle = '#4a6fa5';
    ctx.fillRect(x + 6 + i * 64, y + h - 26, 60, 12);
    label(x + 10 + i * 64, y + h - 17, btxt, '#fff', 8.5);
  });
  if (s.mkt.mascot) drawIcon(ctx, 'beaver', x + w - 118, y + 40, 26);
  label(x + 6, y + h - 34, `TRAFFIC ${Math.round(trafficNow(s))}/Q · SERVED ${Math.round(s.lastServed)}/Q`, '#333', 9, true);
  label(x + 6, y + 38, s.outbreakQ > 0 ? '\u2620 POISONING OUTBREAK — sales crash' : s.stormQ > 0 ? '\u26a1 MEDIA STORM' : '', '#c2255c', 10, true);
}

function sceneHQ(x: number, y: number, w: number, h: number): void {
  const s = sim.s;
  // profit vs target
  label(x + 4, y + 12, `QUARTERLY PROFIT $${Math.round(s.lastProfit)} / TARGET $${targetNow(s)}`, '#333', 10, true);
  const pf = s.lastProfit / Math.max(targetNow(s), 1);
  bar(x + 4, y + 16, w - 8, 9, pf, pf >= 1 ? '#2b8a3e' : pf > 0.6 ? '#e8590c' : '#c2255c');
  // board patience
  label(x + 4, y + 38, `BOARD PATIENCE ${Math.round(s.patience)}`, s.patience < 30 ? '#c2255c' : '#333', 10, true);
  bar(x + 4, y + 42, w - 8, 9, s.patience / 100, s.patience < 30 ? '#c2255c' : '#4a6fa5');
  // backlash columns
  const cols: [string, number, string][] = [
    ['ACT', s.backlash.act, '#e8590c'],
    ['MED', s.backlash.med, '#c2255c'],
    ['CLI', s.backlash.cli, '#2b8a3e'],
    ['UNI', s.backlash.uni, '#a61e4d'],
  ];
  const bw = (w - 40) / 4;
  cols.forEach(([name, v, col], i) => {
    const bx = x + 8 + i * (bw + 8);
    const ch = h - 78;
    ctx.fillStyle = '#00000018';
    ctx.fillRect(bx, y + 58, bw - 8, ch);
    ctx.fillStyle = col;
    ctx.fillRect(bx, y + 58 + ch * (1 - v / 100), bw - 8, ch * (v / 100));
    label(bx, y + h - 14, `${name} ${Math.round(v)}`, col, 9, true);
  });
  // active lever chips
  const chips: string[] = [];
  if (s.bribeN > 0) chips.push(`NUTRITIONIST ${s.bribeN}Q`);
  if (s.bribeC > 0) chips.push(`CLIMATOLOGIST ${s.bribeC}Q`);
  if (s.bust > 0) chips.push(`UNION-BUST ${s.bust}Q`);
  if (s.lobby > 0) chips.push(`LOBBY ${s.lobby}Q`);
  label(x + 4, y + h - 26, chips.length ? chips.join(' \u00b7 ') : 'no active levers', '#5b4a33', 8.5);
  label(x + 4, y + h - 40, `BOYCOTT \u00d7${(1 - Math.min(0.8, totalBacklash(s) / 520)).toFixed(2)} traffic \u00b7 REP ${Math.round(reputation(s))}`, '#333', 8.5);
}

// ---- pane frame ------------------------------------------------------------
function drawPane(key: PaneKey, index: number, x: number, y: number, w: number, h: number, grid: boolean): void {
  const active = index === pane;
  ctx.fillStyle = active || !grid ? '#f4eddf' : '#e6dcc4';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = active && grid ? '#4a6fa5' : '#9a8f7d';
  ctx.lineWidth = active && grid ? 3 : 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // header
  ctx.fillStyle = '#3a2d1e';
  ctx.fillRect(x + 2, y + 2, w - 4, 18);
  label(x + 8, y + 15, `${index + 1} ${PANES[index].title}`, '#f4eddf', 11, true);
  const iconSize = grid ? 16 : 20;
  drawIcon(ctx, key, x + w - iconSize - 6, y + 3, iconSize);

  const headerH = 24;
  const actionsH = grid ? 50 : 74;
  const sceneY = y + headerH;
  const sceneH = h - headerH - actionsH - 4;

  // scene + actions
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 2, sceneY, w - 4, sceneH); ctx.clip();
  if (key === 'farm') sceneFarm(x + 2, sceneY, w - 4, sceneH);
  else if (key === 'feed') sceneFeed(x + 2, sceneY, w - 4, sceneH);
  else if (key === 'rest') sceneRest(x + 2, sceneY, w - 4, sceneH);
  else sceneHQ(x + 2, sceneY, w - 4, sceneH);
  ctx.restore();

  actionButtons(key, x + 4, y + h - actionsH + 2, w - 8, actionsH - 4, grid ? 4 : 5);
}

// ---- overlays --------------------------------------------------------------
function dim(): void {
  ctx.fillStyle = 'rgba(20,16,10,0.78)';
  ctx.fillRect(0, 0, W, H);
}

function centered(y: number, text: string, px: number, col = '#fff', bold = true): void {
  ctx.fillStyle = col;
  ctx.font = FONT(px, bold);
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, y);
  ctx.textAlign = 'left';
}

function bigButton(cx: number, cy: number, w: number, h: number, text: string, fn: () => void): void {
  ctx.fillStyle = '#4a6fa5';
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = '#f4eddf';
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = FONT(13, true);
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, cy + 5);
  ctx.textAlign = 'left';
  hits.push({ x: cx - w / 2, y: cy - h / 2, w, h, fn });
}

function drawBootPrompt(): void {
  dim();
  centered(120, 'BURGER TYCOON', 34, '#ffd43b');
  centered(146, 'four panes \u00b7 one conscience \u00b7 sixteen quarters', 12, '#ccc', false);
  const q = (savedRun as RunSave).s as { quarter?: number };
  centered(196, `SAVED RUN FOUND — QUARTER ${q?.quarter ?? '?'}`, 14, '#8ce99a');
  bigButton(W / 2 - 110, 250, 180, 34, 'RESUME RUN', () => {
    sim.restore((savedRun as RunSave).s as never, (savedRun as RunSave).events);
    bootChoice = 'resume';
    sfx.preset('ui');
  });
  bigButton(W / 2 + 110, 250, 180, 34, 'NEW GAME', () => {
    bootChoice = 'new';
    newRun();
  });
}

function drawPause(): void {
  dim();
  centered(150, 'PAUSED', 30, '#ffd43b');
  centered(176, `Q${sim.s.quarter}/${QUARTERS} \u00b7 speed ${speed}\u00d7 \u00b7 ESC resumes`, 12, '#ccc', false);
  bigButton(W / 2 - 120, 226, 170, 32, 'RESUME (ESC)', () => togglePause());
  bigButton(W / 2 + 120, 226, 170, 32, 'RESTART RUN', () => { paused = false; newRun(); });
  centered(280, 'keys: 1-4 panes \u00b7 F speed \u00b7 M mute \u00b7 [ ] volume', 11, '#999', false);
}

function drawOver(): void {
  const s = sim.s;
  dim();
  const good = s.over === 'sustained';
  centered(96, good ? 'SUSTAINED' : 'GAME OVER', 34, good ? '#8ce99a' : '#ff8787');
  centered(124, s.overReason, 13, '#ffd43b');
  let yy = 156;
  ctx.font = FONT(11.5);
  ctx.fillStyle = '#ddd';
  ctx.textAlign = 'center';
  for (const line of s.overDetail) { ctx.fillText(line, W / 2, yy); yy += 18; }
  ctx.textAlign = 'left';
  centered(yy + 6, `quarters survived ${Math.min(s.quarter, QUARTERS)}/${QUARTERS} \u00b7 best run Q${bestQuarter} \u00b7 sustained endings ${sustainedCount}`, 11, '#999', false);
  centered(yy + 30, 'CLICK / TAP / SPACE — RUN IT AGAIN', 13, '#fff');
  if (good) drawIcon(ctx, 'beaver', W / 2 - 16, yy + 44, 32);
}

// ---- main draw -------------------------------------------------------------
function draw(): void {
  const s = sim.s;
  [...tabsEl.children].forEach((b, i) => (b as HTMLElement).className = i === pane ? 'on' : '');

  const cashCol = s.cash < 200 ? '#ff8787' : '#ffd43b';
  setHud(0, `CASH $${Math.round(s.cash)}`, cashCol);
  setHud(1, `Q ${Math.min(s.quarter, QUARTERS)}/${QUARTERS} ${(s.qProg * 100).toFixed(0)}%`);
  setHud(2, `PROFIT $${Math.round(s.lastProfit)}/$${targetNow(s)}`, s.lastProfit >= targetNow(s) ? '#8ce99a' : '#ff8787');
  setHud(3, `PATIENCE ${Math.round(s.patience)}`, s.patience < 30 ? '#ff8787' : '#eee');
  setHud(4, `BACKLASH ${Math.round(totalBacklash(s))}`, totalBacklash(s) > 180 ? '#ff8787' : '#eee');
  speedBtns.forEach((b, i) => { b.className = speed === [1, 2, 4][i] ? 'on' : ''; });
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';

  const newestEvent = sim.events[0] ?? '';
  if (renderedEvents !== newestEvent) {
    renderedEvents = newestEvent;
    logEl.innerHTML = sim.events.slice(0, 6).map((e) => `<div>${e}</div>`).join('');
  }

  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(0, 0, W, H);
  hits = [];
  const grid = cv.clientWidth >= 900;
  if (grid) {
    // quarter progress strip
    ctx.fillStyle = '#4a6fa5';
    ctx.fillRect(0, 0, W * (sim.s.over ? 1 : s.qProg), 3);
    const pw = W / 2;
    const ph = (H - 3) / 2;
    PANES.forEach((p, i) => drawPane(p.key, i, (i % 2) * pw, 3 + Math.floor(i / 2) * ph, pw, ph, true));
    ctx.fillStyle = '#666';
    ctx.font = FONT(9);
    ctx.fillText('keys 1-4 panes \u00b7 F speed \u00b7 ESC pause \u00b7 click levers \u00b7 the board is watching', 8, H - 4);
    drawWordmark(ctx, W - 210, H - 26, 16);
  } else {
    drawPane(PANES[pane].key, pane, 0, 0, W, H, false);
  }

  if (bootChoice === '') drawBootPrompt();
  else if (s.over) drawOver();
  else if (paused) drawPause();
}

const hudSpans: HTMLSpanElement[] = [];
function setHud(i: number, text: string, col = '#eee'): void {
  while (hudSpans.length <= i) {
    const span = document.createElement('span');
    hudEl.insertBefore(span, speedBtns[0] ?? null);
    hudSpans.push(span);
  }
  hudSpans[i].innerHTML = `<b style="color:${col}">${text}</b>`;
}

let last = performance.now();
function frame(now: number): void {
  const dtReal = Math.min(0.25, (now - last) / 1000);
  last = now;
  pollInput();
  input.endFrame();

  if (bootChoice !== '' && !paused) {
    sim.tick((dtReal * speed) / QUARTER_SECONDS);
  }

  const s = sim.s;
  // muzak turns minor as the empire gets ugly (hysteresis at the loop seam)
  const bl = totalBacklash(s);
  if (bl >= 45 && prevBacklashTotal < 45) switchMusic(1);
  if (bl < 28 && prevBacklashTotal >= 28) switchMusic(0);
  prevBacklashTotal = bl;

  // endgame stings
  if (s.over && prevOver !== s.over) {
    if (s.over === 'sustained') sfx.preset('cash');
    else { sfx.preset('scandal'); stingFail(); }
  }
  prevOver = s.over;

  if (s.quarter > bestQuarter && !s.over) { bestQuarter = s.quarter - 1; save(GAME, 'best-quarter', bestQuarter); }

  draw();
  requestAnimationFrame(frame);
}

// profitable-quarter chime hook (fires from the sim quarter callback)
const prevProfitGood = { v: false };
sim.onQuarter = () => {
  const s = sim.s;
  if (s.over) {
    save<RunSave | null>(GAME, 'run', null);
    if (s.quarter - 1 > bestQuarter) { bestQuarter = s.quarter - 1; save(GAME, 'best-quarter', bestQuarter); }
    if (s.over === 'sustained') { sustainedCount++; save(GAME, 'sustained-count', sustainedCount); }
    return;
  }
  save<RunSave>(GAME, 'run', { v: 2, s: sim.s, events: sim.events });
  const good = s.lastProfit >= targetNow(s);
  if (good && !prevProfitGood.v) sfx.preset('cash');
  prevProfitGood.v = good;
};

layout();
requestAnimationFrame(frame);

// debug hook (?debug) — verification depends on these
if (new URLSearchParams(location.search).has('debug')) {
  const w = window as unknown as { __maga: unknown };
  w.__maga = {
    get quarter() { return sim.s.quarter; },
    get cash() { return Math.round(sim.s.cash); },
    get profit() { return Math.round(sim.s.lastProfit); },
    get backlash() { return sim.summary().backlash; },
    get boardPatience() { return Math.round(sim.s.patience); },
    get panes() { return sim.summary().panes; },
    get paused() { return paused; },
    get speed() { return speed; },
    summary: () => sim.summary(),
    sim, setPane, input, sfx,
    setSpeed: (v: number) => { speed = v; },
    setPaused: (v: boolean) => { paused = v; },
    clickAt: (x: number, y: number) => {
      for (const h of hits) {
        if (x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) { h.fn(); return true; }
      }
      return false;
    },
  };
}
