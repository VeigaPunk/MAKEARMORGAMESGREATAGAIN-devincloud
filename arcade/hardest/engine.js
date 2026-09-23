/* hardest/engine.js — The World's Hardest Game: pure game logic.
 * No DOM, no canvas, no randomness. Runs in browser (globalThis.HardestEngine)
 * and Node (require) so the validator/autopilot simulate the exact shipping code.
 *
 * Level format: see LEVEL-FORMAT.md. Tile chars:
 *   '#' wall   '.' floor   'S' start zone   'G' goal zone
 *   'K' checkpoint zone   'C'/'c' coin   'y' key   'D' door (opens when all
 *   keys collected)   'T' teleport pad (paired in scan order)
 * Movers (sliding wall blocks) are entities like patrols — level.movers[],
 * not map chars. Solid: they push the player; pinned against anything = crush.
 */
(function (root) {
'use strict';

const TILE = 32;
const STEP = 1 / 240;          // fixed physics step (seconds)
const PLAYER = 20;             // player square edge (px)
const PLAYER_SPEED = 175;      // px/s default; level may override
const DOT_R = 6;               // default patrol dot radius (px)
const COIN_R = 6;
const DEAD_TIME = 0.25;        // s from death to respawn (15 frames at 60Hz)
const EPS = 0.001;

const TILE_CHARS = new Set(['#', '.', 'S', 'G', 'K', 'C', 'c', 'y', 'D', 'T']);
const ZONE_CHARS = new Set(['S', 'G', 'K']);

/* ---------- level parsing ---------- */

function parseLevel(level) {
  if (!level || typeof level !== 'object') throw new Error('level: not an object');
  if (level.playerSpeed !== undefined && (!Number.isFinite(level.playerSpeed) || level.playerSpeed <= 0 || level.playerSpeed > 1000))
    throw new Error('level.playerSpeed: must be greater than 0 and at most 1000 px/s');
  const rows = level.map;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('level.map: empty');
  const h = rows.length, w = rows[0].length;
  const grid = [];
  const zones = { start: [], goal: [], check: [] };
  const coins = [];
  const keys = [];
  const telepads = [];
  for (let y = 0; y < h; y++) {
    if (typeof rows[y] !== 'string' || rows[y].length !== w)
      throw new Error(`level.map[${y}]: ragged row`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (!TILE_CHARS.has(ch)) throw new Error(`level.map[${y}][${x}]: bad char '${ch}'`);
      if (ch === 'S') zones.start.push([x, y]);
      else if (ch === 'G') zones.goal.push([x, y]);
      else if (ch === 'K') zones.check.push([x, y]);
      else if (ch === 'C' || ch === 'c') coins.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, r: COIN_R, taken: false, tx: x, ty: y });
      else if (ch === 'y') keys.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, r: COIN_R, taken: false, tx: x, ty: y });
      else if (ch === 'T') telepads.push([x, y]);
    }
    grid.push(rows[y]);
  }
  if (zones.start.length === 0) throw new Error('level: no start zone S');
  if (zones.goal.length === 0) throw new Error('level: no goal zone G');

  /* Shared path machinery: patrol dots and movers both ride waypoint paths. */
  function buildPath(p, i, what) {
    if (!Array.isArray(p.path) || p.path.length < 1) throw new Error(`${what}[${i}]: path empty`);
    const pts = p.path.map(([tx, ty]) => {
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) throw new Error(`${what}[${i}]: bad waypoint`);
      return [tx * TILE + TILE / 2, ty * TILE + TILE / 2];
    });
    const mode = p.mode === 'loop' ? 'loop' : 'pingpong';
    const n = pts.length;
    const segs = [];
    let L = 0;
    const segCount = mode === 'loop' ? n : n - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ a, b, len });
      L += len;
    }
    return { pts, segs, L, mode, speed: p.speed, phase: p.phase || 0 };
  }

  const patrols = (level.patrols || []).map((p, i) => {
    const base = buildPath(p, i, 'patrol');
    return { ...base, r: p.r || DOT_R };
  });

  /* Movers: solid w×h-tile blocks centered on their path point. */
  const movers = (level.movers || []).map((m, i) => {
    const base = buildPath(m, i, 'mover');
    const wT = m.w || 1, hT = m.h || 1;
    if (!Number.isFinite(wT) || !Number.isFinite(hT) || wT < 1 || hT < 1 || wT > 4 || hT > 4)
      throw new Error(`mover[${i}]: w/h must be 1-4 tiles`);
    return { ...base, w: wT * TILE, h: hT * TILE };
  });

  return {
    level, grid, w, h, zones, coins, keys, telepads, patrols, movers,
    doorsOpen: keys.length === 0,   // no keys → doors start open
    playerSpeed: level.playerSpeed || PLAYER_SPEED,
    pxW: w * TILE, pxH: h * TILE,
  };
}

/* ---------- collision helpers (exported for autopilot) ---------- */

/* P = parsed level ({grid, doorsOpen}); 'D' tiles block until doorsOpen. */
function solid(P, tx, ty) {
  if (ty < 0 || ty >= P.grid.length || tx < 0 || tx >= P.grid[0].length) return true; // OOB = wall
  const ch = P.grid[ty][tx];
  return ch === '#' || (ch === 'D' && !P.doorsOpen);
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function rectHitsWall(P, x, y, w, h, rects) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - EPS) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - EPS) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (solid(P, tx, ty)) return true;
  if (rects) for (const r of rects) if (rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h)) return true;
  return false;
}

/* Move an AABB one axis at a time, clamping to wall + mover-rect boundaries. */
function moveResolve(P, x, y, w, h, dx, dy, rects) {
  x += dx;
  if (dx > 0) {
    const tx = Math.floor((x + w) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - EPS) / TILE);
    for (let ty = y0; ty <= y1; ty++) if (solid(P, tx, ty)) { x = tx * TILE - w - EPS; break; }
    if (rects) for (const r of rects)
      if (rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h)) x = Math.min(x, r.x - w - EPS);
  } else if (dx < 0) {
    const tx = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - EPS) / TILE);
    for (let ty = y0; ty <= y1; ty++) if (solid(P, tx, ty)) { x = (tx + 1) * TILE + EPS; break; }
    if (rects) for (const r of rects)
      if (rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h)) x = Math.max(x, r.x + r.w + EPS);
  }
  y += dy;
  if (dy > 0) {
    const ty = Math.floor((y + h) / TILE);
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - EPS) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (solid(P, tx, ty)) { y = ty * TILE - h - EPS; break; }
    if (rects) for (const r of rects)
      if (rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h)) y = Math.min(y, r.y - h - EPS);
  } else if (dy < 0) {
    const ty = Math.floor(y / TILE);
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - EPS) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (solid(P, tx, ty)) { y = (ty + 1) * TILE + EPS; break; }
    if (rects) for (const r of rects)
      if (rectsOverlap(x, y, w, h, r.x, r.y, r.w, r.h)) y = Math.max(y, r.y + r.h + EPS);
  }
  return { x, y };
}

/* Mover AABB at time t (deterministic — same path math as dots). */
function moverRect(m, t) {
  const c = dotPos(m, t);
  return { x: c.x - m.w / 2, y: c.y - m.h / 2, w: m.w, h: m.h };
}

function moverRects(P, t) {
  return P.movers.map(m => moverRect(m, t));
}

/* Patrol dot center at time t (deterministic). */
function dotPos(p, t) {
  if (p.pts.length === 1 || p.L === 0) return { x: p.pts[0][0], y: p.pts[0][1] };
  const period = p.mode === 'loop' ? p.L : 2 * p.L;
  let d = (p.speed * t + p.phase * period) % period;
  if (d < 0) d += period;
  if (p.mode !== 'loop' && d > p.L) d = period - d;
  for (const s of p.segs) {
    if (d <= s.len || s === p.segs[p.segs.length - 1]) {
      const k = s.len === 0 ? 0 : d / s.len;
      return { x: s.a[0] + (s.b[0] - s.a[0]) * k, y: s.a[1] + (s.b[1] - s.a[1]) * k };
    }
    d -= s.len;
  }
  return { x: p.pts[0][0], y: p.pts[0][1] };
}

function circleHitsRect(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/* ---------- game state ---------- */

function create(level) {
  const P = parseLevel(level);
  const [sx, sy] = P.zones.start[0];
  const spawn = { x: sx * TILE + (TILE - PLAYER) / 2, y: sy * TILE + (TILE - PLAYER) / 2 };
  return {
    P,
    t: 0,                    // global clock (dots keep running through deaths)
    time: 0,                 // play clock (pauses while dead/clear)
    status: 'play',          // 'play' | 'dead' | 'clear'
    deadT: 0,
    deaths: 0,
    player: { x: spawn.x, y: spawn.y, w: PLAYER, h: PLAYER },
    respawn: { x: spawn.x, y: spawn.y },
    zone: 'S',
    coins: P.coins,
    coinsLeft: P.coins.length,
    coinsTotal: P.coins.length,
    keys: P.keys,
    keysLeft: P.keys.length,
    keysTotal: P.keys.length,
    teleports: 0,
    onPad: -1,               // telepad index under player center, -1 off-pad
  };
}

function step(st, input, dt) {
  st.t += dt;
  if (st.status === 'clear') return st;
  if (st.status === 'dead') {
    st.deadT -= dt;
    if (st.deadT <= 0) {
      st.player.x = st.respawn.x; st.player.y = st.respawn.y;
      st.onPad = -1;
      st.status = 'play';
    }
    return st;
  }
  st.time += dt;

  // movement — clamped by walls AND mover rects at the new clock time
  let ix = input.x || 0, iy = input.y || 0;
  const m = Math.hypot(ix, iy);
  if (m > 1) { ix /= m; iy /= m; }
  const sp = st.P.playerSpeed * dt;
  const p = st.player;
  const mrects = st.P.movers.length ? moverRects(st.P, st.t) : null;
  const r = moveResolve(st.P, p.x, p.y, p.w, p.h, ix * sp, iy * sp, mrects);
  p.x = r.x; p.y = r.y;

  // movers push the player; pinned against anything solid = crushed
  if (mrects) {
    for (let i = 0; i < st.P.movers.length; i++) {
      const mv = st.P.movers[i], r0 = mrects[i];
      if (!rectsOverlap(p.x, p.y, p.w, p.h, r0.x, r0.y, r0.w, r0.h)) continue;
      const prev = moverRect(mv, st.t - dt);
      const dx = r0.x - prev.x, dy = r0.y - prev.y;
      // eject the player at the mover's leading edge (dominant motion axis);
      // a parked mover ejects along the shallower penetration axis.
      if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
        p.x = dx > 0 ? r0.x + r0.w + EPS : r0.x - p.w - EPS;
      } else if (dy !== 0) {
        p.y = dy > 0 ? r0.y + r0.h + EPS : r0.y - p.h - EPS;
      } else {
        const penX = Math.min(p.x + p.w - r0.x, r0.x + r0.w - p.x);
        const penY = Math.min(p.y + p.h - r0.y, r0.y + r0.h - p.y);
        if (penX < penY) p.x = (p.x + p.w / 2 < r0.x + r0.w / 2) ? r0.x - p.w - EPS : r0.x + r0.w + EPS;
        else p.y = (p.y + p.h / 2 < r0.y + r0.h / 2) ? r0.y - p.h - EPS : r0.y + r0.h + EPS;
      }
      if (rectHitsWall(st.P, p.x, p.y, p.w, p.h, mrects)) {
        st.status = 'dead'; st.deadT = DEAD_TIME; st.deaths++;
        return st;
      }
    }
  }

  // zone under player center
  const cx = Math.floor((p.x + p.w / 2) / TILE), cy = Math.floor((p.y + p.h / 2) / TILE);
  const ch = (cy >= 0 && cy < st.P.h && cx >= 0 && cx < st.P.w) ? st.P.grid[cy][cx] : '#';
  if (ch === 'S' || ch === 'K') {
    st.zone = ch;
    st.respawn.x = cx * TILE + (TILE - p.w) / 2;
    st.respawn.y = cy * TILE + (TILE - p.h) / 2;
  } else if (ch === 'G') {
    st.zone = 'G';
    if (st.coinsLeft === 0) { st.status = 'clear'; return st; }
  } else {
    st.zone = '.';
  }

  // coins
  for (const c of st.coins) {
    if (!c.taken && circleHitsRect(c.x, c.y, c.r + 2, p.x, p.y, p.w, p.h)) {
      c.taken = true; st.coinsLeft--;
    }
  }

  // keys — collecting ALL opens every 'D' door
  for (const k of st.keys) {
    if (!k.taken && circleHitsRect(k.x, k.y, k.r + 2, p.x, p.y, p.w, p.h)) {
      k.taken = true; st.keysLeft--;
      if (st.keysLeft === 0) st.P.doorsOpen = true;
    }
  }

  // teleport pads — edge-triggered: entering pad tile jumps to its pair
  {
    const chHere = (cy >= 0 && cy < st.P.h && cx >= 0 && cx < st.P.w) ? st.P.grid[cy][cx] : '#';
    if (chHere === 'T') {
      const idx = st.P.telepads.findIndex(([tx, ty]) => tx === cx && ty === cy);
      if (idx >= 0 && st.onPad !== idx) {
        const [dx2, dy2] = st.P.telepads[idx ^ 1];
        p.x = dx2 * TILE + (TILE - p.w) / 2;
        p.y = dy2 * TILE + (TILE - p.h) / 2;
        st.onPad = idx ^ 1;
        st.teleports++;
      }
    } else {
      st.onPad = -1;
    }
  }

  // dots — instant death
  for (const d of st.P.patrols) {
    const pos = dotPos(d, st.t);
    if (circleHitsRect(pos.x, pos.y, d.r, p.x, p.y, p.w, p.h)) {
      st.status = 'dead'; st.deadT = DEAD_TIME; st.deaths++;
      return st;
    }
  }
  return st;
}

root.HardestEngine = {
  TILE, STEP, PLAYER, PLAYER_SPEED, DOT_R, COIN_R, DEAD_TIME,
  TILE_CHARS, ZONE_CHARS,
  parseLevel, create, step,
  solid, rectHitsWall, moveResolve, dotPos, circleHitsRect,
  rectsOverlap, moverRect, moverRects,
};
})(typeof globalThis !== 'undefined' ? globalThis : this);
