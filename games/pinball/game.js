'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,keys={};

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=Math.min(area.clientWidth-4,400);
  H=canvas.height=area.clientHeight-4;
}

function S(){return W/400;}

function buildBumpers(){
  const s=S();
  return[
    {x:W*0.25,y:H*0.25,r:24*s,pts:100,flash:0},
    {x:W*0.75,y:H*0.25,r:24*s,pts:100,flash:0},
    {x:W*0.5,y:H*0.18,r:24*s,pts:150,flash:0},
    {x:W*0.3,y:H*0.4,r:20*s,pts:75,flash:0},
    {x:W*0.7,y:H*0.4,r:20*s,pts:75,flash:0},
    {x:W*0.5,y:H*0.33,r:20*s,pts:75,flash:0},
  ];
}

function buildRamps(){
  const s=S();
  return[
    // Left ramp
    {x1:W*0.05,y1:H*0.55,x2:W*0.3,y2:H*0.45},
    {x1:W*0.05,y1:H*0.7,x2:W*0.25,y2:H*0.6},
    // Right ramp
    {x1:W*0.95,y1:H*0.55,x2:W*0.7,y2:H*0.45},
    {x1:W*0.95,y1:H*0.7,x2:W*0.75,y2:H*0.6},
  ];
}

function initGame(){
  const s=S();
  const flipW=70*s;
  G={
    ball:{x:W*0.9,y:H*0.8,vx:0,vy:0,r:10*s,launched:false},
    flipL:{x:W*0.18,cx:W*0.07,y:H*0.88,len:flipW,angle:0.4,targetAngle:0.4,baseAngle:0.4,minAngle:-0.4},
    flipR:{x:W*0.82,cx:W*0.93,y:H*0.88,len:flipW,angle:Math.PI-0.4,targetAngle:Math.PI-0.4,baseAngle:Math.PI-0.4,minAngle:Math.PI+0.4},
    bumpers:buildBumpers(),ramps:buildRamps(),
    particles:[],scorePopups:[],
    score:0,balls:3,best:parseInt(localStorage.getItem('pin_best')||0),
    running:false,over:false,launchPower:0,launchCharging:false
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('ballsDisplay').textContent=G.balls;
  document.getElementById('bestDisplay').textContent=G.best;
}

function reflectOff(ball,nx,ny,restitution){
  const dot=ball.vx*nx+ball.vy*ny;
  ball.vx=(ball.vx-2*dot*nx)*restitution;
  ball.vy=(ball.vy-2*dot*ny)*restitution;
}

function lineCircleCollide(x1,y1,x2,y2,cx,cy,cr){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
  const nx=dx/len,ny=dy/len;
  const t=Math.max(0,Math.min(len,(cx-x1)*nx+(cy-y1)*ny));
  const closestX=x1+t*nx,closestY=y1+t*ny;
  const dist=Math.hypot(cx-closestX,cy-closestY);
  if(dist<cr){return{nx:(cx-closestX)/dist,ny:(cy-closestY)/dist,t};}
  return null;
}

function flipperEndPos(f){
  return{x:f.cx+Math.cos(f.angle)*f.len,y:f.y+Math.sin(f.angle)*f.len};
}

function update(){
  if(!G.running||G.over)return;
  const b=G.ball,s=S();

  if(G.launchCharging){
    G.launchPower=Math.min(1,G.launchPower+0.02);
  }

  if(!b.launched){b.x=W*0.9;b.y=H*0.8;return;}

  b.vy+=0.4*s;// gravity
  b.x+=b.vx;b.y+=b.vy;

  // Wall collisions
  if(b.x-b.r<0){b.x=b.r;b.vx=Math.abs(b.vx)*0.75;}
  if(b.x+b.r>W){b.x=W-b.r;b.vx=-Math.abs(b.vx)*0.75;}
  if(b.y-b.r<0){b.y=b.r;b.vy=Math.abs(b.vy)*0.75;}

  // Lost ball
  if(b.y>H+b.r*2){
    G.balls--;updateHUD();
    if(G.balls<=0){endGame();return;}
    b.x=W*0.9;b.y=H*0.8;b.vx=0;b.vy=0;b.launched=false;
    return;
  }

  // Flippers
  [G.flipL,G.flipR].forEach(f=>{
    f.angle+=(f.targetAngle-f.angle)*0.35;
    const end=flipperEndPos(f);
    const col=lineCircleCollide(f.cx,f.y,end.x,end.y,b.x,b.y,b.r+2);
    if(col){
      const spd=Math.hypot(b.vx,b.vy);
      reflectOff(b,col.nx,col.ny,0.9);
      if(Math.abs(b.vy)<6*s)b.vy=-8*s;
      // Push ball up on flip
      const flipped=(f===G.flipL&&keys['ArrowLeft']||keys['KeyZ'])||(f===G.flipR&&keys['ArrowRight']||keys['KeyX']);
      if(flipped&&b.vy>-5*s)b.vy-=5*s;
    }
  });

  // Bumpers
  G.bumpers.forEach(bm=>{
    const dist=Math.hypot(b.x-bm.x,b.y-bm.y);
    if(dist<b.r+bm.r){
      const nx=(b.x-bm.x)/dist,ny=(b.y-bm.y)/dist;
      const spd=Math.max(8*s,Math.hypot(b.vx,b.vy)*1.1);
      b.vx=nx*spd;b.vy=ny*spd;
      b.x=bm.x+nx*(b.r+bm.r+1);b.y=bm.y+ny*(b.r+bm.r+1);
      G.score+=bm.pts;bm.flash=12;
      if(G.score>G.best){G.best=G.score;localStorage.setItem('pin_best',G.best);}
      G.scorePopups.push({x:bm.x,y:bm.y,pts:bm.pts,life:1});
      spawnParticles(bm.x,bm.y,'#a855f7',8);
      updateHUD();
    }
    if(bm.flash>0)bm.flash--;
  });

  // Ramps
  G.ramps.forEach(r=>{
    const col=lineCircleCollide(r.x1,r.y1,r.x2,r.y2,b.x,b.y,b.r+1);
    if(col)reflectOff(b,col.nx,col.ny,0.7);
  });

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.05;return p.life>0;});
  G.scorePopups=G.scorePopups.filter(p=>{p.y-=1;p.life-=0.03;return p.life>0;});
}

function spawnParticles(x,y,color,n){
  for(let i=0;i<n;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,life:1,color,size:2+Math.random()*3});
}

function drawFlipper(f,color){
  const end=flipperEndPos(f);
  ctx.shadowBlur=12;ctx.shadowColor=color;ctx.strokeStyle=color;ctx.lineWidth=10*S();ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(f.cx,f.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.shadowBlur=0;
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  // Side walls
  ctx.shadowBlur=8;ctx.shadowColor='rgba(168,85,247,.4)';
  ctx.strokeStyle='rgba(168,85,247,.3)';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(W,H);ctx.stroke();
  ctx.shadowBlur=0;

  // Ramps
  G.ramps.forEach(r=>{
    ctx.strokeStyle='rgba(59,130,246,.6)';ctx.lineWidth=6;ctx.lineCap='round';
    ctx.shadowBlur=6;ctx.shadowColor='rgba(59,130,246,.4)';
    ctx.beginPath();ctx.moveTo(r.x1,r.y1);ctx.lineTo(r.x2,r.y2);ctx.stroke();ctx.shadowBlur=0;
  });

  // Bumpers
  G.bumpers.forEach(bm=>{
    const active=bm.flash>0;
    ctx.shadowBlur=active?20:10;ctx.shadowColor=active?'#fff':'#a855f7';
    ctx.fillStyle=active?'#fff':'#a855f7';
    ctx.beginPath();ctx.arc(bm.x,bm.y,bm.r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=active?'rgba(255,255,255,.8)':'rgba(168,85,247,.5)';ctx.lineWidth=2;ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=active?'#a855f7':'rgba(255,255,255,.8)';
    ctx.font=`bold ${bm.r*0.8}px "Exo 2",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(bm.pts,bm.x,bm.y);ctx.textAlign='left';ctx.textBaseline='alphabetic';
  });

  // Flippers
  drawFlipper(G.flipL,'#00d4ff');
  drawFlipper(G.flipR,'#00d4ff');

  // Launch indicator
  if(!G.ball.launched&&G.launchPower>0){
    ctx.fillStyle=`rgba(16,185,129,${G.launchPower*0.6})`;
    ctx.fillRect(W*0.85,G.ball.y,10*S(),-(G.launchPower*80*S()));
  }

  // Ball
  const b=G.ball;
  ctx.shadowBlur=14;ctx.shadowColor='#e0e8ff';ctx.fillStyle='#e0e8ff';
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

  // Particles
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
  // Score popups
  G.scorePopups.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle='#fff';ctx.font=`bold 14px "Exo 2",sans-serif`;
    ctx.textAlign='center';ctx.fillText('+'+p.pts,p.x,p.y);ctx.globalAlpha=1;ctx.textAlign='left';
  });
}

function gameLoop(){
  if(!G.running)return;
  // Flipper control
  const s=S();
  G.flipL.targetAngle=(keys['ArrowLeft']||keys['KeyZ'])?G.flipL.minAngle:G.flipL.baseAngle;
  G.flipR.targetAngle=(keys['ArrowRight']||keys['KeyX'])?G.flipR.minAngle:G.flipR.baseAngle;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

function endGame(){
  G.over=true;G.running=false;
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function startGame(){
  resize();initGame();updateHUD();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Space'){e.preventDefault();
    if(!G.ball.launched){G.launchCharging=true;}
  }
  if(['ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
});
document.addEventListener('keyup',e=>{
  keys[e.code]=false;
  if(e.code==='Space'&&G.launchCharging){
    G.launchCharging=false;
    if(!G.ball.launched){
      G.ball.launched=true;G.ball.vx=-1*S();G.ball.vy=-(8+G.launchPower*12)*S();G.launchPower=0;
    }
  }
});

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
