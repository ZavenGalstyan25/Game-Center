'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,keys={};
function S(){return W/600;}

const ALIEN_ROWS=4,ALIEN_COLS=10;
const ALIEN_TYPES=[
  {pts:30,color:'#ef4444',glow:'rgba(239,68,68,.6)'},
  {pts:20,color:'#a855f7',glow:'rgba(168,85,247,.6)'},
  {pts:20,color:'#a855f7',glow:'rgba(168,85,247,.6)'},
  {pts:10,color:'#10b981',glow:'rgba(16,185,129,.6)'},
];

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function buildAliens(){
  const aliens=[];
  const s=S();
  const aw=36*s,ah=26*s,gx=10*s,gy=8*s;
  const startX=(W-(ALIEN_COLS*(aw+gx)-gx))/2;
  const startY=80*s;
  for(let r=0;r<ALIEN_ROWS;r++)
    for(let c=0;c<ALIEN_COLS;c++){
      const t=ALIEN_TYPES[r]||ALIEN_TYPES[3];
      aliens.push({x:startX+c*(aw+gx),y:startY+r*(ah+gy),w:aw,h:ah,
        type:r,color:t.color,glow:t.glow,pts:t.pts,active:true,animFrame:0});
    }
  return aliens;
}

function buildShields(){
  const shields=[];
  const s=S();
  const sw=60*s,sh=40*s;
  const positions=[0.2,0.4,0.6,0.8];
  positions.forEach(p=>{
    const bx=W*p-sw/2,by=H-100*s;
    const cells=[];
    const cw=6*s,ch=6*s;
    const cols=Math.floor(sw/cw),rows=Math.floor(sh/ch);
    for(let r=0;r<rows;r++)
      for(let c=0;c<cols;c++){
        const skip=(r===rows-1&&(c<2||c>=cols-2));
        cells.push({x:bx+c*cw,y:by+r*ch,w:cw,h:ch,active:!skip,hp:3});
      }
    shields.push(cells);
  });
  return shields;
}

function initGame(){
  const s=S();
  G={
    player:{x:W/2,y:H-40*s,w:40*s,h:20*s,speed:5*s},
    aliens:buildAliens(),shields:buildShields(),
    bullets:[],alienBullets:[],particles:[],
    ufo:null,ufoTimer:400,
    score:0,lives:3,wave:1,best:parseInt(localStorage.getItem('inv_best')||0),
    alienDir:1,alienDrop:false,alienSpeed:0.8*s,alienMoveTimer:0,alienMoveInterval:30,
    alienAnimTimer:0,shootCooldown:0,
    running:false,paused:false,over:false
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('waveDisplay').textContent=G.wave;
  document.getElementById('bestDisplay').textContent=G.best;
}

function spawnParticles(x,y,color){
  for(let i=0;i<10;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5,life:1,color,size:2+Math.random()*2});
}

function update(){
  const p=G.player;const s=S();
  if(keys['ArrowLeft']||keys['KeyA'])p.x=Math.max(0,p.x-p.speed);
  if(keys['ArrowRight']||keys['KeyD'])p.x=Math.min(W-p.w,p.x+p.speed);
  if((keys['Space']||keys['KeyZ'])&&G.shootCooldown<=0){
    G.bullets.push({x:p.x+p.w/2,y:p.y,vy:-10*s,w:3*s,h:12*s});
    G.shootCooldown=15;
  }
  if(G.shootCooldown>0)G.shootCooldown--;

  // Player bullets
  G.bullets=G.bullets.filter(b=>{b.y+=b.vy;
    // vs shields
    for(const sh of G.shields)for(const c of sh)if(c.active&&b.x>c.x&&b.x<c.x+c.w&&b.y>c.y&&b.y<c.y+c.h){c.hp--;if(c.hp<=0)c.active=false;b.y=-999;return false;}
    // vs aliens
    for(const a of G.aliens)if(a.active&&b.x>a.x&&b.x<a.x+a.w&&b.y>a.y&&b.y<a.y+a.h){
      a.active=false;G.score+=a.pts;spawnParticles(a.x+a.w/2,a.y+a.h/2,a.color);
      if(G.score>G.best){G.best=G.score;localStorage.setItem('inv_best',G.best);}
      updateHUD();b.y=-999;return false;
    }
    // vs ufo
    if(G.ufo&&b.x>G.ufo.x&&b.x<G.ufo.x+G.ufo.w&&b.y>G.ufo.y&&b.y<G.ufo.y+G.ufo.h){
      const ufoPts=50+Math.floor(Math.random()*4)*25;
      G.score+=ufoPts;spawnParticles(G.ufo.x+G.ufo.w/2,G.ufo.y,'#ec4899');G.ufo=null;
      updateHUD();b.y=-999;return false;
    }
    return b.y>0;
  });

  // Aliens move
  G.alienMoveTimer++;
  const activeAliens=G.aliens.filter(a=>a.active);
  if(activeAliens.length===0){G.wave++;G.aliens=buildAliens();G.alienMoveInterval=Math.max(8,30-G.wave*2);return;}

  const moveInterval=Math.max(4,G.alienMoveInterval-(30-activeAliens.length));
  if(G.alienMoveTimer>=moveInterval){
    G.alienMoveTimer=0;
    G.alienAnimTimer^=1;
    let hitEdge=false;
    activeAliens.forEach(a=>{a.x+=G.alienDir*G.alienSpeed*4;});
    const minX=Math.min(...activeAliens.map(a=>a.x));
    const maxX=Math.max(...activeAliens.map(a=>a.x+a.w));
    if(minX<0||maxX>W){hitEdge=true;}
    if(hitEdge){
      G.alienDir*=-1;
      G.aliens.filter(a=>a.active).forEach(a=>{a.y+=20*s;});
    }
    // Check if aliens reached player
    if(Math.max(...activeAliens.map(a=>a.y+a.h))>p.y){loseLife();return;}
  }

  // Alien shoot
  if(Math.random()<0.008*G.wave){
    const cols=new Set(activeAliens.map(a=>Math.round(a.x/(36*s))));
    cols.forEach(col=>{
      const colAliens=activeAliens.filter(a=>Math.round(a.x/(36*s))===col);
      if(colAliens.length&&Math.random()<0.3){
        const shooter=colAliens[colAliens.length-1];
        G.alienBullets.push({x:shooter.x+shooter.w/2,y:shooter.y+shooter.h,vy:4*s,w:3*s,h:12*s});
      }
    });
  }

  // Alien bullets
  G.alienBullets=G.alienBullets.filter(b=>{b.y+=b.vy;
    for(const sh of G.shields)for(const c of sh)if(c.active&&b.x>c.x&&b.x<c.x+c.w&&b.y>c.y&&b.y<c.y+c.h){c.hp--;if(c.hp<=0)c.active=false;b.y=9999;return false;}
    if(b.x>p.x&&b.x<p.x+p.w&&b.y>p.y&&b.y<p.y+p.h){loseLife();b.y=9999;return false;}
    return b.y<H;
  });

  // UFO
  G.ufoTimer--;
  if(G.ufoTimer<=0&&!G.ufo){G.ufo={x:-60,y:30*s,w:50*s,h:22*s,speed:2*s};G.ufoTimer=600+Math.random()*400;}
  if(G.ufo){G.ufo.x+=G.ufo.speed;if(G.ufo.x>W+60)G.ufo=null;}

  G.particles=G.particles.filter(p2=>{p2.x+=p2.vx;p2.y+=p2.vy;p2.life-=0.03;return p2.life>0;});
}

function loseLife(){
  spawnParticles(G.player.x+G.player.w/2,G.player.y,'#00d4ff');
  G.lives--;updateHUD();
  if(G.lives<=0)endGame();
}

function drawAlien(a,frame){
  ctx.save();ctx.translate(a.x+a.w/2,a.y+a.h/2);
  ctx.shadowBlur=10;ctx.shadowColor=a.glow;ctx.fillStyle=a.color;
  const t=a.type,w=a.w,h=a.h;
  if(t===0){// Top alien - saucer
    ctx.beginPath();ctx.ellipse(0,0,w*0.5,h*0.4,0,0,Math.PI*2);ctx.fill();
    ctx.fillRect(-w*0.2,h*0.3,w*0.4,h*0.2);
  }else if(t===1||t===2){// Mid alien - crab
    ctx.fillRect(-w*0.35,-h*0.3,w*0.7,h*0.6);
    const legOff=frame?2:0;
    [-1,1].forEach(side=>{
      ctx.fillRect(side*(w*0.35),-h*0.15+legOff,w*0.12,h*0.3);
      ctx.fillRect(side*(w*0.48),-h*0.3+legOff,w*0.1,h*0.2);
    });
  }else{// Bottom alien - squid
    ctx.beginPath();ctx.arc(0,-h*0.1,w*0.38,0,Math.PI*2);ctx.fill();
    const legOff2=frame?-2:0;
    for(let i=-2;i<=2;i++)ctx.fillRect(i*w*0.18-w*0.06,h*0.2+legOff2,w*0.1,h*0.3);
  }
  ctx.shadowBlur=0;ctx.restore();
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  // Stars
  ctx.fillStyle='rgba(255,255,255,.3)';
  for(let i=0;i<100;i++){ctx.fillRect((i*173)%W,(i*93)%H,1,1);}

  const s=S();
  // Shields
  G.shields.forEach(sh=>sh.forEach(c=>{
    if(!c.active)return;
    const alpha=c.hp/3;ctx.globalAlpha=alpha;
    ctx.fillStyle='#10b981';ctx.fillRect(c.x,c.y,c.w,c.h);ctx.globalAlpha=1;
  }));

  // Aliens
  G.aliens.forEach(a=>{if(a.active)drawAlien(a,G.alienAnimTimer);});

  // UFO
  if(G.ufo){
    const u=G.ufo;ctx.shadowBlur=16;ctx.shadowColor='#ec4899';ctx.fillStyle='#ec4899';
    ctx.beginPath();ctx.ellipse(u.x+u.w/2,u.y+u.h/2,u.w/2,u.h/2,0,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    // Pulsing glow ring
    ctx.strokeStyle='rgba(236,72,153,.4)';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(u.x+u.w/2,u.y+u.h/2,u.w/2+8,u.h/2+6,0,0,Math.PI*2);ctx.stroke();
  }

  // Player
  const p=G.player;
  ctx.shadowBlur=14;ctx.shadowColor='#00d4ff';ctx.fillStyle='#00d4ff';
  // Ship body
  ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y);ctx.lineTo(p.x+p.w,p.y+p.h);ctx.lineTo(p.x,p.y+p.h);ctx.closePath();ctx.fill();
  // Cannon
  ctx.fillStyle='#7dd3fc';ctx.fillRect(p.x+p.w*0.44,p.y-p.h*0.4,p.w*0.12,p.h*0.4);
  ctx.shadowBlur=0;

  // Player bullets
  G.bullets.forEach(b=>{
    ctx.shadowBlur=8;ctx.shadowColor='#00d4ff';ctx.fillStyle='#00d4ff';
    ctx.fillRect(b.x-b.w/2,b.y,b.w,b.h);ctx.shadowBlur=0;
  });

  // Alien bullets
  G.alienBullets.forEach(b=>{
    ctx.shadowBlur=6;ctx.shadowColor='#ef4444';ctx.fillStyle='#ef4444';
    ctx.fillRect(b.x-b.w/2,b.y,b.w,b.h);ctx.shadowBlur=0;
  });

  // Particles
  G.particles.forEach(p2=>{
    ctx.globalAlpha=p2.life;ctx.fillStyle=p2.color;ctx.shadowBlur=4;ctx.shadowColor=p2.color;
    ctx.beginPath();ctx.arc(p2.x,p2.y,p2.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });

  // Ground line
  ctx.strokeStyle='rgba(0,212,255,.3)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,H-16*s);ctx.lineTo(W,H-16*s);ctx.stroke();
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

document.addEventListener('keydown',e=>{keys[e.code]=true;
  if(['Space','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
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
  let p=0;const iv=setInterval(()=>{p+=Math.random()*25;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
