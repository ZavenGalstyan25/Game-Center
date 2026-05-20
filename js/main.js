/* ============================================================
   NEXUS GAMING CENTER — MAIN APPLICATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  ParticleSystem.init();
  App.init();
});

const App = (() => {

  // State
  let state = {
    category: 'all',
    search: '',
    sort: 'default',
    activeSection: 'all',
  };

  // Fake online counter
  let fakeOnline = 4200 + Math.floor(Math.random() * 800);

  function init() {
    renderFeaturedCarousel();
    renderTrending();
    renderRecentlyPlayed();
    renderGamesGrid();
    updateStats();
    startOnlineCounter();
    setupEventListeners();
    checkFirstVisitAchievements();
  }

  /* -------- RENDER FEATURED CAROUSEL -------- */
  function renderFeaturedCarousel() {
    const featured = GAMES.filter(g => g.featured);
    const carousel = document.getElementById('featured-carousel');
    const dotsEl = document.getElementById('carousel-dots');
    if (!carousel || !dotsEl) return;

    carousel.innerHTML = '';
    dotsEl.innerHTML = '';

    featured.forEach((game, i) => {
      const slide = document.createElement('div');
      slide.className = 'featured-slide' + (i === 0 ? ' active' : '');
      slide.innerHTML = `
        <div class="featured-bg" style="background: linear-gradient(135deg, ${game.color1}, ${game.color2})"></div>
        <div class="cover-icon-bg" style="position:absolute;right:5%;top:50%;transform:translateY(-50%);font-size:180px;opacity:0.15;pointer-events:none;user-select:none;filter:blur(2px)">${game.emoji}</div>
        <div class="cover-icon-main" style="position:absolute;right:8%;top:50%;transform:translateY(-50%);font-size:110px;filter:drop-shadow(0 0 30px ${game.accentColor});pointer-events:none;user-select:none">${game.emoji}</div>
        <div class="featured-gradient"></div>
        <div class="featured-content">
          <div class="featured-badge">✦ ${game.badge}</div>
          <h2 class="featured-title" style="color:var(--text-primary)">${game.title}</h2>
          <p class="featured-desc">${game.description}</p>
          <div class="featured-meta">
            <div class="featured-rating">
              <span class="featured-stars">★★★★★</span>
              <span style="font-size:14px;font-weight:700;color:var(--accent-gold)">${game.rating}</span>
            </div>
            <span style="font-size:12px;color:var(--text-muted)">👥 ${game.players} players</span>
            <span style="font-size:12px;color:var(--text-muted)">🎯 ${game.genre}</span>
          </div>
          <button class="featured-play-btn ripple-container" onclick="App.launchGame('${game.id}')">
            Play Now
          </button>
        </div>
      `;
      carousel.appendChild(slide);

      const dot = document.createElement('div');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goToSlide(i));
      dotsEl.appendChild(dot);
    });

    let current = 0;
    let autoTimer = setInterval(() => nextSlide(), 5000);

    function goToSlide(idx) {
      const slides = carousel.querySelectorAll('.featured-slide');
      const dots = dotsEl.querySelectorAll('.carousel-dot');
      slides[current].classList.remove('active');
      slides[current].classList.add('exit');
      setTimeout(() => slides[current].classList.remove('exit'), 600);
      current = idx;
      slides[current].classList.add('active');
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    }

    function nextSlide() { goToSlide((current + 1) % featured.length); }
    function prevSlide() { goToSlide((current - 1 + featured.length) % featured.length); }

    document.getElementById('carousel-next')?.addEventListener('click', () => { nextSlide(); clearInterval(autoTimer); autoTimer = setInterval(nextSlide, 5000); });
    document.getElementById('carousel-prev')?.addEventListener('click', () => { prevSlide(); clearInterval(autoTimer); autoTimer = setInterval(nextSlide, 5000); });
  }

  /* -------- RENDER GAMES GRID -------- */
  function renderGamesGrid() {
    const grid = document.getElementById('games-grid');
    const emptyEl = document.getElementById('empty-results');
    const countEl = document.getElementById('game-count');
    if (!grid) return;

    let games = GAMES.filter(g => {
      const matchesCategory = state.category === 'all' || g.category === state.category;
      const matchesSearch = !state.search || g.title.toLowerCase().includes(state.search.toLowerCase()) || g.genre.toLowerCase().includes(state.search.toLowerCase()) || g.tags.some(t => t.toLowerCase().includes(state.search.toLowerCase()));
      const matchesSection = state.activeSection === 'all' || state.activeSection === 'featured' && g.featured || state.activeSection === 'trending' && g.trending || state.activeSection === 'new' || state.activeSection === 'favorites' && Store.isFavorite(g.id);
      return matchesCategory && matchesSearch && matchesSection;
    });

    if (state.sort === 'rating') games = [...games].sort((a, b) => b.rating - a.rating);
    else if (state.sort === 'players') games = [...games].sort((a, b) => parseFloat(b.players) - parseFloat(a.players));

    grid.innerHTML = '';
    if (games.length === 0) {
      emptyEl && (emptyEl.style.display = 'block');
      countEl && (countEl.textContent = '0 games');
      return;
    }
    emptyEl && (emptyEl.style.display = 'none');
    countEl && (countEl.textContent = `${games.length} game${games.length !== 1 ? 's' : ''}`);

    games.forEach((game, i) => {
      const card = createGameCard(game, false);
      card.style.animationDelay = `${i * 0.07}s`;
      grid.appendChild(card);
    });
  }

  function renderTrending() {
    const el = document.getElementById('trending-scroll');
    if (!el) return;
    const trending = GAMES.filter(g => g.trending);
    el.innerHTML = '';
    trending.forEach(game => {
      const card = createGameCard(game, true);
      el.appendChild(card);
    });
  }

  function renderRecentlyPlayed() {
    const el = document.getElementById('recent-scroll');
    const emptyEl = document.getElementById('recent-empty');
    if (!el) return;
    const recent = Store.getRecentlyPlayed().map(id => GAMES.find(g => g.id === id)).filter(Boolean);
    if (recent.length === 0) {
      emptyEl && (emptyEl.style.display = 'block');
      return;
    }
    emptyEl && (emptyEl.style.display = 'none');
    recent.forEach(game => { el.appendChild(createGameCard(game, true)); });
  }

  /* -------- CREATE GAME CARD -------- */
  function createGameCard(game, small = false) {
    const card = document.createElement('div');
    card.className = small ? 'game-card game-card-sm' : 'game-card';
    card.style.setProperty('--card-glow', game.glowColor);

    const isFav = Store.isFavorite(game.id);
    const stars = '★'.repeat(Math.round(game.rating)) + '☆'.repeat(5 - Math.round(game.rating));

    card.innerHTML = `
      <div class="card-cover">
        <div class="cover-bg" style="background: linear-gradient(135deg, ${game.color1} 0%, ${game.color2} 100%)"></div>
        <div class="cover-emoji">${game.emoji}</div>
        <div class="cover-overlay"></div>
        <div class="card-genre-badge">${game.genre}</div>
        <button class="card-fav-btn ${isFav ? 'active' : ''}" data-id="${game.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
          ${isFav ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-title">${game.title}</div>
        <div class="card-desc">${game.description}</div>
        <div class="card-meta">
          <span class="card-rating">${game.rating}</span>
          <span class="card-players">${game.players}</span>
        </div>
        <div class="card-tags">
          ${game.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="card-footer">
        <button class="play-btn" data-id="${game.id}"><span>▶ Play Now</span></button>
      </div>
    `;

    card.querySelector('.play-btn').addEventListener('click', e => { e.stopPropagation(); launchGame(game.id); });
    card.querySelector('.card-fav-btn').addEventListener('click', e => { e.stopPropagation(); toggleFav(game.id, e.currentTarget); });
    card.addEventListener('click', () => launchGame(game.id));

    addRippleEffect(card.querySelector('.play-btn'));

    return card;
  }

  /* -------- LAUNCH GAME -------- */
  function launchGame(id) {
    const game = GAMES.find(g => g.id === id);
    if (!game) return;
    Store.addRecentlyPlayed(id);
    updateStats();
    checkAchievements();
    window.location.href = game.path;
  }

  /* -------- FAVORITES -------- */
  function toggleFav(id, btn) {
    const added = Store.toggleFavorite(id);
    btn.innerHTML = added ? '❤️' : '🤍';
    btn.classList.toggle('active', added);
    if (added) {
      showNotification('❤️ Added to Favorites', `${GAMES.find(g => g.id === id)?.title} saved!`);
      checkAchievements();
    }
    updateStats();
    if (state.activeSection === 'favorites') renderGamesGrid();
  }

  /* -------- STATS -------- */
  function updateStats() {
    const stats = Store.getStats();
    const el = n => document.getElementById(n);
    el('stat-played') && (el('stat-played').textContent = stats.played);
    el('stat-favorites') && (el('stat-favorites').textContent = stats.favorites);
    el('stat-achievements') && (el('stat-achievements').textContent = stats.achievements);
  }

  /* -------- ONLINE COUNTER -------- */
  function startOnlineCounter() {
    function update() {
      fakeOnline += Math.floor((Math.random() - 0.45) * 40);
      fakeOnline = Math.max(3000, Math.min(6000, fakeOnline));
      const str = fakeOnline.toLocaleString();
      ['online-count', 'qs-online'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = str;
      });
    }
    update();
    setInterval(update, 3500);
  }

  /* -------- ACHIEVEMENTS -------- */
  function checkFirstVisitAchievements() {
    if (Store.unlockAchievement('first_login')) showAchievement('first_login');
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5 && Store.unlockAchievement('night_owl')) showAchievement('night_owl');
  }

  function checkAchievements() {
    const recent = Store.getRecentlyPlayed();
    if (recent.length >= 3 && Store.unlockAchievement('play_3')) showAchievement('play_3');
    if (recent.length >= GAMES.length && Store.unlockAchievement('play_all')) showAchievement('play_all');
    if (Store.getFavorites().length >= 1 && Store.unlockAchievement('first_fav')) showAchievement('first_fav');
    updateStats();
  }

  function showAchievement(id) {
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    const toast = document.getElementById('achievement-toast');
    const nameEl = document.getElementById('achievement-name');
    if (!toast || !nameEl) return;
    nameEl.textContent = ach.name;
    toast.querySelector('.achievement-icon').textContent = ach.icon;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
    addNotification(`${ach.icon} Achievement Unlocked: ${ach.name}`, ach.desc);
  }

  /* -------- NOTIFICATIONS -------- */
  function showNotification(title, message) {
    addNotification(title, message);
    const badge = document.getElementById('notif-badge');
    if (badge) badge.textContent = parseInt(badge.textContent || '0') + 1;
  }

  function addNotification(title, message) {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = 'notif-item unread';
    item.innerHTML = `
      <span class="notif-dot"></span>
      <div class="notif-content">
        <strong>${title}</strong>
        <span>${message}</span>
        <time>Just now</time>
      </div>
    `;
    list.prepend(item);
  }

  /* -------- EVENT LISTENERS -------- */
  function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);

    // Search
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    searchInput?.addEventListener('input', e => {
      state.search = e.target.value;
      searchClear?.classList.toggle('visible', !!e.target.value);
      renderGamesGrid();
    });
    searchClear?.addEventListener('click', () => {
      searchInput.value = '';
      state.search = '';
      searchClear.classList.remove('visible');
      renderGamesGrid();
    });

    // Category buttons
    document.getElementById('categories-list')?.addEventListener('click', e => {
      const btn = e.target.closest('.category-btn');
      if (!btn) return;
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.category = btn.dataset.category;
      renderGamesGrid();
    });

    // Nav buttons
    document.querySelector('.main-nav')?.addEventListener('click', e => {
      const btn = e.target.closest('.nav-btn');
      if (!btn) return;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSection = btn.dataset.section;
      renderGamesGrid();
    });

    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.sort = btn.dataset.sort;
        renderGamesGrid();
      });
    });

    // Theme switcher
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.body.className = btn.dataset.theme;
      });
    });

    // Notifications
    document.getElementById('notif-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('notifications-panel')?.classList.toggle('open');
      document.getElementById('overlay')?.classList.add('visible');
      document.getElementById('notif-badge') && (document.getElementById('notif-badge').textContent = '0');
    });
    document.getElementById('notif-clear')?.addEventListener('click', () => {
      const list = document.getElementById('notif-list');
      if (list) list.innerHTML = '<div class="notif-item"><div class="notif-content"><span>No notifications</span></div></div>';
    });

    // User Profile
    document.getElementById('user-profile-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('profile-panel')?.classList.toggle('open');
    });

    // Overlay
    document.getElementById('overlay')?.addEventListener('click', () => {
      document.getElementById('notifications-panel')?.classList.remove('open');
      document.getElementById('profile-panel')?.classList.remove('open');
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('overlay')?.classList.remove('visible');
    });
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const isMobile = window.innerWidth <= 1100;
    if (isMobile) {
      sidebar.classList.toggle('open');
      document.getElementById('overlay')?.classList.toggle('visible', sidebar.classList.contains('open'));
    } else {
      sidebar.classList.toggle('collapsed');
    }
  }

  /* -------- RIPPLE EFFECT -------- */
  function addRippleEffect(el) {
    if (!el) return;
    el.addEventListener('click', function(e) {
      const r = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      const size = Math.max(r.width, r.height) * 2;
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  return { init, launchGame };
})();
