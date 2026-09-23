# Level format — The World's Hardest Game

Each level is one file `hardest/levels/NN-slug.js` (NN = zero-padded `id`, 2–3 digits). The file
registers itself by pushing a plain object to `globalThis.HARDEST_LEVELS`:
```js
(globalThis.HARDEST_LEVELS = globalThis.HARDEST_LEVELS || []).push({
  id: 7,                    // integer, unique, must match filename NN
  name: 'Switchback',       // short display name
  playerSpeed: 175,         // optional px/s override (default 175)
  map: [ '####', '#SS#', ... ],   // array of equal-length strings
  patrols: [
    { path: [[4,2],[15,2]], speed: 110, mode: 'pingpong', r: 6, phase: 0 },
  ],
  movers: [
    { path: [[13,5],[13,7]], w: 1, h: 2, speed: 80, mode: 'pingpong', phase: 0 },
  ],
});
```

| Char | Meaning |
|---|---|
| `#` | wall (blocks player; dots may pass — they are not wall-blocked) |
| `.` | floor |
| `S` | start zone (green) — spawn point, also a checkpoint |
| `G` | goal zone (green) — level ends here once ALL coins are collected |
| `K` | checkpoint zone (green) — touching sets respawn |
| `C` | coin (yellow) — must ALL be collected before goal works |
| `y` | key (yellow) — collecting ALL keys opens every `D` door |
| `D` | door (brown) — solid until all keys collected, then floor |
| `T` | teleport pad (cyan ring) — pads pair in scan order (1↔2, 3↔4…);
|     | stepping on one jumps to its twin. Count must be even. |

Every row must be the same length. Only the chars above are legal.
Coins/keys may not sit on zone tiles (one char per tile). Keep maps inside
`20–30` cols × `12–18` rows so they fit the stage.

Design contract: **keys must be reachable with doors closed** — never put a
key behind a door. The validator enforces this.

## Movers (sliding wall blocks — solid, they push; pinned = crushed)

- `path`: `[tileX, tileY]` waypoints for the block's CENTER (same path math as
  patrols: `pingpong`/`loop`, `speed` px/s, `phase` 0–1).
- `w`/`h`: block size in tiles, integer 1–4 (default 1×1).
- The block's swept area must NEVER overlap `#` walls — movers live in open
  floor. It must also never cover `S`/`K` tiles (respawns stay safe). The
  validator samples the whole sweep and enforces both.
- Behavior: the player cannot enter a mover (it clamps like a wall); a mover
  that catches the player pushes them along its motion; if the push leaves the
  player overlapping anything solid → death (crushed). Design generous timing
  windows — the autopilot never plans to be pushed, so a level that REQUIRES
  riding a push cannot be verified.
- Keep mover speed ≤ 140 and leave ≥2 free tiles beside its lane for dodges.


## Patrols (blue dots — instant death on touch)

- `path`: array of `[tileX, tileY]` integer waypoints (tile centers). Every
  waypoint must be a non-wall, reachable tile.
- `speed`: px/s along the path (typical 60–220).
- `mode`: `'pingpong'` (default, A→B→A…) or `'loop'` (A→B→C→A…).
- `r`: dot radius px (default 6).
- `phase`: 0–1, fraction of the path period to offset at t=0 (default 0).
  Use `phase: 0.5` on a second identical patrol to counter-phase it.

## Rules enforced by `node hardest/validate.mjs`

1. Schema: filename `NN-slug.js`, `id` matches NN and is unique, `name` present,
   rectangular map, legal chars, ≥1 `S`, ≥1 `G`, valid patrols.
2. Reachability: BFS from start reaches every key (doors closed), every coin,
   every goal tile, every patrol waypoint (doors open + teleport edges).
3. **Completability**: the deterministic autopilot (`autopilot.js`) must clear
   the level through the real engine within 120 simulated seconds / 400 deaths.
   A level the autopilot cannot clear is NOT verified — redesign it (wider
   gaps, slower dots, more checkpoints) until it passes.

Lane self-check: `node hardest/validate.mjs --only hardest/levels/NN-slug.js`
Full corpus: `node hardest/validate.mjs` · manifest: `node hardest/gen-manifest.mjs`

## Design contract (what makes a level good)

- One idea per level: introduce OR combine mechanics deliberately
  (corridor timing, coin detours, checkpoint routing, counter-phase pairs,
  loop sentries, narrow doors, crossfire rooms).
- Difficulty escalates with `id`: 03–10 forgiving, 11–20 demanding,
  21–30 brutal-but-fair.
- Fair, not random: patrols are deterministic; a skilled player can always
  find a safe window. Never wall the player into a spawn-camping dot.
- Green zones are the only safe ground — dots may sweep over floor anywhere.
