/* Level 107 — Airlock. Teaches: a sealed chamber reachable ONLY by teleport
 * pad; two solid movers sweep its belly — land hot, ride the safe ledges. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 107,
  name: 'Airlock',
  map: [
    '##########################',
    '#SS......................#',
    '#SS......................#',
    '#.................C......#',
    '#...T....................#',
    '#..........###############',
    '#..........#K.T.......C.##',
    '#..........#............##',
    '#..........#............##',
    '#..........#............##',
    '#..........#............##',
    '#..........#............##',
    '#..........#C....G....C.##',
    '#..........###############',
    '##########################',
  ],
  patrols: [
    { path: [[4, 3], [10, 3]], speed: 130 },
    { path: [[2, 4], [10, 4]], speed: 150, phase: 0.5 },
    { path: [[8, 1], [8, 4]], speed: 120 },
    { path: [[14, 2], [23, 2]], speed: 170 },
    { path: [[14, 6], [22, 6]], speed: 170 },
    { path: [[13, 12], [22, 12]], speed: 150, phase: 0.5 },
    { path: [[13, 7], [13, 11]], speed: 140 },
    { path: [[22, 7], [22, 11]], speed: 130, phase: 0.5 },
  ],
  movers: [
    { path: [[15, 7], [15, 11]], w: 2, h: 1, speed: 110, mode: 'pingpong', phase: 0 },
    { path: [[20, 7], [20, 11]], w: 2, h: 1, speed: 100, mode: 'pingpong', phase: 0.5 },
  ],
});
