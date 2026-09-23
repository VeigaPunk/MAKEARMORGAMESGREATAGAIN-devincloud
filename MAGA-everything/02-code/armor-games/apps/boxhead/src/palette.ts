/**
 * BLOCKHEAD: ARENA NIGHTS palette — tokens adopted from
 * 001-boxhead-2play-visual-direction.md (chrome/shared) and
 * 001-boxhead-native-placeholder-recipes.md §2 (gameplay), plus the
 * amber UI accent the fleet identity ships with.
 */

export const PAL = {
  // shared / chrome
  void: 0x0b0b0c,
  panel: 0x161618,
  panelEdge: 0x2a2a2e,
  ink: 0xe8e4dc,
  muted: 0x9a958a,
  accent: 0xc4f04d,
  accentDim: 0x6b8a2a,
  warn: 0xe85d3a,
  ok: 0x5ddc8a,

  // gameplay
  floor: 0x2c2a26,      // set A — warehouse
  floorAlt: 0x26241f,
  wall: 0x3e3a34,
  wallEdge: 0x1a1814,
  floorLab: 0x243028,   // set B — lab
  floorLabAlt: 0x1c2620,
  wallLab: 0x355044,
  floorYard: 0x2e2a20,  // set C — yard
  floorYardAlt: 0x262218,
  wallYard: 0x4a4030,

  zombie: 0x6b8f4e,
  zombieDark: 0x4a6b38,
  zombieEye: 0xc4f04d,
  runner: 0xc43b33,     // fast red tier — bright, readable vs walker green
  devil: 0x8b2e2e,
  devilHorn: 0x5a1a1a,
  blood: 0xa61e2e,
  bloodDark: 0x6e121c,

  crate: 0x8b6914,
  crateBand: 0xc4a035,
  crateMark: 0xe8e4dc,
  barrel: 0x5a5e62,
  barrelBand: 0x3a3e42,

  muzzle: 0xfff2a8,
  bullet: 0xe8e4dc,
  bulletCore: 0xc4f04d,

  playerBody: 0xd8d2c8,
  playerHead: 0xe8e4dc,
  p1: 0x4da3ff,
  p2: 0xff7a4d,

  amber: 0xf5c542,      // HUD / banner UI accent
  amberDim: 0x8a6d1a,
} as const;

export type RoomTheme = 'warehouse' | 'lab' | 'yard';

/** per-theme floor/wall token set (recipes §4.20) */
export function themeColors(theme: RoomTheme): { floor: number; floorAlt: number; wall: number } {
  if (theme === 'lab') return { floor: PAL.floorLab, floorAlt: PAL.floorLabAlt, wall: PAL.wallLab };
  if (theme === 'yard') return { floor: PAL.floorYard, floorAlt: PAL.floorYardAlt, wall: PAL.wallYard };
  return { floor: PAL.floor, floorAlt: PAL.floorAlt, wall: PAL.wall };
}
