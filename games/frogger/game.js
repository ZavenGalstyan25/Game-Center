'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,keys={};
const ROWS=14,COLS=12;

function resize(){
  const area=document.querySelector('.game-area');
  const cs=Math.floor(Math.min(area.clientWidth-20,area.clientHeight-20)/ROWS);
  W=canvas.width=cs*COLS;H=canvas.height=cs*ROWS;
  canvas.dataset.cs=cs;
}

function CS(){return parseInt(canvas.dataset.cs)||40;}

const LANE_TYPES=[
  'safe','road','road','road','road','safe',
  'log','log','log','log','safe','safe','safe','safe'
];

function buildLanes(){
  const cs=CS();
  return LANE_TYPES.map((type,i)=>{
    if(type==='safe'||i>=11)return{type:'safe',objs:[]};
    const dir=Math.random()<0.5?1:-1;
    const baseSpeed=(1+Math.random())*cs/60*(1+G.round*0.15);
    const n=2+Math.floor(Math.random()*3);
    const spacing=W/n;
    const objs=[];
    for(let j=0;j<n;j++){
      const w=(type==='road'?60:90+Math.floor(Math.random()*60))*cs/50;
      objs.push({x:j*spacing,w,speed:baseSpeed*dir});
    }
    return{type,dir,objs};
  });
}

function initGame(){
  const cs=CS();
  G={
    frog:{row:ROWS-1,col:Math.floor(COLS/2),x:0,y:0,moving:false,dead:false},
    lanes:null,
    score:0,lives:3,round:1,
    best:parseInt(localStorage.getItem('frog_best')||0),
    running:false,paused:false,over:false,particles:[],
    safeSpots:Array(COLS).fill(false),maxRow:ROWS-1,
    moveQueue:[]
  };
  G.lanes=buildLanes();
  syncFrogPos();
  document.getElementById('bestDisplay').textContent=G.best;
}

function syncFrogPos(){
  const cs=CS();
  G.frog.x=(G.frog.col+0.5)*cs;
  G.frog.y=(G.frog.row+0.5)*cs;
}

function tryMove(dr,dc){
  if(!G.running||G.paused||G.frog.dead)return;
  const nr=G.frog.row+dr,nc=G.frog.col+dc;
  if(nr<0||nr>=ROWS||nc<0||nc>=COLS)return;
  G.frog.row=nr;G.frog.col=nc;
  if(nr<G.maxRow){G.maxRow=nr;G.score+=10*(ROWS-nr);
    if(G.score>G.best){G.best=G.score;localStorage.setItem('frog_best',G.best);}
    updateHUD();
  }
  syncFrogPos();
  if(nr===0){nextRound();return;}
  checkCollision();
}

function nextRound(){
  G.round++;G.score+=100;G.maxRow=ROWS-1;
  G.frog.row=ROWS-1;G.frog.col=Math.floor(COLS/2);
  G.lanes=buildLanes();syncFrogPos();updateHUD();
}

function checkCollision(){
  const frog=G.frog,cs=CS();
  const lane=G.lanes[frog.row];
  if(!lane||lane.type==='safe')return;
  const fx=frog.col*cs,fw=cs;
  if(lane.type==='road'){
    for(const o of lane.objs){
      const ox=(o.x%W+W)%W;
      if(fx<ox+o.w&&fx+fw>ox){die();return;}
      if(ox+o.w>W){const wrap=ox+o.w-W;if(fx<wrap){die();return;}}
    }
  } else if(lane.type==='log'){
    let onLog=false;
    for(const o of lane.objs){
      const ox=(o.x%W+W)%W;
      if(fx<ox+o.w&&fx+fw>ox){onLog=true;break;}
      if(ox+o.w>W){const wrap=ox+o.w-W;if(fx<wrap){onLog=true;break;}}
    }
    if(!onLog){die();return;}
  }
}

function die(){
  G.frog.dead=true;spawnParticles(G.frog.x,G.frog.y,'#ef4444');
  G.lives--;updateHUD();
  setTimeout(()=>{
    if(G.lives<=0){endGame();return;}
    G.frog.row=ROWS-1;G.frog.col=Math.floor(COLS/2);G.frog.dead=false;G.maxRow=ROWS-1;
    syncFrogPos();
  },800);
}

function spawnParticles(x,y,color){
  for(let i=0;i<12;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,life:1,color,size:3+Math.random()*3});
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('roundDisplay').textContent=G.round;
  document.getElementById('bestDisplay').textContent=G.best;
}

function update(){
  if(!G.running||G.paused)return;
  const cs=CS();
  G.lanes.forEach(lane=>{
    if(lane.type==='safe')return;
    lane.objs.forEach(o=>o.x+=o.speed);
  });
  // Log riding
  if(!G.frog.dead){
    const lane=G.lanes[G.frog.row];
    if(lane&&lane.type==='log'){
      let rideSpeed=0;
      for(const o of lane.objs){
        const ox=(o.x%W+W)%W;
        const fx=G.frog.col*cs;
        if(fx<ox+o.w&&fx+cs>ox){rideSpeed=o.speed;break;}
      }
      if(rideSpeed!==0){
        G.frog.x+=rideSpeed;
        G.frog.col=Math.round(G.frog.x/cs-0.5);
        if(G.frog.col<0||G.frog.col>=COLS){die();return;}
      }
    }
    checkCollision();
  }
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=0.04;return p.life>0;});
}

function drawLane(lane,row){
  const cs=CS(),y=row*cs;
  if(lane.type==='safe'){
    ctx.fillStyle=row===0?'rgba(16,185,129,.2)':row===ROWS-1?'rgba(16,185,129,.2)':'rgba(16,185,129,.08)';
    ctx.fillRect(0,y,W,cs);
    if(row===0){
      ctx.strokeStyle='rgba(16,185,129,.5)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    }
    return;
  }
  if(lane.type==='road'){
    ctx.fillStyle='rgba(30,30,50,.8)';ctx.fillRect(0,y,W,cs);
    ctx.strokeStyle='rgba(255,255,100,.15)';ctx.setLineDash([20,20]);ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,y+cs/2);ctx.lineTo(W,y+cs/2);ctx.stroke();ctx.setLineDash([]);
    lane.objs.forEach(o=>{
      const ox=((o.x%W)+W)%W;
      // Draw car
      ctx.shadowBlur=8;ctx.shadowColor='#ef4444';
      ctx.fillStyle='#dc2626';
      const carH=cs*0.7,carY=y+(cs-carH)/2;
      ctx.beginPath();ctx.roundRect(ox,carY,o.w,carH,6);ctx.fill();
      // Headlights
      ctx.fillStyle='rgba(255,220,0,.9)';
      const lx=lane.dir>0?ox+o.w-8:ox+4;
      ctx.beginPath();ctx.arc(lx,carY+carH*0.25,5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(lx,carY+carH*0.75,5,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      if(ox+o.w>W){// wrap
        ctx.fillStyle='#dc2626';ctx.beginPath();ctx.roundRect(ox-W,carY,o.w,carH,6);ctx.fill();
      }
    });
  } else if(lane.type==='log'){
    ctx.fillStyle='rgba(0,80,120,.6)';ctx.fillRect(0,y,W,cs);
    lane.objs.forEach(o=>{
      const ox=((o.x%W)+W)%W;
      ctx.shadowBlur=6;ctx.shadowColor='#8B5E3C';
      ctx.fillStyle='#6B4226';
      const logH=cs*0.65,logY=y+(cs-logH)/2;
      ctx.beginPath();ctx.roundRect(ox,logY,o.w,logH,logH/2);ctx.fill();
      ctx.strokeStyle='#8B5E3C';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.05)';ctx.beginPath();ctx.roundRect(ox+4,logY+4,o.w-8,logH*0.4,4);ctx.fill();
      ctx.shadowBlur=0;
      if(ox+o.w>W){ctx.fillStyle='#6B4226';ctx.beginPath();ctx.roundRect(ox-W,logY,o.w,logH,logH/2);ctx.fill();}
    });
  }
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  G.lanes.forEach((l,i)=>drawLane(l,i));

  // Frog
  const frog=G.frog,cs=CS();
  if(!frog.dead){
    const pulse=frog.dead?0:0.8+0.2*Math.sin(Date.now()/200);
    ctx.shadowBlur=12;ctx.shadowColor='#10b981';ctx.font=`${cs*0.75*pulse}px sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🐸',frog.x,frog.y);
    ctx.shadowBlur=0;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }

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
  if(G.paused){G.paused=false;document.getElementById('pauseOverlay').classList.add('hidden');}
  else{G.paused=true;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

document.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='ArrowUp'||e.code==='KeyW')tryMove(-1,0);
  if(e.code==='ArrowDown'||e.code==='KeyS')tryMove(1,0);
  if(e.code==='ArrowLeft'||e.code==='KeyA')tryMove(0,-1);
  if(e.code==='ArrowRight'||e.code==='KeyD')tryMove(0,1);
  if(e.code==='KeyP')pause();
});

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('pauseBtn').addEventListener('click',pause);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('resumeBtn').addEventListener('click',pause);
window.addEventListener('resize',()=>{resize();});

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
