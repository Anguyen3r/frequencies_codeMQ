// Get container
const container = document.getElementById("canvasWrap");
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.z = 280;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

// Genre colors
const genres = [
  { name: "Hard/Techno", color: 0xff004c },
  { name: "House", color: 0xffa500 },
  { name: "Drum & Bass", color: 0x00bfff },
  { name: "Dubstep", color: 0x8a2be2 },
  { name: "Electronic", color: 0x00ffcc },
  { name: "Mainstream", color: 0xffff00 },
];

// Bubble group
const bubbles = [];
const stardustGroups = [];

const bubbleGeometry = new THREE.SphereGeometry(30, 64, 64);

genres.forEach((genre, i) => {
  const bubbleMaterial = new THREE.MeshPhysicalMaterial({
    color: genre.color,
    metalness: 0.4,
    roughness: 0.2,
    transmission: 0.8,
    transparent: true,
    opacity: 0.85,
    emissive: genre.color,
    emissiveIntensity: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
  const angle = (i / genres.length) * Math.PI * 2;
  bubble.position.set(Math.cos(angle) * 100, Math.sin(angle) * 80, 0);
  scene.add(bubble);
  bubbles.push(bubble);

  // Stardust ring
  const starCount = 600;
  const stardustGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const ringRadius = 65;

  for (let j = 0; j < starCount; j++) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.random() * Math.PI;
    const x = ringRadius * Math.cos(theta);
    const y = (Math.random() - 0.5) * 15;
    const z = ringRadius * Math.sin(theta);
    positions.push(x, y, z);
    colors.push(1, 1, 1);
  }

  stardustGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  stardustGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const stardustMaterial = new THREE.PointsMaterial({
    size: 3.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });

  const stardust = new THREE.Points(stardustGeometry, stardustMaterial);
  bubble.add(stardust);
  stardustGroups.push(stardust);
});

// Background stars
const starGeometry = new THREE.BufferGeometry();
const starCount = 2000;
const starPositions = [];
for (let i = 0; i < starCount; i++) {
  const x = (Math.random() - 0.5) * 2000;
  const y = (Math.random() - 0.5) * 2000;
  const z = (Math.random() - 0.5) * 2000;
  starPositions.push(x, y, z);
}
starGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starPositions, 3)
);
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 2,
  transparent: true,
  opacity: 0.7,
});
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Animate
function animate() {
  requestAnimationFrame(animate);

  // Orbit and pulse movement
  const time = Date.now() * 0.0002;

  bubbles.forEach((bubble, i) => {
    const radius = 110 + 15 * Math.sin(time + i);
    const angle = time + (i * Math.PI * 2) / genres.length;
    bubble.position.x = Math.cos(angle) * radius;
    bubble.position.y = Math.sin(angle) * radius * 0.8;

    // Opposite stardust rotation
    stardustGroups[i].rotation.y -= 0.002;
  });

  stars.rotation.y += 0.0003;
  renderer.render(scene, camera);
}
animate();

// Responsive resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
