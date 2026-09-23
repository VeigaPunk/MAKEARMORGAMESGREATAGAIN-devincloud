# Boxhead · 2Play Rooms

A private, native TypeScript/PixiJS remake with authored block characters, industrial rooms, synthesized sound, and local two-player play. Original-game asset redistribution and public rights clearance are outside this build. Historical fidelity notes remain in the design dossiers.

Run from `MAGA-everything/02-code/armor-games`:

```sh
npm run dev:boxhead
npm run build -w @maga/boxhead
```

Solo and co-op are **endless survival**. Three introductory waves lead into steadily increasing crowds and runners. The director caps concurrent enemies at 32 and bounds its late-game speeds. Surviving a wave gives each living player 12 rounds and 10 health; ammo crates continue throughout a run. Co-op ends when both players fall. Deathmatch is first to five kills, with respawns and ammo supplies.

Kills increase the shared score multiplier and advance pistol → shotgun → uzi → explosive grenades. The streak decays without kills and resets on damage. Barrels chain explosions; grenade owners are protected from their own blast. High scores survive reloads.

| Action | Solo | Two-player P1 | Two-player P2 |
| --- | --- | --- | --- |
| Move | WASD / arrows | WASD | Arrows |
| Fire | Space / J, mouse aims | Space | IJKL / numpad 8, 4, 5, 6 |
| Pause / resume | Esc / P, toolbar | Esc / P, toolbar | — |
| Leave paused/end screen | M | M | — |

Touch solo uses a left stick and a right fire target with nearest-enemy aim. Fire remains at least 44 CSS pixels in portrait. Menu cards are tappable, including both rooms. Focus loss pauses play and clears held input. Clicking toolbar controls returns focus to the game.

`?debug` exposes `window.__maga` for verification. Save keys are `maga:boxhead:highscore` and `maga:boxhead:keymaps`. Display fits the available viewport at a uniform aspect ratio, with crisp raster scaling.

With the dev server running and root verification dependencies installed:

```sh
node --test apps/boxhead/tests/release.test.mjs
```

The browser suite pilots solo/co-op through six complete waves with ordinary movement and weapon inputs, then verifies natural death, score persistence, and retry. It also completes a real five-kill deathmatch with crate collection, and covers contact-damage burst protection, menu layers, pause, and toolbar focus. Screenshots are in `proofs/release/`.
