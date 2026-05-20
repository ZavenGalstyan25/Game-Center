'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,keys={};
function S(){return Math.min(W/800,H/600);}

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function initGame(){
  const s=S();
  G={
    p1:{x:20*s,y:H/2,w:14*s,h:80*s,vy:0,score:0,speed:6*s},
    p2:{x:W-34*s,y:H/2,w:14*s,h:80*s,vy:0,score:0,speed:5*s},
    ball:{x:W/2,y:H/2,vx:5*s*(Math.random()<0.5?1:-1),vy:(Math.random()-.5)*6*s,r:8*s},
    powerup:null,powerupTimer:0,particles:[],trail:[],
    running:false,paused:false,over:false,
    rallyCnt:0,serveDelay:0
  };
}

function spawnPowerup(){
  const types=['speed','shrink','grow','multiball'];
  G.powerup={x:W/4+Math.random()*W/2,y:H*0.2+Math.random()*H*0.6,
    type:types[Math.floor(Math.random()*types.length)],r:14*S(),life:300};
}

function resetBall(dir){
  const s=S();
  G.ball.x=W/2;G.ball.y=H/2;
  G.ball.vx=(5+Math.random()*2)*s*(dir||1);
  G.ball.vy=(Math.random()-.5)*6*s;
  G.rallyCnt=0;G.serveDelay=60;
}

function cpuAI(){
  const p2=G.p2,b=G.ball,s=S();
  const diff=Math.min(0.07+G.rallyCnt*0.005,0.14);
  const targetY=b.y-(p2.h/2);
  p2.y+=(targetY-p2.y)*diff;
  p2.y=Math.max(0,Math.min(H-p2.h,p2.y));
}

function update(){
  if(G.serveDelay>0){G.serveDelay--;return;}
  const b=G.ball,s=S();

  // Player
  const p1=G.p1;
  if(keys['KeyW']||keys['ArrowUp'])p1.y-=p1.speed;
  if(keys['KeyS']||keys['ArrowDown'])p1.y+=p1.speed;
  p1.y=Math.max(0,Math.min(H-p1.h,p1.y));

  cpuAI();

  // Ball move
  b.x+=b.vx;b.y+=b.vy;

  // Wall bounce
  if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy);}
  if(b.y+b.r>H){b.y=H-b.r;b.vy=-Math.abs(b.vy);}

  // Trail
  G.trail.push({x:b.x,y:b.y,life:1});
  if(G.trail.length>20)G.trail.shift();

  // Paddle collisions
  const pads=[{p:G.p1,xEdge:p1.x+p1.w},{p:G.p2,xEdge:G.p2.x}];
  pads.forEach(({p,xEdge})=>{
    if(b.x-b.r<p.x+p.w&&b.x+b.r>p.x&&b.y+b.r>p.y&&b.y-b.r<p.y+p.h){
      const relY=(b.y-(p.y+p.h/2))/(p.h/2);
      const spd=Math.min(14*s,Math.hypot(b.vx,b.vy)*1.05);
      const ang=relY*0.7;
      b.vx=(xEdge===p.x+p.w?1:-1)*spd*Math.cos(ang);
      b.vy=spd*Math.sin(ang);
      G.rallyCnt++;
      for(let i=0;i<8;i++)G.particles.push({x:b.x,y:b.y,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,life:1,color:'#00d4ff',size:2+Math.random()*2});
    }
  });

  // Powerup
  if(G.powerup){
    G.powerup.life--;
    if(G.powerup.life<=0){G.powerup=null;G.powerupTimer=0;}
    else if(Math.hypot(b.x-G.powerup.x,b.y-G.powerup.y)<b.r+G.powerup.r){
      applyPowerup();G.powerup=null;
    }
  } else {
    G.powerupTimer++;
    if(G.powerupTimer>300){G.powerupTimer=0;spawnPowerup();}
  }

  // Scoring
  if(b.x-b.r<0){G.p2.score++;updateHUD();checkWin();resetBall(1);}
  if(b.x+b.r>W){G.p1.score++;updateHUD();checkWin();resetBall(-1);}

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.04;return p.life>0;});
  G.trail.forEach(t=>t.life-=0.06);
  G.trail=G.trail.filter(t=>t.life>0);
}

function applyPowerup(){
  const t=G.powerup.type,s=S();
  if(t==='speed'){G.ball.vx*=1.4;G.ball.vy*=1.4;}
  else if(t==='grow'){G.p1.h=Math.min(H*0.5,G.p1.h*1.3);}
  else if(t==='shrink'){G.p2.h=Math.max(30*s,G.p2.h*0.7);}
  for(let i=0;i<15;i++)G.particles.push({x:G.powerup.x,y:G.powerup.y,
    vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,life:1,color:'#f59e0b',size:3});
}

function updateHUD(){
  document.getElementById('p1Score').textContent=G.p1.score;
  document.getElementById('p2Score').textContent=G.p2.score;
}

function checkWin(){
  if(G.p1.score>=7||G.p2.score>=7){
    G.over=true;G.running=false;
    const won=G.p1.score>=7;
    document.getElementById('winEmoji').textContent=won?'🏆':'💀';
    document.getElementById('winText').textContent=won?'YOU WIN!':'CPU WINS!';
    document.getElementById('winOverlay').classList.remove('hidden');
  }
}

function drawPaddle(p,color,glow){
  ctx.shadowBlur=16;ctx.shadowColor=glow||color;ctx.fillStyle=color;
  ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,4);ctx.fill();ctx.shadowBlur=0;
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  const s=S();
  // Center line
  ctx.setLineDash([10*s,8*s]);ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=2*s;
  ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);

  // Trail
  G.trail.forEach((t,i)=>{
    ctx.globalAlpha=t.life*0.5;ctx.fillStyle='#00d4ff';ctx.shadowBlur=6;ctx.shadowColor='#00d4ff';
    ctx.beginPath();ctx.arc(t.x,t.y,G.ball.r*(i/G.trail.length),0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });

  // Ball
  const b=G.ball;
  ctx.shadowBlur=20;ctx.shadowColor='#00d4ff';ctx.fillStyle='#00d4ff';
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

  // Paddles
  drawPaddle(G.p1,'#00d4ff','rgba(0,212,255,.6)');
  drawPaddle(G.p2,'#a855f7','rgba(168,85,247,.6)');

  // Powerup
  if(G.powerup){
    const pu=G.powerup;
    const pulse=0.85+0.15*Math.sin(Date.now()/150);
    ctx.shadowBlur=16;ctx.shadowColor='#f59e0b';ctx.fillStyle='#f59e0b';
    ctx.globalAlpha=pu.life/300;
    ctx.beginPath();ctx.arc(pu.x,pu.y,pu.r*pulse,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    ctx.fillStyle='#fff';ctx.font=`bold ${pu.r*1.2}px "Exo 2",sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const icons={speed:'⚡',grow:'⬆',shrink:'⬇',multiball:'×2'};
    ctx.fillText(icons[pu.type]||'?',pu.x,pu.y);
    ctx.textBaseline='alphabetic';ctx.textAlign='left';
  }

  // Particles
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });

  // Score display on canvas
  ctx.fillStyle='rgba(255,255,255,.15)';ctx.font=`bold ${80*s}px "Exo 2",sans-serif`;
  ctx.textAlign='center';
  ctx.fillText(G.p1.score,W/4,H*0.4);
  ctx.fillText(G.p2.score,W*3/4,H*0.4);
  ctx.textAlign='left';
}

function gameLoop(){
  if(!G.running)return;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('winOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

function pause(){
  if(G.over)return;
  if(G.paused){G.paused=false;G.running=true;document.getElementById('pauseOverlay').classList.add('hidden');
    animId=requestAnimationFrame(gameLoop);}
  else{G.paused=true;G.running=false;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

document.addEventListener('keydown',e=>{keys[e.code]=true;
  if(['ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
  if(e.code==='KeyP')pause();
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});
document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('pauseBtn').addEventListener('click',pause);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('resumeBtn').addEventListener('click',pause);
window.addEventListener('resize',resize);

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
