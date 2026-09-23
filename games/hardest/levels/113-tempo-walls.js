/* Level 113 — Tempo Walls. Three sliding walls on three tempos (60/100/140).
 * Read each tempo before you cross its lane — the passages are staggered:
 * descend right, then left, then run the fast lane to the goal. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 113,
  name: 'Tempo Walls',
  map: [
    '############################',
    '#SS......................C.#',
    '#SS........................#',
    '#..............C...........#',
    '#..........................#',
    '#####################.######',
    '#..........................#',
    '#............K.............#',
    '#......C...................#',
    '#..........................#',
    '####.#######################',
    '#.........C................#',
    '#....................C...GG#',
    '#..........................#',
    '#..........................#',
    '############################',
  ],
  patrols: [
    { path: [[6, 1], [21, 1]], speed: 150 },
    { path: [[10, 2], [18, 2]], speed: 200 },
    { path: [[26, 1], [26, 4]], speed: 170 },
    { path: [[3, 4], [20, 4]], speed: 180 },
    { path: [[4, 6], [23, 6]], speed: 160 },
    { path: [[4, 9], [23, 9]], speed: 190, phase: 0.5 },
    { path: [[24, 6], [24, 9]], speed: 140 },
    { path: [[4, 11], [23, 11]], speed: 150, phase: 0.5 },
    { path: [[4, 13], [23, 13]], speed: 200, phase: 0.25 },
    { path: [[24, 11], [24, 14]], speed: 160 },
  ],
  movers: [
    { path: [[5, 3], [23, 3]], w: 2, h: 1, speed: 60, mode: 'pingpong', phase: 0 },
    { path: [[4, 8], [23, 8]], w: 2, h: 1, speed: 100, mode: 'pingpong', phase: 0.35 },
    { path: [[5, 12], [23, 12]], w: 3, h: 1, speed: 140, mode: 'pingpong', phase: 0.7 },
  ],
});
