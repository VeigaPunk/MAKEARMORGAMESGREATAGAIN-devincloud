# Release record — Armor Arcade

## Release 1.1 — 2026-09-22 (Windows run; current)

Continues the same eight-game game work originally shipped as `4f5cc41`
(then reverted with `4d100bb` together with its hosting/packaging approach)
and re-ships it as a **committed, zero-build artifact**:

- `arcade/` is the finished distribution, committed to the repository
  (7 playable pages: six roster titles + the Cluck Horizon pack on the
  shared shooter engine). The operator tooling (`tcg/`) is no longer part of
  the deliverable, so the collection is seven games, not eight.
- No hosting configuration, no CI, no package tarballs, no publishing. A
  trivial local static server (or `node tooling/serve.mjs`) is the play
  path; `hardest/` additionally runs from `file://`.
- Rebuilt and re-verified on Windows with substrate-native tooling:
  trusted CDP input events (keys with `e.code`, held keys, mouse, touch)
  driving the real artifact — see `r2/README.md` for the protocol and
  `evidence/release-r2/` for screenshots and drive logs.

Last observed gate results (this run): 31/31 node tests, 114/114 hardest
level proofs, STATIC AUDIT PASS, zero console errors on all seven pages,
zero non-local network requests, and per-game live input passes recorded in
`../ship-records/`.

## Release 1.0 — 2026-09-22 (historical, commit 4f5cc41, reverted by 4d100bb)

The first complete ship: six Vite/TS apps + hardest + a Clashbound copy
built into a gitignored `dist/`, verified on Linux with a Playwright gate
(35 simulation tests, 114 level proofs, 44 Chromium/Firefox production
checks, deeper per-game suites) and published to a private ChatGPT Site at
the user's request of that session. Its verification claims remain
historical evidence of the game work; the packaging/publishing approach was
reverted and is not part of release 1.1. The repaired-checkpoint-blockers
list from that round (hardest save/medal crashes, S&S injection and
progression, Boxhead menu bleed and fire bindings, shooter chapter hazards,
Impossible sub-frame taps, Burger recovery, Clashbound targeting) is
incorporated in the game code this release re-ships.
