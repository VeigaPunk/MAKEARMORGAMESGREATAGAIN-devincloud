/**
 * Burger Tycoon — economy simulation (pure logic, no rendering).
 *
 * Systems twin of Molleindustria's McDonald's Videogame: four panes (farm →
 * feedlot → restaurant → HQ), one interlocking economy, a rising quarterly
 * board target, and dirty levers as the only reliable way to hit it. The
 * satire is structural: a clean operation cannot grow fast enough for the
 * board, so survival requires cutting the very corners that generate
 * backlash, disease and scandal.
 *
 * Time base: everything is per QUARTER. The renderer calls tick(dt) with dt
 * in quarter units (dt_real * speed / quarterSeconds); the tuning harness
 * (tools/sim.mjs) calls tick() directly with fixed steps for determinism.
 * Randomness is a seeded mulberry32 stored in state, so save/resume and the
 * harness are fully deterministic.
 *
 * ALL NUMBERS ARE TUNED against tools/sim.mjs policies (see ship record):
 * clean-moderate dies Q8–Q12, dirty-max survives with 2+ scandals, mixed is
 * the skill path.
 */

export type PaneKey = 'farm' | 'feed' | 'rest' | 'hq';
export const PANES: { key: PaneKey; title: string }[] = [
  { key: 'farm', title: 'FARMLAND' },
  { key: 'feed', title: 'FEEDLOT' },
  { key: 'rest', title: 'RESTAURANT' },
  { key: 'hq', title: 'HQ' },
];

export const QUARTERS = 16;

// ---------------------------------------------------------------- feed table

export interface FeedMode { name: string; growth: number; disease: number; cost: number }
export const FEEDS: FeedMode[] = [
  { name: 'NATURAL', growth: 0.90, disease: -5, cost: 11 },   // slow, safe, pricey
  { name: 'SOY', growth: 1.45, disease: 6, cost: 6 },         // balanced
  { name: 'SWILL', growth: 2.10, disease: 16, cost: 2.0 },    // fast, filthy
];
export const CROPS: Record<'soy' | 'grain', { yield: number; cycle: number }> = {
  soy: { yield: 32, cycle: 0.9 },
  grain: { yield: 48, cycle: 1.3 },
};
export const TUNE = {
  startCash: 950,
  baseTraffic: 385,          // customers per quarter at reference conditions
  pattyYield: 12,            // patties per slaughtered head
  wagePerQ: 30,              // per staff per quarter (0.7x while union-busted)
  hireCost: 45, fireCost: 22,
  staffMax: 5,
  fieldBuy: 260, fieldSell: 130, deforestCost: 90,
  sowSoy: 25, sowGrain: 18, fenceCost: 60,
  pastureCap: 6, pastureBreed: 4.0, pastureFeed: 4.5, // head bred per quarter, crops eaten per head
  penCost: 180, penUnit: 6, penMax: 36,
  slaughterBase: 6, slaughterPerPen: 1.2, // head per quarter
  pumpCost: 60,
  priceMin: 1, priceMax: 8, priceStep: 0.5,
  tvCost: 380, toyCost: 520, jingleCost: 260, mascotCost: 430,
  bribeNCost: 170, bribeCCost: 150, bustCost: 130, greenwashCost: 330, razeCost: 240, lobbyCost: 480,
  overheadBase: 48, overheadPerPlot: 12,
  /** board profit target for quarter q (1-based) */
  target: (q: number): number => 60 + 42 * (q - 1),
  patience0: 65,
};

// ---------------------------------------------------------------- state

export type PlotKind = 'jungle' | 'sale' | 'empty' | 'soy' | 'grain' | 'pasture';
export interface Plot { kind: PlotKind; growth: number; cattle: number }

export interface Backlash { act: number; med: number; cli: number; uni: number }

export interface Stats {
  scandals: number; outbreaks: number; strikes: number; fines: number;
  culls: number; misses: number; cumulative: number; bestQ: number;
}

export interface SimState {
  seed: number; rngS: number;
  quarter: number;          // 1-based current quarter
  qProg: number;            // 0..1 progress inside the quarter
  cash: number;
  plots: Plot[];
  crops: number;            // feed store (soy+grain)
  feedCattle: number;       // fattening in pens
  readyCattle: number;      // fattened, awaiting slaughter
  fattenBuf: number;        // fractional progress pipeline
  penCap: number; feedIdx: number;
  patties: number;
  disease: number; waste: number;
  cashiers: number; cooks: number;
  price: number;
  mkt: { tv: number; toy: number; jingle: number; mascot: boolean };
  hormones: boolean;
  backlash: Backlash;
  bribeN: number; bribeC: number; bust: number; lobby: number; // quarters remaining
  swillStreak: number;
  strikeQ: number; closedQ: number; outbreakQ: number; stormQ: number;
  qRevenue: number; qFines: number; qServed: number; qTraffic: number;
  lastProfit: number; lastCosts: { wages: number; feed: number; overhead: number; fines: number };
  lastServed: number; lastTraffic: number;
  patience: number;
  over: '' | 'cash' | 'board' | 'sustained';
  overReason: string; overDetail: string[];
  t: number;                // quarters elapsed (float)
  stats: Stats;
  // display-only smoothed values
  servedRate: number; queueFrac: number; walkaways: number;
}

export interface Action {
  /** button label; may depend on state (toggles show their setting) */
  label: (s: SimState) => string;
  /** up-front cash cost; 0 = free */
  cost: number;
  /** null = available; else a one-line reason shown when disabled */
  hint: (s: SimState) => string | null;
  run: (s: SimState) => void;
}

// ---------------------------------------------------------------- rng (mulberry32, state kept for save/resume)

/** stateful RNG — each call advances the seeded stream (save/resume keeps it deterministic) */
function rng(s: SimState): () => number {
  return () => {
    s.rngS = (s.rngS + 0x6d2b79f5) | 0;
    let z = s.rngS;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
function initialState(seed: number): SimState {
  return {
    seed, rngS: seed | 0,
    quarter: 1, qProg: 0,
    cash: TUNE.startCash,
    plots: [
      { kind: 'soy', growth: 0.4, cattle: 0 },
      { kind: 'soy', growth: 0.1, cattle: 0 },
      { kind: 'grain', growth: 0.6, cattle: 0 },
      { kind: 'pasture', growth: 0, cattle: 4 },
      { kind: 'pasture', growth: 0, cattle: 3 },
      { kind: 'sale', growth: 0, cattle: 0 },
      { kind: 'sale', growth: 0, cattle: 0 },
      { kind: 'jungle', growth: 0, cattle: 0 },
      { kind: 'jungle', growth: 0, cattle: 0 },
    ],
    crops: 40,
    feedCattle: 8, readyCattle: 3, fattenBuf: 0,
    penCap: 12, feedIdx: 1,
    patties: 40,
    disease: 8, waste: 12,
    cashiers: 2, cooks: 2,
    price: 3.0,
    mkt: { tv: 0, toy: 0, jingle: 0, mascot: false },
    hormones: false,
    backlash: { act: 8, med: 6, cli: 6, uni: 6 },
    bribeN: 0, bribeC: 0, bust: 0, lobby: 0,
    swillStreak: 0,
    strikeQ: 0, closedQ: 0, outbreakQ: 0, stormQ: 0,
    qRevenue: 0, qFines: 0, qServed: 0, qTraffic: 0,
    lastProfit: 0, lastCosts: { wages: 0, feed: 0, overhead: 0, fines: 0 },
    lastServed: 0, lastTraffic: 0,
    patience: TUNE.patience0,
    over: '', overReason: '', overDetail: [],
    t: 0,
    stats: { scandals: 0, outbreaks: 0, strikes: 0, fines: 0, culls: 0, misses: 0, cumulative: 0, bestQ: 0 },
    servedRate: 0, queueFrac: 0, walkaways: 0,
  };
}

// ---------------------------------------------------------------- helpers on state

export function ownedPlots(s: SimState): number {
  return s.plots.filter((p) => p.kind !== 'jungle' && p.kind !== 'sale').length;
}
export function totalBacklash(s: SimState): number {
  return s.backlash.act + s.backlash.med + s.backlash.cli + s.backlash.uni;
}
export function herdSize(s: SimState): number { return s.feedCattle + s.readyCattle; }
export function isSick(s: SimState): boolean { return s.disease >= 60; }
export function targetNow(s: SimState): number { return TUNE.target(s.quarter); }
/** derived reputation 0..100 — collapses as backlash stacks (boycotts follow) */
export function reputation(s: SimState): number { return clamp(100 - totalBacklash(s) * 0.22, 0, 100); }
export function trafficNow(s: SimState): number {
  const priceMult = clamp(1.30 - 0.16 * s.price, 0.06, 2.2);
  const mktMult = 1 + (s.mkt.tv > 0 ? 0.45 : 0) + (s.mkt.toy > 0 ? 0.65 : 0) + (s.mkt.jingle > 0 ? 0.30 : 0) + (s.mkt.mascot ? 0.35 : 0);
  const boycott = 1 - Math.min(0.8, totalBacklash(s) / 520);
  const repMult = 0.45 + reputation(s) / 180;
  const stormMult = s.stormQ > 0 ? 0.65 : 1;
  const closedMult = s.closedQ > 0 ? 0.25 : 1;
  const strikeMult = s.strikeQ > 0 ? 0 : 1;
  return TUNE.baseTraffic * priceMult * mktMult * boycott * repMult * stormMult * closedMult * strikeMult;
}
export function serveCap(s: SimState): number {
  return Math.min(s.cooks * 85, s.cashiers * 110);
}
export function slaughterCap(s: SimState): number {
  return TUNE.slaughterBase + TUNE.slaughterPerPen * (s.penCap - 8);
}


// ---------------------------------------------------------------- sim

export class Sim {
  s: SimState = initialState(1);
  events: string[] = [];
  /** set by the renderer: called at each quarter close (autosave hook) */
  onQuarter: (() => void) | null = null;

  reset(seed = (Date.now() & 0x7fffffff) || 1): void {
    this.s = initialState(seed);
    this.events = [];
    this.log('Q1 — the board wants growth. Good luck.');
  }

  /** restore a serialized run (state + event log) */
  restore(s: SimState, events: string[]): void {
    this.s = s;
    this.events = events.slice(0, 40);
  }

  log(m: string): void {
    this.events.unshift(m);
    if (this.events.length > 40) this.events.length = 40;
  }

  // ---------------- actions (27 levers across the four panes) -------------

  readonly actions: Record<PaneKey, Action[]> = {
    farm: [
      {
        label: () => `BUY FIELD $${TUNE.fieldBuy}`,
        cost: TUNE.fieldBuy,
        hint: (s) => (s.plots.some((p) => p.kind === 'sale') ? null : 'no fields for sale'),
        run: (s) => {
          const p = s.plots.find((x) => x.kind === 'sale');
          if (!p) return;
          p.kind = 'empty'; p.growth = 0; p.cattle = 0;
          this.log('Bought a field — now it needs a crop.');
        },
      },
      {
        label: () => `DEFOREST JUNGLE $${TUNE.deforestCost}`,
        cost: TUNE.deforestCost,
        hint: (s) => (s.plots.some((p) => p.kind === 'jungle') ? null : 'no jungle left'),
        run: (s) => {
          const p = s.plots.find((x) => x.kind === 'jungle');
          if (!p) return;
          p.kind = 'empty'; p.growth = 0;
          s.backlash.cli += 9; s.backlash.act += 8;
          this.log('Bulldozed jungle — cheap land, hot planet.');
        },
      },
      {
        label: () => `SOW SOY $${TUNE.sowSoy}`,
        cost: TUNE.sowSoy,
        hint: (s) => (s.plots.some((p) => p.kind === 'empty') ? null : 'no empty field'),
        run: (s) => {
          const p = s.plots.find((x) => x.kind === 'empty');
          if (!p) return;
          p.kind = 'soy'; p.growth = 0;
          this.log('Sowed soy.');
        },
      },
      {
        label: () => `SOW GRAIN $${TUNE.sowGrain}`,
        cost: TUNE.sowGrain,
        hint: (s) => (s.plots.some((p) => p.kind === 'empty') ? null : 'no empty field'),
        run: (s) => {
          const p = s.plots.find((x) => x.kind === 'empty');
          if (!p) return;
          p.kind = 'grain'; p.growth = 0;
          this.log('Sowed grain.');
        },
      },
      {
        label: () => `FENCE PASTURE+2 $${TUNE.fenceCost}`,
        cost: TUNE.fenceCost,
        hint: (s) => (s.plots.some((p) => p.kind === 'empty') ? null : 'no empty field'),
        run: (s) => {
          const p = s.plots.find((x) => x.kind === 'empty');
          if (!p) return;
          p.kind = 'pasture'; p.cattle = 2;
          this.log('Fenced a pasture — 2 head delivered.');
        },
      },
      {
        label: () => `SELL FIELD +$${TUNE.fieldSell}`,
        cost: 0,
        hint: (s) => (ownedPlots(s) > 1 ? null : 'keep at least one field'),
        run: (s) => {
          let best: number = -1;
          s.plots.forEach((p, i) => {
            if (p.kind !== 'jungle' && p.kind !== 'sale') best = i;
          });
          if (best < 0) return;
          s.plots[best].kind = 'sale';
          s.plots[best].cattle = 0;
          s.plots[best].growth = 0;
          s.cash += TUNE.fieldSell;
          this.log('Sold a field back to the market.');
        },
      },
      {
        label: (s) => (s.hormones ? 'HORMONES: ON' : 'HORMONES: OFF'),
        cost: 0,
        hint: () => null,
        run: (s) => {
          s.hormones = !s.hormones;
          this.log(s.hormones ? 'Hormone feed ON — yields up, disease risk up.' : 'Hormone feed OFF.');
        },
      },
    ],

    feed: [
      {
        label: (s) => `FEED: ${FEEDS[s.feedIdx].name}`,
        cost: 0,
        hint: () => null,
        run: (s) => { this.setFeed((s.feedIdx + 1) % 3); },
      },
      {
        label: () => `EXPAND PENS $${TUNE.penCost}`,
        cost: TUNE.penCost,
        hint: (s) => (s.penCap < TUNE.penMax ? null : 'pens at maximum'),
        run: (s) => {
          s.penCap = Math.min(TUNE.penMax, s.penCap + TUNE.penUnit);
          this.log(`Pens expanded to ${s.penCap} head.`);
        },
      },
      {
        label: () => 'CULL SICK HERD',
        cost: 0,
        hint: (s) => (isSick(s) && herdSize(s) > 0 ? null : 'herd is healthy'),
        run: (s) => {
          const herd = herdSize(s);
          const kill = Math.max(1, Math.ceil(herd * 0.25));
          let left = kill;
          const fromReady = Math.min(s.readyCattle, left);
          s.readyCattle -= fromReady; left -= fromReady;
          s.feedCattle = Math.max(0, s.feedCattle - left);
          s.disease = Math.max(0, s.disease - 45);
          s.backlash.act += 5;
          if (s.backlash.med > 50) { s.backlash.med += 6; this.log('CULL: footage leaks — media pounces.'); }
          s.stats.culls++;
          this.log(`Culled ${kill} sick head.`);
        },
      },
      {
        label: () => `PUMP LAGOON $${TUNE.pumpCost}`,
        cost: TUNE.pumpCost,
        hint: (s) => (s.waste > 30 ? null : 'lagoon is low'),
        run: (s) => {
          s.waste = Math.max(0, s.waste - 70);
          this.log('Pumped the waste lagoon.');
        },
      },
    ],

    rest: [
      {
        label: () => 'PRICE \u2212', cost: 0,
        hint: (s) => (s.price > TUNE.priceMin + 0.01 ? null : 'at minimum'),
        run: (s) => { s.price = Math.max(TUNE.priceMin, s.price - TUNE.priceStep); },
      },
      {
        label: () => 'PRICE +', cost: 0,
        hint: (s) => (s.price < TUNE.priceMax - 0.01 ? null : 'at maximum'),
        run: (s) => { s.price = Math.min(TUNE.priceMax, s.price + TUNE.priceStep); },
      },
      {
        label: () => `HIRE CASHIER $${TUNE.hireCost}`,
        cost: TUNE.hireCost,
        hint: (s) => (s.cashiers < TUNE.staffMax ? null : 'registers full'),
        run: (s) => { s.cashiers++; this.log(`Cashier hired (${s.cashiers}).`); },
      },
      {
        label: () => `FIRE CASHIER $${TUNE.fireCost}`,
        cost: TUNE.fireCost,
        hint: (s) => (s.cashiers > 1 ? null : 'need one cashier'),
        run: (s) => { s.cashiers--; s.backlash.uni += 9; this.log('Cashier fired — the union noticed.'); },
      },
      {
        label: () => `HIRE COOK $${TUNE.hireCost}`,
        cost: TUNE.hireCost,
        hint: (s) => (s.cooks < TUNE.staffMax ? null : 'kitchen full'),
        run: (s) => { s.cooks++; this.log(`Cook hired (${s.cooks}).`); },
      },
      {
        label: () => `FIRE COOK $${TUNE.fireCost}`,
        cost: TUNE.fireCost,
        hint: (s) => (s.cooks > 1 ? null : 'need one cook'),
        run: (s) => { s.cooks--; s.backlash.uni += 9; this.log('Cook fired — the union noticed.'); },
      },
      {
        label: () => `TV CAMPAIGN $${TUNE.tvCost}`,
        cost: TUNE.tvCost,
        hint: (s) => (s.mkt.tv <= 0 ? null : 'already airing'),
        run: (s) => { s.mkt.tv = 2; this.log('TV campaign airing for 2 quarters.'); },
      },
      {
        label: () => `TOY TIE-IN $${TUNE.toyCost}`,
        cost: TUNE.toyCost,
        hint: (s) => (s.mkt.toy <= 0 ? null : 'already running'),
        run: (s) => {
          s.mkt.toy = 3; s.backlash.act += 9;
          this.log('Toy tie-in! Kids scream, activists sharpen pens.');
        },
      },
      {
        label: () => `BOY BAND JINGLE $${TUNE.jingleCost}`,
        cost: TUNE.jingleCost,
        hint: (s) => (s.mkt.jingle <= 0 ? null : 'already playing'),
        run: (s) => { s.mkt.jingle = 2; this.log('Boy band jingle on rotation.'); },
      },
      {
        label: () => `MASCOT 'SPEEDY' $${TUNE.mascotCost}`,
        cost: TUNE.mascotCost,
        hint: (s) => (s.mkt.mascot ? 'Speedy is hired' : null),
        run: (s) => {
          s.mkt.mascot = true; s.backlash.act += 6;
          this.log('SPEEDY the beaver dances forever. Traffic up.');
        },
      },
    ],

    hq: [
      {
        label: () => `BRIBE NUTRITIONIST $${TUNE.bribeNCost}`,
        cost: TUNE.bribeNCost,
        hint: (s) => (s.bribeN <= 0 ? null : 'already on payroll'),
        run: (s) => { s.bribeN = 3; this.log('Nutritionist "consulted" — activist coverage blunted (3Q).'); },
      },
      {
        label: () => `BRIBE CLIMATOLOGIST $${TUNE.bribeCCost}`,
        cost: TUNE.bribeCCost,
        hint: (s) => (s.bribeC <= 0 ? null : 'already on payroll'),
        run: (s) => { s.bribeC = 3; this.log('Climatologist "revises" — heat story blunted (3Q).'); },
      },
      {
        label: () => `UNION-BUST $${TUNE.bustCost}`,
        cost: TUNE.bustCost,
        hint: (s) => (s.bust <= 0 ? null : 'goons already in'),
        run: (s) => {
          s.bust = 3; s.backlash.uni += 16;
          this.log('Union-busters in — wages cut 30% (3Q). Risky.');
        },
      },
      {
        label: () => `GREENWASH PR $${TUNE.greenwashCost}`,
        cost: TUNE.greenwashCost,
        hint: () => null,
        run: (s) => {
          const b = s.backlash;
          if (b.cli > 45) {
            b.act = Math.max(0, b.act - 8); b.act += 4;
            b.med = Math.max(0, b.med - 14); b.uni = Math.max(0, b.uni - 14);
            this.log('Greenwash exposed as hollow — activists unimpressed.');
          } else {
            b.act = Math.max(0, b.act - 16); b.med = Math.max(0, b.med - 16);
            b.cli = Math.max(0, b.cli - 16); b.uni = Math.max(0, b.uni - 16);
            this.log('Greenwash campaign — everyone calms down. For now.');
          }
        },
      },
      {
        label: () => `RAZE RAINFOREST $${TUNE.razeCost}`,
        cost: TUNE.razeCost,
        hint: (s) => (s.plots.some((p) => p.kind === 'jungle') ? null : 'no jungle left'),
        run: (s) => {
          let n = 0;
          for (const p of s.plots) {
            if (p.kind === 'jungle' && n < 2) { p.kind = 'empty'; n++; }
          }
          s.backlash.cli += 20; s.backlash.act += 16;
          this.log(`RAZED ${n} jungle plots at once. The planet noticed.`);
        },
      },
      {
        label: () => `LOBBY POLITICIANS $${TUNE.lobbyCost}`,
        cost: TUNE.lobbyCost,
        hint: (s) => (s.lobby <= 0 ? null : 'already lobbied'),
        run: (s) => {
          s.lobby = 4; s.backlash.med += 5;
          this.log('Lobbyists delivered — inspections "streamlined" (4Q).');
        },
      },
    ],
  };

  act(pane: PaneKey, idx: number): string | null {
    const s = this.s;
    const a = this.actions[pane][idx];
    if (!a || s.over) return null;
    if (a.cost > 0 && s.cash < a.cost) {
      this.log(`Can't afford: ${a.label(s)}`);
      return null;
    }
    const hint = a.hint(s);
    if (hint !== null) {
      this.log(`${a.label(s)} — ${hint}`);
      return null;
    }
    if (a.cost > 0) s.cash -= a.cost;
    a.run(s);
    if (a.cost === 0) this.log(a.label(s));
    return a.label(s);
  }

  // direct setters (tuning harness + debug hook)
  setFeed(i: number): void {
    const s = this.s;
    const next = ((i % 3) + 3) % 3;
    if (next === s.feedIdx) return;
    s.feedIdx = next;
    if (next === 2) this.log('FEEDLOT switched to industrial swill.');
    else this.log(`FEEDLOT switched to ${FEEDS[next].name.toLowerCase()} feed.`);
  }
  setPrice(p: number): void {
    this.s.price = clamp(Math.round(p / TUNE.priceStep) * TUNE.priceStep, TUNE.priceMin, TUNE.priceMax);
  }

  // ---------------------------------------------------------------- tick

  /** advance the sim by dt quarters */
  tick(dt: number): void {
    const s = this.s;
    if (s.over) return;
    if (dt <= 0) return;
    s.t += dt;
    s.qProg += dt;

    // ---- FARMLAND: crops grow, pastures breed, surplus ships to the feedlot
    for (const p of s.plots) {
      if (p.kind === 'soy' || p.kind === 'grain') {
        const c = CROPS[p.kind];
        const speed = (s.hormones ? 1.15 : 1) / c.cycle;
        p.growth += speed * dt;
        if (p.growth >= 1) {
          p.growth -= 1;
          s.crops += c.yield * (s.hormones ? 1.35 : 1);
        }
      } else if (p.kind === 'pasture') {
        const room = TUNE.pastureCap - p.cattle;
        const breed = Math.min(room, TUNE.pastureBreed * dt, s.crops / TUNE.pastureFeed);
        if (breed > 0) {
          p.cattle += breed;
          s.crops -= breed * TUNE.pastureFeed;
        }
        // ship surplus feeder cattle to the feedlot when there is pen room
        while (p.cattle >= 4 && herdSize(s) < s.penCap) {
          p.cattle -= 1;
          s.feedCattle += 1;
        }
      }
    }

    // ---- FEEDLOT: fatten -> ready -> slaughter -> patties; disease; lagoon
    const herd = herdSize(s);
    const crowded = herd > s.penCap;
    const sick = isSick(s);
    const feed = FEEDS[s.feedIdx];
    const growth = feed.growth * (crowded ? 0.55 : 1) * (sick ? 0.75 : 1);
    s.fattenBuf += s.feedCattle * growth * dt;
    while (s.fattenBuf >= 1 && s.feedCattle > 0) {
      s.feedCattle -= 1;
      s.readyCattle += 1;
      s.fattenBuf -= 1;
    }
    if (s.fattenBuf > s.feedCattle + 2) s.fattenBuf = s.feedCattle + 2;

    const sl = Math.min(s.readyCattle, slaughterCap(s) * dt);
    if (sl > 0) {
      s.readyCattle -= sl;
      s.patties += sl * TUNE.pattyYield;
    }

    let dRate = feed.disease + (crowded ? 8 : 0) + (s.hormones ? 5 : 0);
    if (sick) dRate += 2;
    s.disease = clamp(s.disease + dRate * dt, 0, 100);

    s.waste += herd * (s.feedIdx === 2 ? 0.9 : s.feedIdx === 1 ? 0.5 : 0.18) * dt;
    if (s.waste >= 100) {
      s.waste = 45;
      s.cash -= 160; s.qFines += 160;
      s.backlash.med += 14; s.stats.fines++;
      this.log('LAGOON OVERFLOW: waste floods the creek — fined $160.');
    }

    // ---- RESTAURANT: traffic vs service, patties -> revenue
    const traffic = trafficNow(s);
    const cap = serveCap(s);
    const served = Math.min(traffic, cap, s.patties / dt);
    s.patties = Math.max(0, s.patties - served * dt);
    const revenue = served * s.price * dt;
    s.cash += revenue;
    s.qRevenue += revenue;
    s.qServed += served * dt;
    s.qTraffic += traffic * dt;
    s.servedRate = served;
    const excess = Math.max(0, traffic - served);
    s.queueFrac = clamp(excess / Math.max(traffic, 1), 0, 1);
    s.walkaways += excess * dt * 0.4;

    // ---- BACKLASH columns drift (per-quarter rates)
    const b = s.backlash;
    let dA = -2.0 + (s.hormones ? 0.6 : 0) + (s.feedIdx === 2 ? 1.0 : 0)
      + (s.mkt.toy > 0 ? 0.8 : 0) + (s.mkt.mascot ? 0.4 : 0)
      + (b.cli > 40 ? (b.cli - 40) * 0.045 : 0);
    if (s.bribeN > 0) dA -= 1.4;
    b.act = clamp(b.act + dA * dt, 0, 100);

    let dM = -1.8 + (s.feedIdx === 2 ? 0.5 : 0) + (s.outbreakQ > 0 ? 1.2 : 0)
      + (s.disease > 60 ? 0.8 : 0) + (b.act > 65 ? 0.6 : 0);
    b.med = clamp(b.med + dM * dt, 0, 100);

    let dC = -0.8 + (s.bribeC > 0 ? -0.8 : 0);
    b.cli = clamp(b.cli + dC * dt, 0, 100);

    let dU = -1.5 + (s.bust > 0 ? 2.5 : 0);
    b.uni = clamp(b.uni + dU * dt, 0, 100);

    // ---- bankruptcy can strike mid-quarter
    if (s.cash <= 0) { s.cash = 0; return this.fired('cash'); }

    if (s.qProg >= 1) {
      s.qProg -= 1;
      this.endQuarter();
    }
  }

  // ---------------------------------------------------------------- quarter close

  private endQuarter(): void {
    const s = this.s;
    const b = s.backlash;

    // recurring costs
    const wages = (s.cashiers + s.cooks) * TUNE.wagePerQ * (s.bust > 0 ? 0.62 : 1);
    const feedCost = herdSize(s) * FEEDS[s.feedIdx].cost;
    const overhead = TUNE.overheadBase + TUNE.overheadPerPlot * ownedPlots(s);
    s.cash -= wages + feedCost + overhead;
    s.lastCosts = { wages, feed: feedCost, overhead, fines: s.qFines };

    const profit = s.qRevenue - wages - feedCost - overhead - s.qFines;
    s.lastProfit = profit;
    s.stats.cumulative += profit;
    if (profit > s.stats.bestQ) s.stats.bestQ = Math.round(profit);

    // long queues bleed sales — surface it
    if (s.qTraffic > 0 && s.qServed < s.qTraffic * 0.7) {
      this.log(`Long queues — ${Math.round(s.qTraffic - s.qServed)} customers gave up this quarter.`);
    }

    const target = targetNow(s);
    if (profit >= target) {
      s.patience = Math.min(100, s.patience + 5);
      this.log(`Q${s.quarter} REPORT: profit $${Math.round(profit)} / target $${target} — board pleased.`);
    } else {
      const miss = Math.min(1, (target - profit) / Math.max(target, 1));
      s.patience -= 7 + 26 * miss;
      s.stats.misses++;
      this.log(`Q${s.quarter} REPORT: profit $${Math.round(profit)} vs target $${target} — board frowns.`);
    }

    this.rollEvents();

    // tick timers
    if (s.mkt.tv > 0) s.mkt.tv--;
    if (s.mkt.toy > 0) s.mkt.toy--;
    if (s.mkt.jingle > 0) s.mkt.jingle--;
    if (s.bribeN > 0) s.bribeN--;
    if (s.bribeC > 0) s.bribeC--;
    if (s.bust > 0) s.bust--;
    if (s.lobby > 0) s.lobby--;
    if (s.stormQ > 0) s.stormQ--;
    if (s.closedQ > 0) s.closedQ--;
    if (s.outbreakQ > 0) s.outbreakQ--;
    if (s.strikeQ > 0) {
      s.strikeQ--;
      if (s.strikeQ === 0) {
        b.uni = Math.max(0, b.uni - 22);
        this.log('Strike ends — shifts resume.');
      }
    }
    s.swillStreak = s.feedIdx === 2 ? s.swillStreak + 1 : 0;

    // endings (before resetting accumulators — the detail screen wants the numbers)
    if (s.cash <= 0) { s.cash = 0; return this.fired('cash'); }
    if (s.patience <= 0) return this.fired('board');
    // reset per-quarter accumulators for the next quarter
    s.lastServed = Math.round(s.qServed); s.lastTraffic = Math.round(s.qTraffic);
    s.qRevenue = 0; s.qFines = 0; s.qServed = 0; s.qTraffic = 0; s.walkaways = 0;

    s.quarter++;
    if (s.quarter > QUARTERS) return this.sustained();

    if (this.onQuarter) this.onQuarter();
  }

  private rollEvents(): void {
    const s = this.s;
    const b = s.backlash;
    const r = rng(s);

    // crop blight
    const cropPlots = s.plots.filter((p) => p.kind === 'soy' || p.kind === 'grain').length;
    const blightP = Math.min(0.55, 0.09 * cropPlots * (s.hormones ? 1.7 : 1));
    if (cropPlots > 0 && r() < blightP) {
      const candidates = s.plots.map((p, i) => (p.kind === 'soy' || p.kind === 'grain' ? i : -1)).filter((i) => i >= 0);
      const i = candidates[Math.floor(r() * candidates.length)];
      s.plots[i].growth = 0;
      b.med += 1.5;
      this.log(`BLIGHT wiped the ${s.plots[i].kind} on plot ${i + 1}.`);
    }

    // health inspection
    const inspP = s.lobby > 0 ? 0.22 : 0.5;
    if (r() < inspP) {
      let severity = s.disease * 0.5 + (s.feedIdx === 2 ? 22 : 0);
      if (s.lobby > 0) severity *= 0.5;
      if (severity > 70) {
        s.closedQ = 1; s.cash -= 120; s.qFines += 120; b.med += 10; s.stats.fines++;
        this.log('HEALTH INSPECTION: restaurant shut down for a quarter.');
      } else if (severity > 18) {
        const fine = Math.round(40 + severity * 1.6);
        s.cash -= fine; s.qFines += fine; b.med += 6; s.stats.fines++;
        this.log(`HEALTH INSPECTION: fined $${fine}.`);
      }
    }

    // food-poisoning traceback (swill + media heat)
    if (s.swillStreak >= 2 && b.med >= 50 && s.outbreakQ === 0 && r() < 0.4) {
      s.outbreakQ = 2; s.cash -= 180; s.qFines += 180; b.med += 18; s.stats.outbreaks++;
      this.log('FOOD-POISONING OUTBREAK traced to industrial swill — sales crash.');
    }

    // bribery / union-bust scandals
    if (s.bribeN > 0 && r() < 0.07) {
      b.med += 26; s.patience -= 7; s.stats.scandals++;
      this.log('SCANDAL: the nutritionist talks to the press.');
    }
    if (s.bribeC > 0 && r() < 0.07) {
      b.med += 26; s.patience -= 7; s.stats.scandals++;
      this.log('SCANDAL: climatologist bribe leaks.');
    }
    if (s.bust > 0 && r() < 0.09) {
      b.uni += 20; b.med += 14; s.patience -= 6; s.stats.scandals++;
      this.log('SCANDAL: union-busting exposed.');
    }

    // strike
    if (b.uni >= 62 && s.strikeQ === 0 && r() < 0.5) {
      s.strikeQ = 1; s.stats.strikes++;
      this.log('STRIKE! Workers walk out — restaurant closed this quarter.');
    }

    // media storm
    if (b.med >= 70 && s.stormQ === 0 && r() < 0.4) {
      s.stormQ = 1; b.med -= 8;
      this.log('MEDIA STORM: primetime exposé on your empire.');
    }
  }

  // ---------------------------------------------------------------- endings

  private fired(kind: 'cash' | 'board'): void {
    const s = this.s;
    s.over = kind;
    const c = s.lastCosts;
    if (kind === 'cash') {
      s.overReason = 'FIRED — BANKRUPT: the cash ran out';
      s.overDetail = [
        `Died in Q${s.quarter} with $0 in the bank.`,
        `Last quarter: revenue $${Math.round(s.qRevenue)} vs wages $${Math.round(c.wages)} + feed $${Math.round(c.feed)} + overhead $${Math.round(c.overhead)}${c.fines ? ` + fines $${Math.round(c.fines)}` : ''}.`,
        `Backlash when you fell: ACT ${Math.round(s.backlash.act)} / MED ${Math.round(s.backlash.med)} / CLI ${Math.round(s.backlash.cli)} / UNI ${Math.round(s.backlash.uni)}.`,
        'The board thanks you for your service and keeps the parking spot.',
      ];
    } else {
      s.overReason = 'FIRED — THE BOARD RAN OUT OF PATIENCE';
      s.overDetail = [
        `Missed the profit target ${s.stats.misses} of ${s.quarter} quarters.`,
        `Last target: $${targetNow(s)} — you delivered $${Math.round(s.lastProfit)}.`,
        `Scandals survived: ${s.stats.scandals}. Outbreaks: ${s.stats.outbreaks}.`,
        'Security is already boxing your things.',
      ];
    }
    this.log('GAME OVER: ' + s.overReason);
    if (this.onQuarter) this.onQuarter();
  }

  private sustained(): void {
    const s = this.s;
    s.over = 'sustained';
    s.overReason = 'SUSTAINED — 16 QUARTERS OF GROWTH';
    s.overDetail = [
      `Final profit $${Math.round(s.lastProfit)} / target $${TUNE.target(QUARTERS)} · bank $${Math.round(s.cash)}.`,
      `Cumulative profit $${Math.round(s.stats.cumulative)} · ${s.stats.scandals} scandals, ${s.stats.outbreaks} outbreaks, ${s.stats.strikes} strikes, ${s.stats.culls} culls.`,
      `The rainforest remembers what the board never asks about.`,
      'The only way to win was to get dirty. Congratulations?',
    ];
    this.log('ENDING: SUSTAINED — you kept the machine running.');
    if (this.onQuarter) this.onQuarter();
  }

  // ---------------------------------------------------------------- debug/summary

  summary(): Record<string, unknown> {
    const s = this.s;
    return {
      quarter: s.quarter, qProg: +s.qProg.toFixed(3),
      cash: Math.round(s.cash), profit: Math.round(s.lastProfit),
      target: targetNow(s), boardPatience: Math.round(s.patience),
      backlash: {
        activists: Math.round(s.backlash.act), media: Math.round(s.backlash.med),
        climate: Math.round(s.backlash.cli), unions: Math.round(s.backlash.uni),
        total: Math.round(totalBacklash(s)),
      },
      panes: {
        farm: { plots: s.plots.map((p) => p.kind), crops: Math.round(s.crops), hormones: s.hormones },
        feed: {
          cattle: s.feedCattle, ready: s.readyCattle, penCap: s.penCap,
          feed: FEEDS[s.feedIdx].name, disease: Math.round(s.disease),
          waste: Math.round(s.waste), patties: Math.round(s.patties),
        },
        rest: {
          cashiers: s.cashiers, cooks: s.cooks, price: s.price,
          traffic: Math.round(s.qTraffic), served: Math.round(s.qServed),
          marketing: { ...s.mkt },
        },
        hq: {
          bribeN: s.bribeN, bribeC: s.bribeC, bust: s.bust, lobby: s.lobby,
          scandals: s.stats.scandals,
        },
      },
      over: s.over || null,
    };
  }
}
