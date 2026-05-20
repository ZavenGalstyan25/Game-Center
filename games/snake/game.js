'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const GRID=20;
let G={},animId=null,lastTime=0,acc=0;

function resize(){
  const area=document.querySelector('.game-area');
  const sz=Math.min(area.clientWidth-20,area.clientHeight-20);
  canvas.width=canvas.height=Math.floor(sz/GRID)*GRID;
}

function CS(){return canvas.width/GRID;}

function rnd(n){return Math.floor(Math.random()*n);}

function initGame(){
  const mid=Math.floor(GRID/2);
  G={
    snake:[{x:mid,y:mid},{x:mid-1,y:mid},{x:mid-2,y:mid}],
    dir:{x:1,y:0},nextDir:{x:1,y:0},
    food:null,bonus:null,bonusTimer:0,
    score:0,best:parseInt(localStorage.getItem('snake_best')||0),
    speed:1,interval:150,running:false,over:false,paused:false,
    particles:[]
  };
  placeFood();
  document.getElementById('bestDisplay').textContent=G.best;
}

function placeFood(){
  let pos;
  do{pos={x:rnd(GRID),y:rnd(GRID)};}
  while(G.snake.some(s=>s.x===pos.x&&s.y===pos.y));
  G.food=pos;
  if(Math.random()<0.15)placeBonus();
}

function placeBonus(){
  let pos;
  do{pos={x:rnd(GRID),y:rnd(GRID)};}
  while(G.snake.some(s=>s.x===pos.x&&s.y===pos.y)||
        (G.food&&pos.x===G.food.x&&pos.y===G.food.y));
  G.bonus=pos;G.bonusTimer=120;
}

function step(){
  G.dir={...G.nextDir};
  const head={x:(G.snake[0].x+G.dir.x+GRID)%GRID,y:(G.snake[0].y+G.dir.y+GRID)%GRID};
  if(G.snake.some(s=>s.x===head.x&&s.y===head.y)){die();return;}
  G.snake.unshift(head);
  let grew=false;
  if(head.x===G.food.x&&head.y===G.food.y){
    G.score+=10*G.speed;grew=true;
    spawnParticles(head.x,head.y,'#10b981');placeFood();
  }
  if(G.bonus&&head.x===G.bonus.x&&head.y===G.bonus.y){
    G.score+=50*G.speed;grew=true;
    spawnParticles(head.x,head.y,'#f59e0b');G.bonus=null;
  }
  if(!grew)G.snake.pop();
  const len=G.snake.length;
  G.speed=Math.floor(len/5)+1;
  G.interval=Math.max(60,150-G.speed*12);
  if(G.bonus){G.bonusTimer--;if(G.bonusTimer<=0)G.bonus=null;}
  if(G.score>G.best){G.best=G.score;localStorage.setItem('snake_best',G.best);}
  updateHUD();
}

function spawnParticles(gx,gy,color){
  const cs=CS();
  const cx=(gx+.5)*cs,cy=(gy+.5)*cs;
  for(let i=0;i<10;i++)
    G.particles.push({x:cx,y:cy,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,
      life:1,color,size:2+Math.random()*3});
}

function die(){
  G.over=true;G.running=false;
  if(G.score>G.best){G.best=G.score;localStorage.setItem('snake_best',G.best);}
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('finalLength').textContent='Length: '+G.snake.length;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('lengthDisplay').textContent=G.snake.length;
  document.getElementById('speedDisplay').textContent=G.speed;
  document.getElementById('bestDisplay').textContent=G.best;
}

function draw(){
  const cs=CS();
  ctx.fillStyle='#050508';ctx.fillRect(0,0,canvas.width,canvas.height);

  // Grid
  ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;
  for(let i=0;i<=GRID;i++){
    ctx.beginPath();ctx.moveTo(i*cs,0);ctx.lineTo(i*cs,canvas.height);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*cs);ctx.lineTo(canvas.width,i*cs);ctx.stroke();
  }

  // Food
  if(G.food){
    const fx=(G.food.x+.5)*cs,fy=(G.food.y+.5)*cs,fr=cs*0.38;
    ctx.shadowBlur=18;ctx.shadowColor='#ef4444';
    ctx.fillStyle='#ef4444';
    ctx.beginPath();ctx.arc(fx,fy,fr,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    const pulse=0.85+0.15*Math.sin(Date.now()/200);
    ctx.strokeStyle='rgba(239,68,68,.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(fx,fy,fr*pulse*1.4,0,Math.PI*2);ctx.stroke();
  }

  // Bonus
  if(G.bonus){
    const bx=(G.bonus.x+.5)*cs,by=(G.bonus.y+.5)*cs,br=cs*0.4;
    const alpha=G.bonusTimer/120;
    ctx.shadowBlur=20;ctx.shadowColor=`rgba(245,158,11,${alpha})`;
    ctx.fillStyle=`rgba(245,158,11,${alpha})`;
    ctx.beginPath();
    const sides=5,step2=Math.PI*2/sides,rot=-Math.PI/2;
    ctx.moveTo(bx+br*Math.cos(rot),by+br*Math.sin(rot));
    for(let i=1;i<sides;i++)ctx.lineTo(bx+br*Math.cos(rot+step2*i),by+br*Math.sin(rot+step2*i));
    ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  }

  // Snake body
  G.snake.forEach((seg,i)=>{
    const t=1-i/G.snake.length;
    const green=`rgba(16,185,129,${0.3+t*0.7})`;
    const cyan=`rgba(0,212,255,${0.3+t*0.7})`;
    ctx.shadowBlur=i===0?16:6;
    ctx.shadowColor=i===0?'#10b981':'rgba(0,212,255,.4)';
    ctx.fillStyle=i===0?'#10b981':(i%2===0?green:cyan);
    const pad=i===0?1:2;
    ctx.beginPath();ctx.roundRect(seg.x*cs+pad,seg.y*cs+pad,cs-pad*2,cs-pad*2,i===0?4:2);ctx.fill();
    if(i===0){
      // Eyes
      const ex1=seg.x*cs+(G.dir.x===0?cs*0.3:G.dir.x>0?cs*0.7:cs*0.2),
            ey1=seg.y*cs+(G.dir.y===0?cs*0.3:G.dir.y>0?cs*0.7:cs*0.2);
      const ex2=seg.x*cs+(G.dir.x===0?cs*0.7:G.dir.x>0?cs*0.7:cs*0.2),
            ey2=seg.y*cs+(G.dir.y===0?cs*0.7:G.dir.y>0?cs*0.7:cs*0.2);
      ctx.shadowBlur=0;ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(ex1,ey1,cs*0.1,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(ex2,ey2,cs*0.1,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;
  });

  // Particles
  G.particles=G.particles.filter(p=>{
    p.x+=p.vx;p.y+=p.vy;p.life-=0.04;
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
    return p.life>0;
  });
}

function gameLoop(ts){
  if(!G.running)return;
  const dt=ts-lastTime;lastTime=ts;
  acc+=dt;
  if(acc>=G.interval){acc=0;step();}
  draw();
  animId=requestAnimationFrame(gameLoop);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;acc=0;lastTime=performance.now();
  cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

function pause(){
  if(G.over)return;
  if(G.paused){G.paused=false;G.running=true;document.getElementById('pauseOverlay').classList.add('hidden');
    lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}
  else{G.paused=true;G.running=false;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

document.addEventListener('keydown',e=>{
  switch(e.code){
    case'ArrowLeft':case'KeyA':if(G.dir.x!==1)G.nextDir={x:-1,y:0};e.preventDefault();break;
    case'ArrowRight':case'KeyD':if(G.dir.x!==-1)G.nextDir={x:1,y:0};e.preventDefault();break;
    case'ArrowUp':case'KeyW':if(G.dir.y!==1)G.nextDir={x:0,y:-1};e.preventDefault();break;
    case'ArrowDown':case'KeyS':if(G.dir.y!==-1)G.nextDir={x:0,y:1};e.preventDefault();break;
    case'KeyP':pause();break;
  }
});

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('pauseBtn').addEventListener('click',pause);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('resumeBtn').addEventListener('click',pause);
window.addEventListener('resize',()=>{if(G.running||G.paused){resize();draw();}else resize();});

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
