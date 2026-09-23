/* Level 112 — Crush Vault. INHUMAN. Concentric defense: two sliding blocks
 * orbit the vault's exterior lanes while counter-phased dots sweep the
 * corridors. Loot both keys, open the D-ring, grab the vault heart, exit. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 112,
  name: 'Crush Vault',
  map: [
    '############################',
    '#SS........................#',
    '#SS........................#',
    '#.....................C....#',
    '#..........DDDDDD..........#',
    '#..........D....D..........#',
    '#..C.......D.C..D..........#',
    '#..........D....D..........#',
    '#..........DDDDDD..........#',
    '#..y...............y.......#',
    '#..........................#',
    '#..........................#',
    '#......C............C......#',
    '#..........................#',
    '#............C...........GG#',
    '#........................GG#',
    '############################',
  ],
  patrols: [
    { path: [[5, 2], [12, 2]], speed: 165 },
    { path: [[17, 1], [25, 1]], speed: 175, phase: 0.5 },
    { path: [[2, 5], [9, 5]], speed: 175, phase: 0.3 },
    { path: [[2, 10], [10, 10]], speed: 150 },
    { path: [[17, 10], [25, 10]], speed: 160, phase: 0.5 },
    { path: [[12, 5], [15, 5]], speed: 150 },
    { path: [[12, 7], [15, 7]], speed: 150, phase: 0.5 },
    { path: [[25, 9], [25, 13]], speed: 165 },
    { path: [[1, 14], [22, 14]], speed: 190, phase: 0.2 },
    { path: [[2, 13], [12, 13]], speed: 175, phase: 0.6 },
    { path: [[19, 9], [26, 9]], speed: 155, phase: 0.4 },
  ],
  movers: [
    { path: [[4, 3], [24, 3]], w: 2, h: 1, speed: 120, mode: 'pingpong', phase: 0 },
    { path: [[4, 12], [24, 12]], w: 2, h: 1, speed: 110, mode: 'pingpong', phase: 0.5 },
  ],
});
