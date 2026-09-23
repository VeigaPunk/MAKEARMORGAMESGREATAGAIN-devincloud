# The World's Hardest Game — `hardest/`

A complete, dependency-free Canvas2D precision game with 114 validated levels: red square, blue patrol dots (instant death),
yellow coins (collect ALL to arm the goal), green zones (start / checkpoint /
goal), keys `y` that open every door `D`, paired teleport pads `T`, and sliding
wall blocks (`movers`) that push the player — pinned against anything = crushed.

## Run

Open `hardest/index.html` in any browser — `file://` works, no server, no build.
Or serve statically: `python3 -m http.server -d hardest` → http://localhost:8000.

## Controls

- Move: WASD / arrows (touch: drag anywhere = joystick)
- R: restart level · Esc: pause / back · Q: level select while paused
- Enter / Space: selected level or next level · M: mute
- The toolbar provides touch and keyboard controls for levels, pause, restart, and sound.
- Choose any unlocked challenge with the accessible level picker, or use the canvas grid.
- Losing focus pauses play and releases held movement; resume when ready.
- Progress saves to localStorage: unlocks, best death count, fastest clear, medals, and total deaths.
- Deaths save immediately. Older saves migrate automatically; damaged entries are discarded.
- Optional visual feedback respects the system reduced-motion preference.
- Medals: gold = 0 deaths, silver ≤ 2, bronze = clear. Level numbers are tinted
  by difficulty tier (WARM-UP → INHUMAN).

## Layout

| File | Role |
|---|---|
| `index.html` | boot: engine → manifest → level scripts → pars → game |
| `engine.js` | pure game logic (fixed 240Hz step); runs in Node too |
| `game.js` | canvas render, input, menu/select, audio and feedback |
| `save.js` | defensive save migration and independent personal best records |
| `levels/NN-slug.js` | one level per file, registers to `HARDEST_LEVELS` |
| `manifest.js` | generated level list — `node gen-manifest.mjs` |
| `pars.js` | generated per-level par times — `node gen-pars.mjs` |
| `autopilot.js` | deterministic solver — proves a level completable |
| `validate.mjs` | corpus gate: schema + reachability + autopilot clear |
| `difficulty.mjs` | writes DIFFICULTY.md (autopilot deaths/time per level) |
| `LEVEL-FORMAT.md` | authoring contract for level files |

## Verify

```
node hardest/validate.mjs          # all 114: schema + BFS + 60Hz-input completion proofs
node --test hardest/regression.mjs # save recovery, content integrity, movement safety, proof replay
node hardest/browser-check.mjs     # Chromium file:// renderer, real frame replay and touch
node hardest/gen-manifest.mjs      # regenerate manifest after adding a level
node hardest/gen-pars.mjs          # regenerate pars.js (autopilot-derived)
node hardest/difficulty.mjs        # regenerate DIFFICULTY.md report
```

The game has no runtime dependencies. The optional browser check uses the root
workspace's `@playwright/test` development dependency and `/usr/bin/chromium`
(override with `CHROMIUM_PATH`). It replays complete solver input tapes through
`game.js`, not just the pure engine, for levels 1, 30, 97, 109, 111, and 114;
checks menu rendering after clears, corrupt saves, pause/focus behavior, immediate
death persistence, and actual touch events. The corpus validator proves every
level with inputs held for four 240Hz physics ticks per 60Hz frame. Par times and
the difficulty report are regenerated from that same solver.
