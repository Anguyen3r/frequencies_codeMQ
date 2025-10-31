// app.js
// Pure JS combining: twinkling stars, nebula ribbons, 7 orbiting orbs with particle trails

(function () {
  // Helpers for DPR/resizing
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      // scale context for crisp drawing
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    return resize;
  }

  /* ---------------------------
     STARS CANVAS (twinkling)
     --------------------------- */
  const starsCanvas = document.getElementById("stars");
  const starsCtx = starsCanvas.getContext("2d");
  setupCanvas(starsCanvas);

  let stars = [];
  function initStars() {
    const count = Math.min(450, Math.floor((window.innerWidth * window.innerHeight) / 2000)); // density scaled
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.8 + 0.2,
        alpha: Math.random() * 0.9,
        blinkSpeed: Math.random() * 0.02 + 0.002,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  initStars();

  function drawStars(time) {
    starsCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // slight vignette darkening edges
    const g = starsCtx.createLinearGradient(0, 0, 0, window.innerHeight);
    g.addColorStop(0, "rgba(0,0,0,0.15)");
    g.addColorStop(1, "rgba(0,0,0,0.4)");
    starsCtx.fillStyle = g;
    starsCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    for (let s of stars) {
      s.phase += s.blinkSpeed;
      const a = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(s.phase)); // pulsate
      starsCtx.globalAlpha = a * s.alpha;
      starsCtx.beginPath();
      starsCtx.fillStyle = "#ffffff";
      starsCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      starsCtx.fill();
    }
    starsCtx.globalAlpha = 1;
  }

  /* ---------------------------
     NEBULA CANVAS (ribbons)
     (based on your NebulaWave)
     --------------------------- */
  const nebulaCanvas = document.getElementById("nebula");
  const nebCtx = nebulaCanvas.getContext("2d");
  setupCanvas(nebulaCanvas);

  const nebulaColors = [
    "rgba(128, 51, 255, 0.14)", // purple
    "rgba(255, 51, 120, 0.12)", // pink
    "rgba(255, 128, 0, 0.10)",  // orange
    "rgba(0, 210, 130, 0.10)",  // green
    "rgba(0, 180, 255, 0.10)",  // cyan
  ];

  let nebTime = 0;
  function drawNebula() {
    // subtle gradient backdrop
    nebCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const background = nebCtx.createLinearGradient(0, 0, 0, window.innerHeight);
    background.addColorStop(0, "rgba(2,2,10,0.55)");
    background.addColorStop(1, "rgba(10,5,20,0.65)");
    nebCtx.fillStyle = background;
    nebCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    nebulaColors.forEach((color, i) => {
      const amplitude = 120 + i * 40;
      const offset = (nebTime * 0.001 + i * 0.9) % (Math.PI * 2);
      nebCtx.beginPath();
      for (let y = -50; y <= window.innerHeight + 50; y += 6) {
        const x =
          window.innerWidth / 2 +
          Math.sin(y * 0.008 + offset) * amplitude * Math.sin(nebTime * 0.0006 + i * 0.4);
        if (y === -50) nebCtx.moveTo(x, y);
        else nebCtx.lineTo(x, y);
      }
      nebCtx.strokeStyle = color;
      nebCtx.lineWidth = 160 - i * 18;
      nebCtx.shadowColor = color;
      nebCtx.shadowBlur = 120;
      nebCtx.globalCompositeOperation = "lighter";
      nebCtx.stroke();
      nebCtx.globalCompositeOperation = "source-over";
      nebCtx.shadowBlur = 0;
    });

    nebTime += 1;
  }

  /* ---------------------------
     ORBS + TRAILS CANVAS
     --------------------------- */
  const orbsCanvas = document.getElementById("orbs");
  const orbsCtx = orbsCanvas.getContext("2d");
  setupCanvas(orbsCanvas);

  // Orb parameters
  const ORB_COUNT = 7;
  const center = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const baseOrbitRadius = () => Math.min(window.innerWidth, window.innerHeight) * 0.24; // main radius
  const orbs = [];

  // Colors for the seven orbs (match nebula-ish)
  const orbColors = [
    "rgba(102,51,255,0.95)",
    "rgba(255,51,102,0.95)",
    "rgba(255,128,0,0.95)",
    "rgba(0,255,150,0.95)",
    "rgba(255,0,80,0.95)",
    "rgba(128,0,255,0.95)",
    "rgba(0,200,255,0.95)",
  ];

  // Particle pool: each orb will have its own particle array with pooling
  function createOrbs() {
    orbs.length = 0;
    const c = center();
    const radius = baseOrbitRadius();
    for (let i = 0; i < ORB_COUNT; i++) {
      const angle = (i / ORB_COUNT) * Math.PI * 2;
      orbs.push({
        angle,
        speed: 0.0035 + Math.random() * 0.0016, // rad per frame (varies slightly)
        orbitRadius: radius + (Math.sin(i) * 30) + (Math.random() * 40 - 20),
        size: 18 + Math.random() * 14,
        color: orbColors[i % orbColors.length],
        trail: [], // particle list
        maxTrail: 80, // per orb
        hueShift: (i / ORB_COUNT) * 40,
      });
    }
  }
  createOrbs();

  // Particle spawn from orb position
  function spawnParticle(orb, x, y, vx, vy) {
    if (orb.trail.length >= orb.maxTrail) {
      // reuse oldest particle
      orb.trail.shift();
    }
    orb.trail.push({
      x,
      y,
      vx,
      vy,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.02,
      size: Math.random() * 3 + 0.6,
      alpha: 0.85 * (0.5 + Math.random() * 0.5),
    });
  }

  function updateAndDrawOrbs(t) {
    orbsCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const c = center();
    // draw faint central glow (subtle)
    orbsCtx.beginPath();
    const cg = orbsCtx.createRadialGradient(c.x, c.y, 10, c.x, c.y, baseOrbitRadius()*1.1);
    cg.addColorStop(0, "rgba(255,255,255,0.02)");
    cg.addColorStop(1, "rgba(0,0,0,0.2)");
    orbsCtx.fillStyle = cg;
    orbsCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // For each orb: update position, spawn particles, draw trail
    orbs.forEach((orb, i) => {
      orb.angle += orb.speed * (1 + 0.05 * Math.sin(t * 0.001 + i)); // slight modulation
      const ox = c.x + Math.cos(orb.angle) * orb.orbitRadius;
      const oy = c.y + Math.sin(orb.angle) * orb.orbitRadius;

      // spawn a small number of particles per tick
      const numSpawn = 1; // controls trail density
      for (let s = 0; s < numSpawn; s++) {
        const spread = 0.6 + Math.random() * 1.4;
        const vx = (Math.cos(orb.angle + Math.PI/2) * 0.18 + (Math.random()-0.5)*0.18) * spread;
        const vy = (Math.sin(orb.angle + Math.PI/2) * 0.18 + (Math.random()-0.5)*0.18) * spread;
        spawnParticle(orb, ox, oy, vx, vy);
      }

      // update particles
      for (let p = orb.trail.length - 1; p >= 0; p--) {
        const part = orb.trail[p];
        // physics-ish
        part.vx *= 0.985;
        part.vy *= 0.985;
        part.x += part.vx * (1 + Math.random()*0.3);
        part.y += part.vy * (1 + Math.random()*0.3);
        part.life -= part.decay;
        part.size *= 0.997;

        // remove dead
        if (part.life <= 0 || part.size < 0.2) {
          orb.trail.splice(p, 1);
        }
      }

      // draw faint stardust trail for this orb
      for (let pi = 0; pi < orb.trail.length; pi++) {
        const p = orb.trail[pi];
        const alpha = p.alpha * Math.max(0, p.life);
        orbsCtx.globalAlpha = alpha * 0.9;
        // glow
        orbsCtx.beginPath();
        orbsCtx.fillStyle = orb.color;
        orbsCtx.shadowColor = orb.color;
        orbsCtx.shadowBlur = 12;
        orbsCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        orbsCtx.fill();
      }
      orbsCtx.shadowBlur = 0;
      orbsCtx.globalAlpha = 1;

      // draw orb as soft glowing circle
      orbsCtx.beginPath();
      orbsCtx.shadowColor = orb.color;
      orbsCtx.shadowBlur = 30;
      const gradient = orbsCtx.createRadialGradient(ox, oy, 0, ox, oy, orb.size*2.4);
      gradient.addColorStop(0, orb.color.replace(/rgba\((.*?),.*\)/, "rgba($1,1)")); // ensure color has alpha 1 for gradient stops
      gradient.addColorStop(0.4, orb.color.replace(/rgba\((.*?),.*\)/, "rgba($1,0.35)"));
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      orbsCtx.fillStyle = gradient;
      orbsCtx.globalCompositeOperation = "lighter";
      orbsCtx.arc(ox, oy, orb.size * 2.6, 0, Math.PI * 2);
      orbsCtx.fill();
      orbsCtx.globalCompositeOperation = "source-over";
      orbsCtx.shadowBlur = 0;

      // small crisp center dot
      orbsCtx.beginPath();
      orbsCtx.fillStyle = "#fff";
      orbsCtx.globalAlpha = 0.92;
      orbsCtx.arc(ox, oy, Math.max(1, orb.size*0.22), 0, Math.PI * 2);
      orbsCtx.fill();
      orbsCtx.globalAlpha = 1;
    });

    // optionally: draw faint orbit paths (very subtle)
    orbsCtx.beginPath();
    orbsCtx.strokeStyle = "rgba(255,255,255,0.02)";
    orbs.forEach((orb, i) => {
      const r = orb.orbitRadius;
      orbsCtx.moveTo(center().x + r, center().y);
      // only draw circle outline once (we'll use arc)
    });
    // single faint global ring
    orbsCtx.beginPath();
    orbsCtx.strokeStyle = "rgba(255,255,255,0.02)";
    orbsCtx.lineWidth = 1;
    orbsCtx.arc(center().x, center().y, baseOrbitRadius(), 0, Math.PI * 2);
    orbsCtx.stroke();
  }

  /* ---------------------------
     Animate everything
     --------------------------- */
  let last = performance.now();
  function animate(now) {
    const t = now;
    const dt = now - last;
    last = now;

    drawStars(t);
    drawNebula();
    updateAndDrawOrbs(t);

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // handle resize recreations
  window.addEventListener("resize", () => {
    initStars();
    createOrbs();
  });

  // small optimization: pause animation on hidden tab
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // reduce updates: stop anim loop by not doing anything (not necessary here)
    } else {
      last = performance.now();
    }
  });

})();