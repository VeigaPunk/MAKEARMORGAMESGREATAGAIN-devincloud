/* Level 108 — Piston II. INHUMAN: three stacked single-row corridors, each
 * swept by its own horizontal 2x1 piston at a different speed and phase;
 * duck through the pillar gaps between lanes — each lane has its own rhythm,
 * so pick your crossing order and mind the shaft sentries. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 108,
  name: 'Piston II',
  map: [
    '############################',
    '#SS........................#',
    '#SS........................#',
    '#.........C................#',
    '#..........................#',
    '#..........................#',
    '######.#####.#####.#########',
    '#..........................#',
    '######.#####.#####.#########',
    '#..........................#',
    '######.#####.#####.#########',
    '#..........................#',
    '######.#####.#####.#########',
    '#.........C.........C.....G#',
    '#.........................G#',
    '############################',
  ],
  patrols: [
    { path: [[8, 1], [25, 1]], speed: 130 },
    { path: [[8, 2], [25, 2]], speed: 150, phase: 0.5 },
    { path: [[6, 3], [6, 5]], speed: 130 },
    { path: [[8, 4], [25, 4]], speed: 135, phase: 0.25 },
    { path: [[20, 3], [25, 3]], speed: 145, phase: 0.5 },
    { path: [[3, 13], [3, 14]], speed: 140 },
    { path: [[8, 13], [25, 13]], speed: 160 },
    { path: [[8, 14], [25, 14]], speed: 180, phase: 0.5 },
  ],
  movers: [
    { path: [[2, 7], [25, 7]], w: 2, h: 1, speed: 90, mode: 'pingpong', phase: 0 },
    { path: [[2, 9], [25, 9]], w: 2, h: 1, speed: 110, mode: 'pingpong', phase: 0.33 },
    { path: [[2, 11], [25, 11]], w: 2, h: 1, speed: 125, mode: 'pingpong', phase: 0.66 },
  ],
});
