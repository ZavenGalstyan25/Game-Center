'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

// 5 holes: {par, ballStart, hole, walls: [{x,y,w,h}], bumpers: [{x,y,r}]}
function buildHoles(){
  return[
    {par:3,ball:{x:0.15,y:0.5},hole:{x:0.85,y:0.5},
     walls:[{x:0.1,y:0.3,w:0.8,h:0.04},{x:0.1,y:0.66,w:0.8,h:0.04}],bumpers:[]},
    {par:4,ball:{x:0.15,y:0.8},hole:{x:0.85,y:0.2},
     walls:[{x:0.3,y:0.1,w:0.04,h:0.5},{x:0.6,y:0.4,w:0.04,h:0.5}],
     bumpers:[{x:0.5,y:0.3,r:0.04},{x:0.5,y:0.7,r:0.04}]},
    {par:3,ball:{x:0.1,y:0.5},hole:{x:0.9,y:0.5},
     walls:[{x:0.3,y:0.2,w:0.04,h:0.35},{x:0.5,y:0.45,w:0.04,h:0.35},{x:0.7,y:0.2,w:0.04,h:0.35}],bumpers:[]},
    {par:5,ball:{x:0.5,y:0.85},hole:{x:0.5,y:0.15},
     walls:[{x:0.2,y:0.3,w:0.25,h:0.04},{x:0.55,y:0.5,w:0.25,h:0.04},{x:0.2,y:0.7,w:0.25,h:0.04}],
     bumpers:[{x:0.35,y:0.42,r:0.04},{x:0.65,y:0.62,r:0.04}]},
    {par:4,ball:{x:0.1,y:0.1},hole:{x:0.9,y:0.9},
     walls:[{x:0.2,y:0.2,w:0.6,h:0.04},{x:0.2,y:0.2,w:0.04,h:0.6},{x:0.35,y:0.35,w:0.3,h:0.04},{x:0.35,y:0.35,w:0.04,h:0.3}],
     bumpers:[{x:0.7,y:0.3,r:0.035},{x:0.3,y:0.7,r:0.035}]}
  ];
}

function initGame(){
  G={
    holes:buildHoles(),holeIdx:0,totalStrokes:0,
    ball:{x:0,y:0,vx:0,vy:0,r:0,moving:false},
    aiming:false,aimStart:{x:0,y:0},aimEnd:{x:0,y:0},
    strokes:0,holeSunk:false,
    particles:[],running:false,over:false
  };
  loadHole(0);
}

function loadHole(idx){
  const hole=G.holes[idx];
  const r=Math.min(W,H)*0.022;
  G.ball={x:hole.ball.x*W,y:hole.ball.y*H,vx:0,vy:0,r,moving:false};
  G.aiming=false;G.strokes=0;G.holeSunk=false;
  document.getElementById('holeDisplay').textContent=(idx+1)+'/'+G.holes.length;
  document.getElementById('strokeDisplay').textContent=0;
  document.getElementById('parDisplay').textContent=hole.par;
}

function getWallsAbs(){
  const h=G.holes[G.holeIdx];
  return h.walls.map(w=>({x:w.x*W,y:w.y*H,w:w.w*W,h:w.h*H}));
}

function getBumpersAbs(){
  const h=G.holes[G.holeIdx];
  return h.bumpers.map(b=>({x:b.x*W,y:b.y*H,r:b.r*Math.min(W,H)}));
}

function getHoleAbs(){
  const h=G.holes[G.holeIdx];
  return{x:h.hole.x*W,y:h.hole.y*H,r:Math.min(W,H)*0.04};
}

function update(){
  if(!G.running||!G.ball.moving||G.holeSunk)return;
  const b=G.ball;
  b.x+=b.vx;b.y+=b.vy;
  b.vx*=0.985;b.vy*=0.985;
  if(Math.abs(b.vx)<0.05&&Math.abs(b.vy)<0.05){b.vx=0;b.vy=0;b.moving=false;}

  // Boundary bounce
  const pad=5;
  if(b.x-b.r<pad){b.x=pad+b.r;b.vx=Math.abs(b.vx)*0.8;}
  if(b.x+b.r>W-pad){b.x=W-pad-b.r;b.vx=-Math.abs(b.vx)*0.8;}
  if(b.y-b.r<pad){b.y=pad+b.r;b.vy=Math.abs(b.vy)*0.8;}
  if(b.y+b.r>H-pad){b.y=H-pad-b.r;b.vy=-Math.abs(b.vy)*0.8;}

  // Wall collisions
  getWallsAbs().forEach(w=>{
    if(b.x+b.r>w.x&&b.x-b.r<w.x+w.w&&b.y+b.r>w.y&&b.y-b.r<w.y+w.h){
      const fromLeft=b.x-b.vx+b.r<=w.x,fromRight=b.x-b.vx-b.r>=w.x+w.w;
      const fromTop=b.y-b.vy+b.r<=w.y,fromBot=b.y-b.vy-b.r>=w.y+w.h;
      if(fromLeft){b.vx=-Math.abs(b.vx)*0.7;b.x=w.x-b.r-0.1;}
      else if(fromRight){b.vx=Math.abs(b.vx)*0.7;b.x=w.x+w.w+b.r+0.1;}
      else if(fromTop){b.vy=-Math.abs(b.vy)*0.7;b.y=w.y-b.r-0.1;}
      else{b.vy=Math.abs(b.vy)*0.7;b.y=w.y+w.h+b.r+0.1;}
    }
  });

  // Bumper collisions
  getBumpersAbs().forEach(bm=>{
    const dist=Math.hypot(b.x-bm.x,b.y-bm.y);
    if(dist<b.r+bm.r){
      const nx=(b.x-bm.x)/dist,ny=(b.y-bm.y)/dist;
      b.vx=nx*Math.hypot(b.vx,b.vy)*1.1;b.vy=ny*Math.hypot(b.vx,b.vy)*1.1;
      b.x=bm.x+nx*(b.r+bm.r+1);b.y=bm.y+ny*(b.r+bm.r+1);
      spawnParticles(b.x,b.y,'#f59e0b');
    }
  });

  // Hole check
  const hole=getHoleAbs();
  if(Math.hypot(b.x-hole.x,b.y-hole.y)<hole.r*0.7){
    G.holeSunk=true;b.moving=false;
    G.totalStrokes+=G.strokes;
    spawnParticles(hole.x,hole.y,'#10b981',20);
    setTimeout(()=>{
      const h=G.holes[G.holeIdx];
      document.getElementById('holeResult').textContent='Hole '+(G.holeIdx+1)+' Done!';
      document.getElementById('holeStrokes').textContent=G.strokes+' stroke'+(G.strokes!==1?'s':'')+' (par '+h.par+')';
      document.getElementById('holeEmoji').textContent=G.strokes<=h.par-2?'🦅':G.strokes<=h.par?'⛳':'💀';
      document.getElementById('totalDisplay').textContent=G.totalStrokes;
      document.getElementById('holeCompleteOverlay').classList.remove('hidden');
    },800);
  }

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.04;return p.life>0;});
}

function spawnParticles(x,y,color,n){
  for(let i=0;i<(n||8);i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,life:1,color,size:2+Math.random()*3});
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  // Fairway
  ctx.fillStyle='rgba(16,185,129,.05)';
  ctx.beginPath();ctx.roundRect(4,4,W-8,H-8,8);ctx.fill();
  ctx.strokeStyle='rgba(16,185,129,.2)';ctx.lineWidth=2;ctx.stroke();

  // Walls
  getWallsAbs().forEach(w=>{
    ctx.shadowBlur=6;ctx.shadowColor='rgba(59,130,246,.5)';
    ctx.fillStyle='#1e3a5f';ctx.beginPath();ctx.roundRect(w.x,w.y,w.w,w.h,3);ctx.fill();
    ctx.strokeStyle='rgba(59,130,246,.5)';ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
  });

  // Bumpers
  getBumpersAbs().forEach(b=>{
    const pulse=0.85+0.15*Math.sin(Date.now()/200);
    ctx.shadowBlur=12*pulse;ctx.shadowColor='#f59e0b';ctx.fillStyle='#f59e0b';
    ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(245,158,11,.4)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*1.3*pulse,0,Math.PI*2);ctx.stroke();
  });

  // Hole (cup)
  const hole=getHoleAbs();
  ctx.fillStyle='#111';ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(hole.x,hole.y,hole.r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(16,185,129,.6)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(hole.x,hole.y,hole.r,0,Math.PI*2);ctx.stroke();
  // Flag
  ctx.strokeStyle='#10b981';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(hole.x,hole.y-hole.r);ctx.lineTo(hole.x,hole.y-hole.r-25);ctx.stroke();
  ctx.fillStyle='#ef4444';ctx.beginPath();ctx.moveTo(hole.x,hole.y-hole.r-25);
  ctx.lineTo(hole.x+16,hole.y-hole.r-18);ctx.lineTo(hole.x,hole.y-hole.r-10);ctx.fill();

  // Aim line
  if(G.aiming){
    const dx=G.ball.x-G.aimEnd.x,dy=G.ball.y-G.aimEnd.y;
    const dist=Math.min(Math.hypot(dx,dy),150);
    const alpha=dist/150;
    ctx.strokeStyle=`rgba(16,185,129,${alpha*0.6})`;ctx.lineWidth=2;ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.moveTo(G.ball.x,G.ball.y);ctx.lineTo(G.aimEnd.x,G.aimEnd.y);ctx.stroke();
    ctx.setLineDash([]);
    // Power indicator
    const pw=dist/150;
    ctx.fillStyle=pw>0.7?'#ef4444':pw>0.4?'#f59e0b':'#10b981';
    ctx.fillRect(G.ball.x-25,G.ball.y-G.ball.r-14,50*pw,6);
    ctx.strokeStyle='rgba(255,255,255,.2)';ctx.strokeRect(G.ball.x-25,G.ball.y-G.ball.r-14,50,6);
  }

  // Ball trail
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });

  // Ball
  const b=G.ball;
  ctx.shadowBlur=14;ctx.shadowColor='#fff';ctx.fillStyle='#e0e8ff';
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.arc(b.x-b.r*0.25,b.y-b.r*0.25,b.r*0.35,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}

function gameLoop(){
  if(!G.running)return;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousedown',e=>{
  if(!G.running||G.ball.moving||G.holeSunk)return;
  const rect=canvas.getBoundingClientRect();
  G.aiming=true;G.aimStart={x:e.clientX-rect.left,y:e.clientY-rect.top};
  G.aimEnd={...G.aimStart};
});
canvas.addEventListener('mousemove',e=>{
  if(!G.aiming)return;
  const rect=canvas.getBoundingClientRect();
  G.aimEnd={x:e.clientX-rect.left,y:e.clientY-rect.top};
});
canvas.addEventListener('mouseup',e=>{
  if(!G.aiming||!G.running||G.ball.moving)return;
  G.aiming=false;
  const dx=G.ball.x-G.aimEnd.x,dy=G.ball.y-G.aimEnd.y;
  const dist=Math.min(Math.hypot(dx,dy),150);
  if(dist<5)return;
  const power=(dist/150)*16;
  G.ball.vx=(dx/dist)*power;G.ball.vy=(dy/dist)*power;
  G.ball.moving=true;G.strokes++;
  document.getElementById('strokeDisplay').textContent=G.strokes;
});

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('holeCompleteOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('nextHoleBtn').addEventListener('click',()=>{
  document.getElementById('holeCompleteOverlay').classList.add('hidden');
  G.holeIdx++;
  if(G.holeIdx>=G.holes.length){
    document.getElementById('finalScore').textContent='Total: '+G.totalStrokes+' strokes';
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    G.running=false;return;
  }
  loadHole(G.holeIdx);
});
window.addEventListener('resize',resize);

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
