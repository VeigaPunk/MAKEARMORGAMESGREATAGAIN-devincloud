# The Impossible Game — ship record

Original: The Impossible Game (Fluke Games; feel reference = 2010 Lite Flash
release; content target = the full game). One-button rhythm autorunner,
fixed-impulse jump, instant respawn, practice mode with checkpoints, medals.
Player-facing name for our build: **THE IMPOSSIBLE GAME** kept as genre-title
evocation? → **IMPOSSIBLE RUN** (final call at ship; see rights note).

## Survey (2026-09-22)

| Rendition | Location | State |
|-----------|----------|-------|
| TS app (Canvas 2D) | `MAGA-everything/02-code/armor-games/apps/impossible/src/main.ts` (295 lines) | 1 level (~9902px), verified collision parity (gap-kill x=1410, block front-edge x=2967), best-progress persist, ?debug hooks |
| Prototype | `prototypes/impossible-game.html` (637 lines) | Mechanics proof + practice checkpoints + input-offset calibration + full-clear proof; r6 art pass |

## Decision: EXTEND the TS app; PORT proto features

App is canonical (chrome, scaling, verified collision). Proto's practice
checkpoints, calibration, and layout work get ported in. Level campaign built
fresh on the app's collision-verified core.

## Content targets (full game, not the Lite slice)

- 5 classic-style levels (original evocations of: Fire Aura, Original, Chaoz
  Fantasy, Heaven, Phazd) — distinct palettes, rhythm-aligned obstacle
  cadence, escalating difficulty. Level names must be original: e.g.
  EMBER WAKE, PRIME MOVER, CHAOS DREAM, SKYWARD, PHASE DRIFT.
- Practice mode: checkpoint flags (drop/toggle), per original.
- Normal mode: death → instant restart ≤200ms feel; medals (clear / no-death).
- Music: per-level chip track, beat-aligned obstacle placement (AudioSyncClock
  gap flagged in MECHANICS-DIGEST §6 — close it).
- Persistence: best progress per level, medal state.

## Open defects

- D-35 sub-frame pointer taps dropped (poll edge-detect).
- D-60 `__proto` hook shadowed (use `__maga`).
- D-61 debug die() persists unclamped progress.

## Ship plan

1. Campaign: 5 levels, each with authored geometry + music pattern.
2. Practice mode + checkpoints; medals; level select.
3. Defects; audio sync clock; chrome parity (pause/settings/volume).

## Acceptance checklist (to fill at ship)

- [ ] pending

## Verification commands + last results (to fill at ship)

```bash
# pending
```

## Known deferrals (to fill at ship)

- pending

## Provenance (to fill at ship)

- pending
