'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let G={},timer=null;
const CONFIGS={easy:{cols:9,rows:9,mines:10},medium:{cols:16,rows:16,mines:40},hard:{cols:30,rows:16,mines:99}};
const NUM_COLORS=['','#3b82f6','#10b981','#ef4444','#7c3aed','#dc2626','#0891b2','#111','#6b7280'];

function CS(){return G.cellSize||32;}

function setup(){
  const diff=document.getElementById('diffSelect').value;
  const cfg=CONFIGS[diff];
  const area=document.querySelector('.game-area');
  const maxCW=Math.floor((area.clientWidth-20)/cfg.cols);
  const maxCH=Math.floor((area.clientHeight-20)/cfg.rows);
  const cs=Math.min(maxCW,maxCH,40);
  canvas.width=cfg.cols*cs;canvas.height=cfg.rows*cs;
  G={
    cols:cfg.cols,rows:cfg.rows,totalMines:cfg.mines,
    cellSize:cs,board:null,revealed:null,flagged:null,
    minesPlaced:false,gameOver:false,won:false,started:false,
    startTime:0,elapsed:0,
    best:parseInt(localStorage.getItem('ms_best_'+diff)||0)||null
  };
  G.board=Array.from({length:cfg.rows},()=>Array(cfg.cols).fill(0));
  G.revealed=Array.from({length:cfg.rows},()=>Array(cfg.cols).fill(false));
  G.flagged=Array.from({length:cfg.rows},()=>Array(cfg.cols).fill(false));
  document.getElementById('mineCount').textContent=cfg.mines;
  document.getElementById('flagCount').textContent=0;
  document.getElementById('timeDisplay').textContent=0;
  document.getElementById('bestDisplay').textContent=G.best?G.best+'s':'--';
  clearInterval(timer);draw();
}

function placeMines(safeR,safeC){
  const cfg=G;let placed=0;
  while(placed<G.totalMines){
    const r=Math.floor(Math.random()*G.rows),c=Math.floor(Math.random()*G.cols);
    if(G.board[r][c]===-1)continue;
    if(Math.abs(r-safeR)<=1&&Math.abs(c-safeC)<=1)continue;
    G.board[r][c]=-1;placed++;
  }
  for(let r=0;r<G.rows;r++)for(let c=0;c<G.cols;c++){
    if(G.board[r][c]===-1)continue;
    let cnt=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<G.rows&&nc>=0&&nc<G.cols&&G.board[nr][nc]===-1)cnt++;
    }
    G.board[r][c]=cnt;
  }
}

function reveal(r,c){
  if(r<0||r>=G.rows||c<0||c>=G.cols)return;
  if(G.revealed[r][c]||G.flagged[r][c])return;
  G.revealed[r][c]=true;
  if(G.board[r][c]===0)
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)reveal(r+dr,c+dc);
}

function countFlags(r,c){
  let f=0;
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<G.rows&&nc>=0&&nc<G.cols&&G.flagged[nr][nc])f++;
  }return f;
}

function chord(r,c){
  if(!G.revealed[r][c]||G.board[r][c]<=0)return;
  if(countFlags(r,c)===G.board[r][c])
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)clickReveal(r+dr,c+dc,true);
}

function clickReveal(r,c,fromChord){
  if(r<0||r>=G.rows||c<0||c>=G.cols)return;
  if(G.revealed[r][c]||G.flagged[r][c])return;
  if(G.gameOver||G.won)return;
  if(!G.minesPlaced){
    placeMines(r,c);G.minesPlaced=true;
    G.started=true;G.startTime=Date.now();
    timer=setInterval(()=>{
      G.elapsed=Math.floor((Date.now()-G.startTime)/1000);
      document.getElementById('timeDisplay').textContent=G.elapsed;
    },1000);
  }
  if(G.board[r][c]===-1){
    G.revealed[r][c]=true;G.gameOver=true;
    clearInterval(timer);
    revealAllMines();draw();
    setTimeout(()=>document.getElementById('gameOverOverlay').classList.remove('hidden'),600);
    return;
  }
  reveal(r,c);
  checkWin();draw();
}

function revealAllMines(){
  for(let r=0;r<G.rows;r++)for(let c=0;c<G.cols;c++)
    if(G.board[r][c]===-1)G.revealed[r][c]=true;
}

function checkWin(){
  let safe=0;
  for(let r=0;r<G.rows;r++)for(let c=0;c<G.cols;c++)
    if(G.board[r][c]!==-1&&G.revealed[r][c])safe++;
  if(safe===G.rows*G.cols-G.totalMines){
    G.won=true;clearInterval(timer);
    const diff=document.getElementById('diffSelect').value;
    const key='ms_best_'+diff;
    if(!G.best||G.elapsed<G.best){G.best=G.elapsed;localStorage.setItem(key,G.elapsed);}
    document.getElementById('winTime').textContent='Time: '+G.elapsed+'s';
    setTimeout(()=>document.getElementById('winOverlay').classList.remove('hidden'),400);
  }
}

function draw(){
  const cs=CS();
  ctx.fillStyle='#080810';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<G.rows;r++)for(let c=0;c<G.cols;c++){
    const x=c*cs,y=r*cs;
    if(G.revealed[r][c]){
      const isMine=G.board[r][c]===-1;
      ctx.fillStyle=isMine?'rgba(239,68,68,.3)':'rgba(255,255,255,.04)';
      ctx.fillRect(x+1,y+1,cs-2,cs-2);
      if(isMine){
        ctx.fillStyle='#ef4444';ctx.font=`bold ${cs*0.6}px sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('💣',x+cs/2,y+cs/2);
      } else if(G.board[r][c]>0){
        ctx.fillStyle=NUM_COLORS[G.board[r][c]]||'#fff';
        ctx.font=`bold ${cs*0.5}px "Exo 2",sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(G.board[r][c],x+cs/2,y+cs/2);
      }
    } else {
      // Unrevealed
      const grd=ctx.createLinearGradient(x,y,x+cs,y+cs);
      grd.addColorStop(0,'rgba(59,130,246,.2)');grd.addColorStop(1,'rgba(16,185,129,.12)');
      ctx.fillStyle=grd;ctx.fillRect(x+1,y+1,cs-2,cs-2);
      // 3D border effect
      ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(x+1,y+1,cs-2,2);
      ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(x+1,y+1,2,cs-2);
      ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(x+1,y+cs-3,cs-2,2);
      if(G.flagged[r][c]){
        ctx.font=`${cs*0.55}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('🚩',x+cs/2,y+cs/2);
      }
    }
    // Grid line
    ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
    ctx.strokeRect(x,y,cs,cs);
  }
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
}

canvas.addEventListener('click',e=>{
  if(G.gameOver||G.won)return;
  const rect=canvas.getBoundingClientRect();
  const cs=CS();
  const c=Math.floor((e.clientX-rect.left)/cs),r=Math.floor((e.clientY-rect.top)/cs);
  if(r<0||r>=G.rows||c<0||c>=G.cols)return;
  if(G.revealed[r][c])chord(r,c);
  else clickReveal(r,c,false);
});

canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();if(G.gameOver||G.won)return;
  const rect=canvas.getBoundingClientRect();const cs=CS();
  const c=Math.floor((e.clientX-rect.left)/cs),r=Math.floor((e.clientY-rect.top)/cs);
  if(r<0||r>=G.rows||c<0||c>=G.cols||G.revealed[r][c])return;
  G.flagged[r][c]=!G.flagged[r][c];
  const flags=G.flagged.flat().filter(Boolean).length;
  document.getElementById('flagCount').textContent=flags;
  document.getElementById('mineCount').textContent=G.totalMines-flags;
  draw();
});

canvas.addEventListener('mousedown',e=>{
  if(e.button===1){e.preventDefault();
    const rect=canvas.getBoundingClientRect();const cs=CS();
    const c=Math.floor((e.clientX-rect.left)/cs),r=Math.floor((e.clientY-rect.top)/cs);
    chord(r,c);draw();
  }
});

function startGame(){
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  document.getElementById('winOverlay').classList.add('hidden');
  setup();
}

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('playAgainBtn').addEventListener('click',startGame);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('diffSelect').addEventListener('change',startGame);
window.addEventListener('resize',()=>{if(!G.board)return;const d=document.getElementById('diffSelect').value;CONFIGS[d];setup();});

window.addEventListener('load',()=>{
  setup();document.getElementById('startOverlay').classList.remove('hidden');
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*30;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
