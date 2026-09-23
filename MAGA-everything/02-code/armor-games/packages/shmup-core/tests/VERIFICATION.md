# Shooter and Boxhead release verification — 2026-09-22

Shipping source was checked after the endless-survival and expanded-campaign changes. The owned tests pass **21/21**, with zero captured browser page errors. TypeScript checks pass for `@maga/shmup-core` and `@maga/boxhead`; `git diff --check` passes for the owned changes.

Run from the outer repository root, with Boxhead on 5173 and the two shooter dev servers on 5176/5177:

```sh
node --test MAGA-everything/02-code/armor-games/packages/shmup-core/tests/*.test.mjs MAGA-everything/02-code/armor-games/apps/boxhead/tests/release.test.mjs
```

The browser tests use the installed Chromium (`/usr/bin/chromium`, override with `CHROMIUM_PATH`). They use fresh browser contexts and the `?debug` handles. No external network assets are required.

## Combat evidence

- Boxhead solo: ordinary movement/aim/fire pilot clears six waves, stops firing during wave seven, dies through normal contact damage, saves **77,000** points, and restarts at wave one with full health and zero score. Simulated duration: **219.97 seconds**.
- Boxhead co-op: both pilots use normal controls, clear six waves, then both fall during wave seven. **103,900** points persist; retry is clean. Simulated duration: **179.98 seconds**.
- Boxhead deathmatch: ordinary movement, directional fire, respawns and ammo collection produce a **5–2** result. P1 collected ammo nineteen times. Simulated duration: **442.15 seconds**.
- Both shooter packs: seeded pilots use only movement, normal guns and available missiles to complete all six formations and both bosses. They do not alter health, entities, score, drops, collision geometry or weapon damage.
- Separate collision-level fixtures cover both three-life loss loops, protected respawns, results/restart, named bosses, chapter unlock and score persistence, safe chapter transitions, gift upgrades, capped extra lives and one-shot radial telegraphs.

Boxhead's clock is controlled during accelerated simulation so damage protection advances with simulated time. A separate regression sends 100 large-delta updates with no elapsed wall time and confirms only one contact hit lands; subsequent 801ms clock advances permit normal damage and death.

## Browser and presentation evidence

Both shooters cover desktop firing, right-click missile support in the shipping bootstrap, toolbar focus restoration, pause/resume, mouse-versus-touch ownership, boss/result rendering, and portrait touch release/blur. Boxhead additionally covers keyboard mode/room selection, hidden menu battlefield/banner layers, paused position freezing, and high-score reload. All three touch fire targets retain at least 44 CSS pixels at 390×844.

Final visual review artifacts:

- `apps/boxhead/proofs/release/{title,play}.png` — actual endless-survival combat, including the authored floor/cover/characters.
- `apps/chicken-invaders/proofs/release/{title,play,boss}.png` — differentiated replica enemies and named boss UI.
- `apps/chicken-invaders-original/proofs/release/{title,play,boss}.png` — authored SVG enemies/ship/bosses and corrected wordmark.
- Outer-root `arcade/covers/{boxhead,chicken-invaders,chicken-invaders-original}.png` — gameplay canvas captures for the release portal.

Historical findings addressed include D-18/D-56 menu bleed; D-37 boss names; D-39 authored pack art and pickup messages; D-41 wave bounds; D-43/D-44 variant rewards and replica differentiation; D-55 pause instructions; D-57 crate timing; and D-58 wall-clock damage protection. Additional fixes prevent chapter hazards leaking into the next sector, gift downgrades, desktop mouse capture by touch zones, held touch after focus loss, toolbar focus stealing, and floor art obscuring solid cover.

## Scope of the claim

These are tested, playable remakes with authored assets and selected reference mechanics. They do not claim exact historical commercial campaign/physics parity. Chromium desktop and emulated portrait touch are covered here; Firefox, Safari and physical-device feel checks are not claimed. Public rights clearance remains separate from technical packaging.


Final visual correction: replica shield highlights now explicitly start their arc path at the bird instead of connecting from `(0,0)`. The browser suite checks isolated shielded-bird and boss geometry bounds to reject origin-spanning strokes. Replica title, play and boss screenshots were recaptured and visually reviewed; the portal cover shows a living ship with all three lives at 2.4 seconds of normal simulation. All four shooter browser tests and the shared package typecheck pass after this renderer-only correction.
