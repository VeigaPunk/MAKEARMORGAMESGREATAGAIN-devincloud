/* hardest/game.js — browser shell: canvas render, input, level select, save.
 * All game logic lives in engine.js; this file only draws and feeds input. */
(function () {
'use strict';
const E = globalThis.HardestEngine;
const STAGE_W = 960, STAGE_H = 576;
const SAVE_KEY = 'hardest.save.v1';
const MENU_COLS = 16;

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
cv.width = STAGE_W; cv.height = STAGE_H;

/* ---------- save ---------- */
function loadSave() {
  try { return HardestSave.sanitize(JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
  catch { return { unlocked: 1, best: {}, deaths: 0, mute: false }; }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }
let save = loadSave();

/* ---------- audio (WebAudio blips, no assets; M mutes) ---------- */
let AC = null;
function beep(f, d, type, g, slide) {
  if (save.mute) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + d);
    gn.gain.value = g || 0.05;
    gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
    o.connect(gn); gn.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + d);
  } catch {}
}

/* ---------- medals + tiers ---------- */
const medalFor = HardestSave.medal;
const MEDAL_COL = { gold: '#ffd36a', silver: '#c9d8ed', bronze: '#d69b71' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
}

/* ---------- input ---------- */
const keys = new Set();
const AXIS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
let joy = null; // {id, ox, oy, x, y}
addEventListener('keydown', e => {
  if (e.target instanceof HTMLElement && e.target.closest('select')) return;
  if (e.target instanceof HTMLElement && e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return;
  if (AXIS[e.code] || ['Space', 'Enter', 'Escape', 'KeyR', 'KeyM', 'KeyQ'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  onKey(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
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
let particles = [];
let flash = 0, flashColor = '#f45059', intro = 0;
let seenDeaths = 0;
const statusEl = document.getElementById('status');
const picker = document.getElementById('picker'), levelChoice = document.getElementById('level-choice');
let pickerStamp = '';
function updatePicker() {
  picker.hidden = screen !== 'menu';
  document.querySelector('main').dataset.screen = screen;
  if (screen !== 'menu') return;
  const stamp = `${save.unlocked}:${Object.keys(save.best).length}`;
  if (stamp !== pickerStamp) {
    pickerStamp = stamp; levelChoice.replaceChildren();
    LEVELS.forEach((L, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = `${L.id}. ${L.name}${save.best[L.id] ? ' · ' + save.best[L.id].medal : ''}${i >= save.unlocked ? ' · locked' : ''}`; option.disabled = i >= save.unlocked; levelChoice.append(option); });
  }
  if (levelChoice.value !== String(sel)) levelChoice.value = String(sel);
  document.getElementById('play-level').disabled = sel >= save.unlocked;
}
levelChoice.addEventListener('change', () => { sel = Number(levelChoice.value); });
document.getElementById('play-level').addEventListener('click', () => { if (sel < save.unlocked) startLevel(sel); });
const controls = Object.fromEntries(['levels', 'pause', 'restart', 'sound'].map(id => [id, document.getElementById(id)]));
function announce(text) { statusEl.textContent = text; }
function releaseInput() { keys.clear(); joy = null; acc = 0; }
function showMenu() { cv.focus({ preventScroll: true }); releaseInput(); screen = 'menu'; sel = levelIdx; announce('Level select. Arrow keys choose a level; Enter starts.'); }
function togglePause() {
  if (screen !== 'play' && screen !== 'pause') return;
  cv.focus({ preventScroll: true });
  screen = screen === 'play' ? 'pause' : 'play'; releaseInput();
  announce(screen === 'pause' ? 'Paused. Resume, restart, or choose Levels.' : 'Resumed.');
}
function toggleSound() { cv.focus({ preventScroll: true }); save.mute = !save.mute; persist(); if (!save.mute) beep(440, .08, 'sine', .03); }
controls.levels.addEventListener('click', showMenu);
controls.pause.addEventListener('click', togglePause);
controls.restart.addEventListener('click', () => { if (st) startLevel(levelIdx); });
controls.sound.addEventListener('click', toggleSound);
addEventListener('blur', () => { releaseInput(); if (screen === 'play') { screen = 'pause'; announce('Paused while the game was out of focus.'); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseInput(); if (screen === 'play') screen = 'pause'; } });
let menuRects = [];
let prevCoins = 0, prevKeys = 0, prevTps = 0, prevDoors = true;

function startLevel(i) {
  if (!Number.isInteger(i) || i < 0 || i >= LEVELS.length) return;
  cv.focus({ preventScroll: true });
  releaseInput();
  levelIdx = i;
  st = E.create(LEVELS[i]);
  screen = 'play';
  particles = []; flash = 0; intro = 1.8; seenDeaths = 0;
  announce(`Level ${LEVELS[i].id}: ${LEVELS[i].name}. Collect ${st.coinsTotal} coins and reach green.`);
  prevCoins = st.coinsLeft; prevKeys = st.keysLeft; prevTps = 0; prevDoors = st.P.doorsOpen;
}
function onKey(code) {
  if (code === 'KeyM') { toggleSound(); return; }
  if (screen === 'menu') {
    if (code === 'ArrowRight' || code === 'KeyD') sel = Math.min(LEVELS.length - 1, sel + 1);
    if (code === 'ArrowLeft' || code === 'KeyA') sel = Math.max(0, sel - 1);
    if (code === 'ArrowDown' || code === 'KeyS') sel = Math.min(LEVELS.length - 1, sel + MENU_COLS);
    if (code === 'ArrowUp' || code === 'KeyW') sel = Math.max(0, sel - MENU_COLS);
    if (AXIS[code] && LEVELS[sel]) announce(`Level ${LEVELS[sel].id}: ${LEVELS[sel].name}. ${sel < save.unlocked ? 'Enter to play.' : 'Locked.'}`);
    if (code === 'Enter' || code === 'Space') { if (sel < save.unlocked) startLevel(sel); }
  } else if (screen === 'play') {
    if (code === 'Escape') togglePause();
    if (code === 'KeyR') startLevel(levelIdx);
  } else if (screen === 'pause') {
    if (code === 'Escape') togglePause();
    if (code === 'KeyQ') showMenu();
    if (code === 'KeyR') startLevel(levelIdx);
  } else if (screen === 'clear') {
    if (code === 'Enter' || code === 'Space') {
      showMenu();
      if (levelIdx + 1 < LEVELS.length) startLevel(levelIdx + 1);
    }
    if (code === 'Escape') showMenu();
  }
}

/* pointer: menu taps + in-game joystick */
function canvasPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * STAGE_W / r.width, y: (e.clientY - r.top) * STAGE_H / r.height };
}
cv.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  cv.focus({ preventScroll: true });
  const p = canvasPos(e);
  if (screen === 'menu') {
    for (const r of menuRects) if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      if (r.i < save.unlocked) startLevel(r.i);
      return;
    }
  } else if (screen === 'play' && !joy) {
    joy = { id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0 };
    cv.setPointerCapture(e.pointerId);
  } else if (screen === 'clear') {
    showMenu();
    if (levelIdx + 1 < LEVELS.length) startLevel(levelIdx + 1);
  } else if (screen === 'pause') {
    togglePause();
  }
});
cv.addEventListener('pointermove', e => {
  if (screen === 'menu' && e.pointerType === 'mouse') {
    const p = canvasPos(e); const r = menuRects.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (r) sel = r.i;
    cv.style.cursor = r && r.i < save.unlocked ? 'pointer' : 'default';
  }
  if (joy && e.pointerId === joy.id) {
    const p = canvasPos(e);
    let dx = (p.x - joy.ox) / 48, dy = (p.y - joy.oy) / 48;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    joy.x = dx; joy.y = dy;
  }
});
const endJoy = e => { if (joy && e.pointerId === joy.id) joy = null; };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);
cv.addEventListener('lostpointercapture', endJoy);

/* ---------- render ---------- */
const COL = {
  bg: '#11151c', floorA: '#e9e9e9', floorB: '#dcdcdc', wall: '#2b2b2b', wallEdge: '#1a1a1a',
  zone: '#7ec850', zoneG: '#9be15d', player: '#d21f26', playerEdge: '#8f1218',
  dot: '#1f4fd2', dotEdge: '#12307f', coin: '#ffd23f', coinEdge: '#c8a000',
  door: '#a06828', doorEdge: '#6e4517', pad: '#3fd2d2', padEdge: '#1a7f8f',
  mover: '#3d3d3d', moverEdge: '#ff9f3f',
  text: '#f2f2f2', dim: '#9a9a9a', lock: '#3a3a3a',
};
function levelOrigin() {
  return { x: Math.floor((STAGE_W - st.P.pxW) / 2), y: Math.floor((STAGE_H - st.P.pxH) / 2) };
}
function draw() {
  updatePicker();
  controls.pause.disabled = screen !== 'play' && screen !== 'pause';
  controls.pause.textContent = screen === 'pause' ? 'Resume' : 'Pause';
  controls.restart.disabled = !st || screen === 'menu';
  controls.sound.textContent = save.mute ? 'Sound off' : 'Sound on';
  controls.sound.setAttribute('aria-pressed', String(save.mute));
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = '#1b2330'; ctx.lineWidth = 1;
  for (let x = 0; x < STAGE_W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, STAGE_H); ctx.stroke(); }
  for (let y = 0; y < STAGE_H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(STAGE_W, y); ctx.stroke(); }
  if (screen === 'menu') return drawMenu();
  cv.style.cursor = 'default';
  const o = levelOrigin(), T = E.TILE, P = st.P;
  // floor + zones + doors + pads
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const ch = P.grid[y][x];
    if (ch === '#') continue;
    ctx.fillStyle = (x + y) % 2 ? COL.floorA : COL.floorB;
    if (ch === 'S' || ch === 'K') ctx.fillStyle = COL.zone;
    if (ch === 'G') ctx.fillStyle = st.coinsLeft ? '#63965b' : COL.zoneG;
    if (ch === 'D') ctx.fillStyle = st.P.doorsOpen ? COL.floorA : COL.door;
    if (ch === 'T') ctx.fillStyle = '#bfeeee';
    ctx.fillRect(o.x + x * T, o.y + y * T, T, T);
    if (ch === 'K') {
      ctx.fillStyle = '#275e35'; ctx.fillRect(o.x + x * T + 10, o.y + y * T + 7, 2, 19);
      ctx.beginPath(); ctx.moveTo(o.x + x * T + 12, o.y + y * T + 7); ctx.lineTo(o.x + x * T + 24, o.y + y * T + 12); ctx.lineTo(o.x + x * T + 12, o.y + y * T + 17); ctx.fill();
    }
    if (ch === 'G') { ctx.fillStyle = '#255c32'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText(st.coinsLeft ? '·' : '✓', o.x + x * T + 16, o.y + y * T + 22); }
  }
  // walls
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    if (P.grid[y][x] !== '#') continue;
    ctx.fillStyle = COL.wall; ctx.fillRect(o.x + x * T, o.y + y * T, T, T);
    ctx.fillStyle = COL.wallEdge; ctx.fillRect(o.x + x * T, o.y + y * T, T, 3);
  }
  // closed doors get a frame so they read as doors, not walls
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    if (P.grid[y][x] !== 'D' || st.P.doorsOpen) continue;
    ctx.fillStyle = COL.doorEdge;
    ctx.fillRect(o.x + x * T, o.y + y * T, T, 3);
    ctx.fillRect(o.x + x * T, o.y + y * T + T - 3, T, 3);
  }
  // movers — sliding wall blocks (wall-dark body, hazard-orange edge + stripe)
  for (const mv of P.movers) {
    const r = E.moverRect(mv, st.t);
    ctx.fillStyle = COL.mover; ctx.fillRect(o.x + r.x, o.y + r.y, r.w, r.h);
    ctx.strokeStyle = COL.moverEdge; ctx.lineWidth = 2;
    ctx.strokeRect(o.x + r.x + 1, o.y + r.y + 1, r.w - 2, r.h - 2);
    ctx.fillStyle = COL.moverEdge;
    if (r.w >= r.h) ctx.fillRect(o.x + r.x + r.w / 2 - 1, o.y + r.y + 4, 2, r.h - 8);
    else ctx.fillRect(o.x + r.x + 4, o.y + r.y + r.h / 2 - 1, r.w - 8, 2);
  }
  // teleport pads
  for (const [tx, ty] of P.telepads) {
    const px = o.x + tx * T + T / 2, py = o.y + ty * T + T / 2;
    ctx.strokeStyle = COL.padEdge; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.stroke();
    ctx.strokeStyle = COL.pad; ctx.lineWidth = 2;
    const spin = reducedMotion ? 0 : st.t * 2;
    ctx.beginPath(); ctx.arc(px, py, 6, spin, spin + Math.PI * 1.5); ctx.stroke();
  }
  // coins
  for (const c of st.coins) {
    if (c.taken) continue;
    ctx.fillStyle = COL.coinEdge; ctx.beginPath(); ctx.arc(o.x + c.x, o.y + c.y, c.r + 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coin; ctx.beginPath(); ctx.arc(o.x + c.x, o.y + c.y, c.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff2b7'; ctx.fillRect(o.x + c.x - 2, o.y + c.y - 4, 2, 6);
    if (!reducedMotion) { ctx.globalAlpha = .3 + .2 * Math.sin(st.t * 4 + c.tx); ctx.strokeStyle = '#ffcb38'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o.x + c.x, o.y + c.y, c.r + 4, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // keys
  for (const k of st.keys) {
    if (k.taken) continue;
    ctx.fillStyle = COL.coinEdge; ctx.beginPath(); ctx.arc(o.x + k.x - 2, o.y + k.y, 4.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coin; ctx.beginPath(); ctx.arc(o.x + k.x - 2, o.y + k.y, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.coinEdge; ctx.fillRect(o.x + k.x + 1, o.y + k.y - 1.5, 8, 3);
    ctx.fillRect(o.x + k.x + 6, o.y + k.y + 1, 2, 4); ctx.fillRect(o.x + k.x + 9, o.y + k.y + 1, 2, 4);
  }
  // dots
  for (const d of P.patrols) {
    const p = E.dotPos(d, st.t);
    ctx.fillStyle = COL.dotEdge; ctx.beginPath(); ctx.arc(o.x + p.x, o.y + p.y, d.r + 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.dot; ctx.beginPath(); ctx.arc(o.x + p.x, o.y + p.y, d.r, 0, 7); ctx.fill();
    ctx.fillStyle = '#a7c3ff'; ctx.beginPath(); ctx.arc(o.x + p.x - 2, o.y + p.y - 2, 1.7, 0, 7); ctx.fill();
  }
  // player
  if (st.status !== 'dead') {
    ctx.fillStyle = COL.playerEdge; ctx.fillRect(o.x + st.player.x - 1, o.y + st.player.y - 1, st.player.w + 2, st.player.h + 2);
    ctx.fillStyle = COL.player; ctx.fillRect(o.x + st.player.x, o.y + st.player.y, st.player.w, st.player.h);
  }
  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.4);
    ctx.fillStyle = p.color || COL.player;
    ctx.fillRect(o.x + p.x, o.y + p.y, p.s, p.s);
  }
  ctx.globalAlpha = 1;
  // joystick hint
  if (joy) {
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 48, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(210,31,38,.5)'; ctx.beginPath(); ctx.arc(joy.ox + joy.x * 36, joy.oy + joy.y * 36, 14, 0, 7); ctx.fill();
  }
  if (flash > 0 && !reducedMotion) { ctx.globalAlpha = flash * .3; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, STAGE_W, STAGE_H); ctx.globalAlpha = 1; }
  drawHud();
  if (intro > 0 && screen === 'play') { ctx.globalAlpha = Math.min(1, intro); ctx.fillStyle = '#101722e8'; ctx.fillRect(260, 510, 440, 34); ctx.fillStyle = '#e7eef9'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${LEVELS[levelIdx].id} / ${LEVELS.length}  ·  ${LEVELS[levelIdx].name}`, 480, 532); ctx.globalAlpha = 1; }
  if (screen === 'pause') overlay('TAKE A BREATH', 'Esc / tap resume · R restart · Q level select');
  if (screen === 'clear') {
    const par = (globalThis.HARDEST_PARS || {})[LEVELS[levelIdx].id];
    const parTxt = par ? ` · par ${par}s ${st.time <= par ? 'BEATEN' : 'missed'}` : '';
    overlay(levelIdx + 1 === LEVELS.length ? 'ALL 114 LEVELS CLEARED' : `LEVEL CLEAR — ${medalFor(st.deaths).toUpperCase()}`, `deaths ${st.deaths} · time ${st.time.toFixed(1)}s${parTxt} — ${levelIdx + 1 < LEVELS.length ? 'Enter / tap for next' : 'Enter / tap for levels'}`);
  }
}
function drawHud() {
  const L = LEVELS[levelIdx];
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, STAGE_W, 26);
  ctx.fillStyle = COL.text; ctx.font = '14px monospace'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillText(`LVL ${L.id} — ${L.name}`, 10, 14);
  ctx.textAlign = 'center';
  const mid = st.keysTotal > 0 ? `COINS ${st.coinsTotal - st.coinsLeft}/${st.coinsTotal}  KEYS ${st.keysTotal - st.keysLeft}/${st.keysTotal}` : `COINS ${st.coinsTotal - st.coinsLeft}/${st.coinsTotal}`;
  ctx.fillText(mid, STAGE_W / 2, 14);
  ctx.textAlign = 'right';
  const par = (globalThis.HARDEST_PARS || {})[L.id];
  ctx.fillText(`DEATHS ${st.deaths}   ${st.time.toFixed(1)}s${par ? ` / PAR ${par}s` : ''}`, STAGE_W - 10, 14);
}
function overlay(title, sub) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = COL.text; ctx.textAlign = 'center';
  ctx.font = 'bold 36px monospace'; ctx.fillText(title, STAGE_W / 2, STAGE_H / 2 - 20);
  ctx.font = '14px monospace'; ctx.fillStyle = COL.dim; ctx.fillText(sub, STAGE_W / 2, STAGE_H / 2 + 24);
}
function drawMenu() {
  ctx.fillStyle = COL.text; ctx.textAlign = 'center';
  ctx.font = 'bold 40px monospace'; ctx.fillText("THE WORLD'S HARDEST GAME", STAGE_W / 2, 60);
  ctx.font = '14px monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText('arrows/WASD move · grab every coin · reach green · blue kills · R restart · M mute', STAGE_W / 2, 92);
  const completed = Object.keys(save.best).length;
  ctx.fillText(`${completed} / ${LEVELS.length} CLEARED   ·   ${save.deaths} TOTAL DEATHS   ·   ${save.mute ? 'SOUND OFF' : 'SOUND ON'}`, STAGE_W / 2, 114);
  ctx.fillStyle = '#283447'; ctx.fillRect(300, 120, 360, 3); ctx.fillStyle = '#79d99b'; ctx.fillRect(300, 120, 360 * completed / LEVELS.length, 3);
  // tier legend — two centered rows of 4
  {
    ctx.font = '10px monospace';
    const activeTiers = TIERS.filter(([, , name]) => LEVELS.some(L => tierOf(L.id).n === name));
    const rows = [activeTiers.slice(0, 4), activeTiers.slice(4)];
    rows.forEach((row, ri) => {
      const w = row.length * 110;
      let lx = STAGE_W / 2 - w / 2;
      for (const [, c, n] of row) {
        ctx.fillStyle = c; ctx.fillRect(lx, 128 + ri * 14, 8, 8);
        ctx.fillStyle = COL.dim; ctx.textAlign = 'left'; ctx.fillText(n, lx + 11, 133 + ri * 14);
        lx += 110;
      }
    });
    ctx.textAlign = 'center';
  }
  menuRects = [];
  const cols = MENU_COLS, bw = 44, bh = 34, gx = 6, gy = 6;
  const x0 = (STAGE_W - cols * bw - (cols - 1) * gx) / 2, y0 = 156;
  for (let i = 0; i < LEVELS.length; i++) {
    const r = i % cols, q = Math.floor(i / cols);
    const x = x0 + r * (bw + gx), y = y0 + q * (bh + gy);
    const locked = i >= save.unlocked;
    menuRects.push({ x, y, w: bw, h: bh, i });
    ctx.fillStyle = locked ? COL.lock : (i === sel ? '#3f6fd8' : '#2b2b2b');
    ctx.fillRect(x, y, bw, bh);
    if (i === sel && !locked) { ctx.strokeStyle = COL.coin; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2); }
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
    if (b && b.medal) { ctx.fillStyle = MEDAL_COL[b.medal]; ctx.beginPath(); ctx.arc(x + bw - 7, y + 7, 4, 0, 7); ctx.fill(); }
    ctx.font = '9px monospace'; ctx.fillStyle = locked ? '#555' : COL.dim;
    ctx.fillText(b ? `${b.deaths}d ${b.bestTime.toFixed(0)}s` : (locked ? '' : '—'), x + bw / 2, y + 30);
  }
  const chosen = LEVELS[sel];
  if (chosen) {
    const tier = tierOf(chosen.id), best = save.best[chosen.id];
    ctx.textAlign = 'center'; ctx.fillStyle = tier.c; ctx.font = 'bold 18px monospace';
    ctx.fillText(`${String(chosen.id).padStart(2, '0')}  ${chosen.name}`, STAGE_W / 2, 514);
    ctx.fillStyle = COL.dim; ctx.font = '12px monospace';
    ctx.fillText(sel >= save.unlocked ? 'Clear the previous level to unlock this challenge.' : `${tier.n}  ·  ${best ? `Best ${best.deaths} deaths · fastest ${best.bestTime.toFixed(1)}s` : 'Your next challenge'}  ·  Enter / tap to play`, STAGE_W / 2, 540);
  }
}

/* ---------- loop ---------- */
let acc = 0, last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
  flash = Math.max(0, flash - dt * 4); intro = Math.max(0, intro - dt);
  if (screen === 'play') {
    acc += dt;
    const input = axis();
    while (acc + 1e-9 >= E.STEP) { E.step(st, input, E.STEP); acc = Math.max(0, acc - E.STEP); }
    if (st.deaths > seenDeaths) {
      save.deaths += st.deaths - seenDeaths; seenDeaths = st.deaths; persist();
      flash = 1; flashColor = '#e73845';
      beep(160, 0.18, 'sawtooth', 0.06, 60);
      if (!reducedMotion) for (let i = 0; i < 14; i++) {
        const a = Math.random() * 6.283, v = 60 + Math.random() * 140;
        particles.push({ x: st.player.x + st.player.w / 2, y: st.player.y + st.player.h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 3 + Math.random() * 3, life: 0.4 });
      }
    }
    if (st.coinsLeft < prevCoins) {
      beep(660 * Math.pow(1.06, Math.min(20, st.coinsTotal - st.coinsLeft)), 0.12, 'sine', 0.06);
      if (!reducedMotion) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; particles.push({ x: st.player.x + 10, y: st.player.y + 10, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, s: 3, life: .35, color: COL.coin }); }
      if (!st.coinsLeft) announce('All coins collected. Reach the green goal.');
    }
    if (st.keysLeft < prevKeys) beep(660, 0.12, 'triangle', 0.06);
    if (st.P.doorsOpen && !prevDoors) beep(220, 0.3, 'triangle', 0.06, 440);
    if (st.teleports > prevTps) beep(440, 0.15, 'sine', 0.06, 880);
    prevCoins = st.coinsLeft; prevKeys = st.keysLeft; prevTps = st.teleports; prevDoors = st.P.doorsOpen;
    if (st.status === 'clear') {
      const L = LEVELS[levelIdx];
      HardestSave.record(save, L.id, st.deaths, st.time, LEVELS.length);
      flash = 1; flashColor = '#79d99b';
      announce(`Level ${L.id} clear. ${medalFor(st.deaths)} medal, ${st.deaths} deaths, ${st.time.toFixed(1)} seconds. Enter or tap to continue.`);
      releaseInput();
      persist();
      beep(523, 0.12, 'square', 0.05); setTimeout(() => beep(659, 0.12, 'square', 0.05), 110); setTimeout(() => beep(784, 0.2, 'square', 0.05), 220);
      screen = 'clear';
    }
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  draw();
}

/* ---------- boot + probe hook ---------- */
function boot() {
  if (!levelsReady()) return setTimeout(boot, 30);
  collectLevels();
  save = HardestSave.sanitize(save, LEVELS.length); persist();
  sel = Math.min(LEVELS.length - 1, save.unlocked - 1);
  announce(`${LEVELS.length} levels ready. Arrow keys choose a level; Enter starts.`);
  requestAnimationFrame(frame);
}
globalThis.__hardest = {
  state: () => ({ screen, level: LEVELS[levelIdx] && LEVELS[levelIdx].id, status: st && st.status, deaths: st && st.deaths, coinsLeft: st && st.coinsLeft, keysLeft: st && st.keysLeft, teleports: st && st.teleports, doorsOpen: st && st.P.doorsOpen, time: st && st.time, unlocked: save.unlocked, levels: LEVELS.length }),
  start: i => startLevel(i),
  input: (x, y) => { joy = { id: -1, ox: 0, oy: 0, x, y }; }, // probe-only drive
  engine: () => st,
};
boot();
})();
