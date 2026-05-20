'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;
const COLS=8,VISIBLE_ROWS=14;
const COLORS=['#ec4899','#a855f7','#3b82f6','#10b981','#f59e0b','#ef4444','#00d4ff'];

function resize(){
  const area=document.querySelector('.game-area');
  const cs=Math.floor(Math.min(area.clientWidth-20,area.clientHeight-20)/VISIBLE_ROWS);
  W=canvas.width=cs*COLS;H=canvas.height=cs*VISIBLE_ROWS;
  canvas.dataset.cs=cs;
}

function CS(){return parseInt(canvas.dataset.cs)||40;}

function initGame(){
  const cs=CS();
  G={
    stack:[],current:{x:0,w:COLS,dir:1,speed:2},
    score:0,level:1,best:parseInt(localStorage.getItem('stack_best')||0),
    running:false,over:false,
    particles:[],dropFlash:0,
    colorIdx:0
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function getColor(i){return COLORS[(i||G.colorIdx)%COLORS.length];}

function spawnRow(){
  G.current={x:0,w:Math.min(COLS,G.stack.length===0?COLS:G.stack[G.stack.length-1].w+1),
    dir:1,speed:Math.min(6,1.5+G.level*0.3)};
  if(G.stack.length===0)G.current.w=COLS;
}

function drop(){
  if(!G.running||G.over)return;
  const cur=G.current;
  const prev=G.stack[G.stack.length-1];
  if(!prev){
    // First block — perfect
    G.stack.push({x:cur.x,w:cur.w,color:getColor(G.colorIdx++)});
    const pts=100;G.score+=pts;
    spawnParticles(cur.x+cur.w/2,G.stack.length,pts,'#ec4899');
    spawnRow();updateHUD();return;
  }

  const overlapStart=Math.max(cur.x,prev.x);
  const overlapEnd=Math.min(cur.x+cur.w,prev.x+prev.w);
  const overlap=overlapEnd-overlapStart;

  if(overlap<=0){
    endGame();return;
  }

  const diff=Math.abs(overlap-prev.w);
  const perfect=diff<=0.5;
  const nx=overlapStart;
  const nw=perfect?prev.w:overlap;
  const pts=perfect?200:Math.round(100*(overlap/prev.w));

  G.score+=pts;G.dropFlash=12;
  if(G.score>G.best){G.best=G.score;localStorage.setItem('stack_best',G.best);}

  G.stack.push({x:nx,w:nw,color:getColor(G.colorIdx++)});
  spawnParticles(nx+nw/2,G.stack.length,pts,getColor(G.colorIdx-1));

  if(G.stack.length>VISIBLE_ROWS-1){
    G.stack=G.stack.slice(-VISIBLE_ROWS+1);
    G.level++;
  }
  G.level=Math.max(1,Math.floor(G.score/500)+1);
  spawnRow();updateHUD();
}

function spawnParticles(gx,gy,pts,color){
  const cs=CS();
  const cx=gx*cs,cy=H-(gy-0.5)*cs;
  for(let i=0;i<8;i++)
    G.particles.push({x:cx,y:cy,vx:(Math.random()-.5)*7,vy:-2-Math.random()*5,
      life:1,color,size:2+Math.random()*3,pts:i===0?pts:null});
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('levelDisplay').textContent=G.level;
  document.getElementById('bestDisplay').textContent=G.best;
}

function update(){
  if(!G.running||G.over)return;
  const cur=G.current,cs=CS();
  cur.x+=cur.dir*cur.speed/cs;
  if(cur.x<0){cur.x=0;cur.dir=1;}
  if(cur.x+cur.w>COLS){cur.x=COLS-cur.w;cur.dir=-1;}
  if(G.dropFlash>0)G.dropFlash--;
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.2;p.life-=0.03;return p.life>0;});
}

function draw(){
  const cs=CS();
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;
  for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(c*cs,0);ctx.lineTo(c*cs,H);ctx.stroke();}
  for(let r=0;r<=VISIBLE_ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*cs);ctx.lineTo(W,r*cs);ctx.stroke();}

  // Stack
  G.stack.forEach((blk,i)=>{
    const row=G.stack.length-1-i;
    const y=H-(row+1)*cs;
    if(y+cs<0||y>H)return;
    ctx.shadowBlur=10;ctx.shadowColor=blk.color;
    const grd=ctx.createLinearGradient(blk.x*cs,y,(blk.x+blk.w)*cs,y+cs);
    grd.addColorStop(0,blk.color);grd.addColorStop(1,blk.color+'99');
    ctx.fillStyle=grd;
    ctx.beginPath();ctx.roundRect(blk.x*cs+1,y+1,blk.w*cs-2,cs-2,3);ctx.fill();
    // Shine
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.roundRect(blk.x*cs+2,y+2,blk.w*cs-4,cs*0.35,2);ctx.fill();
    ctx.shadowBlur=0;
  });

  // Current moving block
  if(G.running&&!G.over){
    const cur=G.current;
    const rowY=H-(G.stack.length+1)*cs;
    const cIdx=G.colorIdx%COLORS.length;
    const color=COLORS[cIdx];
    ctx.shadowBlur=14;ctx.shadowColor=color;ctx.fillStyle=color;
    ctx.beginPath();ctx.roundRect(cur.x*cs+1,rowY+1,cur.w*cs-2,cs-2,3);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.beginPath();ctx.roundRect(cur.x*cs+2,rowY+2,cur.w*cs-4,cs*0.35,2);ctx.fill();
    ctx.shadowBlur=0;

    // Guide line from prev block
    if(G.stack.length>0){
      const prev=G.stack[G.stack.length-1];
      ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(prev.x*cs,rowY+cs);ctx.lineTo(prev.x*cs,H);ctx.stroke();
      ctx.beginPath();ctx.moveTo((prev.x+prev.w)*cs,rowY+cs);ctx.lineTo((prev.x+prev.w)*cs,H);ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Flash on drop
  if(G.dropFlash>0){
    ctx.fillStyle=`rgba(255,255,255,${G.dropFlash/12*0.15})`;
    ctx.fillRect(0,0,W,H);
  }

  // Particles
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=8;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    if(p.pts){ctx.fillStyle='#fff';ctx.font=`bold 12px "Exo 2",sans-serif`;ctx.fillText('+'+p.pts,p.x+4,p.y);}
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
}

function gameLoop(){
  if(!G.running&&!G.over)return;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

function endGame(){
  G.over=true;G.running=false;
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('finalLevel').textContent='Level: '+G.level;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;spawnRow();updateHUD();
  cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

function handleDrop(){
  if(G.over){startGame();return;}
  if(G.running)drop();
}

document.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();handleDrop();}
});
canvas.addEventListener('click',handleDrop);
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
