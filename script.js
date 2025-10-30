// dreamy bubble animation
const canvas = document.getElementById("bubbles");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let bubbles = [];
const numBubbles = 60;

const colors = [
  "rgba(192, 132, 252, 0.25)", // soft lavender
  "rgba(139, 92, 246, 0.25)",  // violet
  "rgba(96, 165, 250, 0.25)",  // sky blue
  "rgba(236, 72, 153, 0.25)",  // rose
  "rgba(125, 211, 252, 0.25)"  // light cyan
];

class Bubble {
  constructor(x, y, radius, orbitRadius, orbitSpeed, angle, color) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.angle = angle;
    this.color = color;
    this.direction = Math.random() > 0.5 ? 1 : -1;
  }

  update() {
    this.angle += this.orbitSpeed * this.direction;
    this.x += Math.cos(this.angle) * this.orbitRadius * 0.02;
    this.y += Math.sin(this.angle) * this.orbitRadius * 0.02;

    // gentle vertical drift
    this.y += Math.sin(Date.now() * 0.0005) * 0.2;
  }

  draw() {
    const glow = ctx.createRadialGradient(this.x, this.y, this.radius * 0.2, this.x, this.y, this.radius);
    glow.addColorStop(0, this.color);
    glow.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function init() {
  bubbles = [];
  for (let i = 0; i < numBubbles; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 30 + 10;
    const orbitRadius = Math.random() * 80 + 20;
    const orbitSpeed = Math.random() * 0.01 + 0.002;
    const angle = Math.random() * Math.PI * 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    bubbles.push(new Bubble(x, y, radius, orbitRadius, orbitSpeed, angle, color));
  }
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // subtle parallax background drift
  const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGradient.addColorStop(0, "#1e1b4b");
  bgGradient.addColorStop(1, "#312e81");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let b of bubbles) {
    b.update();
    b.draw();
  }

  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  init();
});

init();
animate();
