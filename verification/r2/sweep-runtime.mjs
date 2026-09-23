// verification/r2/sweep-runtime.mjs — runtime health sweep across every game
// page of the shipped artifact: collects console errors, page exceptions, and
// failed network requests while each game idles 4s, then proves the return-to-
// arcade link and hub cards resolve. Also spot-checks mobile viewport on one
// game and touch input (CDP touch events) on the boxhead virtual stick.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const EV = '../evidence/release-r2';
mkdirSync(new URL(`${EV}/`, import.meta.url), { recursive: true });
const shot = (n) => new URL(`${EV}/${n}`, import.meta.url).pathname.slice(1);
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// raw CDP connection with event subscription
const { execFileSync } = await import('node:child_process');
const exe = join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'agent-browser', 'bin', 'agent-browser-win32-x64.exe');
const wsUrl = execFileSync(exe, ['get', 'cdp-url'], { encoding: 'utf8' }).trim();
const port = +wsUrl.match(/ws:\/\/127\.0\.0\.1:(\d+)/)[1];
const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter(t => t.type === 'page' && t.url.startsWith('http'));
const game = targets.find(t => /4174\/(boxhead|impossible|burger-tycoon|chicken-invaders|swords-and-sandals|hardest)/.test(t.url)) ?? targets[0];
const ws = new WebSocket(game.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
const events = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') events.push(['exception', m.params.exceptionDetails?.text ?? '', m.params.exceptionDetails?.exception?.description?.slice(0, 160) ?? '']);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') events.push(['console-error', (m.params.args ?? []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160)]);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') events.push(['log-error', String(m.params.entry.text ?? '').slice(0, 160), m.params.entry.url ?? '']);
  if (m.method === 'Network.loadingFailed') events.push(['net-failed', m.params.errorText, m.params.blockedReason ?? '']);
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evalx = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');

const games = ['boxhead', 'impossible', 'burger-tycoon', 'chicken-invaders', 'chicken-invaders-original', 'swords-and-sandals', 'hardest'];
for (const g of games) {
  events.length = 0;
  await send('Page.navigate', { url: `http://127.0.0.1:4174/${g}/` });
  await sleep(4000);
  const title = await evalx('document.title');
  note(`${g}: "${title}" — ${events.length === 0 ? 'no errors' : JSON.stringify(events.slice(0, 3))}`);
}

// hub: every card link resolves to a real page with a return link back to ../
events.length = 0;
await send('Page.navigate', { url: 'http://127.0.0.1:4174/' });
await sleep(1500);
const cards = await evalx('[...document.querySelectorAll("#grid a")].map(a => a.getAttribute("href"))');
note(`hub cards: ${JSON.stringify(cards)}`);
for (const href of cards) {
  await send('Page.navigate', { url: `http://127.0.0.1:4174/${href.replace('./', '')}` });
  await sleep(1200);
  const back = await evalx('!!document.querySelector(\'a[href="../"]\')');
  note(`  ${href} → return-link=${back}`);
}

// mobile viewport spot check (burger-tycoon is DOM-laid-out; 390x844 phone)
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:4174/burger-tycoon/' });
await sleep(2000);
const tabs = await evalx('getComputedStyle(document.getElementById("tabs")).display');
const shotBytes = (await send('Page.captureScreenshot', { format: 'png' })).result.data;
writeFileSync(shot('70-burger-mobile.png'), Buffer.from(shotBytes, 'base64'));
note(`mobile 390x844 burger: tabs display="${tabs}" (grid => touch layout active)`);
await send('Emulation.clearDeviceMetricsOverride');

// touch input spot check: boxhead virtual stick via CDP touch events
await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }).catch(() => {});
await send('Page.navigate', { url: 'http://127.0.0.1:4174/boxhead/?debug' });
await sleep(2000);
await evalx('window.__maga.game && 0');
// start a solo run with keys
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await sleep(80);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await sleep(300);
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
await sleep(80);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
await sleep(300);
await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
await sleep(80);
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
await sleep(700);
const state = () => evalx('JSON.stringify({s: window.__maga.game.state, stick: window.__maga.touch.stick, coarse: window.__maga.touch.coarse})');
note(`boxhead after key start: ${await state()}`);
// touch the stick zone (bottom-left in stage units; canvas maps CSS→logical)
const r = await evalx('(() => { const b=document.querySelector("canvas").getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })()');
const tx = r[0] + r[2] * 0.18, ty = r[1] + r[3] * 0.82;
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 1 }] });
await sleep(120);
for (let i = 1; i <= 8; i++) {
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + i * 6, y: ty, id: 1 }] });
  await sleep(60);
}
const during = await state();
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
note(`touch stick: during=${during} after-release=${await state()}`);
await send('Emulation.setEmitTouchEventsForMouse', { enabled: false, configuration: 'mobile' }).catch(() => {});

writeFileSync(new URL('../evidence/release-r2/sweep-runtime.log.json', import.meta.url).pathname.slice(1), JSON.stringify(log, null, 2));
ws.close();
console.log('RUNTIME SWEEP COMPLETE');
process.exit(0);
