# Armor Arcade — the remake collection

Six classic Flash-era games, remade as complete, polished browser games —
plus Cluck Horizon, an original-IP second campaign on the shooter engine.
One hub, no accounts, no network: everything playable is committed.

**Entry point: [`arcade/index.html`](arcade/index.html)** — the single entry
file of the collection. Start a trivial local static server from this
directory and open it:

```
node tooling/serve.mjs          → http://127.0.0.1:4173
# or: python -m http.server 4173
```

The World's Hardest Game also opens directly via `file://`; the six module
apps need an HTTP origin. No CDN, no API keys, no build step for the player:
`arcade/` is the finished artifact (≈5.7 MB).

## The games

| Game | Scope |
| --- | --- |
| **Boxhead** | Endless escalating survival, local co-op, first-to-five deathmatch, two arenas, weapon tiers, crates, barrels, score records |
| **The Impossible Game** | Three authored courses, fixed-impulse one-button play, instant respawn, practice checkpoints, records and unlocks |
| **Burger Tycoon** | Four animated operations feeding one live economy, dirty shortcuts with consequences, save/resume, bankruptcy and collapse |
| **Chicken Invaders** | Two sectors, formation waves, weapon gifts, missiles, extra lives, named bosses, chapter persistence |
| **Cluck Horizon** | Original-IP campaign on the same shooter engine: own flock, ship, bosses, weapons and art |
| **Swords & Sandals** | Twelve challengers across three tournaments, character builds, telegraphed turn-based combat, shop upgrades, saved progression |
| **The World's Hardest Game** | 114 handcrafted levels with coins, keys, doors, portals, moving walls, medals and per-level records |

## Verify

Zero new dependencies, zero network (Node ≥ 22 only):

```
node --test verification/tests/gameplay.test.mjs hardest/regression.mjs \
  MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/progression.test.mjs \
  MAGA-everything/02-code/armor-games/packages/shmup-core/tests/campaign.test.mjs
node hardest/validate.mjs            # 114/114 level proofs
node verification/r2/audit-static.mjs
```

Real-browser input gates (substrate browser daemon required):
see `verification/r2/README.md`. Per-game evidence and claims:
`ship-records/`. Release history: `verification/RELEASE.md`.

## Source layout

- `arcade/` — **the shipped, committed artifact** (hub + all games).
- `tooling/` — `build.mjs` (rebuilds `arcade/` in place from sources),
  `serve.mjs` (static server).
- `MAGA-everything/02-code/armor-games/` — TypeScript sources (six Vite
  apps + `arcade-core` / `shmup-core` engines). Rebuild with one
  `npm install` then `node tooling/build.mjs`.
- `hardest/` — the dependency-free precision game and its 114-level corpus
  and validator.
- `verification/` — evidence from this and prior audit rounds.
- `ship-records/` — per-title ship records: acceptance checklists, exact
  commands, known deferrals, provenance.
- `prototypes/`, `MAGA-everything/01-design-docs/` — historical mechanics
  proofs and the design pack (reference, not entry-reachable).

## Rights posture

These are authored remakes: original mechanics and feel, entirely original
art, audio, and text. No original commercial assets are used and no
frame-perfect parity is claimed. Per-title rights clearance before any
public redistribution is the operator's step. This is a private collection:
nothing here is published.
