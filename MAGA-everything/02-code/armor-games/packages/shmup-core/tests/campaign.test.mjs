import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Run the shipping TypeScript simulation without a browser or a second implementation.
const source = await build({ stdin: { contents: `export * from './sim'; export * from './packs';`, resolveDir: fileURLToPath(new URL('../src/', import.meta.url)) }, bundle: true, platform: 'node', format: 'esm', write: false });
const { ShmupSim, PACKS, DT } = await import(`data:text/javascript;base64,${Buffer.from(source.outputFiles[0].text).toString('base64')}`);
const records = new Map();
globalThis.localStorage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
function steps(sim, seconds) { for (let n = 0; n < Math.ceil(seconds / DT); n++) sim.step(DT); }
function strike(sim, target) {
  // Collision-level harness: place an ordinary round in the target's path.
  sim.bullets.push({ x: target.x, y: target.y, vx: 0, vy: 0 });
  sim.step(DT);
}

for (const pack of Object.values(PACKS)) {
  test(`${pack.id}: both chapters, all formations, named bosses, score and restart`, () => {
    const ns = `test-${pack.id}-campaign`, sim = new ShmupSim(pack, ns);
    sim.startGame(1);
    const visited = new Set();
    for (let safety = 0; safety < 1000 && sim.mode !== 'win'; safety++) {
      if (sim.mode === 'clear') { steps(sim, 2.7); continue; }
      visited.add(`${sim.chapter}:${sim.waveIdx}`);
      if (sim.boss) {
        const boss = sim.boss;
        assert.equal(sim.snapshot().bossName, pack.bosses[sim.chapter - 1].name);
        // Settle fly-in; shoot with real projectile damage and collision rules.
        steps(sim, 1);
        while (sim.boss === boss) strike(sim, boss);
        assert.equal(sim.eggs.length, 0, 'cleared sector must not retain hazards');
        assert.equal(sim.bullets.length, 0);
        assert.equal(sim.ship.alive, true);
      } else if (sim.chickens.length) {
        steps(sim, 1.5);
        while (sim.chickens.length) strike(sim, sim.chickens[0]);
      } else sim.step(DT);
    }
    assert.equal(sim.mode, 'win');
    assert.equal(visited.size, 8, 'three formations and a boss per chapter');
    assert.equal(sim.unlocked, 2);
    assert.equal(sim.snapshot().wave, 3);
    assert.ok(sim.score > 7600, 'variant score and boss rewards accumulate');
    const restored = new ShmupSim(pack, ns);
    assert.equal(restored.best, sim.score); assert.equal(restored.unlocked, 2);
    sim.confirmEnd(); assert.equal(sim.mode, 'title'); sim.startGame(1);
    assert.equal(sim.score, 0); assert.equal(sim.lives, 3); assert.equal(sim.boss, null);
  });

  test(`${pack.id}: three losses, protected respawn, game over and persisted score`, () => {
    const sim = new ShmupSim(pack, `test-${pack.id}-loss`); sim.startGame(1);
    sim.score = 500;
    for (let life = 3; life > 0; life--) {
      sim.ship.invuln = 0;
      sim.eggs = [{ x: sim.ship.x, y: sim.ship.y, vx: 0, vy: 0 }]; sim.step(DT);
      assert.equal(sim.lives, life - 1); assert.equal(sim.ship.alive, false);
      steps(sim, 1.21);
      if (life > 1) {
        assert.equal(sim.ship.alive, true); assert.ok(sim.ship.invuln > 1.9);
        sim.eggs.push({x:sim.ship.x,y:sim.ship.y,vx:0,vy:0}); sim.step(DT);
        assert.equal(sim.lives, life - 1, 'overlapping egg cannot kill protected respawn');
      }
    }
    assert.equal(sim.mode, 'gameover'); assert.equal(sim.best, 500);
    sim.confirmEnd(); assert.equal(sim.mode, 'title');
  });
}

test('malformed campaign saves cannot bypass chapter gate or poison score', () => {
  for (const value of [-1, 100, null, {}, '2']) {
    records.set('maga:bad:chapter-unlocked', JSON.stringify(value));
    records.set('maga:bad:best-score', JSON.stringify(value));
    const sim = new ShmupSim(PACKS.cluck, 'bad');
    assert.equal(sim.unlocked, 1); sim.startGame(2); assert.equal(sim.chapter, 1);
    assert.ok(Number.isFinite(sim.best)); assert.ok(sim.best >= 0);
  }
});

test('weapon gifts improve or preserve firepower; pause freezes chapter transition', () => {
  const sim = new ShmupSim(PACKS.cluck, 'gift'); sim.startGame(1);
  for (let n = 0; n < 5; n++) {
    sim.pickups.push({x:sim.ship.x,y:sim.ship.y,vy:0,kind:'gift'}); sim.step(DT);
  }
  assert.equal(sim.weaponLv, 2); assert.equal(sim.score, 250);
  sim.mode = 'clear'; sim.togglePause(); steps(sim, 4);
  assert.equal(sim.chapter, 1); assert.equal(sim.clearT, 0);
  sim.togglePause(); steps(sim, 2.7); assert.equal(sim.chapter, 2);
});

test('boss radial fires once per telegraph and produces twelve readable eggs', () => {
  const sim = new ShmupSim(PACKS.replica, 'radial'); sim.startGame(1);
  sim.chickens=[]; sim.waveIdx=sim.wavesTotal-1; sim.step(DT);
  sim.boss.volley = 99; sim.boss.radial = 0; sim.eggs=[];
  steps(sim, 0.8); assert.equal(sim.eggs.length, 12);
  steps(sim, 0.1); assert.equal(sim.eggs.length, 12);
});

// This pilot uses only movement, normal fire and the starting/picked-up missiles.
// It never changes health, targets, score, drops or projectile positions.
for (const pack of Object.values(PACKS)) test(`${pack.id}: campaign completable using real combat inputs`, () => {
 const originalRandom = Math.random;
 let seed = 42;
 Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
 try {
  const sim = new ShmupSim(pack, `pilot-${pack.id}`);
  sim.startGame(1); sim.setFire(true);
  const last = new Map(); let time = 0;
  for (; time < 180 && sim.mode !== 'win' && sim.mode !== 'gameover'; time += DT) {
   if (sim.mode === 'play') {
   const ship=sim.ship; const targets=sim.boss?[sim.boss]:sim.chickens;
   let targetX=480,cost=Infinity;
   for(const c of targets){const previous=last.get(c)||c.x;const vx=(c.x-previous)/DT;last.set(c,c.x);const hitTime=Math.max(0,(ship.y-c.y)/560);const lead=Math.max(25,Math.min(935,c.x+vx*hitTime));const cc=Math.abs(lead-ship.x);if(cc<cost){cost=cc;targetX=lead;}}
   const nearPickup=sim.pickups.filter(p=>p.y>290).sort((a,b)=>b.y-a.y)[0];if(nearPickup)targetX=nearPickup.x;
   let bestX=ship.x,bestCost=Infinity;
   for(let x=30;x<=930;x+=15){
    let c=Math.abs(x-targetX)*0.15+Math.abs(x-ship.x)*0.04;
    for(const egg of sim.eggs){const hitTime=(ship.y-egg.y)/egg.vy;if(hitTime<0||hitTime>1.7)continue;const ex=egg.x+egg.vx*hitTime;const sep=Math.abs(x-ex);c+=Math.max(0,65-sep)*(1.8-hitTime)*6;}
    for(const bird of sim.chickens){const t=bird.dive?(ship.y-bird.y)/bird.dvy:0;const bx=bird.x+(bird.dive?bird.dvx*Math.max(0,t):0);if(Math.abs(bird.y-ship.y)<90||(bird.dive&&t>0&&t<1.5))c+=Math.max(0,85-Math.abs(bx-x))*12;}
    if(c<bestCost){bestCost=c;bestX=x;}
   }
   sim.moveAxis={x:Math.max(-1,Math.min(1,(bestX-ship.x-ship.vx*0.11)/25)),y:Math.max(-1,Math.min(1,(485-ship.y)/25))};
   if(sim.boss&&Math.abs(sim.boss.x-ship.x)<35)sim.fireMissile();
   }
   sim.step(DT); sim.events.length = 0;
  }
  assert.equal(sim.mode, 'win', `${sim.mode} after ${time.toFixed(1)}s; ${JSON.stringify(sim.lastDeath)}`);
  assert.ok(sim.lives > 0); assert.ok(sim.score > 9000);
 } finally { Math.random = originalRandom; }
});


test('score milestones grant capped extra lives through ordinary kill scoring',()=>{
 const sim=new ShmupSim(PACKS.replica,'extra-life');sim.startGame(1);steps(sim,1.5);
 sim.score=4900;
 while(sim.score<5000)strike(sim,sim.chickens[0]);
 assert.equal(sim.lives,4);assert.match(sim.notice,/EXTRA LIFE/);
 sim.score=9900;while(sim.score<10000)strike(sim,sim.chickens[0]);assert.equal(sim.lives,5);
 sim.score=14900;while(sim.score<15000)strike(sim,sim.chickens[0]);assert.equal(sim.lives,5);
});
