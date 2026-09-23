import { Sfx, load, save } from '@maga/arcade-core';
import { Sim, PANES, type SimState, type PaneKey } from './sim';
import { createScene } from './scenes.js';
const sim=new Sim(),sfx=new Sfx();
let best=load('burger-tycoon','best-time',0),pane=0,paused=true,started=false,last=performance.now(),saveAt=0,paintAt=0;
const dashboard=document.getElementById('dashboard')!,hud=document.getElementById('hud')!,tabs=document.getElementById('tabs')!,log=document.getElementById('log')!,overlay=document.getElementById('overlay')!,pauseBtn=document.getElementById('pause')!,mute=document.getElementById('mute')!;
const titles=['Farmland','Feedlot','Restaurant','Headquarters'];
const subtitles=['Grow the supply. Count the cost.','From pasture to patty.','Keep the line moving.','Make the numbers look good.'];
const descriptions=[['Plant soy','Buy cattle','Clear rainforest'],['Emergency slaughter','Use cheap feed'],['Run a promotion','Cut corners'],['Marketing campaign','PR spin','Bribe officials']];
const costs=[[0,80,0],[0,0],[40,0],[120,100,200]];
const dirtyFlags:Partial<Record<PaneKey,keyof SimState['dirty']>>={farm:'deforest',feed:'cheapFeed',rest:'cutCorners'};
function validRun(value:unknown):value is SimState{
 if(!value||typeof value!=='object')return false;const s=value as SimState;
 const numeric=['cash','rep','backlash','crops','cattle','patties','demand','boardPressure','disease','t','lastProfit'] as const;
 return numeric.every(k=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=0&&s[k]<1e9)&&s.rep<=100&&s.backlash<=100&&s.demand<=3&&s.dirty&&Object.values(s.dirty).length===3&&['deforest','cheapFeed','cutCorners'].every(k=>s.dirty[k as keyof SimState['dirty']]===0||s.dirty[k as keyof SimState['dirty']]===1)&&s.over===false;
}
const saved=load<unknown>('burger-tycoon','run',null);const hasSave=validRun(saved);
if(hasSave){sim.s={...saved,rates:{...sim.s.rates},overReason:''};sim.log('Operations restored.');}else sim.reset();
const cards=PANES.map((p,i)=>{
 const card=document.createElement('section');card.className='operation';card.dataset.pane=String(i);
 const heading=document.createElement('div');heading.className='operation-heading';
 const num=document.createElement('span');num.className='number';num.textContent=`0${i+1}`;
 const title=document.createElement('h2');title.textContent=titles[i];
 const subtitle=document.createElement('p');subtitle.textContent=subtitles[i];heading.append(num,title,subtitle);
 const canvas=document.createElement('canvas');canvas.width=656;canvas.height=300;canvas.setAttribute('aria-label',`${titles[i]} operations scene`);
 const metrics=document.createElement('div');metrics.className='metrics';
 const actions=document.createElement('div');actions.className='operation-actions';
 const buttons=sim.actions[p.key].map((a,j)=>{
  const b=document.createElement('button');b.className=a.dirty?'dirty':'';
  const name=document.createElement('strong');name.textContent=descriptions[i][j];
  const detail=document.createElement('small');detail.textContent=a.label.replace(/^DIRTY: /,'').match(/\((.*)\)/)?.[1]??a.label;
  b.append(name,detail);b.onclick=()=>{if(paused||sim.s.over)return;const result=sim.act(p.key,j);if(result){sfx.preset('ui');persist();paint();}else toast('Resources unavailable. Check your cash or cattle.');};actions.append(b);return b;
 });
 card.append(heading,canvas,metrics,actions);dashboard.append(card);
 const tab=document.createElement('button');tab.textContent=`${i+1} ${titles[i]}`;tab.onclick=()=>setPane(i);tabs.append(tab);
 return{card,canvas,draw:createScene(canvas.getContext('2d')!),metrics,buttons,key:p.key};
});
function setPane(i:number):void{pane=i;cards.forEach((c,n)=>c.card.classList.toggle('selected',n===i));[...tabs.children].forEach((b,n)=>{b.classList.toggle('selected',n===i);b.setAttribute('aria-pressed',String(n===i));});}
function toast(message:string):void{document.getElementById('toast')!.textContent=message;}
function persist():void{if(!sim.s.over)save('burger-tycoon','run',sim.s);else save('burger-tycoon','run',null);save('burger-tycoon','best-time',best);}
function sound():void{mute.textContent=sfx.muted?'Sound off':'Sound on';mute.setAttribute('aria-pressed',String(sfx.muted));}mute.onclick=()=>{sfx.muted=!sfx.muted;sound();};sound();
function begin(fresh=false):void{if(fresh)sim.reset();started=true;paused=false;overlay.hidden=true;pauseBtn.textContent='Pause';last=performance.now();sfx.startMusic([196,0,0,147,0,0,165,0,196,0,0,131,0,0,0,0],320,{volume:.12});paint();}
function panel(title:string,copy:string,buttons:{label:string;fn:()=>void}[]):void{
 overlay.hidden=false;overlay.replaceChildren();const box=document.createElement('section');box.className='dialog';
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent='BURGER TYCOON / ANNUAL REPORT';const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.textContent=copy;
 box.append(eyebrow,h,p);for(const action of buttons){const b=document.createElement('button');b.textContent=action.label;b.onclick=action.fn;box.append(b);}overlay.append(box);
}
function pause():void{if(!started||sim.s.over)return;paused=true;sfx.stopMusic();persist();pauseBtn.textContent='Resume';panel('Meeting adjourned.','The entire operation is paused. Your progress is saved.',[{label:'Resume operations',fn:()=>begin()},{label:'Start a new company',fn:()=>confirmRestart()}]);}
function confirmRestart():void{panel('Close this company?','Starting again replaces this run. Your best survival record is kept.',[{label:'Keep this company',fn:()=>begin()},{label:'Start fresh',fn:()=>begin(true)}]);}
pauseBtn.onclick=()=>{if(paused&&started)begin();else pause();};
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable))return;if(/^[1-4]$/.test(e.key))setPane(Number(e.key)-1);if(e.key==='Escape'){if(paused&&started&&!sim.s.over)begin();else pause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!paused)pause();});
window.addEventListener('pagehide',persist);
const metric=(label:string,value:number,max:number,color:string)=>`<label>${label}<b>${value.toFixed(0)}</b><progress max="${max}" value="${value}" style="accent-color:${color}"></progress></label>`;
function paint():void{
 const s=sim.s;
 hud.innerHTML=`<span>CASH<b>$${s.cash.toFixed(0)}</b></span><span>REPUTATION<b>${s.rep.toFixed(0)}%</b></span><span>NET / SEC<b class="${s.lastProfit<s.rates.overhead?'loss':''}">${s.lastProfit>=s.rates.overhead?'+':''}$${(s.lastProfit-s.rates.overhead).toFixed(1)}</b></span><span>SURVIVED<b>${Math.floor(s.t/60)}:${String(Math.floor(s.t%60)).padStart(2,'0')}</b></span><span>BEST<b>${Math.floor(best/60)}:${String(Math.floor(best%60)).padStart(2,'0')}</b></span>`;
 cards[0].metrics.innerHTML=metric('Crops',s.crops,100,'#70934e')+metric('Cattle',s.cattle,50,'#a47950');
 cards[1].metrics.innerHTML=metric('Patties',s.patties,60,'#ba7851')+metric('Disease',s.disease,20,'#b35642');
 cards[2].metrics.innerHTML=metric('Patty stock',s.patties,60,'#ba7851')+metric('Demand ×10',s.demand*10,30,'#648e94');
 cards[3].metrics.innerHTML=metric('Backlash',s.backlash,100,'#b35642')+metric('Board pressure',s.boardPressure,100,'#bd8a3d');
 cards.forEach((c,i)=>c.buttons.forEach((b,j)=>{b.disabled=paused||s.over||s.cash<costs[i][j]||(i===1&&j===0&&s.cattle<2)||(i===2&&j===0&&s.demand>=3)||(i===3&&j===0&&s.demand>=3)||(i===3&&j===1&&s.backlash===0);const flag=dirtyFlags[c.key];if(sim.actions[c.key][j].dirty&&flag){const on=!!s.dirty[flag];b.setAttribute('aria-pressed',String(on));b.classList.toggle('engaged',on);}}));
 log.replaceChildren(...sim.events.slice(0,4).map(event=>{const li=document.createElement('li');li.textContent=event;return li;}));
}
let previousBacklash=0;
function frame(now:number):void{
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(!paused&&!sim.s.over){sim.tick(dt);best=Math.max(best,sim.s.t);if(sim.s.backlash>60&&previousBacklash<=60)sfx.preset('hit');previousBacklash=sim.s.backlash;if(sim.s.over){persist();sfx.stopMusic();sfx.preset('death');panel(sim.s.cash<=0?'The board has spoken.':'The public has spoken.',`${sim.s.overReason}. Survived ${Math.floor(sim.s.t)} seconds. Every shortcut has a cost.`,[{label:'Build another company',fn:()=>begin(true)}]);}if(now-saveAt>2000){persist();saveAt=now;}}
 if(now-paintAt>150){paint();paintAt=now;}
 cards.forEach((c,i)=>{if(innerWidth>720||pane===i)c.draw(sim.s,i,c.canvas.width,c.canvas.height);});requestAnimationFrame(frame);
}
setPane(0);paint();panel('Profit is only half the story.','Run four operations in one fragile economy. Grow crops, feed cattle, sell burgers, and keep the board happy. Shortcuts increase output — and the backlash that can shut you down.',[{label:hasSave?'Continue company':'Open for business',fn:()=>begin()},...(hasSave?[{label:'Start a new company',fn:()=>confirmRestart()}]:[])]);requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('debug'))Object.assign(window,{__maga:{sim,setPane,begin,pause,get paused(){return paused;},validRun}});
