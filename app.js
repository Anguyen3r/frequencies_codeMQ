import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let particles = [];
let smokeParticles = [];
const particleCount = 800;
const starCount = 2000;

// Initialize scene
scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000010, 0.001);

// Camera
camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 30000);
camera.position.z = 1200; // <-- zoomed out

// Renderer
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

// Controls
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// LIGHT
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(100, 200, 300);
scene.add(pointLight);

// STARFIELD BACKGROUND
const starGeometry = new THREE.BufferGeometry();
const starVertices = [];
for (let i = 0; i < starCount; i++) {
  starVertices.push(
    (Math.random() - 0.5) * 8000,
    (Math.random() - 0.5) * 8000,
    (Math.random() - 0.5) * 8000
  );
}
starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 3, transparent: true, opacity: 0.7 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// GAS SMOKE AROUND EDGES
const loader = new THREE.TextureLoader();
const smokeTexture = loader.load("https://threejs.org/examples/textures/sprites/smoke.png");

for (let i = 0; i < 20; i++) {
  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(`hsl(${Math.random() * 360}, 80%, 60%)`),
    map: smokeTexture,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  const geometry = new THREE.PlaneGeometry(5000, 5000);
  const smoke = new THREE.Mesh(geometry, material);
  smoke.position.set((Math.random() - 0.5) * 8000, (Math.random() - 0.5) * 8000, -2000);
  smoke.rotation.z = Math.random() * 360;
  scene.add(smoke);
  smokeParticles.push(smoke);
}

// MAIN PARTICLES (ORB RINGS)
const geometry = new THREE.SphereGeometry(3, 32, 32);
for (let i = 0; i < particleCount; i++) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(`hsl(${Math.random() * 360}, 80%, 60%)`),
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
  });
  const particle = new THREE.Mesh(geometry, material);

  const radius = 500 + Math.random() * 500;
  const theta = Math.random() * Math.PI * 2;
  const y = (Math.random() - 0.5) * 800;
  particle.position.set(radius * Math.cos(theta), y, radius * Math.sin(theta));

  scene.add(particle);
  particles.push({ mesh: particle, radius, theta, y });
}

// Animation
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Rotate stars slowly for depth
  stars.rotation.y += 0.0005;

  // Rotate smoke aurora around the edges
  smokeParticles.forEach((smoke, i) => {
    smoke.rotation.z += 0.0002;
    smoke.material.opacity = 0.08 + Math.sin(Date.now() * 0.0005 + i) * 0.02;
  });

  // Rotate orbs in opposite directions for variation
  particles.forEach((p, i) => {
    const direction = i % 2 === 0 ? 1 : -1;
    p.theta += 0.0008 * direction;
    p.mesh.position.x = p.radius * Math.cos(p.theta);
    p.mesh.position.z = p.radius * Math.sin(p.theta);
  });

  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
