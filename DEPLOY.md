# Publishing Armor Arcade — operator runbook

> **EXECUTED 2026-09-23** at the operator's explicit instruction (issued
> twice in-session after reading the rights note below): release 1.1 is
> live at **https://ds4cc.com/magga/zai-5.3max-zcode-vanilla/** as
> MAGGA Edition 02, published via `ds4cc-marketplace` commit `ec6e9cc`
> (marketplace repo push only; the game-source repository was not pushed; follow-up `86a2bba` deployed the authored furoshiki cover set + knot favicon after the operator flagged inherited covers identical to the codex edition).
> Verified live: collection card, edition hub, game pages and release.json
> all 200; the deployed Impossible game boots to its title screen in a real
> browser (`verification/evidence/release-r2/80-deployed-collection.png`).

This run deliberately did **not** publish anything: the standing goal
contract states *"Nothing leaves the working copy: no pushing, publishing,
uploading, posting, or account creation, anywhere. Publication is the
operator's job after the run, not yours,"* and the repository's own rights
posture (see `arcade/README.txt` and `verification/RELEASE.md` history)
requires a **per-title rights-clearance decision before public
redistribution**. Both steps below are yours.

## What to publish

`arcade/` is the complete, self-contained docroot (≈5.7 MB, all URLs
relative — it works under any subdirectory, including `/magga/`). Serve it
from any static host. No build, no server runtime.

`ds4cc.com` resolves to GitHub Pages (185.199.108–110.153), so the natural
path is the GitHub Pages site that owns that domain:

```bash
# from this repository root, into a clone of the Pages repo that serves ds4cc.com
gh repo clone VeigaPunk/<pages-repo> /tmp/pages   # e.g. VeigaPunk.github.io
rm -rf /tmp/pages/magga
cp -r arcade /tmp/pages/magga
cd /tmp/pages && git add magga && git commit -m "Publish Armor Arcade 1.1 to /magga" && git push
# the site serves https://ds4cc.com/magga/ within a minute or two
```

(Any equivalent — rsync to a VPS, an object store, Netlify drop — works the
same; copy the contents of `arcade/` to the `/magga/` directory of the
docroot.)

## Before you publish — the rights checklist

The games are authored remakes: original code, art, audio, and text; no
original commercial assets. But the hub cards currently carry the original
commercial **titles** ("Boxhead", "The Impossible Game", "Chicken Invaders",
"Swords & Sandals", "The World's Hardest Game") — the checkpoint itself set
the rename precedent with "Burger Tycoon" for the McDonald's game. Public
hosting is the point where that posture matters. Before a public deploy,
either (a) accept the exposure as the rights holder's call, or (b) rebrand
the five player-facing titles to original evocations (a contained change:
`arcade/arcade.js` card titles + per-game `<title>`/headers). This decision
belongs to the operator, which is why this run did not make it and did not
publish.

## What was verified before this hand-off

See `ship-records/_fleet.md` (gate results and evidence) and the per-title
records. Last observed on the final committed state (`e3b49b9`):
31/31 node tests, 114/114 hardest level proofs, static audit pass, zero
console errors and zero non-local requests across all seven game pages,
real-input browser passes for every game with screenshots and logs in
`verification/evidence/release-r2/`.
