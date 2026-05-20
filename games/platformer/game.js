/* ============================================================
   PIXEL JUMPER — GAME LOGIC
   ============================================================ */

(function() {
  const bar=document.getElementById('load-bar'),screen=document.getElementById('loading-screen');
  let p=0;const t=setInterval(()=>{p+=Math.random()*20+10;bar.style.width=Math.min(p,95)+'%';if(p>=95){clearInterval(t);setTimeout(()=>{bar.style.width='100%';setTimeout(()=>screen.classList.add('hide'),400)},300);}},120);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() { const a=canvas.parentElement; canvas.width=a.clientWidth; canvas.height=a.clientHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);

const GRAVITY = 0.55, JUMP_FORCE = -13, DOUBLE_JUMP_FORCE = -11;
const PLAYER_W = 28, PLAYER_H = 36;
const TILE = 40;
const keys = {};

let G = { score: 0, coins: 0, lives: 3, level: 1, running: false, paused: false };
let player, camera, platforms, enemies, coins, door, particles = [];

/* ----- LEVEL DATA ----- */
const LEVELS = [
  {
    width: 3000, height: 600,
    bg: ['#0a001a', '#1a0033'],
    accentColor: '#a855f7',
    playerStart: [100, 400],
    platforms: [
      {x:0, y:560, w:600, h:40, color:'#1a0040'},
      {x:700, y:480, w:200, h:20, color:'#2d0066'},
      {x:960, y:400, w:180, h:20, color:'#2d0066'},
      {x:1200, y:350, w:220, h:20, color:'#1a0040'},
      {x:1480, y:280, w:160, h:20, color:'#2d0066'},
      {x:1700, y:380, w:240, h:20, color:'#2d0066'},
      {x:2000, y:430, w:200, h:20, color:'#1a0040'},
      {x:2260, y:350, w:180, h:20, color:'#2d0066'},
      {x:2500, y:420, w:460, h:180, color:'#1a0040'},
    ],
    enemies: [{x:800, y:440, range:150}, {x:1300, y:310, range:180}, {x:1850, y:340, range:200}, {x:2100, y:390, range:160}],
    coins: [{x:750,y:430},{x:1000,y:360},{x:1250,y:310},{x:1520,y:240},{x:1750,y:340},{x:2050,y:390},{x:2300,y:310}],
    door: {x:2920, y:380},
  },
  {
    width: 3400, height: 600,
    bg: ['#001020', '#002040'],
    accentColor: '#00d4ff',
    playerStart: [100, 400],
    platforms: [
      {x:0, y:560, w:500, h:40, color:'#001840'},
      {x:550, y:460, w:160, h:20, color:'#002860'},
      {x:760, y:380, w:160, h:20, color:'#002860'},
      {x:970, y:300, w:180, h:20, color:'#001840'},
      {x:1200, y:400, w:140, h:20, color:'#002860'},
      {x:1400, y:310, w:180, h:20, color:'#002860'},
      {x:1640, y:420, w:200, h:20, color:'#001840'},
      {x:1900, y:340, w:160, h:20, color:'#002860'},
      {x:2120, y:260, w:200, h:20, color:'#002860'},
      {x:2370, y:360, w:180, h:20, color:'#001840'},
      {x:2600, y:280, w:200, h:20, color:'#002860'},
      {x:2870, y:400, w:500, h:200, color:'#001840'},
    ],
    enemies: [{x:600,y:420,range:140},{x:1050,y:260,range:170},{x:1500,y:270,range:200},{x:2000,y:300,range:180},{x:2450,y:320,range:200}],
    coins: [{x:580,y:410},{x:800,y:340},{x:1030,y:260},{x:1250,y:360},{x:1450,y:270},{x:1700,y:380},{x:1950,y:300},{x:2170,y:220},{x:2400,y:320},{x:2640,y:240}],
    door: {x:3320, y:350},
  },
  {
    width: 3800, height: 600,
    bg: ['#100010', '#200020'],
    accentColor: '#ec4899',
    playerStart: [100, 400],
    platforms: [
      {x:0, y:560, w:400, h:40, color:'#200020'},
      {x:450, y:460, w:140, h:20, color:'#400040', moving:true, mRange:80, mSpeed:1.2},
      {x:650, y:380, w:140, h:20, color:'#400040'},
      {x:850, y:290, w:140, h:20, color:'#200020', moving:true, mRange:100, mSpeed:1.5},
      {x:1060, y:380, w:160, h:20, color:'#400040'},
      {x:1280, y:300, w:140, h:20, color:'#400040', moving:true, mRange:80, mSpeed:1.8},
      {x:1500, y:220, w:160, h:20, color:'#200020'},
      {x:1730, y:320, w:140, h:20, color:'#400040', moving:true, mRange:110, mSpeed:2},
      {x:1960, y:420, w:180, h:20, color:'#200020'},
      {x:2200, y:330, w:160, h:20, color:'#400040'},
      {x:2430, y:250, w:160, h:20, color:'#200020', moving:true, mRange:90, mSpeed:1.5},
      {x:2660, y:360, w:160, h:20, color:'#400040'},
      {x:2890, y:270, w:180, h:20, color:'#200020'},
      {x:3150, y:390, w:600, h:210, color:'#200020'},
    ],
    enemies: [{x:700,y:340,range:130},{x:1100,y:340,range:160},{x:1540,y:180,range:150},{x:2000,y:380,range:180},{x:2250,y:290,range:170},{x:2700,y:320,range:200}],
    coins: [{x:480,y:420},{x:690,y:340},{x:890,y:250},{x:1100,y:340},{x:1320,y:260},{x:1550,y:180},{x:1770,y:280},{x:2000,y:380},{x:2240,y:290},{x:2470,y:210},{x:2700,y:320},{x:2930,y:230}],
    door: {x:3680, y:340},
  }
];

/* ----- INIT ----- */
function initLevel(level) {
  const data = LEVELS[level - 1];
  camera = { x: 0, y: 0 };

  const [px, py] = data.playerStart;
  player = {
    x: px, y: py, vx: 0, vy: 0,
    w: PLAYER_W, h: PLAYER_H,
    onGround: false, jumpsLeft: 2,
    facing: 1, animFrame: 0, animTimer: 0,
    invincible: 0, color: '#a855f7',
  };

  platforms = data.platforms.map(p => ({ ...p, origX: p.x, mDir: 1 }));
  enemies = data.enemies.map(e => ({ x: e.x, y: e.y - 36, w: 28, h: 36, vx: 1.5, range: e.range, origX: e.x, color: '#ef4444', hp: 1, dead: false }));
  coins = data.coins.map(c => ({ x: c.x, y: c.y, r: 10, collected: false, bob: Math.random() * Math.PI * 2 }));
  door = { x: data.door.x, y: data.door.y - 60, w: 36, h: 60, open: false };
}

/* ----- PHYSICS ----- */
function updatePlayer() {
  if (player.invincible > 0) player.invincible--;

  const spd = 5;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) { player.vx = -spd; player.facing = -1; }
  else if (keys['ArrowRight'] || keys['d'] || keys['D']) { player.vx = spd; player.facing = 1; }
  else { player.vx *= 0.7; }

  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  player.onGround = false;
  platforms.forEach(p => {
    if (collide(player, p)) {
      // Top collision
      if (player.vy > 0 && player.y + player.h - player.vy <= p.y + 4) {
        player.y = p.y - player.h;
        player.vy = 0; player.onGround = true; player.jumpsLeft = 2;
      } else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 4) {
        player.y = p.y + p.h;
        player.vy = 0;
      } else if (player.vx > 0) { player.x = p.x - player.w; player.vx = 0; }
      else if (player.vx < 0) { player.x = p.x + p.w; player.vx = 0; }
    }
  });

  // Fell off
  const data = LEVELS[G.level - 1];
  if (player.y > data.height + 100) {
    loseLife();
  }

  // Left/right bounds
  player.x = Math.max(0, player.x);
  if (player.x > data.width - player.w) player.x = data.width - player.w;
}

function updateMovingPlatforms() {
  platforms.forEach(p => {
    if (!p.moving) return;
    p.x += p.mSpeed * p.mDir;
    if (p.x > p.origX + p.mRange || p.x < p.origX - p.mRange) p.mDir *= -1;
    // Move player with platform
    if (player.onGround && collide(player, p)) player.x += p.mSpeed * p.mDir;
  });
}

function collide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateEnemies() {
  enemies.forEach(e => {
    if (e.dead) return;
    e.x += e.vx;
    if (e.x < e.origX - e.range || e.x > e.origX + e.range) e.vx *= -1;
    // Enemy-platform collision
    e.onGround = false;
    platforms.forEach(p => {
      if (collide(e, p)) {
        if (e.vy > 0 && e.y + e.h - 4 <= p.y + 8) { e.y = p.y - e.h; e.vy = 0; e.onGround = true; }
      }
    });
    e.vy = (e.vy || 0) + GRAVITY;
    e.y += e.vy || 0;

    // Stomp enemy
    if (player.invincible === 0 && collide(player, e)) {
      if (player.vy > 0 && player.y + player.h - player.vy <= e.y + 8) {
        e.dead = true;
        G.score += 100;
        player.vy = -8;
        spawnParticles(e.x + e.w/2, e.y, '#ef4444', 10);
      } else {
        loseLife();
      }
    }
  });
}

function updateCoins() {
  coins.forEach(c => {
    if (c.collected) return;
    c.bob += 0.06;
    const cy = c.y + Math.sin(c.bob) * 4;
    const dx = player.x + player.w/2 - c.x, dy = player.y + player.h/2 - cy;
    if (Math.sqrt(dx*dx+dy*dy) < c.r + 14) {
      c.collected = true;
      G.coins++; G.score += 50;
      spawnParticles(c.x, cy, '#ffd700', 8);
    }
  });
}

function updateDoor() {
  if (!door.open) return;
  if (collide(player, {x:door.x, y:door.y, w:door.w, h:door.h})) {
    levelComplete();
  }
}

function loseLife() {
  if (player.invincible > 0) return;
  G.lives--;
  updateHUD();
  spawnParticles(player.x + player.w/2, player.y + player.h/2, '#ef4444', 20);
  if (G.lives <= 0) { endGame(); return; }
  // Respawn
  const [px, py] = LEVELS[G.level - 1].playerStart;
  player.x = px; player.y = py; player.vx = 0; player.vy = 0; player.invincible = 120;
}

function levelComplete() {
  G.score += 500;
  if (G.level >= LEVELS.length) { winGame(); return; }
  G.level++;
  document.getElementById('levelDisplay').textContent = G.level;
  // Show level banner
  const banner = document.createElement('div');
  banner.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:36px;font-weight:900;color:#a855f7;text-shadow:0 0 20px #a855f7;z-index:50;pointer-events:none;letter-spacing:3px`;
  banner.textContent = `LEVEL ${G.level}!`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2000);
  initLevel(G.level);
}

/* ----- CAMERA ----- */
function updateCamera() {
  const data = LEVELS[G.level - 1];
  camera.x = player.x - canvas.width * 0.35;
  camera.x = Math.max(0, Math.min(data.width - canvas.width, camera.x));
  camera.y = player.y - canvas.height * 0.5;
  camera.y = Math.max(0, Math.min(data.height - canvas.height, camera.y));
}

/* ----- DRAWING ----- */
function drawBackground() {
  const data = LEVELS[G.level - 1];
  const [c1, c2] = data.bg;
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, c1);
  grd.addColorStop(1, c2);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Neon grid
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = data.accentColor;
  ctx.lineWidth = 1;
  const gridSize = 80;
  for (let x = (-camera.x % gridSize); x < canvas.width + gridSize; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = (-camera.y % gridSize); y < canvas.height + gridSize; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlatforms() {
  const data = LEVELS[G.level - 1];
  platforms.forEach(p => {
    const sx = p.x - camera.x, sy = p.y - camera.y;
    if (sx + p.w < -10 || sx > canvas.width + 10) return;
    ctx.shadowBlur = 8; ctx.shadowColor = data.accentColor;
    const grd = ctx.createLinearGradient(sx, sy, sx, sy + p.h);
    grd.addColorStop(0, lighten(p.color));
    grd.addColorStop(1, p.color);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.roundRect(sx, sy, p.w, p.h, 4); ctx.fill();
    ctx.strokeStyle = data.accentColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.roundRect(sx, sy, p.w, p.h, 4); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });
}

function drawEnemies() {
  enemies.forEach(e => {
    if (e.dead) return;
    const sx = e.x - camera.x, sy = e.y - camera.y;
    ctx.save(); ctx.translate(sx + e.w/2, sy + e.h/2);
    if (e.vx < 0) ctx.scale(-1, 1);
    ctx.shadowBlur = 12; ctx.shadowColor = '#ef4444';
    // Body
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.arc(0, 4, 12, 0, Math.PI*2); ctx.fill();
    // Face
    ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('👿', 0, 4);
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawCoins() {
  coins.forEach(c => {
    if (c.collected) return;
    const sx = c.x - camera.x, sy = c.y + Math.sin(c.bob) * 4 - camera.y;
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffd700';
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(sx, sy, c.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffec00';
    ctx.font = `${c.r * 1.4}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💰', sx, sy);
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawDoor() {
  const sx = door.x - camera.x, sy = door.y - camera.y;
  const data = LEVELS[G.level - 1];
  ctx.save();
  ctx.shadowBlur = door.open ? 20 : 8;
  ctx.shadowColor = door.open ? '#ffd700' : data.accentColor;
  ctx.fillStyle = door.open ? '#4a3000' : '#1a0040';
  ctx.fillRect(sx, sy, door.w, door.h);
  ctx.strokeStyle = door.open ? '#ffd700' : data.accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, door.w, door.h);
  ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(door.open ? '🚪' : '🔒', sx + door.w/2, sy + door.h/2);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPlayer() {
  const sx = player.x - camera.x, sy = player.y - camera.y;
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) return;

  ctx.save();
  ctx.translate(sx + player.w/2, sy + player.h/2);
  if (player.facing < 0) ctx.scale(-1, 1);

  // Shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, player.h/2 + 2, 14, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 15; ctx.shadowColor = '#a855f7';

  // Body
  const grd = ctx.createLinearGradient(-player.w/2, 0, player.w/2, 0);
  grd.addColorStop(0, '#7c3aed');
  grd.addColorStop(0.5, '#a855f7');
  grd.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grd;
  ctx.fillRect(-player.w/2, -player.h/2, player.w, player.h);

  // Eyes
  ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
  ctx.fillRect(2, -player.h/2 + 8, 6, 7);
  ctx.fillStyle = '#00d4ff';
  ctx.fillRect(4, -player.h/2 + 10, 3, 4);

  // Visor
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#00d4ff';
  ctx.fillRect(-player.w/2 + 2, -player.h/2 + 4, player.w - 4, 14);
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 0;
  ctx.restore();

  // Double jump indicator
  if (!player.onGround && player.jumpsLeft > 0) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#a855f7';
    ctx.font = '12px Exo 2, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑', sx + player.w/2, sy - 10);
    ctx.globalAlpha = 1;
  }
}

function lighten(hex) {
  const r=Math.min(255,parseInt(hex.slice(1,3),16)+40);
  const g=Math.min(255,parseInt(hex.slice(3,5),16)+40);
  const b=Math.min(255,parseInt(hex.slice(5,7),16)+60);
  return `rgb(${r},${g},${b})`;
}

/* ----- PARTICLES ----- */
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2, spd = 2 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life: 30+Math.random()*20, maxLife:50, color, r:2+Math.random()*3 });
  }
}

/* ----- HUD ----- */
function updateHUD() {
  document.getElementById('scoreDisplay').textContent = G.score;
  document.getElementById('coinDisplay').textContent = G.coins;
  document.getElementById('levelDisplay').textContent = G.level;
  const hearts = document.querySelectorAll('#livesDisplay .life-icon');
  hearts.forEach((h, i) => h.classList.toggle('empty', i >= G.lives));

  // Open door when all coins collected
  const allCoins = coins.every(c => c.collected);
  if (allCoins && !door.open) { door.open = true; showHint('All coins collected! Door unlocked! 🚪'); }
}

function showHint(text) {
  const h = document.createElement('div');
  h.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);border:1px solid #a855f7;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;color:#a855f7;z-index:50;pointer-events:none;`;
  h.textContent = text;
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 3000);
}

/* ----- GAME LOOP ----- */
function gameLoop() {
  if (!G.running || G.paused) return;
  requestAnimationFrame(gameLoop);

  updateMovingPlatforms();
  updatePlayer();
  updateEnemies();
  updateCoins();
  updateDoor();
  updateCamera();
  updateHUD();

  drawBackground();
  drawPlatforms();
  drawDoor();
  drawCoins();
  drawEnemies();

  // Particles
  particles = particles.filter(p => p.life-- > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, p.r, 0, Math.PI*2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.vx *= 0.95; p.r *= 0.96;
  });
  ctx.globalAlpha = 1;

  drawPlayer();
}

function endGame() {
  G.running = false;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('finalScore').textContent = `Score: ${G.score.toLocaleString()}`;
}

function winGame() {
  G.running = false;
  document.getElementById('winOverlay').classList.remove('hidden');
  document.getElementById('winScore').textContent = `Score: ${G.score.toLocaleString()} · Coins: ${G.coins}`;
}

function startGame() {
  G.score=0; G.coins=0; G.lives=3; G.level=1; G.running=true; G.paused=false;
  particles=[];
  initLevel(1);
  ['startOverlay','pauseOverlay','gameOverOverlay','winOverlay'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  updateHUD();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp' || e.key === ' ') && G.running && !G.paused) {
    if (player.jumpsLeft > 0) {
      player.vy = player.jumpsLeft === 2 ? JUMP_FORCE : DOUBLE_JUMP_FORCE;
      player.jumpsLeft--;
      spawnParticles(player.x + player.w/2, player.y + player.h, '#a855f7', 6);
    }
    e.preventDefault();
  }
  if (['ArrowLeft','ArrowRight','ArrowDown'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

document.getElementById('startBtn')?.addEventListener('click', startGame);
document.getElementById('retryBtn')?.addEventListener('click', startGame);
document.getElementById('replayBtn')?.addEventListener('click', startGame);
document.getElementById('resumeBtn')?.addEventListener('click', togglePause);
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('restartBtn')?.addEventListener('click', startGame);

function togglePause() {
  if (!G.running) return;
  G.paused = !G.paused;
  document.getElementById('pauseOverlay')?.classList.toggle('hidden', !G.paused);
  document.getElementById('pauseBtn').textContent = G.paused ? '▶ Resume' : '⏸ Pause';
  if (!G.paused) requestAnimationFrame(gameLoop);
}
