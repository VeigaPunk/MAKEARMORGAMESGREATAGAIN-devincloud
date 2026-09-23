# Clashbound prototype

A dependency-free, file://-safe arena TCG prototype. The browser game is human (P1) versus AI (P2); the headless runner plays both sides with the built-in decks and heroes.

## Run it

From the repository root:

```bash
# Play in a browser — no server or install required
xdg-open tcg/prototype/index.html

# Or open tcg/prototype/index.html directly as file://

# Headless AI-vs-AI: one verbose game
node tcg/prototype/sim.js 7 1

# Headless batch: 200 games from seed 1
node tcg/prototype/sim.js 1 200

# Full 3x3 matchup matrix
node tcg/prototype/sim.js --matrix 200

# Specific matchup
node tcg/prototype/sim.js --deckA trickster --deckB bulwark 1000 300

# Variant file (mutates CB before games)
node tcg/prototype/sim.js --variant tcg/prototype/variants/guard-no-contest.js --matrix 200
```

The browser loads plain scripts in order (`engine.js`, `cards.js`, `ai.js`, `ui.js`); there are no packages, modules, network requests, or build steps.

## Controls

- **Deck select:** pick one of three decks (Bruiser/Vex, Bulwark/Thorn, Trickster/Oddsmaker); the AI takes a different deck at random.
- **Mulligan:** click cards in your opening hand to mark them for redraw, then **Redraw N** or **Keep hand**.
- **Play a card:** click a card in your hand. Cards that exceed your available mana are dimmed; minions enter one of the five board slots.
- **Attack:** click one of your ready minions, then click an opposing minion or the opposing hero bar. A **Guard** minion must be attacked while one is present — unless your attacker has **Pierce** (reach). Newly played minions are sick unless they have **Blitz**.
- **Clash:** when the AI attacks and you hold an affordable Clash spell, a prompt offers the spell or **Decline**.
- **Hero power:** click **Hero power (2)** to spend 2 mana and use your hero's once-per-turn ability.
- **End turn:** click **End turn** to resolve the contest clock and pass priority to the AI.
- **New game:** click **New game** to return to deck select.

## Rules in brief

- Each player starts at **20 HP**, draws an opening hand of 3, and has a 25-card deck. Hands hold at most 10 cards; drawing from an empty deck loses by deck-out.
- You gain a normal mana refill each turn (up to 10). The board holds up to 5 minions. Minions have ATK/HP and normally attack once per turn after summoning sickness.
- **Two clocks:** reduce the opposing hero to 0 HP for a **lethal** win, or win the contest clock by reaching **8 contest points**. At end of each turn, the side with the greater total board ATK gains 1 contest point; ties score nothing. **Contest steal:** if the loser led by ≥2 CP, the winner steals a point instead (−1/+1 swing). **Guard minions' ATK does not count toward the contest sum** — they hold ground, they don't contest it.
- **Surge:** at turn start, a player behind on contest points **by 3 or more** gets +1 temporary mana. Temporary Surge mana is spent before normal mana and expires at the next turn start.
- **Clash:** when an attack is declared, the defender gets a narrow reaction window for a single Clash spell (reduce the attacker, reinforce the defender, damage the attacker, or negate the attack). Clash spells cannot be played from the normal hand-play path.
- **Keywords:** Guard restricts attack targets (and doesn't contest); Blitz can attack immediately; Ward absorbs the first damage instance each refresh; Pierce sends excess minion damage to the opposing hero and may attack past Guards.

## Decks and heroes

Three 25-card stock decks (maximum three copies per card):

- **Bruiser (Vex):** aggressive Pit Rat / Chain Dog pressure, Pit Fighter sweepers, Glass Lancer reach, direct damage, and a Main Event finisher.
- **Bulwark (Mother Thorn):** Guards, Ward minions, healing, removal, card draw, and defensive Clash tricks.
- **Trickster (The Oddsmaker):** cheap board, card draw, Clash spells, and tempo theft — Crowd Shield walls, Crowd Hush debuffs, and the Oddsmaker's −3 ATK power.

Available heroes:

- **Vex the Pitwright — Pit Snipe:** deal 1 damage to a minion.
- **Mother Thorn — Thick Hide:** give a minion +0/+2.
- **The Oddsmaker — Shave the Odds:** the enemy minion with the highest ATK gets −3 ATK.


## Art

`art/` holds hand-authored SVG assets (no external generators): `hero-vex.svg`, `hero-thorn.svg`, `hero-odds.svg` (rendered as portraits in the player bars), `card-back.svg`, and `keywords.svg` (icon strip). Theme→legendary visual map: `../design/art-direction.md`.

## Known limitations

- This is a focused v0.2 prototype, not a complete card-game client: there is no deck editor, collection, multiplayer, persistence, or sound.
- Some card effects are intentionally minimal, and target selection is inferred from clicks rather than supported by a full rules explanation or stack UI.
- Layout and controls are optimized for a desktop browser; accessibility, touch ergonomics, and responsive mobile presentation are not complete.
