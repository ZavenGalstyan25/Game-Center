/* ============================================================
   NEXUS GAMING CENTER — PARTICLE SYSTEM
   ============================================================ */

const ParticleSystem = (() => {
  let canvas, ctx, particles = [], animId, mouse = { x: -999, y: -999 };
  const CONFIG = {
    count: 80,
    maxDist: 120,
    speed: 0.4,
    radius: { min: 1, max: 2.5 },
    opacity: { min: 0.15, max: 0.6 },
    lineOpacity: 0.12,
    mouseInteract: true,
    mouseForce: 80,
  };

  function getColor() {
    const colors = ['#00d4ff', '#7c3aed', '#ec4899', '#10b981'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function createParticle() {
    const w = canvas.width, h = canvas.height;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * CONFIG.speed * 2,
      vy: (Math.random() - 0.5) * CONFIG.speed * 2,
      r: Math.random() * (CONFIG.radius.max - CONFIG.radius.min) + CONFIG.radius.min,
      opacity: Math.random() * (CONFIG.opacity.max - CONFIG.opacity.min) + CONFIG.opacity.min,
      color: getColor(),
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: (Math.random() * 0.02 + 0.008),
    };
  }

  function init() {
    canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    particles = Array.from({ length: CONFIG.count }, createParticle);
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    document.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
    loop();
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function loop() {
    animId = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    update();
    draw();
  }

  function update() {
    const w = canvas.width, h = canvas.height;
    particles.forEach(p => {
      p.pulse += p.pulseSpeed;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      p.x = Math.max(0, Math.min(w, p.x));
      p.y = Math.max(0, Math.min(h, p.y));

      if (CONFIG.mouseInteract) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.mouseForce) {
          const force = (CONFIG.mouseForce - dist) / CONFIG.mouseForce * 0.8;
          p.vx += (dx / dist) * force * 0.2;
          p.vy += (dy / dist) * force * 0.2;
          const maxV = CONFIG.speed * 4;
          p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
          p.vy = Math.max(-maxV, Math.min(maxV, p.vy));
        }
      }
      p.vx *= 0.995;
      p.vy *= 0.995;
      if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.1;
      if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.1;
    });
  }

  function draw() {
    particles.forEach((p, i) => {
      const pulseMod = 0.5 + Math.sin(p.pulse) * 0.5;
      const opacity = p.opacity * pulseMod;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.color, opacity);
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.maxDist) {
          const lineOpacity = CONFIG.lineOpacity * (1 - dist / CONFIG.maxDist);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = hexToRgba(p.color, lineOpacity);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    });
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function destroy() {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  }

  return { init, destroy };
})();
