// verification/r2/gen-hardest-tapes.mjs — record autopilot input tapes for hardest
// levels (runs the REAL engine in node, like validate.mjs, and captures each
// 60Hz input frame via the autopilot's trace hook). Output: hardest-tapes.json
// { [levelFile]: { dirs: [[dx,dy,frames],...], clear, time, deaths } }
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hardest');
require(join(DIR, 'engine.js'));
require(join(DIR, 'autopilot.js'));
const E = globalThis.HardestEngine;
const A = globalThis.HardestAutopilot;

const levels = readdirSync(join(DIR, 'levels')).filter(f => f.endsWith('.js')).sort();
const want = process.argv.slice(2).length ? process.argv.slice(2) : levels.slice(0, 3);
const out = {};
for (const name of want) {
  globalThis.HARDEST_LEVELS = [];
  require(join(DIR, 'levels', name));
  const level = globalThis.HARDEST_LEVELS.at(-1);
  let cur = null, frames = 0;
  const dirs = [];
  const trace = (st, wp, chosen) => {
    const d = chosen ?? [0, 0];
    if (cur && cur[0] === d[0] && cur[1] === d[1]) frames++;
    else { if (cur) dirs.push([cur[0], cur[1], frames]); cur = d; frames = 1; }
  };
  const r = A.solve(level, { trace, seed: 1 });
  if (cur) dirs.push([cur[0], cur[1], frames]);
  out[name] = { clear: !!r.clear, time: r.time, deaths: r.deaths, dirs };
  console.log(`${name}: clear=${r.clear} t=${r.time}s deaths=${r.deaths} segments=${dirs.length}`);
}
writeFileSync(new URL('./hardest-tapes.json', import.meta.url).pathname.slice(1), JSON.stringify(out));
console.log('tapes written');
