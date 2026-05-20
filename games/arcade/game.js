/* ============================================================
   CYBER BREAKOUT — GAME LOGIC
   ============================================================ */

(function() {
  const bar=document.getElementById('load-bar'),screen=document.getElementById('loading-screen');
  let p=0;const t=setInterval(()=>{p+=Math.random()*20+10;bar.style.width=Math.min(p,95)+'%';if(p>=95){clearInterval(t);setTimeout(()=>{bar.style.width='100%';setTimeout(()=>screen.classList.add('hide'),400)},300);}},120);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const a = canvas.parentElement;
  const maxW = 600, maxH = Math.min(a.clientHeight - 10, 700);
  const scale = Math.min(a.clientWidth / maxW, maxH / 700);
  canvas.width = Math.floor(maxW * scale);
  canvas.height = Math.floor(700 * scale);
}
resizeCanvas(); window.addEventListener('resize', () => { resizeCanvas(); if (G.running) buildBricks(); });

const S = () => canvas.width / 600;

const PADDLE_H = 14, BALL_R = 8;
const BRICK_ROWS = 6, BRICK_COLS = 10;

const BRICK_COLORS = [
  { hp: 1, fill: '#ff3232', border: '#ff6666', glow: '#ff3232', score: 10 },
  { hp: 1, fill: '#ff8c00', border: '#ffb347', glow: '#ff8c00', score: 15 },
  { hp: 1, fill: '#ffd700', border: '#ffec80', glow: '#ffd700', score: 20 },
  { hp: 2, fill: '#00cc44', border: '#00ff55', glow: '#00cc44', score: 30 },
  { hp: 2, fill: '#00aaff', border: '#55ccff', glow: '#00aaff', score: 40 },
  { hp: 3, fill: '#9933ff', border: '#bb66ff', glow: '#9933ff', score: 60 },
];

const POWERUP_TYPES = [
  { type: 'wide', emoji: '⬛', color: '#00d4ff', label: '+WIDE' },
  { type: 'multi', emoji: '●', color: '#f59e0b', label: '+MULTI' },
  { type: 'slow',  emoji: '🐢', color: '#10b981', label: 'SLOW' },
  { type: 'life',  emoji: '❤️', color: '#ef4444', label: '+LIFE' },
  { type: 'laser', emoji: '⚡', color: '#ffd700', label: 'LASER' },
];

const keys = {};
let mouse = { x: 0 };
let G = { score: 0, lives: 3, level: 1, running: false, paused: false, gameOver: false };
let paddle, balls, bricks, particles, powerups, lasers;

function reset() {
  const s = S();
  paddle = { x: canvas.width / 2, y: canvas.height - 40 * s, w: 100 * s, h: PADDLE_H * s, speed: 8, wide: 0, laserTimer: 0 };
  balls = [createBall(true)];
  particles = []; powerups = []; lasers = [];
  buildBricks();
}

function createBall(onPaddle = false) {
  return {
    x: canvas.width / 2, y: canvas.height - 60 * S(),
    vx: (Math.random() > 0.5 ? 1 : -1) * 3.5 * S(),
    vy: -4.5 * S(),
    r: BALL_R * S(),
    onPaddle, trail: [], color: '#00d4ff',
  };
}

function buildBricks() {
  const s = S();
  const padX = 20 * s, padY = 80 * s;
  const bw = (canvas.width - padX * 2) / BRICK_COLS - 4 * s;
  const bh = 22 * s;
  bricks = [];
  const rows = BRICK_ROWS + Math.min(G.level - 1, 4);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const colorIdx = Math.min(Math.floor(r * BRICK_COLORS.length / rows) + Math.floor(Math.random() * 1.5), BRICK_COLORS.length - 1);
      const tmpl = BRICK_COLORS[colorIdx];
      bricks.push({
        x: padX + c * (bw + 4 * s),
        y: padY + r * (bh + 5 * s),
        w: bw, h: bh,
        hp: tmpl.hp + Math.floor((G.level - 1) * 0.3),
        maxHp: tmpl.hp + Math.floor((G.level - 1) * 0.3),
        ...tmpl,
        score: tmpl.score * G.level,
        indestructible: r === 0 && G.level > 2 && Math.random() < 0.2,
      });
    }
  }
  document.getElementById('bricksDisplay').textContent = bricks.filter(b => !b.indestructible).length;
}

/* ----- DRAW ----- */
function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#050508');
  grd.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  const s = S();
  ctx.globalAlpha = 0.04; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 0.5;
  for (let x = 0; x < canvas.width; x += 40 * s) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y < canvas.height; y += 40 * s) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.globalAlpha = 1;

  // Side walls glow
  const wallGlow = ctx.createLinearGradient(0, 0, 10 * s, 0);
  wallGlow.addColorStop(0, 'rgba(245,158,11,0.2)'); wallGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = wallGlow; ctx.fillRect(0, 0, 4 * s, canvas.height);
  const wallGlowR = ctx.createLinearGradient(canvas.width - 10 * s, 0, canvas.width, 0);
  wallGlowR.addColorStop(0, 'transparent'); wallGlowR.addColorStop(1, 'rgba(245,158,11,0.2)');
  ctx.fillStyle = wallGlowR; ctx.fillRect(canvas.width - 4 * s, 0, 4 * s, canvas.height);
}

function drawBricks() {
  bricks.forEach(b => {
    if (b.destroyed) return;
    ctx.save();
    if (b.indestructible) {
      ctx.fillStyle = '#333';
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
    } else {
      const hpRatio = b.hp / b.maxHp;
      ctx.shadowBlur = 8 + (1 - hpRatio) * 6;
      ctx.shadowColor = b.glow;
      ctx.fillStyle = b.fill;
      ctx.strokeStyle = b.border;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3 + hpRatio * 0.7;
    }
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.stroke();
    ctx.shadowBlur = 0;

    // Highlight
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 3);
    ctx.globalAlpha = 1;

    // HP pips for multi-hp bricks
    if (b.maxHp > 1 && !b.indestructible) {
      for (let i = 0; i < b.hp; i++) {
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(b.x + b.w/2 + (i - (b.hp-1)/2) * 8, b.y + b.h - 5, 2, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });
}

function drawPaddle() {
  const p = paddle;
  ctx.save();
  ctx.shadowBlur = 20; ctx.shadowColor = '#00d4ff';
  const grd = ctx.createLinearGradient(p.x - p.w/2, 0, p.x + p.w/2, 0);
  grd.addColorStop(0, '#0044aa');
  grd.addColorStop(0.5, '#00d4ff');
  grd.addColorStop(1, '#0044aa');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.roundRect(p.x - p.w/2, p.y, p.w, p.h, p.h/2); ctx.fill();

  // Laser weapon indicator
  if (p.laserTimer > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffd700';
    ctx.fillRect(p.x - p.w/2 + 4, p.y + 2, 6, p.h - 4);
    ctx.fillRect(p.x + p.w/2 - 10, p.y + 2, 6, p.h - 4);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBalls() {
  balls.forEach(b => {
    // Trail
    b.trail.forEach((t, i) => {
      ctx.globalAlpha = (i / b.trail.length) * 0.4;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, b.r * (i / b.trail.length), 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = b.color;
    const grd = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.5, b.color);
    grd.addColorStop(1, 'rgba(0,150,200,0.5)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawPowerups() {
  powerups.forEach(p => {
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color + '22'; ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(p.x - 16, p.y - 10, 32, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.font = `bold ${10 * S()}px Exo 2, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x, p.y);
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

function drawLasers() {
  lasers.forEach(l => {
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffd700';
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y - 20); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  });
}

/* ----- UPDATE ----- */
function updatePaddle() {
  const s = S();
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) paddle.x -= paddle.speed * 2;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) paddle.x += paddle.speed * 2;
  // Mouse
  if (mouse.x > 0) paddle.x = mouse.x;
  const hw = paddle.w / 2;
  paddle.x = Math.max(hw + 2, Math.min(canvas.width - hw - 2, paddle.x));
  if (paddle.wide > 0) { paddle.w = Math.min(160 * s, paddle.w); paddle.wide--; } else { paddle.w += (100 * s - paddle.w) * 0.05; }
  if (paddle.laserTimer > 0) { paddle.laserTimer--; if (paddle.laserTimer % 30 === 0) shootLaser(); }
}

function shootLaser() {
  lasers.push({ x: paddle.x - paddle.w/2 + 4, y: paddle.y, vy: -12 });
  lasers.push({ x: paddle.x + paddle.w/2 - 4, y: paddle.y, vy: -12 });
}

function updateBalls() {
  balls.forEach(b => {
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 8) b.trail.shift();

    if (b.onPaddle) { b.x = paddle.x; b.y = paddle.y - b.r; return; }

    b.x += b.vx; b.y += b.vy;
    const maxSpd = 9 * S();
    const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
    if (spd > maxSpd) { b.vx = (b.vx/spd)*maxSpd; b.vy = (b.vy/spd)*maxSpd; }

    // Walls
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > canvas.width) { b.x = canvas.width - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }

    // Paddle collision
    if (b.vy > 0 && b.x > paddle.x - paddle.w/2 - b.r && b.x < paddle.x + paddle.w/2 + b.r && b.y + b.r > paddle.y && b.y - b.r < paddle.y + paddle.h) {
      b.y = paddle.y - b.r;
      const hitPos = (b.x - paddle.x) / (paddle.w / 2);
      b.vx = hitPos * 5 * S();
      b.vy = -Math.abs(b.vy);
      if (Math.abs(b.vy) < 3 * S()) b.vy = -3 * S();
      spawnParticles(b.x, b.y, '#00d4ff', 6);
    }

    // Fell off
    if (b.y > canvas.height + 20) b.dead = true;

    // Brick collision
    bricks.forEach(brick => {
      if (brick.destroyed) return;
      if (b.x + b.r > brick.x && b.x - b.r < brick.x + brick.w && b.y + b.r > brick.y && b.y - b.r < brick.y + brick.h) {
        const overlapLeft = b.x + b.r - brick.x;
        const overlapRight = brick.x + brick.w - (b.x - b.r);
        const overlapTop = b.y + b.r - brick.y;
        const overlapBot = brick.y + brick.h - (b.y - b.r);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBot);
        if (minOverlap === overlapLeft || minOverlap === overlapRight) b.vx *= -1;
        else b.vy *= -1;
        hitBrick(brick, b.x + b.r/2, b.y);
      }
    });
  });

  // Remove dead balls
  balls = balls.filter(b => !b.dead);
  if (balls.length === 0) loseLive();
}

function hitBrick(brick, bx, by) {
  if (brick.indestructible) { spawnParticles(bx, by, '#888', 4); return; }
  brick.hp--;
  spawnParticles(bx, by, brick.glow, 8);
  if (brick.hp <= 0) {
    brick.destroyed = true;
    G.score += brick.score;
    if (Math.random() < 0.18) spawnPowerup(brick.x + brick.w/2, brick.y + brick.h/2);
    spawnParticles(brick.x + brick.w/2, brick.y + brick.h/2, brick.fill, 16);
    updateHUD();
    if (bricks.filter(b => !b.destroyed && !b.indestructible).length === 0) levelClear();
  }
}

function updateLasers() {
  for (let i = lasers.length - 1; i >= 0; i--) {
    lasers[i].y += lasers[i].vy;
    if (lasers[i].y < -10) { lasers.splice(i, 1); continue; }
    for (let j = bricks.length - 1; j >= 0; j--) {
      const b = bricks[j];
      if (!b.destroyed && lasers[i] && lasers[i].x > b.x && lasers[i].x < b.x + b.w && lasers[i].y > b.y && lasers[i].y < b.y + b.h) {
        hitBrick(b, lasers[i].x, lasers[i].y);
        lasers.splice(i, 1); break;
      }
    }
  }
}

function updatePowerups() {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += 2 * S();
    if (p.y > canvas.height + 20) { powerups.splice(i, 1); continue; }
    if (p.x > paddle.x - paddle.w/2 - 16 && p.x < paddle.x + paddle.w/2 + 16 && p.y > paddle.y - 10 && p.y < paddle.y + paddle.h + 10) {
      applyPowerup(p);
      spawnParticles(p.x, p.y, p.color, 12);
      powerups.splice(i, 1);
    }
  }
}

function spawnPowerup(x, y) {
  const tmpl = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({ x, y, ...tmpl });
}

function applyPowerup(p) {
  const s = S();
  if (p.type === 'wide') { paddle.wide = 300; paddle.w = 160 * s; showLabel(paddle.x, paddle.y - 20, '+WIDE', p.color); }
  else if (p.type === 'multi') { const b = createBall(); b.vx = -b.vx; balls.push(b); showLabel(paddle.x, paddle.y - 20, '+BALL', p.color); }
  else if (p.type === 'slow') { balls.forEach(b => { b.vx *= 0.7; b.vy *= 0.7; }); showLabel(paddle.x, paddle.y - 20, 'SLOW!', p.color); }
  else if (p.type === 'life') { G.lives = Math.min(5, G.lives + 1); updateHUD(); showLabel(paddle.x, paddle.y - 20, '+LIFE!', p.color); }
  else if (p.type === 'laser') { paddle.laserTimer = 300; showLabel(paddle.x, paddle.y - 20, 'LASER!', p.color); }
}

function showLabel(x, y, text, color) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);color:${color};font-size:16px;font-weight:800;pointer-events:none;z-index:30;text-shadow:0 0 10px ${color}`;
  el.textContent = text;
  document.querySelector('.game-area').appendChild(el);
  let fy = y, op = 1;
  const anim = setInterval(() => { fy -= 1.5; op -= 0.04; el.style.top = fy + 'px'; el.style.opacity = op; if (op <= 0) { clearInterval(anim); el.remove(); } }, 30);
}

/* ----- PARTICLES ----- */
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = (i/count)*Math.PI*2, spd = 2+Math.random()*4;
    particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd, life:25+Math.random()*15, maxLife:40, color, r:2+Math.random()*3 });
  }
}

function drawParticles() {
  particles = particles.filter(p => p.life-- > 0);
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color; ctx.shadowBlur = 6; ctx.shadowColor = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.r *= 0.97;
  });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

/* ----- LIFECYCLE ----- */
function loseLive() {
  G.lives--;
  updateHUD();
  if (G.lives <= 0) { endGame(); return; }
  balls = [createBall(true)];
  screenShake();
}

function levelClear() {
  G.score += 500 * G.level;
  document.getElementById('winOverlay').classList.remove('hidden');
  document.getElementById('winScore').textContent = `Score: ${G.score.toLocaleString()} · Level ${G.level} cleared!`;
  G.running = false;
}

function endGame() {
  G.running = false; G.gameOver = true;
  document.getElementById('gameOverOverlay').classList.remove('hidden');
  document.getElementById('finalScore').textContent = `Score: ${G.score.toLocaleString()}`;
}

function screenShake() {
  const a = canvas.parentElement; let t = 0;
  const s = setInterval(() => { a.style.transform = `translate(${(Math.random()-0.5)*8}px,${(Math.random()-0.5)*8}px)`; if(++t>5){clearInterval(s);a.style.transform='';} }, 40);
}

function updateHUD() {
  document.getElementById('scoreDisplay').textContent = G.score.toLocaleString();
  document.getElementById('levelDisplay').textContent = G.level;
  document.getElementById('bricksDisplay').textContent = bricks.filter(b => !b.destroyed && !b.indestructible).length;
  const hearts = document.querySelectorAll('#livesDisplay .life-icon');
  hearts.forEach((h, i) => h.classList.toggle('empty', i >= G.lives));
}

/* ----- GAME LOOP ----- */
function gameLoop() {
  if (!G.running || G.paused) return;
  requestAnimationFrame(gameLoop);

  updatePaddle();
  updateBalls();
  updatePowerups();
  updateLasers();

  drawBackground();
  drawBricks();
  drawPowerups();
  drawLasers();
  drawParticles();
  drawBalls();
  drawPaddle();
  updateHUD();
}

function startGame(newLevel = false) {
  if (!newLevel) { G.score=0; G.lives=3; G.level=1; G.gameOver=false; }
  G.running = true; G.paused = false;
  reset();
  ['startOverlay','pauseOverlay','gameOverOverlay','winOverlay'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  updateHUD();
  requestAnimationFrame(gameLoop);
}

/* ----- CONTROLS ----- */
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if ((e.key === ' ' || e.key === 'Space') && G.running && !G.paused) {
    balls.forEach(b => { if (b.onPaddle) b.onPaddle = false; });
    e.preventDefault();
  }
  if (['ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left);
});

document.getElementById('startBtn')?.addEventListener('click', () => startGame());
document.getElementById('retryBtn')?.addEventListener('click', () => startGame());
document.getElementById('nextBtn')?.addEventListener('click', () => { G.level++; startGame(true); });
document.getElementById('resumeBtn')?.addEventListener('click', togglePause);
document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
document.getElementById('restartBtn')?.addEventListener('click', () => startGame());

function togglePause() {
  if (!G.running || G.gameOver) return;
  G.paused = !G.paused;
  document.getElementById('pauseOverlay')?.classList.toggle('hidden', !G.paused);
  document.getElementById('pauseBtn').textContent = G.paused ? '▶ Resume' : '⏸ Pause';
  if (!G.paused) requestAnimationFrame(gameLoop);
}
