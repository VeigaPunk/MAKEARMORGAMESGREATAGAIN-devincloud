// verification/r2/cdp.mjs — zero-dependency CDP input library + CLI (node >= 22).
// Speaks real trusted browser input (Input.dispatchKeyEvent/MouseEvent/TouchEvent)
// straight to the page-level DevTools endpoint of the agent-browser daemon's
// Chromium. Key/button holds persist in the browser across CLI calls.
//
// CLI (page = most recent non-chrome:// page, or CDP_PAGE_URL prefix filter):
//   node cdp.mjs keydown KeyW | keyup KeyW | tap Space 6 260
//   node cdp.mjs mouse move 640 400 | mouse down x y | mouse up x y | click 640 400
//   node cdp.mjs touch start x y | touch move x y | touch end
//   node cdp.mjs eval "1+1" | url | screenshot out.png
// Library: `import { connect } from './cdp.mjs'` → { send, eval, keyDown, keyUp,
//   tapKey, mouseMove, mouseDown, mouseUp, click, touchStart, touchMove, touchEnd, close }
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function tryPort(port) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })).json();
    return v?.Browser ? port : null;
  } catch { return null; }
}
async function httpPort() {
  const candidates = [];
  try {
    const dir = join(homedir(), '.agent-browser');
    for (const f of ['default.port', 'default.cdp']) {
      try {
        const t = readFileSync(join(dir, f), 'utf8').trim();
        if (/^\d+$/.test(t)) candidates.push(+t);
        const m = t.match(/ws:\/\/127\.0\.0\.1:(\d+)/);
        if (m) candidates.push(+m[1]);
      } catch { /* next */ }
    }
  } catch { /* fall through */ }
  for (const p of candidates) { const ok = await tryPort(p); if (ok) return ok; }
  const exe = join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'agent-browser', 'bin', 'agent-browser-win32-x64.exe');
  const url = execFileSync(exe, ['get', 'cdp-url'], { encoding: 'utf8' }).trim();
  const p = +url.match(/ws:\/\/127\.0\.0\.1:(\d+)/)[1];
  if (await tryPort(p)) return p;
  throw new Error('agent-browser daemon CDP not reachable');
}

const KEYMAP = {
  KeyW: { key: 'w', vk: 0x57 }, KeyA: { key: 'a', vk: 0x41 }, KeyS: { key: 's', vk: 0x53 }, KeyD: { key: 'd', vk: 0x44 },
  KeyZ: { key: 'z', vk: 0x5A }, KeyX: { key: 'x', vk: 0x58 }, KeyC: { key: 'c', vk: 0x43 },
  KeyQ: { key: 'q', vk: 0x51 }, KeyE: { key: 'e', vk: 0x45 }, KeyR: { key: 'r', vk: 0x52 }, KeyM: { key: 'm', vk: 0x4D },
  KeyJ: { key: 'j', vk: 0x4A }, KeyK: { key: 'k', vk: 0x4B }, KeyP: { key: 'p', vk: 0x50 },
  Digit1: { key: '1', vk: 0x31 }, Digit2: { key: '2', vk: 0x32 }, Digit3: { key: '3', vk: 0x33 },
  Space: { key: ' ', vk: 0x20 }, Enter: { key: 'Enter', vk: 0x0D }, Escape: { key: 'Escape', vk: 0x1B },
  ArrowUp: { key: 'ArrowUp', vk: 0x26 }, ArrowDown: { key: 'ArrowDown', vk: 0x28 },
  ArrowLeft: { key: 'ArrowLeft', vk: 0x25 }, ArrowRight: { key: 'ArrowRight', vk: 0x27 },
  ShiftLeft: { key: 'Shift', vk: 0xA0 }, ShiftRight: { key: 'Shift', vk: 0xA1 },
};
function keyDescriptor(name) {
  if (KEYMAP[name]) return KEYMAP[name];
  if (/^Key[A-Z]$/.test(name)) return { key: name.slice(3).toLowerCase(), vk: name.charCodeAt(3) };
  if (/^Digit\d$/.test(name)) return { key: name.slice(5), vk: name.charCodeAt(5) };
  throw new Error(`unknown key ${name}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function connect(urlFilter = process.env.CDP_PAGE_URL ?? 'http') {
  const port = await httpPort();
  let targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
    .filter(t => t.type === 'page' && t.url.startsWith(urlFilter));
  if (!targets.length) throw new Error(`no page target matching ${urlFilter}`);
  // prefer a game page over the arcade hub when both match
  const game = targets.find(t => /4174\/(boxhead|impossible|burger-tycoon|chicken-invaders|swords-and-sandals|hardest)/.test(t.url));
  const page = game ?? targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, 8000).unref();
  });
  const api = {
    page,
    send,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (r.error) throw new Error(r.error.message);
      if (r.result?.exceptionDetails) throw new Error('page eval threw: ' + JSON.stringify(r.result.exceptionDetails.exception?.description ?? ''));
      return r.result?.result?.value;
    },
    async keyDown(code) {
      const d = keyDescriptor(code);
      const r = await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: d.key, code, windowsVirtualKeyCode: d.vk, nativeVirtualKeyCode: d.vk });
      if (r.error) throw new Error(r.error.message);
    },
    async keyUp(code) {
      const d = keyDescriptor(code);
      const r = await send('Input.dispatchKeyEvent', { type: 'keyUp', key: d.key, code, windowsVirtualKeyCode: d.vk, nativeVirtualKeyCode: d.vk });
      if (r.error) throw new Error(r.error.message);
    },
    async tapKey(code, gapMs = 150, times = 1) {
      for (let i = 0; i < times; i++) {
        await api.keyDown(code); await sleep(30); await api.keyUp(code);
        if (i < times - 1) await sleep(gapMs);
      }
    },
    async mouseMove(x, y, buttons = 0) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons });
    },
    async mouseDown(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    },
    async mouseUp(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    },
    async click(x, y) {
      await api.mouseMove(x, y); await sleep(40);
      await api.mouseDown(x, y); await sleep(60); await api.mouseUp(x, y);
    },
    touchPoint: null,
    async touchStart(x, y) {
      api.touchPoint = { x, y };
      const r = await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      if (r.error) throw new Error(r.error.message);
    },
    async touchMove(x, y) {
      api.touchPoint = { x, y };
      const r = await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
      if (r.error) throw new Error(r.error.message);
    },
    async touchEnd() {
      const r = await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      api.touchPoint = null;
      if (r.error) throw new Error(r.error.message);
    },
    async screenshot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(r.result.data, 'base64'));
    },
    async close() {
      try {
        await new Promise((res) => { const t = setTimeout(res, 800); ws.onclose = () => { clearTimeout(t); res(); }; ws.close(); });
      } catch { /* already closed */ }
    },
  };
  return api;
}

// ---- CLI mode ----
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  const c = await connect();
  try {
    if (cmd === 'keydown') { await c.keyDown(args[0]); console.log(`${cmd} ${args[0]} ok`); }
    else if (cmd === 'keyup') { await c.keyUp(args[0]); console.log(`${cmd} ${args[0]} ok`); }
    else if (cmd === 'tap') { await c.tapKey(args[0], +(args[2] ?? 150), +(args[1] ?? 1)); console.log(`tapped ${args[0]} x${args[1] ?? 1}`); }
    else if (cmd === 'mouse') {
      const [sub, a, b] = args;
      if (sub === 'move') await c.mouseMove(+a, +b);
      else if (sub === 'down') await c.mouseDown(+a, +b);
      else if (sub === 'up') await c.mouseUp(+a, +b);
      else throw new Error('mouse subcommand? (move x y | down x y | up x y)');
      console.log(`mouse ${sub} ok`);
    } else if (cmd === 'click') { await c.click(+args[0], +args[1]); console.log(`clicked ${args[0]},${args[1]}`); }
    else if (cmd === 'touch') {
      const [sub, a, b] = args;
      if (sub === 'start') await c.touchStart(+a, +b);
      else if (sub === 'move') await c.touchMove(+a, +b);
      else if (sub === 'end') await c.touchEnd();
      else throw new Error('touch subcommand? (start x y | move x y | end)');
      console.log(`touch ${sub} ok`);
    } else if (cmd === 'eval') { console.log(JSON.stringify(await c.eval(args[0]))); }
    else if (cmd === 'url') { console.log(c.page.url); }
    else if (cmd === 'screenshot') { await c.screenshot(args[0]); console.log(`saved ${args[0]}`); }
    else throw new Error(`unknown command ${cmd}`);
  } finally {
    await c.close();
    process.exit(0);
  }
}
