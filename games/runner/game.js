'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,lastTs=0;
const GRAVITY=0.7,JUMP_V=-14,SLIDE_TIME=30;

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=Math.min(area.clientHeight-4,400);
}

function groundY(){return H*0.75;}

function initGame(){
  const gy=groundY();
  G={
    player:{x:80,y:gy,vy:0,w:36,h:48,jumps:0,maxJumps:2,sliding:false,slideTimer:0},
    obstacles:[],coins:[],particles:[],bgLayers:[
      {objs:[],speed:0.3,y:0.1},
      {objs:[],speed:0.7,y:0.3},
      {objs:[],speed:1.2,y:0.55}
    ],
    score:0,best:parseInt(localStorage.getItem('runner_best')||0),
    speed:4,spawnTimer:0,spawnInterval:80,
    running:false,over:false,frame:0
  };
  initBg();
  document.getElementById('bestDisplay').textContent=G.best;
}

function initBg(){
  G.bgLayers.forEach((l,li)=>{
    l.objs=[];
    for(let i=0;i<8;i++){
      const t=li===0?'star':li===1?'building':'pillar';
      l.objs.push({x:Math.random()*W,w:li===0?2:li===1?20+Math.random()*30:8+Math.random()*15,
        h:li===0?2:li===1?40+Math.random()*80:20+Math.random()*50,type:t});
    }
  });
}

function jump(){
  if(!G.running||G.over)return;
  if(G.player.sliding){G.player.sliding=false;G.player.slideTimer=0;return;}
  if(G.player.jumps<G.player.maxJumps){
    G.player.vy=JUMP_V*(G.player.jumps===0?1:0.85);
    G.player.jumps++;
    spawnParticles(G.player.x,G.player.y+G.player.h,'#00d4ff');
  }
}

function slide(){
  if(!G.running||G.over)return;
  if(G.player.jumps===0&&!G.player.sliding){
    G.player.sliding=true;G.player.slideTimer=SLIDE_TIME;
  }
}

function spawnParticles(x,y,color){
  for(let i=0;i<6;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*4,life:1,color,size:2+Math.random()*3});
}

function spawnObstacle(){
  const gy=groundY();
  const types=['low','mid','tall','coin-low','coin-high'];
  const t=types[Math.floor(Math.random()*types.length)];
  if(t.startsWith('coin')){
    const coinY=t==='coin-low'?gy-60:gy-130;
    G.coins.push({x:W+20,y:coinY,r:12,collected:false});
  } else {
    const h=t==='low'?30:t==='mid'?55:85;
    G.obstacles.push({x:W+10,y:gy-h,w:30,h,type:t});
  }
}

function update(dt){
  if(!G.running||G.over)return;
  G.frame++;
  G.score+=0.1;
  G.speed=4+G.score/200;
  if(G.score>G.best){G.best=G.score|0;localStorage.setItem('runner_best',G.best);}

  const p=G.player,gy=groundY();
  // Physics
  if(p.sliding){p.slideTimer--;if(p.slideTimer<=0){p.sliding=false;}}
  const ph=p.sliding?p.h*0.45:p.h;
  const py=p.sliding?gy-ph:p.y;
  p.vy+=GRAVITY;p.y+=p.vy;
  if(p.y+p.h>=gy){p.y=gy-p.h;p.vy=0;p.jumps=0;}
  if(p.y<0){p.y=0;p.vy=0;}

  const curH=p.sliding?p.h*0.45:p.h;
  const hitbox={x:p.x+4,y:gy-curH+4,w:p.w-8,h:curH-4};

  // Obstacles
  G.obstacles=G.obstacles.filter(o=>{
    o.x-=G.speed;
    if(o.x+o.w<0)return false;
    if(hitbox.x<o.x+o.w&&hitbox.x+hitbox.w>o.x&&hitbox.y<o.y+o.h&&hitbox.y+hitbox.h>o.y)
      {die();return false;}
    return true;
  });

  // Coins
  G.coins=G.coins.filter(c=>{
    c.x-=G.speed;
    if(c.x+c.r<0)return false;
    if(!c.collected&&Math.hypot(p.x+p.w/2-c.x,p.y+p.h/2-c.y)<c.r+p.w/2*0.7){
      c.collected=true;G.score+=25;spawnParticles(c.x,c.y,'#f59e0b');
      setTimeout(()=>{},0);return false;
    }
    return true;
  });

  // Spawn
  G.spawnTimer++;
  if(G.spawnTimer>=Math.max(30,G.spawnInterval-G.score/5)){G.spawnTimer=0;spawnObstacle();}

  // BG parallax
  G.bgLayers.forEach(l=>l.objs.forEach(o=>{
    o.x-=l.speed*G.speed*0.25;if(o.x+200<0)o.x=W+Math.random()*100;
  }));

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=0.04;return p.life>0;});

  updateHUD();
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score|0;
  document.getElementById('speedDisplay').textContent=((G.speed-4)/1*10+1|0);
  document.getElementById('bestDisplay').textContent=G.best;
}

function die(){
  G.over=true;G.running=false;
  spawnParticles(G.player.x,G.player.y,'#ef4444');
  document.getElementById('finalScore').textContent='Score: '+(G.score|0);
  setTimeout(()=>document.getElementById('gameOverOverlay').classList.remove('hidden'),500);
}

function draw(){
  const gy=groundY(),p=G.player;
  // Sky gradient
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#050508');sky.addColorStop(0.6,'#0a0a20');sky.addColorStop(1,'#0f0f30');
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);

  // BG layers
  G.bgLayers.forEach((l,li)=>{
    const alpha=[0.4,0.25,0.15][li];
    const colors=['rgba(255,255,255,0.6)','rgba(59,130,246,0.3)','rgba(168,85,247,0.25)'];
    ctx.fillStyle=colors[li];ctx.globalAlpha=alpha;
    l.objs.forEach(o=>{
      if(o.type==='star')ctx.fillRect(o.x,H*l.y,o.w,o.h);
      else ctx.fillRect(o.x,H-o.h,o.w,o.h);
    });ctx.globalAlpha=1;
  });

  // Ground
  ctx.fillStyle='rgba(0,212,255,.15)';ctx.fillRect(0,gy,W,H-gy);
  ctx.strokeStyle='rgba(0,212,255,.5)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();
  // Grid lines on ground
  ctx.strokeStyle='rgba(0,212,255,.08)';ctx.lineWidth=1;
  for(let x=(-G.score*G.speed*0.5)%60;x<W;x+=60){
    ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x-30,H);ctx.stroke();
  }

  // Coins
  G.coins.forEach(c=>{
    const pulse=0.8+0.2*Math.sin(G.frame/10);
    ctx.shadowBlur=12;ctx.shadowColor='#f59e0b';ctx.fillStyle='#f59e0b';ctx.globalAlpha=pulse;
    ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(245,158,11,.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(c.x,c.y,c.r*1.4,0,Math.PI*2);ctx.stroke();
  });

  // Obstacles
  G.obstacles.forEach(o=>{
    ctx.shadowBlur=10;ctx.shadowColor='#ef4444';
    const grd=ctx.createLinearGradient(o.x,o.y,o.x+o.w,o.y);
    grd.addColorStop(0,'#7c0000');grd.addColorStop(0.5,'#ef4444');grd.addColorStop(1,'#7c0000');
    ctx.fillStyle=grd;ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,3);ctx.fill();
    ctx.strokeStyle='rgba(239,68,68,.5)';ctx.lineWidth=1;ctx.stroke();
    ctx.shadowBlur=0;
    // Hazard stripes
    ctx.fillStyle='rgba(0,0,0,.2)';
    for(let i=0;i<o.h;i+=10){ctx.fillRect(o.x,o.y+i,o.w,5);}
  });

  // Player
  const ph=p.sliding?p.h*0.45:p.h;
  const py=gy-ph;
  ctx.shadowBlur=16;ctx.shadowColor='#00d4ff';
  const pg=ctx.createLinearGradient(p.x,py,p.x+p.w,py+ph);
  pg.addColorStop(0,'#00d4ff');pg.addColorStop(1,'#7c3aed');
  ctx.fillStyle=pg;
  ctx.beginPath();ctx.roundRect(p.x,py,p.w,ph,6);ctx.fill();
  // Visor
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.roundRect(p.x+6,py+ph*0.2,p.w-12,ph*0.2,3);ctx.fill();
  // Legs animation (only when on ground)
  if(p.jumps===0&&!p.sliding){
    const legAnim=Math.sin(G.frame/5)*8;
    ctx.fillStyle='#7c3aed';
    ctx.fillRect(p.x+4,py+ph,10,4+legAnim);
    ctx.fillRect(p.x+p.w-14,py+ph,10,4-legAnim);
  }
  ctx.shadowBlur=0;

  // Particles
  G.particles.forEach(pt=>{
    ctx.globalAlpha=pt.life;ctx.fillStyle=pt.color;ctx.shadowBlur=5;ctx.shadowColor=pt.color;
    ctx.beginPath();ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
}

function gameLoop(ts){
  const dt=ts-lastTs;lastTs=ts;
  update(dt);draw();
  if(!G.over)animId=requestAnimationFrame(gameLoop);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);lastTs=performance.now();animId=requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown',e=>{
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){e.preventDefault();
    if(G.over)startGame();else jump();}
  if(e.code==='ArrowDown'||e.code==='KeyS')slide();
});
canvas.addEventListener('click',()=>{if(G.over)startGame();else jump();});
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
