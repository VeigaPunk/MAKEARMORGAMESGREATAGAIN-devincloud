/* hardest/game.js — browser shell: canvas render, input, level select, save.
 * All game logic lives in engine.js; this file only draws and feeds input. */
(function () {
'use strict';
const E = globalThis.HardestEngine;
const STAGE_W = 960, STAGE_H = 576;
const SAVE_KEY = 'hardest.save.v1';
const MENU_COLS = 16;
const MEDAL_COL = { gold: '#ffd23f', silver: '#c8ccd4', bronze: '#cd7f32' };

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
cv.width = STAGE_W; cv.height = STAGE_H;

/* ---------- save (validated: corrupt entries are dropped, never crash) ---------- */
function loadSave() {
  const fresh = () => ({ unlocked: 1, best: {}, deaths: 0, mute: false });
  let raw;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch { return fresh(); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fresh();
  const s = fresh();
  if (Number.isInteger(raw.unlocked) && raw.unlocked >= 1) s.unlocked = raw.unlocked;
  if (Number.isFinite(raw.deaths) && raw.deaths >= 0) s.deaths = Math.min(1e9, Math.floor(raw.deaths));
  s.mute = !!raw.mute;
  if (raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)) {
    for (const k of Object.keys(raw.best)) {
      const b = raw.best[k], id = Number(k);
      if (!Number.isInteger(id) || id < 1 || id > 999) continue;
      if (!b || typeof b !== 'object') continue;
      if (!Number.isFinite(b.deaths) || b.deaths < 0) continue;
      if (!Number.isFinite(b.time) || b.time <= 0) continue;
      if (!(b.medal in MEDAL_COL)) continue;
      s.best[id] = { deaths: Math.floor(b.deaths), time: b.time, medal: b.medal };
    }
  }
  return s;
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
let save = loadSave();

/* ---------- audio (WebAudio, no assets; M mutes) ---------- */
let AC = null, musicTimer = null;
function ensureAudio() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (!musicTimer) musicTimer = setInterval(musicTick, 40);
  } catch {}
}
function beep(f, d, type, g, slide) {
  if (save.mute) return;
  try {
    ensureAudio(); if (!AC) return;
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + d);
    gn.gain.value = g || 0.05;
    gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
    o.connect(gn); gn.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + d);
  } catch {}
}
function note(f, t, type, g, d) {
  const o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.value = f;
  gn.gain.setValueAtTime(g, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gn); gn.connect(AC.destination);
  o.start(t); o.stop(t + d + 0.02);
}
/* music bed — low tense 2-track loop, 16th notes at 96 BPM
 * (step 156.25 ms — same math as arcade-core's stepsFromBpm(96)). */
const BPM = 96, STEP_MS = 60000 / BPM / 4;
const MUSIC = {
  menu: {
    bass: { wave: 'triangle', gain: 0.05, gate: 0.9, notes: [
      55, 0, 0, 0, 0, 0, 55, 0, 65.41, 0, 0, 55, 0, 0, 0, 0,
      49, 0, 0, 0, 0, 0, 49, 0, 65.41, 0, 0, 82.41, 0, 0, 0, 0] },
    lead: { wave: 'sine', gain: 0.024, gate: 0.6, notes: [
      0, 0, 0, 0, 220, 0, 0, 0, 0, 0, 0, 0, 261.63, 0, 0, 0,
      0, 0, 0, 0, 220, 0, 0, 196, 0, 0, 0, 0, 0, 0, 164.81, 0] },
  },
  play: {
    bass: { wave: 'square', gain: 0.034, gate: 0.55, notes: [
      55, 0, 55, 0, 55, 0, 55, 0, 65.41, 0, 65.41, 0, 65.41, 0, 58.27, 0,
      55, 0, 55, 0, 55, 0, 55, 0, 49, 0, 49, 0, 65.41, 0, 82.41, 0] },
    lead: { wave: 'triangle', gain: 0.028, gate: 0.42, notes: [
      220, 0, 0, 261.63, 0, 0, 220, 0, 0, 261.63, 0, 0, 293.66, 0, 0, 0,
      220, 0, 0, 261.63, 0, 0, 329.63, 0, 0, 293.66, 0, 261.63, 0, 0, 220, 0] },
  },
};
const music = { mode: null, step: 0, nextT: 0 };
function setMusic(mode) {
  if (music.mode === mode) return;
  music.mode = mode; music.step = 0;
  if (AC) music.nextT = AC.currentTime + 0.05;
}
function musicTick() {
  if (!AC || save.mute || !music.mode) return;
  const pat = MUSIC[music.mode]; if (!pat) return;
  if (music.nextT < AC.currentTime - 0.05) music.nextT = AC.currentTime + 0.02; // tab-throttle resync
  while (music.nextT < AC.currentTime + 0.12) {
    const t = music.nextT;
    for (const tr of [pat.bass, pat.lead]) {
      const f = tr.notes[music.step % tr.notes.length];
      if (f) note(f, t, tr.wave, tr.gain, tr.gate * STEP_MS / 1000);
    }
    music.nextT += STEP_MS / 1000; music.step++;
  }
}
function toggleMute() {
  save.mute = !save.mute; persist();
  if (!save.mute && AC) { music.nextT = AC.currentTime + 0.05; beep(660, 0.06, 'square', 0.04); }
}

/* ---------- medals + tiers ---------- */
function medalFor(d) { return d === 0 ? 'gold' : d <= 2 ? 'silver' : 'bronze'; }
const TIERS = [[10, '#7ec850', 'WARM-UP'], [20, '#9be15d', 'DEMANDING'], [30, '#ffd23f', 'BRUTAL'], [40, '#ff9f3f', 'HARD+'], [50, '#ff6f3f', 'SAVAGE'], [60, '#d21f26', 'NIGHTMARE'], [120, '#b04fd8', 'INHUMAN'], [Infinity, '#ff3f6f', 'APEX']];
function tierOf(id) { for (const [max, c, n] of TIERS) if (id <= max) return { c, n }; }

/* ---------- levels ---------- */
let LEVELS = [];
function levelsReady() {
  const want = (globalThis.HARDEST_MANIFEST || []).length;
  return (globalThis.HARDEST_LEVELS || []).length >= want && want > 0;
}
function collectLevels() {
  LEVELS = (globalThis.HARDEST_LEVELS || []).slice().sort((a, b) => a.id - b.id);
  save.unlocked = Math.min(Math.max(1, save.unlocked), LEVELS.length);
}

/* ---------- input ---------- */
const keys = new Set();
const AXIS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
let joy = null; // {id, ox, oy, x, y}
addEventListener('keydown', e => {
  if (AXIS[e.code] || ['Space', 'Enter', 'Escape', 'KeyR', 'KeyM', 'KeyQ', 'KeyN'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  ensureAudio();
  keys.add(e.code);
  onKey(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
/* stuck-key fix: losing focus / hiding the tab must drop every held key */
const clearInput = () => { keys.clear(); joy = null; };
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
function axis() {
  let x = 0, y = 0;
  for (const k of keys) if (AXIS[k]) { x += AXIS[k][0]; y += AXIS[k][1]; }
  if (joy) { x += joy.x; y += joy.y; }
  const m = Math.hypot(x, y);
  return m > 1 ? { x: x / m, y: y / m } : { x, y };
}

/* ---------- state ---------- */
let screen = 'menu';           // 'menu' | 'play' | 'pause' | 'clear'
let st = null;                 // engine state
let levelIdx = 0;
let sel = 0;                   // menu selection index
let menuHover = -1;            // pointer-hovered tile (menu)
let lockedFlash = null;        // {i, t} — locked-tile rejection feedback
let particles = [];
let trail = [];
let flash = null;              // {r,g,b,t,dur} fullscreen feedback flash
let introT = 0;                // level intro card countdown
let coinStreak = 0;
let prevStatus = 'play';
let menuRects = [], pauseRects = [];
let prevCoins = 0, prevKeys = 0, prevTps = 0, prevDoors = true;

function startLevel(i) {
  levelIdx = i;
  st = E.create(LEVELS[i]);
  screen = 'play';
  particles = []; trail = []; flash = null;
  introT = 1.1; coinStreak = 0;
  prevStatus = 'play';
  prevCoins = st.coinsLeft; prevKeys = st.keysLeft; prevTps = 0; prevDoors = st.P.doorsOpen;
  setMusic('play');
}
function bankDeaths() { save.deaths += st.deaths; persist(); }
function nextUnplayed() {
  for (let i = 0; i < LEVELS.length && i < save.unlocked; i++)
    if (!save.best[LEVELS[i].id]) return i;
  return Math.min(save.unlocked, LEVELS.length) - 1;
}
function lockedPulse(i) {
  lockedFlash = { i, t: 0.6 };
  beep(150, 0.16, 'square', 0.05, 85);
}
function onKey(code) {
  if (screen === 'menu') {
    if (code === 'ArrowRight' || code === 'KeyD') sel = Math.min(LEVELS.length - 1, sel + 1);
    if (code === 'ArrowLeft' || code === 'KeyA') sel = Math.max(0, sel - 1);
    if (code === 'ArrowDown' || code === 'KeyS') sel = Math.min(LEVELS.length - 1, sel + MENU_COLS);
    if (code === 'ArrowUp' || code === 'KeyW') sel = Math.max(0, sel - MENU_COLS);
    if (code === 'KeyN') { sel = nextUnplayed(); return; }
    if (code === 'Enter' || code === 'Space') { if (sel < save.unlocked) startLevel(sel); else lockedPulse(sel); }
    if (code === 'KeyM') toggleMute();
  } else if (screen === 'play') {
    if (introT > 0 && (AXIS[code] || code === 'Space' || code === 'Enter')) { introT = 0; return; }
    if (code === 'Escape') screen = 'pause';
    if (code === 'KeyM') toggleMute();
    if (code === 'KeyR') { bankDeaths(); startLevel(levelIdx); }
  } else if (screen === 'pause') {
    if (code === 'Escape') screen = 'play';
    if (code === 'KeyM') toggleMute();
    if (code === 'KeyQ') { bankDeaths(); screen = 'menu'; setMusic('menu'); }
    if (code === 'KeyR') { bankDeaths(); startLevel(levelIdx); }
  } else if (screen === 'clear') {
    if (code === 'Enter' || code === 'Space') {
      screen = 'menu'; setMusic('menu');
      if (levelIdx + 1 < LEVELS.length) startLevel(levelIdx + 1);
    }
    if (code === 'KeyM') toggleMute();
    if (code === 'Escape') { screen = 'menu'; setMusic('menu'); }
  }
}
function pauseAction(a) {
  if (a === 'resume') screen = 'play';
  else if (a === 'restart') { bankDeaths(); startLevel(levelIdx); }
  else if (a === 'menu') { bankDeaths(); screen = 'menu'; setMusic('menu'); }
}

/* pointer: menu taps + in-game joystick */
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * STAGE_W / r.width, y: (e.clientY - r.top) * STAGE_H / r.height };
}
function menuHit(p) {
  for (const r of menuRects) if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return r;
  return null;
}
cv.addEventListener('pointerdown', e => {
  ensureAudio();
  const p = canvasPos(e);
  if (screen === 'menu') {
    const r = menuHit(p);
    if (r) { if (r.i < save.unlocked) { sel = r.i; startLevel(r.i); } else lockedPulse(r.i); }
  } else if (screen === 'play') {
    if (introT > 0) introT = 0;
    joy = { id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0 };
    try { cv.setPointerCapture(e.pointerId); } catch {}
  } else if (screen === 'clear') {
    screen = 'menu'; setMusic('menu');
    if (levelIdx + 1 < LEVELS.length) startLevel(levelIdx + 1);
  } else if (screen === 'pause') {
    for (const r of pauseRects) if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { pauseAction(r.a); return; }
    screen = 'play'; // tap anywhere else resumes
  }
});
cv.addEventListener('pointermove', e => {
  const p = canvasPos(e);
  if (screen === 'menu') {
    const r = menuHit(p);
    menuHover = r ? r.i : -1;
    if (r && r.i < save.unlocked) sel = r.i;
  } else if (joy && e.pointerId === joy.id) {
    let dx = (p.x - joy.ox) / 48, dy = (p.y - joy.oy) / 48;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    joy.x = dx; joy.y = dy;
  }
});
const endJoy = e => { if (joy && e.pointerId === joy.id) joy = null; };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);

/* ---------- render ---------- */
const COL = {
  bg: '#141414', floorA: '#e9e9e9', floorB: '#dcdcdc', wall: '#2b2b2b', wallEdge: '#1a1a1a',
  zone: '#7ec850', zoneG: '#9be15d', player: '#d21f26', playerEdge: '#8f1218',
  dot: '#1f4fd2', dotEdge: '#12307f', coin: '#ffd23f', coinEdge: '#c8a000',
  door: '#a06828', doorEdge: '#6e4517', pad: '#3fd2d2', padEdge: '#1a7f8f',
  mover: '#3d3d3d', moverEdge: '#ff9f3f',
  text: '#f2f2f2', dim: '#9a9a9a', lock: '#3a3a3a',
};
function levelOrigin() {
  return { x: Math.floor((STAGE_W - st.P.pxW) / 2), y: Math.floor((STAGE_H - st.P.pxH) / 2) };
}
let vignette = null;
function drawVignette() {
  if (!vignette) {
    vignette = ctx.createRadialGradient(STAGE_W / 2, STAGE_H / 2, 220, STAGE_W / 2, STAGE_H / 2, 620);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
}
function draw() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  if (screen === 'menu') return drawMenu();
  const o = levelOrigin(), T = E.TILE, P = st.P;

  // floor + zones
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const ch = P.grid[y][x];
    if (ch === '#') continue;
    ctx.fillStyle = (x + y) % 2 ? COL.floorA : COL.floorB;
    if (ch === 'S' || ch === 'K') ctx.fillStyle = COL.zone;
    if (ch === 'G') ctx.fillStyle = COL.zoneG;
    if (ch === 'D') ctx.fillStyle = P.doorsOpen ? ((x + y) % 2 ? COL.floorA : COL.floorB) : COL.door;
    if (ch === 'T') ctx.fillStyle = '#bfeeee';
    ctx.fillRect(o.x + x * T, o.y + y * T, T, T);
  }
  // faint grid over open floor
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= P.w; x++) { ctx.moveTo(o.x + x * T + 0.5, o.y); ctx.lineTo(o.x + x * T + 0.5, o.y + P.pxH); }
  for (let y = 0; y <= P.h; y++) { ctx.moveTo(o.x, o.y + y * T + 0.5); ctx.lineTo(o.x + P.pxW, o.y + y * T + 0.5); }
  ctx.stroke();
  // goal pulse
  ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(st.t * 3)})`;
  for (const [gx, gy] of P.zones.goal) ctx.fillRect(o.x + gx * T, o.y + gy * T, T, T);

  // walls
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    if (P.grid[y][x] !== '#') continue;
    ctx.fillStyle = COL.wall; ctx.fillRect(o.x + x * T, o.y + y * T, T, T);
    ctx.fillStyle = COL.wallEdge; ctx.fillRect(o.x + x * T, o.y + y * T, T, 3);
  }
  // doors: closed = barred portcullis, open = floor with side posts
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    if (P.grid[y][x] !== 'D') continue;
    const dx = o.x + x * T, dy = o.y + y * T;
    ctx.fillStyle = COL.doorEdge;
    ctx.fillRect(dx, dy, 3, T); ctx.fillRect(dx + T - 3, dy, 3, T);
    if (P.doorsOpen) continue;
    ctx.fillStyle = '#5a3410';
    for (let s = 0; s < 4; s++) ctx.fillRect(dx + 6 + s * 7, dy + 3, 4, T - 6);
    ctx.fillStyle = COL.doorEdge; ctx.fillRect(dx, dy, T, 3); ctx.fillRect(dx, dy + T - 3, T, 3);
  }
  // checkpoint flags on K tiles
  for (const [kx, ky] of P.zones.check) {
    const active = st.status !== 'dead' &&
      Math.floor((st.respawn.x + 10) / T) === kx && Math.floor((st.respawn.y + 10) / T) === ky;
    const fx = o.x + kx * T + T / 2, fy = o.y + ky * T + 6;
    ctx.strokeStyle = '#2e5d2e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + 20); ctx.stroke();
    const wave = Math.sin(st.t * 4) * 1.5;
    ctx.fillStyle = active ? '#2e7d32' : '#8bc48a';
    ctx.beginPath();
    ctx.moveTo(fx, fy); ctx.lineTo(fx + 12 + wave, fy + 5); ctx.lineTo(fx, fy + 10);
    ctx.closePath(); ctx.fill();
  }
  // movers — sliding wall blocks with direction chevrons
  for (const mv of P.movers) {
    const r = E.moverRect(mv, st.t);
    ctx.fillStyle = COL.mover; ctx.fillRect(o.x + r.x, o.y + r.y, r.w, r.h);
    ctx.strokeStyle = COL.moverEdge; ctx.lineWidth = 2;
    ctx.strokeRect(o.x + r.x + 1, o.y + r.y + 1, r.w - 2, r.h - 2);
    const pr = E.moverRect(mv, st.t - 0.05);
    let vx = r.x - pr.x, vy = r.y - pr.y;
    const vm = Math.hypot(vx, vy);
    if (vm > 0.4) {
      vx /= vm; vy /= vm;
      const cx = o.x + r.x + r.w / 2, cy = o.y + r.y + r.h / 2;
      ctx.fillStyle = COL.moverEdge;
      for (let k = -1; k <= 1; k += 2) {
        const bx = cx + vx * k * 8, by = cy + vy * k * 8;
        ctx.beginPath();
        ctx.moveTo(bx + vx * 5, by + vy * 5);
        ctx.lineTo(bx - vy * 4, by + vx * 4);
        ctx.lineTo(bx + vy * 4, by - vx * 4);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  // teleport pads — counter-rotating swirl
  for (const [tx, ty] of P.telepads) {
    const px = o.x + tx * T + T / 2, py = o.y + ty * T + T / 2, a = st.t * 2.2;
    ctx.strokeStyle = COL.padEdge; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 11, a, a + 4.2); ctx.stroke();
    ctx.strokeStyle = COL.pad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 6, -a * 1.4, -a * 1.4 + 3.6); ctx.stroke();
    ctx.fillStyle = COL.pad;
    ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 7); ctx.fill();
  }
  // coins — pulse + sparkle
  for (const [ci, c] of st.coins.entries()) {
    if (c.taken) continue;
    const r = c.r + Math.sin(st.t * 6 + ci) * 1.2;
    ctx.fillStyle = COL.coinEdge; ctx.beginPath(); ctx.arc(o.x + c.x, o.y + c.y, r + 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coin; ctx.beginPath(); ctx.arc(o.x + c.x, o.y + c.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(o.x + c.x - r * 0.3, o.y + c.y - r * 0.3, r * 0.26, 0, 7); ctx.fill();
  }
  // keys — glyph with pulsing halo
  for (const k of st.keys) {
    if (k.taken) continue;
    const halo = 5 + Math.sin(st.t * 5) * 1.2;
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.beginPath(); ctx.arc(o.x + k.x, o.y + k.y, halo + 4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coinEdge; ctx.beginPath(); ctx.arc(o.x + k.x - 2, o.y + k.y, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coin; ctx.beginPath(); ctx.arc(o.x + k.x - 2, o.y + k.y, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coinEdge; ctx.fillRect(o.x + k.x + 1, o.y + k.y - 1.5, 8, 3);
    ctx.fillRect(o.x + k.x + 6, o.y + k.y + 1, 2, 4); ctx.fillRect(o.x + k.x + 9, o.y + k.y + 1, 2, 4);
  }
  // patrol dots — radial-gradient shine
  for (const d of P.patrols) {
    const p = E.dotPos(d, st.t);
    const px = o.x + p.x, py = o.y + p.y;
    const g = ctx.createRadialGradient(px - d.r * 0.35, py - d.r * 0.35, d.r * 0.15, px, py, d.r + 1.5);
    g.addColorStop(0, '#9fc0ff'); g.addColorStop(0.55, '#3f6fe0'); g.addColorStop(1, COL.dotEdge);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, d.r + 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(px - d.r * 0.35, py - d.r * 0.35, d.r * 0.26, 0, 7); ctx.fill();
  }
  // player trail
  if (st.status !== 'dead') {
    for (const tp of trail) {
      const k = tp.life / 0.22;
      ctx.globalAlpha = k * 0.22;
      const s = st.player.w * (0.45 + 0.55 * k);
      ctx.fillStyle = COL.player;
      ctx.fillRect(o.x + tp.x + (st.player.w - s) / 2, o.y + tp.y + (st.player.h - s) / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL.playerEdge; ctx.fillRect(o.x + st.player.x - 1, o.y + st.player.y - 1, st.player.w + 2, st.player.h + 2);
    ctx.fillStyle = COL.player; ctx.fillRect(o.x + st.player.x, o.y + st.player.y, st.player.w, st.player.h);
  }
  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.col;
    ctx.fillRect(o.x + p.x, o.y + p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;
  drawVignette();
  // joystick hint
  if (joy) {
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 48, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(210,31,38,.5)'; ctx.beginPath(); ctx.arc(joy.ox + joy.x * 36, joy.oy + joy.y * 36, 14, 0, 7); ctx.fill();
  }
  drawHud();
  if (flash) {
    ctx.fillStyle = `rgba(${flash.r},${flash.g},${flash.b},${0.38 * Math.max(0, flash.t / flash.dur)})`;
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
  if (screen === 'pause') drawPause();
  if (introT > 0 && screen === 'play') drawIntro();
  if (screen === 'clear') drawClear();
}
function drawHud() {
  const L = LEVELS[levelIdx];
  const b = save.best[L.id];
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, STAGE_W, 26);
  ctx.fillStyle = COL.text; ctx.font = '13px monospace'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillText(`LVL ${L.id} — ${L.name}`, 10, 14);
  ctx.textAlign = 'center';
  const mid = st.keysTotal > 0 ? `COINS ${st.coinsTotal - st.coinsLeft}/${st.coinsTotal}  KEYS ${st.keysTotal - st.keysLeft}/${st.keysTotal}` : `COINS ${st.coinsTotal - st.coinsLeft}/${st.coinsTotal}`;
  ctx.fillText(mid, STAGE_W / 2, 14);
  ctx.textAlign = 'right';
  const par = (globalThis.HARDEST_PARS || {})[L.id];
  let right = `DEATHS ${st.deaths}   ${st.time.toFixed(1)}s`;
  if (par) right += ` / PAR ${par}s`;
  if (b) right += `   BEST ${b.deaths}d ${b.time.toFixed(1)}s`;
  ctx.fillText(right, STAGE_W - 10, 14);
}
function overlay(title, sub, sub2) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = COL.text; ctx.textAlign = 'center';
  ctx.font = 'bold 42px monospace'; ctx.fillText(title, STAGE_W / 2, STAGE_H / 2 - 20);
  ctx.font = '16px monospace'; ctx.fillStyle = COL.dim; ctx.fillText(sub, STAGE_W / 2, STAGE_H / 2 + 24);
  if (sub2) ctx.fillText(sub2, STAGE_W / 2, STAGE_H / 2 + 46);
}
function drawPause() {
  pauseRects = [];
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = COL.text; ctx.textAlign = 'center';
  ctx.font = 'bold 42px monospace'; ctx.fillText('PAUSED', STAGE_W / 2, STAGE_H / 2 - 70);
  const acts = [['resume', 'RESUME', 'Esc'], ['restart', 'RESTART', 'R'], ['menu', 'MENU', 'Q']];
  const bw = 170, bh = 44, gap = 24;
  let x = (STAGE_W - (acts.length * bw + (acts.length - 1) * gap)) / 2;
  const y = STAGE_H / 2 - 10;
  ctx.font = 'bold 18px monospace';
  for (const [a, label, key] of acts) {
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = '#6f6f6f'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
    ctx.fillStyle = COL.text; ctx.fillText(label, x + bw / 2, y + 20);
    ctx.font = '12px monospace'; ctx.fillStyle = COL.dim; ctx.fillText(key, x + bw / 2, y + 35);
    ctx.font = 'bold 18px monospace';
    pauseRects.push({ x, y, w: bw, h: bh, a });
    x += bw + gap;
  }
  ctx.font = '13px monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText('M mute — tap a button, or anywhere to resume', STAGE_W / 2, y + 78);
}
function drawIntro() {
  const L = LEVELS[levelIdx], tier = tierOf(L.id);
  const par = (globalThis.HARDEST_PARS || {})[L.id];
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COL.dim; ctx.font = '16px monospace';
  ctx.fillText('MOVE TO SKIP', STAGE_W / 2, STAGE_H / 2 - 78);
  ctx.fillStyle = COL.text; ctx.font = 'bold 56px monospace';
  ctx.fillText(`LEVEL ${L.id}`, STAGE_W / 2, STAGE_H / 2 - 26);
  ctx.font = 'bold 26px monospace'; ctx.fillStyle = tier.c;
  ctx.fillText(L.name.toUpperCase(), STAGE_W / 2, STAGE_H / 2 + 16);
  ctx.font = '14px monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText(`${tier.n}${par ? ` · PAR ${par}s` : ''}`, STAGE_W / 2, STAGE_H / 2 + 46);
}
function drawClear() {
  const par = (globalThis.HARDEST_PARS || {})[LEVELS[levelIdx].id];
  const parTxt = par ? ` · par ${par}s ${st.time <= par ? 'BEATEN' : 'missed'}` : '';
  const medal = medalFor(st.deaths);
  overlay('LEVEL CLEAR', `deaths ${st.deaths} · time ${st.time.toFixed(1)}s${parTxt}`, 'Enter / tap — next level · Esc — menu');
  // medal reveal
  const mc = MEDAL_COL[medal];
  ctx.textAlign = 'center';
  ctx.fillStyle = mc;
  ctx.beginPath(); ctx.arc(STAGE_W / 2, STAGE_H / 2 - 88, 22, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(STAGE_W / 2, STAGE_H / 2 - 88, 22, 0, 7); ctx.stroke();
  ctx.fillStyle = mc; ctx.font = 'bold 16px monospace';
  ctx.fillText(`${medal.toUpperCase()} MEDAL`, STAGE_W / 2, STAGE_H / 2 - 48);
}
function drawMenu() {
  ctx.fillStyle = COL.text; ctx.textAlign = 'center';
  ctx.font = 'bold 38px monospace'; ctx.fillText("THE WORLD'S CRUELEST GAME", STAGE_W / 2, 56);
  ctx.font = '13px monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText('arrows/WASD move · grab every coin · reach green · blue kills · R restart · M mute', STAGE_W / 2, 86);
  // progress summary
  const medals = { gold: 0, silver: 0, bronze: 0 };
  let cleared = 0;
  for (const L of LEVELS) { const b = save.best[L.id]; if (b) { cleared++; medals[b.medal]++; } }
  ctx.fillStyle = COL.text;
  ctx.fillText(`CLEARED ${cleared}/${LEVELS.length}   GOLD ${medals.gold}   SILVER ${medals.silver}   BRONZE ${medals.bronze}   TOTAL DEATHS ${save.deaths}`, STAGE_W / 2, 108);
  // tier legend — two centered rows of 4
  {
    ctx.font = '10px monospace';
    const rows = [TIERS.slice(0, 4), TIERS.slice(4)];
    rows.forEach((row, ri) => {
      const w = row.length * 110;
      let lx = STAGE_W / 2 - w / 2;
      for (const [, c, n] of row) {
        ctx.fillStyle = c; ctx.fillRect(lx, 122 + ri * 14, 8, 8);
        ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.fillText(n, lx + 11, 127 + ri * 14);
        lx += 110;
      }
    });
    ctx.textAlign = 'center';
  }
  menuRects = [];
  const cols = MENU_COLS, bw = 44, bh = 34, gx = 6, gy = 6;
  const x0 = (STAGE_W - cols * bw - (cols - 1) * gx) / 2, y0 = 154;
  for (let i = 0; i < LEVELS.length; i++) {
    const r = i % cols, q = Math.floor(i / cols);
    const x = x0 + r * (bw + gx), y = y0 + q * (bh + gy);
    const locked = i >= save.unlocked;
    const hot = i === sel || i === menuHover;
    menuRects.push({ x, y, w: bw, h: bh, i });
    ctx.fillStyle = locked ? COL.lock : (hot ? '#3f6fd8' : '#2b2b2b');
    ctx.fillRect(x, y, bw, bh);
    if (hot && !locked) { ctx.strokeStyle = COL.coin; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2); }
    if (locked) { // drawn padlock — emoji glyph missing on some systems
      ctx.fillStyle = '#555';
      ctx.fillRect(x + bw / 2 - 6, y + 12, 12, 10);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + bw / 2, y + 12, 4, Math.PI, 0); ctx.stroke();
    } else {
      ctx.fillStyle = tierOf(LEVELS[i].id).c;
      ctx.font = 'bold 15px monospace'; ctx.fillText(String(LEVELS[i].id), x + bw / 2, y + 16);
    }
    const b = save.best[LEVELS[i].id];
    if (b && b.medal) { ctx.fillStyle = MEDAL_COL[b.medal] || MEDAL_COL.bronze; ctx.beginPath(); ctx.arc(x + bw - 7, y + 7, 4, 0, 7); ctx.fill(); }
    ctx.font = '9px monospace'; ctx.fillStyle = locked ? '#555' : COL.dim;
    ctx.fillText(b ? `${b.deaths}d ${b.time.toFixed(0)}s` : (locked ? '' : '—'), x + bw / 2, y + 30);
    if (lockedFlash && lockedFlash.i === i) {
      ctx.strokeStyle = `rgba(210,31,38,${Math.max(0, lockedFlash.t / 0.6)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 2, y - 2, bw + 4, bh + 4);
    }
  }
  // footer: selected/hovered level info + nav hints
  const info = Math.max(menuHover, sel);
  ctx.font = '14px monospace';
  if (info >= 0 && LEVELS[info]) {
    const L = LEVELS[info], b = save.best[L.id], tier = tierOf(L.id);
    const bestTxt = b ? ` — BEST ${b.deaths}d ${b.time.toFixed(1)}s (${b.medal.toUpperCase()})` : '';
    ctx.fillStyle = COL.text;
    ctx.fillText(`${L.id} · ${L.name.toUpperCase()} · ${tier.n}${bestTxt}`, STAGE_W / 2, 508);
  }
  ctx.font = '12px monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText('ENTER play · N next unplayed · M mute', STAGE_W / 2, 532);
}

/* ---------- loop ---------- */
let acc = 0, last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
  if (screen === 'play' && introT > 0) { introT = Math.max(0, introT - dt); draw(); return; }
  if (screen === 'play') {
    acc += dt;
    const input = axis();
    while (acc >= E.STEP) { E.step(st, input, E.STEP); acc -= E.STEP; }
    // trail sample
    if (st.status === 'play') trail.push({ x: st.player.x, y: st.player.y, life: 0.22 });
    if (trail.length > 26) trail.shift();
    if (st.status === 'dead' && prevStatus === 'play') {
      coinStreak = 0;
      beep(320, 0.2, 'sawtooth', 0.09, 55);
      beep(140, 0.26, 'square', 0.06, 38);
      flash = { r: 210, g: 31, b: 38, t: 0.3, dur: 0.3 };
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * 6.283, v = 70 + Math.random() * 190;
        particles.push({ x: st.player.x + st.player.w / 2, y: st.player.y + st.player.h / 2,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 2.5 + Math.random() * 3.5, life: 0.5, max: 0.5,
          col: Math.random() < 0.6 ? COL.player : '#ffffff' });
      }
    }
    if (st.coinsLeft < prevCoins) {
      const f = 660 * Math.pow(1.1225, Math.min(12, coinStreak++));
      beep(f, 0.09, 'square', 0.05); beep(f * 2, 0.05, 'sine', 0.02);
      const got = st.coins.filter(c => c.taken)[st.coinsTotal - st.coinsLeft - 1];
      if (got) for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.283, v = 30 + Math.random() * 70;
        particles.push({ x: got.x, y: got.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
          s: 2 + Math.random() * 2.5, life: 0.35, max: 0.35, col: COL.coin });
      }
    }
    if (st.keysLeft < prevKeys) beep(660, 0.12, 'triangle', 0.06);
    if (st.P.doorsOpen && !prevDoors) beep(220, 0.3, 'triangle', 0.06, 440);
    if (st.teleports > prevTps) {
      beep(440, 0.15, 'sine', 0.06, 880);
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.283, v = 40 + Math.random() * 60;
        particles.push({ x: st.player.x + 10, y: st.player.y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          s: 2 + Math.random() * 2, life: 0.3, max: 0.3, col: COL.pad });
      }
    }
    prevCoins = st.coinsLeft; prevKeys = st.keysLeft; prevTps = st.teleports; prevDoors = st.P.doorsOpen;
    prevStatus = st.status;
    if (st.status === 'clear') {
      const L = LEVELS[levelIdx];
      save.deaths += st.deaths;
      save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIdx + 2));
      const b = save.best[L.id];
      if (!b || st.deaths < b.deaths || (st.deaths === b.deaths && st.time < b.time)) save.best[L.id] = { deaths: st.deaths, time: st.time, medal: medalFor(st.deaths) };
      persist();
      flash = { r: 60, g: 200, b: 80, t: 0.35, dur: 0.35 };
      beep(523, 0.12, 'square', 0.05);
      setTimeout(() => beep(659, 0.12, 'square', 0.05), 110);
      setTimeout(() => beep(784, 0.16, 'square', 0.05), 220);
      setTimeout(() => beep(1047, 0.24, 'square', 0.05), 330);
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * 6.283, v = 60 + Math.random() * 150;
        particles.push({ x: st.player.x + 10, y: st.player.y + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          s: 2.5 + Math.random() * 3, life: 0.5, max: 0.5, col: '#3fd25a' });
      }
      screen = 'clear';
    }
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const t of trail) t.life -= dt;
  trail = trail.filter(t => t.life > 0);
  if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
  if (lockedFlash) { lockedFlash.t -= dt; if (lockedFlash.t <= 0) lockedFlash = null; }
  draw();
}

/* ---------- boot + probe hooks ---------- */
function boot() {
  if (!levelsReady()) return setTimeout(boot, 30);
  collectLevels();
  setMusic('menu');
  requestAnimationFrame(frame);
}
globalThis.__hardest = {
  state: () => ({ screen, level: LEVELS[levelIdx] && LEVELS[levelIdx].id, status: st && st.status, deaths: st && st.deaths, coinsLeft: st && st.coinsLeft, keysLeft: st && st.keysLeft, teleports: st && st.teleports, doorsOpen: st && st.P.doorsOpen, time: st && st.time, unlocked: save.unlocked, levels: LEVELS.length, coinsTotal: st && st.coinsTotal, keysTotal: st && st.keysTotal, muted: save.mute, best: LEVELS[levelIdx] && save.best[LEVELS[levelIdx].id] || null, intro: introT }),
  start: i => startLevel(i),
  input: (x, y) => { if (introT > 0) introT = 0; joy = { id: -1, ox: 0, oy: 0, x, y }; }, // probe-only drive
  engine: () => st,
};
if (new URLSearchParams(location.search).has('debug')) {
  globalThis.__maga = Object.freeze({
    get screen() { return screen; },
    get state() { return globalThis.__hardest.state(); },
    get engine() { return st; },
    get save() { return JSON.parse(JSON.stringify(save)); },
    get music() { return music.mode; },
    get muted() { return save.mute; },
    start: i => startLevel(i),
    input: (x, y) => { if (introT > 0) introT = 0; joy = { id: -1, ox: 0, oy: 0, x, y }; },
  });
}
boot();
})();
