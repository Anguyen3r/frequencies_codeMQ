const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

// Bubble class
class Bubble {
  constructor(radius, color, orbitRadius, orbitSpeed, orbitAngle) {
    this.radius = radius;
    this.color = color;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.orbitAngle = orbitAngle;
  }

  update(centerX, centerY) {
    this.orbitAngle += this.orbitSpeed;
    this.x = centerX + Math.cos(this.orbitAngle) * this.orbitRadius;
    this.y = centerY + Math.sin(this.orbitAngle) * this.orbitRadius;
  }

  draw(ctx) {
    const gradient = ctx.createRadialGradient(this.x, this.y, this.radius * 0.2, this.x, this.y, this.radius);
    gradient.addColorStop(0, `rgba(${this.color},0.9)`);
    gradient.addColorStop(0.6, `rgba(${this.color},0.4)`);
    gradient.addColorStop(1, `rgba(${this.color},0.05)`);

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

const bubbles = [];
const colors = [
  '255,255,255',
  '200,200,200',
  '180,180,180',
  '160,160,160',
  '140,140,140',
  '120,120,120'
];

const numBubbles = 6;
const centerX = width / 2;
const centerY = height / 2;

for (let i = 0; i < numBubbles; i++) {
  const radius = 100;
  const orbitRadius = 150 + i * 40;
  const orbitSpeed = 0.001 + Math.random() * 0.002;
  const orbitAngle = Math.random() * Math.PI * 2;
  bubbles.push(new Bubble(radius, colors[i], orbitRadius, orbitSpeed, orbitAngle));
}

function animate() {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  // Subtle gyroscope motion
  const time = Date.now() * 0.0001;
  const globalRotation = Math.sin(time) * 0.5;
  ctx.translate(centerX, centerY);
  ctx.rotate(globalRotation);
  ctx.translate(-centerX, -centerY);

  bubbles.forEach(b => {
    b.update(centerX, centerY);
    b.draw(ctx);
  });

  ctx.restore();
  requestAnimationFrame(animate);
}

animate();
