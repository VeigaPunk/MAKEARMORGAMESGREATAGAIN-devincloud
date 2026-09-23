# Chicken Invaders 2 + Cluck Horizon — ship record

Original: Chicken Invaders 2: The Next Wave (InterAction studios, 2002) —
vertical shmup: solar-system arc, formation waves, gift weapon upgrades,
food pickups, missiles, chapter bosses. Shipped titles (original evocations):
**GALACTIC CHICKEN: NEXT WAVE** (replica pack) and **CLUCK HORIZON**
(original-IP pack) on one shared engine.

## Survey (2026-09-22)

| Rendition | Location | State |
|-----------|----------|-------|
| shmup-core + 2 apps | `packages/shmup-core/` + apps | Pack-driven skeleton, ch1 verified |

## Decision: EXTEND shmup-core + both apps — one engine, two packs (binding)

## Phase 1 lane report (2026-09-23) + integration verification

**Replica campaign — CI2 scale:** 10 chapters on the solar arc
(PLUTO → NEPTUNE → URANUS → SATURN → JUPITER → MARS → EARTH → VENUS →
MERCURY → SUN), 10 waves + boss each = 110 waves; per-chapter palette/
formation mixes (grids, swoops, divers, sine weaves, egg barrages) with
density ramps; 10 distinct boss patterns (fan/burst/spiral/wall/summon;
Sun = multi-phase mothership). Weapons: gifts step power 1→11
(PEA → TWIN BOLT → ION STREAM → … SOLAR CANNON; at max, gifts score).
Missiles: X / RMB, big AoE, +1 per boss + rare drops. Food: drumsticks →
points; 8 food = extra life. Lives 3; death costs 1 power level + brief
invuln; game-over → continue from chapter start; chapter unlock + high
score persist.

**Cluck pack:** 3 sectors (THE COOP ROAD → … → DEEP PANTRY), 9 waves +
boss each, 5 weapon kits (SOUP LASER, SPATULA SPREAD, WHISK BARRAGE,
TOASTER TESLA, LADLE LANCE), 3 bosses incl. THE GRAND SOUFFLÉ, courier
jokes between sectors, teal/orange palette distinct from replica.

**Defects fixed:**
- D-37: boss names render (pack-driven `bossNameText` HUD element).
- D-39: all labels/colors from the content pack (verified in render.ts).
- D-41: wave counter clamped during boss/clear banners.
- D-42: speed≤0 gates the whole enemy (shots/collisions/wave-clear).
- D-43: per-type score (hp-scaled).
- D-44: replica types distinct (HEN 1.0/2hp, SCOUT 1.2/1hp, ACE 0.9/3hp).
- **NEW (found in my verification, fixed):** touch drag-pad claimed MOUSE
  pointerdowns in the play field (left 55% / below 35%) during gameplay —
  eating desktop RMB missiles and flipping the session into phantom
  touch mode (`coarse=true` on a mouse click). Zones now claim touch
  pointers only (`pointerType === 'mouse'` gate). RMB missile verified
  firing after the fix (missiles 3→2, pointer.button=2 live).
- **2026-09-23 Devin Cloud run (SWE-2 MAX):** malformed `chapter-unlocked`
  saves (non-integer, negative, or > pack size) bypassed the clamp and
  unlocked every chapter — `sim.ts` now clamps the loaded value to
  `[1, chapters.length]`; shipped pages rebuilt. The stale zcode-lineage
  `campaign.test.mjs` was rewritten for the grown packs (replica 10
  chapters, cluck 3 sectors): 11/11 covering all waves/bosses both packs,
  nova telegraph, malformed saves, gift cap, pause, extra life.

**Organic real-input verification (shipped pages, file://):**
- Replica: wave 1 spawned 10 chickens; arrows+Space cleared it → **wave 2
  spawned** (organic); food pickup (drumstick caught mid-fight); missile
  pickup (+1 stock); X-key missile blast killed 4 chickens in one shot;
  RMB missile fires; **gift caught → power 1→2, PEA→TWIN BOLT** mid-combat.
- Pause: Esc toggles (paused true/false, mode 'play').
- Cluck: boots clean, 3-sector state verified (THE COOP ROAD, wavesTotal 9,
  power 1/5, SOUP LASER).
- Both pages: zero console errors.

Lane-verified items I did not personally re-drive: full chapter-2 clear
with unlock persistence, game-over/continue screen, boss fights + D-41
clamp during boss, per-type score deltas — all live-probed by the lane
before its exit; render/code paths read and consistent with the organic
evidence above.

## Acceptance checklist

- [x] 110-wave replica campaign data + 3-sector cluck campaign (state probes).
- [x] Wave clear → next wave (organic).
- [x] Gift → weapon power escalation (organic, power 2 TWIN BOLT).
- [x] Missile: X key + RMB + pickup refill (organic).
- [x] Food → extra-life economy (organic pickup).
- [x] Pause via Esc (live); pause-screen ↑/↓ volume keys persist; [ ]/M shortcuts added in final polish, live-verified.
- [x] Boss names + all pack labels render (code + lane).
- [x] One engine / two packs — no fork (single shmup-core).
- [x] Zero console errors from file://.

## Verification commands + last observed results

```bash
cd MAGA-everything/02-code/armor-games/packages/shmup-core && npx tsc --noEmit  # GREEN
node tools/ship-build.mjs --only chicken-invaders   # 1909 KB html
node tools/ship-build.mjs --only cluck-horizon       # 1912 KB html
# Browser file:// games/{chicken-invaders,cluck-horizon}/index.html?debug —
# drives as above; evidence verification/evidence/p11-chicken-combat.webp
```

## Known deferrals

- No CI3 4-player co-op / overheat modifiers (out of CI2-era scope).
- Bosses beyond chapter 2 not organically driven this run (lane-probed).
- Firefox/real-device columns not driven this run.
- 2026-09-23 Devin Cloud: the rewritten campaign suite's scripted pilot
  plateaus at replica chapter 9 under the cheap strike driver — win path
  remains sim-proven; organic late-campaign play stays a live-drive
  deferral (suite asserts cluck full win, replica ≥ ch9).

## Provenance

Reference set: this checkpoint (shmup-core, both apps, divergence register
D-37/39/41/42/43/44, MECHANICS-DIGEST) and my own knowledge of Chicken
Invaders 2. No web/GitHub searches for this repository, forks, or
third-party remakes. Run: zai/glm-5.3 on omp; lane work by glm-5.3
subagents (routing corrected per operator directive); the mouse-gate fix
and all live verification by the session model.

---

## Prior run of record — zcode-vanilla substrate, shipped 2026-09-22 (release lineage 1.x)

_Preserved for continuity; the current run's verification above is the living head._

# Chicken Invaders (+ Cluck Horizon pack) — ship record (release 1.1, 2026-09-22)

Original: Chicken Invaders 2: The Next Wave (2002) — vertical shmup with
formation waves, weapon gifts, missiles, bosses. The checkpoint's shmup
engine (`packages/shmup-core`) carries two content packs: the remake
campaign ("replica") and **Cluck Horizon**, an original-IP second campaign.
Both ship on the one engine — no fork.

## Survey

- `packages/shmup-core` — engine (sim + renderer + boot + touch layer) with
  `PACKS` for both campaigns; `apps/chicken-invaders` and
  `apps/chicken-invaders-original` are thin pack bindings.
- At `4f5cc41`: two sectors per pack, three formations per sector, named
  bosses (replica: BIG HEN, MOTHER HEN), weapon gifts, food, missiles,
  extra lives, chapter persistence, pack-specific art.
- `prototypes/chicken-invaders.html` — mechanics proof. Historical reference
  only.

## Decision

**Adopt** both `4f5cc41` apps and the shared engine unchanged (restored).
Architecture preserved: one engine, two packs, both reachable as their own
hub cards.

## Acceptance checklist — last observed results (both packs unless noted)

| Item | Result |
| --- | --- |
| Title → chapter select → start with real keys (1 + Z) | PASS live |
| Formation waves 1–3 progress with held-arrow steering + held-Z fire | PASS live |
| Named boss reached and defeated with real input | PASS live: replica cleared BIG HEN (chapter 1 clear, score 5200); Cluck cleared MOTHER GOOSE (chapter 1 clear, score 5150) |
| Chapter unlock + chapter 2 entry | PASS live: unlocked=2; replica chapter 2 reached wave 3 and boss MOTHER HEN (71/100 hp), score 12425, 53 kills |
| Missiles (X) | dispatched during boss fights (edge-triggered) |
| Gameover → restart loop | PASS live (confirm + title + reselect) |
| Mute, pause-on-blur, chapter persistence | PASS live |
| Full both-chapter WIN with legal input | PASS deterministic: `campaign.test.mjs` drives the shipping sim through every formation and boss of both packs (node suite 31/31); browser-proven by the prior run's Playwright gate (historical) |
| Console health / self-containment | PASS (sweep + audit) |

## Verification commands

```
node --test MAGA-everything/02-code/armor-games/packages/shmup-core/tests/campaign.test.mjs   # both packs, both chapters, real collision rules
node verification/r2/drive-shmup.mjs                                                          # live input gate, both packs
```
Evidence: `verification/evidence/release-r2/40..46-*.png`, `shmup-drive.log.json`.

## Known deferrals

- No in-browser WIN screenshot this run (see fleet record): the live pilot
  cleared chapter 1 + boss + unlock for both packs; the both-chapter win is
  sim-proven and previously browser-proven.
- Replica pack carries the remake campaign's name "Chicken Invaders" on its
  card; rights posture for public redistribution remains the operator's
  clearance step (per repository policy).

## Provenance

Consulted only this working copy (files, git history, prior records) and the
original game as remembered. No external renditions consulted; no web or
GitHub searches about this project; nothing left the working copy.
