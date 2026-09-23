import { Input, Sfx, load, save } from '@maga/arcade-core';
import { Runner, DT, LEVEL, LEVEL_END, COURSES } from './runner';
import { Scene } from './scene';
const cv=document.querySelector<HTMLCanvasElement>('canvas')!;
const ctx=cv.getContext('2d')!,overlay=document.getElementById('overlay')!;
const r=new Runner(),scene=new Scene(),input=new Input(),sfx=new Sfx();
input.attach(cv,(x,y)=>({x:x*960/cv.clientWidth,y:y*540/cv.clientHeight}));
input.setKeymaps({p1:{KeyZ:'fire',KeyR:'action'}});
let screen:'title'|'play'|'pause'|'clear'='title';
let best=Math.min(1,load('impossible','best-progress',0)),practiceBest=Math.min(1,load('impossible','practice-best',0));
let selectedCourse=0;
let unlocked=Math.max(1,Math.min(COURSES.length,Math.floor(load('impossible','unlocked',1))));
function readScores(key:string):number[]{const raw=load<unknown>('impossible',key,[]);return COURSES.map((_,i)=>Array.isArray(raw)&&typeof raw[i]==='number'&&Number.isFinite(raw[i])?Math.max(0,Math.min(1,raw[i])):0);}
const records=readScores('course-records'),practiceRecords=readScores('practice-records');records[0]=Math.max(records[0],best);practiceRecords[0]=Math.max(practiceRecords[0],practiceBest);
let acc=0,last=performance.now(),beat=-1;
const mute=document.getElementById('mute')!;
function paintMute():void{mute.textContent=sfx.muted?'Sound off':'Sound on';mute.setAttribute('aria-pressed',String(sfx.muted));}
mute.onclick=()=>{sfx.muted=!sfx.muted;paintMute();if(screen==='play')cv.focus();};paintMute();
document.getElementById('pause')!.onclick=()=>{if(screen==='play')show('pause');else if(screen==='pause')resume();};
function button(label:string,action:()=>void,secondary=false):HTMLButtonElement{
 const b=document.createElement('button');b.textContent=label;b.className=secondary?'secondary':'';b.onclick=action;return b;
}
function start(practice:boolean):void{r.courseIndex=selectedCourse;best=records[selectedCourse];practiceBest=practiceRecords[selectedCourse];r.practice=practice;r.reset(true);beat=-1;input.reset();screen='play';overlay.hidden=true;last=performance.now();acc=0;cv.focus();}
function resume():void{screen='play';overlay.hidden=true;last=performance.now();acc=0;input.reset();cv.focus();}
function show(next:'title'|'pause'|'clear'):void{
 screen=next;input.reset();overlay.hidden=false;overlay.replaceChildren();
 const panel=document.createElement('section');panel.className='panel';
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent=next==='clear'?'THE FINISH LINE IS YOURS':'PRECISION / RHYTHM / REPEAT';
 const title=document.createElement('h1');title.textContent=next==='title'?'The Impossible Game':next==='pause'?'Take a breath.':r.practice?'Practice complete.':'Impossible? Done.';
 const copy=document.createElement('p');copy.textContent=next==='title'?'One cube. One button. No room for doubt. Jump the gaps, clear the spikes, and make every attempt count.':next==='pause'?'Your run is right where you left it.':`${r.attempt} attempts · ${r.deaths} deaths · ${r.practice?'Checkpoint-assisted run':'Full course cleared'}`;
 panel.append(eyebrow,title,copy);
 if(next==='title'){
  const courses=document.createElement('div');courses.className='courses';
  COURSES.forEach((course,i)=>{const b=button(`${i+1}. ${course.name} · ${i>=unlocked?'LOCKED':records[i]===1?'CLEARED':course.subtitle}`,()=>{selectedCourse=i;r.courseIndex=i;show('title');},true);b.disabled=i>=unlocked;b.setAttribute('aria-pressed',String(selectedCourse===i));courses.append(b);});panel.append(courses);
 }
 const actions=document.createElement('div');actions.className='actions';
 if(next==='pause')actions.append(button('Resume',resume),button('Restart run',()=>start(r.practice),true));
 else actions.append(button(next==='clear'?'Run again':'Start run',()=>start(false)),button('Practice with checkpoints',()=>start(true),true));
 if(next==='clear'&&!r.practice&&selectedCourse<COURSES.length-1)actions.append(button('Next course',()=>{selectedCourse++;start(false);}));
 if(next!=='title')actions.append(button('Title screen',()=>show('title'),true));
 const help=document.createElement('small');help.textContent='SPACE / UP / Z / CLICK to jump · R restart · ESC pause';
 panel.append(actions,help);overlay.append(panel);
}
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&e.target.tagName==='BUTTON')return;if(e.code==='Enter'&&screen==='title')start(false);});
window.addEventListener('blur',()=>{if(screen==='play')show('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='play')show('pause');});
function update(dt:number):void{
 const event=r.step(dt);
 if(event==='jump')sfx.blip({freq:480,freqEnd:620,duration:.035,volume:.14});
 if(event==='death'){scene.burst(r);sfx.preset('death');}
 const progress=Math.min(1,r.x/r.course.end);
 if(r.practice)practiceBest=Math.max(practiceBest,progress);else best=Math.max(best,progress);
 if(event==='death'||event==='clear'){
  const scores=r.practice?practiceRecords:records;scores[selectedCourse]=r.practice?practiceBest:best;
  save('impossible',r.practice?'practice-records':'course-records',scores);
  if(selectedCourse===0)save('impossible',r.practice?'practice-best':'best-progress',r.practice?practiceBest:best);
  if(event==='clear'&&!r.practice){unlocked=Math.min(COURSES.length,Math.max(unlocked,selectedCourse+2));save('impossible','unlocked',unlocked);}
 }
 if(event==='clear'){sfx.preset('pickup');show('clear');}
 // The original synth score follows simulation time, including pause and retry.
 const nextBeat=Math.floor(r.time/.25);
 if(r.state==='running'&&nextBeat!==beat){beat=nextBeat;const notes=[130.81,0,196,0,164.81,0,196,146.83];const note=notes[beat%8];if(note)sfx.blip({wave:'triangle',freq:note,duration:.18,volume:.14});if(beat%4===0)sfx.blip({wave:'sine',freq:90,freqEnd:35,duration:.09,volume:.22});}
}
function frame(now:number):void{
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(input.wasPressed('pause')){if(screen==='play')show('pause');else if(screen==='pause')resume();}
 if(screen==='play'){
  if(input.wasPressed('fire')||input.wasPressed('up')||input.pointer.pressed)r.jump();
  if(input.wasPressed('action')){r.reset();beat=-1;}
  acc+=dt;while(acc>=DT&&screen==='play'){update(DT);acc-=DT;}
 }else acc=0;
 input.endFrame();scene.draw(ctx,r,screen==='play'?dt:0,r.practice?practiceBest:best);requestAnimationFrame(frame);
}
show('title');requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('debug'))Object.assign(window,{__maga:{runner:r,start,jump:()=>r.jump(),reset:()=>r.reset(),get state(){return r.state;},get screen(){return screen;},get x(){return r.x;},get y(){return r.y;},get progress(){return r.x/r.course.end;},get paused(){return screen==='pause';},LEVEL,LEVEL_END}});
