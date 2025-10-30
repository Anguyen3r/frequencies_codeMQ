// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.z = 12;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("canvasWrap").appendChild(renderer.domElement);

// Background starfield
const starsGeometry = new THREE.BufferGeometry();
const starCount = 2000;
const starVertices = [];
for (let i = 0; i < starCount; i++) {
  const x = (Math.random() - 0.5) * 400;
  const y = (Math.random() - 0.5) * 400;
  const z = (Math.random() - 0.5) * 400;
  starVertices.push(x, y, z);
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6 });
const stars = new THREE.Points(starsGeometry, starMaterial);
scene.add(stars);

// Genres and colors
const genres = [
  { name: "Hard/Techno", color: 0xff006e },
  { name: "House", color: 0xffbe0b },
  { name: "Drum & Bass", color: 0x3a86ff },
  { name: "Dubstep", color: 0x8338ec },
  { name: "Electronic", color: 0xfb5607 },
  { name: "Mainstream", color: 0xffd60a },
];

const orbs = [];
const orbitRadius = 6;

genres.forEach((g, i) => {
  const geometry = new THREE.SphereGeometry(1.3, 64, 64);
  const material = new THREE.MeshPhysicalMaterial({
    color: g.color,
    transparent: true,
    opacity: 0.6,
    roughness: 0.2,
    metalness: 0.7,
    emissive: new THREE.Color(g.color).multiplyScalar(0.5),
    emissiveIntensity: 1.5,
  });
  const orb = new THREE.Mesh(geometry, material);
  orb.userData = { angle: (i / genres.length) * Math.PI * 2, speed: 0.001 + Math.random() * 0.002 };
  orb.position.x = Math.cos(orb.userData.angle) * orbitRadius;
  orb.position.y = Math.sin(orb.userData.angle) * orbitRadius;
  scene.add(orb);
  orbs.push(orb);

  // Dust particles
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 100;
  const dustVertices = [];
  for (let j = 0; j < dustCount; j++) {
    const dx = (Math.random() - 0.5) * 3;
    const dy = (Math.random() - 0.5) * 3;
    const dz = (Math.random() - 0.5) * 3;
    dustVertices.push(dx, dy, dz);
  }
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustVertices, 3));
  const dustMat = new THREE.PointsMaterial({
    color: g.color,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  orb.add(dust);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  stars.rotation.y += 0.0005;
  stars.rotation.x += 0.0003;

  orbs.forEach((orb, i) => {
    orb.userData.angle += orb.userData.speed;
    orb.position.x = Math.cos(orb.userData.angle) * orbitRadius;
    orb.position.y = Math.sin(orb.userData.angle) * orbitRadius * 0.8;
    orb.rotation.y += 0.005;
    orb.rotation.x += 0.003;
  });

  renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
