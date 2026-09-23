import { Runner, CUBE, GROUND_Y as G } from './runner';
const W = 960, H = 540;
interface Fragment { x: number; y: number; vx: number; vy: number; life: number; size: number }
export class Scene {
  private fragments: Fragment[] = [];
  private trail: { x: number; y: number; rot: number }[] = [];
  private flash = 0;
  private previousAttempt = 0;
  burst(r: Runner): void {
    this.flash = .22;
    for (let i=0;i<24;i++) this.fragments.push({x:r.x+17,y:r.y+17,vx:(Math.random()-.5)*500,vy:-Math.random()*450,life:.5+Math.random()*.4,size:3+Math.random()*7});
  }
  draw(c: CanvasRenderingContext2D, r: Runner, dt: number, best: number): void {
    this.flash=Math.max(0,this.flash-dt);
    if(this.previousAttempt!==r.attempt)this.trail=[];
    this.previousAttempt=r.attempt;
    const cam=r.x-220;
    const {obstacles:LEVEL,end:LEVEL_END,checkpoints:CHECKPOINTS}=r.course;
    const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,r.course.sky);bg.addColorStop(1,r.course.horizon);
    c.fillStyle=bg;c.fillRect(0,0,W,H);
    for(let layer=0;layer<2;layer++){
      c.fillStyle=layer?'#a49e8d22':'#9a8d7a18';
      for(let i=-1;i<15;i++){const x=i*100-((cam*(layer?.2:.1))%100);const h=50+((i*61+layer*79+1000)%120);c.fillRect(x,G-h,70,h);}
    }
    c.strokeStyle='#594d3620';c.lineWidth=1;
    for(let x=-(cam*.4%48);x<W;x+=48){c.beginPath();c.moveTo(x,88);c.lineTo(x,G);c.stroke();}
    c.save();c.translate(-cam,0);c.fillStyle='#252622';c.fillRect(cam,G,W,H-G);
    c.fillStyle='#faf3db';c.fillRect(cam,G,W,3);
    for(let x=Math.floor(cam/48)*48;x<cam+W;x+=48){c.fillStyle='#ffffff07';c.fillRect(x,G+5,1,H-G);}
    for(const [kind,x,w,h] of LEVEL){
      if(x+w<cam-30||x>cam+W+30)continue;
      if(kind==='gap'){
        c.fillStyle='#0e1113';c.fillRect(x,G,w,H-G);c.fillStyle='#f3a73b';
        for(let y=G;y<H;y+=18){c.fillRect(x,y,5,9);c.fillRect(x+w-5,y,5,9);}
      }else if(kind==='block'){
        c.fillStyle='#51616d';c.fillRect(x,G-h!,w,h!);c.fillStyle='#718a98';c.fillRect(x,G-h!,w,4);
        c.strokeStyle='#263139';c.lineWidth=2;c.strokeRect(x+1,G-h!+1,w-2,h!-2);
        c.fillStyle='#ffffff14';for(let xx=x+12;xx<x+w;xx+=20)c.fillRect(xx,G-h!+8,3,h!-15);
      }else{
        c.fillStyle='#252622';c.beginPath();c.moveTo(x,G);c.lineTo(x+w/2,G-34);c.lineTo(x+w,G);c.fill();
        c.strokeStyle='#ffdc95';c.lineWidth=1.5;c.beginPath();c.moveTo(x+2,G-2);c.lineTo(x+w/2,G-34);c.stroke();
      }
    }
    if(r.practice)for(const cp of CHECKPOINTS){c.fillStyle=cp<=r.checkpoint?'#358c62':'#857b68';c.fillRect(cp,G-65,3,65);c.beginPath();c.moveTo(cp,G-65);c.lineTo(cp+34,G-52);c.lineTo(cp,G-40);c.fill();}
    c.fillStyle='#358c62';c.fillRect(LEVEL_END,G-170,5,170);
    for(let y=0;y<5;y++)for(let x=0;x<8;x++){c.fillStyle=(x+y)%2?'#252622':'#f5efdf';c.fillRect(LEVEL_END+5+x*8,G-170+y*8,8,8);}
    if(r.state==='running'&&dt>0){this.trail.unshift({x:r.x,y:r.y,rot:r.rot});if(this.trail.length>7)this.trail.pop();}
    this.trail.forEach((p,i)=>{c.save();c.globalAlpha=.16*(1-i/7);c.translate(p.x+17,p.y+17);c.rotate(p.rot);c.fillStyle='#ef942a';c.fillRect(-17,-17,34,34);c.restore();});
    if(r.state!=='dead'){
      c.save();c.translate(r.x+17,r.y+17);c.rotate(r.rot);
      const cube=c.createLinearGradient(-17,-17,17,17);cube.addColorStop(0,'#ffd06b');cube.addColorStop(1,'#e37b12');
      c.fillStyle=cube;c.fillRect(-17,-17,CUBE,CUBE);c.strokeStyle='#754719';c.lineWidth=2.5;c.strokeRect(-17,-17,CUBE,CUBE);
      c.fillStyle='#fff5d8aa';c.fillRect(-12,-12,8,5);c.restore();
    }
    for(const p of this.fragments){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=1600*dt;c.globalAlpha=Math.max(0,p.life);c.fillStyle='#e67d19';c.fillRect(p.x,p.y,p.size,p.size);}
    c.globalAlpha=1;this.fragments=this.fragments.filter(p=>p.life>0);c.restore();
    if(this.flash){c.fillStyle=`rgba(190,50,20,${this.flash*.6})`;c.fillRect(0,0,W,H);}
    c.fillStyle='#272a26';c.font='bold 15px monospace';c.fillText(`${r.course.name.toUpperCase()} / ${r.practice?'PRACTICE':'NORMAL'}`,26,32);
    c.font='13px monospace';c.fillStyle='#655e50';c.fillText(`ATTEMPT ${String(r.attempt).padStart(2,'0')}   BEST ${Math.floor(best*100)}%`,26,54);
    const progress=Math.min(1,r.x/LEVEL_END);
    c.textAlign='right';c.font='bold 34px monospace';c.fillStyle='#272a26';c.fillText(`${Math.floor(progress*100)}%`,934,44);c.textAlign='left';
    c.fillStyle='#272a2622';c.fillRect(26,70,908,4);c.fillStyle='#df8721';c.fillRect(26,70,908*progress,4);
    c.fillStyle='#ddd4bf';c.font='13px monospace';c.fillText('SPACE / UP / Z / TAP   JUMP',26,H-24);c.textAlign='right';c.fillText('R  RESTART     ESC  PAUSE',934,H-24);c.textAlign='left';
  }
}
