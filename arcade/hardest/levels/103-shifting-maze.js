/* Level 103 — Shifting Maze. Teaches: a light maze whose corridors are
 * periodically sealed by sliding 1x1 blocks; watch the rhythm, cross on the
 * open beat — a block pushes, and a push into a wall is a crush. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 103,
  name: 'Shifting Maze',
  map: [
    '############################',
    '#SS........................#',
    '#SS.........C...##.........#',
    '#......##.......##.......C.#',
    '#......##.......##.....##..#',
    '#......##.......##.....##..#',
    '#......##..............##..#',
    '#.CK.....#######.......##..#',
    '#........#######.......##..#',
    '#...##..............##.....#',
    '#...##......##......##.....#',
    '#...##...C..##......##.....#',
    '#.####......##....C.##.....#',
    '#...##......##......##....G#',
    '#...........##............G#',
    '############################',
  ],
  patrols: [
    { path: [[3, 1], [11, 1]], speed: 130 },
    { path: [[19, 2], [25, 2]], speed: 120, phase: 0.5 },
    { path: [[9, 6], [20, 6]], speed: 150 },
    { path: [[9, 3], [14, 3]], speed: 145, phase: 0.5 },
    { path: [[6, 9], [11, 9]], speed: 110 },
    { path: [[14, 9], [19, 9]], speed: 130, phase: 0.5 },
    { path: [[22, 9], [25, 10]], speed: 115 },
    { path: [[14, 11], [19, 11]], speed: 135 },
    { path: [[6, 13], [11, 13]], speed: 120, phase: 0.5 },
    { path: [[3, 14], [10, 14]], speed: 140 },
  ],
  movers: [
    { path: [[2, 3], [2, 6]], w: 1, h: 1, speed: 60, mode: 'pingpong', phase: 0 },
    { path: [[15, 2], [15, 6]], w: 1, h: 1, speed: 100, mode: 'pingpong', phase: 0.5 },
    { path: [[26, 3], [26, 11]], w: 1, h: 1, speed: 80, mode: 'pingpong', phase: 0.25 },
  ],
});
