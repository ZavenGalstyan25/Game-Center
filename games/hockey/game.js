'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,mouseX=0,mouseY=0;

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=Math.min(area.clientWidth-4,500);
  H=canvas.height=area.clientHeight-4;
}

function S(){return Math.min(W/400,H/700);}

function initGame(){
  const s=S();
  const pr=28*s;
  G={
    puck:{x:W/2,y:H/2,vx:4*s*(Math.random()<0.5?1:-1),vy:4*s,r:16*s,trail:[]},
    p1:{x:W/2,y:H*0.82,r:pr,tx:W/2,ty:H*0.82},// player (bottom)
    p2:{x:W/2,y:H*0.18,r:pr},// cpu (top)
    p1Score:0,p2Score:0,
    goalW:W*0.35,goalH:14*s,
    particles:[],
    running:false,over:false,
    scoreFlash:null,serveDelay:0
  };
}

function cpuAI(){
  const puck=G.puck,cpu=G.p2,s=S();
  const speed=6*s+G.p1Score*0.2*s;
  if(puck.vy<0){// puck heading toward cpu
    cpu.x+=(puck.x-cpu.x)*0.1;cpu.y+=(puck.y+60*s-cpu.y)*0.1;
  } else {
    cpu.x+=(W/2-cpu.x)*0.05;cpu.y+=(H*0.18-cpu.y)*0.05;
  }
  cpu.x=Math.max(cpu.r,Math.min(W-cpu.r,cpu.x));
  cpu.y=Math.max(cpu.r,Math.min(H/2-10*s,cpu.y));
}

function spawnParticles(x,y,color,n){
  for(let i=0;i<(n||10);i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*10,vy:(Math.random()-.5)*10,life:1,color,size:2+Math.random()*4});
}

function servePuck(dir){
  const s=S();
  G.puck.x=W/2;G.puck.y=H/2;
  G.puck.vx=(Math.random()-.5)*4*s;
  G.puck.vy=6*s*(dir||1);
  G.puck.trail=[];G.serveDelay=0;
}

function update(){
  if(!G.running||G.over)return;
  if(G.serveDelay>0){G.serveDelay--;return;}
  cpuAI();

  // Player paddle follows mouse
  const s=S();
  G.p1.tx=mouseX;G.p1.ty=Math.max(H/2+G.p1.r,Math.min(H-G.p1.r,mouseY));
  G.p1.x+=(G.p1.tx-G.p1.x)*0.25;
  G.p1.y+=(G.p1.ty-G.p1.y)*0.25;

  const puck=G.puck;
  // Trail
  puck.trail.push({x:puck.x,y:puck.y,life:1});
  if(puck.trail.length>12)puck.trail.shift();
  puck.trail.forEach(t=>t.life-=0.08);

  puck.x+=puck.vx;puck.y+=puck.vy;

  // Wall bounce
  if(puck.x-puck.r<0){puck.x=puck.r;puck.vx=Math.abs(puck.vx)*0.95;}
  if(puck.x+puck.r>W){puck.x=W-puck.r;puck.vx=-Math.abs(puck.vx)*0.95;}

  // Goal detection
  const gx1=(W-G.goalW)/2,gx2=gx1+G.goalW;
  if(puck.y-puck.r<0){
    if(puck.x>gx1&&puck.x<gx2){score(1);}
    else{puck.y=puck.r;puck.vy=Math.abs(puck.vy)*0.9;}
  }
  if(puck.y+puck.r>H){
    if(puck.x>gx1&&puck.x<gx2){score(2);}
    else{puck.y=H-puck.r;puck.vy=-Math.abs(puck.vy)*0.9;}
  }

  // Paddle collisions
  [G.p1,G.p2].forEach(pad=>{
    const dist=Math.hypot(puck.x-pad.x,puck.y-pad.y);
    if(dist<puck.r+pad.r){
      const nx=(puck.x-pad.x)/dist,ny=(puck.y-pad.y)/dist;
      const spd=Math.hypot(puck.vx,puck.vy);
      const newSpd=Math.min(18*s,spd*1.08+1*s);
      puck.vx=nx*newSpd;puck.vy=ny*newSpd;
      // Push out
      const overlap=puck.r+pad.r-dist+1;
      puck.x+=nx*overlap;puck.y+=ny*overlap;
      spawnParticles(puck.x,puck.y,'#00d4ff',6);
    }
  });

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.04;return p.life>0;});
}

function score(player){
  if(player===1){G.p1Score++;document.getElementById('p1Score').textContent=G.p1Score;
    spawnParticles(W/2,H-G.goalH,'#00d4ff',20);}
  else{G.p2Score++;document.getElementById('p2Score').textContent=G.p2Score;
    spawnParticles(W/2,G.goalH,'#ef4444',20);}
  G.scoreFlash={player,timer:40};
  if(G.p1Score>=7||G.p2Score>=7){endGame();return;}
  G.serveDelay=90;servePuck(player===1?1:-1);
}

function endGame(){
  G.over=true;G.running=false;
  const won=G.p1Score>=7;
  document.getElementById('winEmoji').textContent=won?'🏆':'💀';
  document.getElementById('winText').textContent=won?'YOU WIN!':'CPU WINS!';
  document.getElementById('winOverlay').classList.remove('hidden');
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  const s=S();
  // Rink
  ctx.strokeStyle='rgba(0,212,255,.2)';ctx.lineWidth=2;
  ctx.strokeRect(2,2,W-4,H-4);
  // Center line
  ctx.setLineDash([12*s,8*s]);ctx.strokeStyle='rgba(0,212,255,.15)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.setLineDash([]);
  // Center circle
  ctx.strokeStyle='rgba(0,212,255,.12)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(W/2,H/2,W*0.18,0,Math.PI*2);ctx.stroke();

  // Goals
  const gx1=(W-G.goalW)/2,gx2=gx1+G.goalW;
  // Top goal (CPU)
  ctx.fillStyle='rgba(239,68,68,.15)';ctx.fillRect(gx1,0,G.goalW,G.goalH);
  ctx.strokeStyle='rgba(239,68,68,.6)';ctx.lineWidth=2;ctx.strokeRect(gx1,0,G.goalW,G.goalH);
  // Bottom goal (Player)
  ctx.fillStyle='rgba(0,212,255,.15)';ctx.fillRect(gx1,H-G.goalH,G.goalW,G.goalH);
  ctx.strokeStyle='rgba(0,212,255,.6)';ctx.lineWidth=2;ctx.strokeRect(gx1,H-G.goalH,G.goalW,G.goalH);

  // Score flash
  if(G.scoreFlash&&G.scoreFlash.timer>0){
    const alpha=G.scoreFlash.timer/40*0.3;
    ctx.fillStyle=G.scoreFlash.player===1?`rgba(0,212,255,${alpha})`:`rgba(239,68,68,${alpha})`;
    ctx.fillRect(0,0,W,H);G.scoreFlash.timer--;
  }

  // Puck trail
  G.puck.trail.forEach((t,i)=>{
    ctx.globalAlpha=t.life*0.5;ctx.fillStyle='#00d4ff';
    ctx.beginPath();ctx.arc(t.x,t.y,G.puck.r*(i/G.puck.trail.length),0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  });

  // Puck
  const puck=G.puck;
  ctx.shadowBlur=18;ctx.shadowColor='#fff';ctx.fillStyle='#e0e8ff';
  ctx.beginPath();ctx.arc(puck.x,puck.y,puck.r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(0,212,255,.5)';ctx.lineWidth=2;ctx.stroke();
  ctx.shadowBlur=0;

  // Paddles
  [['p1','#00d4ff','rgba(0,212,255,.6)'],['p2','#ef4444','rgba(239,68,68,.6)']].forEach(([k,c,glow])=>{
    const pad=G[k];
    ctx.shadowBlur=14;ctx.shadowColor=glow;ctx.fillStyle=c;
    ctx.beginPath();ctx.arc(pad.x,pad.y,pad.r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.arc(pad.x-pad.r*0.2,pad.y-pad.r*0.2,pad.r*0.4,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  });

  // Particles
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=5;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
}

function gameLoop(){
  if(!G.running)return;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('winOverlay').classList.add('hidden');
  G.running=true;servePuck(1);
  cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove',e=>{
  const rect=canvas.getBoundingClientRect();
  mouseX=e.clientX-rect.left;mouseY=e.clientY-rect.top;
});
canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  const rect=canvas.getBoundingClientRect();
  mouseX=e.touches[0].clientX-rect.left;mouseY=e.touches[0].clientY-rect.top;
},{passive:false});

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('restartBtn').addEventListener('click',startGame);
window.addEventListener('resize',resize);

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
