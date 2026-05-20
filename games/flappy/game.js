'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;
const PIPE_W=60,GAP=160,GRAVITY=0.55,FLAP=-9;

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=Math.min(area.clientWidth-4,480);
  H=canvas.height=area.clientHeight-4;
}

function initGame(){
  G={
    bird:{x:W*0.25,y:H*0.5,vy:0,rot:0},
    pipes:[],particles:[],
    score:0,best:parseInt(localStorage.getItem('flappy_best')||0),
    running:false,over:false,started:false,
    pipeTimer:0,speed:3,bgOffset:0
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function flap(){
  if(G.over)return;
  if(!G.started){G.started=true;G.running=true;}
  G.bird.vy=FLAP;
  for(let i=0;i<5;i++)
    G.particles.push({x:G.bird.x-10,y:G.bird.y,vx:-2-Math.random()*2,vy:(Math.random()-.5)*3,
      life:1,color:'#f59e0b',size:2+Math.random()*2});
}

function spawnPipe(){
  const minY=80,maxY=H-GAP-80;
  const topH=minY+Math.random()*(maxY-minY);
  G.pipes.push({x:W+10,topH,scored:false});
}

function update(){
  if(!G.running)return;
  G.bgOffset=(G.bgOffset+G.speed*0.3)%W;
  G.pipeTimer++;
  if(G.pipeTimer>=(90-G.score*1.2|0)){G.pipeTimer=0;spawnPipe();}

  const b=G.bird;
  b.vy+=GRAVITY;b.y+=b.vy;
  b.rot=Math.max(-25,Math.min(90,b.vy*5));

  if(b.y<0){b.y=0;b.vy=0;}
  if(b.y>H-20){die();return;}

  G.pipes.forEach(p=>{p.x-=G.speed;});
  G.pipes=G.pipes.filter(p=>p.x>-PIPE_W-10);

  const bx=b.x,by=b.y,br=12;
  for(const p of G.pipes){
    const botY=p.topH+GAP;
    if(bx+br>p.x&&bx-br<p.x+PIPE_W){
      if(by-br<p.topH||by+br>botY){die();return;}
    }
    if(!p.scored&&p.x+PIPE_W<bx){
      p.scored=true;G.score++;
      G.speed=3+G.score*0.08;
      if(G.score>G.best){G.best=G.score;localStorage.setItem('flappy_best',G.best);}
      document.getElementById('scoreDisplay').textContent=G.score;
      document.getElementById('bestDisplay').textContent=G.best;
    }
  }
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.05;return p.life>0;});
}

function drawBird(){
  const b=G.bird;
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot*Math.PI/180);
  // Body
  ctx.shadowBlur=14;ctx.shadowColor='#f59e0b';
  ctx.fillStyle='#f59e0b';
  ctx.beginPath();ctx.ellipse(0,0,16,12,0,0,Math.PI*2);ctx.fill();
  // Wing flap
  const wAng=Math.sin(Date.now()/80)*0.5;
  ctx.fillStyle='#fbbf24';
  ctx.beginPath();ctx.ellipse(-4,0,10,6,wAng,0,Math.PI*2);ctx.fill();
  // Eye
  ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,-3,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.arc(9,-3,2,0,Math.PI*2);ctx.fill();
  // Beak
  ctx.fillStyle='#ef4444';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(20,3);ctx.lineTo(20,-3);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.restore();
}

function drawPipes(){
  G.pipes.forEach(p=>{
    const botY=p.topH+GAP;
    // Top pipe
    const gt=ctx.createLinearGradient(p.x,0,p.x+PIPE_W,0);
    gt.addColorStop(0,'#065f46');gt.addColorStop(0.5,'#10b981');gt.addColorStop(1,'#065f46');
    ctx.shadowBlur=10;ctx.shadowColor='rgba(16,185,129,.5)';
    ctx.fillStyle=gt;ctx.fillRect(p.x,0,PIPE_W,p.topH);
    // Cap top
    ctx.fillStyle='#10b981';ctx.beginPath();ctx.roundRect(p.x-8,p.topH-18,PIPE_W+16,18,4);ctx.fill();
    // Bottom pipe
    ctx.fillStyle=gt;ctx.fillRect(p.x,botY,PIPE_W,H-botY);
    ctx.fillStyle='#10b981';ctx.beginPath();ctx.roundRect(p.x-8,botY,PIPE_W+16,18,4);ctx.fill();
    ctx.shadowBlur=0;
  });
}

function draw(){
  // Sky gradient
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,'#050508');sky.addColorStop(1,'#0a0a18');
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  // Scrolling stars
  ctx.fillStyle='rgba(255,255,255,.5)';
  for(let i=0;i<60;i++){
    const sx=((i*137.5+G.bgOffset)%W+W)%W;
    const sy=(i*73.1)%H;
    ctx.fillRect(sx,sy,1+(i%3===0?1:0),1);
  }
  // Ground
  const gy=ctx.createLinearGradient(0,H-30,0,H);
  gy.addColorStop(0,'#10b981');gy.addColorStop(1,'#065f46');
  ctx.fillStyle=gy;ctx.fillRect(0,H-24,W,24);
  drawPipes();
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  });
  drawBird();
  // Score overlay on canvas
  ctx.fillStyle='rgba(255,255,255,.9)';ctx.font=`bold 40px "Exo 2",sans-serif`;
  ctx.textAlign='center';ctx.shadowBlur=10;ctx.shadowColor='rgba(0,0,0,.8)';
  ctx.fillText(G.score,W/2,60);ctx.shadowBlur=0;ctx.textAlign='left';
}

function die(){
  G.over=true;G.running=false;
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function gameLoop(){
  if(!G.over){update();draw();}
  if(!G.over)animId=requestAnimationFrame(gameLoop);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  draw();
  cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();if(G.over)startGame();else flap();}
});
canvas.addEventListener('click',()=>{if(G.over)startGame();else flap();});
document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('restartBtn').addEventListener('click',startGame);
window.addEventListener('resize',()=>{resize();if(G.running){}});

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
