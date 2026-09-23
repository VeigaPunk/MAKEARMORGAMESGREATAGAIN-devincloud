# Make Armor Games Great Again — monorepo

> **INTERNAL-NO-PUBLIC.** Internal R&D under idea 001 (João, 2026-09-22).
> From-scratch native replicas for local development only. No public shipping,
> deploying, or sharing of any kind until per-title written clearance from the
> rights holders is on file. Tracked in the IDEATOR vault and the grok-bridge relay.

Native replicas of the nostalgic Flash-era menu, exactly-as-original feel, no
Flash, lightweight, playable end-to-end on localhost in mobile (touch) and
desktop (keyboard/mouse) browsers.

## Locked stack (FORGE, STACK-LOCKED 2026-09-22)

- **TypeScript + Vite** everywhere.
- **PixiJS 8** (WebGL): Boxhead, Chicken Invaders, Cluck Horizon.
- **Canvas 2D** (lightest): Impossible, Burger Tycoon, S&S2.
- **Shared `packages/arcade-core`**: unified input (touch + keyboard/mouse),
  integer scaling, localStorage saves, WebAudio synth SFX — zero binary assets.
- **Shared `packages/shmup-core`**: shmup skeleton (sim/touch/state) used by
  both chicken titles via content packs (`replica` = recreate, `cluck` =
  original); depends on `arcade-core` + PixiJS 8.
- Phaser out (too heavy for MVP). Ruffle/emulation = fallback reference only.

## Apps (FORGE build order) and packages

| # | App | Workspace | Port | Renderer |
|---|-----|-----------|------|----------|
| 1 | `apps/boxhead` | `@maga/boxhead` | 5173 | PixiJS 8 |
| 2 | `apps/impossible` | `@maga/impossible` | 5174 | Canvas 2D |
| 3 | `apps/burger-tycoon` | `@maga/burger-tycoon` | 5175 | Canvas 2D |
| 4 | `apps/chicken-invaders` | `@maga/chicken-invaders` | 5176 | PixiJS 8 (`shmup-core` replica pack) |
| 5 | `apps/swords-and-sandals` | `@maga/swords-and-sandals` | 5178 | Canvas 2D |
| 6 | `apps/chicken-invaders-original` | `@maga/chicken-invaders-original` | 5177 | PixiJS 8 (`shmup-core` cluck pack, "Cluck Horizon") |

Per-app details live in each app's `README.md`. Shared code in
`packages/arcade-core` (input/scaling/storage/audio) and
`packages/shmup-core` (shmup skeleton). `boxhead-2play-spike/` is the Ruffle
M1 spike, kept separate from the native build.

## Run

```bash
npm install             # from repo root
npm run dev:boxhead     # http://localhost:5173 — playable on phone via LAN IP
npm run dev:impossible  # http://localhost:5174
npm run dev:burger      # http://localhost:5175
npm run dev:chicken     # http://localhost:5176
npm run dev:cluck       # http://localhost:5177
npm run dev:sands       # http://localhost:5178
```

Equivalent per-workspace form: `npm run dev -w @maga/<name>`.

## Crew

IDEATOR (vault) · FORGE (planning/review) · ARCADE (fidelity) · PIXEL (art) ·
MAESTRO (audio) · PROOF (QA) · KIMI/Kimi Work (conductor + implementation).

**Standing crew rule: English only, never Portuguese — everywhere.**
