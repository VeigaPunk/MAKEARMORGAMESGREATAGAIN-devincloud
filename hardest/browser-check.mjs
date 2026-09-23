/* Actual Chromium renderer + deterministic animation clock, including proof
 * playback through game.js. Dev-only: uses the fleet's Playwright dependency. */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const callbacks = [];
    let time = 100;
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    window.__tick = () => { const cb = callbacks.shift(); if (!cb) throw new Error('Missing animation callback'); time += 1000 / 60; cb(time); };
    localStorage.setItem('hardest.save.v1', JSON.stringify({ unlocked: 3, best: { 1: { deaths: 0, time: 'corrupt', medal: 'gold' }, 2: { deaths: 1, time: 9, medal: 'silver' } }, mute: true }));
  });
  await page.goto(new URL('./index.html', import.meta.url).href);
  await page.waitForFunction(() => window.__hardest?.state().levels === 114, undefined, { polling: 50 });
  await page.evaluate(() => __tick());
  const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem('hardest.save.v1')));
  assert.equal(recovered.best[1], undefined);
  assert.equal(recovered.best[2].medal, 'silver');
  assert.deepEqual(errors, []);
  await page.addScriptTag({ path: fileURLToPath(new URL('./autopilot.js', import.meta.url)) });
  for (const id of [1, 30, 97, 109, 111, 114]) {
    const result = await page.evaluate(id => {
      const tape = [];
      const level = HARDEST_LEVELS.find(l => l.id === id);
      const proof = HardestAutopilot.solve(level, { onInput: (input, steps) => tape.push({ input, steps }) });
      if (!proof.clear) throw new Error(`No completion proof for ${id}`);
      __hardest.start(id - 1);
      for (const { input, steps } of tape) {
        if (steps !== 4) throw new Error('Input changed inside a render frame');
        __hardest.input(input.x, input.y);
        __tick();
      }
      const state = __hardest.state();
      document.getElementById('levels').click();
      __tick(); // exercise medals and best-time formatting after a real clear
      return { proof, state, menu: __hardest.state().screen, save: JSON.parse(localStorage.getItem('hardest.save.v1')) };
    }, id);
    assert.equal(result.state.status, 'clear', `browser clear ${id}`);
    assert.equal(result.state.screen, 'clear');
    assert.equal(result.state.deaths, result.proof.deaths);
    assert.equal(result.state.time, result.proof.time);
    assert.equal(result.menu, 'menu');
    assert.equal(result.save.best[id].deaths, result.proof.deaths);
    console.log(`PASS browser proof replay L${id}: ${result.proof.time.toFixed(1)}s / ${result.proof.deaths} deaths`);
  }
  // Real DOM keys, toolbar actions, and focus loss must never leave a held axis.
  await page.evaluate(() => { __hardest.start(0); __tick(); });
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => { for (let i = 0; i < 8; i++) __tick(); window.dispatchEvent(new Event('blur')); __tick(); });
  assert.equal(await page.evaluate(() => __hardest.state().screen), 'pause');
  const frozen = await page.evaluate(() => __hardest.state().time);
  await page.evaluate(() => { for (let i = 0; i < 10; i++) __tick(); });
  assert.equal(await page.evaluate(() => __hardest.state().time), frozen);
  await page.keyboard.up('ArrowRight');
  await page.locator('#pause').click();
  const stopped = await page.evaluate(() => { __tick(); return __hardest.engine().player.x; });
  await page.evaluate(() => { for (let i = 0; i < 8; i++) __tick(); });
  assert.equal(await page.evaluate(() => __hardest.engine().player.x), stopped);
  // A death is durable immediately; restarting or selecting levels cannot add it twice.
  const deaths = await page.evaluate(() => JSON.parse(localStorage.getItem('hardest.save.v1')).deaths);
  await page.evaluate(() => {
    const st = __hardest.engine(), pos = HardestEngine.dotPos(st.P.patrols[0], st.t + HardestEngine.STEP);
    st.player.x = pos.x - st.player.w / 2; st.player.y = pos.y - st.player.h / 2; __tick();
  });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hardest.save.v1')).deaths), deaths + 1);
  await page.locator('#restart').click();
  await page.evaluate(() => __tick());
  await page.locator('#levels').click();
  await page.evaluate(() => __tick());
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hardest.save.v1')).deaths), deaths + 1);
  assert.deepEqual(errors, []);
  console.log('PASS corrupt saves, medal rendering, pause/focus recovery, immediate death persistence, no duplicate deaths');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(new URL('./index.html', import.meta.url).href);
  await mobile.waitForFunction(() => window.__hardest?.state().levels === 114);
  await mobile.locator('#level-choice').selectOption('0');
  await mobile.locator('#play-level').click();
  const touch = await mobile.evaluate(() => {
    const r = document.getElementById('c').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, playerX: __hardest.engine().player.x, width: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  const session = await mobile.context().newCDPSession(mobile);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x, y: touch.y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x + 25, y: touch.y }] });
  await mobile.waitForTimeout(100);
  assert.ok(await mobile.evaluate(() => __hardest.engine().player.x) > touch.playerX);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await mobile.locator('#pause').click();
  assert.equal(await mobile.evaluate(() => __hardest.state().screen), 'pause');
  assert.ok(touch.width <= touch.viewport);
  assert.deepEqual(errors, []);
  console.log('PASS mobile touch movement/cancel and visible pause controls; no browser errors');
} finally { await browser.close(); }
