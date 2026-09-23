# The Impossible Game — ship record

Original: The Impossible Game (Fluke Games; feel reference = 2010 Lite Flash
release; content target = the full game). Shipped title (original evocation):
**IMPOSSIBLE RUN**.

## Survey (2026-09-22)

| Rendition | Location | State |
|-----------|----------|-------|
| TS app (Canvas 2D) | `apps/impossible/src/main.ts` | 1 level, verified collision parity (gap-kill x=1410, block front-edge x=2967) |
| Prototype | `prototypes/impossible-game.html` | Mechanics proof + practice + calibration + full-clear proof |

## Decision: EXTEND the TS app; PORT proto features (binding)

App is canonical (chrome, scaling, verified collision). Proto's practice
checkpoints ported in; campaign authored fresh on the collision-verified core.

## Phase 1 lane report (2026-09-23)

**Campaign — 5 original-evocation tracks (full game, not the Lite slice):**
EMBER WAKE (fire opener, 135 BPM) · PRIME MOVER (plain square, 120) · CHAOS
DREAM (dense spike rhythms, 140) · SKYWARD (airy gaps, 110) · PHASE DRIFT
(finale, 150). 101/84/171/61/195 obstacles; each 2.5–3.25 min at 360px/s.
All levels + 30 practice checkpoints proven clearable by the bundled solver
(`tools/prove.mjs`, BFS + jump-window simulation with the game's exact
physics constants): **ALL LEVELS PASS**, every checkpoint spawn-safe.

**AudioSyncClock:** obstacles are authored on each level's own 16th-note grid
(pxStep = 5400/bpm) — one grid step of travel = one 16th note; songs and
obstacles share the grid so jump windows land on beats. Per-level 2-3 track
chip songs (bass pump + lead + drums) via arcade-core `playSong`; menu bed;
music stops on pause and resumes at cube position; death duck 300ms.

**Modes:** NORMAL (die → restart ≤200ms; measured respawn loop: runT 0.19s
after death, 9 deaths in 7s at the first spike = instant-restart feel) and
PRACTICE (checkpoint flags: 6 built-in grid-snapped flags per level + C/plant
your own (toggle, ground-only, block-top planting prevented); practice
respawn at flag verified live — cube re-appears at flag, not at 0%).

**Defects:**
- **D-35** fixed: pointerdown/keydown are event-queued (`pendingJump`/
  `pendingPtr` consumed next frame) — no per-frame edge polling.
- **D-60**: `__maga` is the only window hook.
- **D-61**: all persisted progress clamped [0,1] at load AND save.
- **Letterbox pointer offset (found in my verification, boxhead D-09 class)**:
  `toLogical` divided by scale without subtracting canvas origin — every
  pointer tap landed offset by the letterbox position. Fixed with
  rect-relative conversion; pointer-driven menus now work (tap-to-start
  verified end-to-end: select → mode → practice, plus pause-overlay
  EXIT/RESTART buttons).

**Chrome:** title, track select (palette chips, medal, BPM, length, best%,
lock states), mode screen, pause overlay (RESUME/RESTART/EXIT, pointer +
Esc/Space), clear screen (medal, NEXT/RETRY/TRACKS), volume row ([ ]/M +
clickable −/+), progress bar + attempt counter in-run, R quick-restart.
Touch: whole-canvas tap = jump; practice DROP FLAG touch button.

**Medals + persistence:** CLEARED (finish) / PERFECT (≤5 deaths) — unlock
next track; bests + medals persisted via arcade-core storage (verified across
reload).

## Acceptance checklist

- [x] 5 levels solver-proven clearable + 30 checkpoints spawn-safe.
- [x] Boot from file://, zero console errors (re-verified post-fix).
- [x] Real keyboard: title→select→mode→run; timed Space tap cleared the first
  lethal gap (best advanced 2.61%→2.77%); death→instant restart verified.
- [x] Practice: flag drop via C (planted at x=2070), die, respawn at flag.
- [x] Pause: Esc toggles (music stops/resumes); overlay EXIT exits (pointer).
- [x] Pointer menus work post-letterbox-fix (full flow driven by taps).
- [x] Persistence across reload (bests, medals, unlock).
- [x] Collision parity constants untouched (death at the known gap x≈1410
  observed in every no-jump run).

## Verification commands + last observed results

```bash
node MAGA-everything/02-code/armor-games/apps/impossible/tools/prove.mjs
# 2026-09-23: ALL LEVELS PASS — 5 tracks, 30/30 checkpoints spawn-safe+solvable

node tools/ship-build.mjs --only impossible
# 2026-09-23: impossible: 69 KB html

# Browser file:// games/impossible/index.html?debug — zero console errors;
# real-input drive (keyboard + pointer) as above; evidence
# verification/evidence/p11-impossible-select.png
```

## Known deferrals

- No level editor (original PC full-game feature; out of v1 scope).
- Input-offset calibration slider (proto feature) not carried over — desktop
  timing is the canonical path per spec; coyote 0.10s / jump-buffer 0.06s
  kept as modern-craft additions.
- Audio ducking is a fixed 300ms envelope, not a separate gain chain.

## Provenance

Reference set: this checkpoint (apps/impossible, prototype card + html,
divergence register D-33/34/35/60/61, MECHANICS-DIGEST §6 AudioSyncClock gap)
and my own knowledge of the original. No web/GitHub searches for this
repository, forks, or third-party remakes. Run: zai/glm-5.3 on omp; lane work
by glm-5.3 subagents (routing corrected per operator directive before edits
landed); integration fixes and verification by the session model.

---

## Prior run of record — zcode-vanilla substrate, shipped 2026-09-22 (release lineage 1.x)

_Preserved for continuity; the current run's verification above is the living head._

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
