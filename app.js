// === Dream Bubbles — Main App.js ===

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// === Fade overlay control ===
const fadeOverlay = document.getElementById("fade-overlay");
setTimeout(() => {
  fadeOverlay.style.opacity = 0.6; // permanent soft black tint
}, 500);

// === Genre colors ===
const genreColors = {
  pop: 0xff7fcf,
  edm: 0x00ffff,
  hiphop: 0xffd700,
  indie: 0xadff2f,
  classical: 0xaaaaff,
  rock: 0xff6347,
  jazz: 0x8a2be2,
  experimental: 0xff69b4,
};

let currentGenre = 'pop';
let currentGenreColor = genreColors[currentGenre];

// === Light setup ===
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 2);
pointLight.position.set(0, 100, 200);
scene.add(pointLight);

// === Energy ribbon ===
const ribbonLength = 400;
const ribbonPoints = [];
for (let i = 0; i < 100; i++) ribbonPoints.push(new THREE.Vector3(i * 4 - ribbonLength / 2, Math.sin(i * 0.3) * 10, 0));

const ribbonGeometry = new THREE.BufferGeometry().setFromPoints(ribbonPoints);
const ribbonMaterial = new THREE.LineBasicMaterial({
  color: currentGenreColor,
  linewidth: 2,
  transparent: true,
  opacity: 0.9,
});
const ribbon = new THREE.Line(ribbonGeometry, ribbonMaterial);
scene.add(ribbon);

// === Bubble creation ===
const bubbles = [];
const bubbleGroup = new THREE.Group();
scene.add(bubbleGroup);

const genres = Object.keys(genreColors);
for (let i = 0; i < 15; i++) {
  const genre = genres[i % genres.length];
  const color = genreColors[genre];
  const size = Math.random() * 4 + 3;
  const geo = new THREE.SphereGeometry(size, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    Math.random() * 200 - 100,
    Math.random() * 100 - 50,
    Math.random() * 100 - 50
  );
  mesh.userData = { genre, speed: 0.001 + Math.random() * 0.002, direction: Math.random() > 0.5 ? 1 : -1 };
  bubbleGroup.add(mesh);
  bubbles.push(mesh);
}

// === Ribbon animation (energy wave) ===
let waveOffset = 0;
function updateRibbon() {
  const positions = ribbonGeometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    positions[i + 1] = Math.sin(x * 0.05 + waveOffset) * 10;
  }
  ribbonGeometry.attributes.position.needsUpdate = true;
  waveOffset += 0.04;
}

// === Bubble movement ===
function updateBubbles() {
  bubbles.forEach((bubble, i) => {
    const t = Date.now() * bubble.userData.speed * bubble.userData.direction;
    const radius = 60 + Math.sin(i + t * 0.002) * 10;
    bubble.position.x = Math.cos(t) * radius;
    bubble.position.y = Math.sin(t * 1.1) * 20;
    bubble.position.z = Math.sin(t * 0.8) * 40 + Math.cos(t * 0.5) * 10;

    // Z-forward slow drift
    bubble.position.z += 0.02 * bubble.userData.direction;

    // Reactive shimmer tint (will link to audio later)
    const intensity = 0.3 + 0.2 * Math.sin(t * 2.5);
    bubble.material.emissiveIntensity = intensity;
  });
}

// === UI tint system (ready for audio integration) ===
function updateUITint() {
  const ui = document.getElementById("ui");
  const playlist = document.getElementById("playlistPanel");
  const color = new THREE.Color(currentGenreColor);
  const tint = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 0.2)`;
  ui.style.background = `linear-gradient(145deg, ${tint}, transparent)`;
  playlist.style.borderColor = tint;
}
updateUITint();

// === Animation loop ===
function animate() {
  requestAnimationFrame(animate);
  updateRibbon();
  updateBubbles();
  renderer.render(scene, camera);
}
animate();

// === Responsive resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
