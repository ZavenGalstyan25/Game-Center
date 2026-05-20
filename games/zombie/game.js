/* ============================================================
   DEAD ZONE — ZOMBIE SURVIVAL GAME LOGIC
   ============================================================ */

(function() {
  const bar=document.getElementById('load-bar'),screen=document.getElementById('loading-screen');
  let p=0;const t=setInterval(()=>{p+=Math.random()*20+10;bar.style.width=Math.min(p,95)+'%';if(p>=95){clearInterval(t);setTimeout(()=>{bar.style.width='100%';setTimeout(()=>screen.classList.add('hide'),400)},300);}},120);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() { const a=canvas.parentElement; canvas.width=a.clientWidth; canvas.height=a.clientHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);

const MAX_AMMO = 8, RELOAD_TIME = 150;
const PLAYER_R = 20, BULLET_R = 5, BULLET_SPD = 14;

const keys = {};
let mouse = { x: 0, y: 0 };
let mouseDown = false;

const G = {
  score: 0, hp: 100, maxHp: 100, kills: 0,
  wave: 1, waveKills: 0, waveKillsNeeded: 5,
  ammo: MAX_AMMO, reloading: false, reloadTimer: 0,
  shootCooldown: 0, running: false, paused: false, gameOver: false,
  waveSpawned: false, dayTime: 0,
};

let player, bullets, zombies, particles, bloodPools, ammoPickups, obstacles;

/* ----- MAP OBSTACLES ----- */
function genObstacles() {
  obstacles = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    let ob;
    do {
      ob = {
        x: 80 + Math.random() * (canvas.width - 160),
        y: 80 + Math.random() * (canvas.height - 160),
        w: 40 + Math.random() * 60,
        h: 40 + Math.random() * 60,
        color: ['#1a1a2e','#16213e','#0f3460'][Math.floor(Math.random()*3)],
        type: ['box','barrel','wall'][Math.floor(Math.random()*3)],
      };
    } while (dist2(ob.x + ob.w/2, ob.y + ob.h/2, canvas.width/2, canvas.height/2) < 100*100);
    obstacles.push(ob);
  }
}

function dist2(ax,ay,bx,by) { return (ax-bx)**2+(ay-by)**2; }

function reset() {
  player = { x: canvas.width/2, y: canvas.height/2, r: PLAYER_R, vx: 0, vy: 0, angle: 0, hp: 100, invincible: 0 };
  bullets = []; zombies = []; particles = []; bloodPools = []; ammoPickups = [];
  G.score=0; G.hp=100; G.kills=0; G.wave=1; G.waveKills=0; G.waveKillsNeeded=5;
  G.ammo=MAX_AMMO; G.reloading=false; G.reloadTimer=0; G.shootCooldown=0; G.dayTime=0;
  G.waveSpawned=false;
  genObstacles();
}

/* ----- ZOMBIE SPAWNING ----- */
const ZOMBIE_TYPES = [
  { type:'walker', r:18, speed:1.4, hp:2, score:10, color:'#2d5a1e', emoji:'🧟' },
  { type:'runner', r:15, speed:3.0, hp:1, score:20, color:'#5a2d1e', emoji:'💀' },
  { type:'tank',   r:28, speed:0.8, hp:6, score:50, color:'#1e3a5a', emoji:'🧟‍♂️' },
];

function spawnZombieWave() {
  G.waveSpawned = true;
  const count = 5 + G.wave * 3;
  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnZombie(), i * 300);
  }
}

function spawnZombie() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const pad = 30;
  if (side === 0) { x = Math.random() * canvas.width; y = -pad; }
  else if (side === 1) { x = canvas.width + pad; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + pad; }
  else { x = -pad; y = Math.random() * canvas.height; }

  const waveBonus = Math.min(G.wave - 1, 5);
  const typeIdx = Math.min(Math.floor(Math.random() * (1 + waveBonus * 0.5)), 2);
  const tmpl = ZOMBIE_TYPES[typeIdx];
  zombies.push({
    ...tmpl, x, y,
    maxHp: tmpl.hp + Math.floor(G.wave / 3),
    hp: tmpl.hp + Math.floor(G.wave / 3),
    vx: 0, vy: 0, angle: 0,
    wobble: Math.random() * Math.PI * 2,
  });
}

/* ----- DRAW BACKGROUND ----- */
function drawBackground() {
  G.dayTime += 0.001;
  const dark = 0.7 + Math.sin(G.dayTime) * 0.15;
  ctx.fillStyle = `rgb(${Math.floor(10*dark)},${Math.floor(12*dark)},${Math.floor(10*dark)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid (street)
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#334433';
  ctx.lineWidth = 1;
  const grid = 80;
  for (let x = 0; x < canvas.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

/* ----- DRAW BLOOD POOLS ----- */
function drawBloodPools() {
  bloodPools.forEach(b => {
    ctx.globalAlpha = b.opacity * 0.5;
    ctx.fillStyle = '#440000';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 1.4, b.r, b.angle, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

/* ----- DRAW OBSTACLES ----- */
function drawObstacles() {
  obstacles.forEach(o => {
    ctx.shadowBlur = 6; ctx.shadowColor = '#000';
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = lightenHex(o.color, 30);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    // Icons
    ctx.font = `${Math.min(o.w, o.h) * 0.5}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(o.type === 'barrel' ? '🛢️' : o.type === 'box' ? '📦' : '🧱', o.x + o.w/2, o.y + o.h/2);
    ctx.shadowBlur = 0;
  });
}

function lightenHex(hex, amt) {
  const r=Math.min(255,parseInt(hex.slice(1,3),16)+amt);
  const g=Math.min(255,parseInt(hex.slice(3,5),16)+amt);
  const b=Math.min(255,parseInt(hex.slice(5,7),16)+amt);
  return `rgb(${r},${g},${b})`;
}

/* ----- DRAW PLAYER ----- */
function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 6) % 2 === 0) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // Shadow
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(2, 6, player.r * 0.8, player.r * 0.4, 0, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // Body
  ctx.shadowBlur = 15; ctx.shadowColor = '#00d4ff';
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, player.r);
  grd.addColorStop(0, '#2a6a8a');
  grd.addColorStop(1, '#0a3050');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI*2); ctx.fill();

  // Gun
  ctx.fillStyle = '#888';
  ctx.fillRect(player.r * 0.4, -3, player.r + 8, 6);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(player.r * 0.4, -2, player.r + 8, 2);

  // Helmet
  ctx.fillStyle = '#1a5580';
  ctx.beginPath(); ctx.arc(0, -4, player.r * 0.75, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(150,220,255,0.3)';
  ctx.beginPath(); ctx.arc(-4, -6, player.r * 0.5, Math.PI, 0); ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();

  // Crosshair at mouse
  const mx = mouse.x - canvas.getBoundingClientRect().left;
  const my = mouse.y - canvas.getBoundingClientRect().top;
  ctx.save();
  ctx.strokeStyle = 'rgba(239,68,68,0.7)'; ctx.lineWidth = 1.5;
  ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(mx - 20, my); ctx.lineTo(mx + 20, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my - 20); ctx.lineTo(mx, my + 20); ctx.stroke();
  ctx.restore();
}

/* ----- DRAW ZOMBIES ----- */
function drawZombies() {
  zombies.forEach(z => {
    ctx.save();
    ctx.translate(z.x, z.y);
    z.wobble += 0.12;
    ctx.rotate(Math.sin(z.wobble) * 0.2);

    ctx.shadowBlur = 12; ctx.shadowColor = z.color;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, z.r);
    grd.addColorStop(0, lightenHex(z.color, 30));
    grd.addColorStop(1, z.color);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `${z.r * 1.2}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(z.emoji, 0, 0);

    // HP bar
    if (z.hp < z.maxHp) {
      const bw = z.r * 2 + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-bw/2, -z.r - 10, bw, 4);
      ctx.fillStyle = z.hp / z.maxHp > 0.5 ? '#10b981' : '#ef4444';
      ctx.fillRect(-bw/2, -z.r - 10, bw * (z.hp / z.maxHp), 4);
    }
    ctx.restore();
  });
}

/* ----- AMMO PICKUPS ----- */
function drawAmmoPickups() {
  ammoPickups.forEach(a => {
    a.bob = (a.bob || 0) + 0.05;
    ctx.save();
    ctx.translate(a.x, a.y + Math.sin(a.bob) * 4);
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffd700';
    ctx.fillStyle = 'rgba(255,215,0,0.2)';
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔫', 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

/* ----- SHOOT ----- */
function shoot() {
  if (G.reloading || G.ammo <= 0 || G.shootCooldown > 0) return;
  const mx = mouse.x - canvas.getBoundingClientRect().left;
  const my = mouse.y - canvas.getBoundingClientRect().top;
  const dx = mx - player.x, dy = my - player.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  bullets.push({
    x: player.x, y: player.y,
    vx: (dx / dist) * BULLET_SPD,
    vy: (dy / dist) * BULLET_SPD,
    life: 60,
  });
  G.ammo--;
  G.shootCooldown = 10;
  if (G.ammo === 0) startReload();
  updateHUD();
}

function startReload() {
  if (G.reloading || G.ammo === MAX_AMMO) return;
  G.reloading = true; G.reloadTimer = RELOAD_TIME;
  document.getElementById('reloadOverlay').style.display = 'block';
}

/* ----- UPDATE ----- */
function updatePlayer() {
  const spd = 4;
  let mvx = 0, mvy = 0;
  if (keys['w'] || keys['W'] || keys['ArrowUp']) mvy -= spd;
  if (keys['s'] || keys['S'] || keys['ArrowDown']) mvy += spd;
  if (keys['a'] || keys['A'] || keys['ArrowLeft']) mvx -= spd;
  if (keys['d'] || keys['D'] || keys['ArrowRight']) mvx += spd;
  if (mvx !== 0 && mvy !== 0) { mvx *= 0.707; mvy *= 0.707; }

  const nx = player.x + mvx, ny = player.y + mvy;
  if (!hitsObstacle(nx, player.y, player.r)) player.x = nx;
  if (!hitsObstacle(player.x, ny, player.r)) player.y = ny;
  player.x = Math.max(player.r, Math.min(canvas.width - player.r, player.x));
  player.y = Math.max(player.r, Math.min(canvas.height - player.r, player.y));

  const mx = mouse.x - canvas.getBoundingClientRect().left;
  const my = mouse.y - canvas.getBoundingClientRect().top;
  player.angle = Math.atan2(my - player.y, mx - player.x);

  if (player.invincible > 0) player.invincible--;
  if (G.shootCooldown > 0) G.shootCooldown--;

  if (G.reloading) {
    G.reloadTimer--;
    if (G.reloadTimer <= 0) {
      G.reloading = false; G.ammo = MAX_AMMO;
      document.getElementById('reloadOverlay').style.display = 'none';
      updateHUD();
    }
  }

  if (mouseDown && !G.reloading) shoot();
}

function hitsObstacle(x, y, r) {
  return obstacles.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
}

function updateZombies() {
  zombies.forEach(z => {
    const dx = player.x - z.x, dy = player.y - z.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0) { z.vx = (dx/d) * z.speed; z.vy = (dy/d) * z.speed; }

    const nx = z.x + z.vx, ny = z.y + z.vy;
    if (!hitsObstacle(nx, z.y, z.r - 4)) z.x = nx;
    if (!hitsObstacle(z.x, ny, z.r - 4)) z.y = ny;

    // Attack player
    if (player.invincible === 0 && d < player.r + z.r - 2) {
      G.hp -= z.type === 'tank' ? 8 : 4;
      player.invincible = 40;
      screenShake();
      spawnParticles(player.x, player.y, '#ef4444', 8);
      if (G.hp <= 0) { G.hp = 0; endGame(); }
      updateHUD();
    }
  });
}

function updateBullets() {
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0 || b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) { bullets.splice(bi, 1); continue; }
    if (hitsObstacle(b.x, b.y, BULLET_R)) { bullets.splice(bi, 1); spawnParticles(b.x, b.y, '#aaa', 4); continue; }

    for (let zi = zombies.length - 1; zi >= 0; zi--) {
      const z = zombies[zi];
      if (Math.sqrt((b.x-z.x)**2+(b.y-z.y)**2) < BULLET_R + z.r) {
        z.hp--;
        spawnParticles(b.x, b.y, '#ff4444', 6);
        bullets.splice(bi, 1);
        if (z.hp <= 0) {
          bloodPools.push({ x: z.x + (Math.random()-0.5)*20, y: z.y + (Math.random()-0.5)*20, r: 15 + Math.random()*15, angle: Math.random()*Math.PI, opacity: 0.8 });
          spawnParticles(z.x, z.y, z.color, 14);
          G.score += z.score * G.wave; G.kills++; G.waveKills++;
          if (Math.random() < 0.2) ammoPickups.push({ x: z.x, y: z.y, bob: 0 });
          zombies.splice(zi, 1);
          if (G.waveKills >= G.waveKillsNeeded && zombies.length === 0) nextWave();
        }
        break;
      }
    }
  }
}

function nextWave() {
  G.wave++;
  G.waveKills = 0;
  G.waveKillsNeeded = 5 + G.wave * 3;
  G.waveSpawned = false;
  updateHUD();
  const banner = document.createElement('div');
  banner.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:36px;font-weight:900;color:#ef4444;text-shadow:0 0 20px #ef4444;z-index:50;pointer-events:none;letter-spacing:3px`;
  banner.textContent = `WAVE ${G.wave}`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2000);
  setTimeout(() => { G.waveSpawned = false; }, 1000);
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = (i/count)*Math.PI*2, spd = 2+Math.random()*4;
    particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life: 25+Math.random()*15, maxLife:40, color, r:2+Math.random()*3 });
  }
}

function screenShake() {
  const area = canvas.parentElement; let t = 0;
  const s = setInterval(() => { area.style.transform = `translate(${(Math.random()-0.5)*10}px,${(Math.random()-0.5)*10}px)`; if(++t>5){clearInterval(s);area.style.transform='';} }, 40);
}

function drawBullets() {
  bullets.forEach(b => {
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700';
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawParticles() {
  particles = particles.filter(p => p.life-- > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vx *= 0.95; p.r *= 0.97;
  });
  ctx.globalAlpha = 1;
}

function updateHUD() {
  document.getElementById('scoreDisplay').textContent = G.score;
  document.getElementById('waveDisplay').textContent = G.wave;
  document.getElementById('killsDisplay').textContent = G.kills;
  const pct = Math.max(0, G.hp) / G.maxHp * 100;
  document.getElementById('hpFill').style.width = pct + '%';
  document.getElementById('hpNum').textContent = Math.max(0, G.hp);
  // Ammo display
  const ammoEl = document.getElementById('ammoDisplay');
  ammoEl.innerHTML = '';
  for (let i = 0; i < MAX_AMMO; i++) {
    const span = document.createElement('span');
    span.className = 'ammo-bullet' + (i < G.ammo ? '' : ' empty');
    span.textContent = '|';
    ammoEl.appendChild(span);
  }
}

/* ----- GAME LOOP ----- */
function gameLoop() {
  if (!G.running || G.paused) return;
  requestAnimationFrame(gameLoop);

  if (!G.waveSpawned) { G.waveSpawned = true; spawnZombieWave(); }

  updatePlayer();
  updateZombies();
  updateBullets();

  // Ammo pickups
  ammoPickups = ammoPickups.filter(a => {
    if (Math.sqrt((a.x-player.x)**2+(a.y-player.y)**2) < player.r + 16) {
      G.ammo = Math.min(MAX_AMMO, G.ammo + 4);
      if (G.reloading && G.ammo > 0) { G.reloading = false; document.getElementById('reloadOverlay').style.display = 'none'; }
      updateHUD();
      spawnParticles(a.x, a.y, '#ffd700', 8);
      return false;
    }
    return true;
  });

  drawBackground();
  drawBloodPools();
  drawObstacles();
  drawAmmoPickups();
  drawBullets();
  drawZombies();
  drawParticles();
  drawPlayer();
}

function endGame() {
  G.running = false; G.gameOver = true;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('finalScore').textContent = `Score: ${G.score.toLocaleString()}`;
  document.getElementById('finalWave').textContent = `Wave ${G.wave} · ${G.kills} zombies killed`;
}

function startGame() {
  reset();
  G.running = true; G.paused = false; G.gameOver = false;
  ['startOverlay','pauseOverlay','gameOverOverlay'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('reloadOverlay').style.display = 'none';
  updateHUD();
  requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', () => { mouseDown = true; });
canvas.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if ((e.key === 'r' || e.key === 'R') && G.running && !G.paused) startReload();
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
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
