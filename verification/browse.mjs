#!/usr/bin/env node
/**
 * verification/browse.mjs — browser gate for the shipped fleet (games/ + portal).
 *
 * Serves nothing itself: expects `python3 -m http.server 4173` (or any static
 * server) at the repo root, and a Chromium with CDP at CDP_PORT (default
 * 29229 — this box's Devin browser). Uses the zero-dep CDP protocol from
 * verification/r2/cdp.mjs: real Input.dispatch* events; page state is only
 * observed through each app's `?debug` `window.__maga` read-only hooks.
 *
 * Gate per page: zero console errors / exceptions / failed requests after
 * load; `__maga` present where the build exposes it; a real-input smoke
 * (keys/mouse) that provably changes observable state.
 *
 * Usage: node verification/browse.mjs
 * Evidence: verification/evidence/devincloud-<ts>/*.png + browse-log.json
 */
import { connect } from './r2/cdp.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const PORT = process.env.CDP_PORT || '29229';

// cdp.mjs discovers the daemon via ~/.agent-browser/default.port
try { mkdirSync(join(homedir(), '.agent-browser'), { recursive: true });
  writeFileSync(join(homedir(), '.agent-browser', 'default.port'), PORT); } catch {}

const evidence = join(here, 'evidence', `devincloud-${Date.now()}`);
mkdirSync(evidence, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = { base: BASE, pages: {} };
let failures = 0;
const fail = (page, msg) => { failures++; console.log(`  FAIL ${page}: ${msg}`); log.pages[page].fail = msg; };
const ok = (page, msg) => { console.log(`  ok   ${page}: ${msg}`); };

// ---- open a fresh tab, attach to it, foreground it, navigate it ----
const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const c = await connect('about:blank');
const { send } = c;
// a backgrounded tab's rAF is frozen — real input lands but no frames run;
// bring the attached target to the foreground first.
await fetch(`http://127.0.0.1:${PORT}/json/activate/${c.page.id}`).catch(() => {});
await sleep(300);
const errors = [];
send('Runtime.enable');
send('Log.enable');
send('Network.enable');
send('Page.enable');
// listeners: cdp.mjs dispatches only response ids; read events via a raw hook
// — attach an extra socket to the same target for event streaming.
const eventSocket = new WebSocket(c.page.webSocketDebuggerUrl);
await new Promise((res) => { eventSocket.onopen = res; });
const eventWaiters = [];
eventSocket.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + JSON.stringify(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && m.params.entry.source !== 'network')
    errors.push('log: ' + m.params.entry.text);
  if (m.method === 'Network.loadingFailed' && !/favicon/.test(m.params?.errorText || '')) errors.push('netfail: ' + (m.params.type || ''));
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !/favicon/.test(m.params.response.url)) errors.push(`http ${m.params.response.status}: ${m.params.response.url}`);
  for (const w of [...eventWaiters]) if (w.pred(m)) { eventWaiters.splice(eventWaiters.indexOf(w), 1); w.res(m); }
};
const waitEvent = (pred, ms) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('event timeout')), ms);
  eventWaiters.push({ pred, res: (m) => { clearTimeout(t); res(m); } });
});
const esend = (method, params = {}) => {
  const id = 9000 + Math.floor(Math.random() * 1e6);
  eventSocket.send(JSON.stringify({ id, method, params }));
};
// enable domains on the event socket too (Runtime events stream there)
esend('Runtime.enable'); esend('Log.enable'); esend('Network.enable'); esend('Page.enable');

async function goto(url) {
  errors.length = 0;
  await send('Page.navigate', { url });
  await waitEvent((m) => m.method === 'Page.loadEventFired', 15000).catch(() => {});
  await sleep(2200); // let boot/rAF settle
}

const maga = (expr) => c.eval(`window.__maga ? (${expr}) : undefined`);

// ---------------------------------------------------------------- portal
await goto(`${BASE}/index.html`);
{
  const links = await c.eval(`[...document.querySelectorAll('a')].map(a=>a.getAttribute('href'))`);
  const games = (links || []).filter((h) => h && /games\//.test(h));
  log.pages.portal = { links: games.length, errors: [...errors] };
  errors.length ? fail('portal', errors.join(' | ')) :
    games.length >= 7 ? ok('portal', `${games.length} game links, clean console`) :
                        fail('portal', `only ${games.length} game links`);
}
await c.screenshot(join(evidence, '00-portal.png'));

// ------------------------------------------------------------- per game
const GAMES = ['boxhead', 'impossible', 'burger-tycoon', 'chicken-invaders', 'cluck-horizon', 'swords-and-sandals', 'hardest'];

for (const g of GAMES) {
  const page = { };
  log.pages[g] = page;
  await goto(`${BASE}/games/${g}/index.html${g === 'hardest' ? '' : '?debug=1'}`);
  await c.screenshot(join(evidence, `10-${g}-boot.png`));

  if (errors.length) { fail(g, 'boot: ' + errors.join(' | ')); continue; }

  // --- real-input smoke per game ---
  try {
    if (g === 'impossible') {
      const scr0 = await maga(`__maga.screen`);
      await c.tapKey('Space'); await sleep(900);
      const scr1 = await maga(`__maga.screen`);
      const x = await maga(`__maga.x`);
      (scr1 !== scr0 || x > 0) ? ok(g, `Space tap: screen ${scr0}→${scr1}, x=${x}`) : fail(g, 'Space had no observable effect');
    } else if (g === 'boxhead') {
      const m0 = await maga(`__maga.mode + '/' + __maga.state`);
      for (const k of ['Enter', 'Space']) { await c.tapKey(k); await sleep(500); }
      const m1 = await maga(`__maga.mode + '/' + __maga.state`);
      await c.keyDown('KeyW'); await sleep(600); await c.keyUp('KeyW');
      const alive = await maga(`__maga.enemiesAlive`);
      m1 !== m0 ? ok(g, `menu→${m1}, enemiesAlive=${alive}`) : fail(g, `stuck at ${m0}`);
    } else if (g === 'chicken-invaders' || g === 'cluck-horizon') {
      const m0 = await maga(`__maga.state.mode`);
      await c.tapKey('Enter'); await sleep(900);
      const m1 = await maga(`__maga.state.mode`);
      const x0 = await maga(`__maga.state.shipX`);
      await c.keyDown('ArrowLeft'); await sleep(500); await c.keyUp('ArrowLeft');
      const x1 = await maga(`__maga.state.shipX`);
      await c.keyDown('Space'); await sleep(700); await c.keyUp('Space');
      const bullets = await c.eval(`__maga.sim.bullets.length`);
      (m1 !== m0 && x1 !== x0 && bullets > 0)
        ? ok(g, `title→${m1}, shipX ${x0}→${x1}, bullets=${bullets}`)
        : fail(g, `mode ${m0}→${m1} shipX ${x0}→${x1} bullets=${bullets}`);
    } else if (g === 'burger-tycoon') {
      const p0 = await maga(`__maga.paused`);
      await c.tapKey('KeyP'); await sleep(300);
      const p1 = await maga(`__maga.paused`);
      p0 !== p1 ? ok(g, `KeyP toggles paused ${p0}→${p1}`) : fail(g, 'KeyP no effect');
    } else if (g === 'swords-and-sandals') {
      // title → NEW GLADIATOR is a DOM button (Enter only continues a save)
      const m0 = await maga(`__maga.mode`);
      const rect = await c.eval(`(() => { const b=[...document.querySelectorAll('button')].find(b=>/NEW GLADIATOR/.test(b.textContent)); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      if (!rect) { fail(g, 'NEW GLADIATOR button not found'); }
      else {
        await c.click(rect.x, rect.y); await sleep(700);
        const m1 = await maga(`__maga.mode`);
        m1 !== m0 ? ok(g, `click NEW GLADIATOR: mode ${m0}→${m1}`) : fail(g, `click no effect at mode=${m0}`);
      }
    } else if (g === 'hardest') {
      const png0 = join(evidence, '20-hardest-pre.png');
      await c.screenshot(png0);
      await c.tapKey('Enter'); await sleep(400);
      await c.keyDown('ArrowRight'); await sleep(700); await c.keyUp('ArrowRight');
      const png1 = join(evidence, '21-hardest-post.png');
      await c.screenshot(png1);
      readFileSync(png0).equals(readFileSync(png1))
        ? fail(g, 'frame identical after Enter+ArrowRight')
        : ok(g, 'render responds to real arrow input');
    }
  } catch (e) { fail(g, 'smoke threw: ' + e.message); }

  if (errors.length) fail(g, 'late errors: ' + errors.join(' | '));
  await c.screenshot(join(evidence, `30-${g}-after.png`));
}

writeFileSync(join(evidence, 'browse-log.json'), JSON.stringify(log, null, 2));
console.log(`\n${failures === 0 ? 'BROWSER GATE PASS' : `BROWSER GATE: ${failures} failure(s)`} — evidence: ${evidence}`);
await c.close();
process.exit(failures ? 1 : 0);
