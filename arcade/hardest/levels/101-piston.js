/* Level 101 — Piston. INHUMAN: two horizontal 2x1 pistons sweep the twin
 * corridors in counter-phase; duck into the pillar pockets (cols 6/12/18)
 * to let one pass, then cross before the other returns. Evolved L98. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 101,
  name: 'Piston',
  map: [
    '############################',
    '#SS........................#',
    '#SS........................#',
    '#.........C................#',
    '#.........................G#',
    '#.........................G#',
    '######.#####.#####.#########',
    '#..........................#',
    '######.#####.#####.#########',
    '#..........................#',
    '######.#####.#####.#########',
    '#........................C.#',
    '#...C......................#',
    '############################',
  ],
  patrols: [
    { path: [[8, 1], [25, 1]], speed: 130 },
    { path: [[8, 2], [25, 2]], speed: 150, phase: 0.5 },
    { path: [[8, 11], [24, 11]], speed: 140 },
    { path: [[8, 12], [24, 12]], speed: 120, phase: 0.5 },
    { path: [[6, 3], [6, 5]], speed: 120 },
    { path: [[18, 7], [18, 9]], speed: 125 },
    { path: [[12, 7], [12, 9]], speed: 165, mode: 'loop' },
  ],
  movers: [
    { path: [[2, 7], [25, 7]], w: 2, h: 1, speed: 90, mode: 'pingpong', phase: 0 },
    { path: [[2, 9], [25, 9]], w: 2, h: 1, speed: 115, mode: 'pingpong', phase: 0.5 },
  ],
});
