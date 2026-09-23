# Ship Records — Make Armor Games Great Again

One living record per game. Each record starts as a survey (every rendition
found in the checkpoint, adopt/extend/replace decision) and ends as the ship
record (acceptance checklist, exact verification commands with last observed
results, known deferrals).

## Records

| Game | Record | Rendition shipped |
|------|--------|-------------------|
| Boxhead: 2Play Rooms | [boxhead.md](boxhead.md) | `games/boxhead/index.html` |
| The Impossible Game | [impossible-game.md](impossible-game.md) | `games/impossible/index.html` |
| Burger Tycoon | [burger-tycoon.md](burger-tycoon.md) | `games/burger-tycoon/index.html` |
| Chicken Invaders 2 (+ Cluck Horizon) | [chicken-invaders.md](chicken-invaders.md) | `games/chicken-invaders/index.html`, `games/cluck-horizon/index.html` |
| Swords & Sandals 2 | [swords-and-sandals.md](swords-and-sandals.md) | `games/swords-and-sandals/index.html` |
| The World's Hardest Game | [hardest.md](hardest.md) | `games/hardest/index.html` |

## Fleet architecture (decided by first shipping run, 2026-09-22 — binds later runs)

- **Entry point:** repository root `index.html` — one arcade portal, one entry
  file. Every game reachable only from it.
- **Shipped renditions:** plain self-contained HTML pages under `games/`
  (single file per game: inline JS bundle, inline CSS, inline art). They run
  from `file://` with no server, no CDN, no install, no build step.
- **Source of truth for five titles:** the TS/Vite monorepo at
  `MAGA-everything/02-code/armor-games/` (apps + `arcade-core`/`shmup-core`).
  `tools/ship-build.mjs` (dev tooling, needs `npm install` once) bundles each
  app with esbuild into the shipped pages. If a future run has no network, it
  edits the shipped pages directly — they are unminified and readable.
- **Hardest:** stays a zero-dependency classic-script tree; the ship build
  copies `hardest/index.html` + engine/levels into `games/hardest/` verbatim.
- **Prototypes:** retired from the entry point; remain under `prototypes/` as
  mechanics reference (authoritative for mechanics, not polish).
- **Rights posture:** player-facing names/art are original evocations of the
  originals; originals are referenced by name in docs/comments/records only.

## Verification (re-runnable, zero new dependencies, zero network)

```bash
node hardest/validate.mjs                       # hardest corpus proof (uses games/hardest copy)
node tools/ship-build.mjs                       # only after editing TS sources; needs node_modules
# Browser: open index.html from file:// (or: npx serve . ) and play.
# Evidence artifacts: verification/evidence/<run>-*
```

## Run identity

- Run date: 2026-09-22
- Model: `zai/glm-5.3`
- Substrate: Oh My Pi (`omp`) CLI on local Arch Linux; node v24.19.0,
  npm 11.17.0, esbuild 0.25.12, /usr/bin/chromium for browser verification.
- Git identity (repo-local): `maga-ship <ship@local.invalid>`
- Nothing leaves the working copy. No push, no publish.
