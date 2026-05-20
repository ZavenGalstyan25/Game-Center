'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;
const COLS=10,ROWS=12;
const COLORS=['#ef4444','#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899'];

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function BR(){return Math.min(W/(COLS+1)*0.48,22);}

function initGame(){
  const br=BR();
  G={
    grid:buildGrid(7),
    shooter:{x:W/2,y:H-40,color:randColor(),nextColor:randColor(),angle:-Math.PI/2},
    bullet:null,particles:[],
    score:0,best:parseInt(localStorage.getItem('bub_best')||0),
    running:false,over:false,
    pendingDrop:0
  };
  updateHUD();
}

function randColor(){return COLORS[Math.floor(Math.random()*COLORS.length)];}

function buildGrid(rows){
  const grid=[];
  for(let r=0;r<rows;r++){
    const row=[];
    const cols=r%2===0?COLS:COLS-1;
    for(let c=0;c<cols;c++){
      row.push({color:randColor(),r:0,c,active:true});
    }
    grid.push(row);
  }
  return grid;
}

function bubblePos(r,c){
  const br=BR();
  const off=r%2===0?0:br;
  const startX=(W-(COLS*br*2-br))/2;
  return{x:startX+c*br*2+br+off,y:40+r*br*1.74};
}

function nearestBubble(bx,by){
  const br=BR();
  let bestR=-1,bestC=-1,bestDist=999;
  for(let r=0;r<=G.grid.length;r++){
    const cols=r%2===0?COLS:COLS-1;
    for(let c=0;c<cols;c++){
      const pos=bubblePos(r,c);
      const d=Math.hypot(bx-pos.x,by-pos.y);
      if(d<bestDist){bestDist=d;bestR=r;bestC=c;}
    }
  }
  return{r:bestR,c:bestC};
}

function placeBubble(bx,by,color){
  const {r,c}=nearestBubble(bx,by);
  if(r>=G.grid.length)G.grid.push([]);
  if(!G.grid[r])G.grid[r]=[];
  const cols=r%2===0?COLS:COLS-1;
  if(c>=0&&c<cols){
    G.grid[r][c]={color,active:true};
    checkMatches(r,c,color);
  }
}

function getNeighbors(r,c){
  const ns=[];
  const even=r%2===0;
  const offsets=even?[[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]]:
                     [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
  offsets.forEach(([dr,dc])=>{
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<G.grid.length&&nc>=0&&G.grid[nr]&&nc<G.grid[nr].length&&G.grid[nr][nc]?.active)
      ns.push({r:nr,c:nc});
  });
  return ns;
}

function floodFill(r,c,color,visited=new Set()){
  const key=`${r},${c}`;
  if(visited.has(key))return[];
  if(!G.grid[r]||!G.grid[r][c]?.active)return[];
  if(G.grid[r][c].color!==color)return[];
  visited.add(key);
  const matches=[{r,c}];
  getNeighbors(r,c).forEach(n=>matches.push(...floodFill(n.r,n.c,color,visited)));
  return matches;
}

function checkMatches(r,c,color){
  const matches=floodFill(r,c,color);
  if(matches.length>=3){
    matches.forEach(m=>{
      if(G.grid[m.r]&&G.grid[m.r][m.c]){
        const pos=bubblePos(m.r,m.c);
        spawnParticles(pos.x,pos.y,color,8);
        G.grid[m.r][m.c].active=false;
      }
    });
    G.score+=matches.length*10;
    if(G.score>G.best){G.best=G.score;localStorage.setItem('bub_best',G.best);}
    updateHUD();
    // Remove floating
    removeFloating();
  }
  // Check lose (bubbles reached shooter)
  const br=BR();
  for(const row of G.grid)for(const b of(row||[]))if(b?.active){
    const pos=bubblePos(G.grid.indexOf(row),row.indexOf(b));
    if(pos.y>H-100){endGame();return;}
  }
}

function removeFloating(){
  // Mark connected to top
  const connected=new Set();
  const q=[];
  for(let c=0;c<(G.grid[0]?.length||0);c++){
    if(G.grid[0]?.[c]?.active){q.push({r:0,c});connected.add(`0,${c}`);}
  }
  while(q.length){
    const {r,c}=q.shift();
    getNeighbors(r,c).forEach(n=>{
      const key=`${n.r},${n.c}`;
      if(!connected.has(key)&&G.grid[n.r]?.[n.c]?.active){
        connected.add(key);q.push(n);
      }
    });
  }
  let dropped=0;
  G.grid.forEach((row,r)=>row.forEach((b,c)=>{
    if(b?.active&&!connected.has(`${r},${c}`)){
      const pos=bubblePos(r,c);
      spawnParticles(pos.x,pos.y,b.color,6);
      b.active=false;dropped++;
    }
  }));
  if(dropped>0){G.score+=dropped*25;updateHUD();}
}

function spawnParticles(x,y,color,n){
  for(let i=0;i<n;i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*8,vy:(Math.random()-.5)*8,life:1,color,size:3+Math.random()*3});
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  const total=G.grid.flat().filter(b=>b?.active).length;
  document.getElementById('bubblesDisplay').textContent=total;
  document.getElementById('bestDisplay').textContent=G.best;
}

function update(){
  if(!G.running||G.over)return;
  const br=BR();
  if(G.bullet){
    const b=G.bullet;
    b.x+=b.vx*8;b.y+=b.vy*8;
    // Wall bounce
    if(b.x-br<0){b.x=br;b.vx=Math.abs(b.vx);}
    if(b.x+br>W){b.x=W-br;b.vx=-Math.abs(b.vx);}
    // Ceiling
    if(b.y-br<40){b.y=40+br;placeBubble(b.x,b.y,b.color);G.bullet=null;nextBullet();return;}
    // Hit a bubble
    let hit=false;
    for(let r=0;r<G.grid.length&&!hit;r++){
      for(let c=0;c<(G.grid[r]?.length||0)&&!hit;c++){
        if(!G.grid[r][c]?.active)continue;
        const pos=bubblePos(r,c);
        if(Math.hypot(b.x-pos.x,b.y-pos.y)<br*2.1){
          placeBubble(b.x,b.y-br*1.5,b.color);G.bullet=null;hit=true;nextBullet();
        }
      }
    }
  }
  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=0.04;return p.life>0;});
}

function nextBullet(){
  G.shooter.color=G.shooter.nextColor;
  G.shooter.nextColor=randColor();
  G.pendingDrop++;
  if(G.pendingDrop>=5){G.pendingDrop=0;dropRow();}
  updateHUD();
}

function dropRow(){
  // Add a new row at the top
  if(G.grid.length>ROWS){endGame();return;}
  const newRow=[];
  const cols=G.grid.length%2===0?COLS:COLS-1;
  for(let c=0;c<cols;c++)newRow.push({color:randColor(),active:true});
  G.grid.unshift(newRow);
}

function shoot(angle){
  if(G.bullet||!G.running)return;
  const a=Math.max(-Math.PI+0.2,Math.min(-0.2,angle));
  G.bullet={x:G.shooter.x,y:G.shooter.y,vx:Math.cos(a),vy:Math.sin(a),color:G.shooter.color};
}

function draw(){
  const br=BR();
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,.02)';
  for(let i=0;i<60;i++)ctx.fillRect((i*137)%W,(i*97)%H,1,1);

  // Grid line
  ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,H-80);ctx.lineTo(W,H-80);ctx.stroke();

  // Bubbles
  for(let r=0;r<G.grid.length;r++){
    for(let c=0;c<(G.grid[r]?.length||0);c++){
      const b=G.grid[r][c];if(!b||!b.active)continue;
      const pos=bubblePos(r,c);
      drawBubble(pos.x,pos.y,br,b.color);
    }
  }

  // Bullet
  if(G.bullet)drawBubble(G.bullet.x,G.bullet.y,br,G.bullet.color);

  // Shooter
  const s=G.shooter;
  // Aim line
  ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1.5;ctx.setLineDash([8,6]);
  ctx.beginPath();ctx.moveTo(s.x,s.y);
  ctx.lineTo(s.x+Math.cos(s.angle)*120,s.y+Math.sin(s.angle)*120);ctx.stroke();ctx.setLineDash([]);

  drawBubble(s.x,s.y,br,s.color);
  // Next bubble preview
  ctx.fillStyle='rgba(255,255,255,.4)';ctx.font='10px "Exo 2",sans-serif';ctx.textAlign='center';
  ctx.fillText('NEXT',s.x+br*2.5,s.y+4);ctx.textAlign='left';
  drawBubble(s.x+br*2.5,s.y+16,br*0.7,s.nextColor);

  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
}

function drawBubble(x,y,r,color){
  ctx.shadowBlur=10;ctx.shadowColor=color;ctx.fillStyle=color;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(x-r*0.25,y-r*0.25,r*0.35,0,Math.PI*2);ctx.fill();
}

function gameLoop(){
  if(!G.running)return;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

function endGame(){
  G.over=true;G.running=false;
  document.getElementById('finalScore').textContent='Score: '+G.score;
  setTimeout(()=>document.getElementById('gameOverOverlay').classList.remove('hidden'),400);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove',e=>{
  if(!G.running)return;
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  G.shooter.angle=Math.atan2(my-G.shooter.y,mx-G.shooter.x);
  G.shooter.angle=Math.max(-Math.PI+0.15,Math.min(-0.15,G.shooter.angle));
});
canvas.addEventListener('click',e=>{
  if(!G.running)return;
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  shoot(Math.atan2(my-G.shooter.y,mx-G.shooter.x));
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
