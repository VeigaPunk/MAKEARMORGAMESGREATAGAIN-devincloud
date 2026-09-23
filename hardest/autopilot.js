/* hardest/autopilot.js — deterministic completability prover.
 * Plays a level through the REAL engine (HardestEngine.step) with synthetic
 * input: BFS pathing over walkable tiles + greedy candidate-move evaluation
 * with a predictive dot-collision horizon. No DOM. Node + browser.
 *
 * A CLEAR is hard evidence the level is beatable (the inputs are legal and the
 * engine accepted them). A FAIL means the greedy policy couldn't clear within
 * budget — the level may still be humanly possible, but it is NOT verified.
 */
(function (root) {
const HORIZON = 0.8;           // candidate sim lookahead cap (s); a move is
                               // "safe" iff it survives to the waypoint or the cap
const E = root.HardestEngine;

const CHECK_EVERY = 4;         // dot check every Nth substep (~16.7ms)
const REACH = 7;               // waypoint reach radius (px)
const STUCK_T = 1.2;           // s without progress → wiggle
const WIGGLE_T = 0.5;
const DIRS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2],
];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function solve(level, opts) {
  opts = opts || {};
  const maxSim = opts.maxSim || 120;
  const maxDeaths = opts.maxDeaths || 400;
  const rng = mulberry32(opts.seed || 1);
  const st = E.create(level);
  const P = st.P;
  const T = E.TILE, PS = E.PLAYER;

  const walkable = (tx, ty) => !E.solid(P, tx, ty);
  const tileOf = (px, py) => [Math.floor(px / T), Math.floor(py / T)];

  // BFS over walkable tiles; 'T' pads add a zero-cost edge to the paired pad.
  function bfs(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [[sx, sy]];
    const tp = new Map();
    P.telepads.forEach(([x, y], i) => tp.set(y * P.w + x, P.telepads[i ^ 1]));
    const key = (x, y) => y * P.w + x;
    const prev = new Map([[key(sx, sy), null]]);
    const q = [[sx, sy]];
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h];
      const nbrs = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      const pair = tp.get(key(x, y));
      if (pair) nbrs.push(pair);
      for (const [nx, ny] of nbrs) {
        if (!walkable(nx, ny) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y]);
        if (nx === tx && ny === ty) {
          const path = [[nx, ny]];
          let c = [x, y];
          while (c) { path.push(c); c = prev.get(key(c[0], c[1])); }
          return path.reverse();
        }
        q.push([nx, ny]);
      }
    }
    return null;
  }

  function los(ax, ay, bx, by) { // player-rect clearance along segment
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 4));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n - PS / 2, y = ay + (by - ay) * k / n - PS / 2;
      if (E.rectHitsWall(P, x, y, PS, PS)) return false;
    }
    return true;
  }

  function objectives() {
    // keys + coins in any order (design contract: keys never behind doors);
    // goal only once everything is collected.
    const items = [];
    for (const k of st.keys) if (!k.taken) items.push([k.tx, k.ty]);
    if (st.coinsLeft > 0) for (const c of st.coins) if (!c.taken) items.push([c.tx, c.ty]);
    if (items.length) return items;
    return P.zones.goal.map(g => g);
  }


  function plan() { // → waypoints in px, or null
    const [sx, sy] = tileOf(st.player.x + PS / 2, st.player.y + PS / 2);
    let best = null;
    for (const [tx, ty] of objectives()) {
      const p = bfs(sx, sy, tx, ty);
      if (p && (!best || p.length < best.length)) best = p;
    }
    if (!best) return null;
    const pts = best.map(([x, y]) => [x * T + T / 2, y * T + T / 2]);
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      for (; j > i + 1; j--) if (los(pts[i][0], pts[i][1], pts[j][0], pts[j][1])) break;
      out.push(pts[j]); i = j;
    }
    return out;
  }

  function evalMove(px, py, dir, t0, wp) {
    let x = px, y = py, minD = Infinity, reached = false, dieAt = Infinity;
    const steps = Math.round(HORIZON / E.STEP);
    const spd = P.playerSpeed * E.STEP;
    for (let k = 1; k <= steps; k++) {
      const r = E.moveResolve(P, x, y, PS, PS, dir[0] * spd, dir[1] * spd);
      x = r.x; y = r.y;
      if (k % CHECK_EVERY === 0 || k === 1) {
        const tt = t0 + k * E.STEP;
        for (const d of P.patrols) {
          const pos = E.dotPos(d, tt);
          if (E.circleHitsRect(pos.x, pos.y, d.r, x, y, PS, PS)) { dieAt = k * E.STEP; return { safe: false, minD, reached, dieAt }; }
        }
        // movers are solid hazards: the policy never plans to be pushed/crushed
        for (const mv of P.movers) {
          const mr = E.moverRect(mv, tt);
          if (E.rectsOverlap(x, y, PS, PS, mr.x, mr.y, mr.w, mr.h)) { dieAt = k * E.STEP; return { safe: false, minD, reached, dieAt }; }
        }
      }
      const dd = Math.hypot(wp[0] - (x + PS / 2), wp[1] - (y + PS / 2));
      if (dd < minD) minD = dd;
      if (dd < REACH) { reached = true; break; }
    }
    return { safe: true, minD, reached, dieAt };
  }

  let wps = plan(), wi = 0, tpCount = 0;
  let lastImprove = 0, bestD = Infinity, wiggle = 0;
  const tEnd = maxSim;

  while (st.t < tEnd && st.deaths < maxDeaths) {
    if (st.status === 'clear') return { clear: true, time: st.time, deaths: st.deaths, simT: st.t, reason: 'clear' };
    if (st.status === 'dead') { E.step(st, { x: 0, y: 0 }, E.STEP); wps = plan(); wi = 0; bestD = Infinity; continue; }

    if (!wps) return { clear: false, time: st.time, deaths: st.deaths, simT: st.t, reason: 'no-path' };
    if (wi >= wps.length) { wps = plan(); wi = 0; if (!wps) return { clear: false, time: st.time, deaths: st.deaths, simT: st.t, reason: 'no-path' }; }
    const wp = wps[wi];
    const px = st.player.x, py = st.player.y;
    const pcd = Math.hypot(wp[0] - (px + PS / 2), wp[1] - (py + PS / 2));
    if (pcd < REACH) { wi++; continue; }
    // progress / stuck tracking
    if (pcd < bestD - 1) { bestD = pcd; lastImprove = st.t; }
    const stuck = st.t - lastImprove > STUCK_T;

    let chosen = null;
    if (stuck && wiggle <= 0) wiggle = WIGGLE_T;
    if (wiggle > 0) {
      wiggle -= E.STEP;
      const safe = DIRS.map(d => ({ d, r: evalMove(px, py, d, st.t, wp) })).filter(o => o.r.safe && (o.d[0] || o.d[1]));
      chosen = safe.length ? safe[Math.floor(rng() * safe.length)].d : [0, 0];
      if (wiggle <= 0) { wps = plan(); wi = 0; bestD = Infinity; lastImprove = st.t; }
    } else {
      let bestSafe = null, bestAny = null;
      for (const d of DIRS) {
        const r = evalMove(px, py, d, st.t, wp);
        if (r.safe) {
          const score = (r.reached ? -1e6 : 0) + r.minD - (d[0] || d[1] ? 0 : 0.5); // prefer motion
          if (!bestSafe || score < bestSafe.score) bestSafe = { d, score };
        } else if (!bestAny || r.dieAt > bestAny.dieAt) bestAny = { d, dieAt: r.dieAt };
      }
      chosen = bestSafe ? bestSafe.d : (bestAny ? bestAny.d : [0, 0]);
    }

    E.step(st, { x: chosen[0], y: chosen[1] }, E.STEP);
    if (st.teleports > tpCount) { tpCount = st.teleports; wps = plan(); wi = 0; bestD = Infinity; lastImprove = st.t; }
    if (opts.trace && (st.t * 240 | 0) % 240 === 0) opts.trace(st, wp, chosen);
  }
  return {
    clear: false, time: st.time, deaths: st.deaths, simT: st.t,
    reason: st.deaths >= maxDeaths ? 'death-budget' : 'sim-budget',
  };
}

root.HardestAutopilot = { solve };
})(typeof globalThis !== 'undefined' ? globalThis : this);
