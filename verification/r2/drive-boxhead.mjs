// verification/r2/drive-boxhead.mjs — real-input verification for Boxhead
// (shipped artifact arcade/boxhead). Menu keys, held-WASD kiting, mouse aim,
// held-Space fire, natural death, retry, pause, and a deathmatch boot check.
import { connect } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const c = await connect('http');
await c.send('Page.navigate', { url: 'http://127.0.0.1:4174/boxhead/?debug' });
await sleep(1800);

const obs = () => c.eval(`(() => { const g = window.__maga?.game; if (!g) return null; const s0 = g.slots?.[0];
  return { state: g.state, mode: g.mode, wave: g.wave, zombies: g.zombies.length,
    p: s0 ? { x: Math.round(s0.p.pos.x), y: Math.round(s0.p.pos.y), hp: s0.p.hp, ammo: s0.p.ammo } : null,
    slots: g.slots?.length ?? 0, score: g.scoreSys ? null : null, hud: (typeof g.hudText?.text === 'string' ? g.hudText.text.split('\\n')[0] : null) }; })()`);

// mute via the real DOM button (also proves the control)
const mute = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/sound/i.test(b.textContent)); if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
if (mute) { await c.click(mute[0], mute[1]); note('muted via DOM button'); }
await c.screenshot(shot('20-boxhead-title.png'));

// menu: SPACE → mode select, 1 = solo, 1 = room 1
await c.tapKey('Space', 400);
await c.tapKey('Digit1', 350);
await c.tapKey('Digit1', 500);
let o = await obs();
if (o?.state !== 'playing') throw new Error('boxhead did not start: ' + JSON.stringify(o));
note(`solo run started: ${JSON.stringify(o)}`);

// canvas rect for mouse aim coordinates
const rect = await c.eval('(() => { const r=document.querySelector("canvas").getBoundingClientRect(); return [r.x, r.y, r.width, r.height, document.querySelector("canvas").width, document.querySelector("canvas").height]; })()');
const toCss = (x, y) => [rect[0] + (x / rect[4]) * rect[2], rect[1] + (y / rect[5]) * rect[3]];

await c.keyDown('Space'); // hold fire
const t0 = Date.now();
let lastWave = 0, shots = 0;
while (Date.now() - t0 < 420000) {
  o = await obs();
  if (!o || o.state !== 'playing') break;
  const p = o.p;
  // kite: move away from the zombie centroid; aim+fire at the nearest zombie
  let nx = 0, ny = 0, near = null, nd = 1e9, cx = 0, cy = 0;
  const zoms = await c.eval(`window.__maga.game.zombies.slice(0,40).map(z=>[Math.round(z.pos.x),Math.round(z.pos.y)])`);
  for (const [zx, zy] of zoms) {
    const dx = zx - p.x, dy = zy - p.y, d = Math.hypot(dx, dy);
    cx += zx / zoms.length; cy += zy / zoms.length;
    if (d < nd) { nd = d; near = [zx, zy]; }
  }
  // ammo supply: run to the nearest crate when running dry
  let goalX = null, goalY = null;
  if (p.ammo < 12) {
    const crates = await c.eval('window.__maga.game.crates.map(cr=>[Math.round(cr.pos.x),Math.round(cr.pos.y)])');
    let bc = null, bd = 1e9;
    for (const [x2, y2] of crates) { const d = Math.hypot(x2 - p.x, y2 - p.y); if (d < bd) { bd = d; bc = [x2, y2]; } }
    if (bc) { goalX = bc[0]; goalY = bc[1]; }
  }
  if (near) {
    // aim at the nearest zombie (mouse position → facing)
    const [ax, ay] = toCss(near[0], near[1]);
    await c.mouseMove(ax, ay);
    // move toward crate when dry, else away from the zombie centroid
    const fx = goalX !== null ? goalX - p.x : p.x - cx;
    const fy = goalY !== null ? goalY - p.y : p.y - cy;
    const m = Math.hypot(fx, fy) || 1;
    let mx = fx / m, my = fy / m;
    if (p.x < 60) mx = 1; if (p.x > 580) mx = -1;
    if (p.y < 60) my = 1; if (p.y > 340) my = -1;
    const keys = [];
    if (mx > 0.4) keys.push('KeyD'); if (mx < -0.4) keys.push('KeyA');
    if (my > 0.4) keys.push('KeyS'); if (my < -0.4) keys.push('KeyW');
    const d1 = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'KeyD' : 'KeyA') : (my > 0 ? 'KeyS' : 'KeyW');
    await c.keyDown(d1);
    await sleep(140);
    await c.keyUp(d1);
  } else await sleep(120);
  shots++;
  if (o.wave > lastWave) {
    lastWave = o.wave;
    note(`wave ${o.wave}: zombies=${o.zombies} hp=${o.p?.hp} ammo=${o.p?.ammo}`);
    if (o.wave === 1) await c.screenshot(shot('21-boxhead-wave1.png'));
    if (o.wave >= 3) { await c.screenshot(shot('22-boxhead-wave3.png')); break; }
  }
  if (p && p.hp <= 0) break;
}
await c.keyUp('Space');
o = await obs();
note(`solo ended: ${JSON.stringify(o)}`);
await sleep(1200);
o = await obs();
note(`after settle: ${JSON.stringify(o)}`);
if (o?.state === 'dead') { await c.screenshot(shot('23-boxhead-dead.png')); await c.tapKey('Space', 300); await sleep(1000); note(`after retry: ${JSON.stringify(await obs())}`); }

// pause/resume proof
await c.tapKey('KeyP', 200);
await sleep(400);
const paused = await obs();
await c.screenshot(shot('24-boxhead-paused.png'));
await c.tapKey('KeyP', 200);
await sleep(300);
note(`pause → ${JSON.stringify(paused)} → resume ${JSON.stringify(await obs())}`);

// deathmatch boot: M to menu (from dead/pause) or restart flow
o = await obs();
if (o?.state === 'playing') { await c.tapKey('KeyP', 200); await sleep(200); }
// from pause, M quits to menu? use the menu chip: press M (game listens 'M' as action?) — use P then M path via Escape menu
// simplest documented path: die out or use the DOM-less canvas menu: restart run via reload
await c.send('Page.reload');
await sleep(1600);
await c.tapKey('Space', 400);
await c.tapKey('Digit3', 350); // deathmatch
await c.tapKey('Digit1', 400); // room 1
o = await obs();
note(`deathmatch: ${JSON.stringify(o)}`);
if (o?.state === 'playing' && o.slots === 2) {
  await c.screenshot(shot('25-boxhead-deathmatch.png'));
  // both players act: P1 fire + P2 directional fire (numpad cluster maps fireUp I / etc.)
  await c.keyDown('Space'); await sleep(500); await c.keyUp('Space');
  await c.tapKey('KeyI', 200); // P2 fire up
  await sleep(400);
  note(`dm after fire: ${JSON.stringify(await obs())}`);
}
writeFileSync(new URL('../evidence/release-r2/boxhead-drive.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
await c.close();
console.log('BOXHEAD DRIVE COMPLETE');
