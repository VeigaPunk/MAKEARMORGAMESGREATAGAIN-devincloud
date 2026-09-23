import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const url = process.env.BOXHEAD_URL ?? 'http://127.0.0.1:5173/?debug';

async function withGame(run, options = {}) {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  const page = await browser.newPage({ viewport:{width:1280,height:800}, ...options });
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  await page.goto(url); await page.waitForFunction(()=>window.__maga);
  await run(page); assert.deepEqual(errors, []);
 } finally { await browser.close(); }
}

for (const mode of ['solo','coop','deathmatch']) test(`${mode}: complete its score loop through movement and ordinary weapon inputs`, async()=>withGame(async page=>{
 const result=await page.evaluate(mode=>{
  const {game:g}=window.__maga;
  g.app.ticker.stop(); g.sfx.muted=true;
  let seed=42;Math.random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  let elapsed=0;const originalNow=performance.now.bind(performance);
  Object.defineProperty(performance,'now',{configurable:true,value:()=>elapsed*1000});
  g.mode=mode;g.startRun(0);
  let axes=[{x:0,y:0},{x:0,y:0}],aim2={x:1,y:0},ceaseFire=false;
  g.input.isDown=a=>a==='fire'&&!ceaseFire;g.input.wasPressed=()=>false;
  g.input.pointer.seen=true;g.input.pointer.active=false;
  g.input.moveAxis=()=>axes[0];g.input.moveAxis2=()=>axes[1];g.input.fireAxis2=()=>ceaseFire?null:aim2;
  let collected=0,lastAmmo=24,reached=1;
  ceaseFire=false;
  const blocked=(a,b)=>g.room.obstacles.some(o=>{
   const r={x:o.x-10,y:o.y-12,w:o.w+20,h:o.h+24};
   const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5);
   for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;if(x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)return true;}
   return false;
  });
  const route=(p,goal)=>{
   if(!blocked(p,goal))return goal;
   const nodes=[p,goal,...g.room.obstacles.flatMap(o=>[{x:o.x-18,y:o.y-20},{x:o.x+o.w+18,y:o.y-20},{x:o.x-18,y:o.y+o.h+20},{x:o.x+o.w+18,y:o.y+o.h+20}])];
   const ds=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),seen=new Set();ds[0]=0;
   for(let it=0;it<nodes.length;it++){
    let best=-1;for(let n=0;n<nodes.length;n++)if(!seen.has(n)&&(best<0||ds[n]<ds[best]))best=n;
    if(best<0||!Number.isFinite(ds[best])||best===1)break;seen.add(best);
    for(let n=1;n<nodes.length;n++)if(!seen.has(n)&&!blocked(nodes[best],nodes[n])){
     const d=ds[best]+Math.hypot(nodes[n].x-nodes[best].x,nodes[n].y-nodes[best].y);if(d<ds[n]){ds[n]=d;prev[n]=best;}
    }
   }
   let n=1;while(prev[n]>0)n=prev[n];return prev[n]===0?nodes[n]:goal;
  };
  let previous=g.slots.map(s=>({...s.p.pos}));
  for(;elapsed<(mode==='deathmatch'?900:480)&&g.state==='playing';elapsed+=1/60){
   for(let idx=0;idx<g.slots.length;idx++){
    const slot=g.slots[idx];if(!slot.alive)continue;
    const p=slot.p.pos;
    let target=mode==='deathmatch'?g.slots[1-idx].p.pos:g.nearestZombie(p)?.pos;
    if(mode==='deathmatch'&&target){const t=Math.hypot(target.x-p.x,target.y-p.y)/340;const old=previous[1-idx];target={x:target.x+(target.x-old.x)*60*t,y:target.y+(target.y-old.y)*60*t};}
    if(target){
     if(idx===0){g.input.pointer.x=target.x;g.input.pointer.y=target.y;}
     else {const d=Math.hypot(target.x-p.x,target.y-p.y)||1;aim2={x:(target.x-p.x)/d,y:(target.y-p.y)/d};}
    }
    let tx=320+Math.cos(elapsed*.35+idx*Math.PI)*140,ty=220+Math.sin(elapsed*.35+idx*Math.PI)*115;
    if(mode!=='deathmatch'&&target&&g.zombies.length<=2&&g.spawnQueue===0){tx=target.x;ty=target.y;}
    if(slot.p.ammo<12&&g.crates.length){
     const crate=[...g.crates].sort((a,b)=>Math.hypot(a.pos.x-p.x,a.pos.y-p.y)-Math.hypot(b.pos.x-p.x,b.pos.y-p.y))[0];tx=crate.pos.x;ty=crate.pos.y;
    }
    const next=route(p,{x:tx,y:ty});
    let dx=(next.x-p.x)/60,dy=(next.y-p.y)/60;
    for(const z of g.zombies){const zx=p.x-z.pos.x,zy=p.y-z.pos.y,d=Math.hypot(zx,zy);if(d<65){dx+=zx/(d||1)*(65-d)/15;dy+=zy/(d||1)*(65-d)/15;}}

    const d=Math.hypot(dx,dy)||1;axes[idx]={x:dx/d,y:dy/d};
   }
   reached=Math.max(reached,g.wave);
   if(mode!=='deathmatch'&&reached>=7){ceaseFire=true;axes=[{x:0,y:0},{x:0,y:0}];}
   previous=g.slots.map(s=>({...s.p.pos}));
   g.tick(1/60);
   if(g.player.ammo>lastAmmo)collected++;lastAmmo=g.player.ammo;
  }
  Object.defineProperty(performance,'now',{configurable:true,value:originalNow});
  return{state:g.state,wave:g.wave,reached,high:g.high,score:g.scoreSys.score,hp:g.slots.map(s=>s.p.hp),kills:g.slots.map(s=>s.kills),elapsed,collected};
 },mode);
 if(mode==='deathmatch') {assert.equal(result.state,'victory',JSON.stringify(result));assert.ok(result.kills.some(k=>k===5)); assert.ok(result.collected>0);}
 else {assert.equal(result.state,'dead',JSON.stringify(result));assert.ok(result.reached>=7,JSON.stringify(result));assert.ok(result.score>=2800);assert.equal(result.high,result.score);
  const retry=await page.evaluate(()=>{const g=window.__maga.game;g.startRun(0);return{wave:g.wave,score:g.scoreSys.score,hp:g.player.hp,state:g.state};});assert.deepEqual(retry,{wave:1,score:0,hp:100,state:'playing'});}
 console.log(mode,JSON.stringify(result));
}));

test('menu, pause and retry clear the battlefield and banners', async()=>withGame(async page=>{
 await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__maga.game.state==='mode');
 await page.keyboard.press('Digit2');await page.waitForFunction(()=>window.__maga.game.state==='room');
 await page.keyboard.press('Digit2');await page.waitForFunction(()=>window.__maga.game.state==='playing');
 assert.equal(await page.evaluate(()=>window.__maga.game.slots.length),2);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__maga.game.state==='paused');
 const before=await page.evaluate(()=>window.__maga.game.player.pos);await page.waitForTimeout(100);
 assert.deepEqual(await page.evaluate(()=>window.__maga.game.player.pos),before);
 await page.keyboard.press('KeyM');await page.waitForFunction(()=>window.__maga.game.state==='mode');
 assert.deepEqual(await page.evaluate(()=>({world:window.__maga.game.world.visible,hud:window.__maga.game.hud.visible,banner:window.__maga.game.banner.text})),{world:false,hud:false,banner:''});
}));

test('contact bursts, death and high score persistence use the real damage path', async()=>withGame(async page=>{
 const result=await page.evaluate(()=>{
  const {game:g}=window.__maga;g.app.ticker.stop();g.sfx.muted=true;g.startRun(0);
  let now=0;const originalNow=performance.now.bind(performance);Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
  g.spawnZombie(false,0);const z=g.zombies[0];z.pos={...g.player.pos};
  g.scoreSys.score=1700;
  for(let i=0;i<100;i++)g.tick(1);
  const burstHp=g.player.hp;
  for(let i=0;i<12&&g.state==='playing';i++){now+=801;z.pos={...g.player.pos};g.tick(1/60);}
  const state=g.state,high=g.high;
  g.startRun(0);const retry={hp:g.player.hp,score:g.scoreSys.score,banner:g.banner.text};
  Object.defineProperty(performance,'now',{configurable:true,value:originalNow});
  return{burstHp,state,high,retry};
 });
 assert.equal(result.burstHp,90);assert.equal(result.state,'dead');assert.equal(result.high,1700);
 assert.deepEqual(result.retry,{hp:100,score:0,banner:''});
 await page.reload();await page.waitForFunction(()=>window.__maga);
 assert.equal(await page.evaluate(()=>window.__maga.game.high),1700);
}));

test('toolbar restores game focus so Space still fires',async()=>withGame(async page=>{
 await page.evaluate(()=>window.__maga.game.startRun(0));
 await page.locator('#mute').click();assert.equal(await page.evaluate(()=>document.activeElement.tagName),'CANVAS');
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.__maga.game.player.ammo<24);await page.keyboard.up('Space');
 await page.locator('#pause').click();await page.waitForFunction(()=>window.__maga.game.state==='paused');
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__maga.game.state==='playing');
}));


test('portrait touch fire releases outside canvas and clears on blur',async()=>withGame(async page=>{
 await page.evaluate(()=>window.__maga.game.startRun(0));await page.waitForTimeout(50);
 const result=await page.evaluate(()=>{
  const {game,touch}=window.__maga,canvas=document.querySelector('canvas'),rect=canvas.getBoundingClientRect(),scale=rect.width/640,h=touch.fireHome();
  const down=()=>canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,pointerType:'touch',clientX:rect.x+h.x*scale,clientY:rect.y+h.y*scale,bubbles:true}));
  down();const held=touch.fire;window.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,pointerType:'touch'}));const released=!touch.fire;
  down();window.dispatchEvent(new Event('blur'));
  return{held,released,cleared:!touch.fire&&touch.stick===null,paused:game.state==='paused',width:touch.fireRadius()*2*scale};
 });
 assert.equal(result.held,true);assert.equal(result.released,true);assert.equal(result.cleared,true);assert.equal(result.paused,true);assert.ok(result.width>=43.99);
},{viewport:{width:390,height:844},isMobile:true,hasTouch:true}));
