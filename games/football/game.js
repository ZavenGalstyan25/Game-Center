/* ============================================================
   STREET FOOTBALL — GAME LOGIC (FIXED & ENHANCED)
   ============================================================ */

(function() {
  const bar=document.getElementById('load-bar'),screen=document.getElementById('loading-screen');
  let p=0;const t=setInterval(()=>{p+=Math.random()*20+10;bar.style.width=Math.min(p,95)+'%';if(p>=95){clearInterval(t);setTimeout(()=>{bar.style.width='100%';setTimeout(()=>screen.classList.add('hide'),400)},300);}},120);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const a = canvas.parentElement;
  const aspectW = 800, aspectH = 500;
  const scale = Math.min(a.clientWidth / aspectW, a.clientHeight / aspectH);
  canvas.width = Math.floor(aspectW * scale);
  canvas.height = Math.floor(aspectH * scale);
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
}
resizeCanvas(); window.addEventListener('resize', () => { resizeCanvas(); });

const S = () => canvas.width / 800;

const G = {
  score1: 0, score2: 0, timeLeft: 120,
  running: false, paused: false, ended: false,
  tickTimer: 0, scoringCooldown: 0, kickCooldown: 0,
};

const keys = {};

function F() {
  const s = S();
  const goalH = 110 * s;
  const goalW = 50 * s;
  const fx = 70 * s, fy = 50 * s;
  const fw = canvas.width - 140 * s;
  const fh = canvas.height - 100 * s;
  return {
    x: fx, y: fy, w: fw, h: fh,
    goalW, goalH,
    cx: canvas.width / 2, cy: canvas.height / 2,
  };
}

const PLAYER_R = () => 18 * S();
const BALL_R   = () => 10 * S();
const CPU_SPEED  = () => 3.0 * S();
const PLAYER_SPD = () => 5.0 * S();

function createCharacter(x, y, color, team) {
  return { x, y, vx:0, vy:0, color, team, number: team === 1 ? '1' : '2' };
}
function createBall(x, y) {
  return { x, y, vx:0, vy:0, lastTouchedBy:null };
}

let player, cpu, ball, particles = [];

function reset() {
  const f = F();
  player = createCharacter(f.cx - 140*S(), f.cy, '#00d4ff', 1);
  cpu    = createCharacter(f.cx + 140*S(), f.cy, '#ef4444', 2);
  ball   = createBall(f.cx, f.cy);
  // Random starting direction
  const ang = (Math.random() * 60 - 30) * Math.PI / 180 + (Math.random() < 0.5 ? 0 : Math.PI);
  ball.vx = Math.cos(ang) * 4 * S();
  ball.vy = Math.sin(ang) * 4 * S();
  G.scoringCooldown = 100;
  G.kickCooldown = 0;
}

/* ---- DRAW PITCH ---- */
function drawPitch() {
  const f = F(), s = S();
  const goalTop = f.cy - f.goalH/2;

  // Sky dark background
  ctx.fillStyle = '#050a08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grass with stripes
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i%2===0 ? '#0d2310' : '#0f2a13';
    ctx.fillRect(f.x + i*(f.w/8), f.y, f.w/8, f.h);
  }

  // Field outline with shadow
  ctx.shadowBlur = 12; ctx.shadowColor = '#00ff88';
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5*s;
  ctx.strokeRect(f.x, f.y, f.w, f.h);
  ctx.shadowBlur = 0;

  // Center line
  ctx.setLineDash([10*s,8*s]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.moveTo(f.cx, f.y); ctx.lineTo(f.cx, f.y+f.h); ctx.stroke();
  ctx.setLineDash([]);

  // Center circle
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.arc(f.cx, f.cy, 65*s, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2*s;
  ctx.beginPath(); ctx.arc(f.cx, f.cy, 4*s, 0, Math.PI*2); ctx.stroke();

  // Penalty boxes
  const penW=120*s, penH=f.goalH+60*s, penTop=f.cy-penH/2;
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.5*s;
  ctx.strokeRect(f.x, penTop, penW, penH);
  ctx.strokeRect(f.x+f.w-penW, penTop, penW, penH);

  // ---- GOALS ---- (bigger, visible, with net)
  // Left goal (CPU defends, player shoots here) - BLUE
  ctx.shadowBlur = 20; ctx.shadowColor = '#00d4ff';
  ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 4*s;
  // Back post
  ctx.beginPath();
  ctx.moveTo(f.x - f.goalW, goalTop);
  ctx.lineTo(f.x - f.goalW, goalTop + f.goalH);
  ctx.stroke();
  // Top bar
  ctx.beginPath();
  ctx.moveTo(f.x - f.goalW, goalTop);
  ctx.lineTo(f.x, goalTop);
  ctx.stroke();
  // Bottom bar
  ctx.beginPath();
  ctx.moveTo(f.x - f.goalW, goalTop + f.goalH);
  ctx.lineTo(f.x, goalTop + f.goalH);
  ctx.stroke();
  // Uprights
  ctx.lineWidth = 3*s;
  ctx.beginPath(); ctx.moveTo(f.x, goalTop); ctx.lineTo(f.x, goalTop+f.goalH); ctx.stroke();

  // Net lines for left goal
  ctx.globalAlpha = 0.25; ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 0.8*s;
  const netCols = 6;
  for (let i = 0; i <= netCols; i++) {
    const nx = f.x - f.goalW + i*(f.goalW/netCols);
    ctx.beginPath(); ctx.moveTo(nx, goalTop); ctx.lineTo(nx, goalTop+f.goalH); ctx.stroke();
  }
  const netRows = 5;
  for (let i = 0; i <= netRows; i++) {
    const ny = goalTop + i*(f.goalH/netRows);
    ctx.beginPath(); ctx.moveTo(f.x-f.goalW, ny); ctx.lineTo(f.x, ny); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Fill left goal
  ctx.fillStyle = 'rgba(0,212,255,0.06)';
  ctx.fillRect(f.x - f.goalW, goalTop, f.goalW, f.goalH);

  // Right goal (Player defends, CPU shoots here) - RED
  ctx.shadowBlur = 20; ctx.shadowColor = '#ef4444';
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4*s;
  ctx.beginPath();
  ctx.moveTo(f.x+f.w+f.goalW, goalTop);
  ctx.lineTo(f.x+f.w+f.goalW, goalTop+f.goalH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.x+f.w+f.goalW, goalTop);
  ctx.lineTo(f.x+f.w, goalTop);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.x+f.w+f.goalW, goalTop+f.goalH);
  ctx.lineTo(f.x+f.w, goalTop+f.goalH);
  ctx.stroke();
  ctx.lineWidth = 3*s;
  ctx.beginPath(); ctx.moveTo(f.x+f.w, goalTop); ctx.lineTo(f.x+f.w, goalTop+f.goalH); ctx.stroke();

  // Net lines for right goal
  ctx.globalAlpha = 0.25; ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 0.8*s;
  for (let i = 0; i <= netCols; i++) {
    const nx = f.x+f.w + i*(f.goalW/netCols);
    ctx.beginPath(); ctx.moveTo(nx, goalTop); ctx.lineTo(nx, goalTop+f.goalH); ctx.stroke();
  }
  for (let i = 0; i <= netRows; i++) {
    const ny = goalTop + i*(f.goalH/netRows);
    ctx.beginPath(); ctx.moveTo(f.x+f.w, ny); ctx.lineTo(f.x+f.w+f.goalW, ny); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(239,68,68,0.06)';
  ctx.fillRect(f.x+f.w, goalTop, f.goalW, f.goalH);

  ctx.shadowBlur = 0;

  // Goal labels
  ctx.font = `bold ${11*s}px Exo 2,sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#00d4ff'; ctx.globalAlpha = 0.7;
  ctx.fillText('GOAL', f.x - f.goalW/2, goalTop - 8*s);
  ctx.fillStyle = '#ef4444';
  ctx.fillText('GOAL', f.x + f.w + f.goalW/2, goalTop - 8*s);
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

/* ---- DRAW CHARACTERS ---- */
function drawCharacter(c) {
  const r = PLAYER_R(), s = S();
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.shadowBlur = 20; ctx.shadowColor = c.color;

  // Body glow ring
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = c.color;
  ctx.beginPath(); ctx.arc(0,0,r+4*s,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // Body
  const grd = ctx.createRadialGradient(-r*0.3,-r*0.3,0,0,0,r);
  grd.addColorStop(0, lightenColor(c.color, 60));
  grd.addColorStop(1, c.color);
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

  // Jersey number
  ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
  ctx.font = `bold ${r*0.9}px Exo 2,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(c.number, 0, 0);

  // Direction arrow
  if (Math.abs(c.vx) > 0.5 || Math.abs(c.vy) > 0.5) {
    const ang = Math.atan2(c.vy, c.vx);
    ctx.strokeStyle = c.color; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(ang)*(r+10*s), Math.sin(ang)*(r+10*s));
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ---- DRAW BALL ---- */
function drawBall() {
  const r = BALL_R(), s = S();
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.shadowBlur = 18; ctx.shadowColor = '#fff';

  // Shadow on ground
  ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(3*s, 6*s, r*0.9, r*0.45, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // Ball
  const grd = ctx.createRadialGradient(-r*0.35, -r*0.35, 0, 0, 0, r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.5, '#e0e0e0');
  grd.addColorStop(1, '#999');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

  // Patches
  ctx.fillStyle = '#222'; ctx.globalAlpha = 0.5;
  const pa = [0, 1.26, 2.51, 3.77, 5.03];
  pa.forEach(a => { ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.48, Math.sin(a)*r*0.48, r*0.22, 0, Math.PI*2); ctx.fill(); });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ---- BALL PHYSICS ---- */
function updateBall() {
  const f = F(), s = S();
  const goalTop = f.cy - f.goalH/2;
  const goalBot = f.cy + f.goalH/2;

  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= 0.982;
  ball.vy *= 0.982;
  if (Math.abs(ball.vx) < 0.05*s) ball.vx = 0;
  if (Math.abs(ball.vy) < 0.05*s) ball.vy = 0;

  const br = BALL_R();

  // --- GOAL DETECTION (before boundary checks) ---
  if (G.scoringCooldown <= 0) {
    const inGoalY = ball.y > goalTop && ball.y < goalBot;
    // Ball enters left goal (player 1 scores — player shoots RIGHT toward CPU's left side... wait)
    // Player (blue) is on LEFT, shoots toward the RIGHT goal
    // CPU (red) is on RIGHT, shoots toward the LEFT goal
    // LEFT goal = CPU scores on player... no wait:
    // Player shoots RIGHT → ball goes right → enters RIGHT goal → PLAYER scores
    // CPU shoots LEFT → ball goes left → enters LEFT goal → CPU scores
    if (inGoalY && ball.x - br < f.x - f.goalW * 0.5) {
      // Ball in left goal → CPU scored
      goal(2); return;
    }
    if (inGoalY && ball.x + br > f.x + f.w + f.goalW * 0.5) {
      // Ball in right goal → Player scored
      goal(1); return;
    }
  }
  if (G.scoringCooldown > 0) G.scoringCooldown--;

  // Top/bottom walls
  if (ball.y - br < f.y) { ball.y = f.y + br; ball.vy = Math.abs(ball.vy)*0.7; }
  if (ball.y + br > f.y + f.h) { ball.y = f.y+f.h-br; ball.vy = -Math.abs(ball.vy)*0.7; }

  // Left/right walls — only bounce if NOT in goal height zone
  const inGoalY = ball.y > goalTop && ball.y < goalBot;
  if (ball.x - br < f.x && !inGoalY) { ball.x = f.x+br; ball.vx = Math.abs(ball.vx)*0.7; }
  if (ball.x + br > f.x+f.w && !inGoalY) { ball.x = f.x+f.w-br; ball.vx = -Math.abs(ball.vx)*0.7; }

  // Contain ball within goal back walls
  if (ball.x - br < f.x - f.goalW) { ball.x = f.x-f.goalW+br; ball.vx = Math.abs(ball.vx)*0.5; }
  if (ball.x + br > f.x + f.w + f.goalW) { ball.x = f.x+f.w+f.goalW-br; ball.vx = -Math.abs(ball.vx)*0.5; }

  // Player-ball collision
  [player, cpu].forEach(c => {
    const d = dist(ball.x, ball.y, c.x, c.y);
    const pr = PLAYER_R();
    if (d < br + pr) {
      const ang = Math.atan2(ball.y-c.y, ball.x-c.x);
      const overlap = br+pr-d;
      ball.x += Math.cos(ang)*overlap;
      ball.y += Math.sin(ang)*overlap;
      const spd = Math.sqrt(c.vx*c.vx+c.vy*c.vy);
      if (spd > 0.3*s) {
        ball.vx = c.vx*0.6 + Math.cos(ang)*3*s;
        ball.vy = c.vy*0.6 + Math.sin(ang)*3*s;
      } else {
        ball.vx += Math.cos(ang)*2.5*s;
        ball.vy += Math.sin(ang)*2.5*s;
      }
      // Cap ball speed
      const bs = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
      const maxBs = 12*s;
      if (bs > maxBs) { ball.vx = ball.vx/bs*maxBs; ball.vy = ball.vy/bs*maxBs; }
    }
  });
}

/* ---- CPU AI ---- */
function updateCPU() {
  const f = F(), s = S();
  const pr = PLAYER_R(), br = BALL_R();
  const spd = CPU_SPEED();

  const ballDist = dist(cpu.x, cpu.y, ball.x, ball.y);
  let tx, ty;

  if (ballDist < 220*s) {
    // Go to ball
    tx = ball.x; ty = ball.y;
  } else {
    // Position near own half
    tx = f.cx + 60*s; ty = f.cy + (ball.y - f.cy) * 0.5;
  }

  const dx = tx - cpu.x, dy = ty - cpu.y;
  const d = Math.sqrt(dx*dx+dy*dy);
  if (d > 1) {
    cpu.vx = (dx/d)*spd; cpu.vy = (dy/d)*spd;
  }
  cpu.x += cpu.vx; cpu.y += cpu.vy;

  // Keep CPU in field
  cpu.x = Math.max(f.x+pr, Math.min(f.x+f.w-pr, cpu.x));
  cpu.y = Math.max(f.y+pr, Math.min(f.y+f.h-pr, cpu.y));

  // CPU kick when near ball
  if (dist(cpu.x, cpu.y, ball.x, ball.y) < pr+br+6*s) {
    // Aim toward player's goal (LEFT side)
    const goalX = f.x - f.goalW;
    const goalCenterY = f.cy + (Math.random()-0.5)*60*s;
    const ang = Math.atan2(goalCenterY - ball.y, goalX - ball.x) + (Math.random()-0.5)*0.5;
    const power = (7 + Math.random()*4)*s;
    ball.vx = Math.cos(ang)*power;
    ball.vy = Math.sin(ang)*power;
    ball.lastTouchedBy = 2;
  }
}

/* ---- PLAYER INPUT ---- */
function updatePlayer() {
  const f = F(), s = S();
  const pr = PLAYER_R(), br = BALL_R();
  const spd = PLAYER_SPD();

  if (G.kickCooldown > 0) G.kickCooldown--;
  let mvx = 0, mvy = 0;
  if (keys['ArrowLeft']||keys['a']||keys['A']) mvx -= spd;
  if (keys['ArrowRight']||keys['d']||keys['D']) mvx += spd;
  if (keys['ArrowUp']||keys['w']||keys['W']) mvy -= spd;
  if (keys['ArrowDown']||keys['s']||keys['S']) mvy += spd;
  if (mvx&&mvy) { mvx*=0.707; mvy*=0.707; }
  player.vx=mvx; player.vy=mvy;
  player.x+=mvx; player.y+=mvy;
  player.x=Math.max(f.x+pr, Math.min(f.x+f.w-pr, player.x));
  player.y=Math.max(f.y+pr, Math.min(f.y+f.h-pr, player.y));

  // Kick
  if ((keys[' ']||keys['Space']) && G.kickCooldown===0) {
    if (dist(player.x, player.y, ball.x, ball.y) < pr+br+22*s) {
      // Aim toward CPU's goal (RIGHT side)
      const goalX = f.x+f.w+f.goalW;
      const goalCenterY = f.cy + (Math.random()-0.5)*40*s;
      const ang = Math.atan2(goalCenterY-ball.y, goalX-ball.x) + (Math.random()-0.5)*0.3;
      const power = (9+Math.random()*5)*s;
      ball.vx = Math.cos(ang)*power;
      ball.vy = Math.sin(ang)*power;
      ball.lastTouchedBy = 1;
      G.kickCooldown = 15;
      spawnKickEffect(ball.x, ball.y);
    }
  }
}

function spawnKickEffect(x, y) {
  for (let i=0;i<8;i++) {
    const a=(i/8)*Math.PI*2, spd=3+Math.random()*4;
    particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:25,maxLife:25,color:'#fff',r:2+Math.random()*2});
  }
}

/* ---- GOAL EVENT ---- */
function goal(team) {
  spawnGoalExplosion(team);
  if (team===1) G.score1++;
  else G.score2++;
  document.getElementById('score1').textContent = G.score1;
  document.getElementById('score2').textContent = G.score2;
  const text = team===1 ? 'GOAL! 🎉' : 'OH NO! 😱';
  const color = team===1 ? '#00d4ff' : '#ef4444';
  showAnnounce(text, color);
  G.scoringCooldown = 180;
  setTimeout(() => reset(), 2200);
}

function spawnGoalExplosion(team) {
  const f = F();
  const cx = team===1 ? f.x+f.w+f.goalW/2 : f.x-f.goalW/2;
  const cy = f.cy;
  for (let i=0;i<50;i++) {
    const a=Math.random()*Math.PI*2, spd=2+Math.random()*10;
    const color = team===1 ? ['#00d4ff','#7c3aed','#fff'][Math.floor(Math.random()*3)] : ['#ef4444','#ff8c00','#fff'][Math.floor(Math.random()*3)];
    particles.push({x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:60,maxLife:60,color,r:2+Math.random()*5});
  }
}

function showAnnounce(text, color) {
  const el = document.getElementById('goalAnnounce');
  el.textContent = text; el.style.color = color;
  el.style.display = 'block';
  el.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}`;
  setTimeout(() => { el.style.display='none'; }, 2000);
}

/* ---- TIMER ---- */
function updateTimer() {
  G.tickTimer++;
  if (G.tickTimer>=60) { G.tickTimer=0; G.timeLeft=Math.max(0,G.timeLeft-1); }
  const m=Math.floor(G.timeLeft/60), sec=G.timeLeft%60;
  const el = document.getElementById('timerDisplay');
  el.textContent = `${m}:${sec.toString().padStart(2,'0')}`;
  el.style.color = G.timeLeft < 30 ? '#ef4444' : '#10b981';
  if (G.timeLeft===0) endMatch();
}

function endMatch() {
  G.running=false; G.ended=true;
  document.getElementById('endOverlay').classList.remove('hidden');
  const won=G.score1>G.score2, tied=G.score1===G.score2;
  document.getElementById('endTitle').textContent = tied?'DRAW!':(won?'YOU WIN! 🏆':'CPU WINS 😤');
  document.getElementById('endTitle').style.color = tied?'#f59e0b':(won?'#10b981':'#ef4444');
  document.getElementById('endEmoji').textContent = tied?'🤝':(won?'🏆':'😤');
  document.getElementById('endScore').textContent = `${G.score1} - ${G.score2}`;
}

/* ---- HELPERS ---- */
function dist(ax,ay,bx,by) { return Math.sqrt((ax-bx)**2+(ay-by)**2); }
function lightenColor(hex, amt) {
  const r=Math.min(255,parseInt(hex.slice(1,3),16)+amt);
  const g=Math.min(255,parseInt(hex.slice(3,5),16)+amt);
  const b=Math.min(255,parseInt(hex.slice(5,7),16)+amt);
  return `rgb(${r},${g},${b})`;
}

/* ---- GAME LOOP ---- */
function gameLoop() {
  if (!G.running||G.paused) return;
  requestAnimationFrame(gameLoop);

  updatePlayer();
  updateCPU();
  updateBall();
  updateTimer();

  drawPitch();

  // Particles
  particles = particles.filter(p=>p.life-->0);
  particles.forEach(p=>{
    ctx.globalAlpha=p.life/p.maxLife;
    ctx.fillStyle=p.color; ctx.shadowBlur=8; ctx.shadowColor=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.vx*=0.96; p.r*=0.97;
  });
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  drawCharacter(player);
  drawCharacter(cpu);
  drawBall();

  // Controls hint during play
  if (G.scoringCooldown > 0 && G.scoringCooldown < 170) {
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.font=`bold ${11*S()}px Exo 2,sans-serif`;
    ctx.textAlign='center';
    ctx.fillText('Press SPACE near ball to KICK', canvas.width/2, canvas.height-15*S());
    ctx.textAlign='left';
  }
}

function startGame() {
  G.score1=0; G.score2=0; G.timeLeft=120; G.running=true; G.paused=false; G.ended=false; G.tickTimer=0;
  document.getElementById('score1').textContent='0';
  document.getElementById('score2').textContent='0';
  particles=[];
  reset();
  ['startOverlay','pauseOverlay','endOverlay'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown',e=>{
  keys[e.key]=true;
  if(e.key==='p'||e.key==='P') togglePause();
  if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup',e=>{ keys[e.key]=false; });

document.getElementById('startBtn')?.addEventListener('click', startGame);
document.getElementById('retryBtn')?.addEventListener('click', startGame);
document.getElementById('resumeBtn')?.addEventListener('click', togglePause);
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('restartBtn')?.addEventListener('click', startGame);

function togglePause() {
  if (!G.running||G.ended) return;
  G.paused=!G.paused;
  document.getElementById('pauseOverlay')?.classList.toggle('hidden',!G.paused);
  document.getElementById('pauseBtn').textContent=G.paused?'▶ Resume':'⏸ Pause';
  if (!G.paused) requestAnimationFrame(gameLoop);
}
