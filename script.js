// Minimal, robust orb system (2D canvas). Should always render six big orbs + dust aura.

const canvas = document.getElementById("bubbles");
const ctx = canvas.getContext("2d");

let W = 0, H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// Configuration: six main orbs (colors chosen to be "off-tones" and harmonious)
const GENRES = [
  { id: "techno", label: "Hard / Techno", color: "#9b7cff" },  // lilac
  { id: "house",  label: "House",        color: "#60a5fa" },  // blue
  { id: "dnb",    label: "Drum & Bass", color: "#14b8a6" },  // teal
  { id: "dub",    label: "Dubstep",      color: "#f472b6" }, // pink
  { id: "elect",  label: "Electronic",   color: "#fbbf24" }, // gold
  { id: "main",   label: "Mainstream",   color: "#c084fc" }  // soft purple
];

// central orbit settings
const CENTER = { x: () => W/2, y: () => H/2 };
const ORBIT_BASE = Math.min(W, H) * 0.18;
const ORB_BASE_RADIUS = Math.max(48, Math.min(W, H) * 0.09);

// particle dust settings (per orb)
const DUST_PER_ORB = 140;

// create orbs
const orbs = GENRES.map((g, i) => {
  const orbit = ORBIT_BASE + i * (ORB_BASE_RADIUS * 0.16);
  const radius = ORB_BASE_RADIUS * (1 - i*0.04);
  const angle = (i / GENRES.length) * Math.PI*2 + Math.random()*0.2;
  const speed = (0.0009 + Math.random()*0.0011) * (i%2===0?1:-1);
  // dust cloud for this orb
  const dust = new Array(DUST_PER_ORB).fill(0).map(() => ({
    // local polar coords around orb center
    r: (Math.random()*0.8 + 0.7) * radius * (0.9 + Math.random()*0.6),
    theta: Math.random() * Math.PI * 2,
    speed: (0.0004 + Math.random()*0.001) * (Math.random() < 0.5 ? 1 : -1),
    drift: (Math.random() - 0.5) * 0.3,
    size: Math.random()*1.6 + 0.5,
    alpha: 0.08 + Math.random()*0.25
  }));
  return { genre: g, orbit, radius, angle, speed, dust };
});

// helper: hex to rgba with alpha
function hexToRgba(hex, a=1){
  const c = hex.replace("#","");
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// nebula background rendering (soft gradient + slow color shift)
let nebPhase = 0;
function drawNebula(now){
  nebPhase += 0.0006;
  const g = ctx.createLinearGradient(0, 0, W, H);
  // animated offsets for stops to give slow flow
  const stopA = 0.0;
  const stopB = 0.45 + Math.sin(nebPhase)*0.08;
  const stopC = 1.0;
  g.addColorStop(stopA, "rgba(6,6,12,1)");
  g.addColorStop(stopB, "rgba(22,12,40,0.95)");
  g.addColorStop(stopC, "rgba(2,2,6,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

// main render
function render(now){
  drawNebula(now);

  // For each orb: compute center and draw aura, dust, core
  orbs.forEach((o, idx) => {
    o.angle += o.speed * (now ? now/1000 : 1);

    const cx = CENTER.x() + Math.cos(o.angle) * o.orbit;
    const cy = CENTER.y() + Math.sin(o.angle) * o.orbit * 0.7; // slight ellipse

    // aura (big diffused glow)
    const auraR = o.radius * 2.2;
    const aura = ctx.createRadialGradient(cx, cy, o.radius*0.1, cx, cy, auraR);
    aura.addColorStop(0, hexToRgba(o.genre.color, 0.45));
    aura.addColorStop(0.35, hexToRgba(o.genre.color, 0.18));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI*2);
    ctx.fill();

    // dust particles orbiting around the orb
    o.dust.forEach(d => {
      d.theta += d.speed * (now ? now/1000 : 1) + d.drift * 0.001;
      const dx = Math.cos(d.theta) * d.r;
      const dy = Math.sin(d.theta) * d.r * 0.8;
      const px = cx + dx;
      const py = cy + dy;
      const s = d.size * (0.65 + 0.35 * Math.sin(now*0.002 + d.theta));
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.fillStyle = hexToRgba(o.genre.color, Math.max(0.03, d.alpha));
      ctx.arc(px, py, s, 0, Math.PI*2);
      ctx.fill();
    });

    // glossy core
    const coreGrad = ctx.createRadialGradient(cx - o.radius*0.18, cy - o.radius*0.12, 1, cx, cy, o.radius);
    coreGrad.addColorStop(0, "rgba(255,255,255,0.95)");
    coreGrad.addColorStop(0.18, hexToRgba(o.genre.color, 1));
    coreGrad.addColorStop(1, hexToRgba(o.genre.color, 0.7));
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = coreGrad;
    const coreSize = o.radius * (0.85 + 0.06 * Math.sin(now*0.003 + idx));
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI*2);
    ctx.fill();

    // slight rim to make edges readable
    ctx.strokeStyle = hexToRgba("#ffffff", 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, coreSize, 0, Math.PI*2);
    ctx.stroke();

    // store for click detection
    o._cx = cx;
    o._cy = cy;
    o._coreSize = coreSize;
  });

  requestAnimationFrame(render);
}

// kick off
requestAnimationFrame(render);

// click interaction (opens simple browser prompt for now)
canvas.addEventListener("pointerdown", (e) => {
  const x = e.clientX;
  const y = e.clientY;
  for (let i=0;i<orbs.length;i++){
    const o = orbs[i];
    const dx = x - o._cx;
    const dy = y - o._cy;
    if (Math.sqrt(dx*dx + dy*dy) <= o._coreSize * 0.95) {
      // anchor behavior — for now a simple prompt then localStorage save
      const artist = prompt(`(${o.genre.label}) — Who is your favorite artist?`);
      if (artist && artist.trim()) {
        const key = "codemq_votes_minimal";
        const raw = JSON.parse(localStorage.getItem(key) || "{}");
        raw[o.genre.id] = raw[o.genre.id] || [];
        raw[o.genre.id].push({ artist: artist.trim(), ts: Date.now() });
        localStorage.setItem(key, JSON.stringify(raw));
        alert("Saved locally — thanks!");
      }
      break;
    }
  }
});

// simple playlist embed handling (safe)
document.getElementById("loadPlaylist").addEventListener("click", () => {
  const url = (document.getElementById("playlistInput").value || "").trim();
  const container = document.getElementById("playlistEmbed");
  container.innerHTML = "";
  if (!url) return;
  if (url.includes("open.spotify.com")) {
    const embed = url.includes("/embed/") ? url : url.replace("open.spotify.com", "open.spotify.com/embed");
    container.innerHTML = `<iframe src="${embed}" frameborder="0" allow="encrypted-media" style="width:100%;height:360px;border-radius:8px"></iframe>`;
  } else if (url.includes("soundcloud.com")) {
    const uc = encodeURIComponent(url);
    const sc = `https://w.soundcloud.com/player/?url=${uc}&color=%23ff5500`;
    container.innerHTML = `<iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="${sc}" style="border-radius:8px"></iframe>`;
  } else {
    container.innerHTML = `<div style="color:#cfcfcf">Paste a Spotify or SoundCloud link (must be full open.spotify.com/... or soundcloud.com/...)</div>`;
  }
});
document.getElementById("clearPlaylist").addEventListener("click", ()=> {
  document.getElementById("playlistEmbed").innerHTML = "";
  document.getElementById("playlistInput").value = "";
});

// final sanity step: if canvas doesn't render, print a console message
setTimeout(()=> {
  if (!orbs[0] || !orbs[0]._cx) {
    console.error("Rendering didn't initialize — tell me the browser console output.");
  }
}, 1200);
