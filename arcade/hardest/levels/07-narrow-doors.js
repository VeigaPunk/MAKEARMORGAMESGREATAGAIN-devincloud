/* Level 07 — Narrow Doors. Teaches: time entry through one-tile room doors.
 * Guards sweep the approach lane beside each door (never the door tile itself —
 * a dot on the only transit tile makes the door permanently lethal). */
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 7,
  name: 'Narrow Doors',
  map: [
    '########################',
    '#......................#',
    '#.S....................#',
    '#......................#',
    '#......................#',
    '#......................#',
    '########.#######.#######',
    '#......................#',
    '#......................#',
    '#......................#',
    '#....C......K..........#',
    '#....................C.#',
    '#....................G.#',
    '########################',
  ],
  patrols: [
    // door guards: sweep the approach row beside each door, phase-offset
    { path: [[5, 4], [11, 4]], speed: 85, phase: 0 },
    { path: [[13, 4], [19, 4]], speed: 85, phase: 0.5 },
    // lower-room roamers
    { path: [[19, 2], [21, 2]], speed: 80, phase: 0 },
    { path: [[19, 9], [21, 9]], speed: 90, phase: 0.5 },
    { path: [[3, 8], [9, 8]], speed: 95, phase: 0.25 },
  ],
});
