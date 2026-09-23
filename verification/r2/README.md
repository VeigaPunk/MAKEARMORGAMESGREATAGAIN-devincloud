# verification/r2 — release 1.1 verification kit (Windows run, 2026-09-22)

Re-runnable gates for the committed artifact in `arcade/`. Everything here
needs only Node ≥ 22 (no npm install, no network) except the browser drives,
which additionally need the substrate's `agent-browser` daemon (see below).

## Zero-dependency gates

```
node --test verification/tests/gameplay.test.mjs hardest/regression.mjs \
  MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/progression.test.mjs \
  MAGA-everything/02-code/armor-games/packages/shmup-core/tests/campaign.test.mjs
node hardest/validate.mjs
node verification/r2/audit-static.mjs
```

Last observed: 31/31 tests, 114/114 level proofs, STATIC AUDIT PASS.

## Browser input gates (real trusted input events)

The drives speak raw CDP (`Input.dispatchKeyEvent` with proper `e.code`,
held keys, `Input.dispatchMouseEvent`, `Input.dispatchTouchEvent`) to a real
Chromium — the `agent-browser` daemon shipped with the ZCode substrate. All
game input is real; page state is only *observed* (read-only eval of the
apps' `?debug` hooks, `localStorage` saves, canvas pixel probes). No state
injection, no internal shortcuts.

Protocol to re-run:

1. Serve the artifact: `node tooling/serve.mjs` (port 4173; set `PORT` if
   taken — then update the base URL constant inside each driver).
2. Ensure the daemon has a page open (one-time): `agent-browser open
   http://127.0.0.1:4173/`. The drivers connect to the daemon's CDP
   endpoint themselves and navigate as needed.
3. Run any drive, e.g. `node verification/r2/drive-impossible.mjs`.
   Screenshots and JSON logs land in `../evidence/release-r2/`.

| Drive | Exercises |
| --- | --- |
| `drive-impossible.mjs` | all three courses cleared with discrete real Space taps at recorded jump positions; death/instant-respawn; pause; mute; unlock chain |
| `drive-hardest.mjs` | autopilot tape replay as held arrow keys (level 1 gold clear); mouse-joystick; mute; save outcomes |
| `drive-shmup.mjs` | both packs: start, held-move/fire, waves, named bosses, chapter clears/unlock, gameover loop |
| `drive-boxhead.mjs` | menu chain, kite+mouse-aim+held-fire combat, wave clear, natural death, retry, pause, deathmatch |
| `drive-burger.mjs` | DOM economy actions incl. dirty toggles and PR spend, pane keys, pause, mute, reload-resume |
| `drive-sas.mjs` | creation (typing + stat clicks), shop gates, a won bout by real choices, persistence |
| `sweep-runtime.mjs` | console/exception/network-failure sweep on all pages, hub card + return-link checks, mobile viewport, CDP touch on the Boxhead stick |
| `audit-static.mjs` | structural audit of `arcade/` (completeness, no external URLs, hub integrity) |
| `gen-hardest-tapes.mjs` | regenerates `hardest-tapes.json` from the deterministic autopilot |
| `cdp.mjs` | zero-dep CDP input library + CLI (`keydown/keyup/tap/mouse/click/touch/eval/screenshot`) |

## Notes from this run (environment quirks, for the next operator)

- Node was installed via `winget install OpenJS.NodeJS.LTS`; the workspace
  needs `npm approve-scripts esbuild` + `npm rebuild esbuild` on Windows
  before the first `npm run build`.
- The daemon Chrome keeps pages alive across CLI invocations; key/button
  holds persist between separate `cdp.mjs` calls.
- `agent-browser`'s own `keydown` CLI sends events with empty `e.code` —
  use `cdp.mjs` for keyboard input (it sets codes and virtual key codes).
- Hardest replay pacing: pace tapes on the cumulative 60 Hz frame grid and
  press new keys before releasing old ones, or movement stutters.

## Evidence

`verification/evidence/release-r2/` — PNG screenshots and JSON drive logs
from the 2026-09-22 run. Earlier rounds' evidence is preserved in its
original directories.
