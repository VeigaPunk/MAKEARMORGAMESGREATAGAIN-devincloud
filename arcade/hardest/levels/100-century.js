/* Level 100 — Century. The hundredth level: a locked vault. The 'y' key
 * hangs in the vault, guarded by a sliding block that seals the only breach
 * in the vault wall — time the corridor, loot the key, then open the 'D'
 * doors guarding the goal. Tier: INHUMAN milestone. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 100,
  name: 'Century',
  map: [
    '############################',
    '#SS.................#......#',
    '#SS.................#......#',
    '#...................#......#',
    '#...................#......#',
    '#..........................#',
    '#...................#......#',
    '#...................#......#',
    '#.....C.............#..y..C#',
    '#...................#......#',
    '#...................#......#',
    '#.....................######',
    '#......C.........C....D.GG.#',
    '#.................C...D.GG.#',
    '############################',
  ],
  patrols: [
    { path: [[2, 3], [19, 3]], speed: 170 },
    { path: [[2, 7], [19, 7]], speed: 180, phase: 0.5 },
    { path: [[2, 10], [19, 10]], speed: 150 },
    { path: [[22, 2], [25, 2]], speed: 150 },
    { path: [[22, 9], [25, 9]], speed: 160, phase: 0.5 },
    { path: [[26, 3], [26, 7]], speed: 140 },
    { path: [[3, 12], [18, 12]], speed: 180 },
    { path: [[2, 13], [17, 13]], speed: 170, phase: 0.5 },
    { path: [[2, 11], [20, 11]], speed: 160 },
    { path: [[14, 3], [14, 7]], speed: 170, phase: 0.25 },
  ],
  movers: [
    { path: [[5, 5], [18, 5]], w: 2, h: 1, speed: 110, mode: 'pingpong', phase: 0 },
  ],
});
