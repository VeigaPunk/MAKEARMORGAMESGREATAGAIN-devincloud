/**
 * Burger Tycoon — hand-authored art (Canvas2D, no external assets).
 * Pixel sprites drawn programmatically on a 16x16 logical grid, upscaled
 * with imageSmoothingEnabled=false for crisp retro pixels. Original
 * lettering/wordmark only — no third-party marks.
 */

type Pix = [string, number, number, number, number]; // [color, x, y, w, h] in 16x16 grid units

function buildSprite(size: number, pixels: Pix[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const u = size / 16;
  for (const [col, x, y, w, h] of pixels) {
    g.fillStyle = col;
    g.fillRect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u));
  }
  return c;
}

const SPRITES: Record<string, HTMLCanvasElement[]> = {};
const SIZE = 32;
const SIZES = [16, 24, 32];

const DARK = '#3a2d1e';
const MID = '#6b543a';
const CREAM = '#f4eddf';

// FARMLAND — red barn + silo + field rows
SPRITES.farm = SIZES.map(() => buildSprite(SIZE, [
  ['#8cb86a', 0, 12, 16, 4],        // grass strip
  ['#b03a2e', 4, 6, 8, 6],          // barn body
  ['#7c241a', 7, 8, 2, 4],          // barn door
  ['#e8e0d0', 4, 5, 8, 1],          // barn roof eave
  ['#b03a2e', 5, 2, 6, 4],          // roof block
  ['#e8e0d0', 5, 2, 6, 1],          // roof top edge
  ['#b03a2e', 6, 0, 4, 2],          // roof peak
  ['#c9cdd3', 13, 3, 2, 9],         // silo
  ['#8d939b', 13, 2, 2, 1],         // silo cap
  ['#e8e0d0', 1, 13, 5, 1],         // furrow rows
  ['#e8e0d0', 7, 14, 5, 1],
  [DARK, 7, 8, 1, 1],               // door knob
]));

// FEEDLOT — cow head with horns + nose
SPRITES.feed = SIZES.map(() => buildSprite(SIZE, [
  ['#e8e0d0', 3, 3, 10, 10],        // head
  ['#b3764a', 3, 3, 4, 3],          // left patch
  ['#b3764a', 9, 7, 4, 3],          // right patch
  ['#e8e0d0', 1, 1, 3, 3],          // left horn
  ['#e8e0d0', 12, 1, 3, 3],         // right horn
  [DARK, 1, 1, 3, 1],               // horn tips
  [DARK, 12, 1, 3, 1],
  ['#f0a0a8', 5, 10, 6, 3],         // muzzle
  [DARK, 6, 11, 1, 1],              // nostrils
  [DARK, 9, 11, 1, 1],
  [DARK, 5, 5, 2, 2],               // eyes
  [DARK, 9, 5, 2, 2],
]));

// RESTAURANT — burger: bun, lettuce, patty, cheese, top bun + counter
SPRITES.rest = SIZES.map(() => buildSprite(SIZE, [
  ['#e2a44a', 3, 2, 10, 4],         // top bun
  [CREAM, 5, 3, 1, 1],              // sesame
  [CREAM, 8, 2, 1, 1],
  [CREAM, 10, 3, 1, 1],
  ['#6fae4e', 3, 6, 10, 1],         // lettuce
  ['#f0c040', 3, 7, 10, 1],         // cheese
  ['#6b3b22', 3, 8, 10, 2],         // patty
  ['#e2a44a', 3, 10, 10, 3],        // bottom bun
  [MID, 0, 13, 16, 1],              // counter top
  [DARK, 1, 14, 14, 2],             // counter front
]));

// HQ — office tower with window grid + door
SPRITES.hq = SIZES.map(() => buildSprite(SIZE, [
  ['#7f95ad', 4, 0, 8, 13],         // tower
  ['#4a6fa5', 4, 0, 8, 1],          // roof band
  ['#cfe3f4', 5, 2, 2, 2],          // windows
  ['#cfe3f4', 9, 2, 2, 2],
  ['#cfe3f4', 5, 5, 2, 2],
  ['#cfe3f4', 9, 5, 2, 2],
  ['#cfe3f4', 5, 8, 2, 2],
  ['#cfe3f4', 9, 8, 2, 2],
  ['#2b3a4a', 7, 11, 2, 2],         // door
  ['#4a4a4a', 2, 13, 12, 1],        // ground line
  ['#9a8f7d', 0, 14, 16, 2],        // pavement
]));

// SPEEDY — the costumed beaver mascot (original evocation; red cap, buck teeth)
SPRITES.beaver = SIZES.map(() => buildSprite(SIZE, [
  ['#8a5a2b', 2, 3, 3, 3],           // left ear
  ['#8a5a2b', 11, 3, 3, 3],          // right ear
  ['#a9743c', 3, 4, 10, 10],         // head
  ['#d9480b', 3, 1, 10, 3],          // promo cap
  ['#a33208', 2, 3, 12, 1],          // cap brim
  ['#222', 5, 7, 2, 2],              // eyes
  ['#222', 9, 7, 2, 2],
  ['#c9a06a', 5, 10, 6, 4],          // muzzle
  ['#3a2d1e', 7, 8, 2, 2],           // nose
  ['#fff', 7, 11, 1, 2],             // buck teeth
  ['#fff', 9, 11, 1, 2],
  ['#8a5a2b', 1, 9, 2, 1],           // whisker hints
  ['#8a5a2b', 13, 9, 2, 1],
]));

export type IconKey = 'farm' | 'feed' | 'rest' | 'hq' | 'beaver';

/** Draw a pane icon sprite at (x, y) with a 1px dark outline shadow. */
export function drawIcon(g: CanvasRenderingContext2D, key: IconKey, x: number, y: number, size = 32): void {
  const idx = size <= 16 ? 0 : size <= 24 ? 1 : 2;
  const src = SPRITES[key][idx] ?? SPRITES[key][2];
  g.save();
  g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(x + 2, y + 2, size, size);
  g.drawImage(src, x, y, size, size);
  g.restore();
}

/**
 * Original wordmark: 'BURGER TYCOON' in retro chunky capitals with a
 * burger-seed garnish dotting the 'i'-like gaps and a baseline rule.
 * Drawn once to an offscreen canvas at 2x for crispness.
 */
let wordmarkCache: HTMLCanvasElement | null = null;

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  G: ['01111', '10000', '10011', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '11110', '10100', '10010'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '01110'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
};

export function drawWordmark(g: CanvasRenderingContext2D, x: number, y: number, height = 18): void {
  if (!wordmarkCache) {
    const px = 2;                       // cell size at 2x
    const text = 'BURGER TYCOON';
    let cells = 0;
    for (const ch of text) cells += (GLYPHS[ch] ? 6 : 3);
    cells -= 3;                         // no trailing advance
    const w = cells * px;
    const h = 5 * px + 4;
    wordmarkCache = document.createElement('canvas');
    wordmarkCache.width = w;
    wordmarkCache.height = h;
    const c = wordmarkCache.getContext('2d')!;
    let cx = 0;
    for (const ch of text) {
      const glyph = GLYPHS[ch];
      if (!glyph) { cx += 3 * px; continue; }
      // per-letter alternating diner-palette fill with dark drop shadow
      const colors: Record<string, string> = {
        B: '#b03a2e', U: '#e2a44a', R: '#6fae4e', G: '#4a6fa5',
        E: '#b03a2e', T: '#e2a44a', Y: '#6fae4e', C: '#4a6fa5',
        O: '#e2a44a', N: '#b03a2e', A: '#6fae4e',
      };
      const fill = colors[ch] ?? '#b03a2e';
      glyph.forEach((row, ry) => {
        [...row].forEach((bit, rx) => {
          if (bit !== '1') return;
          c.fillStyle = 'rgba(58,45,30,0.55)';
          c.fillRect(cx + rx * px + 1, ry * px + 1, px, px);
          c.fillStyle = fill;
          c.fillRect(cx + rx * px, ry * px, px, px);
        });
      });
      cx += 6 * px;
    }
    // baseline rule
    c.fillStyle = '#3a2d1e';
    c.fillRect(0, 5 * px + 2, w, 2);
  }
  const scale = height / wordmarkCache.height;
  const w = wordmarkCache.width * scale;
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(wordmarkCache, x, y, w, height);
  g.restore();
}

/** Clear cached wordmark (test hook). */
export function _resetWordmarkCache(): void { wordmarkCache = null; }
