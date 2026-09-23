#!/usr/bin/env node
/**
 * IMPOSSIBLE RUN — clearability proof.
 *
 * Re-bundles src/levels.ts (pure module) with esbuild, then runs a BFS jump
 * solver over an exact copy of the game's fixed-timestep physics to prove:
 *   1. every level is clearable from the start line, and
 *   2. every practice checkpoint is spawn-safe AND the rest is clearable from it.
 *
 * The solver is STRICTER than the game: no jump buffer, no coyote time (the
 * game's 0.06s buffer / 0.10s coyote only widen the human timing window), so
 * solver-clearable ⇒ clearable in-game. Mirrors main.ts step() order exactly:
 * move → floor → land/fall → buffered jump → spike/side kill → gap kill → clear.
 *
 * Usage: node tools/prove.mjs   (from apps/impossible; exit 1 on any failure)
 */
import { createRequire } from 'node:module';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

// ---- physics constants — copied from apps/impossible/src/main.ts (keep in sync) ----
const DT = 1 / 120;      // fixed timestep
const SPEED = 360;       // px/s auto-run
const GRAV = 2600;       // px/s^2
const JUMP_V = 880;      // fixed impulse
const CUBE = 34;         // hitbox edge
const GROUND_Y = 430;

// ---- bundle the pure level module -------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'impossible-prove-'));
const tmp = join(dir, 'levels.mjs');
esbuild.buildSync({
  entryPoints: [join(here, '..', 'src', 'levels.ts')],
  bundle: true, format: 'esm', outfile: tmp, logLevel: 'silent',
});
const { LEVELS } = await import(pathToFileURL(tmp).href);

// ---- collision — bucketed, semantics identical to main.ts --------------------
const BUCKET = 256;
function makeWorld(obs) {
  const buckets = new Map();
  for (const o of obs) {
    const b0 = Math.floor(o.x / BUCKET), b1 = Math.floor((o.x + o.w) / BUCKET);
    for (let b = b0; b <= b1; b++) {
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(o);
    }
  }
  const at = (x) => buckets.get(Math.floor(x / BUCKET)) ?? [];
  const floorAt = (x) => {
    let top = -Infinity, inGap = false;
    for (const o of at(x)) {
      if (x < o.x || x > o.x + o.w) continue;
      if (o.t === 'gap') inGap = true;
      if (o.t === 'block') top = Math.max(top, GROUND_Y - (o.h ?? 0));
    }
    if (top > -Infinity) return top;
    return inGap ? -Infinity : GROUND_Y;
  };
  const solidSideAt = (x, y) => {
    for (const o of at(x)) {
      if (o.t !== 'block') continue;
      const top = GROUND_Y - (o.h ?? 0);
      if (x > o.x && x < o.x + o.w && y + CUBE > top + 2 && y < GROUND_Y) return true;
    }
    return false;
  };
  const spikeAt = (x, y) => {
    for (const o of at(x)) {
      if (o.t !== 'spike') continue;
      const cx = x + CUBE / 2, cy = y + CUBE;
      if (cx > o.x + 4 && cx < o.x + o.w - 4 && cy > GROUND_Y - 26) return true;
    }
    return false;
  };
  return { floorAt, solidSideAt, spikeAt };
}

// ---- BFS over (frame, y, vy, grounded); x is a function of the frame --------
function solve(level, startX) {
  const { floorAt, solidSideAt, spikeAt } = makeWorld(level.obstacles);
  const nodes = [{ x: startX, y: GROUND_Y - CUBE, vy: 0, g: true, prev: -1, act: false }];
  let frontier = [0];
  const maxFrames = Math.ceil((level.end - startX) / (SPEED * DT)) + 2400;
  let maxX = startX;
  for (let f = 1; f <= maxFrames && frontier.length; f++) {
    const seen = new Set();
    const next = [];
    for (const idx of frontier) {
      const base = nodes[idx];
      for (const jumpNow of base.g ? [false, true] : [false]) {
        let { x, y, vy, g } = base;
        x += SPEED * DT;
        const floor = floorAt(x + CUBE / 2);
        if (g) {
          if (floor === -Infinity || y + CUBE < floor - 1) g = false;
        } else {
          vy += GRAV * DT;
          y += vy * DT;
          if (floor > -Infinity && vy >= 0 && y + CUBE >= floor) {
            y = floor - CUBE; vy = 0; g = true;
          }
        }
        if (jumpNow && g) { vy = -JUMP_V; g = false; }
        if (spikeAt(x, y) || solidSideAt(x + CUBE, y)) continue;
        if (floor === -Infinity && y + CUBE > GROUND_Y + 8) continue;
        const key = (g ? 'g' : 'a') + ((y * 2) | 0) + ':' + ((vy / 4) | 0);
        if (seen.has(key)) continue;
        seen.add(key);
        nodes.push({ x, y, vy, g, prev: idx, act: jumpNow });
        const id = nodes.length - 1;
        next.push(id);
        if (x > maxX) maxX = x;
        if (x >= level.end) {
          const jumps = [];
          for (let n = id; n >= 0; n = nodes[n].prev) if (nodes[n].act) jumps.push(nodes[n].x);
          jumps.reverse();
          return { ok: true, jumps, frames: f };
        }
      }
    }
    if (next.length > 8000) throw new Error(`state blow-up at frame ${f} (${next.length})`);
    frontier = next;
  }
  return { ok: false, maxX, frames: 0 };
}

// ---- report -------------------------------------------------------------------
let failures = 0;
const lines = [];
for (let i = 0; i < LEVELS.length; i++) {
  const L = LEVELS[i];
  const secs = (L.end / SPEED).toFixed(1);
  lines.push(`LEVEL ${i + 1} · ${L.name} — ${Math.round(L.end)}px = ${secs}s @360px/s · ${L.bpm} BPM (grid ${L.pxStep.toFixed(2)}px/16th) · ${L.obstacles.length} obstacles`);

  const full = solve(L, 0);
  if (full.ok) {
    const head = full.jumps.slice(0, 10).map((x) => `${Math.round(x)}(${((x / L.end) * 100).toFixed(1)}%)`).join(' ');
    lines.push(`  full run:   PASS — ${full.jumps.length} jumps in ${Math.round(full.frames / 120)}s sim; first jumps: ${head}${full.jumps.length > 10 ? ' …' : ''}`);
  } else {
    failures++;
    lines.push(`  full run:   FAIL — no solution, frontier died at x=${Math.round(full.maxX)} (${((full.maxX / L.end) * 100).toFixed(1)}%)`);
    const near = L.obstacles.filter((o) => Math.abs(o.x - full.maxX) < 300).map((o) => `${o.t}@${Math.round(o.x)}`);
    lines.push(`  obstacles near death point: ${near.join(' ') || '(none — geometry bug?)'}`);
  }

  const cps = [];
  for (const cp of L.checkpoints) {
    const { floorAt } = makeWorld(L.obstacles);
    const spawnSafe = floorAt(cp + CUBE / 2) === GROUND_Y;
    const r = spawnSafe && solve(L, cp).ok;
    cps.push(r ? 'ok' : 'FAIL');
    if (!r) failures++;
  }
  lines.push(`  checkpoints: ${L.checkpoints.length} flags ${cps.every((c) => c === 'ok') ? 'all PASS' : cps.join('/')} @ ${L.checkpoints.map((c) => `${Math.round(c)}px(${((c / L.end) * 100).toFixed(0)}%)`).join(' ')}`);
}
lines.push(failures === 0 ? 'ALL LEVELS PASS' : `${failures} FAILURE(S)`);
const out = lines.join('\n');
console.log(out);
rmSync(dir, { recursive: true, force: true });
process.exit(failures === 0 ? 0 : 1);
