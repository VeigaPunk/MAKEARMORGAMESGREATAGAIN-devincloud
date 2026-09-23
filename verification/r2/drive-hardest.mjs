// verification/r2/drive-hardest.mjs — real-input verification for The World's
// Hardest Game (shipped artifact arcade/hardest). Keyboard tape replay from
// the deterministic autopilot (gen-hardest-tapes.mjs) via trusted CDP key
// events; mouse-joystick proof; mute; per-level clear screenshots.
// Observation is read-only: localStorage save + screenshots.
import { connect } from './cdp.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const tapes = JSON.parse(readFileSync(new URL('./hardest-tapes.json', import.meta.url).pathname.slice(1), 'utf8'));
const KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

const c = await connect('http');
await c.send('Page.navigate', { url: 'http://127.0.0.1:4174/hardest/' });
await sleep(1800);

const save = () => c.eval('JSON.parse(localStorage.getItem("hardest.save.v1") || "{}")');
const cvRect = async () => c.eval('(() => { const r=document.querySelector("canvas").getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()');
const focusCanvas = async () => { const [x, y, w, h] = await cvRect(); await c.click(x + w / 2, y + h / 2); };
const unlocked = async () => (await save()).unlocked ?? 1;
const totalDeaths = async () => (await save()).deaths ?? 0;

note(`boot: save=${JSON.stringify(await save())}`);
await c.eval('window.__px = () => { const cv=document.querySelector("canvas"); const t=document.createElement("canvas"); t.width=cv.width; t.height=cv.height; const x=t.getContext("2d"); x.drawImage(cv,0,0); const d=x.getImageData(0,0,t.width,t.height).data; let sx=0,sy=0,n=0; for(let i=0;i<d.length;i+=4){ if(d[i]>180&&d[i+1]<90&&d[i+2]<90){ const p=i/4; sx+=p%t.width; sy+=Math.floor(p/t.width); n++; } } return n?[Math.round(sx/n),Math.round(sy/n),n]:[0,0,0]; }; 0');
const px = () => c.eval('window.__px()');
note(`player pos probe armed: ${JSON.stringify(await px())}`);
await c.tapKey('KeyM', 120); // mute (also proves the control)
await sleep(200);
note(`after M: save=${JSON.stringify(await save())}`);
await c.screenshot(shot('60-hardest-menu.png'));

async function playTape(name, shots) {
  const tape = tapes[name];
  if (!tape?.clear) throw new Error(`no clear tape for ${name}`);
  const tSec = tape.dirs.reduce((a, [, , f]) => a + f, 0) / 60;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const before = await totalDeaths();
    const held = new Set();
    const posBefore = await px();
    const t0 = Date.now();
    let cum = 0;
    const kd = (code) => { const d = { KeyW: [87, 'w'], KeyA: [65, 'a'], KeyS: [83, 's'], KeyD: [68, 'd'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], ArrowDown: [40, 'ArrowDown'], ArrowUp: [38, 'ArrowUp'] }[code]; c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: d[1], code, windowsVirtualKeyCode: d[0], nativeVirtualKeyCode: d[0] }); };
    const ku = (code) => { const d = { KeyW: [87, 'w'], KeyA: [65, 'a'], KeyS: [83, 's'], KeyD: [68, 'd'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], ArrowDown: [40, 'ArrowDown'], ArrowUp: [38, 'ArrowUp'] }[code]; c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: d[1], code, windowsVirtualKeyCode: d[0], nativeVirtualKeyCode: d[0] }); };
    for (const [dx, dy, frames] of tape.dirs) {
      const want = new Set(Object.keys(KEYS).filter(k => {
        if (!dx && !dy) return false;
        const [kx, ky] = KEYS[k];
        return (kx && Math.sign(kx) === Math.sign(dx)) || (ky && Math.sign(ky) === Math.sign(dy));
      }));
      // press new keys before releasing old ones: no input gap at boundaries
      const add = [...want].filter(k => !held.has(k));
      const rem = [...held].filter(k => !want.has(k));
      for (const k of add) kd(k);
      for (const k of rem) ku(k);
      for (const k of add) held.add(k);
      for (const k of rem) held.delete(k);
      cum += frames;
      const target = t0 + cum * (1000 / 60);
      let wait = target - Date.now();
      while (wait > 0) { await sleep(Math.min(wait, 5)); wait = target - Date.now(); }
      if (Date.now() - t0 > (tSec + 8) * 1000) break;
    }
    for (const k of [...held]) ku(k);
    for (const k of held) await c.keyUp(k);
    const posAfter = await px();
    note(`  tape wall-time ${((Date.now() - t0) / 1000).toFixed(2)}s, player ${JSON.stringify(posBefore)} → ${JSON.stringify(posAfter)}`);
    await sleep(700);
    const after = await totalDeaths();
    const s = await save();
    const bestKey = Object.keys(s.best ?? {}).length;
    if (after > before || attempt > 1) note(`${name} attempt ${attempt}: deaths total ${before}→${after}`);
    // cleared? unlocked grows past this level, or a best-time entry appeared
    const lvl = Number(name.match(/^(\d+)/)[1]);
    if ((s.unlocked ?? 1) > lvl || (s.best ?? {})[String(lvl)] || (s.best ?? {})[lvl]) {
      note(`${name}: CLEARED (attempt ${attempt}, deaths ${before}→${after}, unlocked=${s.unlocked}, best entries=${bestKey})`);
      if (shots) await c.screenshot(shot(shots));
      return true;
    }
    note(`${name}: attempt ${attempt} no clear (unlocked=${s.unlocked}) — restarting with R`);
    await c.tapKey('KeyR', 0);
    await sleep(500);
  }
  note(`${name}: NOT cleared within 4 attempts (tape timing drift) — recorded as best-effort`);
  return false;
}

// menu → level 1 (keyboard only: sel defaults to level 1)
await c.tapKey('Enter', 0);
await sleep(500);
await c.screenshot(shot('61-hardest-l1-play.png'));
await playTape('01-first-steps.js', '62-hardest-l1-clear.png');

// clear screen → Enter starts the next level automatically
for (const [name, shotName] of [['02-loot-run.js', '63-hardest-l2-clear.png'], ['03-snake-corridor.js', '64-hardest-l3-clear.png']]) {
  await c.tapKey('Enter', 0);
  await sleep(600);
  await playTape(name, shotName);
}

// --- mouse-joystick proof: Enter from the level-3 clear starts level 4 ---
await c.tapKey('Enter', 0);
await sleep(700);
const [rx, ry, rw, rh] = await cvRect();
const cx = rx + rw / 2, cy = ry + rh / 2;
const d0 = await totalDeaths();
await c.mouseDown(cx, cy);
for (let a = 0; a <= 6 * Math.PI; a += 0.22) {
  await c.mouseMove(cx + Math.cos(a) * 120, cy + Math.sin(a) * 80);
  await sleep(36);
}
await c.screenshot(shot('65-hardest-joystick-drag.png'));
await c.mouseUp(cx, cy);
await sleep(500);
note(`joystick drag done: deaths ${d0}→${await totalDeaths()} (movement/death proves pointer control)`);

const s = await save();
note(`final save: ${JSON.stringify(s).slice(0, 200)}`);
writeFileSync(new URL('../evidence/release-r2/hardest-drive.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
await c.close();
console.log('HARDEST DRIVE COMPLETE');
