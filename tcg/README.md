# tcg/ — Clashbound: an arena TCG that beats Thursday Arena

**Owner:** tcg-arena L1 mission (fleet maga) · **Posture:** INTERNAL-NO-PUBLIC

## Layout

| Path | What |
|---|---|
| `intel/poteto-arena-tcg.md` | Recovered dossier on @poteto's game — **Thursday Arena** (auto-battler, live at thursdayarena.com since 2026-09-17) |
| `intel/ta-catalog.json` | Thursday Arena bot catalog (179 cards, machine-readable API capture) |
| `intel/ta-items.json` | Thursday Arena items (19, season 3) |
| `design/arena-tcg-design.md` | Full design doc — rules, card model, economy, win conditions, scored comparison vs Thursday Arena + Hearthstone |
| `prototype/` | Playable dependency-free HTML5 prototype — open `index.html` (file://-safe) or `node sim.js` for headless AI-vs-AI (`--matrix N` for the 3×3 matchup table, `--variant <file>` for balance variants) |

## The pitch in one paragraph

Thursday Arena is a 3-bot auto-battler: all decisions live in a 10-token shop, then the battle plays itself. **Clashbound** keeps its one-screen legibility (5-slot board, ATK-sum contest track) but puts agency back in combat: real deck/hand/mana, directed attacks, a narrow Clash-spell reactive window, and **Surge** — a structural comeback engine that grants mana to a player behind on the contest track by ≥3. Two win clocks (lethal or 8 contest points) mean every turn is a split-attention decision. R2 balance pass: Guard ATK no longer contests, Pierce ignores Guard, three decks tuned to a rock-paper-scissors spread (worst non-mirror pair 45%, was 4%). Scored comparison in `design/`: Clashbound 21 vs TA 14 vs HS 12 on the five mission axes.

## Run it

```bash
# headless sim (one verbose game / batch stats)
node tcg/prototype/sim.js 7 1
node tcg/prototype/sim.js 1 200

# playable UI — any static server or straight file://
xdg-open tcg/prototype/index.html
```
