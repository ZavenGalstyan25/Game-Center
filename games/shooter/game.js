/* ============================================================
   GALAXY DEFENDER — GAME LOGIC
   ============================================================ */

// Loading screen
(function() {
  const bar = document.getElementById('load-bar');
  const screen = document.getElementById('loading-screen');
  let pct = 0;
  const t = setInterval(() => {
    pct += Math.random() * 20 + 10;
    bar.style.width = Math.min(pct, 95) + '%';
    if (pct >= 95) { clearInterval(t); setTimeout(() => { bar.style.width = '100%'; setTimeout(() => screen.classList.add('hide'), 400); }, 300); }
  }, 120);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive canvas
function resizeCanvas() {
  const area = canvas.parentElement;
  canvas.width = area.clientWidth;
  canvas.height = area.clientHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game State
const G = {
  score: 0, lives: 3, wave: 1, kills: 0, totalKills: 0,
  running: false, paused: false, gameOver: false,
  shootCooldown: 0, shootCooldownMax: 12,
  waveKillsNeeded: 10, waveKills: 0,
  multiplier: 1, multTimer: 0,
  powerupSpawnTimer: 0,
  bossActive: false, bossHp: 0,
};

const keys = {};
const player = { x: 0, y: 0, w: 36, h: 44, speed: 5, color: '#00d4ff', shieldTimer: 0, tripleShot: false, tripleShotTimer: 0, speedBoost: false, speedTimer: 0 };
let bullets = [], enemies = [], enemyBullets = [], particles = [], powerups = [], stars = [];

/* ----- STARS ----- */
function initStars() {
  stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 1.5 + 0.3,
    opacity: Math.random() * 0.7 + 0.3,
  }));
}

function updateStars() {
  stars.forEach(s => {
    s.y += s.speed;
    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
  });
}

function drawStars() {
  stars.forEach(s => {
    ctx.globalAlpha = s.opacity;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ----- PLAYER ----- */
function resetPlayer() {
  player.x = canvas.width / 2;
  player.y = canvas.height - 80;
  player.shieldTimer = 0;
  player.tripleShot = false; player.tripleShotTimer = 0;
  player.speedBoost = false; player.speedTimer = 0;
}

function drawPlayer() {
  const x = player.x, y = player.y;
  ctx.save();
  ctx.translate(x, y);

  // Shield effect
  if (player.shieldTimer > 0) {
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.2;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Engine glow
  ctx.globalAlpha = 0.4 + Math.random() * 0.3;
  const eng = ctx.createRadialGradient(0, 16, 0, 0, 16, 18);
  eng.addColorStop(0, '#ff6600');
  eng.addColorStop(1, 'transparent');
  ctx.fillStyle = eng;
  ctx.beginPath(); ctx.arc(0, 16, 18, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Ship body
  const grd = ctx.createLinearGradient(0, -22, 0, 22);
  grd.addColorStop(0, '#00d4ff');
  grd.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-16, 22);
  ctx.lineTo(-6, 14);
  ctx.lineTo(0, 18);
  ctx.lineTo(6, 14);
  ctx.lineTo(16, 22);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = 'rgba(0,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(0, -4, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glow
  ctx.shadowBlur = 20; ctx.shadowColor = '#00d4ff';
  ctx.strokeStyle = 'rgba(0,212,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-16, 22);
  ctx.lineTo(-6, 14);
  ctx.lineTo(0, 18);
  ctx.lineTo(6, 14);
  ctx.lineTo(16, 22);
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ----- BULLETS ----- */
function shoot() {
  const spd = 10;
  if (player.tripleShot) {
    [-5, 0, 5].forEach(angle => {
      bullets.push({ x: player.x + angle * 4, y: player.y - 22, vx: angle * 0.5, vy: -spd, color: '#00ffff', r: 4, life: 80 });
    });
  } else {
    bullets.push({ x: player.x, y: player.y - 22, vx: 0, vy: -spd, color: '#00ffff', r: 4, life: 80 });
  }
}

function drawBullet(b) {
  ctx.save();
  ctx.shadowBlur = 12; ctx.shadowColor = b.color;
  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y, b.r, b.r * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ----- ENEMIES ----- */
const ENEMY_TYPES = [
  { type: 'basic', w: 30, h: 30, hp: 1, speed: 1.2, score: 10, color: '#ff4444', shootRate: 0, emoji: '👽' },
  { type: 'fast',  w: 24, h: 24, hp: 1, speed: 2.5, score: 20, color: '#ff8c00', shootRate: 0, emoji: '🛸' },
  { type: 'tank',  w: 38, h: 38, hp: 3, speed: 0.8, score: 50, color: '#9b59b6', shootRate: 80, emoji: '👾' },
  { type: 'boss',  w: 60, h: 60, hp: 20, speed: 1.0, score: 500, color: '#e74c3c', shootRate: 40, emoji: '🤖' },
];

function spawnEnemies() {
  const count = Math.min(4 + G.wave, 12);
  for (let i = 0; i < count; i++) {
    const typeIdx = Math.min(Math.floor(Math.random() * (1 + Math.min(G.wave / 2, 2))), 2);
    const tmpl = ENEMY_TYPES[typeIdx];
    setTimeout(() => {
      enemies.push({
        ...tmpl,
        x: 40 + Math.random() * (canvas.width - 80),
        y: -50 - Math.random() * 200,
        maxHp: tmpl.hp,
        shootTimer: Math.random() * 60,
        vx: (Math.random() - 0.5) * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }, i * 300);
  }
}

function spawnBoss() {
  G.bossActive = true;
  const boss = { ...ENEMY_TYPES[3], x: canvas.width / 2, y: -80, maxHp: 20 + G.wave * 5, hp: 20 + G.wave * 5, shootTimer: 0, vx: 1.2, phase: 0 };
  boss.maxHp = boss.hp;
  G.bossHp = boss.hp;
  enemies.push(boss);
  showBossWarning();
}

function showBossWarning() {
  // Flash effect
  const f = document.createElement('div');
  f.style.cssText = 'position:fixed;inset:0;background:rgba(231,76,60,0.3);z-index:50;pointer-events:none;animation:fadeOut 1.5s forwards';
  f.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:40px;font-weight:900;color:#ff4444;letter-spacing:4px;text-shadow:0 0 20px #ff4444">⚠ BOSS INCOMING ⚠</div>';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1500);
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'boss') {
    // Boss: rotating glow ring
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Body
  ctx.shadowBlur = 15; ctx.shadowColor = e.color;
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, e.w / 2);
  grd.addColorStop(0, e.color);
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grd;
  if (e.type === 'boss') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + e.phase;
      const r = i % 2 === 0 ? e.w / 2 : e.w / 3;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Emoji
  ctx.globalAlpha = 1;
  ctx.font = `${e.w * 0.8}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e.emoji, 0, 0);

  // HP bar for tank/boss
  if (e.hp < e.maxHp || e.type === 'boss') {
    const bw = e.w + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-bw/2, e.h/2 + 4, bw, 5);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#10b981' : '#ef4444';
    ctx.fillRect(-bw/2, e.h/2 + 4, bw * (e.hp / e.maxHp), 5);
  }

  ctx.restore();
}

/* ----- ENEMY BULLETS ----- */
function drawEnemyBullet(b) {
  ctx.save();
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff4444';
  ctx.fillStyle = '#ff6666';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ----- PARTICLES ----- */
function spawnExplosion(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 40 + Math.random() * 20, maxLife: 60, color, r: 2 + Math.random() * 3 });
  }
}

function spawnHitSpark(x, y) {
  for (let i = 0; i < 5; i++) {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 20, maxLife: 20, color: '#fff', r: 2 });
  }
}

/* ----- POWERUPS ----- */
const POWERUP_TYPES = [
  { type: 'shield', emoji: '🛡️', color: '#00d4ff', duration: 300 },
  { type: 'triple', emoji: '🔱', color: '#ffd700', duration: 300 },
  { type: 'speed',  emoji: '⚡', color: '#39ff14', duration: 300 },
  { type: 'life',   emoji: '❤️', color: '#ff4444', duration: 0 },
];

function spawnPowerup(x, y) {
  const tmpl = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({ ...tmpl, x, y, vy: 1.5, bob: 0, life: 300 });
}

function drawPowerup(p) {
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(p.bob) * 4);
  ctx.shadowBlur = 16; ctx.shadowColor = p.color;
  ctx.fillStyle = p.color + '33';
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.emoji, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

/* ----- HUD UPDATE ----- */
function updateHUD() {
  document.getElementById('scoreDisplay').textContent = G.score;
  document.getElementById('waveDisplay').textContent = G.wave;
  document.getElementById('killsDisplay').textContent = G.totalKills;
  const hearts = document.querySelectorAll('#livesDisplay .hp-heart');
  hearts.forEach((h, i) => h.classList.toggle('empty', i >= G.lives));
  const multEl = document.getElementById('multDisplay');
  if (G.multiplier > 1) { multEl.style.display = 'flex'; document.getElementById('multVal').textContent = `x${G.multiplier}`; }
  else { multEl.style.display = 'none'; }
}

/* ----- COLLISION ----- */
function circleCollide(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy) < ar + br;
}

/* ----- WAVE COMPLETE ----- */
function nextWave() {
  G.wave++;
  G.waveKills = 0;
  G.waveKillsNeeded = 10 + G.wave * 3;
  G.bossActive = false;

  // Show wave banner
  const banner = document.createElement('div');
  banner.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:36px;font-weight:900;color:#00d4ff;text-shadow:0 0 20px #00d4ff;z-index:50;pointer-events:none;animation:fadeOut 2s forwards;letter-spacing:3px`;
  banner.textContent = `WAVE ${G.wave}`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2000);

  if (G.wave % 5 === 0) spawnBoss();
  else setTimeout(spawnEnemies, 1000);
}

/* ----- MAIN GAME LOOP ----- */
function gameLoop() {
  if (!G.running || G.paused) return;
  requestAnimationFrame(gameLoop);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#000018');
  bg.addColorStop(1, '#000008');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  updateStars(); drawStars();

  // Player movement
  const spd = player.speedBoost ? player.speed * 1.7 : player.speed;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= spd;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += spd;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) player.y -= spd;
  if (keys['ArrowDown'] || keys['s'] || keys['S']) player.y += spd;
  player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
  player.y = Math.max(60, Math.min(canvas.height - 20, player.y));

  // Shoot
  if (G.shootCooldown > 0) G.shootCooldown--;
  if ((keys[' '] || keys['Space']) && G.shootCooldown === 0) { shoot(); G.shootCooldown = G.shootCooldownMax; }

  // Timers
  if (player.shieldTimer > 0) player.shieldTimer--;
  if (player.tripleShotTimer > 0) { player.tripleShotTimer--; if (!player.tripleShotTimer) player.tripleShot = false; }
  if (player.speedTimer > 0) { player.speedTimer--; if (!player.speedTimer) player.speedBoost = false; }
  if (G.multTimer > 0) { G.multTimer--; if (!G.multTimer) G.multiplier = 1; }

  // Bullets update
  bullets = bullets.filter(b => b.life-- > 0);
  bullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
  bullets.forEach(b => drawBullet(b));

  // Enemy bullets update
  enemyBullets = enemyBullets.filter(b => b.y < canvas.height + 20);
  enemyBullets.forEach(b => { b.x += b.vx; b.y += b.vy; });
  enemyBullets.forEach(b => drawEnemyBullet(b));

  // Enemies update + draw
  enemies.forEach(e => {
    e.phase += 0.02;
    e.y += e.speed;
    e.x += e.vx;
    if (e.type === 'boss') {
      if (e.x < 60 || e.x > canvas.width - 60) e.vx *= -1;
      e.y = Math.max(-30, Math.min(canvas.height * 0.3, e.y));
    }
    if (e.x < 20 || e.x > canvas.width - 20) e.vx *= -1;

    // Enemy shooting
    if (e.shootRate > 0) {
      e.shootTimer++;
      const rate = e.type === 'boss' ? Math.max(30, 80 - G.wave * 3) : e.shootRate;
      if (e.shootTimer >= rate) {
        e.shootTimer = 0;
        if (e.type === 'boss') {
          for (let a = -30; a <= 30; a += 15) {
            const rad = (a * Math.PI / 180);
            enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: Math.sin(rad) * 4, vy: 4, life: 100 });
          }
        } else {
          const dx = player.x - e.x, dy = player.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: (dx / dist) * 3.5, vy: (dy / dist) * 3.5, life: 100 });
        }
      }
    }
    drawEnemy(e);
  });

  // Powerups
  G.powerupSpawnTimer++;
  if (G.powerupSpawnTimer > 300) { G.powerupSpawnTimer = 0; if (Math.random() < 0.4) spawnPowerup(50 + Math.random() * (canvas.width - 100), -20); }
  powerups = powerups.filter(p => { p.bob += 0.05; p.y += p.vy; p.life--; return p.y < canvas.height && p.life > 0; });
  powerups.forEach(p => drawPowerup(p));

  // Collision: player bullets vs enemies
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      if (circleCollide(bullets[bi].x, bullets[bi].y, bullets[bi].r, enemies[ei].x, enemies[ei].y, enemies[ei].w / 2)) {
        spawnHitSpark(bullets[bi].x, bullets[bi].y);
        bullets.splice(bi, 1);
        enemies[ei].hp--;
        if (enemies[ei].hp <= 0) {
          spawnExplosion(enemies[ei].x, enemies[ei].y, enemies[ei].color, enemies[ei].type === 'boss' ? 30 : 12);
          G.score += enemies[ei].score * G.multiplier;
          G.kills++; G.totalKills++; G.waveKills++;
          G.multiplier = Math.min(5, 1 + Math.floor(G.kills / 5));
          G.multTimer = 120;
          if (Math.random() < 0.2) spawnPowerup(enemies[ei].x, enemies[ei].y);
          enemies.splice(ei, 1);
          if (G.waveKills >= G.waveKillsNeeded) nextWave();
        }
        break;
      }
    }
  }

  // Collision: enemy bullets vs player
  if (player.shieldTimer === 0) {
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      if (circleCollide(enemyBullets[bi].x, enemyBullets[bi].y, 5, player.x, player.y, 16)) {
        spawnExplosion(enemyBullets[bi].x, enemyBullets[bi].y, '#ff4444', 8);
        enemyBullets.splice(bi, 1);
        takeHit();
        break;
      }
    }
  }

  // Collision: enemies vs player
  enemies.forEach(e => {
    if (player.shieldTimer === 0 && circleCollide(e.x, e.y, e.w / 2 - 5, player.x, player.y, 18)) {
      spawnExplosion(player.x, player.y, '#ff4444', 20);
      takeHit();
      player.shieldTimer = 90;
    }
  });

  // Enemies gone (not boss) — spawn more
  if (enemies.length === 0 && !G.bossActive) spawnEnemies();

  // Powerup collection
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (circleCollide(powerups[i].x, powerups[i].y, 16, player.x, player.y, 22)) {
      applyPowerup(powerups[i]);
      spawnExplosion(powerups[i].x, powerups[i].y, powerups[i].color, 10);
      powerups.splice(i, 1);
    }
  }

  // Particles
  particles = particles.filter(p => p.life-- > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.r *= 0.97;
  });
  ctx.globalAlpha = 1;

  drawPlayer();

  // Score popups
  updateHUD();
}

function applyPowerup(p) {
  if (p.type === 'shield') { player.shieldTimer = p.duration; showFloatingText(player.x, player.y, '🛡️ SHIELD!', '#00d4ff'); }
  else if (p.type === 'triple') { player.tripleShot = true; player.tripleShotTimer = p.duration; showFloatingText(player.x, player.y, '🔱 TRIPLE!', '#ffd700'); }
  else if (p.type === 'speed') { player.speedBoost = true; player.speedTimer = p.duration; showFloatingText(player.x, player.y, '⚡ SPEED!', '#39ff14'); }
  else if (p.type === 'life') { G.lives = Math.min(3, G.lives + 1); updateHUD(); showFloatingText(player.x, player.y, '❤️ +1 LIFE!', '#ff4444'); }
}

function showFloatingText(x, y, text, color) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${x}px;top:${y - 20}px;transform:translate(-50%,-50%);color:${color};font-size:16px;font-weight:800;pointer-events:none;z-index:30;animation:fadeOut 1.5s forwards;text-shadow:0 0 10px ${color}`;
  el.textContent = text;
  document.querySelector('.game-area').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function takeHit() {
  player.shieldTimer = 60;
  G.lives--;
  updateHUD();
  screenShake();
  if (G.lives <= 0) endGame();
}

function screenShake() {
  const area = canvas.parentElement;
  area.style.animation = 'none';
  area.offsetHeight;
  const intensity = 8;
  let t = 0;
  const shake = setInterval(() => {
    area.style.transform = `translate(${(Math.random()-0.5)*intensity}px,${(Math.random()-0.5)*intensity}px)`;
    if (++t > 5) { clearInterval(shake); area.style.transform = ''; }
  }, 50);
}

function endGame() {
  G.running = false; G.gameOver = true;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('finalScore').textContent = `Score: ${G.score.toLocaleString()}`;
  document.getElementById('finalWave').textContent = `Reached Wave ${G.wave} · ${G.totalKills} enemies eliminated`;
}

/* ----- START / RESTART ----- */
function startGame() {
  G.score = 0; G.lives = 3; G.wave = 1; G.kills = 0; G.totalKills = 0;
  G.running = true; G.paused = false; G.gameOver = false;
  G.shootCooldown = 0; G.waveKills = 0; G.waveKillsNeeded = 10;
  G.multiplier = 1; G.multTimer = 0; G.powerupSpawnTimer = 0; G.bossActive = false;
  bullets = []; enemies = []; enemyBullets = []; particles = []; powerups = [];
  resetPlayer(); initStars();
  document.getElementById('startOverlay')?.classList.add('hidden');
  document.getElementById('pauseOverlay')?.classList.add('hidden');
  document.getElementById('gameOverOverlay')?.classList.add('hidden');
  spawnEnemies();
  updateHUD();
  requestAnimationFrame(gameLoop);
}

/* ----- CONTROLS ----- */
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === ' ') e.preventDefault();
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

// Add fadeOut animation style
const style = document.createElement('style');
style.textContent = '@keyframes fadeOut{0%{opacity:1;transform:translate(-50%,-60%)}100%{opacity:0;transform:translate(-50%,-120%)}} @keyframes bounce{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.2);opacity:1}80%{transform:scale(0.95)}100%{transform:scale(1)}}';
document.head.appendChild(style);
