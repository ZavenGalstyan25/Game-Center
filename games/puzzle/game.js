/* ============================================================
   2048 NEON — GAME LOGIC
   ============================================================ */

(function() {
  const bar=document.getElementById('load-bar'),screen=document.getElementById('loading-screen');
  let p=0;const t=setInterval(()=>{p+=Math.random()*20+10;bar.style.width=Math.min(p,95)+'%';if(p>=95){clearInterval(t);setTimeout(()=>{bar.style.width='100%';setTimeout(()=>screen.classList.add('hide'),400)},300);}},120);
})();

// Tile color/style config
const TILE_STYLES = {
  0:    { bg:'rgba(255,255,255,0.04)', color:'transparent', glow:'none', fontSize:'28px' },
  2:    { bg:'#0d1a2d', color:'#7fdbff', glow:'rgba(127,219,255,0.3)', border:'#1a3a5a', fontSize:'28px' },
  4:    { bg:'#0d2040', color:'#00d4ff', glow:'rgba(0,212,255,0.35)', border:'#1a4060', fontSize:'28px' },
  8:    { bg:'#1a1a50', color:'#6366f1', glow:'rgba(99,102,241,0.4)', border:'#2a2a80', fontSize:'28px' },
  16:   { bg:'#2a1060', color:'#a855f7', glow:'rgba(168,85,247,0.4)', border:'#4a2080', fontSize:'26px' },
  32:   { bg:'#3d0060', color:'#c084fc', glow:'rgba(192,132,252,0.45)', border:'#6a0090', fontSize:'26px' },
  64:   { bg:'#600050', color:'#e879f9', glow:'rgba(232,121,249,0.5)', border:'#900080', fontSize:'26px' },
  128:  { bg:'#700030', color:'#fb7185', glow:'rgba(251,113,133,0.5)', border:'#a00050', fontSize:'24px' },
  256:  { bg:'#702000', color:'#f97316', glow:'rgba(249,115,22,0.5)', border:'#a03000', fontSize:'24px' },
  512:  { bg:'#604000', color:'#fbbf24', glow:'rgba(251,191,36,0.55)', border:'#906000', fontSize:'24px' },
  1024: { bg:'#304000', color:'#a3e635', glow:'rgba(163,230,53,0.55)', border:'#507000', fontSize:'20px' },
  2048: { bg:'#004040', color:'#2dd4bf', glow:'rgba(45,212,191,0.7)', border:'#008080', fontSize:'20px' },
};

function getStyle(val) {
  if (TILE_STYLES[val]) return TILE_STYLES[val];
  return { bg:'#200000', color:'#ff0000', glow:'rgba(255,0,0,0.7)', border:'#600000', fontSize:'18px' };
}

const GRID_SIZE = 4;
let board, score, bestScore, moved, won, over, keepPlaying;

function createBoard() {
  board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function addTile() {
  const empties = [];
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (!board[r][c]) empties.push([r, c]);
  if (!empties.length) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
  animateNewTile(r, c);
}

function animateNewTile(r, c) {
  const idx = r * GRID_SIZE + c;
  const cell = document.querySelectorAll('.cell')[idx];
  if (!cell) return;
  cell.style.transform = 'scale(0)';
  cell.style.transition = 'transform 0.15s ease';
  setTimeout(() => { cell.style.transform = 'scale(1)'; updateCellDisplay(r, c); }, 50);
}

/* ----- MOVES ----- */
function slide(row) {
  let arr = row.filter(v => v);
  let newArr = []; let merged = false; let pts = 0;
  for (let i = 0; i < arr.length; i++) {
    if (!merged && arr[i + 1] && arr[i] === arr[i + 1]) {
      const val = arr[i] * 2;
      newArr.push(val); pts += val; i++; merged = false;
    } else newArr.push(arr[i]);
  }
  while (newArr.length < GRID_SIZE) newArr.push(0);
  return { row: newArr, score: pts, changed: JSON.stringify(row) !== JSON.stringify(newArr) };
}

function moveLeft() {
  let change = false; let pts = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    const { row, score: s, changed } = slide(board[r]);
    board[r] = row; if (changed) { change = true; pts += s; }
  }
  return { change, pts };
}
function moveRight() {
  let change = false; let pts = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    const { row, score: s, changed } = slide([...board[r]].reverse());
    board[r] = row.reverse(); if (changed) { change = true; pts += s; }
  }
  return { change, pts };
}
function moveUp() {
  let change = false; let pts = 0;
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = board.map(r => r[c]);
    const { row, score: s, changed } = slide(col);
    row.forEach((v, r) => board[r][c] = v); if (changed) { change = true; pts += s; }
  }
  return { change, pts };
}
function moveDown() {
  let change = false; let pts = 0;
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = board.map(r => r[c]).reverse();
    const { row, score: s, changed } = slide(col);
    row.reverse().forEach((v, r) => board[r][c] = v); if (changed) { change = true; pts += s; }
  }
  return { change, pts };
}

function doMove(fn) {
  if (over && !keepPlaying) return;
  const { change, pts } = fn();
  if (change) {
    score += pts;
    if (score > bestScore) { bestScore = score; localStorage.setItem('nexus_2048_best', bestScore); }
    addTile();
    render();
    checkWin();
    if (checkLose()) showLose();
  }
}

function checkWin() {
  if (keepPlaying) return;
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
    if (board[r][c] === 2048) { won = true; showWin(); return; }
  }
}

function checkLose() {
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
    if (!board[r][c]) return false;
    if (r < GRID_SIZE - 1 && board[r][c] === board[r+1][c]) return false;
    if (c < GRID_SIZE - 1 && board[r][c] === board[r][c+1]) return false;
  }
  return true;
}

/* ----- RENDER ----- */
function render() {
  document.getElementById('scoreDisplay').textContent = score.toLocaleString();
  document.getElementById('bestDisplay').textContent = bestScore.toLocaleString();
  for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) updateCellDisplay(r, c);
}

function updateCellDisplay(r, c) {
  const idx = r * GRID_SIZE + c;
  const cell = document.querySelectorAll('.cell')[idx];
  if (!cell) return;
  const val = board[r][c];
  const st = getStyle(val);
  cell.dataset.val = val;
  cell.textContent = val || '';
  cell.style.background = st.bg;
  cell.style.color = st.color;
  cell.style.fontSize = st.fontSize;
  cell.style.border = val ? `1px solid ${st.border || 'transparent'}` : '1px solid rgba(255,255,255,0.05)';
  if (val && st.glow !== 'none') {
    cell.style.boxShadow = `0 0 16px ${st.glow}, inset 0 0 12px rgba(0,0,0,0.3)`;
    cell.style.textShadow = `0 0 10px ${st.color}`;
  } else {
    cell.style.boxShadow = '';
    cell.style.textShadow = '';
  }
}

function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.val = '0';
    grid.appendChild(cell);
  }
}

/* ----- START / WIN / LOSE ----- */
function startGame() {
  createBoard();
  score = 0; won = false; over = false; keepPlaying = false;
  bestScore = parseInt(localStorage.getItem('nexus_2048_best') || '0');
  addTile(); addTile();
  render();
  ['startOverlay','winOverlay','loseOverlay'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
}

function showWin() {
  document.getElementById('winScore').textContent = `Score: ${score.toLocaleString()}`;
  document.getElementById('winOverlay').classList.remove('hidden');
}
function showLose() {
  over = true;
  document.getElementById('loseScore').textContent = `Score: ${score.toLocaleString()}`;
  document.getElementById('loseOverlay').classList.remove('hidden');
}

/* ----- CONTROLS ----- */
window.addEventListener('keydown', e => {
  const moves = { ArrowLeft: moveLeft, ArrowRight: moveRight, ArrowUp: moveUp, ArrowDown: moveDown, a: moveLeft, A: moveLeft, d: moveRight, D: moveRight, w: moveUp, W: moveUp, s: moveDown, S: moveDown };
  if (moves[e.key]) { doMove(moves[e.key]); e.preventDefault(); }
});

// Touch swipe
let touchStart = null;
document.getElementById('grid')?.addEventListener('touchstart', e => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
document.getElementById('grid')?.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  const absDx = Math.abs(dx), absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < 20) return;
  if (absDx > absDy) doMove(dx > 0 ? moveRight : moveLeft);
  else doMove(dy > 0 ? moveDown : moveUp);
  touchStart = null;
}, { passive: true });

document.getElementById('startBtn')?.addEventListener('click', startGame);
document.getElementById('newGameBtn')?.addEventListener('click', startGame);
document.getElementById('loseNewBtn')?.addEventListener('click', startGame);
document.getElementById('winNewBtn')?.addEventListener('click', startGame);
document.getElementById('keepBtn')?.addEventListener('click', () => {
  keepPlaying = true;
  document.getElementById('winOverlay').classList.add('hidden');
});

buildGrid();
document.getElementById('startOverlay').classList.remove('hidden');
bestScore = parseInt(localStorage.getItem('nexus_2048_best') || '0');
document.getElementById('bestDisplay').textContent = bestScore.toLocaleString();
