// verification/r2/drive-burger.mjs — real-input verification for Burger Tycoon
// (shipped artifact arcade/burger-tycoon). DOM buttons only: start dialog,
// per-pane actions (clean + dirty), keyboard pane switching, pause/resume,
// mute, and save/resume across a real page reload.
import { connect } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const c = await connect('http');
await c.send('Page.navigate', { url: 'http://127.0.0.1:4174/burger-tycoon/?debug' });
await sleep(1800);

const sim = () => c.eval(`(() => { const m = window.__maga; if (!m) return null; const s = m.sim.s;
  return { over: s.over, reason: s.overReason ?? null, cash: Math.round(s.cash), cattle: s.cattle, crops: s.crops,
    demand: s.demand, backlash: Math.round(s.backlash), dirty: { ...s.dirty }, day: Math.round(s.t / 60) }; })()`);

// overlay dialog start button (first real click of the run)
const start = await c.eval(`(() => { const b=[...document.querySelectorAll('#overlay button')][0]; if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, b.textContent]; })()`);
if (!start) throw new Error('no start button on overlay');
await c.screenshot(shot('30-burger-title.png'));
await c.click(start[0], start[1]);
await sleep(600);
note(`started via "${start[2]}" → ${JSON.stringify(await sim())}`);

// helper: click the k-th action button of pane i (operations render as .operation cards)
const paneBtn = async (i, labelMatch) => c.eval(`(() => {
  const cards=[...document.querySelectorAll('.operation')];
  const card=cards[${i}]; if(!card)return null;
  const b=[...card.querySelectorAll('.operation-actions button')].find(b=>b.textContent.toLowerCase().includes('${labelMatch}'));
  if(!b||b.disabled)return null;
  b.scrollIntoView({ block: 'center' });
  const r=b.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2,b.textContent.trim().slice(0,40)];
})()`);

await c.screenshot(shot('31-burger-dashboard.png'));
// farm → feedlot → restaurant → hq actions, clicked by label fragment
for (const [pane, label] of [[0, 'sow'], [0, 'harvest'], [1, 'buy'], [1, 'feed'], [2, 'market'], [3, 'lobby']]) {
  const b = await paneBtn(pane, label);
  if (b) { await c.click(b[0], b[1]); await sleep(350); note(`pane${pane + 1} "${b[2]}" → ${JSON.stringify(await sim())}`); }
  else note(`pane${pane + 1} "${label}": unavailable/disabled (affordability rules)`);
}
await c.screenshot(shot('32-burger-actions.png'));

// keyboard pane switching (1..4)
for (const k of ['Digit2', 'Digit3', 'Digit4', 'Digit1']) { await c.tapKey(k, 250); }
note(`pane keys 2/3/4/1 tapped`);

// dirty actions: engage hormones (feedlot) + bulldoze (farm)? click engaged toggles
const dirtyBtn = await paneBtn(1, 'cheap feed');
if (dirtyBtn) { await c.click(dirtyBtn[0], dirtyBtn[1]); await sleep(300); note(`dirty feedlot "${dirtyBtn[2]}" → ${JSON.stringify(await sim())}`); }
const prBtn = await paneBtn(3, 'pr');
if (prBtn) { await c.click(prBtn[0], prBtn[1]); await sleep(300); note(`hq pr "${prBtn[2]}" engaged`); }

// pause + resume via header button
const pauseBtn = await c.eval(`(() => { const b=document.getElementById('pause'); const r=b.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]; })()`);
await c.click(pauseBtn[0], pauseBtn[1]); await sleep(300);
await c.screenshot(shot('33-burger-paused.png'));
await c.click(pauseBtn[0], pauseBtn[1]); await sleep(300);
note(`pause/resume via header button → ${JSON.stringify(await sim())}`);

// mute via header button
const muteBtn = await c.eval(`(() => { const b=document.getElementById('mute'); const r=b.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2,b.textContent]; })()`);
await c.click(muteBtn[0], muteBtn[1]); note(`mute toggled ("${muteBtn[2]}")`);

// save/resume across reload
const before = await sim();
await c.send('Page.reload');
await sleep(1600);
const resumed = await c.eval(`(() => { const m=window.__maga; return m ? { paused: m.paused, sim: { cash: Math.round(m.sim.s.cash), over: m.sim.s.over } } : null; })()`);
note(`after reload: ${JSON.stringify(resumed)} (was cash=${before?.cash}) — run must resume, not restart`);

writeFileSync(new URL('../evidence/release-r2/burger-drive.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
await c.close();
console.log('BURGER DRIVE COMPLETE');
