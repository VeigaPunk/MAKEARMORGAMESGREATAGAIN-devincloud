// verification/r2/drive-shmup.mjs — real-input verification for both shmup
// packs (Chicken Invaders remake campaign + Cluck Horizon) on the shipped
// artifact. Held arrow keys move, held Z fires, X launches missiles — all
// trusted CDP key events. Read-only ?debug hook (__maga.state) observes.
import { connect } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const c = await connect('http');

async function runPack(slug, prefix, chapter2Only = false) {
  if (!chapter2Only) await c.send('Page.navigate', { url: `http://127.0.0.1:4174/${slug}/?debug` });
  const st = () => c.eval('window.__maga ? window.__maga.state : null');

  // mute via the real DOM button (also proves the control)
  const mute = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/sound/i.test(b.textContent)); if(!b)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
  if (mute) { await c.click(mute[0], mute[1]); note(`${slug}: muted via DOM button`); }
  if (!chapter2Only) await c.screenshot(shot(`${prefix}-title.png`));

  // title: select chapter (2 when retrying and unlocked), start with Z
  let ts = await st();
  for (let i = 0; i < 4 && (ts?.mode === 'gameover' || ts?.mode === 'win'); i++) {
    await c.tapKey('KeyZ', 250); await sleep(600); ts = await st();
  }
  if (ts?.mode === 'title') {
    await c.tapKey(chapter2Only ? 'Digit2' : 'Digit1', 200);
    let sel = await st();
    if (chapter2Only && sel?.titleSel !== 2) { await c.tapKey('Digit1', 200); } // chapter 2 still locked: fall back to 1
    await c.tapKey('KeyZ', 300);
  }
  await sleep(600);
  let s = await st();
  if (s?.mode !== 'play') throw new Error(`${slug}: did not start (${JSON.stringify(s)?.slice(0, 120)})`);
  note(`${slug}: game started, chapter ${s.chapter}`);

  // fight: hold Z to fire, steer with arrows toward safe lanes; missiles on boss
  const t0 = Date.now();
  let lastWave = 0, bossSeen = false, bossName = null;
  await c.keyDown('KeyZ'); // hold fire the whole fight
  let strafe = 0, lastMissile = 0;
  while (Date.now() - t0 < 420000) {
    s = await st();
    if (!s) break;
    if (s.mode === 'win' || s.mode === 'gameover') break;
    if (s.paused) { await c.tapKey('Escape', 100); await sleep(300); }
    // aim: park under the boss, else under the nearest chicken; strafe ±50 to slip eggs
    let targetX = 320;
    if (s.bossName) targetX = s.bossX ?? 320;
    else if (s.chickens?.length) {
      let best = null, bd = 1e9;
      for (const ch of s.chickens) { const d = Math.abs(ch.x - s.shipX) + (400 - ch.y) * 0.3; if (d < bd) { bd = d; best = ch; } }
      targetX = best.x;
    }
    // evade diving chickens overhead
    const diver = (s.chickens ?? []).find(ch => ch.dive && Math.abs(ch.x - s.shipX) < 60);
    if (diver) targetX = s.shipX < 320 ? s.shipX + 170 : s.shipX - 170;
    // corner-camp under pressure: low lives or dense eggs → hug a bottom corner, slip sideways
    const pressure = (s.lives <= 1 || s.eggs > 6);
    if (pressure) { targetX = s.shipX < 320 ? 70 : 570; }
    strafe = strafe === 40 ? -40 : 40;
    const amp = s.bossName && !pressure ? 35 : strafe;
    const want = Math.max(30, Math.min(610, targetX + amp));
    const dx = want - s.shipX;
    const key = Math.abs(dx) < 12 ? null : dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    if (key) { await c.keyDown(key); await sleep(Math.min(260, 40 + Math.abs(dx) * 0.7)); await c.keyUp(key); }
    else await sleep(110);
    if (s.bossName && Date.now() - lastMissile > 2600) { await c.tapKey('KeyX', 0); lastMissile = Date.now(); }
    if (s.bossName && !bossSeen) { bossSeen = true; bossName = s.bossName; note(`${slug}: boss "${bossName}" hp ${s.bossHp}/${s.bossMax}`); await c.screenshot(shot(`${prefix}-boss.png`)); }
    if (s.wave > lastWave) { lastWave = s.wave; if (s.wave > 1) note(`${slug}: wave ${s.wave} (chapter ${s.chapter}) score ${s.score} lives ${s.lives}`); }
    if (s.mode === 'clear') {
      note(`${slug}: chapter ${s.chapter} cleared (score ${s.score}, lives ${s.lives})`);
      if (s.chapter === 1) await c.screenshot(shot(`${prefix}-ch1clear.png`));
      await sleep(3200);
    }
    if (s.lives <= 0) break;
  }
  await c.keyUp('KeyZ');
  s = await st();
  note(`${slug}: run ended mode=${s?.mode} score=${s?.score} lives=${s?.lives} kills=${s?.kills} unlocked=${s?.unlocked}`);
  if (s?.mode === 'win') { await c.screenshot(shot(`${prefix}-win.png`)); return true; }
  // loss path is also evidence: gameover screen + confirmEnd via Z
  if (s?.mode === 'gameover') { await c.screenshot(shot(`${prefix}-gameover.png`)); await c.tapKey('KeyZ', 200); await sleep(500); note(`${slug}: gameover confirmed → ${JSON.stringify(await st())?.slice(0, 80)}`); }
  return false;
}

async function runPackRetries(slug, prefix, tries) {
  for (let i = 1; i <= tries; i++) {
    try {
      const won = await runPack(slug, prefix, i > 1);
      if (won) return true;
      note(`${slug}: retry ${i}/${tries} failed`);
    } catch (e) {
      note(`${slug}: retry ${i}/${tries} aborted: ${String(e.message).slice(0, 90)}`);
    }
  }
  return false;
}
const okA = await runPackRetries('chicken-invaders', '40-cinvaders', 2);
const okB = await runPackRetries('chicken-invaders-original', '45-cluck', 2);
note(`packs won: chicken-invaders=${okA} cluck-horizon=${okB}`);
writeFileSync(new URL('../evidence/release-r2/shmup-drive.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
await c.close();
console.log('SHMUP DRIVE COMPLETE');
