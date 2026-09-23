# Burger Tycoon (native replica)

**INTERNAL-NO-PUBLIC** — localhost-only build. No ship/public deploy until
written per-title rights clearance (Molleindustria CC deed + marks review).
Burger Tycoon branding only — **no McDonald's marks** in this build.

Native TypeScript + Canvas2D rebuild of the four-pane satire tycoon
(Farmland → Feedlot → Restaurant → HQ, one shared economy). All sim numbers
are DECLARED GUESSES — TBD from ARCADE playtest.

## Run

```bash
# monorepo root
npm install
npm run dev:burger          # dev server on :5175
npm run build -w @maga/burger-tycoon && npm run preview -w @maga/burger-tycoon
```

Open with `?debug` to expose `window.__maga` (sim/setPane/input/sfx) for
automated acceptance.

## Controls

| Action | Desktop | Touch |
|--------|---------|-------|
| Switch pane | keys 1–4 (Digit4 bound to `action`) | DOM tab bar |
| Action button | click | tap |
| Restart (after game over) | Space / Enter / click | tap |
| Mute | SOUND button (page chrome) | same |

## Loop (spec §Core loop)

Crops feed cattle → cattle slaughter into patties → patties sell for cash →
overhead drains cash → board pressure punishes stalled profit. Dirty toggles
(deforest / cheap feed / cut corners) trade output for backlash + disease.
Cash ≤ 0 or rep ≤ 0 → game over. **No clean win** — the satire is the point.
Sim keeps running while idle.

## Structure

- `src/sim.ts` — pure economy sim (ported 1:1 from `prototypes/burger-tycoon.html`)
- `src/main.ts` — canvas renderer, DOM chrome (HUD/tabs/log), input, letterbox, SFX
- Persistence: `maga:burger-tycoon:best-time` (longest survival, localStorage)
