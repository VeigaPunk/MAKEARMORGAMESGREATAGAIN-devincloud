# Cluck Horizon · Special Delivery

An original courier-versus-the-flock arcade shooter, built on `@maga/shmup-core`. Authored SVG sprites distinguish the courier, Flockbird, Glider, Bruiser, Mother Goose and Rooster Regent. A teal orbital sky, animated exhaust, weapon notices and courier-log jokes establish its own visual identity.

Run `npm run dev:cluck` from the monorepo directory to open port 5177. `npm run build -w @maga/chicken-invaders-original` produces a static build.

Two sectors each contain three formations and a boss. Gifts progress Soup Laser → Spatula Spread → Whisk Barrage; ration pickups replenish missiles. Earn an extra life every 5,000 points. Sector unlocks and personal best persist under the `maga:chicken-invaders-original:` namespace.

Controls, campaign rules and automated verification commands are shared with [Chicken Invaders](../chicken-invaders/README.md). Both packs are independently covered by the simulation and browser tests. `proofs/release/` contains final title, gameplay and named-boss screenshots.

This remains a private project build; public title/trademark review is separate from the playable implementation. All assets are original authored work rather than extracted InterAction material.
