/* Level 04 — Coin Detour. Teaches: leave the safe main route for guarded coin alcoves. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 4,
  name: 'Coin Detour',
  map: [
    '########################',
    '#......................#',
    '#....C...C...C...C.....#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#SS..................GG#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '########################',
  ],
  patrols: [
    { path: [[5, 1], [5, 4]], speed: 90, mode: 'pingpong', phase: 0.1 },
    { path: [[9, 1], [9, 4]], speed: 110, mode: 'pingpong', phase: 0.35 },
    { path: [[13, 1], [13, 4]], speed: 120, mode: 'pingpong', phase: 0.6 },
    { path: [[17, 1], [17, 4]], speed: 100, mode: 'pingpong', phase: 0.85 },
  ],
});
