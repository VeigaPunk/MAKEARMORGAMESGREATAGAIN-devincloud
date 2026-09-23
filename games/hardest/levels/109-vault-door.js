/* Level 109 — Vault Door. Tier INHUMAN. A 1x3 portcullis slides up and down
 * the vault's approach column; the gap you need is the moment it leaves your
 * row. Grab the key, time the slide, loot the vault, reach the goal. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 109,
  name: 'Vault Door',
  map: [
    '##############################',
    '#SS..........................#',
    '#SS..........................#',
    '#............................#',
    '#...y......##########........#',
    '#..........#.C..C..C#........#',
    '#..........D........#........#',
    '#..........#C..C..C.#........#',
    '#..........########D#........#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#..........................GG#',
    '#..........................GG#',
    '##############################',
  ],
  patrols: [
    { path: [[4, 1], [10, 1]], speed: 130 },
    { path: [[15, 1], [20, 1]], speed: 150, phase: 0.3 },
    { path: [[24, 2], [28, 2]], speed: 140 },
    { path: [[2, 8], [9, 8]], speed: 150, phase: 0.5 },
    { path: [[4, 10], [10, 10]], speed: 140 },
    { path: [[4, 13], [10, 13]], speed: 120, phase: 0.5 },
    { path: [[16, 10], [20, 10]], speed: 150 },
    { path: [[24, 10], [28, 10]], speed: 130, phase: 0.5 },
    { path: [[24, 12], [28, 12]], speed: 170 },
    { path: [[26, 4], [26, 8]], speed: 120 },
  ],
  movers: [
    { path: [[10, 2], [10, 7]], w: 1, h: 3, speed: 70, mode: 'pingpong' },
  ],
});
