// --- app.js ---
// Three.js scene setup
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.z = 80;

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(50, 50, 50);
scene.add(pointLight);

// Genre colors
const genres = [
  { name: "Hard/Techno", color: 0xff3366 },
  { name: "House", color: 0xffcc33 },
  { name: "Drum & Bass", color: 0x33ffcc },
  { name: "Dubstep", color: 0x6633ff },
  { name: "Electronic", color: 0x33aaff },
  { name: "Mainstream", color: 0xff66cc }
];

// Bubble + ring group
let groups = [];

genres.forEach((genre, i) => {
  const group = new THREE.Group();

  // Bubble (transparent + glow)
  const bubbleGeo = new THREE.SphereGeometry(5, 64, 64);
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: genre.color,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    metalness: 0.9,
    emissive: genre.color,
    emissiveIntensity: 0.3
  });
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  group.add(bubble);

  // Stardust ring
  const ringParticles = new THREE.Group();
  const particleCount = 400;
  for (let p = 0; p < particleCount; p++) {
    const angle = (p / particleCount) * Math.PI * 2;
    const radius = 7 + Math.random() * 1.5;
    const particleGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.25, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({
      color: genre.color,
      transparent: true,
      opacity: 0.6
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 1);
    ringParticles.add(particle);
  }
  group.add(ringParticles);

  group.position.x = Math.cos((i / genres.length) * Math.PI * 2) * 20;
  group.position.y = Math.sin((i / genres.length) * Math.PI * 2) * 10;
  scene.add(group);
  groups.push({ group, bubble, ringParticles, angle: Math.random() * Math.PI * 2, speed: 0.003 + Math.random() * 0.002 });
});

// Background stars (deep space feel)
const bgGeo = new THREE.BufferGeometry();
const bgCount = 1500;
const bgPositions = [];
for (let i = 0; i < bgCount; i++) {
  const r = 300;
  bgPositions.push((Math.random() - 0.5) * r, (Math.random() - 0.5) * r, (Math.random() - 0.5) * r);
}
bgGeo.setAttribute("position", new THREE.Float32BufferAttribute(bgPositions, 3));
const bgMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8 });
const bgStars = new THREE.Points(bgGeo, bgMat);
scene.add(bgStars);

// Prompt logic (click detection)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(groups.map(g => g.bubble));
  if (intersects.length > 0) {
    const genre = genres[groups.findIndex(g => g.bubble === intersects[0].object)];
    const artist = prompt(`Enter your favorite artist for ${genre.name}:`);
    if (artist) alert(`You chose ${artist} for ${genre.name}!`);
  }
}
window.addEventListener("click", onClick);

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Move the background slightly to simulate drifting
  bgStars.rotation.x += 0.00015;
  bgStars.rotation.y += 0.0001;

  // Orbit movement for orbs + opposite ring spin
  groups.forEach((obj, i) => {
    obj.angle += obj.speed;
    const r = 25 + Math.sin(Date.now() * 0.0005 + i) * 2;
    obj.group.position.x = Math.cos(obj.angle) * r;
    obj.group.position.y = Math.sin(obj.angle * 0.8) * r * 0.5;
    obj.group.position.z = Math.sin(obj.angle) * 10;

    // Slow rotation
    obj.group.rotation.x += 0.002;
    obj.group.rotation.y += 0.0015;

    // Opposite rotation for ring
    obj.ringParticles.rotation.z -= 0.005;
    obj.ringParticles.rotation.x -= 0.002;
  });

  renderer.render(scene, camera);
}
animate();
