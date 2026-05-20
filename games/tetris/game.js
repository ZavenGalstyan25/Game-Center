'use strict';
const COLS=10,ROWS=20,BLOCK=32;
const PIECES={
  I:{shape:[[1,1,1,1]],color:'#00d4ff',glow:'rgba(0,212,255,.6)'},
  O:{shape:[[1,1],[1,1]],color:'#f59e0b',glow:'rgba(245,158,11,.6)'},
  T:{shape:[[0,1,0],[1,1,1]],color:'#a855f7',glow:'rgba(168,85,247,.6)'},
  S:{shape:[[0,1,1],[1,1,0]],color:'#10b981',glow:'rgba(16,185,129,.6)'},
  Z:{shape:[[1,1,0],[0,1,1]],color:'#ef4444',glow:'rgba(239,68,68,.6)'},
  J:{shape:[[1,0,0],[1,1,1]],color:'#3b82f6',glow:'rgba(59,130,246,.6)'},
  L:{shape:[[0,0,1],[1,1,1]],color:'#ec4899',glow:'rgba(236,72,153,.6)'}
};
const PIECE_KEYS=Object.keys(PIECES);
const SCORES=[0,100,300,500,800];
const SPEED_TABLE=[800,700,600,500,420,350,290,240,190,150,120];

const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');

let G={},animId=null,dropTimer=0,lastTime=0;

function resize(){
  const area=document.querySelector('.game-area');
  const avH=area.clientHeight-20;
  const avW=area.clientWidth-20;
  const blockH=Math.floor(avH/ROWS);
  const blockW=Math.floor(avW/(COLS+8));
  const bs=Math.min(blockH,blockW,36);
  canvas.dataset.bs=bs;
  canvas.width=(COLS+8)*bs+20;
  canvas.height=ROWS*bs+20;
}

function BS(){return parseInt(canvas.dataset.bs)||32;}

function newPiece(type){
  type=type||PIECE_KEYS[Math.floor(Math.random()*PIECE_KEYS.length)];
  const p=PIECES[type];
  return{type,shape:p.shape.map(r=>[...r]),color:p.color,glow:p.glow,
    x:Math.floor((COLS-p.shape[0].length)/2),y:0};
}

function rotate(piece){
  const rows=piece.shape.length,cols=piece.shape[0].length;
  const rotated=Array.from({length:cols},(_,i)=>Array.from({length:rows},(_,j)=>piece.shape[rows-1-j][i]));
  return rotated;
}

function valid(board,shape,ox,oy){
  for(let r=0;r<shape.length;r++)
    for(let c=0;c<shape[r].length;c++)
      if(shape[r][c]){
        const nr=oy+r,nc=ox+c;
        if(nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc])return false;
      }
  return true;
}

function lock(board,piece){
  for(let r=0;r<piece.shape.length;r++)
    for(let c=0;c<piece.shape[r].length;c++)
      if(piece.shape[r][c]&&piece.y+r>=0)
        board[piece.y+r][piece.x+c]={color:piece.color,glow:piece.glow};
}

function clearLines(board){
  let cleared=0;
  for(let r=ROWS-1;r>=0;r--){
    if(board[r].every(c=>c)){
      board.splice(r,1);
      board.unshift(Array(COLS).fill(null));
      cleared++;r++;
    }
  }
  return cleared;
}

function ghostY(board,piece){
  let gy=piece.y;
  while(valid(board,piece.shape,piece.x,gy+1))gy++;
  return gy;
}

function initGame(){
  G={
    board:Array.from({length:ROWS},()=>Array(COLS).fill(null)),
    current:null,next:null,held:null,canHold:true,
    score:0,lines:0,level:1,best:parseInt(localStorage.getItem('tetris_best')||0),
    running:false,over:false,paused:false,
    flash:[],particles:[]
  };
  G.next=newPiece();
  spawnPiece();
  document.getElementById('bestDisplay').textContent=G.best;
}

function spawnPiece(){
  G.current=G.next;
  G.next=newPiece();
  if(!valid(G.board,G.current.shape,G.current.x,G.current.y)){
    G.over=true;G.running=false;
    endGame();
  }
}

function hold(){
  if(!G.canHold)return;
  if(!G.held){G.held=newPiece(G.current.type);spawnPiece();}
  else{const t=G.held.type;G.held=newPiece(G.current.type);G.current=newPiece(t);G.current.x=Math.floor((COLS-G.current.shape[0].length)/2);G.current.y=0;}
  G.canHold=false;
}

function moveLeft(){if(valid(G.board,G.current.shape,G.current.x-1,G.current.y))G.current.x--;}
function moveRight(){if(valid(G.board,G.current.shape,G.current.x+1,G.current.y))G.current.x++;}
function softDrop(){
  if(valid(G.board,G.current.shape,G.current.x,G.current.y+1)){G.current.y++;G.score+=1;}
  else placePiece();
}
function hardDrop(){
  const gy=ghostY(G.board,G.current);
  G.score+=(gy-G.current.y)*2;
  G.current.y=gy;
  placePiece();
}
function rotatePiece(){
  const r=rotate(G.current);
  const kicks=[0,-1,1,-2,2];
  for(const k of kicks){
    if(valid(G.board,r,G.current.x+k,G.current.y)){G.current.shape=r;G.current.x+=k;return;}
  }
}

function placePiece(){
  lock(G.board,G.current);
  const cleared=clearLines(G.board);
  if(cleared>0){
    G.lines+=cleared;
    G.score+=SCORES[cleared]*(G.level);
    G.level=Math.min(10,Math.floor(G.lines/10)+1);
    spawnFlash(cleared);
    spawnLineParticles(cleared);
  }
  G.canHold=true;
  spawnPiece();
  updateHUD();
}

function spawnFlash(n){G.flash.push({frames:20,count:n});}
function spawnLineParticles(n){
  const bs=BS();
  for(let i=0;i<n*12;i++){
    const col=Math.floor(Math.random()*COLS);
    const row=Math.floor(Math.random()*ROWS);
    G.particles.push({x:10+(col+.5)*bs,y:10+(row+.5)*bs,vx:(Math.random()-0.5)*6,vy:(Math.random()-1)*6,
      life:1,color:'#a855f7',size:3+Math.random()*3});
  }
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('levelDisplay').textContent=G.level;
  document.getElementById('linesDisplay').textContent=G.lines;
  if(G.score>G.best){G.best=G.score;localStorage.setItem('tetris_best',G.best);document.getElementById('bestDisplay').textContent=G.best;}
}

function dropInterval(){return SPEED_TABLE[G.level-1]||120;}

function gameLoop(ts){
  if(!G.running)return;
  const dt=ts-lastTime;lastTime=ts;
  dropTimer+=dt;
  if(dropTimer>=dropInterval()){dropTimer=0;
    if(valid(G.board,G.current.shape,G.current.x,G.current.y+1))G.current.y++;
    else placePiece();
  }
  updateParticles();
  draw();
  animId=requestAnimationFrame(gameLoop);
}

function updateParticles(){
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life-=0.03;return p.life>0;});
  G.flash=G.flash.filter(f=>{f.frames--;return f.frames>0;});
}

function draw(){
  const bs=BS();
  const bw=COLS*bs,bh=ROWS*bs;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Board background
  ctx.fillStyle='rgba(5,5,12,0.95)';
  ctx.beginPath();ctx.roundRect(8,8,bw+4,bh+4,6);ctx.fill();
  ctx.strokeStyle='rgba(168,85,247,.3)';ctx.lineWidth=1;ctx.stroke();

  // Grid lines
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
  for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(10,10+r*bs);ctx.lineTo(10+bw,10+r*bs);ctx.stroke();}
  for(let c=0;c<=COLS;c++){ctx.beginPath();ctx.moveTo(10+c*bs,10);ctx.lineTo(10+c*bs,10+bh);ctx.stroke();}

  // Flash effect on line clear
  if(G.flash.length>0){
    const alpha=G.flash[0].frames/20*0.4;
    ctx.fillStyle=`rgba(168,85,247,${alpha})`;
    ctx.fillRect(10,10,bw,bh);
  }

  // Board cells
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++)
      if(G.board[r][c])drawBlock(ctx,10+c*bs,10+r*bs,bs,G.board[r][c].color,G.board[r][c].glow);

  // Ghost piece
  if(G.current){
    const gy=ghostY(G.board,G.current);
    for(let r=0;r<G.current.shape.length;r++)
      for(let c=0;c<G.current.shape[r].length;c++)
        if(G.current.shape[r][c])
          drawGhost(ctx,10+(G.current.x+c)*bs,10+(gy+r)*bs,bs,G.current.color);

    // Current piece
    for(let r=0;r<G.current.shape.length;r++)
      for(let c=0;c<G.current.shape[r].length;c++)
        if(G.current.shape[r][c])
          drawBlock(ctx,10+(G.current.x+c)*bs,10+(G.current.y+r)*bs,bs,G.current.color,G.current.glow);
  }

  // Particles
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.color;
    ctx.shadowBlur=8;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });

  // Side panel
  drawPanel(bs);
}

function drawBlock(ctx,x,y,bs,color,glow){
  ctx.fillStyle=color;
  ctx.shadowBlur=12;ctx.shadowColor=glow||color;
  ctx.beginPath();ctx.roundRect(x+1,y+1,bs-2,bs-2,3);ctx.fill();
  ctx.shadowBlur=0;
  // shine
  const g=ctx.createLinearGradient(x+1,y+1,x+1,y+bs*0.5);
  g.addColorStop(0,'rgba(255,255,255,.3)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x+2,y+2,bs-4,bs*0.45,2);ctx.fill();
}

function drawGhost(ctx,x,y,bs,color){
  ctx.strokeStyle=color;ctx.globalAlpha=0.25;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(x+1,y+1,bs-2,bs-2,3);ctx.stroke();
  ctx.globalAlpha=1;
}

function drawPanel(bs){
  const bw=COLS*bs;
  const px=10+bw+12,py=10,pw=canvas.width-px-8;
  ctx.fillStyle='rgba(255,255,255,.04)';
  ctx.strokeStyle='rgba(168,85,247,.2)';ctx.lineWidth=1;
  // NEXT label
  ctx.fillStyle='rgba(168,85,247,.7)';ctx.font=`bold ${Math.round(bs*0.4)}px "Exo 2",sans-serif`;
  ctx.fillText('NEXT',px+4,py+bs*0.5);
  drawMiniPiece(G.next,px,py+bs*0.6,bs);
  // HOLD
  const hy=py+bs*3.5;
  ctx.fillStyle='rgba(168,85,247,.7)';ctx.font=`bold ${Math.round(bs*0.4)}px "Exo 2",sans-serif`;
  ctx.fillText('HOLD',px+4,hy);
  if(G.held)drawMiniPiece(G.held,px,hy+bs*0.1,bs,!G.canHold);
  // Level/Score labels in side
  const infoY=hy+bs*3;
  const labelStyle=`${Math.round(bs*0.35)}px "Exo 2",sans-serif`;
  ctx.font=labelStyle;ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.fillText('LEVEL',px+2,infoY);
  ctx.font=`bold ${Math.round(bs*0.5)}px "Exo 2",sans-serif`;
  ctx.fillStyle='#a855f7';ctx.fillText(G.level,px+2,infoY+bs*0.65);
  ctx.font=labelStyle;ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.fillText('LINES',px+2,infoY+bs*1.4);
  ctx.font=`bold ${Math.round(bs*0.5)}px "Exo 2",sans-serif`;
  ctx.fillStyle='#00d4ff';ctx.fillText(G.lines,px+2,infoY+bs*2.05);
}

function drawMiniPiece(piece,px,py,bs,dim){
  if(!piece)return;
  const s=piece.shape,cols=s[0].length,rows=s.length;
  const off=(3-cols)*bs*0.5;
  ctx.globalAlpha=dim?0.3:1;
  for(let r=0;r<rows;r++)
    for(let c=0;c<cols;c++)
      if(s[r][c])drawBlock(ctx,px+off+c*bs,py+r*bs,bs,piece.color,piece.glow);
  ctx.globalAlpha=1;
}

function endGame(){
  if(G.score>G.best){G.best=G.score;localStorage.setItem('tetris_best',G.best);}
  document.getElementById('finalScore').textContent='Score: '+G.score;
  document.getElementById('finalLines').textContent='Lines: '+G.lines+' · Level: '+G.level;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;G.paused=false;
  dropTimer=0;lastTime=performance.now();
  cancelAnimationFrame(animId);
  animId=requestAnimationFrame(gameLoop);
}

function pause(){
  if(!G.running&&!G.paused)return;
  if(G.paused){G.paused=false;G.running=true;document.getElementById('pauseOverlay').classList.add('hidden');
    lastTime=performance.now();animId=requestAnimationFrame(gameLoop);}
  else{G.paused=true;G.running=false;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

// Controls
document.addEventListener('keydown',e=>{
  if(!G.running&&!G.paused)return;
  if(G.paused&&e.code!=='KeyP')return;
  switch(e.code){
    case'ArrowLeft':case'KeyA':e.preventDefault();moveLeft();break;
    case'ArrowRight':case'KeyD':e.preventDefault();moveRight();break;
    case'ArrowDown':case'KeyS':e.preventDefault();softDrop();break;
    case'ArrowUp':case'KeyW':e.preventDefault();rotatePiece();break;
    case'Space':e.preventDefault();hardDrop();break;
    case'KeyC':hold();break;
    case'KeyP':pause();break;
  }
  if(G.running){draw();}
});

document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('pauseBtn').addEventListener('click',pause);
document.getElementById('restartBtn').addEventListener('click',startGame);
document.getElementById('resumeBtn').addEventListener('click',pause);

window.addEventListener('resize',()=>{if(G.running||G.paused){resize();draw();}else resize();});

// Loading screen
window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*25;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>{document.getElementById('loading-screen').classList.add('hide');},400);}
    bar.style.width=p+'%';},120);
});
