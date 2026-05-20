'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,keys={},mousePos={x:0,y:0};

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function initGame(){
  G={
    player:{x:W/2,y:H/2,rot:0,turretRot:0,hp:3,maxHp:3,speed:3,w:36,h:28,shootTimer:0},
    enemies:[],bullets:[],enemyBullets:[],walls:[],particles:[],
    score:0,wave:1,best:parseInt(localStorage.getItem('tank_best')||0),
    running:false,paused:false,over:false
  };
  buildWalls();spawnWave();
  document.getElementById('bestDisplay').textContent=G.best;
}

function buildWalls(){
  G.walls=[];
  const configs=[
    {x:W*0.2,y:H*0.2,w:80,h:20},{x:W*0.6,y:H*0.2,w:80,h:20},
    {x:W*0.15,y:H*0.5,w:20,h:100},{x:W*0.65,y:H*0.5,w:20,h:100},
    {x:W*0.35,y:H*0.35,w:120,h:20},{x:W*0.35,y:H*0.65,w:120,h:20},
    {x:W*0.1,y:H*0.75,w:60,h:20},{x:W*0.7,y:H*0.75,w:60,h:20},
    {x:W*0.45,y:H*0.1,w:20,h:80},{x:W*0.45,y:H*0.75,w:20,h:60}
  ];
  configs.forEach(c=>{
    G.walls.push({x:c.x-c.w/2,y:c.y-c.h/2,w:c.w,h:c.h});
  });
}

function spawnWave(){
  const n=2+G.wave;
  G.enemies=[];
  const corners=[{x:60,y:60},{x:W-60,y:60},{x:60,y:H-60},{x:W-60,y:H-60}];
  for(let i=0;i<n;i++){
    const pos=corners[i%corners.length];
    G.enemies.push({x:pos.x+(Math.random()-.5)*40,y:pos.y+(Math.random()-.5)*40,
      rot:Math.random()*Math.PI*2,turretRot:0,hp:2,maxHp:2,
      speed:1.2+G.wave*0.1,shootTimer:Math.random()*120,w:32,h:26,
      moveTimer:0,moveDur:0,moveDir:0,stuckTimer:0});
  }
}

function wallHit(x,y,r){
  return G.walls.some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h);
}

function rectCircle(rx,ry,rw,rh,cx,cy,cr){
  const nx=Math.max(rx,Math.min(cx,rx+rw)),ny=Math.max(ry,Math.min(cy,ry+rh));
  return Math.hypot(cx-nx,cy-ny)<cr;
}

function update(){
  if(!G.running||G.paused)return;
  const p=G.player;
  // Player movement
  let dx=0,dy=0;
  if(keys['KeyW']||keys['ArrowUp'])dy=-p.speed;
  if(keys['KeyS']||keys['ArrowDown'])dy=p.speed;
  if(keys['KeyA']||keys['ArrowLeft'])dx=-p.speed;
  if(keys['KeyD']||keys['ArrowRight'])dx=p.speed;
  const nx=p.x+dx,ny=p.y+dy;
  if(!wallHit(nx,p.y,14)&&nx>14&&nx<W-14)p.x=nx;
  if(!wallHit(p.x,ny,14)&&ny>14&&ny<H-14)p.y=ny;
  if(dx||dy)p.rot=Math.atan2(dy,dx);
  p.turretRot=Math.atan2(mousePos.y-p.y,mousePos.x-p.x);
  if(p.shootTimer>0)p.shootTimer--;

  // Enemy AI
  G.enemies.forEach(e=>{
    const toDx=G.player.x-e.x,toDy=G.player.y-e.y;
    const dist=Math.hypot(toDx,toDy);
    e.turretRot=Math.atan2(toDy,toDx);

    // Movement
    e.moveTimer--;
    if(e.moveTimer<=0){
      e.moveTimer=30+Math.random()*60;
      if(dist>200){e.moveDir=e.turretRot+(Math.random()-.5)*0.4;}
      else{e.moveDir=e.turretRot+Math.PI+(Math.random()-.5)*1;}
    }
    const enx=e.x+Math.cos(e.moveDir)*e.speed,eny=e.y+Math.sin(e.moveDir)*e.speed;
    if(!wallHit(enx,e.y,12)&&enx>12&&enx<W-12){e.x=enx;} else{e.moveDir+=Math.PI/2;}
    if(!wallHit(e.x,eny,12)&&eny>12&&eny<H-12){e.y=eny;} else{e.moveDir+=Math.PI/2;}
    e.rot=e.moveDir;

    // Shoot
    e.shootTimer--;
    if(e.shootTimer<=0&&dist<400){
      e.shootTimer=80+Math.random()*60;
      G.enemyBullets.push({x:e.x+Math.cos(e.turretRot)*20,y:e.y+Math.sin(e.turretRot)*20,
        vx:Math.cos(e.turretRot)*7,vy:Math.sin(e.turretRot)*7,life:80});
    }
  });

  // Player bullets
  G.bullets=G.bullets.filter(b=>{
    b.x+=b.vx;b.y+=b.vy;b.life--;
    if(wallHit(b.x,b.y,4)){spawnParticles(b.x,b.y,'#f59e0b',6);return false;}
    if(b.x<0||b.x>W||b.y<0||b.y>H)return false;
    for(let i=G.enemies.length-1;i>=0;i--){
      const e=G.enemies[i];
      if(Math.hypot(b.x-e.x,b.y-e.y)<18){
        e.hp--;spawnParticles(b.x,b.y,'#ef4444',10);
        if(e.hp<=0){G.score+=100*G.wave;
          if(G.score>G.best){G.best=G.score;localStorage.setItem('tank_best',G.best);}
          spawnParticles(e.x,e.y,'#f59e0b',20);G.enemies.splice(i,1);}
        updateHUD();return false;
      }
    }
    return b.life>0;
  });

  // Enemy bullets
  G.enemyBullets=G.enemyBullets.filter(b=>{
    b.x+=b.vx;b.y+=b.vy;b.life--;
    if(wallHit(b.x,b.y,4)){spawnParticles(b.x,b.y,'rgba(239,68,68,.5)',4);return false;}
    if(Math.hypot(b.x-p.x,b.y-p.y)<16){
      p.hp--;spawnParticles(b.x,b.y,'#00d4ff',8);updateHUD();
      if(p.hp<=0){endGame();return false;}return false;}
    return b.life>0;
  });

  if(G.enemies.length===0&&G.running){G.wave++;spawnWave();updateHUD();}

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.035;return p.life>0;});
}

function spawnParticles(x,y,color,n){
  for(let i=0;i<(n||8);i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,life:1,color,size:2+Math.random()*3});
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('hpDisplay').textContent=G.player.hp;
  document.getElementById('waveDisplay').textContent=G.wave;
  document.getElementById('bestDisplay').textContent=G.best;
}

function drawTank(x,y,rot,turRot,color,glow,hp,maxHp){
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  ctx.shadowBlur=10;ctx.shadowColor=glow;
  // Body
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-16,-12,32,24,4);ctx.fill();
  // Tracks
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(-16,-14,32,4);ctx.fillRect(-16,10,32,4);
  ctx.restore();
  // Turret
  ctx.save();ctx.translate(x,y);ctx.rotate(turRot);
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();
  ctx.fillRect(4,-3,20,6);ctx.shadowBlur=0;ctx.restore();
  // HP bar
  if(hp<maxHp){
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(x-16,y-20,32,4);
    ctx.fillStyle='#10b981';ctx.fillRect(x-16,y-20,32*(hp/maxHp),4);
  }
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  // Ground grid
  ctx.strokeStyle='rgba(245,158,11,.05)';ctx.lineWidth=1;
  for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

  // Walls
  G.walls.forEach(w=>{
    ctx.shadowBlur=6;ctx.shadowColor='rgba(245,158,11,.3)';
    const grd=ctx.createLinearGradient(w.x,w.y,w.x+w.w,w.y+w.h);
    grd.addColorStop(0,'#3a2a1a');grd.addColorStop(1,'#5a3a20');
    ctx.fillStyle=grd;ctx.beginPath();ctx.roundRect(w.x,w.y,w.w,w.h,3);ctx.fill();
    ctx.strokeStyle='rgba(245,158,11,.4)';ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
  });

  // Bullets
  G.bullets.forEach(b=>{
    ctx.shadowBlur=10;ctx.shadowColor='#f59e0b';ctx.fillStyle='#f59e0b';
    ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  });
  G.enemyBullets.forEach(b=>{
    ctx.shadowBlur=8;ctx.shadowColor='#ef4444';ctx.fillStyle='#ef4444';
    ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  });

  // Enemies
  G.enemies.forEach(e=>drawTank(e.x,e.y,e.rot,e.turretRot,'#7f1d1d','rgba(239,68,68,.5)',e.hp,e.maxHp));

  // Player
  drawTank(G.player.x,G.player.y,G.player.rot,G.player.turretRot,'#065f46','rgba(0,212,255,.6)',G.player.hp,G.player.maxHp);

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

function endGame(){
  G.over=true;G.running=false;
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('finalWave').textContent='Wave: '+G.wave;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function startGame(){
  resize();initGame();updateHUD();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

function pause(){
  if(G.over)return;
  if(G.paused){G.paused=false;document.getElementById('pauseOverlay').classList.add('hidden');animId=requestAnimationFrame(gameLoop);}
  else{G.paused=true;G.running=false;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();mousePos.x=e.clientX-r.left;mousePos.y=e.clientY-r.top;
});
canvas.addEventListener('click',e=>{
  if(!G.running||G.paused)return;
  const p=G.player;if(p.shootTimer>0)return;p.shootTimer=20;
  G.bullets.push({x:p.x+Math.cos(p.turretRot)*24,y:p.y+Math.sin(p.turretRot)*24,
    vx:Math.cos(p.turretRot)*10,vy:Math.sin(p.turretRot)*10,life:100});
});
document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyP')pause();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
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
  let p=0;const iv=setInterval(()=>{p+=Math.random()*25;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
