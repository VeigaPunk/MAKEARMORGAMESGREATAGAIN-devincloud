/* Level 106 — Conveyor. INHUMAN. Two 1x1 loop-mode movers circle the
 * central coin island like carousel arms; slip between revolutions, dodge
 * the sentry dots, and dip through the south gap to rob the vault. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 106,
  name: 'Conveyor',
  map: [
    '##########################',
    '#SS......................#',
    '#SS......................#',
    '#........................#',
    '#...........C............#',
    '#........########........#',
    '#..C.....#......#........#',
    '#........#C.K...#........#',
    '#........#......#.....C..#',
    '#........###.####........#',
    '#..C.....................#',
    '#........................#',
    '#........................#',
    '#......................GG#',
    '##########################',
  ],
  patrols: [
    { path: [[2, 3], [23, 3]], speed: 160 },
    { path: [[9, 4], [23, 4]], speed: 165, phase: 0.5 },
    { path: [[2, 12], [22, 12]], speed: 160 },
    { path: [[4, 10], [4, 13]], speed: 130 },
    { path: [[21, 4], [21, 10]], speed: 150 },
    { path: [[7, 5], [7, 9]], speed: 120 },
    { path: [[18, 5], [18, 9]], speed: 135, phase: 0.5 },
    { path: [[9, 12], [16, 12]], speed: 170 },
  ],
  movers: [
    { path: [[7, 3], [18, 3], [18, 11], [7, 11]], w: 1, h: 1, speed: 125, mode: 'loop', phase: 0 },
    { path: [[4, 2], [21, 2], [21, 13], [4, 13]], w: 1, h: 1, speed: 130, mode: 'loop', phase: 0.5 },
  ],
});
