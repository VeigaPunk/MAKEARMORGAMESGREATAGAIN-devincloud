ARMOR ARCADE — PRIVATE COLLECTION 1.1

Seven self-contained browser games on one shared hub. No account, API key,
CDN, or build step is needed to play: this folder IS the finished artifact.

Start a trivial local static server from the repository root, for example:

  node tooling/serve.mjs            (or: python -m http.server 4173)

Then open http://127.0.0.1:4173 in a modern browser. The World's Hardest
Game also runs when index.html is opened directly via file://; the six
module apps need HTTP. Progress is stored in the browser; use the same
hostname and port each time to keep saves.

Contents: boxhead, impossible, burger-tycoon, chicken-invaders (remake
campaign), chicken-invaders-original (Cluck Horizon, an original-IP second
campaign on the same shooter engine), swords-and-sandals, hardest.

This is a private remake collection. The repository's per-title
rights-clearance requirement applies before public redistribution. Original
commercial assets and exact frame-for-frame historical parity are not
claimed.

To rebuild from TypeScript sources (requires Node 22+ and one npm install):
  node tooling/build.mjs
The build refreshes the game folders in this arcade/ directory in place.
