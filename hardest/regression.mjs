import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
require('./engine.js');
require('./save.js');
require('./autopilot.js');
require('./manifest.js');
require('./pars.js');
const E = globalThis.HardestEngine, S = globalThis.HardestSave;

test('corrupt and legacy progress cannot crash menus or block legitimate records', () => {
  for (const raw of [null, [], 12, true, 'broken', { best: null }, { best: [1] }]) {
    assert.deepEqual(S.sanitize(raw), { unlocked: 1, best: {}, deaths: 0, mute: false });
  }
  const save = S.sanitize({ unlocked: 900, deaths: -1, mute: 'false', best: {
    1: { deaths: 0, time: 'broken', medal: 'gold' }, 2: null,
    3: { deaths: 2, time: 10, medal: 'arbitrary-color' },
    4: { deaths: 0, time: Infinity }, 5: { deaths: -2, time: 10 },
    115: { deaths: 0, time: 1 },
  } });
  assert.equal(save.unlocked, 114);
  assert.equal(save.deaths, 0);
  assert.equal(save.mute, false);
  assert.deepEqual(Object.keys(save.best), ['3']);
  assert.deepEqual(save.best[3], { deaths: 2, time: 10, bestTime: 10, medal: 'silver' });
  S.record(save, 1, 0, 5, 114);
  assert.equal(save.best[1].medal, 'gold');
  assert.equal(save.best[1].time, 5);
});

test('fastest clear and fewest deaths are preserved independently', () => {
  const save = S.sanitize({});
  S.record(save, 1, 0, 30, 114);
  S.record(save, 1, 2, 20, 114);
  assert.deepEqual(save.best[1], { deaths: 0, time: 30, bestTime: 20, medal: 'gold' });
  assert.equal(save.unlocked, 2);
  assert.deepEqual(S.sanitize(save), save);
});

test('all shipped levels and par times match the validated corpus', () => {
  const files = readdirSync(new URL('./levels/', import.meta.url)).filter(f => f.endsWith('.js'));
  assert.equal(files.length, 114);
  assert.deepEqual([...globalThis.HARDEST_MANIFEST].sort(), [...files].sort());
  assert.equal(Object.keys(globalThis.HARDEST_PARS).length, files.length);
  for (const f of files) assert.ok(globalThis.HARDEST_PARS[parseInt(f, 10)] > 0, f);
});

test('unsafe authored movement speeds are rejected before wall tunneling', () => {
  const map = ['#####', '#S.G#', '#####'];
  for (const playerSpeed of [0, -1, NaN, Infinity, 8000, '175']) {
    assert.throws(() => E.create({ map, playerSpeed }), /playerSpeed/);
  }
  assert.equal(E.create({ map, playerSpeed: 185 }).P.playerSpeed, 185);
});

for (const file of ['30-hardest.js', '109-vault-door.js', '111-portal-press.js']) {
  test(`${file}: completion proof replays with full 60Hz input holds`, () => {
    globalThis.HARDEST_LEVELS = [];
    require(`./levels/${file}`);
    const level = globalThis.HARDEST_LEVELS[0], tape = [];
    const proof = globalThis.HardestAutopilot.solve(level, { onInput: (input, steps) => tape.push({ input, steps }) });
    assert.ok(proof.clear, proof.reason);
    const replay = E.create(level);
    for (const { input, steps } of tape) {
      assert.equal(steps, 4);
      assert.ok(Math.hypot(input.x, input.y) <= 1.000000001);
      for (let i = 0; i < steps; i++) E.step(replay, input, E.STEP);
    }
    assert.equal(replay.status, 'clear');
    assert.equal(replay.deaths, proof.deaths);
    assert.equal(replay.time, proof.time);
  });
}
