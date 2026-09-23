pending

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

# Burger Tycoon — ship record (release 1.1, run of 2026-09-22)

Original: Molleindustria's McDonald's Videogame (~2006), four-pane
supply-chain management with a dirty-action economy. Shipped under the
checkpoint's original-evocation branding "Burger Tycoon / GROWTH AT ANY
COST" — no McDonald's names, marks, or art.

## Survey

- `MAGA-everything/02-code/armor-games/apps/burger-tycoon` — TS app with
  animated pane scenes (`src/scenes.js`), live economy sim (`src/sim.ts`),
  dirty actions with consequences (disease → backlash → reputation
  collapse), save/resume, bankruptcy, keyboard 1–4 pane shortcuts, mobile
  tabs layout.
- `prototypes/burger-tycoon.html` — mechanics proof. Historical reference
  only.

## Decision

**Adopt** the `4f5cc41` app (restored), including its save-format validator
carried in the prior defect burn.

## Acceptance checklist — last observed results

| Item | Result |
| --- | --- |
| Boot → "Open for business" start via real click | PASS live |
| Four operations, actions with affordability gating | PASS live: "Use cheap feed" engaged (dirty.cheapFeed 0→1, toggle back on second click); correctly-disabled buttons refused (cattle/crops caps, demand gates) |
| Dirty economy consequences | PASS by sim test: dirty throughput → disease → backlash → REPUTATION collapse; clean idle → BANKRUPT (node suite 31/31) |
| HQ spend applies costs | PASS live: PR spin click, cash −$100 |
| Keyboard pane switching (1–4) | PASS live |
| Pause / mute | PASS live via header buttons |
| Save → reload resume | PASS live twice: reload restored the run (same cash), overlay offers "Continue company" |
| Mobile layout (390×844) | PASS live: tab bar activates (`display:flex`), screenshot captured |
| Console health / self-containment | PASS (sweep + audit) |

## Verification commands

```
node --test verification/tests/gameplay.test.mjs    # economy rules incl. collapse paths
node verification/r2/drive-burger.mjs               # live DOM input gate
node verification/r2/sweep-runtime.mjs              # includes mobile pass
```
Evidence: `verification/evidence/release-r2/30..33-*.png`, `70-burger-mobile.png`, `burger-drive.log.json`.

## Known deferrals

- A full collapse-to-game-over was not driven live this run (takes minutes of
  economy time); covered deterministically by the sim tests.

## Provenance

Consulted only this working copy (files, git history, prior records) and the
original game as remembered. No external renditions consulted; no web or
GitHub searches about this project; nothing left the working copy.

