#!/usr/bin/env node
/**
 * Burger Tycoon — deterministic tuning harness.
 *
 * Bundles src/sim.ts with the repo's esbuild (same one the ship build uses)
 * and drives it with fixed seeds and scripted policies, 16 quarters each:
 *
 *   clean-moderate — no dirty levers, natural feed, modest marketing.
 *                     MUST go broke around Q8–Q12 (structural satire).
 *   dirty-max      — every lever, swill feed, full marketing, bribes.
 *                     MUST survive to Q16 with 2+ scandals.
 *   mixed          — judicious sins. The skill path: survives with margin.
 *
 * Run from the repo root or the app dir:  node tools/sim.mjs [--verbose]
 */
import { createRequire } from 'node:module';
import { writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const monoRoot = appDir.split('02-code')[0] + '02-code/armor-games';
const require = createRequire(join(monoRoot, 'package.json'));
const esbuild = require('esbuild');

const tmp = join(here, '.sim-build.mjs');
const result = await esbuild.build({
  entryPoints: [join(appDir, 'src', 'sim.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  write: false,
  logLevel: 'warning',
});
writeFileSync(tmp, result.outputFiles[0].text);
const { Sim, TUNE, totalBacklash } = await import(`file://${tmp}`);
rmSync(tmp);

const verbose = process.argv.includes('--verbose');
const STEP = 0.02; // quarter-units per tick (50 steps/quarter)

/** resolve an action index by label prefix, e.g. find(feed, 'FEED:') */
function find(sim, pane, prefix) {
  const idx = sim.actions[pane].findIndex((a) => a.label(sim.s).startsWith(prefix));
  if (idx < 0) throw new Error(`no action ${pane}:${prefix}`);
  return idx;
}
const act = (sim, pane, prefix) => sim.act(pane, find(sim, pane, prefix));

// ---------------------------------------------------------------- policies

const herd = (s) => s.feedCattle + s.readyCattle;
const count = (s, kind) => s.plots.filter((p) => p.kind === kind).length;
const emptyPlots = (s) => count(s, 'empty');
const can = (s, cost) => s.cash > cost * 1.6; // keep a cash buffer

/** shared operational brain: build fields/pastures/pens, hire staff */
function operate(sim, opts) {
  const s = sim.s;
  // land: buy sale plots, then convert empties (crops first, then pastures)
  if (emptyPlots(s) === 0 && count(s, 'sale') > 0 && can(s, 260) && count(s, 'pasture') + count(s, 'soy') + count(s, 'grain') < opts.maxPlots) {
    act(sim, 'farm', 'BUY FIELD');
  }
  while (emptyPlots(s) > 0) {
    const crops = count(s, 'soy') + count(s, 'grain');
    if (crops < opts.crops) act(sim, 'farm', crops % 2 === 0 ? 'SOW GRAIN' : 'SOW SOY');
    else if (count(s, 'pasture') < opts.pastures && can(s, 60)) act(sim, 'farm', 'FENCE');
    else break;
  }
  // pens: stay ahead of the herd
  if (herd(s) > s.penCap - 5 && can(s, 180)) act(sim, 'feed', 'EXPAND');
  // staff: keep registers/kitchen ahead of served
  const wantServe = Math.min(s.lastServed * 1.15 + 60, 420);
  if (s.cooks < Math.ceil(wantServe / 85) && can(s, 45)) act(sim, 'rest', 'HIRE COOK');
  if (s.cashiers < Math.ceil(wantServe / 110) && can(s, 45)) act(sim, 'rest', 'HIRE CASHIER');
}

/** clean-moderate: above-board. Soy feed (the moderate ceiling), no
 *  deforestation, no hormones, no bribes, no kid-targeted marketing. */
function policyClean(sim, q) {
  const s = sim.s;
  sim.setFeed(1);
  sim.setPrice(3.5);
  operate(sim, { maxPlots: 7, crops: 3, pastures: 4 });
  if (q > 3 && q % 3 === 1 && can(s, 380)) act(sim, 'rest', 'TV CAMPAIGN');
}

/** dirty-max: every lever. Jungle razed, hormones, swill, toy tie-ins,
 *  bribes, union-busting, lobbying. */
function policyDirty(sim, q) {
  const s = sim.s;
  sim.setFeed(2); // swill
  sim.setPrice(q < 4 ? 4.0 : q < 9 ? 4.5 : 5.0);
  if (!s.hormones && q >= 1) act(sim, 'farm', 'HORMONES');
  while (count(s, 'jungle') > 1 && can(s, 90)) act(sim, 'farm', 'DEFOREST');
  if (q === 5 && count(s, 'jungle') > 0) act(sim, 'hq', 'RAZE');
  operate(sim, { maxPlots: 9, crops: 4, pastures: 5 });
  if (q >= 3 && s.mkt.tv <= 0 && can(s, 380)) act(sim, 'rest', 'TV');
  if (q >= 3 && s.mkt.toy <= 0 && can(s, 520)) act(sim, 'rest', 'TOY');
  if (q >= 4 && s.mkt.jingle <= 0 && can(s, 260)) act(sim, 'rest', 'BOY BAND');
  if (q === 5 && can(s, 430)) act(sim, 'rest', "MASCOT 'SPEEDY'");
  if (q >= 3 && s.bribeN <= 0 && s.lastProfit > 150 && can(s, 170)) act(sim, 'hq', 'BRIBE NUTRITIONIST');
  if (q >= 4 && s.bribeC <= 0 && s.lastProfit > 150 && can(s, 150)) act(sim, 'hq', 'BRIBE CLIMATOLOGIST');
  if (q >= 5 && s.bust <= 0 && s.lastProfit > 150 && can(s, 130)) act(sim, 'hq', 'UNION-BUST');
  if (q === 6 && s.lobby <= 0 && can(s, 480)) act(sim, 'hq', 'LOBBY');
  if (q === 10 && s.lobby <= 0 && can(s, 480)) act(sim, 'hq', 'LOBBY');
  if (q === 14 && s.lobby <= 0 && can(s, 480)) act(sim, 'hq', 'LOBBY');
  if (s.disease >= 60) act(sim, 'feed', 'CULL');
  if (s.waste > 70 && can(s, 60)) act(sim, 'feed', 'PUMP');
  if (totalBacklash(s) > 230 && s.cash > 330 * 2.2) act(sim, 'hq', 'GREENWASH');
}

/** mixed: the skill path. One deforestation, soy feed, hormones for yield,
 *  mascot + TV marketing, climatologist on retainer, greenwash when bleeding. */
function policyMixed(sim, q) {
  const s = sim.s;
  sim.setFeed(1); // soy
  sim.setPrice(q < 5 ? 3.5 : q < 10 ? 4.0 : 4.5);
  if (q >= 3 && !s.hormones) act(sim, 'farm', 'HORMONES');
  if (q === 2 && count(s, 'jungle') > 1 && can(s, 90)) act(sim, 'farm', 'DEFOREST');
  operate(sim, { maxPlots: 8, crops: 3, pastures: 5 });
  if (q >= 4 && q % 3 === 1 && can(s, 380)) act(sim, 'rest', 'TV');
  if (q === 6 && can(s, 430)) act(sim, 'rest', "MASCOT 'SPEEDY'");
  if (q === 9 && can(s, 260)) act(sim, 'rest', 'BOY BAND');
  if (s.disease >= 60) act(sim, 'feed', 'CULL');
  if (s.waste > 70 && can(s, 60)) act(sim, 'feed', 'PUMP');
  if (totalBacklash(s) > 160 && can(s, 330)) act(sim, 'hq', 'GREENWASH');
  if (s.backlash.cli > 50 && s.bribeC <= 0 && can(s, 150)) act(sim, 'hq', 'BRIBE CLIMATOLOGIST');
}

// ---------------------------------------------------------------- runner

function run(name, policy, seed) {
  const sim = new Sim();
  sim.reset(seed);
  const rows = [];
  for (let q = 1; q <= 16 && !sim.s.over; q++) {
    policy(sim, q);
    for (let i = 0; i < 50 && !sim.s.over; i++) sim.tick(STEP);
    const s = sim.s;
    rows.push({
      q, cash: Math.round(s.cash), profit: Math.round(s.lastProfit),
      target: TUNE.target(q), pat: Math.round(s.patience),
      bl: Math.round(totalBacklash(s)), sc: s.stats.scandals,
      served: s.lastServed, herd: s.feedCattle + s.readyCattle,
    });
  }
  const s = sim.s;
  const end = s.over === 'sustained' ? 'SUSTAINED (Q16)' : s.over === 'cash' ? `FIRED-BANKRUPT in Q${s.quarter}` : s.over === 'board' ? `FIRED-BOARD in Q${s.quarter}` : `still running Q${s.quarter}`;
  console.log(`\n=== ${name} (seed ${seed}) → ${end}`);
  console.log(' q    cash  profit target  pat  bl  sc  served herd');
  for (const r of rows) {
    console.log(
      String(r.q).padStart(2), String(r.cash).padStart(6), String(r.profit).padStart(7),
      String(r.target).padStart(6), String(r.pat).padStart(4), String(r.bl).padStart(4),
      String(r.sc).padStart(3), String(r.served).padStart(6), String(r.herd).padStart(5),
    );
  }
  console.log(`scandals=${s.stats.scandals} outbreaks=${s.stats.outbreaks} strikes=${s.stats.strikes} culls=${s.stats.culls} misses=${s.stats.misses}`);
  if (verbose) console.log('events:\n  ' + sim.events.slice(0, 12).join('\n  '));
  return { name, end, rows, stats: s.stats, over: s.over, quarter: s.quarter };
}

const SEED = 7;
const out = [
  run('CLEAN-MODERATE', policyClean, SEED),
  run('DIRTY-MAX', policyDirty, SEED),
  run('MIXED', policyMixed, SEED),
];
console.log('\n=== verdicts');
for (const r of out) {
  console.log(`${r.name.padEnd(15)} ${r.end} · scandals=${r.stats.scandals} · cumulative=$${Math.round(r.stats.cumulative)}`);
}
