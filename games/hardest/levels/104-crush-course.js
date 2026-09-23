/* Level 104 — Crush Course. Tier INHUMAN. Two big movers sweep the central
 * plaza on crossing lanes: a vertical 1x3 block runs the spine column while a
 * horizontal 3x1 block sweeps the mid row. Coins sit in the sweep zone —
 * collect them between passes while seven patrols rake the open floor. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 104,
  name: 'Crush Course',
  map: [
    '############################',
    '#SS........................#',
    '#SS........................#',
    '#..........................#',
    '#.........C................#',
    '#..........................#',
    '#.....C...............C....#',
    '#.................C........#',
    '#..........................#',
    '#.........C................#',
    '#..........................#',
    '#...C......................#',
    '#.........................G#',
    '#.........................G#',
    '############################',
  ],
  patrols: [
    { path: [[2, 3], [25, 3]], speed: 140 },
    { path: [[2, 5], [25, 5]], speed: 160, phase: 0.5 },
    { path: [[2, 8], [25, 8]], speed: 150 },
    { path: [[2, 11], [25, 11]], speed: 170, phase: 0.5 },
    { path: [[20, 1], [20, 3]], speed: 120 },
    { path: [[5, 12], [22, 12]], speed: 120 },
    { path: [[14, 4], [14, 9]], speed: 130 },
  ],
  movers: [
    { path: [[10, 3], [10, 11]], w: 1, h: 3, speed: 90, mode: 'pingpong', phase: 0 },
    { path: [[3, 7], [24, 7]], w: 3, h: 1, speed: 80, mode: 'pingpong', phase: 0.5 },
  ],
});
