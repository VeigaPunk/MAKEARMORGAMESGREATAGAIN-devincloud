/**
 * IMPOSSIBLE RUN — campaign data (pure module: no DOM, no imports).
 *
 * Shared by src/main.ts (game) and tools/prove.mjs (clearability solver,
 * which re-bundles this file and copies the physics constants).
 *
 * Feel reference: The Impossible Game (2010) — one-button rhythm autorunner.
 * Track set evokes the original five (fire opener / plain square / dense
 * spikes / airy gaps / finale); every name, layout and song here is original.
 *
 * AudioSyncClock: obstacles are authored on the level's own 16th-note grid.
 * pxStep = SPEED * stepMs / 1000 = 360 * 15 / bpm = 5400 / bpm, so one grid
 * step of travel is exactly one 16th note of the level's song. With SPEED and
 * the song both starting at x=0 (or at a grid-snapped checkpoint), every jump
 * window lands on the beat.
 */

export interface Obstacle { t: 'gap' | 'spike' | 'block'; x: number; w: number; h?: number }

export interface Palette {
  skyTop: string; skyBot: string;    // bg gradient (top → bottom)
  ground: string; groundEdge: string;
  ink: string;                       // HUD text on the run screen
  spike: string; spikeEdge: string;
  block: string; blockEdge: string;
  cube: string; cubeEdge: string;
  accent: string;                    // flags / progress bar / highlights
  deco: string;                      // parallax layer
}

export type Deco = 'embers' | 'grid' | 'stars' | 'clouds' | 'phase';

/** one melodic voice; notes are Hz (0 = rest), authored via hz() from A4-semitone arrays */
export interface TrackSpec { wave: 'square' | 'triangle' | 'sawtooth' | 'sine'; notes: number[]; gain?: number; gate?: number; lp?: number }
export interface SongSpec { tracks: TrackSpec[]; drums?: string; drumGain?: number }

export interface LevelSpec {
  name: string;
  bpm: number;
  pxStep: number;
  end: number;                 // finish line x (grid multiple)
  totalSteps: number;
  obstacles: Obstacle[];
  checkpoints: number[];       // practice flags — grid-snapped, spawn-safe, solver-verified
  palette: Palette;
  deco: Deco;
  song: SongSpec;
}

// ---- music helpers -----------------------------------------------------------

const N = (s: number): number => 440 * Math.pow(2, s / 12);  // semitones from A4 → Hz
const R = null;                                              // rest
type NN = number | null;

/** bar of a steady 8th-note root pump with an octave pop on the last 8th */
function pump(root: number): NN[] {
  return [R, root, R, root, R, root, R, root, R, root, R, root, R, root, R, root + 12];
}
/** quarter-note whole-bar sustain values repeated to fill a 16-step bar */
function hold(notes: NN[]): NN[] {
  const bar: NN[] = [];
  for (const n of notes) { bar.push(n); for (let i = 0; i < 3; i++) bar.push(R); }
  return bar;
}
const hz = (notes: NN[]): number[] => notes.map(n => (n === null ? 0 : Math.round(N(n) * 100) / 100));

// ---- grid builder (motif vocabulary) -----------------------------------------

/** All coordinates in 16th-note steps; the builder converts to px. */
class G {
  o: Obstacle[] = [];
  constructor(public readonly s: number) {}
  x(step: number): number { return step * this.s; }
  spike(st: number): void { this.o.push({ t: 'spike', x: this.x(st), w: 40 }); }
  /** n spikes, `pitch` steps apart (pitch 1 = contiguous row) */
  spikes(st: number, n: number, pitch = 1): void { for (let i = 0; i < n; i++) this.spike(st + i * pitch); }
  singles(st: number, n: number, pitch: number): void { this.spikes(st, n, pitch); }
  doubles(st: number, n: number, pitch: number): void { for (let i = 0; i < n; i++) this.spikes(st + i * pitch, 2); }
  triples(st: number, n: number, pitch: number): void { for (let i = 0; i < n; i++) this.spikes(st + i * pitch, 3); }
  block(st: number, wSteps: number, h: number): void { this.o.push({ t: 'block', x: this.x(st), w: wSteps * this.s, h }); }
  gap(st: number, wSteps: number): void { this.o.push({ t: 'gap', x: this.x(st), w: wSteps * this.s }); }
  /** rising/falling block wave; heights are absolute (px above ground line) */
  stair(st: number, heights: number[], wSteps: number, pitch: number): void {
    heights.forEach((h, i) => this.block(st + i * pitch, wSteps, h));
  }
}

// ---- physics-derived authoring limits (see tools/prove.mjs) ------------------
// jump reach 243.7px / airtime 0.677s / peak 148.9px at SPEED 360, JUMP_V 880, GRAV 2600.
// Gap widths stay <= 5 grid steps; consecutive jump events stay >= ~6.5 grid steps apart
// (pitch 7+); stair pitch chosen so the landing window covers the next block top.

// ===============================================================================
// TRACK 1 · EMBER WAKE — fire opener. 135 BPM, 40.00px/step, 1350 steps = 150s.
// Intro is the collision-parity segment (gap kill x=1410, block front-edge x=2967)
// — geometry frozen; grid content continues from step 248.
// ===============================================================================
const EMBER_LEGACY: Obstacle[] = [
  { t: 'gap', x: 1400, w: 130 },
  { t: 'spike', x: 1900, w: 40 },
  { t: 'spike', x: 2400, w: 40 }, { t: 'spike', x: 2440, w: 40 },
  { t: 'block', x: 3000, w: 120, h: 70 },
  { t: 'spike', x: 3400, w: 40 },
  { t: 'gap', x: 3900, w: 170 },
  { t: 'block', x: 4400, w: 90, h: 110 },
  { t: 'spike', x: 5000, w: 40 }, { t: 'spike', x: 5040, w: 40 }, { t: 'spike', x: 5080, w: 40 },
  { t: 'block', x: 5600, w: 200, h: 50 }, { t: 'spike', x: 5650, w: 40 },
  { t: 'gap', x: 6300, w: 150 },
  { t: 'spike', x: 6900, w: 40 }, { t: 'block', x: 7100, w: 100, h: 90 }, { t: 'spike', x: 7300, w: 40 },
  { t: 'gap', x: 7800, w: 200 },
  { t: 'spike', x: 8500, w: 40 }, { t: 'spike', x: 8540, w: 40 },
  { t: 'block', x: 9100, w: 140, h: 60 }, { t: 'spike', x: 9400, w: 40 },
];

function emberGrid(): Obstacle[] {
  const g = new G(40);
  g.singles(256, 4, 16);                                   // A · warmup
  g.singles(328, 6, 8);                                    // B · on the beat
  g.doubles(424, 4, 24);                                   // C · paired spikes
  for (let k = 0; k < 3; k++) { g.block(520 + 32 * k, 2, 70); g.spike(536 + 32 * k); } // D · blocks
  g.gap(616, 3); g.spike(632); g.gap(648, 4); g.spike(664); g.gap(680, 3); g.doubles(700, 1, 1); // E · breathers
  g.triples(712, 1, 1); g.block(736, 2, 90); g.gap(760, 4); g.spike(784); g.doubles(800, 1, 1); g.block(816, 3, 70); // F · mix
  g.singles(840, 14, 8);                                   // G · rhythm run
  g.gap(968, 4); g.block(992, 2, 70); g.spike(1008); g.gap(1024, 5); g.spike(1040); g.block(1056, 2, 110); g.spike(1072); // H · callback
  g.doubles(1096, 6, 16);                                  // I · finale pairs
  g.triples(1200, 1, 1); g.singles(1224, 3, 32);           // J · last word + runout
  return g.o;
}

function emberSong(): SongSpec {
  const A2 = -24, F2 = -28, G2 = -26;
  const bass: NN[] = [...pump(A2), ...pump(F2), ...pump(G2), ...pump(A2)];
  const lead: NN[] = [
    0, R, 3, R, 7, R, 5, 3,   5, R, 3, R, 0, R, R, R,     // Am  A C E D C · D C A
    8, R, 12, R, 15, R, 12, R, 17, R, 15, R, 12, R, R, R, // F   F A C A · D C A
    10, R, 14, R, 17, R, 14, R, 19, R, 17, R, 14, R, 10, R, // G  G B D B · E D B G
    12, R, 15, R, 19, R, 15, R, 12, R, R, R, 7, 5, 3, 0,  // Am  A C E C · A — E D C A
  ];
  const arp = (tones: NN[]): NN[] => { const b: NN[] = []; for (let i = 0; i < 4; i++) b.push(...tones); return b; };
  const arpNotes: NN[] = [
    ...arp([0, 3, 7, 12]), ...arp([-4, 0, 3, 8]), ...arp([-2, 2, 5, 10]), ...arp([0, 3, 7, 12]),
  ];
  return {
    tracks: [
      { wave: 'square', notes: hz(bass), gain: 0.26, gate: 0.8 },
      { wave: 'square', notes: hz(lead), gain: 0.13, gate: 0.9, lp: 2600 },
      { wave: 'triangle', notes: hz(arpNotes), gain: 0.09, gate: 0.45 },
    ],
    drums: 'k.s.h.k.s.h.k.s'.repeat(3) + 'k.s.h.k.s.h.kshh',
  };
}

// ===============================================================================
// TRACK 2 · PRIME MOVER — plain squares, stark geometry. 120 BPM, 45px/step,
// 1248 steps = 156s.
// ===============================================================================
function primeGrid(): Obstacle[] {
  const g = new G(45);
  g.singles(48, 5, 16);                                    // A
  for (let k = 0; k < 4; k++) { g.block(128 + 32 * k, 2, 50); g.spike(144 + 32 * k); } // B · squares
  g.doubles(256, 4, 16);                                   // C
  for (let k = 0; k < 4; k++) g.gap(320 + 32 * k, 3);      // D · wide gaps, wide rests
  g.stair(448, [40, 80, 40], 2, 5); g.stair(496, [40, 80, 40], 2, 5); g.stair(544, [40, 80, 40], 2, 5); // E
  g.spike(608); g.block(616, 2, 70); g.spike(624);         // F · spike-block-spike
  g.doubles(688, 1, 1); g.triples(704, 1, 1); g.doubles(728, 1, 1); g.triples(744, 1, 1); g.doubles(768, 1, 1); // G
  g.gap(800, 4); g.spike(816); g.gap(832, 4); g.spike(848); g.gap(864, 5); g.triples(888, 1, 1); // H
  g.singles(928, 17, 8);                                   // I · metronome
  g.stair(1088, [40, 80, 40], 2, 5); g.doubles(1136, 2, 16); g.triples(1180, 1, 1); // J
  return g.o;
}

function primeSong(): SongSpec {
  const C2 = -33, G2 = -26, A2 = -24, F2 = -28;
  const bass: NN[] = [...hold([C2]), ...hold([G2]), ...hold([A2]), ...hold([F2])];
  const lead: NN[] = [
    15, R, R, R, 19, R, R, R, 22, R, R, R, 19, R, R, R,   // C
    14, R, R, R, 10, R, R, R, 14, R, R, R, R, R, 15, R,   // G
    12, R, R, R, 15, R, R, R, 19, R, R, R, 15, R, R, R,   // Am
    17, R, R, R, 15, R, R, R, 12, R, R, R, 8, R, R, R,    // F
  ];
  return {
    tracks: [
      { wave: 'square', notes: hz(bass), gain: 0.24, gate: 0.95 },
      { wave: 'square', notes: hz(lead), gain: 0.14, gate: 0.95 },
    ],
    drums: 'k...s...k...s...'.repeat(3) + 'k...s...k.k.s...',
  };
}

// ===============================================================================
// TRACK 3 · CHAOS DREAM — dense spike rhythms. 140 BPM, 38.571px/step,
// 1584 steps ≈ 170s.
// ===============================================================================
function chaosGrid(): Obstacle[] {
  const g = new G(5400 / 140);
  g.singles(40, 21, 8);                                    // A · drive
  g.doubles(216, 16, 12);                                  // B
  g.triples(416, 1, 1); g.singles(432, 1, 1); g.triples(448, 1, 1); g.singles(464, 1, 1); g.triples(480, 1, 1); // C
  for (let k = 0; k < 5; k++) g.block(512 + 8 * k, 1, 50); // D · block hops
  g.gap(576, 3); g.doubles(592, 1, 1); g.gap(608, 3); g.doubles(624, 1, 1); g.gap(640, 4); g.doubles(660, 1, 1); // E
  g.stair(704, [40, 70, 40, 70, 40], 1, 4); g.gap(736, 3); g.doubles(752, 1, 1); // F · wave
  for (let k = 0; k < 10; k++) { const b = 800 + 36 * k; g.singles(b, 3, 8); g.doubles(b + 24, 1, 1); } // G · dream loop
  for (let k = 0; k < 4; k++) { g.block(1264 + 16 * k, 1, 90); g.spike(1272 + 16 * k); } // H · walls
  g.doubles(1360, 12, 12);                                 // I · sprint
  g.triples(1520, 1, 1);                                   // J
  return g.o;
}
function chaosSong(): SongSpec {
  const D2 = -31, Bb2 = -23, C2 = -33, A2 = -24;
  const bassBar = (root: number): NN[] => [R, root, R, root, R, root, R, root, R, root, R, root, R, root, R, root];
  const bass: NN[] = [...bassBar(D2), ...bassBar(Bb2), ...bassBar(C2), ...bassBar(A2)];
  const lead: NN[] = [
    5, 8, 10, 12, 13, 12, 10, 8, 5, 8, 10, 8, 7, 5, R, R,   // Dm run
    1, R, 5, R, 8, R, 1, R, 13, R, 10, R, 8, 5, R, R,       // Bb
    3, R, 7, R, 10, R, 7, R, 15, R, 10, R, 7, 3, R, R,      // C
    0, R, 7, R, 12, R, 7, R, 0, R, 7, R, 12, 16, 12, 7,     // A (major turn)
  ];
  const ost = (tones: NN[]): NN[] => { const b: NN[] = []; for (let i = 0; i < 4; i++) b.push(...tones); return b; };
  const arpNotes: NN[] = [
    ...ost([-7, 0, 5, 0]), ...ost([-11, -4, 1, -4]), ...ost([-9, -2, 3, -2]), ...ost([-12, -5, 0, -5]),
  ];
  return {
    tracks: [
      { wave: 'square', notes: hz(bass), gain: 0.25, gate: 0.7 },
      { wave: 'sawtooth', notes: hz(lead), gain: 0.11, gate: 0.8, lp: 3000 },
      { wave: 'square', notes: hz(arpNotes), gain: 0.06, gate: 0.35 },
    ],
    drums: 'k.shs.k.shs.k.shs'.repeat(3) + 'k.shs.k.shskshs',
  };
}

// ===============================================================================
// TRACK 4 · SKYWARD — light, airy, gap-focused. 110 BPM, 49.091px/step,
// 1320 steps = 180s.
// ===============================================================================
function skyGrid(): Obstacle[] {
  const g = new G(5400 / 110);
  g.singles(56, 5, 16);                                    // A · drift in
  g.gap(136, 3); g.spike(152); g.gap(168, 4); g.spike(184); g.gap(200, 3); // B
  g.stair(232, [40, 40, 40, 40], 2, 5);                    // C · cloud tops
  g.gap(296, 3); g.gap(304, 3); g.spike(316);              // D · island double-tap
  g.block(360, 3, 110); g.spike(376);                      // E · high shelf
  g.spike(424); g.doubles(440, 1, 1); g.spike(456); g.doubles(472, 1, 1); g.spike(496); // F
  g.block(536, 2, 40); g.block(541, 2, 80); g.block(546, 2, 110); g.gap(556, 4); g.spike(572); // G · ascent
  g.gap(624, 4); g.gap(640, 4); g.gap(656, 4);             // H · floaty
  g.block(720, 2, 70); g.spike(736); g.gap(752, 4); g.doubles(776, 1, 1); g.block(800, 2, 90); g.gap(824, 3); g.spike(840); // I
  g.block(904, 2, 40); g.block(909, 2, 80); g.block(914, 2, 110); g.block(919, 2, 110); g.spike(940); // J · plateau
  g.gap(1000, 4); g.spike(1016); g.gap(1032, 4); g.doubles(1056, 1, 1); g.gap(1072, 3); g.spike(1088); g.gap(1104, 4); // K
  g.spike(1160); g.doubles(1176, 1, 1); g.triples(1200, 1, 1); // L · alight
  return g.o;
}

function skySong(): SongSpec {
  const bassBar = (lo: number, hi: number): NN[] => [lo, R, R, R, hi, R, R, R, lo, R, R, R, hi, R, R, R];
  const bass: NN[] = [...bassBar(-33, -21), ...bassBar(-24, -12), ...bassBar(-28, -16), ...bassBar(-26, -14)];
  const lead: NN[] = [
    15, R, 19, R, 22, R, 19, R, 15, R, R, R, R, R, 12, R,  // C
    12, R, 15, R, 19, R, 15, R, 12, R, R, R, R, R, 10, R,  // Am
    20, R, 24, R, 27, R, 24, R, 20, R, R, R, R, R, 17, R,  // F (airy top)
    22, R, 26, R, 29, R, 26, R, 22, R, R, R, R, R, 19, R,  // G
  ];
  const pad: NN[] = [3, ...Array<NN>(15).fill(R), -12, ...Array<NN>(15).fill(R), -16, ...Array<NN>(15).fill(R), -14, ...Array<NN>(15).fill(R)];
  return {
    tracks: [
      { wave: 'triangle', notes: hz(bass), gain: 0.2, gate: 0.9 },
      { wave: 'triangle', notes: hz(lead), gain: 0.16, gate: 0.55 },
      { wave: 'sine', notes: hz(pad), gain: 0.1, gate: 15 },
    ],
    drums: 'k.....h.......h.'.repeat(3) + 'k.....h...s.h..',
  };
}

// ===============================================================================
// TRACK 5 · PHASE DRIFT — finale: everything, at tempo. 150 BPM, 36px/step,
// 1950 steps = 195s.
// ===============================================================================
function phaseGrid(): Obstacle[] {
  const g = new G(36);
  g.singles(40, 25, 8);                                    // A
  g.doubles(248, 19, 12);                                  // B
  g.block(488, 2, 70); g.spike(504); g.block(520, 2, 90); g.spike(536); g.block(552, 2, 110); g.spike(568); // C
  g.gap(584, 3); g.spike(600); g.gap(616, 4); g.doubles(632, 1, 1); g.gap(648, 4); g.triples(668, 1, 1); // D
  g.stair(688, [40, 80, 110, 80, 40], 2, 7); g.spike(736); // E · wave
  g.singles(768, 48, 7);                                   // F · the drift (48 on 7s)
  g.triples(1112, 1, 1); g.doubles(1128, 1, 1); g.triples(1144, 1, 1); g.doubles(1160, 1, 1); g.triples(1176, 1, 1); // G
  g.gap(1200, 4); g.block(1216, 2, 70); g.gap(1232, 4); g.block(1248, 2, 110); g.spike(1264); g.gap(1280, 5); g.doubles(1300, 1, 1); // H
  g.stair(1344, [40, 80, 110, 80, 40], 2, 7); g.spike(1388); // I · waves ×3
  g.stair(1408, [40, 80, 110, 80, 40], 2, 7); g.spike(1452);
  g.stair(1472, [40, 80, 110, 80, 40], 2, 7);
  g.doubles(1520, 2, 16); g.triples(1552, 1, 1); g.triples(1576, 1, 1); // J · sprint
  g.spike(1600); g.gap(1616, 4); g.doubles(1632, 1, 1); g.block(1648, 2, 90); g.triples(1664, 1, 1); // K · gauntlet
  g.gap(1680, 4); g.spike(1700); g.doubles(1712, 1, 1); g.triples(1728, 1, 1);
  return g.o;
}

function phaseSong(): SongSpec {
  const E2 = -29, C2 = -33, D2 = -31, B2 = -22;
  const bassBar = (root: number): NN[] => [R, root, R, root, R, root, root, R, R, root, R, root, R, root, R, R];
  const bass: NN[] = [...bassBar(E2), ...bassBar(C2), ...bassBar(D2), ...bassBar(B2)];
  const lead: NN[] = [
    7, 10, 12, 14, 15, 14, 12, 10, 7, 10, 12, 10, 7, R, 10, R,  // Em
    3, 7, 10, 15, 14, 12, 10, 7, 3, 7, 10, 7, 3, R, 7, R,       // C
    5, 9, 12, 17, 15, 14, 12, 9, 5, 9, 12, 9, 5, R, 9, R,       // D
    2, 6, 9, 14, 12, 10, 9, 6, 2, 6, 9, 6, 2, R, 6, R,          // B
  ];
  const ost = (tones: NN[]): NN[] => { const b: NN[] = []; for (let i = 0; i < 4; i++) b.push(...tones); return b; };
  const arpNotes: NN[] = [
    ...ost([7, 12, 14, 19]), ...ost([3, 7, 10, 15]), ...ost([5, 9, 12, 17]), ...ost([2, 6, 9, 14]),
  ];
  return {
    tracks: [
      { wave: 'square', notes: hz(bass), gain: 0.25, gate: 0.7 },
      { wave: 'square', notes: hz(lead), gain: 0.12, gate: 0.85, lp: 2800 },
      { wave: 'sawtooth', notes: hz(arpNotes), gain: 0.06, gate: 0.3, lp: 3600 },
    ],
    drums: 'k.s.h.kk.s.h.k.'.repeat(3) + 'k.s.h.kk.s.skshs',
  };
}

// ---- menu bed ----------------------------------------------------------------

export function menuBed(): SongSpec {
  const bass: NN[] = [...hold([-33]), ...hold([-29]), ...hold([-36]), ...hold([-31])];
  const lead: NN[] = [
    7, R, R, R, 10, R, R, R, 15, R, R, R, 12, R, R, R,
    7, R, R, R, 10, R, R, R, 14, R, R, R, 10, R, R, R,
    5, R, R, R, 8, R, R, R, 12, R, R, R, 8, R, R, R,
    3, R, R, R, 7, R, R, R, 10, R, R, R, 7, R, R, R,
  ];
  return {
    tracks: [
      { wave: 'sine', notes: hz(bass), gain: 0.16, gate: 3.8 },
      { wave: 'triangle', notes: hz(lead), gain: 0.1, gate: 0.7 },
    ],
  };
}

// ---- checkpoints: 6 practice flags at ~1/7 marks, beat-snapped, spawn-safe ----

function windowClear(obs: Obstacle[], x0: number, x1: number): boolean {
  return !obs.some(o => o.x < x1 && o.x + o.w > x0);
}

function placeCheckpoints(obs: Obstacle[], pxStep: number, totalSteps: number): number[] {
  const cps: number[] = [];
  for (let k = 1; k <= 6; k++) {
    let s = Math.round((totalSteps * k) / 7 / 2) * 2;      // snap to an 8th note
    for (let d = 0; d <= 120; d++) {
      const cands = d === 0 ? [s] : [s - 2 * d, s + 2 * d];
      let done = false;
      for (const c of cands) {
        if (c < 24 || c > totalSteps - 24) continue;
        const x = c * pxStep;
        if (cps.length && x - cps[cps.length - 1] < totalSteps * pxStep * 0.05) continue;
        if (windowClear(obs, x - 110, x + 300)) { cps.push(x); done = true; break; }
      }
      if (done) break;
    }
  }
  if (cps.length !== 6) throw new Error(`checkpoint placement failed: got ${cps.length}/6`);
  return cps;
}

// ---- assembly ----------------------------------------------------------------

function mkLevel(cfg: {
  name: string; bpm: number; totalSteps: number; grid: Obstacle[]; legacy?: Obstacle[];
  palette: Palette; deco: Deco; song: SongSpec;
}): LevelSpec {
  const pxStep = 5400 / cfg.bpm;
  const obstacles = [...(cfg.legacy ?? []), ...cfg.grid].sort((a, b) => a.x - b.x);
  return {
    name: cfg.name, bpm: cfg.bpm, pxStep,
    end: cfg.totalSteps * pxStep,
    totalSteps: cfg.totalSteps,
    obstacles,
    checkpoints: placeCheckpoints(obstacles, pxStep, cfg.totalSteps),
    palette: cfg.palette, deco: cfg.deco, song: cfg.song,
  };
}

export const LEVELS: LevelSpec[] = [
  mkLevel({
    name: 'EMBER WAKE', bpm: 135, totalSteps: 1350, legacy: EMBER_LEGACY, grid: emberGrid(),
    deco: 'embers',
    palette: {
      skyTop: '#190a10', skyBot: '#8a2c14', ground: '#241016', groundEdge: '#ff9455',
      ink: '#ffe9d6', spike: '#f2e2d0', spikeEdge: '#ff7a3d', block: '#6e2a1c', blockEdge: '#ffb37a',
      cube: '#ffb020', cubeEdge: '#2a1418', accent: '#ff9455', deco: '#ff7a3d',
    },
    song: emberSong(),
  }),
  mkLevel({
    name: 'PRIME MOVER', bpm: 120, totalSteps: 1248, grid: primeGrid(),
    deco: 'grid',
    palette: {
      skyTop: '#e3e7ec', skyBot: '#9aa6b2', ground: '#272c34', groundEdge: '#dfe5ec',
      ink: '#1d2229', spike: '#181c22', spikeEdge: '#3f74d1', block: '#49566b', blockEdge: '#11151b',
      cube: '#e8b93c', cubeEdge: '#181c22', accent: '#3f74d1', deco: '#3f74d1',
    },
    song: primeSong(),
  }),
  mkLevel({
    name: 'CHAOS DREAM', bpm: 140, totalSteps: 1584, grid: chaosGrid(),
    deco: 'stars',
    palette: {
      skyTop: '#120820', skyBot: '#541460', ground: '#1a0f2e', groundEdge: '#d94fd0',
      ink: '#f3dcff', spike: '#f0d0ff', spikeEdge: '#c23bd9', block: '#552a86', blockEdge: '#e0b0ff',
      cube: '#ffd23f', cubeEdge: '#1a0f2e', accent: '#d94fd0', deco: '#b98ae0',
    },
    song: chaosSong(),
  }),
  mkLevel({
    name: 'SKYWARD', bpm: 110, totalSteps: 1320, grid: skyGrid(),
    deco: 'clouds',
    palette: {
      skyTop: '#79c4f7', skyBot: '#eaf8ff', ground: '#4a7ab5', groundEdge: '#ffffff',
      ink: '#173a5e', spike: '#28486f', spikeEdge: '#0f2c4c', block: '#f4fafe', blockEdge: '#6fa4d8',
      cube: '#ff8c42', cubeEdge: '#28486f', accent: '#ffffff', deco: '#ffffff',
    },
    song: skySong(),
  }),
  mkLevel({
    name: 'PHASE DRIFT', bpm: 150, totalSteps: 1950, grid: phaseGrid(),
    deco: 'phase',
    palette: {
      skyTop: '#04141f', skyBot: '#0f5a5e', ground: '#062030', groundEdge: '#6fe8d8',
      ink: '#d8fff6', spike: '#8ff2e2', spikeEdge: '#19b8a8', block: '#0d4254', blockEdge: '#6fe8d8',
      cube: '#ffe14d', cubeEdge: '#062030', accent: '#6fe8d8', deco: '#2fbfae',
    },
    song: phaseSong(),
  }),
];
