'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,keys={};

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function randAsteroid(size,x,y){
  const pts=7+Math.floor(Math.random()*5);
  const verts=[];
  for(let i=0;i<pts;i++){
    const a=(i/pts)*Math.PI*2;
    const r=size*(0.7+Math.random()*0.3);
    verts.push({x:Math.cos(a)*r,y:Math.sin(a)*r});
  }
  if(x===undefined){
    do{x=Math.random()*W;y=Math.random()*H;}
    while(Math.hypot(x-W/2,y-H/2)<120);
  }
  const speed=(0.5+Math.random()*0.8)*(3-size/40);
  const ang=Math.random()*Math.PI*2;
  return{x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,
    rot:0,rotSpeed:(Math.random()-.5)*0.04,verts,size,active:true};
}

function initGame(){
  G={
    ship:{x:W/2,y:H/2,vx:0,vy:0,rot:-Math.PI/2,thrusting:false,invincible:120},
    bullets:[],asteroids:[],particles:[],
    score:0,lives:3,wave:1,best:parseInt(localStorage.getItem('ast_best')||0),
    running:false,paused:false,over:false,
    shootCooldown:0,respawnTimer:0
  };
  spawnWave();
  document.getElementById('bestDisplay').textContent=G.best;
}

function spawnWave(){
  G.asteroids=[];
  for(let i=0;i<3+G.wave;i++)G.asteroids.push(randAsteroid(40));
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('waveDisplay').textContent=G.wave;
  document.getElementById('bestDisplay').textContent=G.best;
}

function shoot(){
  if(G.shootCooldown>0)return;
  G.shootCooldown=12;
  const ship=G.ship;
  G.bullets.push({x:ship.x+Math.cos(ship.rot)*18,y:ship.y+Math.sin(ship.rot)*18,
    vx:Math.cos(ship.rot)*8+ship.vx,vy:Math.sin(ship.rot)*8+ship.vy,life:60});
}

function hyperspace(){
  G.ship.x=Math.random()*W;G.ship.y=Math.random()*H;
  G.ship.vx=0;G.ship.vy=0;G.ship.invincible=90;
}

function spawnParticles(x,y,n,color){
  for(let i=0;i<n;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,
      life:1,color:color||'#f59e0b',size:1+Math.random()*3});
}

function circleHit(ax,ay,ar,bx,by,br){return Math.hypot(ax-bx,ay-by)<ar+br;}

function wrapPos(obj){
  if(obj.x<0)obj.x+=W;if(obj.x>W)obj.x-=W;
  if(obj.y<0)obj.y+=H;if(obj.y>H)obj.y-=H;
}

function splitAsteroid(ast,x,y){
  if(ast.size>18){
    for(let i=0;i<2;i++)
      G.asteroids.push(randAsteroid(ast.size*0.55,ast.x+(Math.random()-.5)*10,ast.y+(Math.random()-.5)*10));
  }
  spawnParticles(ast.x,ast.y,12,'#f59e0b');
}

function update(){
  const ship=G.ship;
  if(G.respawnTimer>0){G.respawnTimer--;return;}
  if(G.shootCooldown>0)G.shootCooldown--;
  if(ship.invincible>0)ship.invincible--;

  // Ship controls
  if(keys['ArrowLeft']||keys['KeyA'])ship.rot-=0.065;
  if(keys['ArrowRight']||keys['KeyD'])ship.rot+=0.065;
  ship.thrusting=keys['ArrowUp']||keys['KeyW'];
  if(ship.thrusting){
    ship.vx+=Math.cos(ship.rot)*0.22;ship.vy+=Math.sin(ship.rot)*0.22;
    const maxV=6;const v=Math.hypot(ship.vx,ship.vy);
    if(v>maxV){ship.vx=ship.vx/v*maxV;ship.vy=ship.vy/v*maxV;}
    spawnParticles(ship.x-Math.cos(ship.rot)*16,ship.y-Math.sin(ship.rot)*16,2,'rgba(0,212,255,0.8)');
  }
  ship.vx*=0.99;ship.vy*=0.99;
  ship.x+=ship.vx;ship.y+=ship.vy;wrapPos(ship);

  if(keys['Space'])shoot();

  // Bullets
  G.bullets=G.bullets.filter(b=>{b.x+=b.vx;b.y+=b.vy;b.life--;wrapPos(b);return b.life>0;});

  // Asteroids
  G.asteroids.forEach(a=>{a.x+=a.vx;a.y+=a.vy;a.rot+=a.rotSpeed;wrapPos(a);});

  // Bullet-asteroid collisions
  for(let i=G.bullets.length-1;i>=0;i--){
    const b=G.bullets[i];
    for(let j=G.asteroids.length-1;j>=0;j--){
      const a=G.asteroids[j];
      if(circleHit(b.x,b.y,4,a.x,a.y,a.size*0.8)){
        G.bullets.splice(i,1);
        const pts=a.size>30?20:a.size>18?50:100;
        G.score+=pts;
        if(G.score>G.best){G.best=G.score;localStorage.setItem('ast_best',G.best);}
        splitAsteroid(a);
        G.asteroids.splice(j,1);
        updateHUD();
        break;
      }
    }
  }

  // Ship-asteroid collision
  if(ship.invincible<=0){
    for(const a of G.asteroids){
      if(circleHit(ship.x,ship.y,10,a.x,a.y,a.size*0.7)){
        spawnParticles(ship.x,ship.y,20,'#00d4ff');
        G.lives--;updateHUD();
        if(G.lives<=0){endGame();return;}
        ship.x=W/2;ship.y=H/2;ship.vx=0;ship.vy=0;
        ship.invincible=150;G.respawnTimer=60;return;
      }
    }
  }

  // Wave clear
  if(G.asteroids.length===0){
    G.wave++;G.score+=G.wave*200;updateHUD();spawnWave();
  }

  // Particles
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.025;return p.life>0;});
}

function drawShip(){
  const s=G.ship;
  if(s.invincible>0&&Math.floor(s.invincible/6)%2===0)return;
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);
  ctx.shadowBlur=16;ctx.shadowColor='#00d4ff';
  ctx.strokeStyle='#00d4ff';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-12,10);ctx.lineTo(-8,0);ctx.lineTo(-12,-10);ctx.closePath();ctx.stroke();
  if(s.thrusting){
    ctx.strokeStyle='rgba(245,158,11,.9)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(-18-Math.random()*8,0);ctx.stroke();
  }
  ctx.shadowBlur=0;ctx.restore();
}

function drawAsteroid(a){
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);
  ctx.strokeStyle='rgba(245,158,11,.8)';ctx.lineWidth=1.5;
  ctx.shadowBlur=8;ctx.shadowColor='rgba(245,158,11,.4)';
  ctx.beginPath();
  a.verts.forEach((v,i)=>i===0?ctx.moveTo(v.x,v.y):ctx.lineTo(v.x,v.y));
  ctx.closePath();ctx.stroke();
  ctx.shadowBlur=0;ctx.restore();
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  // Stars
  ctx.fillStyle='rgba(255,255,255,.4)';
  for(let i=0;i<80;i++){
    const sx=(i*137.5)%W,sy=(i*97.3)%H;
    ctx.fillRect(sx,sy,1,1);
  }
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=4;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
  G.bullets.forEach(b=>{
    ctx.shadowBlur=8;ctx.shadowColor='#fff';ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  });
  G.asteroids.forEach(drawAsteroid);
  if(!G.over&&G.respawnTimer===0)drawShip();
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
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

function pause(){
  if(G.over)return;
  if(G.paused){G.paused=false;G.running=true;document.getElementById('pauseOverlay').classList.add('hidden');
    animId=requestAnimationFrame(gameLoop);}
  else{G.paused=true;G.running=false;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.code==='KeyP')pause();
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(G.running)hyperspace();}
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('pauseBtn').addEventListener('click',pause);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('resumeBtn').addEventListener('click',pause);
window.addEventListener('resize',()=>{resize();if(G.running){}});

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*25;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
