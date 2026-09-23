# The World's Hardest Game — `hardest/`

Dependency-free Canvas2D replica: red square, blue patrol dots (instant death),
yellow coins (collect ALL to arm the goal), green zones (start / checkpoint /
goal), keys `y` that open every door `D`, paired teleport pads `T`, and sliding
wall blocks (`movers`) that push the player — pinned against anything = crushed.

## Run

Open `hardest/index.html` in any browser — `file://` works, no server, no build.
Or serve statically: `python3 -m http.server -d hardest` → http://localhost:8000.

## Controls

- Move: WASD / arrows (touch: drag anywhere = joystick)
- R: restart level · Esc: pause / back · Enter: next level / select · M: mute
- Progress (unlocks, best deaths/time, medals, total deaths) saves to localStorage.
- Medals: gold = 0 deaths, silver ≤ 2, bronze = clear. Level numbers are tinted
  by difficulty tier (WARM-UP → INHUMAN).

## Layout

| File | Role |
|---|---|
| `index.html` | boot: engine → manifest → level scripts → pars → game |
| `engine.js` | pure game logic (fixed 240Hz step); runs in Node too |
| `game.js` | canvas render, input, menu/select, save |
| `levels/NN-slug.js` | one level per file, registers to `HARDEST_LEVELS` |
| `manifest.js` | generated level list — `node gen-manifest.mjs` |
| `pars.js` | generated per-level par times — `node gen-pars.mjs` |
| `autopilot.js` | deterministic solver — proves a level completable |
| `validate.mjs` | corpus gate: schema + reachability + autopilot clear |
| `difficulty.mjs` | writes DIFFICULTY.md (autopilot deaths/time per level) |
| `LEVEL-FORMAT.md` | authoring contract for level files |

## Verify

```
node hardest/validate.mjs          # all levels: schema + BFS + autopilot clear
node hardest/gen-manifest.mjs      # regenerate manifest after adding a level
node hardest/gen-pars.mjs          # regenerate pars.js (autopilot-derived)
node hardest/difficulty.mjs        # regenerate DIFFICULTY.md report
```
