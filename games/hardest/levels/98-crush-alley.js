/* Level 98 — Crush Alley. Teaches: a mover push is harmless until you're
 * pinned — duck into the vertical shafts; the dead end crushes. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 98,
  name: 'Crush Alley',
  map: [
    '##########################',
    '#SS......................#',
    '#SS......................#',
    '#........................#',
    '#####.####.####.####.#####',
    '#####.####.####.####.#####',
    '#......................C##',
    '#####.####.####.####.#####',
    '#####.####.####.####.#####',
    '#........................#',
    '#.......................G#',
    '#.......................G#',
    '##########################',
  ],
  patrols: [
    { path: [[6, 2], [19, 2]], speed: 120 },
    { path: [[4, 3], [21, 3]], speed: 140, phase: 0.5 },
    { path: [[6, 10], [19, 10]], speed: 130 },
    { path: [[22, 9], [22, 11]], speed: 100 },
  ],
  movers: [
    { path: [[3, 6], [22, 6]], w: 2, h: 1, speed: 85 },
  ],
});
