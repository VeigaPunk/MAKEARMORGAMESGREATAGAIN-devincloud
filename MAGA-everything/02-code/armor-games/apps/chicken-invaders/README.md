# Chicken Invaders · The Next Wave

A private CI2-inspired native remake built on `@maga/shmup-core`. Art is authored vector geometry, with no original game assets or soundtrack. Exact original wave and balance parity is not claimed; the historical reference gaps remain documented in the design dossier. Public distribution requires the project's separate rights clearance.

Run `npm run dev:chicken` from the monorepo directory; the game opens on port 5176. `npm run build -w @maga/chicken-invaders` produces a static build.

Each of two sectors contains three formations followed by a named boss. Straight, swooping and diving groups use three visibly distinct enemy types with different speed, health and score. The final boss has a five-egg aimed volley and a telegraphed sixteen-egg burst. Beating sector one unlocks sector two and safely clears the previous battlefield; winning the campaign shows the final and best score.

Gifts upgrade through three weapons without downgrading the strongest one. Drumsticks replenish missiles, up to six. Start with three lives; every 5,000 points grants another life, capped at five. Respawn takes 1.2 seconds and grants two seconds of protection. Best score and sector unlocks persist independently per game.

| Action | Control |
| --- | --- |
| Move | WASD / arrows |
| Fire | Space / Z / left mouse |
| Missile | X / Shift / right mouse |
| Pause / resume | Esc / P / toolbar; tap paused field to resume |
| Title / results | Enter / R / tap |

Portrait touch uses a relative drag pad with autofire, plus labelled fire and missile buttons at least 44 CSS pixels across. Leaving the window pauses the game and releases every held control. Toolbar clicks restore game focus.

Debug builds opened with `?debug` expose `{sim,input,touch,renderer,app,state}` on `window.__maga`. Storage keys are `maga:chicken-invaders:chapter-unlocked` and `maga:chicken-invaders:best-score`.

Verification commands, with the monorepo dependencies and outer-root browser test dependencies installed:

```sh
node --test packages/shmup-core/tests/campaign.test.mjs
# Both shooter dev servers must be running for browser checks:
node --test packages/shmup-core/tests/browser.test.mjs
```

The simulation tests complete both campaigns through a seeded pilot that uses only movement, normal shots and missiles; separate tests cover loss/respawn, persistence, corrupt saves, reward progression, and single-fire boss telegraphs. Browser tests cover both packs' controls, boss/result rendering, portrait touch release, pause and toolbar focus. Final screenshots are in `proofs/release/`.
