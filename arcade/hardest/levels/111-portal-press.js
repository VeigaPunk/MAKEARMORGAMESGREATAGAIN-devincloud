/* Level 111 — Portal Press. Teaches: teleport landing is a commitment — a mover
 * sweeps the arrival pad's lane; land, read the block, move. Second pair is a
 * one-way shortcut into the goal corner. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 111,
  name: 'Portal Press',
  map: [
    '############################',
    '#SS.....C...#..............#',
    '#...........#..............#',
    '#...........#..............#',
    '#........T..#..............#',
    '#...........#..............#',
    '#...........#.T............#',
    '#...........#..............#',
    '#...........#..............#',
    '#...........#.K..C.........#',
    '#...........#...T..........#',
    '#...........#.........C....#',
    '#..C........#............T.#',
    '#...........#............GG#',
    '#...........#............GG#',
    '############################',
  ],
  patrols: [
    { path: [[3, 3], [10, 3]], speed: 140 },
    { path: [[2, 6], [10, 6]], speed: 160, phase: 0.5 },
    { path: [[2, 10], [10, 10]], speed: 150 },
    { path: [[5, 1], [5, 5]], speed: 130 },
    { path: [[15, 2], [25, 2]], speed: 150 },
    { path: [[15, 3], [25, 3]], speed: 170, phase: 0.5 },
    { path: [[21, 7], [21, 11]], speed: 140 },
    { path: [[15, 13], [24, 13]], speed: 180 },
    { path: [[25, 5], [25, 9]], speed: 135 },
  ],
  movers: [
    { path: [[15, 6], [19, 6]], w: 1, h: 1, speed: 55, mode: 'pingpong', phase: 0.5 },
  ],
});
