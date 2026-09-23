

---

## Prior run of record — release 1.1 (zcode-vanilla substrate, shipped 2026-09-22)

_Preserved verbatim from that run for continuity; the current run's verification above is the living head of this record._

# Boxhead — ship record (release 1.1, run of 2026-09-22)

Original: Boxhead: 2Play Rooms (2007) — top-down arena survival; solo plus
local two-player co-op and deathmatch. Player-facing name kept as "Boxhead"
only in internal records/docs; the game presents itself as **BOXHEAD · 2PLAY
ROOMS** with fully authored art.

## Survey

- `MAGA-everything/02-code/armor-games/apps/boxhead` — TS app (Pixi), the
  only implementation. At the reverted `4f5cc41` it shipped: endless
  escalating waves, two rooms, four weapon tiers via pickups, crates,
  explosive barrels, solo/co-op/deathmatch, score records, touch layout C.
- `prototypes/` — no boxhead prototype existed.
- Prior verification: `apps/boxhead/tests/release.test.mjs` (node-only sim
  gate) + Playwright browser specs (now historical).

## Decision

**Adopt** the `4f5cc41` app wholesale (restored via git checkout); no
replacement. This run added nothing to its code; it rebuilt the artifact and
re-verified it with real input on Windows.

## Acceptance checklist — last observed results

| Item | Result |
| --- | --- |
| Solo survival: menu → start, waves escalate, natural death | PASS live (2026-09-22): wave 1 cleared, died on wave 2 with 6 zombies left, score 3300, best recorded |
| Weapons/crates/barrels economy | PASS by sim test (`release.test.mjs`, part of the 31-test node suite) + live pilot fetched crates (ammo 24→11→resupplied) |
| Local deathmatch | PASS live: boots with 2 player slots, P1 held-fire consumed ammo, P2 fire cluster dispatched |
| Pause / mute / retry / menus | PASS live: P pause→resume, DOM SOUND button, SPACE retry after death, menu chain SPACE/1/1 |
| Touch (virtual stick + FIRE button) | PASS live: CDP trusted touch events drove the stick (normalized x≈0.98), release cleared it |
| Persistence (best score) | PASS live: BEST updated 300→3300 across runs |
| Console health | PASS: zero errors/exceptions (sweep) |
| No external assets | PASS (audit + zero non-local requests) |

## Verification commands

```
node --test MAGA-everything/02-code/armor-games/apps/boxhead/tests/release.test.mjs   # part of 31-pass suite
node verification/r2/drive-boxhead.mjs                                                # live input gate (see verification/r2/README.md)
node verification/r2/sweep-runtime.mjs                                                # errors + touch + mobile
```
Evidence: `verification/evidence/release-r2/20..25-*.png`, `boxhead-drive.log.json`.

## Known deferrals

- Co-op (mode 2) not driven live this run (deathmatch covers the two-player
  input split; co-op shares it). Recorded as untested-live, sim-covered.
- Two rooms exist; live run used Room 1 only.

## Provenance

Consulted only this working copy (files, git history, prior verification
records) and the original game as remembered. No external renditions, no
web/GitHub searches about this project. Nothing left the working copy.

