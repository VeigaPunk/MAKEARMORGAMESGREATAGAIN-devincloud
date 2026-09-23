/* Level 77 — Switchback III. Tight zigzag lanes with counter-phase pairs and a sweeping turn sentinel. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 77,
  name: 'Switchback III',
  tier: 'INHUMAN',
  map: [
    '############################',
    '#S.........................#',
    '#..........................#',
    '#..C.......................#',
    '#..........................#',
    '#..............C...........#',
    '#..........................#',
    '#......................C...#',
    '#..........................#',
    '#...C......................#',
    '#..........................#',
    '#.................C........#',
    '#..........................#',
    '#.........................G#',
    '#..........................#',
    '#..........................#',
    '############################'
  ],
  patrols: [
    { path: [[2, 2], [25, 2]], speed: 140, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[25, 2], [2, 2]], speed: 140, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[2, 4], [25, 4]], speed: 155, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[25, 4], [2, 4]], speed: 155, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[2, 6], [25, 6]], speed: 170, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[25, 6], [2, 6]], speed: 170, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[2, 8], [25, 8]], speed: 185, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[25, 8], [2, 8]], speed: 185, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[2, 10], [25, 10]], speed: 200, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[25, 10], [2, 10]], speed: 200, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[2, 12], [25, 12]], speed: 215, mode: 'pingpong', r: 6, phase: 0 },
    { path: [[25, 12], [2, 12]], speed: 215, mode: 'pingpong', r: 6, phase: 0.5 },
    { path: [[5, 2], [5, 14], [22, 14], [22, 2]], speed: 230, mode: 'loop', r: 6, phase: 0.25 }
  ]
});
