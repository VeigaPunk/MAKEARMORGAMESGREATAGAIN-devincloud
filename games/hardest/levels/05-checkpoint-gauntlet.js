/* Level 05 — Checkpoint Gauntlet. Teaches: checkpoint routing through three timed chambers. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 5,
  name: 'Checkpoint Gauntlet',
  map: [
    '##########################',
    '#SS......#.......#.......#',
    '#........#.......#.......#',
    '#..C.....#.......#..C....#',
    '#........#.......#.......#',
    '#........#.......#.......#',
    '#........K.......K....G..#',
    '#........#.......#.......#',
    '#........#.......#.......#',
    '#........#..C....#.......#',
    '#........#.......#.......#',
    '#........#.......#.......#',
    '##########################',
  ],
  patrols: [
    { path: [[3, 5], [7, 5]], speed: 100, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[11, 4], [15, 4]], speed: 110, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[19, 8], [23, 8]], speed: 120, mode: 'pingpong', r: 6, phase: 0 },
  ],
});
