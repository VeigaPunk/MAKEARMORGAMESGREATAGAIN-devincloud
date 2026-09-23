import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

for (const [pack, port] of [['replica',5176],['cluck',5177]]) {
 test(`${pack}: desktop controls, toolbar focus, named boss and result rendering`, async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
  try {
   const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${process.env.ARCADE_URL ? process.env.ARCADE_URL + (pack === 'replica' ? '/chicken-invaders/' : '/chicken-invaders-original/') : `http://127.0.0.1:${port}/`}?debug`);await page.waitForFunction(()=>window.__maga);
   await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__maga.sim.mode==='play');
   await page.locator('#mute').click();assert.equal(await page.evaluate(()=>document.activeElement.tagName),'CANVAS');
   await page.keyboard.down('Space');await page.waitForFunction(()=>window.__maga.sim.bullets.length>0);await page.keyboard.up('Space');
   await page.locator('#pause').click();await page.waitForFunction(()=>window.__maga.sim.paused);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__maga.sim.paused);
   const canvas=await page.locator('canvas').boundingBox();
   await page.mouse.move(canvas.x+120,canvas.y+400);await page.mouse.down();await page.mouse.move(canvas.x+180,canvas.y+400);
   assert.equal(await page.evaluate(()=>window.__maga.touch.drag),null,'desktop mouse must not become the touch stick');await page.mouse.up();
   const missiles=await page.evaluate(()=>window.__maga.sim.missileN);
   await page.mouse.click(canvas.x+canvas.width*.75,canvas.y+canvas.height*.75,{button:'right'});
   await page.waitForFunction(n=>window.__maga.sim.missileN===n-1,missiles);
   const boss=await page.evaluate(()=>{
    const {sim,renderer,app}=window.__maga;app.ticker.stop();sim.chickens=[];sim.waveIdx=sim.wavesTotal-1;sim.step(1/120);renderer.draw();
    const label=renderer.bossLabel.text;const wave=sim.snapshot().wave;
    for(let i=0;i<120;i++)sim.step(1/120);sim.boss.hp=1;sim.bullets=[{x:sim.boss.x,y:sim.boss.y,vx:0,vy:0}];sim.step(1/120);renderer.draw();
    return{label,wave,banner:renderer.bannerText.text,mode:sim.mode,eggs:sim.eggs.length};
   });
   assert.equal(boss.label,pack==='cluck'?'MOTHER GOOSE':'BIG HEN');assert.equal(boss.wave,3);assert.equal(boss.mode,'clear');assert.equal(boss.eggs,0);assert.match(boss.banner,/SECTOR 1 SECURED/);
   if (pack === 'replica') {
    const bounds=await page.evaluate(()=>{
     const {renderer}=window.__maga;
     const probe=(boss,k)=>{renderer.field.clear();renderer.drawBird(400,220,k,boss?0:2,boss);const b=renderer.field.getLocalBounds();return{x:b.x,y:b.y,width:b.width,height:b.height};};
     const result={bird:probe(false,1),boss:probe(true,3.2)};renderer.draw();return result;
    });
    assert.ok(bounds.bird.x>370&&bounds.bird.y>185,JSON.stringify(bounds));
    assert.ok(bounds.bird.width<60&&bounds.bird.height<60,JSON.stringify(bounds));
    assert.ok(bounds.boss.x>300&&bounds.boss.y>120,JSON.stringify(bounds));
   }
   assert.deepEqual(errors,[]);
  } finally {await browser.close();}
 });
 test(`${pack}: portrait touch release, blur, and 44px fire targets`,async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
  try {
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await page.goto(`${process.env.ARCADE_URL ? process.env.ARCADE_URL + (pack === 'replica' ? '/chicken-invaders/' : '/chicken-invaders-original/') : `http://127.0.0.1:${port}/`}?debug`);await page.waitForFunction(()=>window.__maga);
   await page.evaluate(()=>window.__maga.sim.startGame(1));await page.waitForTimeout(40);
   const result=await page.evaluate(()=>{
    const {touch,sim}=window.__maga,canvas=document.querySelector('canvas'),rect=canvas.getBoundingClientRect(),scale=rect.width/960;
    const h=touch.fireHome();canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,pointerType:'touch',clientX:rect.left+h.x*scale,clientY:rect.top+h.y*scale,bubbles:true}));
    const held=touch.fire;window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,pointerType:'touch'}));const released=!touch.fire;
    canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:8,pointerType:'touch',clientX:rect.left+200*scale,clientY:rect.top+420*scale,bubbles:true}));
    window.dispatchEvent(new Event('blur'));
    return{held,released,diameter:touch.fireRadius()*2*scale,stopped:touch.drag===null,paused:sim.paused,canvasFits:rect.x>=0&&rect.right<=390};
   });
   assert.equal(result.held,true);assert.equal(result.released,true);assert.equal(result.stopped,true);assert.equal(result.paused,true);assert.equal(result.canvasFits,true);assert.ok(result.diameter>=43.99);
  } finally {await browser.close();}
 });
}
