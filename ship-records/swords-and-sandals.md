# Swords & Sandals 2 — ship record

Original: Swords & Sandals 2: Emperor's Reign (Oliver Joyce / eGames, 2007) —
gladiator RPG: character creation, turn-based tactical arena duels, gold/XP,
shops, arena ladder, persistence. Shipped title (original evocation):
**SANDALS OF STEEL: REIGN OF THE COLOSSUS**.

## Survey (2026-09-22)

| Rendition | Location | State |
|-----------|----------|-------|
| TS app | `apps/swords-and-sandals/` | Was a 53-line skeleton |
| Prototype | `prototypes/swords-and-sandals.html` | Richer prior systems |

## Decision: GROW the TS app into the full game (binding)

Built out from the skeleton (proto systems ported where good, save-hardening
kept).

## Phase 1 lane report (2026-09-23) + integration verification

**Full game built:**
- **Creation:** name, 3 look presets, 20-point buy across 6 stats
  (Strength, Agility, Attack, Defence, Vitality, Charisma).
- **Combat (turn-based distance line):** QUICK/POWER ATTACK, ADVANCE/
  WITHDRAW (gap meter, e.g. "too far — 53 to close"), RANGED (range 30+,
  ammo), three level-gated spells (EMBER BOLT L3, MEND L4, WAR CRY L5),
  POTION/mana FLASK, TAUNT (crowd surges, foe enrages), SURRENDER (forfeit
  25% purse). Crowd meter fills on hits/taunts (charisma-scaled); opponent
  AI is range-aware and heals when hurt. Damage numbers, hit reactions.
- **Ladder:** 10 opponents + final COLOSSUS OF STEEL, escalating stats;
  purse 50g + 12g/bout; XP/levels (+3 stat points per level).
- **4 shops:** WEAPONSMITH [q] (6-tier blade ladder), ARMOURY [w]
  (helm/chest/shield/boots), ALCHEMIST [e] (potions + mana), FLETCHER [r]
  (slings/bows/ammo) — level+gold gates, paper-doll equip slots render on
  the fighter. Healer service in hub.
- **Persistence:** full gladiator + ladder + inventory + equipped;
  defeat keeps progress (25% purse loss only); NG+ after the Colossus
  (ladder reset, +25% enemy stats).
- **Economy (D-54) sim-proven winnable:** deterministic ladder sim
  (`tools/sim.mjs`, shares the combat engine): **83% bout completion,
  final bout ~33% first-try for a below-average policy** — tuned to
  demanding-but-fair.
- Audio: crowd loops, combat/hit/crit SFX, shop chimes, per-screen music
  beds; settings volume slider + mute.

**Security (D-51/52/53) — regression verified live:** gladiator named
`<img src=x onerror=window.__xss=1>` typed via real key events, saved,
reloaded, rendered on hub/combat/end screens — `window.__xss` stays
undefined on every screen and after reload, no `<img>` element is ever
created, payload renders as literal text (textContent discipline
everywhere; `validSave` schema-gating kept).

**Organic real-input verification (shipped page, file://):**
- Title → NEW GLADIATOR → typed name (key events) → 20-point allocation
  (STR 9 / AGI 6 / ATT 5 / DEF 5 / VIT 8 / CHA 5) → ENTER THE ARENA.
- Bout 1 (Tin Can Tim, 55hp) fought with real clicks — ADVANCE to close,
  QUICK ATTACK spam, POTION at low HP → **victory** (50hp left).
- Rewards credited: gold 137, XP 36, LEVEL 2, defeated 1 → bout 2.
- WEAPONSMITH: bought the first blade (137→73g), paper-doll `weapon: w1`
  equipped (helm/chest/shield/boots/ranged slots present).
- Reload → CONTINUE restores bout 2 / gold 73 / level 2 / defeated 1;
  bout 2 opponent Baron Bonk; HEAL service 14g.
- Settings screen with volume slider.
- Zero console errors; evidence `verification/evidence/p11-sas-hub.webp`.

## Acceptance checklist

- [x] Create → bout → shop → next bout full loop (organic).
- [x] Distance-line tactical combat with full action set (all buttons live).
- [x] Crowd meter + spells gating + ranged ammo (gates render).
- [x] Economy sim-proven winnable to the final bout (83% / 33%).
- [x] Persistence + CONTINUE flow (organic, across reload).
- [x] XSS regression green (stored payload never executes).
- [x] Settings volume/mute.
- [x] Zero console errors from file://.

## Verification commands + last observed results

```bash
cd MAGA-everything/02-code/armor-games/apps/swords-and-sandals && npx tsc --noEmit  # GREEN
node tools/ship-build.mjs --only swords-and-sandals                              # 27 KB html
# Economy sim (deterministic):
node MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tools/sim.mjs
# 2026-09-23: 83% completion · final first-try ~33% (below-average policy)
# Browser file:// games/swords-and-sandals/index.html?debug — drives as above.
```

## Known deferrals

- Ten save slots (marketing feature of the original) — single slot ships.
- Height/build sliders from the lane brief not present (stats carry the
  build identity; visual body variety via look presets only).
- Full NG+ enemy scaling verified by sim, not organically driven.

## Provenance

Reference set: this checkpoint (sas app + prototype card, divergence
register D-51/52/53/54, MECHANICS-DIGEST economy dials) and my own
knowledge of Swords & Sandals 2. No web/GitHub searches for this
repository, forks, or third-party remakes. Run: zai/glm-5.3 on omp; lane
work by glm-5.3 subagents (routing corrected per operator directive);
XSS regression drive and all live verification by the session model.

---

## Prior run of record — zcode-vanilla substrate, shipped 2026-09-22 (release lineage 1.x)

_Preserved for continuity; the current run's verification above is the living head._

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
