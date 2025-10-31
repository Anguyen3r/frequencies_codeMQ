// app.js — Dream Bubbles cinematic intro

// --- Scene setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 120;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvasWrap').appendChild(renderer.domElement);

// --- Lighting ---
const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);
const point = new THREE.PointLight(0xffffff, 1);
camera.add(point);
scene.add(camera);

// --- Bubble group ---
const bubbles = new THREE.Group();
scene.add(bubbles);

const bubbleColors = [
  0x6cc6ff, 0xff66cc, 0xffd966, 0x9b6bff, 0x66ffb3, 0xff8c66
];

const bubbleCount = bubbleColors.length;
const radius = 60;

for (let i = 0; i < bubbleCount; i++) {
  const color = new THREE.Color(bubbleColors[i]);
  const geometry = new THREE.SphereGeometry(8, 64, 64);
  const material = new THREE.MeshPhysicalMaterial({
    color: color,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.5,
    emissive: color.clone().multiplyScalar(0.2)
  });
  const bubble = new THREE.Mesh(geometry, material);
  const angle = (i / bubbleCount) * Math.PI * 2;
  bubble.userData = {
    baseAngle: angle,
    speed: (Math.random() * 0.3 + 0.15) * (Math.random() > 0.5 ? 1 : -1)
  };
  bubbles.add(bubble);
}

// --- Stardust particles ---
const particlesGeometry = new THREE.BufferGeometry();
const particleCount = 1000;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i++) positions[i] = (Math.random() - 0.5) * 800;
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particlesMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 2,
  transparent: true,
  opacity: 0.7
});
const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// --- Aurora smoke ---
const smokeTextures = [];
for (let i = 0; i < 3; i++) {
  const texture = new THREE.TextureLoader().load(`https://threejs.org/examples/textures/sprites/smoke.png`);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.05 + Math.random() * 0.05,
    color: new THREE.Color(`hsl(${Math.random() * 360},50%,70%)`)
  });
  const geo = new THREE.PlaneGeometry(800, 800);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.z = -200 - i * 200;
  mesh.rotation.z = Math.random() * Math.PI;
  scene.add(mesh);
  smokeTextures.push(mesh);
}

// --- Animate ---
let t = 0;
function animate() {
  requestAnimationFrame(animate);

  t += 0.002;
  bubbles.children.forEach((bubble, i) => {
    const angle = bubble.userData.baseAngle + t * bubble.userData.speed;
    bubble.position.x = Math.cos(angle) * radius;
    bubble.position.y = Math.sin(angle * 0.7) * radius * 0.6;
    bubble.position.z = Math.sin(angle) * 20;
  });

  particles.rotation.y += 0.0005;
  smokeTextures.forEach((s, i) => {
    s.rotation.z += (i % 2 === 0 ? 1 : -1) * 0.0003;
  });

  renderer.render(scene, camera);
}
animate();

// --- Handle resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Fade + Sound Intro ---
const fadeOverlay = document.createElement('div');
fadeOverlay.style.position = 'fixed';
fadeOverlay.style.inset = '0';
fadeOverlay.style.background = 'rgba(0,0,0,0.95)';
fadeOverlay.style.transition = 'opacity 1.5s ease';
fadeOverlay.style.zIndex = '1000';
document.body.appendChild(fadeOverlay);

const audio = new Audio('https://soundcloud.com/user-200235414/wave-1'); // placeholder fallback
audio.volume = 0.6;

function playIntro() {
  if (!localStorage.getItem('hasVisitedDreamBubbles')) {
    localStorage.setItem('hasVisitedDreamBubbles', 'true');
    audio.play().catch(() => {}); // ignore autoplay errors
  }
}

window.addEventListener('load', () => {
  fadeOverlay.style.opacity = '0';
  setTimeout(() => fadeOverlay.remove(), 1500);
  setTimeout(playIntro, 200);
  setTimeout(() => {
    document.getElementById('ui').style.opacity = 1;
  }, 1800);
});
