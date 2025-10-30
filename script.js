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

const colors = ["#8b5cf6", "#6366f1", "#14b8a6", "#f472b6", "#eab308", "#60a5fa"];

const mainBubbles = [];
const smallBubbles = [];

for (let i = 0; i < 6; i++) {
  const radius = 70 + Math.random() * 40;
  mainBubbles.push({
    radius,
    angle: Math.random() * Math.PI * 2,
    orbit: 100 + i * 60,
    color: colors[i],
    speed: 0.002 + Math.random() * 0.001,
  });
}

for (let i = 0; i < 200; i++) {
  smallBubbles.push({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2,
    speedX: (Math.random() - 0.5) * 0.2,
    speedY: (Math.random() - 0.5) * 0.2,
    alpha: Math.random(),
  });
}

let time = 0;

function drawNebula(t) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    100 + Math.sin(t / 200) * 50,
    width / 2,
    height / 2,
    Math.max(width, height) / 1.2
  );
  gradient.addColorStop(0, "rgba(76,0,130,0.3)");
  gradient.addColorStop(0.5, "rgba(10,10,60,0.3)");
  gradient.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function animate() {
  time += 1;
  drawNebula(time);

  // Draw small background bubbles
  smallBubbles.forEach((b) => {
    b.x += b.speedX;
    b.y += b.speedY;
    if (b.x < 0) b.x = width;
    if (b.x > width) b.x = 0;
    if (b.y < 0) b.y = height;
    if (b.y > height) b.y = 0;

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${b.alpha})`;
    ctx.fill();
  });

  // Draw main glowing orbs
  mainBubbles.forEach((b, i) => {
    const cx = width / 2 + Math.cos(b.angle) * b.orbit;
    const cy = height / 2 + Math.sin(b.angle) * b.orbit;

    b.angle += b.speed * (i % 2 === 0 ? 1 : -1);

    const glow = ctx.createRadialGradient(cx, cy, b.radius * 0.2, cx, cy, b.radius);
    glow.addColorStop(0, b.color + "88");
    glow.addColorStop(1, "transparent");

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, b.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(animate);
}
animate();

// Load Spotify or SoundCloud embeds
document.getElementById("loadPlayer").addEventListener("click", () => {
  const input = document.getElementById("spotifyInput").value.trim();
  const container = document.getElementById("musicEmbed");
  container.innerHTML = "";

  if (!input) return;

  if (input.includes("spotify")) {
    container.innerHTML = `<iframe src="${input}" width="100%" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
  } else if (input.includes("soundcloud")) {
    container.innerHTML = `<iframe width="100%" height="380" scrolling="no" frameborder="no" allow="autoplay" src="${input}"></iframe>`;
  } else {
    container.innerHTML = `<p style="color:#aaa;">Unsupported link. Please paste a valid Spotify or SoundCloud embed.</p>`;
  }
});
