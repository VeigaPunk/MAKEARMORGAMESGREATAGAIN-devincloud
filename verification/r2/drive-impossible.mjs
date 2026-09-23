// verification/r2/drive-impossible.mjs — real-input verification for The Impossible Game.
// Drives the SHIPPED artifact (arcade/impossible) with trusted CDP key events:
// mutes audio via the real DOM button, starts each course with Enter, and
// clears all three courses by tapping Space at recorded jump positions.
// Read-only ?debug hook (__maga) is used to observe progress — never to mutate.
import { connect } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };

const c = await connect('http');
await c.send('Page.navigate', { url: 'http://127.0.0.1:4174/impossible/?debug' });
await new Promise(r => setTimeout(r, 1800));

const state = () => c.eval('(window.__maga ? [window.__maga.screen, window.__maga.state, Math.round(window.__maga.x), window.__maga.runner.deaths, window.__maga.runner.attempt] : null)');

// mute via the real button if present (it is a DOM button in the header)
const muteRect = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/mute|sound/i.test(b.textContent)); if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, b.textContent]; })()`);
if (muteRect) { await c.click(muteRect[0], muteRect[1]); note(`muted via button "${muteRect[2]}"`); }
await c.screenshot(shot('10-impossible-title.png'));
note(`title screen: ${JSON.stringify(await state())}`);

const TAPES = [
  [1330,1790,2300,2880,3290,3840,4280,4920,5490,6240,6750,7000,7250,7750,8400,8990,9300],
  [940,1340,1880,2950,3190,3380,4050,5090,5820,6440,7350,7590,7780,8450,9480,9890,11250,11490,11680],
  [1050,1290,1480,2250,3180,3590,4250,5350,5590,5780,6350,6590,6780,7950,8590,9320,10650,10890,11080,11850,12780,13250,13490,13680],
];

async function runCourse(idx) {
  // from title: blur any focused button, then Enter starts the selected course
  const s0 = await state();
  if (s0[0] !== 'title') throw new Error(`expected title screen, got ${JSON.stringify(s0)}`);
  await c.eval('document.body.focus?.() ?? 0; (document.activeElement)?.blur?.(); 0');
  await new Promise(r => setTimeout(r, 80));
  await c.tapKey('Enter', 0);
  await new Promise(r => setTimeout(r, 300));
  let s = await state();
  if (s[0] !== 'play') throw new Error(`course ${idx + 1} did not start: ${JSON.stringify(s)}`);
  const tape = TAPES[idx];
  let next = 0;
  const t0 = Date.now();
  while (true) {
    s = await state();
    if (s[1] === 'dead') throw new Error(`course ${idx + 1} died at x=${s[2]} (jump #${next})`);
    if (s[0] === 'clear') break;
    if (s[1] === 'running' && next < tape.length && s[2] >= tape[next]) {
      await c.keyDown('Space'); await new Promise(r => setTimeout(r, 30)); await c.keyUp('Space');
      next++;
    }
    if (Date.now() - t0 > 180000) throw new Error(`course ${idx + 1} timeout`);
    await new Promise(r => setTimeout(r, 8));
  }
  note(`course ${idx + 1} CLEARED: deaths=${s[3]} attempts=${s[4]} jumps=${next} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await c.screenshot(shot(`1${idx + 1}-impossible-clear-course${idx + 1}.png`));
}

await runCourse(0);
// death + instant-respawn proof on course 2: start, refuse to jump, die, watch attempt 2 begin
await c.eval('0'); // settle
const titleBtn = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/title/i.test(b.textContent)); if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
if (titleBtn) { await c.click(titleBtn[0], titleBtn[1]); await new Promise(r => setTimeout(r, 400)); }
await c.eval('document.body.focus?.() ?? 0; (document.activeElement)?.blur?.(); 0');
await c.tapKey('Enter', 0);
await new Promise(r => setTimeout(r, 300));
note(`course 2 started for death test: ${JSON.stringify(await state())}`);
let d = await state();
const tDie = Date.now();
while (d[1] !== 'dead' && Date.now() - tDie < 20000) { await new Promise(r => setTimeout(r, 20)); d = await state(); }
note(`died without jumping: ${JSON.stringify(d)}`);
await new Promise(r => setTimeout(r, 1200)); // instant respawn window
d = await state();
note(`after respawn window: ${JSON.stringify(d)} (attempt must be 2, running)`);

// courses 2 + 3 full clears via the real pause/quit flow
for (const idx of [1, 2]) {
  // abort the ongoing run: click the DOM pause button, then Resume→Title via overlay buttons
  const pb = await c.eval(`(() => { const b=document.getElementById('pause'); if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
  if (pb) { await c.click(pb[0], pb[1]); await new Promise(r => setTimeout(r, 400)); }
  note(`paused: ${JSON.stringify(await state())}`);
  const tb = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/title/i.test(b.textContent)); if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
  if (!tb) throw new Error('no Title button on pause screen');
  await c.click(tb[0], tb[1]);
  await new Promise(r => setTimeout(r, 400));
  const sel = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].filter(b=>/^${idx + 1}\\./.test(b.textContent.trim()))[0]; if(!b||b.disabled)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
  if (!sel) throw new Error(`course ${idx + 1} button not selectable (still locked?)`);
  await c.click(sel[0], sel[1]);
  await new Promise(r => setTimeout(r, 250));
  await runCourse(idx);
}

const errs = await c.eval(`window.__errs ? window.__errs.length : 'n/a'`);
note(`console errors during session: ${errs}`);
writeFileSync(new URL('../evidence/release-r2/impossible-drive.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
await c.close();
console.log('IMPOSSIBLE DRIVE COMPLETE');
