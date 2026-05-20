/* ============================================================
   NEON RACER — GAME LOGIC
   ============================================================ */

(function() {
  const bar = document.getElementById('load-bar'), screen = document.getElementById('loading-screen');
  let p = 0; const t = setInterval(() => { p += Math.random()*20+10; bar.style.width=Math.min(p,95)+'%'; if(p>=95){clearInterval(t);setTimeout(()=>{bar.style.width='100%';setTimeout(()=>screen.classList.add('hide'),400)},300);}},120);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() { const a=canvas.parentElement; canvas.width=a.clientWidth; canvas.height=a.clientHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);

// Constants
const LANE_COUNT = 5;
const CAR_W = 36, CAR_H = 60;
const ROAD_COLORS = { asphalt: '#1a1a2e', lane: '#2a2a4e', line: '#3a3a6e' };

const G = {
  score: 0, lives: 3, distance: 0, speed: 0, baseSpeed: 3,
  boost: 3, boostActive: false, boostTimer: 0, boostCooldown: 0,
  running: false, paused: false, gameOver: false,
  roadOffset: 0, spawnTimer: 0, difficultyTimer: 0,
  invincibleTimer: 0,
};

const keys = {};
const player = { x: 0, y: 0, w: CAR_W, h: CAR_H, color: '#00d4ff', lane: 2, targetX: 0, vx: 0, trail: [] };
let trafficCars = [], particles = [], roadMarkings = [], boostPickups = [], neonSigns = [];

// Car colors for traffic
const TRAFFIC_COLORS = ['#ff4444','#ff8c00','#ffd700','#9b59b6','#e74c3c','#ff6b6b','#a855f7'];
const TRAFFIC_EMOJIS = ['🚗','🚙','🚕','🚓','🏎️','🚑','🚐'];

function getLaneX(lane) {
  const roadW = Math.min(canvas.width * 0.75, 500);
  const roadLeft = (canvas.width - roadW) / 2;
  return roadLeft + (lane + 0.5) * (roadW / LANE_COUNT);
}

function initPlayer() {
  player.lane = Math.floor(LANE_COUNT / 2);
  player.x = getLaneX(player.lane);
  player.y = canvas.height - 100;
  player.targetX = player.x;
  player.trail = [];
}

function initRoadMarkings() {
  roadMarkings = [];
  const roadW = Math.min(canvas.width * 0.75, 500);
  const roadLeft = (canvas.width - roadW) / 2;
  for (let lane = 1; lane < LANE_COUNT; lane++) {
    const x = roadLeft + lane * (roadW / LANE_COUNT);
    for (let y = 0; y < canvas.height; y += 80) {
      roadMarkings.push({ x, y, lane });
    }
  }
}

/* ----- DRAW ROAD ----- */
function drawRoad() {
  const roadW = Math.min(canvas.width * 0.75, 500);
  const roadLeft = (canvas.width - roadW) / 2;

  // Background
  const bg = ctx.createLinearGradient(0, 0, canvas.width, 0);
  bg.addColorStop(0, '#0a0010');
  bg.addColorStop(0.5, '#000020');
  bg.addColorStop(1, '#0a0010');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Road surface
  const roadGrd = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadW, 0);
  roadGrd.addColorStop(0, '#111128');
  roadGrd.addColorStop(0.15, '#1a1a3e');
  roadGrd.addColorStop(0.85, '#1a1a3e');
  roadGrd.addColorStop(1, '#111128');
  ctx.fillStyle = roadGrd;
  ctx.fillRect(roadLeft, 0, roadW, canvas.height);

  // Neon edge lines
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ff3232';
  ctx.strokeStyle = '#ff3232';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(roadLeft, 0); ctx.lineTo(roadLeft, canvas.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(roadLeft + roadW, 0); ctx.lineTo(roadLeft + roadW, canvas.height); ctx.stroke();
  ctx.shadowBlur = 0;

  // Lane markings
  roadMarkings.forEach(m => {
    const y = (m.y + G.roadOffset) % canvas.height;
    ctx.strokeStyle = 'rgba(80,80,120,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([30, 50]);
    ctx.beginPath(); ctx.moveTo(m.x, y); ctx.lineTo(m.x, y + 30); ctx.stroke();
    ctx.setLineDash([]);
  });

  // Perspective lines (far)
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ff3232';
  ctx.lineWidth = 1;
  for (let lane = 0; lane <= LANE_COUNT; lane++) {
    const x = roadLeft + lane * (roadW / LANE_COUNT);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ----- DRAW PLAYER CAR ----- */
function drawPlayerCar() {
  // Trail
  player.trail.forEach((t, i) => {
    ctx.globalAlpha = (i / player.trail.length) * 0.3;
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(t.x - 4, t.y, 8, 12);
  });
  ctx.globalAlpha = 1;

  const x = player.x, y = player.y;
  ctx.save();
  ctx.translate(x, y);

  // Invincible flash
  if (G.invincibleTimer > 0 && Math.floor(G.invincibleTimer / 5) % 2 === 0) { ctx.restore(); return; }

  // Engine glow
  ctx.globalAlpha = 0.5 + Math.random() * 0.3;
  const eng = ctx.createRadialGradient(0, CAR_H/2 - 4, 0, 0, CAR_H/2 - 4, 20);
  eng.addColorStop(0, '#ff6600');
  eng.addColorStop(1, 'transparent');
  ctx.fillStyle = eng;
  ctx.fillRect(-20, CAR_H/2 - 14, 40, 20);
  ctx.globalAlpha = 1;

  // Car body
  ctx.shadowBlur = 20; ctx.shadowColor = '#00d4ff';
  const grd = ctx.createLinearGradient(-CAR_W/2, 0, CAR_W/2, 0);
  grd.addColorStop(0, '#0088aa');
  grd.addColorStop(0.5, '#00d4ff');
  grd.addColorStop(1, '#0088aa');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(-CAR_W/2, -CAR_H/2, CAR_W, CAR_H, [6, 6, 4, 4]);
  ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(0,255,255,0.3)';
  ctx.fillRect(-10, -CAR_H/2 + 10, 20, 14);

  // Headlights
  ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
  ctx.fillStyle = '#fff';
  ctx.fillRect(-CAR_W/2 + 3, -CAR_H/2 + 3, 8, 5);
  ctx.fillRect(CAR_W/2 - 11, -CAR_H/2 + 3, 8, 5);

  // Boost effect
  if (G.boostActive) {
    ctx.globalAlpha = 0.7;
    ctx.shadowBlur = 30; ctx.shadowColor = '#ff8c00';
    ctx.fillStyle = '#ff8c00';
    ctx.beginPath();
    ctx.moveTo(-8, CAR_H/2 - 5);
    ctx.lineTo(0, CAR_H/2 + 20 + Math.random() * 15);
    ctx.lineTo(8, CAR_H/2 - 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ----- TRAFFIC CARS ----- */
function spawnTrafficCar() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const colorIdx = Math.floor(Math.random() * TRAFFIC_COLORS.length);
  const speed = (G.speed * 0.3 + Math.random() * G.speed * 0.4) * (Math.random() < 0.3 ? -0.5 : 1);
  trafficCars.push({
    x: getLaneX(lane), y: -80,
    w: CAR_W - 4 + Math.random() * 8,
    h: CAR_H - 8 + Math.random() * 20,
    color: TRAFFIC_COLORS[colorIdx],
    emoji: TRAFFIC_EMOJIS[colorIdx],
    speed: Math.max(1, G.speed * 0.3 + Math.random() * 2),
    lane,
  });
}

function drawTrafficCar(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.shadowBlur = 10; ctx.shadowColor = c.color;
  const grd = ctx.createLinearGradient(-c.w/2, 0, c.w/2, 0);
  grd.addColorStop(0, shadeColor(c.color, -30));
  grd.addColorStop(0.5, c.color);
  grd.addColorStop(1, shadeColor(c.color, -30));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(-c.w/2, -c.h/2, c.w, c.h, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = `${c.h * 0.6}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(c.emoji, 0, 0);
  // Taillights
  ctx.fillStyle = '#ff4444';
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff4444';
  ctx.fillRect(-c.w/2 + 2, c.h/2 - 8, 8, 5);
  ctx.fillRect(c.w/2 - 10, c.h/2 - 8, 8, 5);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function shadeColor(hex, pct) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,r+pct)},${Math.max(0,g+pct)},${Math.max(0,b+pct)})`;
}

/* ----- BOOST PICKUPS ----- */
function spawnBoostPickup() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  boostPickups.push({ x: getLaneX(lane), y: -30, bob: Math.random() * Math.PI * 2 });
}

function drawBoostPickup(p) {
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(p.bob) * 5);
  ctx.shadowBlur = 20; ctx.shadowColor = '#ff8c00';
  ctx.fillStyle = 'rgba(255,140,0,0.2)';
  ctx.strokeStyle = '#ff8c00';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⚡', 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ----- PARTICLES ----- */
function spawnCrash(x, y) {
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2, spd = 3 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life: 40, maxLife: 40, color: ['#ff4444','#ff8c00','#ffd700'][Math.floor(Math.random()*3)], r: 3+Math.random()*4 });
  }
}

/* ----- BOOST DISPLAY ----- */
function updateBoostDisplay() {
  const el = document.getElementById('boostDisplay');
  if (!el) return;
  let dots = '';
  for (let i = 0; i < 3; i++) dots += i < G.boost ? (G.boostActive ? '🔥' : '●') : '○';
  el.textContent = dots;
  el.style.color = G.boostActive ? '#ff8c00' : G.boost > 0 ? '#39ff14' : '#666';
}

/* ----- HUD ----- */
function updateHUD() {
  document.getElementById('scoreDisplay').textContent = Math.floor(G.score);
  document.getElementById('speedDisplay').textContent = Math.floor(G.speed * 20);
  document.getElementById('distDisplay').textContent = Math.floor(G.distance);
  const hearts = document.querySelectorAll('#livesDisplay .life-icon');
  hearts.forEach((h, i) => h.classList.toggle('empty', i >= G.lives));
  updateBoostDisplay();
}

/* ----- COLLISION ----- */
function rectCollide(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax - aw/2 < bx + bw/2 && ax + aw/2 > bx - bw/2 && ay - ah/2 < by + bh/2 && ay + ah/2 > by - bh/2;
}

/* ----- GAME LOOP ----- */
function gameLoop() {
  if (!G.running || G.paused) return;
  requestAnimationFrame(gameLoop);

  G.speed = G.baseSpeed + G.distance / 500;
  if (G.boostActive) G.speed *= 2;
  const effectiveSpeed = G.speed;

  G.roadOffset = (G.roadOffset + effectiveSpeed) % canvas.height;
  G.distance += effectiveSpeed * 0.1;
  G.score += effectiveSpeed * 0.5;
  G.difficultyTimer++;

  drawRoad();

  // Spawn traffic
  G.spawnTimer++;
  const spawnInterval = Math.max(30, 80 - G.distance / 80);
  if (G.spawnTimer >= spawnInterval) { G.spawnTimer = 0; spawnTrafficCar(); if (Math.random() < 0.15) spawnBoostPickup(); }

  // Player movement
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
    if (player.targetX > getLaneX(0) + 10) player.targetX -= 7;
  }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) {
    if (player.targetX < getLaneX(LANE_COUNT-1) - 10) player.targetX += 7;
  }
  player.x += (player.targetX - player.x) * 0.18;
  player.x = Math.max(getLaneX(0) - 30, Math.min(getLaneX(LANE_COUNT-1) + 30, player.x));

  // Trail
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 8) player.trail.shift();

  // Boost
  if (G.boostTimer > 0) { G.boostTimer--; if (!G.boostTimer) { G.boostActive = false; G.boostCooldown = 120; } }
  if (G.boostCooldown > 0) G.boostCooldown--;
  if (G.invincibleTimer > 0) G.invincibleTimer--;

  // Boost pickups
  boostPickups = boostPickups.filter(p => p.y < canvas.height + 50);
  boostPickups.forEach(p => { p.y += effectiveSpeed; p.bob += 0.05; });
  boostPickups.forEach(p => drawBoostPickup(p));

  // Traffic
  trafficCars = trafficCars.filter(c => c.y < canvas.height + 100);
  trafficCars.forEach(c => { c.y += effectiveSpeed - c.speed * 0.5; });
  trafficCars.forEach(c => drawTrafficCar(c));

  // Collision with traffic
  if (G.invincibleTimer === 0) {
    for (let i = trafficCars.length - 1; i >= 0; i--) {
      const c = trafficCars[i];
      if (rectCollide(player.x, player.y, player.w - 8, player.h - 10, c.x, c.y, c.w - 6, c.h - 10)) {
        spawnCrash(player.x, player.y);
        trafficCars.splice(i, 1);
        G.lives--;
        G.invincibleTimer = 120;
        G.boostActive = false; G.boostTimer = 0;
        screenShake();
        updateHUD();
        if (G.lives <= 0) { endGame(); return; }
        break;
      }
    }
  }

  // Boost pickup collision
  for (let i = boostPickups.length - 1; i >= 0; i--) {
    const p = boostPickups[i];
    if (Math.abs(p.x - player.x) < 30 && Math.abs(p.y - player.y) < 40) {
      G.boost = Math.min(3, G.boost + 1);
      boostPickups.splice(i, 1);
      spawnCrash(p.x, p.y);
    }
  }

  // Particles
  particles = particles.filter(p => p.life-- > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.r *= 0.96;
  });
  ctx.globalAlpha = 1;

  drawPlayerCar();
  updateHUD();

  // Speed lines (boost effect)
  if (G.boostActive) {
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * canvas.width;
      const len = 40 + Math.random() * 80;
      const y = Math.random() * canvas.height;
      ctx.strokeStyle = '#ff8c00';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function screenShake() {
  const area = canvas.parentElement;
  let t = 0;
  const s = setInterval(() => {
    area.style.transform = `translate(${(Math.random()-0.5)*10}px,${(Math.random()-0.5)*10}px)`;
    if (++t > 6) { clearInterval(s); area.style.transform = ''; }
  }, 50);
}

function endGame() {
  G.running = false; G.gameOver = true;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('finalScore').textContent = `Score: ${Math.floor(G.score).toLocaleString()}`;
  document.getElementById('finalDist').textContent = `Distance: ${Math.floor(G.distance)} m · Top Speed: ${Math.floor((G.baseSpeed + G.distance/500) * 20)} km/h`;
}

function startGame() {
  G.score=0; G.lives=3; G.distance=0; G.speed=0; G.baseSpeed=3;
  G.boost=3; G.boostActive=false; G.boostTimer=0; G.boostCooldown=0;
  G.running=true; G.paused=false; G.gameOver=false;
  G.roadOffset=0; G.spawnTimer=0; G.difficultyTimer=0; G.invincibleTimer=0;
  trafficCars=[]; particles=[]; boostPickups=[];
  initPlayer(); initRoadMarkings();
  ['startOverlay','pauseOverlay','gameOverOverlay'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  updateHUD();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === ' ' && !G.boostActive && G.boost > 0 && G.boostCooldown === 0 && G.running && !G.paused) {
    G.boostActive = true; G.boostTimer = 120; G.boost--; e.preventDefault();
  }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

document.getElementById('startBtn')?.addEventListener('click', startGame);
document.getElementById('retryBtn')?.addEventListener('click', startGame);
document.getElementById('resumeBtn')?.addEventListener('click', togglePause);
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('restartBtn')?.addEventListener('click', startGame);

function togglePause() {
  if (!G.running || G.gameOver) return;
  G.paused = !G.paused;
  document.getElementById('pauseOverlay')?.classList.toggle('hidden', !G.paused);
  document.getElementById('pauseBtn').textContent = G.paused ? '▶ Resume' : '⏸ Pause';
  if (!G.paused) requestAnimationFrame(gameLoop);
}
