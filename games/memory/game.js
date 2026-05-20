'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;

function resize(){
  const area=document.querySelector('.game-area');
  const sz=Math.min(area.clientWidth-20,area.clientHeight-20,520);
  W=canvas.width=sz;H=canvas.height=sz;
}

function gridSize(){return G.level<=3?3:G.level<=6?4:5;}
function CS(){return W/gridSize();}

function initGame(){
  G={
    sequence:[],playerSeq:[],level:1,
    phase:'idle',// idle, showing, input
    showIdx:0,showTimer:0,showDelay:600,
    score:0,best:parseInt(localStorage.getItem('mem_best')||0),
    grid:null,flashCell:null,flashTimer:0,
    running:false,over:false,
    successFlash:0
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function buildGrid(){
  const sz=gridSize();
  G.grid=Array.from({length:sz*sz},(_,i)=>({
    row:Math.floor(i/sz),col:i%sz,
    lit:false,correct:null
  }));
}

function addToSequence(){
  const sz=gridSize();
  const idx=Math.floor(Math.random()*sz*sz);
  G.sequence.push(idx);
}

function startRound(){
  buildGrid();G.playerSeq=[];
  addToSequence();
  G.phase='showing';G.showIdx=0;G.showTimer=G.showDelay;
  setStatus('Watch!');
}

function setStatus(s){document.getElementById('statusDisplay').textContent=s;}

function showNext(){
  if(G.showIdx>0&&G.grid){
    const prev=G.sequence[G.showIdx-1];
    G.grid[prev].lit=false;
  }
  if(G.showIdx>=G.sequence.length){
    G.phase='input';setStatus('Your turn!');return;
  }
  const idx=G.sequence[G.showIdx];
  G.grid[idx].lit=true;
  G.flashCell={idx,timer:0};
  G.showIdx++;G.showTimer=G.showDelay;
}

function handleInput(cellIdx){
  if(G.phase!=='input'||G.over)return;
  const expected=G.sequence[G.playerSeq.length];
  if(cellIdx===expected){
    G.grid[cellIdx].correct=true;
    G.playerSeq.push(cellIdx);
    G.flashCell={idx:cellIdx,timer:0,color:'#10b981'};
    if(G.playerSeq.length===G.sequence.length){
      // Level complete
      const pts=G.level*100+(G.sequence.length===gridSize()*gridSize()?500:0);
      G.score+=pts;G.level++;
      if(G.score>G.best){G.best=G.score;localStorage.setItem('mem_best',G.best);}
      document.getElementById('scoreDisplay').textContent=G.score;
      document.getElementById('levelDisplay').textContent=G.level;
      document.getElementById('bestDisplay').textContent=G.best;
      G.successFlash=20;
      setStatus('✓ Perfect!');
      setTimeout(()=>{if(!G.over)startRound();},1200);
    }
  } else {
    G.flashCell={idx:cellIdx,timer:0,color:'#ef4444'};
    G.over=true;G.running=false;
    setTimeout(()=>{
      document.getElementById('finalScore').textContent='Score: '+G.score;
      document.getElementById('finalLevel').textContent='Level: '+G.level;
      document.getElementById('gameOverOverlay').classList.remove('hidden');
    },600);
  }
}

let lastTs=0;
function update(dt){
  if(!G.running||G.over)return;
  if(G.flashCell){G.flashCell.timer+=dt;if(G.flashCell.timer>300)G.flashCell=null;}
  if(G.successFlash>0)G.successFlash--;
  if(G.phase==='showing'){
    G.showTimer-=dt;
    if(G.showTimer<=0){G.showTimer=G.showDelay;showNext();}
  }
}

function draw(){
  const sz=gridSize(),cs=CS();
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  for(let r=0;r<sz;r++)for(let c=0;c<sz;c++){
    const idx=r*sz+c;
    const x=c*cs,y=r*cs;
    const cell=G.grid?G.grid[idx]:null;
    const isLit=cell&&cell.lit;
    const flashColor=G.flashCell&&G.flashCell.idx===idx?G.flashCell.color:null;
    const flashProg=flashColor&&G.flashCell?Math.max(0,1-G.flashCell.timer/300):0;
    const baseColor=isLit?'#a855f7':'rgba(168,85,247,.12)';
    const color=flashColor?(flashProg>0?flashColor:baseColor):baseColor;
    ctx.shadowBlur=isLit||flashProg>0?16:0;
    ctx.shadowColor=color;ctx.fillStyle=color;
    ctx.globalAlpha=flashProg>0?Math.max(0.5,flashProg):1;
    ctx.beginPath();ctx.roundRect(x+3,y+3,cs-6,cs-6,8);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
    // Border
    ctx.strokeStyle=isLit?'rgba(168,85,247,.8)':'rgba(168,85,247,.2)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(x+3,y+3,cs-6,cs-6,8);ctx.stroke();
    // Sequence number hint while showing
    if(isLit){
      const seqN=G.sequence.indexOf(idx);
      if(seqN>=0){ctx.fillStyle='rgba(255,255,255,.7)';ctx.font=`bold ${cs*0.4}px "Exo 2",sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(seqN+1,x+cs/2,y+cs/2);ctx.textAlign='left';ctx.textBaseline='alphabetic';}
    }
  }
  if(G.successFlash>0){
    ctx.fillStyle=`rgba(16,185,129,${G.successFlash/20*0.2})`;
    ctx.fillRect(0,0,W,H);
  }
}

function gameLoop(ts){
  const dt=ts-lastTs;lastTs=ts;
  if(G.running){update(dt);draw();}
  else if(!G.over)draw();
  animId=requestAnimationFrame(gameLoop);
}

function startGame(){
  resize();initGame();buildGrid();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;
  document.getElementById('levelDisplay').textContent=1;
  setTimeout(()=>startRound(),500);
  cancelAnimationFrame(animId);lastTs=performance.now();animId=requestAnimationFrame(gameLoop);
}

canvas.addEventListener('click',e=>{
  if(!G.running||G.phase!=='input')return;
  const rect=canvas.getBoundingClientRect();
  const cs=CS(),sz=gridSize();
  const c=Math.floor((e.clientX-rect.left)/cs),r=Math.floor((e.clientY-rect.top)/cs);
  if(r>=0&&r<sz&&c>=0&&c<sz)handleInput(r*sz+c);
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
