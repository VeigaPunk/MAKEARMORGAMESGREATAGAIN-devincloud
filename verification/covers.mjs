#!/usr/bin/env node
/**
 * verification/covers.mjs — capture edition cover art from the shipped pages.
 *
 * Plays each game with REAL CDP input (same smokes as verification/browse.mjs),
 * then clips Page.captureScreenshot to the game's own render rect (canvas, or
 * #wrap for the DOM games). Raw clips land in verification/evidence/<out>/
 * along with the 1024x640 cover-crops, which are written to --outdir.
 *
 * "Covers are actual game footage captured from the shipped pages."
 *
 * Usage: node verification/covers.mjs --outdir /path/to/edition/covers
 * Needs: static server at BASE_URL (default :4173), Chromium at CDP_PORT
 * (default 29229), PIL/Pillow for the cover crop.
 */
import { connect } from './r2/cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const PORT = process.env.CDP_PORT || '29229';
const outIdx = process.argv.indexOf('--outdir');
const OUTDIR = outIdx > 0 ? process.argv[outIdx + 1] : join(here, 'evidence', 'covers');
mkdirSync(OUTDIR, { recursive: true });
const evidence = join(here, 'evidence', `covers-${Date.now()}`);
mkdirSync(evidence, { recursive: true });
try { mkdirSync(join(homedir(), '.agent-browser'), { recursive: true });
  writeFileSync(join(homedir(), '.agent-browser', 'default.port'), PORT); } catch {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const c = await connect('about:blank');
const { send } = c;
await fetch(`http://127.0.0.1:${PORT}/json/activate/${c.page.id}`).catch(() => {});
await sleep(300);
send('Page.enable');

async function goto(url) {
  await send('Page.navigate', { url });
  await sleep(2600);
}
const rect = () => c.eval(
  `(() => { const el = document.querySelector('canvas') || document.querySelector('#wrap');
     if (!el) return { x: 0, y: 0, w: innerWidth, h: innerHeight };
     const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);

// filename → [game dir, input sequence to reach photogenic state]
const SHOTS = [
  ['boxhead', async () => { await c.tapKey('Enter'); await sleep(500); await c.tapKey('Digit1'); await sleep(600); await c.tapKey('Digit1'); await sleep(4500); }],
  ['impossible', async () => { await c.tapKey('Space'); await sleep(500); await c.tapKey('Space'); await sleep(1200); }],
  ['burger-tycoon', async () => { await sleep(1500); }],
  ['chicken-invaders', async () => { await c.tapKey('Enter'); await sleep(700); await c.keyDown('ArrowLeft'); await c.keyDown('Space'); await sleep(800); await c.keyUp('ArrowLeft'); await c.keyUp('Space'); }],
  ['chicken-invaders-original', async () => { await c.tapKey('Enter'); await sleep(700); await c.keyDown('ArrowRight'); await c.keyDown('Space'); await sleep(800); await c.keyUp('ArrowRight'); await c.keyUp('Space'); }],
  ['swords-and-sandals', async () => { await c.tapKey('Enter'); await sleep(500); const b = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/NEW GLADIATOR/.test(b.textContent)); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`); if (b) { await c.click(b.x, b.y); await sleep(800); } }],
  ['hardest', async () => { await c.tapKey('Enter'); await sleep(400); await c.keyDown('ArrowRight'); await sleep(700); await c.keyUp('ArrowRight'); }],
];
const GAME_OF = { 'chicken-invaders-original': 'cluck-horizon' };

for (const [name, play] of SHOTS) {
  const dir = GAME_OF[name] || name;
  await goto(`${BASE}/games/${dir}/index.html?debug=1`);
  try { await play(); } catch (e) { console.log(`  input warn ${name}: ${e.message}`); }
  await sleep(400);
  const r = await rect();
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 },
  });
  const raw = join(evidence, `${name}-raw.png`);
  writeFileSync(raw, Buffer.from(shot.result.data, 'base64'));
  // cover-crop to 1024x640
  const dst = join(OUTDIR, `${name}.png`);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
tw, th = 1024, 640
s = max(tw / im.width, th / im.height)
im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
x = (im.width - tw) // 2; y = (im.height - th) // 2
im.crop((x, y, x + tw, y + th)).save(sys.argv[2])
`, raw, dst]);
  console.log(`  ${name}.png  (${Math.round(r.w)}x${Math.round(r.h)} @ ${Math.round(r.x)},${Math.round(r.y)})`);
}

console.log(`covers → ${OUTDIR}  (raw: ${evidence})`);
await c.close();
