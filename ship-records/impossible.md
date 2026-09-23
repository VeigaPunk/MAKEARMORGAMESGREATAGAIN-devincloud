# The Impossible Game — ship record (release 1.1, run of 2026-09-22)

Original: The Impossible Game (feel reference: 2010 Lite release; content
target: the full game). One-button rhythm autorunner, fixed-impulse jump,
instant respawn.

## Survey

- `MAGA-everything/02-code/armor-games/apps/impossible` — TS app; at
  `4f5cc41`: three authored courses with distinct palettes, unlock
  progression, practice mode with checkpoints and separate records,
  synthesized music bed, title/pause/clear/retry flows.
- `prototypes/impossible-game.html` — mechanics proof (fixed-impulse jump
  physics, sub-frame tap rules). Historical reference only; not reachable
  from the entry point.

## Decision

**Adopt** the `4f5cc41` app (restored). The prototype remains a historical
mechanics reference; exactly one rendition is reachable from the hub.

## Acceptance checklist — last observed results

| Item | Result |
| --- | --- |
| Course 1 full clear, real Space taps at recorded jump x-positions | PASS live: cleared in 27.2 s, 17/17 jumps, 0 deaths |
| Course 2 full clear | PASS live: 34.7 s, 19 jumps, 0 deaths |
| Course 3 full clear | PASS live: 40.5 s, 24 jumps, 0 deaths |
| Unlock progression (course N+1 after clearing N) | PASS live: course buttons 2 and 3 became selectable and were selected via real clicks |
| Death → instant respawn | PASS live: died at x=1410 refusing to jump; attempt 2 running ~1.2 s later |
| Pause / resume / quit to title | PASS live: DOM pause button, overlay buttons clicked |
| Mute | PASS live: DOM sound button clicked |
| Sim-level guarantees (landing never snaps through platforms, practice checkpoints, records) | PASS: `verification/tests/gameplay.test.mjs` (node suite, 31/31) |
| Console health / self-containment | PASS (sweep + audit) |

## Verification commands

```
node --test verification/tests/gameplay.test.mjs    # includes all three course tapes at 60 Hz
node verification/r2/drive-impossible.mjs           # live input gate
```
Evidence: `verification/evidence/release-r2/10..13-*.png`, `impossible-drive.log.json`.

## Known deferrals

- Practice mode exercised at sim level only this run (its live UI was not
  driven); normal-mode full completion covers the shipped content bar.

## Provenance

Consulted only this working copy (files, git history, prior records) and the
original game as remembered. No external renditions consulted; no web or
GitHub searches about this project; nothing left the working copy.
