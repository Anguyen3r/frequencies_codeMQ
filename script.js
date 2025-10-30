const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

class Bubble {
  constructor(x, y, r, color, orbitRadius, orbitSpeed, orbitAngle) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color;
    this.orbitRadius = orbitRadius;
    this.orbitSpeed = orbitSpeed;
    this.orbitAngle = orbitAngle;
  }
  
  update(centerX, centerY, rotationSpeed) {
    this.orbitAngle += this.orbitSpeed;
    const orbitX = centerX + Math.cos(this.orbitAngle) * this.orbitRadius;
    const orbitY = centerY + Math.sin(this.orbitAngle) * this.orbitRadius;
    this.x = orbitX;
    this.y = orbitY;
  }
  
  draw(ctx) {
    const gradient = ctx.createRadialGradient(this.x, this.y, this.r * 0.3, this.x, this.y, this.r);
    gradient.addColorStop(0, `rgba(${this.color},0.7)`);
    gradient.addColorStop(1, `rgba(${this.color},0.1)`);

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

const colors = [
  '255,255,255', // white
  '180,180,180',
  '200,200,200',
  '220,220,220',
  '160,160,160',
  '130,130,130'
];

const bubbles = [];
const numBubbles = 6;
const centerX = width / 2;
const centerY = height / 2;

for (let i = 0; i < numBubbles; i++) {
  const r = 80;
  const orbitRadius = 200 + i * 40;
  const orbitSpeed = 0.002 + Math.random() * 0.002;
  const orbitAngle = Math.random() * Math.PI * 2;
  bubbles.push(new Bubble(centerX, centerY, r, colors[i], orbitRadius, orbitSpeed, orbitAngle));
}

function animate() {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  
  // Gyroscope rotation effect
  ctx.translate(centerX, centerY);
  const time = Date.now() * 0.0001;
  ctx.rotate(time * 0.5);
  ctx.translate(-centerX, -centerY);
  
  bubbles.forEach(b => {
    b.update(centerX, centerY, time);
    b.draw(ctx);
  });

  ctx.restore();
  requestAnimationFrame(animate);
}

animate();
