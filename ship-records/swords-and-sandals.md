

1. Full combat + creation + ladder + shops + economy rebuild (above).
2. Art: articulated paper-doll fighters, arena scene, UI chrome.
3. Chrome parity: pause n/a (turn-based) but settings/volume/mute/restart;
   touch = tap actions (already button-driven).

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

---

## Prior run of record — release 1.1 (zcode-vanilla substrate, shipped 2026-09-22)

_Preserved verbatim from that run for continuity; the current run's verification above is the living head of this record._

# Swords & Sandals — ship record (release 1.1, run of 2026-09-22)

Original: Swords & Sandals 2: Emperor's Reign (2007) — gladiator RPG with
character creation, shops, a turn-based arena ladder, and persistence.
Shipped as "Swords & Sandals — The arena awaits" with authored art.

## Survey

- `MAGA-everything/02-code/armor-games/apps/swords-and-sandals` — TS app;
  at `4f5cc41`: twelve opponents across three tournaments (Sand Pit, Bronze
  Circuit, Imperial Games), telegraphed combat (heavy-strike warnings →
  guard decisions), potions, shop with level/price gates, save migration,
  champion replay, mobile layout.
- `prototypes/swords-and-sandals.html` — mechanics proof. Historical
  reference only.
- `tests/progression.test.mjs` — 8,400 seeded campaigns over all 84 initial
  builds (node-only; passes).

## Decision

**Adopt** the `4f5cc41` app (restored), including its save validator from
the defect burn.

## Acceptance checklist — last observed results

| Item | Result |
| --- | --- |
| Character creation: name typing (real insertText), look select, six-point stat allocation via +/- buttons | PASS live: stats 2/2/2/2 → strength 5, vitality 4, agility 3 |
| Campaign start ("Enter the arena") | PASS live via real click |
| Hub → shop with affordability/level gates | PASS live: fresh save correctly affords nothing; screens captured |
| Turn-based bout with real choices (attack / shield breaker / potion / guard, heavy-turn warning) | PASS live: bout 1 fought over 5 rounds with attack/guard picks, enemy 34→0, victory |
| Ladder progression | PASS live: hub shows "BOUT 2 OF 12" after the win; enemy roster advances (48 HP) |
| Persistence across reload | PASS live: mode=hub, bout 2 state restored |
| Full 12-bout + 3-tournament completion, all builds, defeat recovery | PASS deterministic: `progression.test.mjs` (8,400 seeded campaigns, max two defeats) |
| Console health / self-containment | PASS (sweep + audit) |

## Verification commands

```
node --test MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/progression.test.mjs
node verification/r2/drive-sas.mjs
```
Evidence: `verification/evidence/release-r2/50..53-*.png`, `sas-drive.log.json`.

## Known deferrals

- Only bout 1 was driven live this run; bouts 2–12 and the tournament
  structure are covered by the seeded-campaign test and the prior run's
  recorded Playwright full-ladder pass.

## Provenance

Consulted only this working copy (files, git history, prior records) and the
original game as remembered. No external renditions consulted; no web or
GitHub searches about this project; nothing left the working copy.

