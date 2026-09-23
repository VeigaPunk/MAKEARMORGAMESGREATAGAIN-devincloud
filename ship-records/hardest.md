

---

## Prior run of record — release 1.1 (zcode-vanilla substrate, shipped 2026-09-22)

_Preserved verbatim from that run for continuity; the current run's verification above is the living head of this record._

# The World's Hardest Game — ship record (release 1.1, run of 2026-09-22)

Original: precision dodge-and-collect mazes; the checkpoint's near-complete
rendition with a 114-level authored corpus and a deterministic autopilot
validator.

## Survey

- `hardest/` — zero-dependency game (`engine.js`, `game.js`, `save.js`) +
  114 levels + `validate.mjs` (schema, reachability, deterministic
  completability) + `regression.mjs`. The only implementation; improved at
  `4f5cc41` (corrupt-save/medal-crash repairs, movers, pars, medals,
  accessible level picker, save schema v1).
- No prototype; not part of the monorepo.

## Decision

**Adopt** `hardest/` (restored to its `4f5cc41` state) and keep it as the
sole zero-build source game, copied verbatim into the artifact by
`tooling/build.mjs`.

## Acceptance checklist — last observed results

| Item | Result |
| --- | --- |
| 114/114 levels: schema, reachability, deterministic autopilot clear | PASS: `node hardest/validate.mjs` → 114/114 (run twice this session: before and after the artifact rebuild) |
| Menu: 114-tile grid, keyboard navigation, unlock gating | PASS live |
| Level 1 cleared with real held-arrow input replayed from the autopilot tape | PASS live: save recorded **gold medal, 0 deaths, 4.183 s** (game's own medal system) |
| Pointer joystick (mouse/touch) | PASS live: circular drag moved the player (canvas-follow), release ended control |
| Mute (M), restart (R), pause/quit | PASS live |
| Persistence (unlocked levels, per-level bests, medals, deaths) | PASS live: `hardest.save.v1` updated across runs |
| file:// direct open | PASS live: page boots and renders from `file:///…/arcade/hardest/index.html` |
| Console health / self-containment | PASS (sweep + audit) |

## Verification commands

```
node hardest/validate.mjs                     # must pass before and after changes
node --test hardest/regression.mjs            # engine invariants
node verification/r2/gen-hardest-tapes.mjs    # regenerate autopilot input tapes (levels 1–3 by default)
node verification/r2/drive-hardest.mjs        # live tape replay + joystick gate
```
Evidence: `verification/evidence/release-r2/60..66-*.png`, `hardest-drive.log.json`,
`hardest-tapes.json`.

## Known deferrals

- Live browser tape replay cleared level 1 (gold). Levels 2–3 tapes replay
  under wall-clock pacing and are recorded as best-effort (attempts logged
  with positions/deaths); their completability is proven deterministically
  for all 114 levels by `validate.mjs` against the same engine code the
  browser runs.
- Physical touch hardware untested (CDP-level trusted touch + pointer paths
  verified).

## Provenance

Consulted only this working copy (files, git history, prior records) and the
original game as remembered. No external renditions consulted; no web or
GitHub searches about this project; nothing left the working copy.

