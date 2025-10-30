const canvas = document.getElementById("bubbles");
const ctx = canvas.getContext("2d");

let width, height;
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener("resize", resize);
resize();

// genre colors + glow colors
const genres = [
  { name: "Hard/Techno", color: "#8b5cf6" },   // violet
  { name: "House", color: "#60a5fa" },         // blue
  { name: "Drum & Bass", color: "#14b8a6" },   // teal
  { name: "Dubstep", color: "#f472b6" },       // pink
  { name: "Electronic", color: "#eab308" },    // yellow
  { name: "Mainstream", color: "#c084fc" }     // lilac
];

// 6 main glowing orbs
const mainBubbles = genres.map((g, i) => ({
  color: g.color,
  radius: 90,
  orbit: 180 + i * 60,
  angle: Math.random() * Math.PI * 2,
  speed: 0.002 + Math.random() * 0.001,
  pulse: 0
}));

// subtle background stars
const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.5,
    alpha: Math.random() * 0.5 + 0.3,
    speed: (Math.random() - 0.5) * 0.05,
  });
}

// animate
function drawNebula(t) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    100 + Math.sin(t / 400) * 60,
    width / 2,
    height / 2,
    Math.max(width, height) / 1.2
  );
  gradient.addColorStop(0, "rgba(40,10,80,0.5)");
  gradient.addColorStop(0.4, "rgba(15,10,40,0.6)");
  gradient.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function animate(t) {
  ctx.clearRect(0, 0, width, height);
  drawNebula(t);

  // background stars
  stars.forEach((s) => {
    s.x += s.speed;
    if (s.x < 0) s.x = width;
    if (s.x > width) s.x = 0;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fill();
  });

  // main orbs
  mainBubbles.forEach((b, i) => {
    const cx = width / 2 + Math.cos(b.angle) * b.orbit;
    const cy = height / 2 + Math.sin(b.angle) * b.orbit;

    // animate rotation
    b.angle += b.speed * (i % 2 === 0 ? 1 : -1);

    // pulsating aura
    b.pulse = Math.sin(t / 500 + i) * 0.5 + 0.5;

    // glowing aura
    const aura = ctx.createRadialGradient(cx, cy, b.radius * 0.4, cx, cy, b.radius * 1.3);
    aura.addColorStop(0, b.color + "aa");
    aura.addColorStop(1, "transparent");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, b.radius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // solid bubble core
    const coreGradient = ctx.createRadialGradient(cx, cy, b.radius * 0.3, cx, cy, b.radius);
    coreGradient.addColorStop(0, "#fff");
    coreGradient.addColorStop(0.2, b.color);
    coreGradient.addColorStop(1, b.color + "66");
    ctx.fillStyle = coreGradient;

    ctx.beginPath();
    ctx.arc(cx, cy, b.radius * (0.9 + b.pulse * 0.05), 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// load Spotify / SoundCloud player
document.getElementById("loadPlayer").addEventListener("click", () => {
  const input = document.getElementById("spotifyInput").value.trim();
  const container = document.getElementById("musicEmbed");
  container.innerHTML = "";

  if (!input) return;

  if (input.includes("spotify")) {
    container.innerHTML = `<iframe src="${input}" width="100%" height="380" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"></iframe>`;
  } else if (input.includes("soundcloud")) {
    container.innerHTML = `<iframe width="100%" height="380" scrolling="no" frameborder="no" allow="autoplay" src="${input}"></iframe>`;
  } else {
    container.innerHTML = `<p style="color:#aaa;">Unsupported link. Please paste a valid Spotify or SoundCloud embed.</p>`;
  }
});
