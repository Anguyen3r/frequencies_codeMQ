// --- SETUP SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 25;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvasContainer').appendChild(renderer.domElement);

// --- LIGHTING ---
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

// --- GENRE COLORS ---
const genres = [
  { color: 0xff0080 }, // Hard/Techno
  { color: 0xffd700 }, // House
  { color: 0x00ffff }, // Drum & Bass
  { color: 0x9933ff }, // Dubstep
  { color: 0xff4500 }, // Electronic
  { color: 0xffffff }  // Mainstream
];

// --- CREATE ORBS ---
const orbs = [];
const geometry = new THREE.SphereGeometry(2, 64, 64);

genres.forEach((g, i) => {
  const material = new THREE.MeshBasicMaterial({
    color: g.color,
    transparent: true,
    opacity: 0.15,
    wireframe: true
  });
  const orb = new THREE.Mesh(geometry, material);
  scene.add(orb);
  orbs.push({
    mesh: orb,
    angle: Math.random() * Math.PI * 2,
    radius: 7 + i * 1.5,
    speed: 0.002 + Math.random() * 0.002
  });
});

// --- STARFIELD BACKGROUND ---
const starsGeometry = new THREE.BufferGeometry();
const starCount = 5000;
const positions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 200;
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.8 });
const starField = new THREE.Points(starsGeometry, starMaterial);
scene.add(starField);

// --- ANIMATE ---
function animate() {
  requestAnimationFrame(animate);

  starField.rotation.y += 0.0005;
  starField.rotation.x += 0.0002;

  orbs.forEach((o, i) => {
    o.angle += o.speed;
    o.mesh.position.x = Math.cos(o.angle) * o.radius;
    o.mesh.position.z = Math.sin(o.angle) * o.radius;
    o.mesh.rotation.y += 0.002;
  });

  renderer.render(scene, camera);
}

animate();

// --- HANDLE RESIZE ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
