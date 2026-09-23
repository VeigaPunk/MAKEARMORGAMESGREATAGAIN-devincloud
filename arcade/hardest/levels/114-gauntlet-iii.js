/* Level 114 — Gauntlet III. Mini-exam: every mechanic at once.
 * Key 'y' opens the lone 'D' door into the coin vault; teleport pads
 * shortcut the bottom gauntlet; a 2-wide mover sweeps the corridor
 * between two counter-phased 170+ patrols. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 114,
  name: 'Gauntlet III',
  map: [
    '##############################',
    '#SS.....#..........#.....GG..#',
    '#SS.....#..........#.....GG..#',
    '#...C...#..C.......#..C......#',
    '#.......#..........#.........#',
    '#.......D..........#.........#',
    '#.......#..........#....C....#',
    '#.y.....#.....C....#.........#',
    '#.......#..........#.........#',
    '#.......#..........#.T.......#',
    '#.......#..........#..K......#',
    '####.####################.####',
    '#.........................C..#',
    '#.T..........................#',
    '#............................#',
    '#............................#',
    '##############################',
  ],
  patrols: [
    { path: [[1, 3], [7, 3]], speed: 150 },
    { path: [[1, 7], [7, 7]], speed: 150, phase: 0.5 },
    { path: [[4, 1], [4, 4]], speed: 140 },
    { path: [[9, 3], [18, 3]], speed: 180 },
    { path: [[9, 7], [18, 7]], speed: 170, phase: 0.5 },
    { path: [[9, 10], [18, 10]], speed: 165 },
    { path: [[13, 5], [13, 8]], speed: 155 },
    { path: [[21, 3], [27, 3]], speed: 180 },
    { path: [[21, 6], [27, 6]], speed: 185, phase: 0.5 },
    { path: [[24, 1], [24, 4]], speed: 160 },
    { path: [[2, 12], [14, 12]], speed: 200 },
    { path: [[16, 14], [27, 14]], speed: 190, phase: 0.5 },
  ],
  movers: [
    { path: [[8, 13], [20, 13]], w: 2, h: 1, speed: 120, mode: 'pingpong', phase: 0 },
  ],
});
