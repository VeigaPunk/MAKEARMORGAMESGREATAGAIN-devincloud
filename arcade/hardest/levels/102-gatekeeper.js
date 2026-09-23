/* Level 102 — Gatekeeper. Tier: INHUMAN.
 * The portal is the shortcut — but the mover sweeps the pad's own row.
 * Time the block, step through, then survive the vault. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 102,
  name: 'Gatekeeper',
  map: [
    '##########################',
    '#SS...........#..........#',
    '#SS...........#..........#',
    '#.....C.......#..........#',
    '#.............#..........#',
    '#.............#..........#',
    '#.....T.......#....T.....#',
    '#.............#..........#',
    '#.............#..........#',
    '#..C..........#..........#',
    '#.........C...#.....C....#',
    '#..........C..#..........#',
    '#.............#.........K#',
    '#.............#......GG..#',
    '##########################',
  ],
  patrols: [
    { path: [[3, 2], [13, 2]], speed: 150 },
    { path: [[3, 4], [13, 4]], speed: 180, phase: 0.5 },
    { path: [[3, 8], [13, 8]], speed: 160 },
    { path: [[3, 11], [13, 11]], speed: 140, phase: 0.5 },
    { path: [[13, 1], [13, 12]], speed: 170 },
    { path: [[8, 6], [8, 6]], speed: 60 },
    { path: [[15, 3], [24, 3]], speed: 170 },
    { path: [[15, 9], [24, 9]], speed: 160, phase: 0.5 },
    { path: [[19, 2], [19, 5]], speed: 140 },
  ],
  movers: [
    { path: [[3, 6], [11, 6]], w: 1, h: 1, speed: 110, mode: 'pingpong', phase: 0 },
  ],
});
