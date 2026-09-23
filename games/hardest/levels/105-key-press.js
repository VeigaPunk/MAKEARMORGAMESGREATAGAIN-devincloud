/* Level 105 — Key Press. Tier INHUMAN. Both keys sit behind full-height
 * sliding-block lanes: a 1x3 portcullis sweeps the annex column, so the
 * gap you need is always the three rows the block just left. Cross behind
 * the block, loot the key, cross back — then the mid-wall door opens onto
 * the lower vault where the patrols run hot and the last coins wait. */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 105,
  name: 'Key Press',
  map: [
    '##############################',
    '#......SS....................#',
    '#......SS....................#',
    '#...C................C.......#',
    '#............................#',
    '#.y...................y......#',
    '#............................#',
    '#............................#',
    '#############DD###############',
    '#............KK..............#',
    '#...C........................#',
    '#.....................C......#',
    '#............................#',
    '#............C...........GG..#',
    '#.........................GG.#',
    '##############################',
  ],
  patrols: [
    { path: [[3, 1], [3, 7]], speed: 140 },
    { path: [[8, 3], [19, 3]], speed: 160 },
    { path: [[8, 5], [19, 5]], speed: 150, phase: 0.5 },
    { path: [[8, 7], [19, 7]], speed: 170 },
    { path: [[24, 1], [24, 7]], speed: 140, phase: 0.5 },
    { path: [[2, 10], [25, 10]], speed: 150 },
    { path: [[2, 12], [25, 12]], speed: 170, phase: 0.5 },
    { path: [[6, 9], [6, 13]], speed: 130 },
    { path: [[2, 11], [20, 11]], speed: 180 },
  ],
  movers: [
    { path: [[6, 2], [6, 6]], w: 1, h: 3, speed: 90, mode: 'pingpong', phase: 0 },
    { path: [[21, 2], [21, 6]], w: 1, h: 3, speed: 110, mode: 'pingpong', phase: 0.5 },
  ],
});
