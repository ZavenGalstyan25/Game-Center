'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},gameTimer=null,animId=null;
const ROWS=3,COLS=3,GAME_TIME=30;

function resize(){
  const area=document.querySelector('.game-area');
  const sz=Math.min(area.clientWidth-20,area.clientHeight-20,540);
  W=canvas.width=sz;H=canvas.height=sz;
}

function CS(){return W/COLS;}

function initGame(){
  G={
    holes:Array.from({length:ROWS*COLS},(_,i)=>({
      row:Math.floor(i/COLS),col:i%COLS,
      entity:null,showProgress:0,upProgress:0,alive:0,maxAlive:0
    })),
    score:0,lives:3,timeLeft:GAME_TIME,
    best:parseInt(localStorage.getItem('whack_best')||0),
    running:false,over:false,
    particles:[],hitFlash:[]
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function spawnEntity(){
  const empty=G.holes.filter(h=>!h.entity);
  if(!empty.length)return;
  const hole=empty[Math.floor(Math.random()*empty.length)];
  const isScientist=Math.random()<0.15;
  const isFast=!isScientist&&Math.random()<0.2;
  const maxAlive=(isFast?800:1200)+Math.random()*600;
  hole.entity={type:isScientist?'scientist':isFast?'fast':'zombie'};
  hole.upProgress=0;hole.alive=0;hole.maxAlive=maxAlive;hole.showProgress=0;
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('timeDisplay').textContent=G.timeLeft;
  document.getElementById('bestDisplay').textContent=G.best;
}

function whack(holeIdx){
  const h=G.holes[holeIdx];
  if(!h.entity||h.upProgress<0.6)return;
  const cs=CS();
  const cx=(h.col+0.5)*cs,cy=(h.row+0.5)*cs;
  if(h.entity.type==='scientist'){
    G.lives--;spawnHitEffect(cx,cy,'#3b82f6',false);
    if(G.lives<=0)endGame();
  } else {
    const pts=h.entity.type==='fast'?30:10;
    G.score+=pts;
    if(G.score>G.best){G.best=G.score;localStorage.setItem('whack_best',G.best);}
    spawnHitEffect(cx,cy,'#10b981',pts);
  }
  h.entity=null;h.upProgress=0;
  updateHUD();
}

function spawnHitEffect(x,y,color,pts){
  for(let i=0;i<10;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,life:1,color,size:3+Math.random()*3});
  if(pts)G.hitFlash.push({x,y,pts,life:1,color});
}

function update(dt){
  if(!G.running||G.over)return;
  const spawnChance=0.02+G.score/5000;
  if(Math.random()<spawnChance)spawnEntity();

  G.holes.forEach(h=>{
    if(!h.entity)return;
    h.alive+=dt;
    h.upProgress=Math.min(1,h.upProgress+dt/300);
    if(h.alive>=h.maxAlive){
      if(h.entity.type!=='scientist'&&h.upProgress>=0.6){
        G.lives--;
        if(G.lives<=0){endGame();return;}
        updateHUD();
      }
      h.entity=null;h.upProgress=0;
    }
  });
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.04;return p.life>0;});
  G.hitFlash=G.hitFlash.filter(f=>{f.life-=0.03;f.y-=1;return f.life>0;});
}

function drawHole(h){
  const cs=CS();
  const cx=(h.col+0.5)*cs,cy=(h.row+0.5)*cs;
  const r=cs*0.4;

  // Hole (dark ellipse)
  ctx.fillStyle='#080810';ctx.shadowBlur=0;
  ctx.beginPath();ctx.ellipse(cx,cy+r*0.5,r,r*0.35,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(16,185,129,.3)';ctx.lineWidth=2;ctx.stroke();

  if(!h.entity)return;
  const up=h.upProgress;
  const ent=h.entity;
  const clipY=cy+r*0.5-up*r*2.2;
  const emoji=ent.type==='scientist'?'🧑‍🔬':ent.type==='fast'?'💀':'🧟';
  const color=ent.type==='scientist'?'#3b82f6':ent.type==='fast'?'#ef4444':'#10b981';

  ctx.save();
  ctx.beginPath();ctx.ellipse(cx,cy+r*0.5,r*1.05,r*0.4,0,0,Math.PI*2);ctx.clip();

  ctx.shadowBlur=20;ctx.shadowColor=color;
  ctx.font=`${cs*0.55}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(emoji,cx,clipY+cs*0.28);
  ctx.shadowBlur=0;ctx.restore();

  // Glow ring when fully up
  if(up>0.9){
    const pulse=0.7+0.3*Math.sin(Date.now()/150);
    ctx.strokeStyle=`${color}${Math.round(pulse*200).toString(16).padStart(2,'0')}`;
    ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(cx,cy+r*0.5,r*1.2,r*0.45,0,0,Math.PI*2);ctx.stroke();
  }
}

let lastTs=0;
function draw(ts){
  const dt=ts-lastTs;lastTs=ts;
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  const cs=CS();

  // Ground
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const x=c*cs,y=r*cs;
    const grd=ctx.createLinearGradient(x,y,x+cs,y+cs);
    grd.addColorStop(0,'rgba(16,185,129,.06)');grd.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grd;ctx.fillRect(x,y,cs,cs);
    ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;ctx.strokeRect(x,y,cs,cs);
  }

  G.holes.forEach(h=>drawHole(h));

  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
  G.hitFlash.forEach(f=>{
    ctx.globalAlpha=f.life;ctx.fillStyle=f.color;
    ctx.font=`bold 20px "Exo 2",sans-serif`;ctx.textAlign='center';
    ctx.fillText(f.pts>0?'+'+f.pts:'💔',f.x,f.y);
    ctx.globalAlpha=1;ctx.textAlign='left';
  });

  if(G.running){update(dt);animId=requestAnimationFrame(draw);}
}

function endGame(){
  G.over=true;G.running=false;clearInterval(gameTimer);
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;
  gameTimer=setInterval(()=>{
    G.timeLeft--;document.getElementById('timeDisplay').textContent=G.timeLeft;
    if(G.timeLeft<=0)endGame();
  },1000);
  cancelAnimationFrame(animId);lastTs=performance.now();animId=requestAnimationFrame(draw);
}

canvas.addEventListener('click',e=>{
  if(!G.running)return;
  const rect=canvas.getBoundingClientRect();
  const cs=CS();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  G.holes.forEach((h,i)=>{
    const cx=(h.col+0.5)*cs,cy=(h.row+0.5)*cs;
    if(Math.hypot(mx-cx,my-cy)<cs*0.5)whack(i);
  });
});

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('restartBtn').addEventListener('click',startGame);
window.addEventListener('resize',()=>{resize();});

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
