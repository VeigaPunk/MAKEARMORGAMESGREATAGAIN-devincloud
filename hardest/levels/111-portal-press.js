/* Level 111 — Portal Press. Teaches: teleport landing is a commitment — a
 * block sweeps the lane below the arrival pad; land, read the sweep, move.
 * Second pair is a one-way shortcut into the sealed goal corner. */
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
    '#..C........#...........#T.#',
    '#...........#...........#GG#',
    '#...........#...........#GG#',
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
    { path: [[15, 13], [23, 13]], speed: 180 },
    { path: [[25, 5], [25, 9]], speed: 135 },
  ],
  movers: [
    { path: [[13, 7], [19, 7]], w: 1, h: 1, speed: 95, mode: 'pingpong' },
  ],
});
