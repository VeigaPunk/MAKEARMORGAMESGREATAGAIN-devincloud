# Chicken Invaders — MAGA native replica (slot #4)

CI2-era formula recreate on the shared shmup skeleton (`@maga/shmup-core`,
`replica` content pack). PixiJS 8 via pinned external ESM importmap
(`public/vendor/pixi.min.mjs`) — the fleet-locked pattern; do not re-bundle.

**INTERNAL-NO-PUBLIC** — no ship until written clearance (InterAction
studios / Prouskas). No InterAction assets, names beyond the working-title
label, or OST; all art is placeholder vector, all audio is synth.

## Run

```
npm run dev:chicken   # from repo root → http://localhost:5176
```

## Controls

- Move: Arrows / WASD (inertial — float feel)
- Fire: Space / Z / LMB (held)
- Missile: X / Shift / RMB
- Pause: Esc / P · End screens: R / Enter / tap
- Touch (coarse pointers): left 55% = relative drag-pad (drag also
  auto-fires — one-thumb layout B); FIRE + MISSILE buttons bottom-right
  (twin-thumb layout A). Zones active only during gameplay.

## Loop (v1 slice)

Title → chapter select (1–2, CH2 locked until CH1 boss down) → 2 waves of
formation chickens (straight/swoop/dive + aimed eggs) → boss (volley +
telegraphed radial) → chapter clear → unlock persist
(`maga:chicken-invaders:chapter-unlocked`) → win after CH2.

Gifts cycle 3 weapons; drumsticks refill missiles (cap 6). 3 lives,
respawn ≤2s (spec hook 6), invuln blink 2s.

## Declared guesses (ALL TBD from ARCADE playtest)

Every combat numeric in `packages/shmup-core/src/sim.ts` — ship accel/damp,
fire rate, bullet/missile/egg velocities, damage, lives, formation geometry
(FORM_CW/CH/OY — proto P-1 fix), wave tables, boss HP/patterns, drop rates,
music bed notes.

## Proto divergences (recorded)

- **P-1** proto `spawnWave()` used undeclared `ox/cw/oy/ch2` → crash on
  start; declared here as tunables.
- **P-2** proto boss radial telegraph re-fired every frame in a ~3-frame
  window (~36 eggs); fires once on telegraph expiry here.
- Pack-swap title button dropped — each app ships exactly one pack
  (replica here, cluck in `chicken-invaders-original`).

## Debug

`?debug` exposes `window.__maga` = `{ sim, input, touch, state }` —
`state` mirrors the proto's `__proto` snapshot shape.
