/* Level 33 — Phase Portal. Two rooms trade patrol rhythms through a paired teleport. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 33,
  name: 'Phase Portal',
  map: [
    '##########################',
    '#SS.........#............#',
    '#...........#............#',
    '#....C......#......C.....#',
    '#...........#............#',
    '#...........#............#',
    '#..........T#T...........#',
    '#...........#............#',
    '#......C....#....C.......#',
    '#...........#............#',
    '#...........#............#',
    '#...........#.........K..#',
    '#...........#...........G#',
    '##########################',
  ],
  patrols: [
    { path: [[2, 2], [10, 2]], speed: 120, mode: 'pingpong', phase: 0 },
    { path: [[2, 5], [10, 5]], speed: 145, mode: 'pingpong', phase: 0.5 },
    { path: [[2, 9], [10, 9]], speed: 110, mode: 'pingpong', phase: 0.25 },
    { path: [[14, 2], [23, 2]], speed: 155, mode: 'pingpong', phase: 0.5 },
    { path: [[14, 6], [23, 6]], speed: 130, mode: 'pingpong', phase: 0 },
    { path: [[16, 9], [22, 9]], speed: 160, mode: 'pingpong', phase: 0.5 },
  ],
});
