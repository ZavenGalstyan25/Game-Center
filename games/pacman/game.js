'use strict';
// 21x21 maze: 1=wall, 0=dot, 2=power, 3=empty(ghost house), 4=empty(no dot)
const MAZE_TEMPLATE=[
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,2,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,2,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,4,1,1,1,4,1,1,1,0,1,1,1,1],
  [4,4,4,1,0,1,4,4,4,4,4,4,4,4,4,1,0,1,4,4,4],
  [1,1,1,1,0,1,4,1,1,3,3,3,1,1,4,1,0,1,1,1,1],
  [4,4,4,4,0,4,4,1,3,3,3,3,3,1,4,4,0,4,4,4,4],
  [1,1,1,1,0,1,4,1,1,1,1,1,1,1,4,1,0,1,1,1,1],
  [4,4,4,1,0,1,4,4,4,4,4,4,4,4,4,1,0,1,4,4,4],
  [1,1,1,1,0,1,4,1,1,1,1,1,1,1,4,1,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,2,0,1,0,0,0,0,0,0,4,0,0,0,0,0,0,1,0,2,1],
  [1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,1,1,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];
const ROWS=MAZE_TEMPLATE.length,COLS=MAZE_TEMPLATE[0].length;
const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
const GHOST_COLORS=['#ef4444','#ec4899','#00d4ff','#f59e0b'];
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;
function CS(){return Math.min(Math.floor(W/COLS),Math.floor(H/ROWS));}

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;H=canvas.height=area.clientHeight-4;
}

function buildMaze(){
  return MAZE_TEMPLATE.map(row=>[...row]);
}

function countDots(maze){
  return maze.flat().filter(c=>c===0||c===2).length;
}

function initGame(){
  const cs=CS();
  const maze=buildMaze();
  G={
    maze,cs,
    pac:{x:10.5,y:16.5,dir:{x:0,y:0},nextDir:{x:0,y:0},mouthAngle:0.25,mouthDir:1},
    ghosts:[
      {x:9.5,y:9.5,dir:{x:1,y:0},mode:'scatter',color:GHOST_COLORS[0],scatter:{x:19,y:1},frightened:0,eaten:false,homeX:9.5,homeY:9.5,speed:0.09},
      {x:10.5,y:9.5,dir:{x:-1,y:0},mode:'scatter',color:GHOST_COLORS[1],scatter:{x:1,y:1},frightened:0,eaten:false,homeX:10.5,homeY:9.5,speed:0.08},
      {x:9.5,y:10.5,dir:{x:0,y:1},mode:'scatter',color:GHOST_COLORS[2],scatter:{x:19,y:19},frightened:0,eaten:false,homeX:9.5,homeY:10.5,speed:0.085},
      {x:10.5,y:10.5,dir:{x:0,y:-1},mode:'scatter',color:GHOST_COLORS[3],scatter:{x:1,y:19},frightened:0,eaten:false,homeX:10.5,homeY:10.5,speed:0.075}
    ],
    score:0,lives:3,level:1,dotsLeft:countDots(maze),powerTimer:0,
    best:parseInt(localStorage.getItem('pac_best')||0),
    running:false,paused:false,over:false,
    frame:0,deathAnim:0
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function canMove(x,y,dx,dy){
  const nx=x+dx*0.5+dx*0.01,ny=y+dy*0.5+dy*0.01;
  const c=Math.floor(nx+0.5),r=Math.floor(ny+0.5);
  if(r<0||r>=ROWS||c<0||c>=COLS)return true;// tunnel
  return G.maze[r][c]!==1;
}

function wrapTunnel(obj){
  if(obj.x<0)obj.x=COLS-0.5;
  if(obj.x>=COLS)obj.x=0.5;
}

function ghostTarget(g){
  if(g.frightened>0)return{x:Math.random()*COLS,y:Math.random()*ROWS};
  if(g.mode==='scatter')return g.scatter;
  return{x:G.pac.x,y:G.pac.y};
}

function moveGhost(g){
  const spd=g.frightened>0?g.speed*0.5:g.speed;
  const nx=g.x+g.dir.x*spd,ny=g.y+g.dir.y*spd;
  const cx=Math.round(g.x),cy=Math.round(g.y);

  // Check if centered enough to turn
  if(Math.abs(g.x-cx)<spd*1.5&&Math.abs(g.y-cy)<spd*1.5){
    const tgt=ghostTarget(g);
    let bestDir=g.dir,bestDist=Infinity;
    Object.values(DIRS).forEach(d=>{
      if(d.x===-g.dir.x&&d.y===-g.dir.y)return;// no reverse
      if(canMove(cx,cy,d.x,d.y)){
        const dist=Math.hypot(cx+d.x-tgt.x,cy+d.y-tgt.y)+(g.frightened>0?Math.random()*10:0);
        if(dist<bestDist){bestDist=dist;bestDir=d;}
      }
    });
    g.dir=bestDir;
    g.x=cx;g.y=cy;
  }
  const fx=g.x+g.dir.x*spd,fy=g.y+g.dir.y*spd;
  if(canMove(g.x,g.y,g.dir.x,g.dir.y)){g.x=fx;g.y=fy;}
  wrapTunnel(g);
  if(g.frightened>0)g.frightened--;
}

function update(){
  if(!G.running||G.paused)return;
  G.frame++;
  const p=G.pac;

  // Try next direction
  if(G.frame%2===0){
    const nd=p.nextDir;
    if((nd.x||nd.y)&&canMove(p.x,p.y,nd.x,nd.y)){p.dir={...nd};}
  }

  // Move pac
  const spd=0.12;
  if((p.dir.x||p.dir.y)&&canMove(p.x,p.y,p.dir.x,p.dir.y)){
    p.x+=p.dir.x*spd;p.y+=p.dir.y*spd;
  }
  wrapTunnel(p);

  // Mouth animation
  p.mouthAngle+=0.04*p.mouthDir;
  if(p.mouthAngle>0.25)p.mouthDir=-1;
  if(p.mouthAngle<0.02)p.mouthDir=1;

  // Eat dots
  const gc=Math.round(p.x),gr=Math.round(p.y);
  if(gr>=0&&gr<ROWS&&gc>=0&&gc<COLS){
    const cell=G.maze[gr][gc];
    if(cell===0){G.maze[gr][gc]=4;G.score+=10;G.dotsLeft--;updateHUD();}
    else if(cell===2){G.maze[gr][gc]=4;G.score+=50;G.dotsLeft--;
      G.ghosts.forEach(g=>{g.frightened=200;});G.powerTimer=200;updateHUD();}
  }
  if(G.powerTimer>0)G.powerTimer--;
  if(G.dotsLeft<=0){nextLevel();return;}

  // Move ghosts
  G.ghosts.forEach(g=>moveGhost(g));

  // Ghost collision
  G.ghosts.forEach(g=>{
    if(Math.hypot(p.x-g.x,p.y-g.y)<0.6){
      if(g.frightened>0){
        g.frightened=0;g.x=g.homeX;g.y=g.homeY;
        G.score+=200;updateHUD();
      } else {
        die();
      }
    }
  });

  if(G.score>G.best){G.best=G.score;localStorage.setItem('pac_best',G.best);updateHUD();}
}

function die(){
  G.lives--;updateHUD();
  if(G.lives<=0){endGame();return;}
  // Reset positions
  const maze=G.maze;
  G.pac={x:10.5,y:16.5,dir:{x:0,y:0},nextDir:{x:0,y:0},mouthAngle:0.25,mouthDir:1};
  G.ghosts.forEach((g,i)=>{g.x=g.homeX;g.y=g.homeY;g.frightened=0;
    const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];g.dir=dirs[i];});
}

function nextLevel(){
  G.level++;G.score+=G.level*500;
  G.maze=buildMaze();G.dotsLeft=countDots(G.maze);
  G.pac.x=10.5;G.pac.y=16.5;G.pac.dir={x:0,y:0};
  G.ghosts.forEach((g,i)=>{g.x=g.homeX;g.y=g.homeY;g.frightened=0;});
  updateHUD();
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('levelDisplay').textContent=G.level;
  document.getElementById('bestDisplay').textContent=G.best;
}

function draw(){
  const cs=CS();
  const offX=Math.floor((W-COLS*cs)/2),offY=Math.floor((H-ROWS*cs)/2);
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);

  // Maze
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const cell=G.maze[r][c];
    const x=offX+c*cs,y=offY+r*cs;
    if(cell===1){
      ctx.shadowBlur=4;ctx.shadowColor='rgba(59,130,246,.5)';
      ctx.fillStyle='#1a1a3e';ctx.fillRect(x,y,cs,cs);
      ctx.strokeStyle='rgba(59,130,246,.3)';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,cs-1,cs-1);
      ctx.shadowBlur=0;
    } else if(cell===0){
      ctx.fillStyle='#f59e0b';ctx.shadowBlur=4;ctx.shadowColor='#f59e0b';
      ctx.beginPath();ctx.arc(x+cs/2,y+cs/2,cs*0.12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    } else if(cell===2){
      const pulse=0.7+0.3*Math.sin(G.frame/8);
      ctx.fillStyle='#f59e0b';ctx.shadowBlur=10*pulse;ctx.shadowColor='#f59e0b';ctx.globalAlpha=pulse;
      ctx.beginPath();ctx.arc(x+cs/2,y+cs/2,cs*0.28,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.shadowBlur=0;
    }
  }

  // Ghosts
  G.ghosts.forEach(g=>{
    const gx=offX+(g.x)*cs,gy=offY+(g.y)*cs,r=cs*0.44;
    const color=g.frightened>30?'#3b82f6':g.frightened>0?(G.frame%16<8?'#fff':'#3b82f6'):g.color;
    ctx.shadowBlur=10;ctx.shadowColor=color;ctx.fillStyle=color;
    ctx.beginPath();ctx.arc(gx,gy-r*0.1,r,Math.PI,0);
    ctx.lineTo(gx+r,gy+r*0.8);
    for(let i=2;i>=0;i--){
      const wx=gx-r+r*2/3*i+r/3;
      ctx.quadraticCurveTo(wx,gy+r*0.3,wx-r/3,gy+r*0.8);
    }ctx.closePath();ctx.fill();
    if(!g.frightened){
      ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(gx-r*0.25,gy-r*0.1,r*0.22,r*0.28,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(gx+r*0.25,gy-r*0.1,r*0.22,r*0.28,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111';
      ctx.beginPath();ctx.arc(gx-r*0.25+g.dir.x*r*0.08,gy-r*0.1+g.dir.y*r*0.08,r*0.12,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(gx+r*0.25+g.dir.x*r*0.08,gy-r*0.1+g.dir.y*r*0.08,r*0.12,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;
  });

  // Pac-Man
  const p=G.pac;
  const px=offX+p.x*cs,py=offY+p.y*cs,pr=cs*0.44;
  const dirAngle=Math.atan2(p.dir.y,p.dir.x)||(p.nextDir.x||p.nextDir.y?Math.atan2(p.nextDir.y,p.nextDir.x):0);
  const mouth=p.mouthAngle*Math.PI;
  ctx.shadowBlur=14;ctx.shadowColor='#f59e0b';ctx.fillStyle='#f59e0b';
  ctx.beginPath();ctx.moveTo(px,py);
  ctx.arc(px,py,pr,dirAngle+mouth,dirAngle+Math.PI*2-mouth);
  ctx.closePath();ctx.fill();ctx.shadowBlur=0;

  // Power timer bar
  if(G.powerTimer>0){
    ctx.fillStyle='rgba(59,130,246,.4)';ctx.fillRect(offX,offY+ROWS*cs+2,COLS*cs*(G.powerTimer/200),4);}
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
  if(G.paused){G.paused=false;document.getElementById('pauseOverlay').classList.add('hidden');animId=requestAnimationFrame(gameLoop);}
  else{G.paused=true;G.running=false;document.getElementById('pauseOverlay').classList.remove('hidden');}
}

document.addEventListener('keydown',e=>{
  const d=G.pac?.nextDir;
  if(e.code==='ArrowLeft'||e.code==='KeyA'){G.pac&&(G.pac.nextDir={x:-1,y:0});e.preventDefault();}
  if(e.code==='ArrowRight'||e.code==='KeyD'){G.pac&&(G.pac.nextDir={x:1,y:0});e.preventDefault();}
  if(e.code==='ArrowUp'||e.code==='KeyW'){G.pac&&(G.pac.nextDir={x:0,y:-1});e.preventDefault();}
  if(e.code==='ArrowDown'||e.code==='KeyS'){G.pac&&(G.pac.nextDir={x:0,y:1});e.preventDefault();}
  if(e.code==='KeyP')pause();
});
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
