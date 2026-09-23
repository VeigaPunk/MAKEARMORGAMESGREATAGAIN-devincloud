import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner, DT, LEVEL_END, GROUND_Y, CUBE, COURSES } from '../../MAGA-everything/02-code/armor-games/apps/impossible/src/runner.ts';
import { Sim, totalBacklash } from '../../MAGA-everything/02-code/armor-games/apps/burger-tycoon/src/sim.ts';
import { load } from '../../MAGA-everything/02-code/armor-games/packages/arcade-core/src/storage.ts';
export const jumps=[1330,1790,2300,2880,3290,3840,4280,4920,5490,6240,6750,7000,7250,7750,8400,8990,9300];
test('Impossible entire normal course clears with discrete player jump presses',()=>{
 const r=new Runner();let next=0;for(let i=0;i<4000&&r.state==='running';i++){if(r.x>=jumps[next]){r.jump();next++;}r.step();}
 assert.equal(r.state,'clear');assert.equal(r.deaths,0);assert.equal(r.x,LEVEL_END);assert.equal(next,jumps.length);
});
test('Impossible misses kill, instant retries, and practice keeps its checkpoint',()=>{
 const r=new Runner();while(r.state==='running')r.step();assert.equal(r.state,'dead');assert.equal(r.deaths,1);
 for(let i=0;i<20;i++)r.step();assert.equal(r.state,'running');assert.equal(r.attempt,2);assert.ok(r.x<10);
 r.practice=true;r.checkpoint=3300;r.die();for(let i=0;i<20;i++)r.step();assert.ok(r.x>=3300&&r.x<3310);assert.equal(r.y,GROUND_Y-CUBE);
});
test('Impossible landing never snaps a cube upward through a platform',()=>{
 const r=new Runner();r.x=2964;r.y=GROUND_Y-CUBE;r.grounded=false;r.vy=50;r.step(DT);assert.equal(r.state,'dead');
});
test('Burger idle economy misses targets, the board fires you, and reset starts over',()=>{
 // the fail path: do nothing → quarterly profit misses the rising targets → board patience collapses
 const s=new Sim();for(let i=0;i<400000&&!s.s.over;i++)s.tick(0.02);
 assert.equal(s.s.over,'board');assert.match(s.s.overReason,/FIRED/);assert.ok(s.s.quarter<=16);
 s.reset();assert.equal(s.s.cash,950);assert.equal(s.s.over,'');
});
test('Burger dirty levers raise backlash, disease and union heat — with real consequences',()=>{
 const clean=new Sim(),dirty=new Sim();
 dirty.act('farm',1);   // deforest a jungle plot
 dirty.act('hq',4);     // raze rainforest
 dirty.setFeed(2);      // swill: fast, filthy
 dirty.act('farm',6);   // hormones on
 dirty.act('hq',2);     // union-bust
 for(let i=0;i<300;i++){clean.tick(0.02);dirty.tick(0.02);}
 assert.ok(totalBacklash(dirty.s)>totalBacklash(clean.s)+40,'dirty play stacks backlash');
 assert.ok(dirty.s.backlash.cli>clean.s.backlash.cli,'rainforest razing hits climate column');
 assert.ok(dirty.s.backlash.uni>clean.s.backlash.uni,'union-busting angers the union');
 assert.ok(dirty.s.disease>clean.s.disease,'swill breeds disease');
 for(let i=0;i<400000&&!dirty.s.over;i++)dirty.tick(0.02);
 assert.ok(dirty.s.over,'an unmanaged dirty company still collapses');
 assert.match(dirty.s.overReason,/FIRED|SUSTAINED/);
});
test('Burger actions cannot spend unavailable resources or mutate a closed company',()=>{
 const s=new Sim();s.s.cash=0;const before=structuredClone(s.s);assert.equal(s.act('farm',1),null);assert.deepEqual(s.s,before);
 s.s.over='cash';assert.equal(s.act('farm',0),null);assert.equal(s.s.crops,before.crops);
});
test('Shared score storage survives invalid primitives and unavailable storage',()=>{
 for(const raw of ['null','{}','"oops"','-2','1e999','broken']){globalThis.localStorage={getItem:()=>raw};assert.equal(load('game','best',0),0);}
 globalThis.localStorage={getItem:()=>{throw Error('blocked');}};assert.equal(load('game','best',7),7);delete globalThis.localStorage;
});

const advancedTapes=[
[940,1340,1880,2950,3190,3380,4050,5090,5820,6440,7350,7590,7780,8450,9480,9890,11250,11490,11680],
[1050,1290,1480,2250,3180,3590,4250,5350,5590,5780,6350,6590,6780,7950,8590,9320,10650,10890,11080,11850,12780,13250,13490,13680]
];
for(let course=1;course<COURSES.length;course++)test(`Impossible ${COURSES[course].name} clears with discrete jumps at 60Hz input`,()=>{
 const r=new Runner();r.courseIndex=course;let next=0;for(let i=0;i<6000&&r.state==='running';i++){if(i%2===0&&r.x>=advancedTapes[course-1][next]){r.jump();next++;}r.step();}assert.equal(r.state,'clear');assert.equal(r.deaths,0);assert.equal(next,advancedTapes[course-1].length);
});
