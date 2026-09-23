# Fleet ship record — Armor Arcade release 1.1 (run of 2026-09-22, Windows)

This is the umbrella record. Per-title records: `boxhead.md`, `impossible.md`,
`burger-tycoon.md`, `chicken-invaders.md` (includes the Cluck Horizon pack),
`swords-and-sandals.md`, `hardest.md`.

## Survey of prior work (what this run found)

- `4f5cc41` (in this repository's git history, now reverted by `4d100bb`) — a
  complete eight-game ship: six Vite/TS monorepo apps + `hardest/` + a copy of
  the operator's `tcg/prototype` card game ("Clashbound"), a Playwright
  browser gate, a tar package step, ChatGPT Sites hosting config
  (`.openai/hosting.json`), and a GitHub workflow. The revert removed all of
  it from HEAD; the game work remained recoverable in history.
- `verification/` — checkpoint audit rounds (defect register, runtime
  verdicts, evidence) predating that ship; the ship commit's `RELEASE.md`
  recorded that its defect burn repaired the flagged blockers.
- `prototypes/` — zero-dependency single-file mechanics proofs for four
  titles. Kept untouched as historical reference; NOT reachable from the
  entry point (the monorepo apps supersede them).
- `hardest/` — dependency-free game + 114-level corpus + validator.
- Operator tooling (`tcg/`, `.omp/`, `.ufo/`) — untouched, not depended on.

## Decisions this run

1. **Adopt the reverted game work** (`git checkout 4f5cc41 -- …`) — prior
   shipped work outranks re-implementation; the revert was of the
   *publishing* approach (Sites hosting, CI, tar releases), which this run
   does not reproduce. Nothing is pushed, published, or hosted.
2. **Drop Clashbound/tcg from the deliverable** — operator tooling must not
   be depended on. The hub now has seven cards: the six roster titles, with
   the shmup engine's second content pack (Cluck Horizon, original IP) as
   its own card per the checkpoint's architecture note.
3. **Commit the playable artifact** — `arcade/` is the finished, committed
   artifact (5.7 MB). `node tooling/build.mjs` regenerates it in place from
   the TS sources; players never need a build. This removes the prior ship's
   fatal gap (a gitignored `dist/` that required Node + registry access).
4. **Zero-dependency verification** — Playwright is gone. This run's browser
   verification drives the real artifact with trusted CDP input events
   (keys with proper `e.code`, held keys, mouse, touch) through the
   substrate-native `agent-browser` daemon; the driver library
   (`verification/r2/cdp.mjs`, ~250 lines, node ≥22 builtins only) is
   committed and re-runnable. Node-only test suites and validators are
   unchanged and pass.

## Release gate — exact commands and last observed results (2026-09-22)

From the repository root (Node ≥ 22 required; no network, no installs):

```
node --test verification/tests/gameplay.test.mjs hardest/regression.mjs \
  MAGA-everything/02-code/armor-games/apps/swords-and-sandals/tests/progression.test.mjs \
  MAGA-everything/02-code/armor-games/packages/shmup-core/tests/campaign.test.mjs
  → tests 31, pass 31, fail 0

node hardest/validate.mjs
  → 114/114 levels pass

node verification/r2/audit-static.mjs
  → STATIC AUDIT PASS (7 games complete, no external URLs, hub integrity)

node tooling/serve.mjs        # http://127.0.0.1:4173 (artifact server)
```

Browser-input gates (need the agent-browser daemon; see
`verification/r2/README.md` for the protocol):

```
node verification/r2/drive-impossible.mjs   → 3/3 courses cleared, 0 deaths (27.2/34.7/40.5 s), death→instant-respawn, pause, mute
node verification/r2/drive-hardest.mjs      → level 1 cleared, save records gold medal 0 deaths 4.18 s; joystick pointer control proven
node verification/r2/drive-shmup.mjs        → both packs: chapter 1 cleared + named boss down + chapter 2 unlocked; replica reached ch2 wave 3 boss
node verification/r2/drive-boxhead.mjs      → wave 1 cleared → wave 2 (score 3300), natural death, retry, pause/resume, deathmatch boots 2 players
node verification/r2/drive-burger.mjs       → dirty actions toggle, PR spend −$100, pause, mute, reload-resume
node verification/r2/drive-sas.mjs          → creation, stat allocation, shop gate, bout 1 won, campaign persisted across reload
node verification/r2/sweep-runtime.mjs      → 0 console errors on all 7 pages, hub cards + return links, mobile 390×844 layout, touch virtual stick live
```

Typecheck (dev-side; needs the workspace install):
```
npm run typecheck --workspaces --if-present   (in MAGA-everything/02-code/armor-games)
  → 0 errors across all 8 workspaces
```

## Evidence

`verification/evidence/release-r2/` — screenshots (hub, per-game title and
key states), drive logs (JSON), this run's inputs. Prior rounds' evidence is
preserved untouched in its original folders.

## Fleet-wide deferrals

- The six Vite apps require an HTTP origin (ES modules); only `hardest/`
  runs from `file://` directly. The hub README states this. A trivial local
  static server (`node tooling/serve.mjs` or `python -m http.server`) is the
  documented play path — within the objective's allowance.
- Touch input is verified at the CDP input level (trusted touch events drove
  the Boxhead virtual stick; hardest's joystick accepts any pointer) plus a
  mobile-viewport layout pass. Physical phone/iOS/Safari hardware remains
  unverified, as in the prior release.
- No in-browser full-campaign WIN screenshot for the shmup packs this run
  (chapter 1 + boss + unlock proven live; both-chapters wins are proven by
  the deterministic `campaign.test.mjs` and were browser-proven by the prior
  run's Playwright gate, recorded in `verification/RELEASE.md` history).
- Hardest browser replay cleared level 1 (gold); levels 2–3 replays are
  timing-sensitive under wall-clock pacing and are covered deterministically
  by `hardest/validate.mjs` (114/114, same engine code).

## Provenance declaration

Consulted: this working copy only — its files, its git history (`4f5cc41`,
`4d100bb`, and ancestors), `verification/`, `MAGA-everything/` docs,
`prototypes/`, `hardest/`, and the operator-provided substrate tooling
(ZCode CLI, its browser-use plugin/agent-browser daemon, Node.js installed
via winget during the run). No web or GitHub searches were performed for
this repository, its forks, or third-party remakes of the originals; no
external game renditions were consulted.

During the goal run itself, nothing left the working copy: no push, no
publish, no account creation, no uploads.

**Post-run events (all operator-authorized, recorded for audit):**

1. **Publication (2026-09-23):** the operator twice explicitly instructed
   publication after being shown the rights-posture note in `DEPLOY.md`;
   release 1.1 was published as MAGGA Edition 02 at
   https://ds4cc.com/magga/zai-5.3max-zcode-vanilla/ via the
   `ds4cc-marketplace` repo (`ec6e9cc`). The operator also instructed that
   the game-source repository itself not be pushed at that time.
2. **Cover re-authoring:** the operator flagged that the shipped covers
   (inherited from the restored prior-ship lineage) were byte-identical to
   the codex edition's despite different game builds. Per their direction —
   distinct covers "reflecting the shipped game" in the Japanese wrapping
   tradition — a **furoshiki cover set** + knot favicon were authored in
   this working copy (`verification/r2/covers.html`, `drive-covers.mjs`)
   and deployed (`86a2bba`). Deployed covers/favicon now hash-differ from
   the codex edition on every checked file; game code was already
   edition-own and unchanged.
3. **In-game furoshiki identity pass:** hub stitched-hem cards, gold-knot
   return badge, Boxhead knot-O wordmark (runtime art), gold maemusubi
   above both shmup titles, Hardest menu knot (grid geometry untouched),
   stitched hems/finials on the three DOM games. Additive visual changes
   only; re-verified after rebuild (31/31 tests, 114/114 proofs, impossible
   drive 3-course deathless, sweep zero errors, touch stick live). Deployed
   as `ca6dfd3`.
4. **Source push:** the operator instructed "push" (2026-09-23) and the
   game-source repository was pushed to
   github.com/VeigaPunk/MAKEARMORGAMESGREATAGAIN (`4d100bb..143cd4a`),
   superseding item 1's temporary no-push instruction.

---

## Addendum — Devin Cloud re-verification, 2026-09-23 (SWE-2 MAX)

This record's recorded `node --test` command now reports **tests 32,
pass 32, fail 0**: the shmup `campaign.test.mjs` was fully rewritten and
the burger assertions in `verification/tests/gameplay.test.mjs` were
modernized — both had drifted from the evolved sources (grown packs,
16-quarter Sim endings). One real defect fixed in
`packages/shmup-core/src/sim.ts` (`chapter-unlocked` save now clamped to
`[1, chapters.length]`; `games/` pages rebuilt). A new zero-dep CDP
browser gate, `verification/browse.mjs`, re-verified portal + all 7
shipped `games/` pages with real input — PASS, zero console errors.
Details and run identity: `README.md` → "Re-verification run".
