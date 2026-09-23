import { Input, Sfx, fitIntegerScale, letterboxOffset, viewport, load, save, stepsFromBpm, type Song } from '@maga/arcade-core';
import { LEVELS, menuBed, type Obstacle, type SongSpec } from './levels';
/**
 * IMPOSSIBLE RUN — one-button rhythm autorunner (Canvas 2D).
 * Feel reference: The Impossible Game (2010 Lite); content: full 5-track
 * campaign, practice checkpoints, medals, per-level chip music locked to the
 * obstacle grid (AudioSyncClock — see levels.ts).
 */

// ---- tunables (collision-verified: gap-kill x=1410, block front-edge x=2967) ----
const DT = 1 / 120;            // fixed timestep
const SPEED = 360;             // px/s auto-run
const GRAV = 2600;             // px/s^2
const JUMP_V = 880;            // fixed impulse — no variable height
const CUBE = 34;               // hitbox edge
const JUMP_BUFFER = 0.06;      // s — press slightly early still jumps (DD-45 craft)
const COYOTE = 0.10;           // s — leave edge, still jump (DD-45 craft)
const RESPAWN_MS = 160;        // death -> respawn <= 200ms feel
const GROUND_Y = 430;
const W = 960;
const H = 540;
const BADGE_H = 22;
const MEDAL_PERFECT_DEATHS = 5; // PERFECT = clear normal mode with <= 5 deaths

const badgeEl = document.querySelector<HTMLElement>('.badge');
const muteBtn = document.getElementById('mute');

// ---- persistence (D-61: every persisted progress is clamped to [0,1]) --------
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const bests: number[] = LEVELS.map((_, i) => clamp01(load('impossible', `best-${i}`, 0)));
type Medal = 'none' | 'cleared' | 'perfect';
const medals: Medal[] = LEVELS.map((_, i) => load<Medal>('impossible', `medal-${i}`, 'none'));
const unlocked = (i: number): boolean => i === 0 || medals[i - 1] !== 'none';

// ---- canvas + integer letterbox (arcade-core) ----
const cv = document.createElement('canvas');
cv.width = W;
cv.height = H;
document.body.appendChild(cv);
const ctx = cv.getContext('2d')!;

let cachedScale = 1;
// getBoundingClientRect() already includes the letterbox offset (boxhead D-09
// lesson) — convert client coords to canvas-local FIRST, then scale down.
const toLogical = (cx: number, cy: number) => {
  const r = cv.getBoundingClientRect();
  return { x: (cx - r.left) / cachedScale, y: (cy - r.top) / cachedScale };
};

function layout(): void {
  const vp = viewport();
  const badgeH = badgeEl?.offsetHeight ?? 0;
  if (muteBtn) muteBtn.style.top = `${badgeH + 4}px`;
  const avail = { width: vp.width, height: vp.height - badgeH };
  const s = fitIntegerScale(W, H, avail, 4);
  const off = letterboxOffset(W, H, s, avail);
  cachedScale = s;
  cv.style.width = `${W * s}px`;
  cv.style.height = `${H * s}px`;
  cv.style.left = `${off.x}px`;
  cv.style.top = `${off.y + badgeH}px`;
}
window.addEventListener('resize', layout);
layout();

// ---- audio: SFX + beat-locked chip songs --------------------------------------
const sfx = new Sfx();
let vol = clamp01(load('impossible', 'volume', 0.7));
let muted = load('impossible', 'muted', false);
sfx.volume = vol;
sfx.setMuted(muted);
let audioSeeded = false;

/** SongSpec (Hz arrays) → arcade-core Song, optionally rotated to `rot` steps
 *  so a respawn mid-level keeps the melody phase-locked to the obstacle grid. */

function toSong(spec: SongSpec, stepMs: number, rot = 0): Song {
  const rotN = <T,>(a: T[]): T[] => {
    const k = ((rot % a.length) + a.length) % a.length;
    return a.slice(k).concat(a.slice(0, k));
  };
  return {
    stepMs,
    tracks: spec.tracks.map(t => ({ wave: t.wave, notes: rotN(t.notes), gain: t.gain, gate: t.gate, lp: t.lp })),
    drums: spec.drums ? { steps: rotN(spec.drums.split('')).join(''), gain: spec.drumGain ?? 0.5 } : undefined,
  };
}

function playLevelSong(level: (typeof LEVELS)[number], fromX: number): void {
  const rot = Math.round(fromX / level.pxStep);
  sfx.playSong(toSong(level.song, stepsFromBpm(level.bpm), rot));
}
function playMenuBed(): void {
  sfx.playSong(toSong(menuBed(), stepsFromBpm(96)));
}
/** first user gesture unlocks the AudioContext and starts the screen's music */
function seedAudio(): void {
  if (audioSeeded) return;
  audioSeeded = true;
  if (screen === 'run') playLevelSong(level(), cube.x);
  else playMenuBed();
}
function setVolume(v: number): void {
  vol = clamp01(v);
  sfx.volume = vol;
  save('impossible', 'volume', vol);
}
function toggleMute(): void {
  muted = !muted;
  sfx.setMuted(muted);
  save('impossible', 'muted', muted);
  paintMuteBtn();
}
function paintMuteBtn(): void {
  if (muteBtn) muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON';
}
if (muteBtn) {
  muteBtn.addEventListener('click', () => { seedAudio(); toggleMute(); });
  paintMuteBtn();
}

// ---- input: arcade-core + D-35 event-queued taps -------------------------------
const input = new Input();
input.attach(cv, toLogical);
// KeyZ is unbound in arcade-core defaults; add it as a jump alias.
input.setKeymaps({ p1: { KeyZ: 'fire', KeyR: 'action' } });

const JUMP_KEYS: Record<string, true> = { Space: true, KeyW: true, ArrowUp: true, KeyZ: true, KeyJ: true, Enter: true };
const NAV_KEYS: Record<string, true> = { ArrowUp: true, KeyW: true };
/** D-35: presses are captured as events, not polled — a down+up inside one
 *  rAF gap still leaves pendingJump=true for the next frame to consume. */
let pendingJump = false;
let pendingCode = '';
let pendingPtr = false;
let pendingPtrX = 0;
let pendingPtrY = 0;
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (JUMP_KEYS[e.code]) { pendingJump = true; pendingCode = e.code; seedAudio(); }
  else if (e.code === 'KeyC') dropFlag();
  else if (e.code === 'BracketLeft') setVolume(vol - 0.1);
  else if (e.code === 'BracketRight') setVolume(vol + 0.1);
  else if (e.code === 'KeyM') { seedAudio(); toggleMute(); }
});
cv.addEventListener('pointerdown', (e) => {
  const p = toLogical(e.clientX, e.clientY);
  pendingJump = true;
  pendingPtr = true;
  pendingPtrX = p.x;
  pendingPtrY = p.y;
  pendingCode = '';
  seedAudio();
});
window.addEventListener('blur', () => { pendingJump = false; pendingPtr = false; });

// ---- game state ----------------------------------------------------------------
type Screen = 'title' | 'select' | 'mode' | 'run' | 'clear';
type RunState = 'running' | 'dead';
type Mode = 'normal' | 'practice';
interface Cube { x: number; y: number; vy: number; grounded: boolean; rot: number }
interface Particle { x: number; y: number; vx: number; vy: number; s: number; life: number }

let screen: Screen = 'title';
let sel = 0;                 // menu selection (select / mode / pause / clear)
let levelIdx = 0;
let mode: Mode = 'normal';
let state: RunState = 'running';
let cube: Cube = { x: 0, y: GROUND_Y - CUBE, vy: 0, grounded: true, rot: 0 };
let particles: Particle[] = [];
let camX = 0;
let attempt = 0;
let deaths = 0;
let jumpBuf = 0;
let coyoteT = 0;
let deadT = 0;
let paused = false;
let runT = 0;                // seconds since spawn (beat-phase visual clock)
let flashT = 0;              // death flash
let respawnX = 0;            // practice checkpoint (0 in normal mode)
let passedCp = 0;            // furthest auto checkpoint reached this attempt chain
let droppedCp: number | null = null; // practice: user-planted flag
let clearStats = { medal: 'none' as Medal, practice: false, next: false };
const level = (): (typeof LEVELS)[number] => LEVELS[levelIdx];

// ---- collision (bucket-indexed; semantics identical to the verified build) ----
const BUCKET = 256;
let buckets = new Map<number, Obstacle[]>();
function loadWorld(i: number): void {
  levelIdx = i;
  buckets = new Map();
  for (const o of LEVELS[i].obstacles) {
    const b0 = Math.floor(o.x / BUCKET), b1 = Math.floor((o.x + o.w) / BUCKET);
    for (let b = b0; b <= b1; b++) {
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b)!.push(o);
    }
  }
}
const near = (x: number): Obstacle[] => buckets.get(Math.floor(x / BUCKET)) ?? [];

function floorAt(x: number): number {
  let top = -Infinity, inGap = false;
  for (const o of near(x)) {
    if (x < o.x || x > o.x + o.w) continue;
    if (o.t === 'gap') inGap = true;
    if (o.t === 'block') top = Math.max(top, GROUND_Y - (o.h ?? 0));
  }
  if (top > -Infinity) return top;
  return inGap ? -Infinity : GROUND_Y;
}
function solidSideAt(x: number, y: number): boolean {
  for (const o of near(x)) {
    if (o.t !== 'block') continue;
    const top = GROUND_Y - (o.h ?? 0);
    if (x > o.x && x < o.x + o.w && y + CUBE > top + 2 && y < GROUND_Y) return true;
  }
  return false;
}
function spikeAt(x: number, y: number): boolean {
  for (const o of near(x)) {
    if (o.t !== 'spike') continue;
    const cx = x + CUBE / 2, cy = y + CUBE;
    if (cx > o.x + 4 && cx < o.x + o.w - 4 && cy > GROUND_Y - 26) return true;
  }
  return false;
}

// ---- run lifecycle ---------------------------------------------------------------
function spawn(): void {
  const lv = level();
  respawnX = 0;
  if (mode === 'practice') {
    const dropped = droppedCp !== null && droppedCp <= cube.x + 1 ? droppedCp : -1;
    respawnX = Math.max(passedCp, dropped);
  }
  attempt++;
  state = 'running';
  cube = { x: respawnX, y: GROUND_Y - CUBE, vy: 0, grounded: true, rot: 0 };
  particles = [];
  camX = Math.max(0, cube.x - 220);
  jumpBuf = 0; coyoteT = 0; deadT = 0; runT = 0; flashT = 0; paused = false;
  playLevelSong(lv, respawnX);
}

function startLevel(i: number, m: Mode): void {
  levelIdx = i;
  mode = m;
  loadWorld(i);
  attempt = 0;
  deaths = 0;
  passedCp = 0;
  droppedCp = null;
  screen = 'run';
  sel = 0;
  spawn();
}

function die(): void {
  const lv = level();
  const prog = clamp01(cube.x / lv.end);
  if (prog > bests[levelIdx]) { bests[levelIdx] = prog; save('impossible', `best-${levelIdx}`, prog); }
  state = 'dead'; deadT = 0; deaths++; flashT = 1;
  sfx.stopMusic();          // death duck: music cuts, death SFX rings alone
  sfx.preset('death');
  for (let i = 0; i < 26; i++) particles.push({
    x: cube.x + CUBE / 2, y: cube.y + CUBE / 2,
    vx: (Math.random() - .5) * 700, vy: -Math.random() * 600 - 100,
    s: 4 + Math.random() * 8, life: .5 + Math.random() * .4,
  });
}

function clearLevel(): void {
  const lv = level();
  bests[levelIdx] = 1;
  save('impossible', `best-${levelIdx}`, 1);
  clearStats = { medal: 'none', practice: mode === 'practice', next: false };
  if (mode === 'normal') {
    clearStats.medal = deaths <= MEDAL_PERFECT_DEATHS ? 'perfect' : 'cleared';
    if (clearStats.medal === 'perfect' || medals[levelIdx] === 'none') medals[levelIdx] = clearStats.medal;
    save('impossible', `medal-${levelIdx}`, medals[levelIdx]);
  }
  clearStats.next = levelIdx + 1 < LEVELS.length && unlocked(levelIdx + 1);
  screen = 'clear';
  sel = 0;
  sfx.stopMusic();
  const jingle = [523.25, 659.25, 783.99, 1046.5];
  jingle.forEach((f, i) => window.setTimeout(() => sfx.blip({ wave: 'square', freq: f, duration: 0.14, volume: 0.3 }), i * 110));
}

/** practice: plant (or remove) a checkpoint flag at the cube — toggle behaviour */
function dropFlag(): void {
  if (screen !== 'run' || mode !== 'practice' || paused || state !== 'running' || !cube.grounded) return;
  const lv = level();
  // only on plain ground (a block-top flag would respawn the cube inside the block)
  if (floorAt(cube.x + CUBE / 2) !== GROUND_Y) return;
  const x = Math.round(cube.x / lv.pxStep / 2) * 2 * lv.pxStep;  // snap to an 8th note
  if (x < lv.pxStep * 8 || x > lv.end - lv.pxStep * 8) return;
  if (droppedCp !== null && Math.abs(droppedCp - x) < lv.pxStep * 3) {
    droppedCp = null;                       // toggle off
    sfx.blip({ wave: 'triangle', freq: 300, freqEnd: 180, duration: 0.08, volume: 0.3 });
  } else {
    droppedCp = x;
    sfx.blip({ wave: 'triangle', freq: 520, freqEnd: 760, duration: 0.08, volume: 0.3 });
  }
}

function step(dt: number): void {
  const lv = level();
  if (state === 'dead') {
    deadT += dt * 1000;
    if (deadT >= RESPAWN_MS) spawn();
    return;
  }
  if (paused) return;
  runT += dt;

  cube.x += SPEED * dt;
  const footX = cube.x + CUBE / 2;

  const floor = floorAt(footX);
  if (cube.grounded) {
    if (floor === -Infinity || cube.y + CUBE < floor - 1) { cube.grounded = false; coyoteT = COYOTE; }
  } else {
    coyoteT = Math.max(0, coyoteT - dt);
    cube.vy += GRAV * dt;
    cube.y += cube.vy * dt;
    if (floor > -Infinity && cube.vy >= 0 && cube.y + CUBE >= floor) {
      cube.y = floor - CUBE; cube.vy = 0; cube.grounded = true; cube.rot = Math.round(cube.rot / (Math.PI / 2)) * (Math.PI / 2);
    }
  }
  if (!cube.grounded) cube.rot += dt * 4.2;

  jumpBuf = Math.max(0, jumpBuf - dt);
  if (jumpBuf > 0 && (cube.grounded || coyoteT > 0)) {
    cube.vy = -JUMP_V; cube.grounded = false; coyoteT = 0; jumpBuf = 0;
    // no jump sound — the original keeps the cube silent on the beat
  }

  if (spikeAt(cube.x, cube.y) || solidSideAt(cube.x + CUBE, cube.y)) return die();
  if (floor === -Infinity && cube.y + CUBE > GROUND_Y + 8) return die();
  if (mode === 'practice') {
    const hit = lv.checkpoints.filter(c => c <= cube.x && c > passedCp);
    if (hit.length) {
      passedCp = hit[hit.length - 1];
      sfx.blip({ wave: 'triangle', freq: 700, freqEnd: 900, duration: 0.06, volume: 0.2 });
    }
  }
  if (cube.x >= lv.end) return clearLevel();
  const prog = clamp01(cube.x / lv.end);
  if (prog > bests[levelIdx]) bests[levelIdx] = prog;
}

// ---- UI framework -----------------------------------------------------------------
interface Btn { x: number; y: number; w: number; h: number; id: string }
let uiButtons: Btn[] = [];

function pressJump(): void { jumpBuf = JUMP_BUFFER; }

function uiAction(id: string): void {
  switch (id) {
    case 'start': screen = 'select'; sel = levelIdx; break;
    case 'mode-normal': startLevel(sel, 'normal'); break;
    case 'mode-practice': startLevel(sel, 'practice'); break;
    case 'resume': paused = false; playLevelSong(level(), cube.x); break;
    case 'restart': paused = false; startLevel(levelIdx, mode); break;
    case 'exit':
      paused = false;
      screen = 'select'; sel = levelIdx;
      playMenuBed();
      break;
    case 'next': startLevel(levelIdx + 1, 'normal'); break;
    case 'retry': startLevel(levelIdx, mode); break;
    case 'tracks': screen = 'select'; sel = levelIdx; playMenuBed(); break;
    case 'vol-down': setVolume(vol - 0.1); break;
    case 'vol-up': setVolume(vol + 0.1); break;
    case 'mute': toggleMute(); break;
    case 'flag': dropFlag(); break;
  }
  if (id.startsWith('lv-')) {
    const i = Number(id.slice(3));
    if (unlocked(i)) { sel = i; screen = 'mode'; }
  }
}

function uiTick(): void {
  // pointer taps hit UI buttons first (menus + practice flag + pause overlay)
  if (pendingPtr && uiButtons.length) {
    const hit = uiButtons.find(b => pendingPtrX >= b.x && pendingPtrX <= b.x + b.w && pendingPtrY >= b.y && pendingPtrY <= b.y + b.h);
    if (hit) {
      seedAudio();
      uiAction(hit.id);
      pendingJump = false;   // a UI tap is not a jump
    }
  }
  if (pendingJump) {
    const nav = NAV_KEYS[pendingCode] === true;
    switch (screen) {
      case 'title':
        screen = 'select'; sel = levelIdx;
        sfx.blip({ wave: 'square', freq: 620, freqEnd: 820, duration: 0.05, volume: 0.25 });
        break;
      case 'select':
        if (!nav) { if (unlocked(sel)) { sfx.blip({ wave: 'square', freq: 620, freqEnd: 820, duration: 0.05, volume: 0.25 }); screen = 'mode'; } }
        break;
      case 'mode':
        if (!nav) uiAction(sel === 0 ? 'mode-normal' : 'mode-practice');
        break;
      case 'run':
        if (paused) { if (!nav) uiAction('resume'); }
        else if (state === 'running') pressJump();
        break;
      case 'clear':
        if (!nav) {
          if (sel === 0 && clearStats.next) uiAction('next');
          else if (sel === (clearStats.next ? 1 : 0)) uiAction('retry');
          else uiAction('tracks');
        }
        break;
    }
    pendingJump = false;
  }
  // arrow/WASD navigation (arcade-core keymap; NAV_KEYS presses skip confirm above)
  const navScreens = screen === 'select' || screen === 'mode' || screen === 'clear' || (screen === 'run' && paused);
  if (navScreens) {
    if (input.wasPressed('up')) moveSel(-1);
    if (input.wasPressed('down')) moveSel(1);
  }
  pendingPtr = false;   // event flags live for exactly one frame
  if (input.wasPressed('pause')) {
    if (screen === 'run') {
      if (state === 'running') {
        paused = !paused;
        if (paused) sfx.stopMusic();
        else playLevelSong(level(), cube.x);
      }
    } else if (screen === 'mode') { screen = 'select'; }
    else if (screen === 'clear') { uiAction('tracks'); }
  }
  if (input.wasPressed('action')) {   // R — quick restart
    if (screen === 'run' && state === 'running') { paused = false; startLevel(levelIdx, mode); }
    else if (screen === 'clear') uiAction('retry');
  }
  input.endFrame();
}

function moveSel(d: number): void {
  const n = screen === 'select' ? LEVELS.length : screen === 'mode' ? 2 : screen === 'run' ? 3 : (clearStats.next ? 3 : 2);
  sel = ((sel + d) % n + n) % n;
  sfx.blip({ wave: 'square', freq: 480, duration: 0.03, volume: 0.18 });
}

// ---- drawing ---------------------------------------------------------------------
function bg(pal: (typeof LEVELS)[number]['palette'], deco: string, t: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, pal.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const lv = level();
  const pulse = 1 - ((runT / (stepsFromBpm(lv.bpm) * 4 / 1000)) % 1); // beat phase → subtle pulse
  ctx.save();
  if (deco === 'embers') {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 26; i++) {
      const px = ((i * 997 + 13) % (W + 200)) - ((camX * 0.25) % (W + 200)) - 100;
      const py = GROUND_Y - ((t * (26 + (i % 5) * 9) + i * 211) % (GROUND_Y + 60));
      const s = 2 + (i % 3);
      ctx.fillStyle = i % 4 === 0 ? '#ffd27a' : deco;
      ctx.globalAlpha = 0.25 + 0.3 * ((i % 7) / 7) * pulse;
      ctx.fillRect((px + W + 200) % (W + 200) - 100, py, s, s);
    }
  } else if (deco === 'grid') {
    ctx.strokeStyle = deco; ctx.globalAlpha = 0.14; ctx.lineWidth = 1;
    const off = (camX * 0.4) % 120;
    for (let x = -off; x < W + 120; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND_Y); ctx.stroke(); }
    for (let y = 60; y < GROUND_Y; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  } else if (deco === 'stars') {
    for (let i = 0; i < 60; i++) {
      const px = ((i * 761 + 31) % (W + 100)) - ((camX * 0.15) % (W + 100));
      const py = (i * 397 + 53) % (GROUND_Y - 40);
      const tw = 0.35 + 0.5 * Math.abs(Math.sin(t * 2 + i));
      ctx.globalAlpha = tw * (0.5 + 0.3 * pulse);
      ctx.fillStyle = i % 9 === 0 ? '#ffffff' : deco;
      ctx.fillRect((px + W + 100) % (W + 100), py, 2, 2);
    }
  } else if (deco === 'clouds') {
    ctx.fillStyle = deco;
    for (let i = 0; i < 9; i++) {
      const px = ((i * 613 + 17) % (W + 400)) - ((camX * 0.2) % (W + 400));
      const py = 40 + ((i * 197) % 220);
      const s = 0.7 + ((i * 31) % 10) / 14;
      ctx.globalAlpha = 0.16 + 0.1 * ((i % 3) / 3);
      const x = (px + W + 400) % (W + 400) - 200;
      ctx.beginPath();
      ctx.ellipse(x, py, 90 * s, 26 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 60 * s, py + 8 * s, 60 * s, 20 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (deco === 'phase') {
    ctx.globalAlpha = 0.1 + 0.08 * pulse;
    ctx.fillStyle = deco;
    const off = (camX * 0.22 + t * 30) % 280;
    for (let x = -280 - off; x < W + 280; x += 280) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 90, 0); ctx.lineTo(x + 90 - 120, GROUND_Y); ctx.lineTo(x - 120, GROUND_Y);
      ctx.fill();
    }
  }
  ctx.restore();
}

function flag(x: number, lit: boolean, pal: (typeof LEVELS)[number]['palette'], kind: 'auto' | 'drop'): void {
  ctx.strokeStyle = pal.groundEdge; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - 58); ctx.stroke();
  ctx.fillStyle = lit ? pal.accent : 'rgba(128,128,128,.45)';
  ctx.beginPath();
  ctx.moveTo(x, GROUND_Y - 58); ctx.lineTo(x + 26, GROUND_Y - 49); ctx.lineTo(x, GROUND_Y - 40); ctx.fill();
  if (kind === 'drop') { ctx.fillStyle = pal.accent; ctx.fillRect(x - 5, GROUND_Y - 66, 10, 8); }
}

function drawRun(): void {
  const lv = level();
  const pal = lv.palette;
  bg(pal, lv.deco, runT);
  ctx.save();
  ctx.translate(-camX, 0);

  // ground with gaps
  ctx.fillStyle = pal.ground;
  ctx.fillRect(camX - 50, GROUND_Y, W + 100, H - GROUND_Y);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (const o of lv.obstacles) if (o.t === 'gap') ctx.fillRect(o.x, GROUND_Y, o.w, H - GROUND_Y);
  // gap edge highlight
  ctx.strokeStyle = pal.groundEdge; ctx.lineWidth = 3;
  for (const o of lv.obstacles) if (o.t === 'gap') ctx.strokeRect(o.x, GROUND_Y, o.w, 4);

  // obstacles in palette
  for (const o of lv.obstacles) {
    if (o.t === 'spike') {
      ctx.fillStyle = pal.spike;
      ctx.beginPath(); ctx.moveTo(o.x, GROUND_Y); ctx.lineTo(o.x + o.w / 2, GROUND_Y - 34); ctx.lineTo(o.x + o.w, GROUND_Y); ctx.fill();
      ctx.strokeStyle = pal.spikeEdge; ctx.lineWidth = 2; ctx.stroke();
    } else if (o.t === 'block') {
      ctx.fillStyle = pal.block;
      ctx.fillRect(o.x, GROUND_Y - (o.h ?? 0), o.w, o.h ?? 0);
      ctx.strokeStyle = pal.blockEdge; ctx.lineWidth = 3;
      ctx.strokeRect(o.x, GROUND_Y - (o.h ?? 0), o.w, o.h ?? 0);
    }
  }

  // finish gate
  ctx.fillStyle = pal.groundEdge;
  ctx.fillRect(lv.end, GROUND_Y - 170, 8, 170);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(lv.end + 8, GROUND_Y - 170, 44, 26);
  ctx.fillRect(lv.end + 8, GROUND_Y - 126, 30, 12);

  // practice checkpoint flags
  if (mode === 'practice') {
    for (const c of lv.checkpoints) if (Math.abs(c - camX) < W + 200) flag(c, c <= cube.x, pal, 'auto');
    if (droppedCp !== null) flag(droppedCp, true, pal, 'drop');
  }

  // particles + cube
  ctx.fillStyle = pal.accent;
  for (const p of particles) ctx.fillRect(p.x, p.y, p.s, p.s);
  if (state !== 'dead') {
    ctx.save();
    ctx.translate(cube.x + CUBE / 2, cube.y + CUBE / 2);
    ctx.rotate(cube.rot);
    ctx.fillStyle = pal.cube;
    ctx.fillRect(-CUBE / 2, -CUBE / 2, CUBE, CUBE);
    ctx.strokeStyle = pal.cubeEdge; ctx.lineWidth = 3;
    ctx.strokeRect(-CUBE / 2, -CUBE / 2, CUBE, CUBE);
    ctx.restore();
  }
  ctx.restore();

  // death flash
  if (flashT > 0) {
    ctx.fillStyle = `rgba(255,64,48,${(flashT * 0.32).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // HUD: attempt counter, deaths, progress bar, best
  const prog = clamp01(cube.x / lv.end) * 100;
  ctx.fillStyle = pal.ink; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`ATTEMPT ${attempt}`, 16, 28);
  ctx.font = '13px monospace';
  ctx.fillText(`DEATHS ${deaths}   BEST ${(bests[levelIdx] * 100).toFixed(0)}%${mode === 'practice' ? '   PRACTICE' : ''}`, 16, 48);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(W / 2 - 220, 18, 440, 12);
  ctx.fillStyle = pal.accent; ctx.fillRect(W / 2 - 220, 18, 440 * prog / 100, 12);
  ctx.fillStyle = pal.ink; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${prog.toFixed(0)}%`, W - 16, 28);
  ctx.textAlign = 'left';
  ctx.font = '12px monospace';
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.75;
  ctx.fillText('SPACE/TAP jump · R restart · ESC pause', 16, H - 14);
  ctx.globalAlpha = 1;

  // practice flag button (touch)
  if (mode === 'practice' && !paused && state === 'running') {
    const b = { x: W - 150, y: H - 74, w: 130, h: 46 };
    ctx.fillStyle = droppedCp !== null ? pal.accent : 'rgba(0,0,0,.4)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = pal.groundEdge; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = droppedCp !== null ? '#111' : pal.ink;
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText(droppedCp !== null ? 'FLAG ON' : 'DROP FLAG', b.x + b.w / 2, b.y + 29);
    ctx.textAlign = 'left';
    uiButtons.push({ ...b, id: 'flag' });
  }

  if (state === 'dead') banner('CRASHED');
  if (paused) drawPause(pal);
}

function banner(t: string): void {
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, H / 2 - 40, W, 80);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.fillText(t, W / 2, H / 2 + 10);
  ctx.textAlign = 'left';
}

function menuButton(x: number, y: number, w: number, h: number, label: string, id: string, selected: boolean, ink: string, accent: string): void {
  ctx.fillStyle = selected ? accent : 'rgba(255,255,255,.07)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = selected ? accent : 'rgba(255,255,255,.25)';
  ctx.lineWidth = selected ? 3 : 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = selected ? '#0e0d12' : ink;
  ctx.font = 'bold 19px monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  ctx.textAlign = 'left';
  uiButtons.push({ x, y, w, h, id });
}

function volumeRow(y: number, ink: string, accent: string): void {
  ctx.fillStyle = ink; ctx.font = '15px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`VOLUME  [ ] /  ·  M — MUTE ${muted ? 'OFF' : 'ON'}`, W / 2, y);
  const bw = 300, bx = W / 2 - bw / 2;
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(bx, y + 12, bw, 12);
  ctx.fillStyle = accent; ctx.fillRect(bx, y + 12, bw * vol, 12);
  uiButtons.push({ x: bx - 40, y: y + 4, w: 34, h: 28, id: 'vol-down' });
  uiButtons.push({ x: bx + bw + 6, y: y + 4, w: 34, h: 28, id: 'vol-up' });
  ctx.font = 'bold 17px monospace';
  ctx.fillText('−', bx - 23, y + 24); ctx.fillText('+', bx + bw + 23, y + 24);
  ctx.textAlign = 'left';
}

function drawTitle(): void {
  ctx.fillStyle = '#0d0b10'; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,128,64,.16)');
  grad.addColorStop(1, 'rgba(64,128,255,.1)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5efe6'; ctx.font = 'bold 84px monospace';
  ctx.fillText('IMPOSSIBLE', W / 2, 200);
  ctx.fillStyle = '#ff9455'; ctx.fillText('RUN', W / 2, 290);
  ctx.fillStyle = '#9a94a8'; ctx.font = '15px monospace';
  ctx.fillText('5 TRACKS · ONE BUTTON · RHYTHM OR DEATH', W / 2, 336);
  const blink = 0.55 + 0.45 * Math.sin(performance.now() / 300);
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#f5efe6'; ctx.font = 'bold 22px monospace';
  ctx.fillText('PRESS SPACE OR TAP TO START', W / 2, 420);
  ctx.globalAlpha = 1;
  volumeRow(480, '#9a94a8', '#ff9455');
  ctx.textAlign = 'left';
}

function drawSelect(): void {
  ctx.fillStyle = '#0d0b10'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5efe6'; ctx.font = 'bold 30px monospace';
  ctx.fillText('SELECT TRACK', W / 2, 58);
  ctx.font = '13px monospace'; ctx.fillStyle = '#9a94a8';
  ctx.fillText('ARROWS choose · SPACE start · ESC back', W / 2, 84);
  ctx.textAlign = 'left';
  LEVELS.forEach((lv, i) => {
    const y = 110 + i * 78;
    const open = unlocked(i);
    const selected = sel === i;
    // palette chip
    const chip = ctx.createLinearGradient(60, y, 60, y + 62);
    chip.addColorStop(0, lv.palette.skyTop);
    chip.addColorStop(1, lv.palette.skyBot);
    ctx.fillStyle = chip; ctx.fillRect(60, y, 26, 62);
    ctx.strokeStyle = selected ? lv.palette.accent : 'rgba(255,255,255,.2)';
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeRect(60, y, 836, 62);
    ctx.fillStyle = open ? (selected ? '#0e0d12' : '#f5efe6') : '#6d6879';
    if (selected) { ctx.fillStyle = lv.palette.accent; ctx.globalAlpha = 0.16; ctx.fillRect(60, y, 836, 62); ctx.globalAlpha = 1; }
    ctx.fillStyle = open ? '#f5efe6' : '#6d6879';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(`${i + 1} · ${open ? lv.name : 'LOCKED'}`, 104, y + 27);
    ctx.font = '14px monospace';
    const medalTxt = medals[i] === 'perfect' ? 'PERFECT' : medals[i] === 'cleared' ? 'CLEARED' : '—';
    ctx.fillStyle = medals[i] === 'perfect' ? '#ffd23f' : medals[i] === 'cleared' ? '#c9d3e0' : '#6d6879';
    ctx.fillText(`${medalTxt}`, 104, y + 50);
    ctx.fillStyle = open ? '#9a94a8' : '#6d6879';
    ctx.textAlign = 'right';
    ctx.fillText(`${lv.bpm} BPM · ${(lv.end / SPEED / 60).toFixed(1)} MIN`, 780, y + 27);
    ctx.fillText(`BEST ${(bests[i] * 100).toFixed(0)}%`, 780, y + 50);
    ctx.textAlign = 'left';
    uiButtons.push({ x: 60, y, w: 836, h: 62, id: `lv-${i}` });
  });
  volumeRow(528, '#9a94a8', '#ff9455');
}

function drawMode(): void {
  const lv = LEVELS[sel];
  ctx.fillStyle = '#0d0b10'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = lv.palette.accent; ctx.font = 'bold 34px monospace';
  ctx.fillText(lv.name, W / 2, 140);
  ctx.fillStyle = '#9a94a8'; ctx.font = '14px monospace';
  ctx.fillText(`${lv.bpm} BPM · ${(lv.end / SPEED / 60).toFixed(1)} MIN · BEST ${(bests[sel] * 100).toFixed(0)}%`, W / 2, 172);
  menuButton(W / 2 - 200, 240, 400, 62, 'NORMAL RUN', 'mode-normal', sel === 0, '#f5efe6', lv.palette.accent);
  ctx.fillStyle = '#9a94a8'; ctx.font = '13px monospace';
  ctx.fillText('die = back to the start · CLEARED / PERFECT medals unlock the next track', W / 2, 330);
  menuButton(W / 2 - 200, 360, 400, 62, 'PRACTICE', 'mode-practice', sel === 1, '#f5efe6', lv.palette.accent);
  ctx.fillStyle = '#9a94a8'; ctx.font = '13px monospace';
  ctx.fillText('checkpoint flags every ~15% · C or DROP FLAG plants a movable flag · no medals', W / 2, 450);
  ctx.fillStyle = '#6d6879'; ctx.font = '13px monospace';
  ctx.fillText('ESC back', W / 2, 500);
  ctx.textAlign = 'left';
}

function drawPause(pal: (typeof LEVELS)[number]['palette']): void {
  ctx.fillStyle = 'rgba(6,5,9,.82)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.ink; ctx.font = 'bold 36px monospace';
  ctx.fillText('PAUSED', W / 2, 130);
  const items = ['RESUME', 'RESTART TRACK', 'EXIT TO TRACKS'];
  items.forEach((label, i) => menuButton(W / 2 - 170, 180 + i * 70, 340, 54, label, ['resume', 'restart', 'exit'][i], sel === i, '#f5efe6', pal.accent));
  volumeRow(430, '#f5efe6', pal.accent);
  ctx.textAlign = 'left';
}

function drawClear(): void {
  const lv = level();
  const pal = lv.palette;
  ctx.fillStyle = '#0d0b10'; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, '#0d0b10');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5efe6'; ctx.font = 'bold 44px monospace';
  ctx.fillText(clearStats.practice ? 'PRACTICE CLEAR' : 'TRACK CLEAR', W / 2, 150);
  if (!clearStats.practice) {
    const perfect = clearStats.medal === 'perfect';
    ctx.fillStyle = perfect ? '#ffd23f' : '#c9d3e0';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(perfect ? '★ PERFECT — 5 DEATHS OR FEWER' : '★ CLEARED', W / 2, 205);
  } else {
    ctx.fillStyle = '#9a94a8'; ctx.font = '15px monospace';
    ctx.fillText('practice runs award no medals — clear it in NORMAL', W / 2, 205);
  }
  ctx.fillStyle = '#f5efe6'; ctx.font = '16px monospace';
  ctx.fillText(`${lv.name} · ${attempt} ATTEMPT${attempt === 1 ? '' : 'S'} · ${deaths} DEATH${deaths === 1 ? '' : 'S'}`, W / 2, 260);
  const items = clearStats.next
    ? ['NEXT TRACK', 'RUN AGAIN', 'TRACKS']
    : ['RUN AGAIN', 'TRACKS'];
  items.forEach((label, i) => menuButton(W / 2 - 170, 310 + i * 66, 340, 52, label, clearStats.next ? ['next', 'retry', 'tracks'][i] : ['retry', 'tracks'][i], sel === i, '#f5efe6', pal.accent));
  ctx.textAlign = 'left';
}

function draw(): void {
  uiButtons = [];
  switch (screen) {
    case 'title': drawTitle(); break;
    case 'select': drawSelect(); break;
    case 'mode': drawMode(); break;
    case 'run': drawRun(); break;
    case 'clear': drawClear(); break;
  }
}

let acc = 0, last = performance.now();
function frame(now: number): void {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  acc += elapsed;
  last = now;
  uiTick();
  while (acc >= DT) { if (screen === 'run') step(DT); acc -= DT; }
  flashT = Math.max(0, flashT - elapsed * 3);
  for (const p of particles) { p.x += p.vx * DT; p.y += p.vy * DT; p.vy += GRAV * DT * .6; p.life -= DT; }
  particles = particles.filter(p => p.life > 0);
  camX = Math.max(0, cube.x - 220);
  draw();
  requestAnimationFrame(frame);
}

// boot
loadWorld(0);
requestAnimationFrame(frame);

// ---- debug hook (?debug) — the ONLY window hook (D-60) ----------------------------
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __maga: unknown }).__maga = {
    get screen() { return screen; }, get state() { return state; },
    get level() { return levelIdx; }, get levelName() { return level().name; },
    get mode() { return mode; },
    get x() { return cube.x; }, get y() { return cube.y; }, get vy() { return cube.vy; },
    get grounded() { return cube.grounded; }, get attempt() { return attempt; },
    get deaths() { return deaths; }, get paused() { return paused; },
    get progress() { return clamp01(cube.x / level().end); },
    get best() { return bests[levelIdx]; }, get bests() { return [...bests]; },
    get medals() { return [...medals]; }, get unlocked() { return LEVELS.map((_, i) => unlocked(i)); },
    get checkpoints() { return [...level().checkpoints]; },
    get passedCheckpoint() { return passedCp; }, get droppedCheckpoint() { return droppedCp; },
    get respawnX() { return respawnX; }, get pendingJump() { return pendingJump; },
    get runT() { return runT; }, get levelEnd() { return level().end; },
    get volume() { return vol; }, get muted() { return muted; },
    jump: pressJump, die,
    teleport(x: number) { cube.x = x; cube.y = GROUND_Y - CUBE; cube.vy = 0; cube.grounded = true; },
    restart: () => startLevel(levelIdx, mode),
    startLevel, toTitle() { screen = 'title'; sfx.stopMusic(); },
    setVolume, toggleMute, dropFlag,
  };
}
