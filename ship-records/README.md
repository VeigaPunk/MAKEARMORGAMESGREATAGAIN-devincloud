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
node --test verification/tests/gameplay.test.mjs hardest/regression.mjs \
  MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/progression.test.mjs \
  MAGA-everything/02-code/armor-games/packages/shmup-core/tests/campaign.test.mjs
node MAGA-everything/02-code/armor-games/apps/burger-tycoon/tools/sim.mjs   # burger tuning policies
# Browser: open index.html from file:// (or: npx serve . ) and play.
# Scripted browser gate (optional): serve repo root on :4173, set CDP_PORT to a
#   Chromium DevTools port, then `node verification/browse.mjs`
# Evidence artifacts: verification/evidence/<run>-*
```

## Final fleet verification (2026-09-23, end of run)

| Check | Result |
|-------|--------|
| `node tools/ship-build.mjs` (all 7) | boxhead 1985KB · impossible 69KB · burger 81KB · chicken 1935KB · cluck 1938KB · sas 135KB · hardest copied |
| `node hardest/validate.mjs` | **114/114 levels pass, exit 0** |
| Portal + 7 games from file:// | **zero console errors** on every page; live pixels on every canvas |
| Impossible solver | ALL 5 LEVELS PASS + 30/30 checkpoints |
| Burger economy sim | clean Q11 FIRED · dirty SUSTAINED+3 scandals · mixed SUSTAINED |
| S&S economy sim | 83% completion · final ~33% first-try |
| Boxhead stress | 60.3 fps @ 100 movers |
| Touch (device emulation) | shmup drag pad moves ship; mouse gated from touch zones |
| Real-input drives | per record — kills/medals/DM-5-0/wave-2/XSS-regression/deforest/checkpoint-respawn all live |

## Re-verification run — 2026-09-23 (SWE-2 MAX, Devin Cloud)

Continuity-run verdict: the fleet still ships and every recorded gate
passes. Two real defects repaired; two drifted test suites modernized to
the sources they cover; one new zero-dep browser gate committed.

| Check | Result |
|-------|--------|
| `node --test` (4 suites) | **32/32** — gameplay + regression + progression + campaign. Was recorded 31/31; suites rewritten where they'd drifted from evolved sources |
| `node hardest/validate.mjs` | **114/114 levels pass** |
| `node tools/ship-build.mjs` | all 7 rebuilt; only chicken-invaders + cluck-horizon pages changed (the `unlocked` clamp below) |
| `apps/burger-tycoon/tools/sim.mjs` | CLEAN-MODERATE FIRED-BOARD Q11 · DIRTY-MAX SUSTAINED (3 scandals) · MIXED SUSTAINED — unchanged vs record |
| `verification/r2/audit-static.mjs` | STATIC AUDIT PASS (the preserved `arcade/` lineage artifact) |
| `npm run typecheck --workspaces --if-present` | clean, all workspaces |
| `verification/browse.mjs` (new CDP gate) | **PASS**: portal (7 links) + all 7 games, zero console errors; real input observed on every page |

Repairs this run:

- `packages/shmup-core/src/sim.ts` — **defect fix:** a malformed
  `chapter-unlocked` save (non-integer, negative, or larger than the pack)
  slipped past the storage loader and silently unlocked every chapter.
  The sim now clamps the loaded value to `[1, chapters.length]`.
  Shipped pages rebuilt (`tools/ship-build.mjs`).
- `packages/shmup-core/tests/campaign.test.mjs` — **full rewrite.** The
  suite targeted a 2-chapter/`pack.bosses` API the packs had grown past
  (replica is now 10 chapters, cluck 3 sectors). 11 tests: both packs
  end-to-end (every wave + every boss), nova telegraph volley, malformed
  saves, weapon-gift cap, pause freeze, extra-life grant.
  Deferral recorded in-suite: the cheap scripted pilot plateaus at
  replica chapter 9 — the win path stays sim-proven; organic
  late-campaign play remains a live-drive deferral.
- `verification/tests/gameplay.test.mjs` — burger assertions modernized:
  `s.over` is the ending string (`cash`|`board`|`sustained`), backlash is
  a four-column object read via `totalBacklash()`, startCash is 950.
  Idle now asserts the board-fired fail path (missed quarterly targets);
  dirty asserts real consequence deltas (climate/union backlash, swill
  disease) rather than a deleted `REPUTATION` ending name.

New committed gate: `verification/browse.mjs` — zero-dependency CDP
browser check reusing `verification/r2/cdp.mjs`. Console/exception/
network sweep on portal + all 7 games, then real-input smokes
(Enter/Space/keys/mouse) asserted through each app's read-only `?debug`
`window.__maga` hooks. Evidence: `verification/evidence/devincloud-20260923/`.

### Run identity (this run)

- Model: **SWE-2 MAX**; substrate: **Devin Cloud** Linux VM; node v24.21.0,
  esbuild 0.25.12 (as locked), Chromium at CDP :29229 for the browser gate.
- Git identity (per-commit env, repo rules forbid `git config`):
  `SWE-2 MAX <swe-2-max@devin.cloud>`
- Working copy pushed to the `MAKEARMORGAMESGREATAGAIN-devincloud` fork
  per operator directive (supersedes the brief's default no-push rule).

## Run identity (prior run, 2026-09-22 → 2026-09-23)

- Run dates: 2026-09-22 → 2026-09-23 (single run)
- Model: `zai/glm-5.3` (session); subagent lanes also glm-5.3 (routing
  corrected mid-run per operator directive — initial devin-routed batch
  cancelled before any edits landed)
- Substrate: Oh My Pi (`omp`) CLI on local Arch Linux; node v24.19.0,
  npm 11.17.0, esbuild 0.25.12, /usr/bin/chromium for browser verification.
- Git identity (repo-local): `maga-ship <ship@local.invalid>`
- Nothing leaves the working copy. No push, no publish.
