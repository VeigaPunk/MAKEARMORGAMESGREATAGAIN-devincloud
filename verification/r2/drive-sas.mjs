// verification/r2/drive-sas.mjs — real-input verification for Swords & Sandals
// (shipped artifact arcade/swords-and-sandals). DOM-driven: character creation
// (name typing, look, stat allocation), first bout with real attack/guard/
// potion choices, shop visit, and save persistence across reload.
import { connect } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const c = await connect('http');
await c.send('Page.navigate', { url: 'http://127.0.0.1:4174/swords-and-sandals/?debug' });
await sleep(1800);

const find = (label) => c.eval(`(() => {
  const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase().includes('${label}'));
  if(!b||b.disabled)return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect();
  return [r.x+r.width/2, r.y+r.height/2];
})()`);
const click = async (label) => { const b = await find(label); if (!b) return false; await c.click(b[0], b[1]); await sleep(500); return true; };
const status = () => c.eval(`(() => { const hp=document.getElementById('gladiator-hp'), eh=document.getElementById('enemy-hp');
  const st=document.getElementById('enemy-status'); const n=document.getElementById('name');
  return { glHp: hp ? hp.textContent : null, enHp: eh ? eh.textContent : null, status: st ? st.textContent : null,
    name: n ? n.value : null, buttons: [...document.querySelectorAll('button')].filter(b=>!b.disabled).length }; })()`);

const mode = () => c.eval(`window.__maga ? window.__maga.mode : null`);
note(`boot mode=${await mode()} ${JSON.stringify(await status())}`);
await c.screenshot(shot('50-sas-create.png'));

// fresh save check: if a campaign exists (prior run), retire and create new
if (await mode() !== 'create') {
  note('existing campaign found — starting a fresh gladiator');
  if (await click('new gladiator')) { await sleep(400); }
  else {
    // hub → confirmNew path via any 'New gladiator' variants
    const nb = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/new gladiator|retire/i.test(b.textContent)); if(!b)return null; b.click(); return true; })()`);
    await sleep(400);
    if (nb) await click('create new');
  }
}

// type a name with real keystrokes into the input
const nameRect = await c.eval(`(() => { const i=document.getElementById('name'); if(!i)return null; const r=i.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
if (nameRect) {
  await c.click(nameRect[0], nameRect[1]);
  await c.eval('document.getElementById("name").value = ""; 0'); // clear placeholder state (typing appends)
  await c.send('Input.insertText', { text: 'Verus' });
  await sleep(200);
}
// allocate the six stat points: 3x strength (+), 2x vitality, 1x agility via aria-labeled buttons
const stat = (label) => c.eval(`(() => { const b=document.querySelector('button[aria-label="${label}"]'); if(!b||b.disabled)return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
// allocate exactly the six points (re-find after each click: render rebuilds the DOM)
for (const [label, times] of [['Increase strength', 3], ['Increase vitality', 2], ['Increase agility', 1]]) {
  for (let i = 0; i < times; i++) { const b = await stat(label); if (b) { await c.click(b[0], b[1]); await sleep(350); } }
}
const stats = await c.eval('window.__maga.gladiatorStats');
note(`create: stats allocated → ${JSON.stringify(stats)}`);

// pick a look variant (second option)
const looks = await c.eval(`(() => { const b=[...document.querySelectorAll('[data-look]')][1]; if(!b)return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
if (looks) { await c.click(looks[0], looks[1]); await sleep(350); }

// enter (retry up to 8s while allocation settles)
let entered = false;
for (let i = 0; i < 6 && !entered; i++) {
  const b = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/enter the arena/i.test(b.textContent)); if(!b||b.disabled)return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
  if (b) { await c.click(b[0], b[1]); entered = true; } else { await sleep(500); }
}
if (!entered) throw new Error('could not start campaign: ' + JSON.stringify(await status()));
note(`hub reached: mode=${await mode()} ${JSON.stringify(await status())}`);
await c.screenshot(shot('51-sas-hub.png'));

// shop visit: buy nothing (or cheapest affordable), then return
if (await click('smithy')) {
  await c.screenshot(shot('52-sas-shop.png'));
  const buy = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Buy & equip'); if(!b||b.disabled)return null; const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]; })()`);
  if (buy) { await c.click(buy[0], buy[1]); await sleep(400); note('shop: bought an item'); }
  else note('shop: nothing affordable yet (fresh save) — inspected only');
  await click('return to the hub');
}

// first bout: fight with real choices until won or lost
if (await click('first bout')) {
  note(`bout 1 started: mode=${await mode()}`);
  let round = 0;
  while (round < 40) {
    const s = await status();
    if ((await mode()) !== 'arena') break;
    round++;
    // heuristic: potion when hurt, guard on heavy turns, attack otherwise
    const m = /HEAVY/.test(s.status ?? '') ? 'guard' : 'potion';
    let acted = false;
    if (m === 'potion') {
      const gl = parseInt((s.glHp ?? '0').split('/')[0] || '0');
      const glMax = parseInt((s.glHp ?? '0/0').split('/')[1] || '0');
      acted = gl < glMax * 0.4 ? await click('potion') : false;
    }
    if (m === 'guard' || (!acted && m === 'guard')) acted = await click('guard');
    if (!acted) acted = await click('attack');
    if (!acted) acted = await click('shield breaker');
    if (!acted) { note('no combat action available — stopping'); break; }
    await sleep(900); // turn animates
    const s2 = await status();
    if (round % 4 === 0 || (await mode()) !== 'arena') note(`round ${round}: gl=${s2.glHp} en=${s2.enHp} [${s2.status}]`);
  }
  const after = await mode();
  note(`bout resolved: mode=${after} ${JSON.stringify(await status())}`);
  await c.screenshot(shot('53-sas-after-bout.png'));
}

// persistence: reload, expect saved campaign (mode hub, name Verus)
await c.send('Page.reload');
await sleep(1800);
note(`after reload: mode=${await mode()} ${JSON.stringify(await status())}`);
writeFileSync(new URL('../evidence/release-r2/sas-drive.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
await c.close();
console.log('SAS DRIVE COMPLETE');
