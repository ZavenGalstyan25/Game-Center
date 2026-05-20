'use strict';
const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
let W,H,G={},animId=null,gameTimer=null;
const FRUITS=[
  {emoji:'🍉',color:'#ef4444',pts:10},
  {emoji:'🍊',color:'#f59e0b',pts:10},
  {emoji:'🍋',color:'#eab308',pts:10},
  {emoji:'🍇',color:'#a855f7',pts:15},
  {emoji:'🍓',color:'#ec4899',pts:15},
  {emoji:'🥭',color:'#f97316',pts:20},
  {emoji:'🍑',color:'#fb923c',pts:20},
];

function resize(){
  const area=document.querySelector('.game-area');
  W=canvas.width=area.clientWidth-4;
  H=canvas.height=area.clientHeight-4;
}

function initGame(){
  G={
    fruits:[],slices:[],particles:[],blade:[],
    score:0,lives:3,timeLeft:60,
    best:parseInt(localStorage.getItem('fruit_best')||0),
    running:false,over:false,
    spawnTimer:0,combo:0,comboTimer:0,
    mouseDown:false
  };
  document.getElementById('bestDisplay').textContent=G.best;
}

function spawnFruit(){
  const isBomb=Math.random()<0.12;
  const x=W*0.1+Math.random()*W*0.8;
  const vy=-(8+Math.random()*6);
  const vx=(Math.random()-.5)*4;
  if(isBomb){
    G.fruits.push({x,y:H+30,vx,vy,r:28,emoji:'💣',isBomb:true,rot:0,rotSpeed:(Math.random()-.5)*0.08});
  } else {
    const f=FRUITS[Math.floor(Math.random()*FRUITS.length)];
    G.fruits.push({x,y:H+30,vx,vy,r:28,emoji:f.emoji,color:f.color,pts:f.pts,isBomb:false,rot:0,rotSpeed:(Math.random()-.5)*0.05,sliced:false});
  }
}

function checkSlice(){
  if(G.blade.length<2)return;
  const last=G.blade[G.blade.length-1],prev=G.blade[G.blade.length-2];
  G.fruits=G.fruits.filter(f=>{
    if(f.sliced)return true;
    const dx=last.x-prev.x,dy=last.y-prev.y;
    const fx=f.x-prev.x,fy=f.y-prev.y;
    const t=Math.max(0,Math.min(1,(fx*dx+fy*dy)/(dx*dx+dy*dy)));
    const cx=prev.x+t*dx,cy=prev.y+t*dy;
    if(Math.hypot(f.x-cx,f.y-cy)<f.r+4){
      f.sliced=true;
      if(f.isBomb){die();return false;}
      G.score+=f.pts;G.combo++;G.comboTimer=40;
      if(G.score>G.best){G.best=G.score;localStorage.setItem('fruit_best',G.best);}
      spawnSliceEffect(f);
      updateHUD();return false;
    }
    return true;
  });
}

function spawnSliceEffect(f){
  for(let i=0;i<16;i++)
    G.particles.push({x:f.x,y:f.y,vx:(Math.random()-.5)*12,vy:(Math.random()-.5)*12,
      life:1,color:f.color||'#ef4444',size:3+Math.random()*4,emoji:null});
  G.slices.push({x:f.x,y:f.y,emoji:f.emoji,pts:f.pts,vy:-2,life:1});
}

function die(){
  G.lives--;updateHUD();
  G.combo=0;
  if(G.lives<=0)endGame();
}

function updateHUD(){
  document.getElementById('scoreDisplay').textContent=G.score;
  document.getElementById('livesDisplay').textContent=G.lives;
  document.getElementById('bestDisplay').textContent=G.best;
}

function update(){
  if(!G.running||G.over)return;
  const GRAVITY=0.28;

  G.spawnTimer++;
  if(G.spawnTimer>=Math.max(20,50-G.score/20)){G.spawnTimer=0;spawnFruit();}

  G.fruits=G.fruits.filter(f=>{
    f.x+=f.vx;f.y+=f.vy;f.vy+=GRAVITY;f.rot+=f.rotSpeed;
    if(f.y>H+60&&!f.sliced){
      if(!f.isBomb){G.combo=0;} // missed fruit
      return false;
    }
    return true;
  });

  if(G.comboTimer>0)G.comboTimer--;
  else G.combo=0;

  G.particles=G.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life-=0.04;return p.life>0;});
  G.slices=G.slices.filter(s=>{s.y+=s.vy;s.vy+=0.05;s.life-=0.03;return s.life>0;});
  G.blade=G.blade.filter(b=>{b.life-=0.06;return b.life>0;});
}

function draw(){
  ctx.fillStyle='#050508';ctx.fillRect(0,0,W,H);
  // BG stars
  ctx.fillStyle='rgba(255,255,255,.2)';
  for(let i=0;i<60;i++)ctx.fillRect((i*137)%W,(i*97)%H,1,1);

  // Blade trail
  if(G.blade.length>1){
    ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.shadowBlur=8;ctx.shadowColor='#fff';
    ctx.beginPath();ctx.moveTo(G.blade[0].x,G.blade[0].y);
    G.blade.forEach((b,i)=>{
      ctx.globalAlpha=b.life;
      if(i>0)ctx.lineTo(b.x,b.y);
    });ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;
  }

  // Fruits
  G.fruits.forEach(f=>{
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.rot);
    ctx.font=`${f.r*1.6}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(f.emoji,0,0);
    if(!f.isBomb){
      ctx.shadowBlur=8;ctx.shadowColor=f.color||'#fff';
      ctx.strokeStyle=(f.color||'#fff')+'80';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,f.r,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
    }
    ctx.restore();
  });

  // Particles
  G.particles.forEach(p=>{
    ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowBlur=6;ctx.shadowColor=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });

  // Score popups
  G.slices.forEach(s=>{
    ctx.globalAlpha=s.life;
    ctx.font=`${20}px sans-serif`;ctx.textAlign='center';ctx.fillText(s.emoji,s.x,s.y);
    ctx.fillStyle='#f59e0b';ctx.font=`bold 16px "Exo 2",sans-serif`;
    ctx.fillText('+'+s.pts,s.x+20,s.y-10);
    ctx.globalAlpha=1;ctx.textAlign='left';
  });

  // Combo
  if(G.combo>2){
    ctx.fillStyle='#f59e0b';ctx.font=`bold ${28+G.combo*2}px "Exo 2",sans-serif`;
    ctx.textAlign='center';ctx.shadowBlur=12;ctx.shadowColor='#f59e0b';
    ctx.fillText(G.combo+'x COMBO!',W/2,80);ctx.shadowBlur=0;ctx.textAlign='left';
  }

  // Lives (hearts)
  ctx.font='22px sans-serif';
  for(let i=0;i<G.lives;i++)ctx.fillText('❤️',10+i*28,H-10);
}

function gameLoop(){
  if(!G.running)return;
  update();draw();animId=requestAnimationFrame(gameLoop);
}

function endGame(){
  G.over=true;G.running=false;clearInterval(gameTimer);
  document.getElementById('finalScore').textContent='Score: '+G.score;
  setTimeout(()=>document.getElementById('gameOverOverlay').classList.remove('hidden'),500);
}

function startGame(){
  resize();initGame();
  document.getElementById('startOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
  G.running=true;
  document.getElementById('timeDisplay').textContent=60;
  gameTimer=setInterval(()=>{
    G.timeLeft--;document.getElementById('timeDisplay').textContent=G.timeLeft;
    if(G.timeLeft<=0){
      document.getElementById('finalScore').textContent='Score: '+G.score;
      G.running=false;G.over=true;clearInterval(gameTimer);
      document.getElementById('gameOverOverlay').classList.remove('hidden');
    }
  },1000);
  cancelAnimationFrame(animId);animId=requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove',e=>{
  if(!G.running)return;
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  if(G.mouseDown){G.blade.push({x:mx,y:my,life:1});checkSlice();}
});
canvas.addEventListener('mousedown',e=>{G.mouseDown=true;});
canvas.addEventListener('mouseup',e=>{G.mouseDown=false;});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();if(!G.running)return;
  const rect=canvas.getBoundingClientRect();
  const t=e.touches[0];
  G.blade.push({x:t.clientX-rect.left,y:t.clientY-rect.top,life:1});checkSlice();
},{passive:false});

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
