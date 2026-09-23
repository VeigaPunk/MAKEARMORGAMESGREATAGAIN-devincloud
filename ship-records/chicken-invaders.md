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
