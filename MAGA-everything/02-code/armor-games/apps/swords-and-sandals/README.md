# Swords & Sandals — the emperor’s arena

A complete twelve-bout arena campaign across three tournaments: create a gladiator, allocate six skill points, fight, collect gold and XP, equip upgrades, and claim the champion’s laurel. A new campaign is available from the champion screen. The hand-authored canvas art includes a tiered colosseum, animated braziers, armored fighters, twelve opponents with distinct palettes, weapon silhouettes, and heavy-strike rhythms, hit reactions and victory confetti.

Run `npm run dev --workspace @maga/swords-and-sandals` from the armor-games workspace, then open http://127.0.0.1:5178. The root arcade build packages the same game at `/swords-and-sandals/` with relative assets.

Mouse and touch buttons operate every screen. In combat, **1** attacks, **2** uses Shield breaker, **3** drinks a potion, and **4** guards. Shield breaker recovers for two actions. Enemy heavy strikes arrive every two, three, or four turns, depending on the opponent; the next intent is always visible. Guard reduces incoming damage by eight. Potions heal 26 HP and brace against three damage. Before each bout the healer restores full health and two potions. Losing costs no gold, preventing exhausted-inventory dead ends. The smith automatically equips purchases; replacing armor does not stack its bonuses.

The six creation points affect strength, accuracy/criticals, maximum health, and defense. Twelve victories award 264 XP, reaching level seven. Eight permanent gear upgrades span the three tournaments. Level ups improve health and damage. Progress and owned equipment save between bouts. Corrupt saves safely return to creation; names are rendered as text. Existing valid checkpoint saves migrate to the current equipment/health formulas. A four-win checkpoint continues into the Bronze Circuit instead of ending the game.

## Verification

From the repository root (Node 24+):

```sh
node --test MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/progression.test.mjs
node MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/browser.mjs
```

The first runs 8,400 seeded full campaigns across all 84 legal skill builds, using normal combat and shop rules. Every tested build completed with at most two defeats. It also tests reward duplication, purchase guards, illegal actions, defeat recovery, and corrupt saves. The second uses installed Playwright and `CHROMIUM_PATH`, system Chromium, or Playwright’s bundled browser against port 5178 (override `SAS_URL`): real desktop clicks and emulated phone taps complete all twelve bouts, buy gear, reload between bouts, reach champion, and restart. It also verifies stored name/appearance injection cannot execute. Screenshots are in `tests/evidence/`.

This is an independently implemented, locally playable remake of the scoped arena loop. Combat/economy values are balanced for this campaign, not claimed as exact original tables. Original art and code are authored here. Existing project rights status remains **INTERNAL-NO-PUBLIC** pending clearance for public distribution.
