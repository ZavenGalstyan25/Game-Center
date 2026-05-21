'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null;
const CELL=40;

// Map: 0=buildable, 1=wall/decoration, P=path
const MAP_TEMPLATE=[
  '11111111111111111',
  '1P000000001000001',
  '1P111111001000001',
  '1P111111001000001',
  '1PPPPPP1001111001',
  '1111PP01001111001',
  '1000PP01000000001',
  '1000PP01111111111',
  '1000PPPPPP0000001',
  '1111110111P000001',
  '1000000111P000001',
  '1000000111P111111',
  '1000000000PPPPP01',
  '111111111111110P1',
  '10000000000000PP1',
  '1111111111111111X',
];
const ROWS=MAP_TEMPLATE.length,COLS=MAP_TEMPLATE[0].length;

const TOWER_DEFS={
  gun:  {cost:50,range:120,rate:25,dmg:1,color:'#00d4ff',glow:'rgba(0,212,255,.5)',emoji:'🔫',projectileColor:'#00d4ff',projR:3,projSpd:8,splash:0},
  laser:{cost:80,range:160,rate:60,dmg:3,color:'#ef4444',glow:'rgba(239,68,68,.5)',emoji:'⚡',projectileColor:'#ef4444',projR:2,projSpd:0,splash:0,pierce:true},
  cannon:{cost:120,range:100,rate:80,dmg:5,color:'#f59e0b',glow:'rgba(245,158,11,.5)',emoji:'💣',projectileColor:'#f59e0b',projR:6,projSpd:5,splash:60},
  freeze:{cost:100,range:130,rate:50,dmg:1,color:'#a5f3fc',glow:'rgba(165,243,252,.5)',emoji:'❄️',projectileColor:'#a5f3fc',projR:5,projSpd:6,slow:0.5,slowDur:60}
};

const ENEMY_TYPES=[
  {hp:3,spd:1.2,reward:5,pts:10,color:'#ef4444',r:8,emoji:'👾'},
  {hp:6,spd:0.8,reward:10,pts:20,color:'#f97316',r:10,emoji:'🤖'},
  {hp:15,spd:0.6,reward:20,pts:50,color:'#7c3aed',r:12,emoji:'👹'},
  {hp:40,spd:0.4,reward:50,pts:150,color:'#dc2626',r:16,emoji:'💀'},
];

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function CS(){return Math.min(Math.floor(W/COLS),Math.floor(H/ROWS));}

function buildPath(){
  const path=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(MAP_TEMPLATE[r][c]==='P'||MAP_TEMPLATE[r][c]==='X')path.push({r,c});
  }
  // Sort path: follow connected neighbors
  const firstP=path.find(p=>MAP_TEMPLATE[p.r][p.c]==='P'&&p.c===0)||path[0];
  const sorted=[firstP];
  const visited=new Set([`${sorted[0].r},${sorted[0].c}`]);
  while(sorted.length<path.length){
    const last=sorted[sorted.length-1];
    const next=path.find(p=>{
      if(visited.has(`${p.r},${p.c}`))return false;
      return Math.abs(p.r-last.r)+Math.abs(p.c-last.c)===1;
    });
    if(!next)break;
    visited.add(`${next.r},${next.c}`);sorted.push(next);
  }
  return sorted;
}

function initGame(){
  const cs=CS();
  G={
    grid:Array.from({length:ROWS},()=>Array(COLS).fill(null)),
    path:buildPath(),towers:[],enemies:[],projectiles:[],particles:[],floats:[],
    gold:100,lives:20,wave:0,score:0,
    running:false,over:false,waveActive:false,
    spawnQueue:[],spawnTimer:0,
    selectedTower:'gun',hoverCell:null
  };
  document.querySelectorAll('.tower-btn').forEach(b=>{
    b.classList.toggle('selected',b.dataset.tower==='gun');
  });
  updateHUD();
}

function updateHUD(){
  document.getElementById('goldDisplay').textContent=G.gold;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('waveDisplay').textContent=G.wave;
  document.getElementById('scoreDisplay').textContent=G.score;
}

function startWave(){
  G.wave++;G.waveActive=true;
  const n=5+G.wave*3;G.spawnQueue=[];
  for(let i=0;i<n;i++){
    const typeIdx=Math.min(ENEMY_TYPES.length-1,Math.floor(Math.random()*Math.min(4,1+G.wave/3)));
    const t=ENEMY_TYPES[typeIdx];
    G.spawnQueue.push({hp:t.hp*(1+G.wave*0.15)|0,spd:t.spd,reward:t.reward,pts:t.pts,
      color:t.color,r:t.r,emoji:t.emoji,delay:i*40});
  }
  G.spawnTimer=0;updateHUD();
}

function pathPos(idx,cs){
  const p=G.path[idx];
  if(!p)return null;
  const ox=Math.floor((W-COLS*cs)/2),oy=Math.floor((H-ROWS*cs)/2);
  return{x:ox+(p.c+0.5)*cs,y:oy+(p.r+0.5)*cs};
}

function spawnEnemy(def){
  const cs=CS();
  const start=pathPos(0,cs);
  G.enemies.push({
    x:start.x,y:start.y,
    hp:def.hp,maxHp:def.hp,spd:def.spd*(cs/40),reward:def.reward,pts:def.pts,
    color:def.color,r:def.r*(cs/40),emoji:def.emoji,
    pathIdx:0,slowTimer:0,slowMult:1
  });
}

function towerShoot(t){
  const def=TOWER_DEFS[t.type];
  if(t.cooldown>0){t.cooldown--;return;}
  // Find closest enemy in range
  let target=null,minDist=Infinity;
  G.enemies.forEach(e=>{
    const d=Math.hypot(e.x-t.x,e.y-t.y);
    if(d<def.range&&d<minDist){minDist=d;target=e;}
  });
  if(!target)return;
  t.cooldown=def.rate;t.target=target;

  if(def.pierce){// laser - instant
    G.enemies.forEach(e=>{
      if(Math.hypot(e.x-t.x,e.y-t.y)<def.range){
        e.hp-=def.dmg;if(def.slow)e.slowTimer=def.slowDur||60;
        if(e.hp<=0)killEnemy(e);
      }
    });
    spawnParticles(t.x,t.y,def.color,4);
    G.projectiles.push({x:t.x,y:t.y,tx:target.x,ty:target.y,color:def.projectileColor,laser:true,life:8});
  } else {
    G.projectiles.push({
      x:t.x,y:t.y,target,vx:0,vy:0,
      spd:def.projSpd*(CS()/40),r:def.projR*(CS()/40),
      dmg:def.dmg,color:def.projectileColor,splash:def.splash*(CS()/40),
      slow:def.slow||0,slowDur:def.slowDur||0,life:120
    });
  }
}

function killEnemy(e){
  e.hp=0;
  G.gold+=e.reward;G.score+=e.pts;
  if(G.score>parseInt(localStorage.getItem('td_best')||0))localStorage.setItem('td_best',G.score);
  spawnParticles(e.x,e.y,e.color,10);
  G.floats.push({x:e.x,y:e.y,text:'+'+e.reward+'💰',life:1,vy:-1.5});
  updateHUD();
}

function spawnParticles(x,y,color,n){
  for(let i=0;i<(n||8);i++)
    G.particles.push({x,y,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,life:1,color,size:2+Math.random()*3});
}

function update(){
  if(!G.running||G.over)return;
  const cs=CS();

  // Spawn enemies
  if(G.waveActive&&G.spawnQueue.length>0){
    G.spawnTimer++;
    const next=G.spawnQueue[0];
    if(G.spawnTimer>=next.delay){G.spawnQueue.shift();spawnEnemy(next);}
  }

  // Move enemies
  G.enemies.forEach(e=>{
    if(e.hp<=0)return;
    if(e.slowTimer>0){e.slowTimer--;} else{e.slowMult=1;}
    const next=pathPos(e.pathIdx+1,cs);
    if(!next){// reached end
      G.lives--;if(G.lives<=0){endGame();return;}
      e.hp=0;updateHUD();return;
    }
    const dx=next.x-e.x,dy=next.y-e.y,dist=Math.hypot(dx,dy);
    const mv=e.spd*(e.slowMult||1);
    if(dist<mv){e.x=next.x;e.y=next.y;e.pathIdx++;}
    else{e.x+=dx/dist*mv;e.y+=dy/dist*mv;}
  });
  G.enemies=G.enemies.filter(e=>e.hp>0);

  // Check wave done
  if(G.waveActive&&G.spawnQueue.length===0&&G.enemies.length===0){
    G.waveActive=false;G.gold+=20+G.wave*5;updateHUD();
  }

  // Towers shoot
  G.towers.forEach(t=>towerShoot(t));

  // Projectiles
  G.projectiles=G.projectiles.filter(p=>{
    p.life--;
    if(p.laser)return p.life>0;
    const tgt=p.target;
    if(!tgt||tgt.hp<=0){return false;}
    const dx=tgt.x-p.x,dy=tgt.y-p.y,dist=Math.hypot(dx,dy);
    if(dist<p.spd+p.r){
      if(p.splash>0){
        G.enemies.forEach(e=>{
          if(Math.hypot(e.x-tgt.x,e.y-tgt.y)<p.splash){
            e.hp-=p.dmg;if(p.slow)e.slowTimer=p.slowDur;
            if(e.hp<=0)killEnemy(e);
          }
        });
        spawnParticles(tgt.x,tgt.y,'#f59e0b',14);
      } else {
        tgt.hp-=p.dmg;if(p.slow){tgt.slowTimer=p.slowDur;tgt.slowMult=p.slow;}
        if(tgt.hp<=0)killEnemy(tgt);
      }
      return false;
    }
    p.x+=dx/dist*p.spd;p.y+=dy/dist*p.spd;
    return p.life>0;
  });

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.04;return p.life>0;});
  G.floats=G.floats.filter(f=>{f.y+=f.vy;f.life-=0.02;return f.life>0;});
}

function drawMap(){
  const cs=CS();
  const ox=Math.floor((W-COLS*cs)/2),oy=Math.floor((H-ROWS*cs)/2);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const cell=MAP_TEMPLATE[r][c];
    const x=ox+c*cs,y=oy+r*cs;
    if(cell==='P'||cell==='X'){
      ctx.fillStyle='rgba(100,80,40,.6)';ctx.fillRect(x,y,cs,cs);
      ctx.strokeStyle='rgba(200,150,60,.2)';ctx.lineWidth=1;ctx.strokeRect(x,y,cs,cs);
    } else if(cell==='1'){
      ctx.fillStyle='rgba(8,8,20,.9)';ctx.fillRect(x,y,cs,cs);
      ctx.strokeStyle='rgba(124,58,237,.1)';ctx.lineWidth=1;ctx.strokeRect(x,y,cs,cs);
    } else {
      ctx.fillStyle='rgba(10,20,15,.7)';ctx.fillRect(x,y,cs,cs);
      ctx.strokeStyle='rgba(16,185,129,.06)';ctx.lineWidth=1;ctx.strokeRect(x,y,cs,cs);
    }
  }
  // Hover cell
  if(G.hoverCell&&canPlace(G.hoverCell.r,G.hoverCell.c)){
    const def=TOWER_DEFS[G.selectedTower];
    const hx=ox+G.hoverCell.c*cs,hy=oy+G.hoverCell.r*cs;
    ctx.fillStyle='rgba(16,185,129,.15)';ctx.fillRect(hx,hy,cs,cs);
    ctx.strokeStyle='rgba(16,185,129,.6)';ctx.lineWidth=2;ctx.strokeRect(hx,hy,cs,cs);
    const tx=hx+cs/2,ty=hy+cs/2;
    ctx.strokeStyle=G.gold>=def.cost?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)';
    ctx.lineWidth=1;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.arc(tx,ty,def.range,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  }
  // End marker
  const end=G.path[G.path.length-1];
  if(end){
    ctx.font=`${cs*0.7}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🏠',ox+(end.c+0.5)*cs,oy+(end.r+0.5)*cs);
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }
}

function drawTowers(){
  const cs=CS(),ox=Math.floor((W-COLS*cs)/2),oy=Math.floor((H-ROWS*cs)/2);
  G.towers.forEach(t=>{
    const def=TOWER_DEFS[t.type];
    ctx.shadowBlur=8;ctx.shadowColor=def.glow;ctx.fillStyle='#1a1a2e';
    ctx.beginPath();ctx.roundRect(t.x-cs*0.42,t.y-cs*0.42,cs*0.84,cs*0.84,5);ctx.fill();
    ctx.strokeStyle=def.color;ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
    // Turret barrel
    if(t.target){
      const dx=t.target.x-t.x,dy=t.target.y-t.y;
      const ang=Math.atan2(dy,dx);
      ctx.strokeStyle=def.color;ctx.lineWidth=3;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+Math.cos(ang)*cs*0.45,t.y+Math.sin(ang)*cs*0.45);ctx.stroke();
    }
    ctx.font=`${cs*0.55}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(def.emoji,t.x,t.y);ctx.textAlign='left';ctx.textBaseline='alphabetic';
  });
}

function drawEnemies(){
  G.enemies.forEach(e=>{
    if(e.hp<=0)return;
    ctx.shadowBlur=6;ctx.shadowColor=e.color;
    ctx.font=`${e.r*2.2}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    if(e.slowTimer>0){ctx.globalAlpha=0.7;}
    ctx.fillText(e.emoji,e.x,e.y);ctx.globalAlpha=1;
    // HP bar
    const bw=e.r*2.5;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(e.x-bw/2,e.y-e.r-8,bw,4);
    ctx.fillStyle=e.hp/e.maxHp>0.5?'#10b981':'#ef4444';
    ctx.fillRect(e.x-bw/2,e.y-e.r-8,bw*(e.hp/e.maxHp),4);
    ctx.shadowBlur=0;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  });
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  drawMap();drawTowers();

  // Projectiles
  G.projectiles.forEach(p=>{
    if(p.laser){
      ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.globalAlpha=p.life/8;
      ctx.shadowBlur=8;ctx.shadowColor=p.color;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.tx,p.ty);ctx.stroke();
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    } else {
      ctx.shadowBlur=8;ctx.shadowColor=p.color;ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
  });

  drawEnemies();

  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=4;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
  G.floats.forEach(f=>{
    ctx.globalAlpha=f.life;ctx.fillStyle='#f59e0b';ctx.font=`bold 13px "Exo 2",sans-serif`;
    ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;ctx.textAlign='left';
  });

  // Wave status
  if(!G.waveActive&&G.running&&!G.over){
    ctx.fillStyle='rgba(16,185,129,.7)';ctx.font=`bold 14px "Exo 2",sans-serif`;
    ctx.textAlign='center';ctx.fillText('▶ Click NEXT WAVE to start',W/2,H-8);ctx.textAlign='left';
  }
}

function canPlace(r,c){
  if(r<0||r>=ROWS||c<0||c>=COLS)return false;
  if(MAP_TEMPLATE[r][c]!=='0')return false;
  if(G.grid[r][c])return false;
  return true;
}

function placeTower(r,c){
  const def=TOWER_DEFS[G.selectedTower];
  if(G.gold<def.cost)return;
  if(!canPlace(r,c))return;
  const cs=CS();const ox=Math.floor((W-COLS*cs)/2),oy=Math.floor((H-ROWS*cs)/2);
  const tx=ox+(c+0.5)*cs,ty=oy+(r+0.5)*cs;
  G.grid[r][c]={type:G.selectedTower};
  G.towers.push({x:tx,y:ty,r,c,type:G.selectedTower,cooldown:0,target:null});
  G.gold-=def.cost;updateHUD();
}

function sellTower(r,c){
  const tower=G.grid[r][c];if(!tower)return;
  const def=TOWER_DEFS[tower.type];
  G.gold+=Math.floor(def.cost/2);
  G.grid[r][c]=null;
  G.towers=G.towers.filter(t=>!(t.r===r&&t.c===c));
  updateHUD();
}

function getCell(e){
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  const cs=CS();const ox=Math.floor((W-COLS*cs)/2),oy=Math.floor((H-ROWS*cs)/2);
  const c=Math.floor((mx-ox)/cs),r=Math.floor((my-oy)/cs);
  return{r,c};
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

canvas.addEventListener('click',e=>{
  if(!G.running||G.over)return;
  const{r,c}=getCell(e);placeTower(r,c);
});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();if(!G.running||G.over)return;
  const{r,c}=getCell(e);sellTower(r,c);
});
canvas.addEventListener('mousemove',e=>{
  if(!G.running)return;
  const{r,c}=getCell(e);G.hoverCell={r,c};
});
canvas.addEventListener('mouseleave',()=>G.hoverCell=null);

document.querySelectorAll('.tower-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    G.selectedTower=b.dataset.tower;
    document.querySelectorAll('.tower-btn').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
  });
});

document.getElementById('nextWaveBtn').addEventListener('click',()=>{if(G.running&&!G.waveActive)startWave();});
document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('retryBtn').addEventListener('click',startGame);
document.getElementById('restartBtn').addEventListener('click',startGame);
window.addEventListener('resize',resize);

window.addEventListener('load',()=>{
  resize();
  const bar=document.getElementById('load-bar');
  let p=0;const iv=setInterval(()=>{p+=Math.random()*25;if(p>=100){p=100;clearInterval(iv);
    setTimeout(()=>document.getElementById('loading-screen').classList.add('hide'),400);}
    bar.style.width=p+'%';},100);
});
