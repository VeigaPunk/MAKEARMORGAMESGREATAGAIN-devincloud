import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto((process.env.SAS_URL || 'http://127.0.0.1:5178/') + '?debug');
    const click = async locator => mobile ? locator.tap() : locator.click();
    await page.locator('#name').fill('Aurelius');
    for (const stat of ['strength', 'strength', 'strength', 'agility', 'vitality', 'defense']) await click(page.getByRole('button', { name: `Increase ${stat}`, exact: true }));
    await page.screenshot({ path: `${evidence}${mobile ? 'mobile' : 'desktop'}-create.png`, fullPage: true });
    await click(page.getByRole('button', { name: /Enter the arena/ }));
    for (let bout = 0; bout < 12; bout++) {
      if (bout) {
        await click(page.getByRole('button', { name: /Smithy & armory/ }));
        while (await page.getByRole('button', { name: /Buy & equip/ }).count()) await click(page.getByRole('button', { name: /Buy & equip/ }).first());
        await click(page.getByRole('button', { name: /Return to the hub/ }));
      }
      await click(page.getByRole('button', { name: bout ? /Next opponent/ : /Start first bout/ }));
      if (!bout && !mobile && process.env.WRITE_COVERS) await page.locator('#stage').screenshot({ path: 'arcade/covers/swords-and-sandals.png' });
      if (!bout) await page.screenshot({ path: `${evidence}${mobile ? 'mobile' : 'desktop'}-combat.png`, fullPage: true });
      let turns = 0;
      while (await page.evaluate(() => window.__maga.mode === 'arena')) {
        await page.waitForFunction(() => !window.__maga.snapshot.busy);
        if (await page.evaluate(() => window.__maga.mode !== 'arena')) break;
        assert.ok(turns++ < 70, 'bout must finish');
        const snap = await page.evaluate(() => window.__maga.snapshot), g = snap.state.gladiator;
        const action = g.hp <= g.maxHp - 26 && g.potions > 0 ? /Potion \(/ : snap.combat.cooldown === 0 ? /Shield breaker/ : /⚔ Attack/;
        await click(page.getByRole('button', { name: action }));
      }
      if (await page.evaluate(() => window.__maga.opponent) === bout) { bout--; continue; }
      assert.equal(await page.evaluate(() => window.__maga.opponent), bout + 1);
      await page.reload(); await page.waitForFunction(() => window.__maga);
      assert.equal(await page.evaluate(() => window.__maga.opponent), bout + 1, 'progress survives reload');
    }
    assert.equal(await page.evaluate(() => window.__maga.mode), 'complete');
    await page.screenshot({ path: `${evidence}${mobile ? 'mobile' : 'desktop'}-champion.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await click(page.getByRole('button', { name: /New gladiator/ }));
    await click(page.getByRole('button', { name: /Create new gladiator/ }));
    assert.equal(await page.evaluate(() => window.__maga.mode), 'create');
    assert.deepEqual(errors, []);
    console.log(`${mobile ? 'Touch mobile' : 'Desktop'}: UI creation, all twelve wins, legal purchases, reload persistence, champion and restart passed.`);
    await context.close();
  }
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto((process.env.SAS_URL || 'http://127.0.0.1:5178/') + '?debug');
  await page.evaluate(() => localStorage.setItem('maga:swords-and-sandals:slot', JSON.stringify({ gladiator: { name: '<img src=x onerror=p=1>', look: 'Scarlet', stats: { strength: 5, agility: 3, vitality: 3, defense: 3 }, hp: 51, maxHp: 51, gold: 0, xp: 0, level: 1, weapon: 0, armor: 0, potions: 2 }, defeated: 0, owned: [] })));
  await page.reload(); await page.waitForFunction(() => window.__maga);
  assert.equal(await page.evaluate(() => typeof window.p), 'undefined'); assert.equal(await page.locator('#player-name img').count(), 0);
  await page.evaluate(() => { const key = 'maga:swords-and-sandals:slot'; const d = JSON.parse(localStorage.getItem(key)); d.gladiator.look = '<img src=x onerror=q=1>'; localStorage.setItem(key, JSON.stringify(d)); });
  await page.reload(); assert.equal(await page.evaluate(() => window.__maga.mode), 'create'); assert.equal(await page.evaluate(() => typeof window.q), 'undefined');
  console.log('Stored name markup stays literal; crafted appearance save safely resets.');
} finally { await browser.close(); }
