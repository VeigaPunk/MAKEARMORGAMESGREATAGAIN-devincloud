import { Input, Sfx, fitIntegerScale, letterboxOffset, viewport, load, save } from '@maga/arcade-core';


/**
 * The Impossible Game — Lite-faithful native replica (Canvas2D).
 * Physics ported 1:1 from maga-proto's verified mechanics proof
 * (prototypes/impossible-game.html). All constants are DECLARED GUESSES —
 * hitbox/buffer/geometry TBD from ARCADE playtest; do not treat as measured.
 * Music-locked timing (AudioSyncClock) deferred: no licensed track exists yet.
 */

// ---- tunables (TBD from ARCADE playtest — declared, not measured) ----
const DT = 1 / 120;            // fixed timestep (spec: fixed timestep suggested)
const SPEED = 360;             // px/s auto-run
const GRAV = 2600;             // px/s^2
const JUMP_V = 880;            // fixed impulse — no variable height (spec)
const CUBE = 34;               // hitbox edge (TBD)
const JUMP_BUFFER = 0.10;      // s — press slightly early still jumps (TBD)
const COYOTE = 0.06;           // s — leave edge, still jump (TBD)
const RESPAWN_MS = 160;        // spec: death -> respawn <=200ms feel
const GROUND_Y = 430;
const W = 960;
const H = 540;
const BADGE_H = 22;
// measured live — the badge wraps on narrow screens (RT-3/RT-4)
const badgeEl = document.querySelector<HTMLElement>('.badge');
const muteBtn = document.getElementById('mute');

// ---- level as data: [type, x, w, h?] — spike kills, block lands-on-top/side-kills, gap = no floor ----
// Declared-guess geometry (proto vocabulary); ARCADE replaces with measured Lite layout.
type Obstacle = [type: 'gap' | 'spike' | 'block', x: number, w: number, h?: number];
const LEVEL: Obstacle[] = [
  ['gap',   1400, 130],
  ['spike', 1900, 40],
  ['spike', 2400, 40], ['spike', 2440, 40],          // double spike
  ['block', 3000, 120, 70],
  ['spike', 3400, 40],
  ['gap',   3900, 170],
  ['block', 4400, 90, 110],
  ['spike', 5000, 40], ['spike', 5040, 40], ['spike', 5080, 40], // triple
  ['block', 5600, 200, 50], ['spike', 5650, 40],
  ['gap',   6300, 150],
  ['spike', 6900, 40], ['block', 7100, 100, 90], ['spike', 7300, 40],
  ['gap',   7800, 200],
  ['spike', 8500, 40], ['spike', 8540, 40],
  ['block', 9100, 140, 60], ['spike', 9400, 40],
];
const LEVEL_END = 9900;

// ---- canvas + integer letterbox (arcade-core) ----
const cv = document.createElement('canvas');
cv.width = W;
cv.height = H;
document.body.appendChild(cv);
const ctx = cv.getContext('2d')!;

let cachedScale = 1;
const toLogical = (cx: number, cy: number) => ({ x: cx / cachedScale, y: cy / cachedScale });

function layout(): void {
  const vp = viewport();
  // badge wraps on narrow screens — measure, don't hardcode (RT-3/RT-4)
  const badgeH = badgeEl?.offsetHeight ?? BADGE_H;
  if (muteBtn) muteBtn.style.top = `${badgeH + 4}px`;
  const avail = { width: vp.width, height: vp.height - badgeH };
  const s = fitIntegerScale(W, H, avail, 4);
  const off = letterboxOffset(W, H, s, avail);
  cachedScale = s;
  cv.style.width = `${W * s}px`;
  cv.style.height = `${H * s}px`;
  // fixed canvas + explicit left/top — no flex-centering + translate double-count
  cv.style.left = `${off.x}px`;
  cv.style.top = `${off.y + badgeH}px`;
}
window.addEventListener('resize', layout);
layout();

// ---- arcade-core services ----
const input = new Input();
input.attach(cv, toLogical);
const sfx = new Sfx();

if (muteBtn) {
  const paint = () => { muteBtn.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON'; };
  muteBtn.addEventListener('click', () => { sfx.muted = !sfx.muted; paint(); });
  paint();
}

// ---- game state ----
type State = 'running' | 'dead' | 'clear';
interface Cube { x: number; y: number; vy: number; grounded: boolean; rot: number }
interface Particle { x: number; y: number; vx: number; vy: number; s: number; life: number }

let state: State;
let cube: Cube;
let particles: Particle[];
let camX: number;
let attempt: number;
let deaths: number;
let jumpBuf: number;
let coyoteT: number;
let deadT: number;
let clearT: number;
let paused: boolean;
let best = load('impossible', 'best-progress', 0);
let prevPointerActive = false;

function reset(full: boolean): void {
  if (full) { attempt = 0; deaths = 0; }
  attempt++;
  state = 'running';
  cube = { x: 0, y: GROUND_Y - CUBE, vy: 0, grounded: true, rot: 0 };
  particles = [];
  camX = 0; jumpBuf = 0; coyoteT = 0; deadT = 0; clearT = 0; paused = false;
}
reset(true);

function pressJump(): void { jumpBuf = JUMP_BUFFER; }

// ---- collision (proto-verbatim) ----
function floorAt(x: number): number {
  let top = -Infinity, inGap = false;
  for (const [t, ox, ow, oh] of LEVEL) {
    if (x < ox || x > ox + ow) continue;
    if (t === 'gap') inGap = true;
    if (t === 'block') top = Math.max(top, GROUND_Y - (oh ?? 0));
  }
  if (top > -Infinity) return top;
  return inGap ? -Infinity : GROUND_Y;
}
function solidSideAt(x: number, y: number): boolean {
  for (const [t, ox, ow, oh] of LEVEL) {
    if (t !== 'block') continue;
    const top = GROUND_Y - (oh ?? 0);
    if (x > ox && x < ox + ow && y + CUBE > top + 2 && y < GROUND_Y) return true;
  }
  return false;
}
function spikeAt(x: number, y: number): boolean {
  for (const [t, ox, ow] of LEVEL) {
    if (t !== 'spike') continue;
    const cx = x + CUBE / 2, cy = y + CUBE;
    if (cx > ox + 4 && cx < ox + ow - 4 && cy > GROUND_Y - 26) return true;
  }
  return false;
}

function die(): void {
  const prog = cube.x / LEVEL_END;
  if (prog > best) best = prog;
  save('impossible', 'best-progress', best);
  state = 'dead'; deadT = 0; deaths++;
  sfx.preset('death');
  for (let i = 0; i < 26; i++) particles.push({
    x: cube.x + CUBE / 2, y: cube.y + CUBE / 2,
    vx: (Math.random() - .5) * 700, vy: -Math.random() * 600 - 100,
    s: 4 + Math.random() * 8, life: .5 + Math.random() * .4,
  });
}

function step(dt: number): void {
  if (state === 'dead') { deadT += dt * 1000; if (deadT >= RESPAWN_MS) reset(false); return; }
  if (state === 'clear') { clearT += dt; return; }
  if (paused) return;

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
    sfx.blip({ wave: 'square', freq: 520, freqEnd: 700, duration: 0.05, volume: 0.4 }); // jump tick
  }

  if (spikeAt(cube.x, cube.y) || solidSideAt(cube.x + CUBE, cube.y)) return die();
  if (floor === -Infinity && cube.y + CUBE > GROUND_Y + 8) return die(); // fell into gap
  if (cube.x >= LEVEL_END) {
    state = 'clear'; clearT = 0;
    sfx.preset('pickup');
    if (1 > best) { best = 1; save('impossible', 'best-progress', best); }
  }
  const prog = cube.x / LEVEL_END;
  if (prog > best) best = prog;
}

// ---- input → jump (press-edge, spec: tap-on-press) ----
function pollInput(): void {
  if (input.wasPressed('fire') || input.wasPressed('up')) pressJump();
  // pointer press-edge (touch = tap-on-press, spec default mobile)
  if (input.pointer.active && !prevPointerActive) pressJump();
  prevPointerActive = input.pointer.active;
  if (input.wasPressed('action')) reset(false);          // R/E/K/M cluster → restart
  if (input.wasPressed('pause')) paused = !paused;       // Esc/P
  input.endFrame();
}

// KeyZ is unbound in arcade-core defaults; add it as a jump alias.
input.setKeymaps({ p1: { KeyZ: 'fire', KeyR: 'action' } });

// ---- main loop: 120Hz accumulator ----
let acc = 0, last = performance.now();
function frame(now: number): void {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  pollInput();
  while (acc >= DT) { step(DT); acc -= DT; }
  for (const p of particles) { p.x += p.vx * DT; p.y += p.vy * DT; p.vy += GRAV * DT * .6; p.life -= DT; }
  particles = particles.filter(p => p.life > 0);
  camX = cube.x - 220;
  draw();
  requestAnimationFrame(frame);
}

function draw(): void {
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(-camX, 0);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(camX - 50, GROUND_Y, W + 100, H - GROUND_Y);
  ctx.fillStyle = '#e8e8e8';
  for (const [t, gx, gw] of LEVEL) if (t === 'gap') ctx.fillRect(gx, GROUND_Y, gw, H - GROUND_Y);
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3;
  for (const [t, gx, gw] of LEVEL) if (t === 'gap') ctx.strokeRect(gx, GROUND_Y, gw, 4);
  for (const [t, ox, ow, oh] of LEVEL) {
    if (t === 'spike') {
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.moveTo(ox, GROUND_Y); ctx.lineTo(ox + ow / 2, GROUND_Y - 34); ctx.lineTo(ox + ow, GROUND_Y); ctx.fill();
    } else if (t === 'block') {
      ctx.fillStyle = '#4a6fa5'; ctx.fillRect(ox, GROUND_Y - (oh ?? 0), ow, oh ?? 0);
      ctx.strokeStyle = '#2b2b2b'; ctx.strokeRect(ox, GROUND_Y - (oh ?? 0), ow, oh ?? 0);
    }
  }
  ctx.fillStyle = '#2b8a3e'; ctx.fillRect(LEVEL_END, GROUND_Y - 160, 8, 160);
  ctx.fillStyle = '#d6336c';
  for (const p of particles) ctx.fillRect(p.x, p.y, p.s, p.s);
  if (state !== 'dead') {
    ctx.save(); ctx.translate(cube.x + CUBE / 2, cube.y + CUBE / 2); ctx.rotate(cube.rot);
    ctx.fillStyle = '#f08c00'; ctx.fillRect(-CUBE / 2, -CUBE / 2, CUBE, CUBE);
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3; ctx.strokeRect(-CUBE / 2, -CUBE / 2, CUBE, CUBE);
    ctx.restore();
  }
  ctx.restore();
  // HUD
  ctx.fillStyle = '#2b2b2b'; ctx.font = '16px monospace';
  const prog = Math.min(100, Math.max(0, cube.x / LEVEL_END * 100));
  ctx.fillText(`ATTEMPT ${attempt}   DEATHS ${deaths}   ${prog.toFixed(0)}%   BEST ${(best * 100).toFixed(0)}%`, 16, 26);
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(16, 36, 300, 8);
  ctx.fillStyle = '#f08c00'; ctx.fillRect(16, 36, 300 * prog / 100, 8);
  ctx.fillStyle = '#666'; ctx.font = '13px monospace';
  ctx.fillText('SPACE/UP/Z/CLICK jump · R restart · ESC pause — INTERNAL replica', 16, H - 14);
  if (paused) banner('PAUSED');
  if (state === 'dead') banner('DEAD — respawning…');
  if (state === 'clear') banner('LEVEL CLEAR — press R to run again');
}
function banner(t: string): void {
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H / 2 - 44, W, 88);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center';
  ctx.fillText(t, W / 2, H / 2 + 10); ctx.textAlign = 'left';
}
requestAnimationFrame(frame);

// PROOF/debug hook (not gameplay)
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __maga: unknown }).__maga = {
    get state() { return state; }, get x() { return cube.x; }, get y() { return cube.y; },
    get attempt() { return attempt; }, get deaths() { return deaths; },
    get progress() { return cube.x / LEVEL_END; },
    jump: pressJump, reset: () => reset(false),
    teleport(x: number) { cube.x = x; }, die,
    LEVEL_END,
  };
  Object.defineProperty(window, '__proto', {
    value: {
      get state() { return state; }, get x() { return cube.x; }, get y() { return cube.y; },
      get attempt() { return attempt; }, get deaths() { return deaths; },
      get grounded() { return cube.grounded; },
      get progress() { return cube.x / LEVEL_END; },
      get camX() { return camX; }, get paused() { return paused; },
      get best() { return best; },
      get LEVEL() { return LEVEL; }, get LEVEL_END() { return LEVEL_END; },
    },
    configurable: true, enumerable: true, writable: false,
  });
}
