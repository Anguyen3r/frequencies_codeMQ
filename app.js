// app.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.module.js";

let scene, camera, renderer, bubbles = [], particles = [], smokeParticles = [];

init();
animate();

function init() {
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("canvasWrap").appendChild(renderer.domElement);

  // CAMERA — zoomed out
  const fov = 60;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 2000;
  camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.z = 400; // Increased from ~150 → 400 for more zoom-out

  // LIGHT
  const light = new THREE.PointLight(0xffffff, 2);
  light.position.set(0, 0, 300);
  scene.add(light);

  // BACKGROUND STARS
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 4000;
  const starPositions = [];
  for (let i = 0; i < starCount; i++) {
    const x = (Math.random() - 0.5) * 2000;
    const y = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    starPositions.push(x, y, z);
  }
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1, transparent: true, opacity: 0.7 });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // GENRE BUBBLES (bigger, semi-transparent)
  const colors = [0xff005d, 0x00ffff, 0xfff700, 0x9d00ff, 0x00ff66, 0xff7b00];
  for (let i = 0; i < colors.length; i++) {
    const geometry = new THREE.SphereGeometry(30, 64, 64);
    const material = new THREE.MeshPhongMaterial({
      color: colors[i],
      transparent: true,
      opacity: 0.5,
      shininess: 80,
      emissive: colors[i],
      emissiveIntensity: 0.3
    });
    const bubble = new THREE.Mesh(geometry, material);
    const angle = (i / colors.length) * Math.PI * 2;
    bubble.position.set(Math.cos(angle) * 150, Math.sin(angle) * 100, (Math.random() - 0.5) * 50);
    scene.add(bubble);
    bubbles.push(bubble);

    // STAR DUST RING (counter-rotating)
    const ringGeometry = new THREE.BufferGeometry();
    const ringParticles = 250;
    const ringPositions = [];
    for (let j = 0; j < ringParticles; j++) {
      const theta = (j / ringParticles) * Math.PI * 2;
      const radius = 70 + Math.random() * 20;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius * 0.5;
      const z = (Math.random() - 0.5) * 30;
      ringPositions.push(x, y, z);
    }
    ringGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ringPositions, 3));
    const ringMaterial = new THREE.PointsMaterial({
      color: colors[i],
      size: 2.5,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Points(ringGeometry, ringMaterial);
    bubble.add(ring);
    particles.push({ bubble, ring, direction: i % 2 === 0 ? 1 : -1 });
  }

  // SMOKE / NEBULA LAYER (aurora edges)
  const smokeTexture = new THREE.TextureLoader().load("https://threejs.org/examples/textures/lava/cloud.png");
  const smokeMaterial = new THREE.SpriteMaterial({
    map: smokeTexture,
    color: 0x77aaff,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < 15; i++) {
    const smoke = new THREE.Sprite(smokeMaterial);
    smoke.scale.set(800, 800, 1);
    smoke.position.set(
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 800,
      -500 + Math.random() * 300
    );
    scene.add(smoke);
    smokeParticles.push(smoke);
  }

  // HANDLE WINDOW RESIZE
  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  // Bubble + Ring Movement
  bubbles.forEach((bubble, i) => {
    bubble.rotation.y += 0.005;
    bubble.rotation.x += 0.002;
    const orbitSpeed = 0.001 + i * 0.0003;
    const t = Date.now() * orbitSpeed;
    bubble.position.x = Math.cos(t) * 150;
    bubble.position.y = Math.sin(t) * 100;

    const { ring, direction } = particles[i];
    ring.rotation.z += 0.005 * direction;
  });

  // Smoke Movement (gentle wave)
  smokeParticles.forEach((smoke, i) => {
    smoke.rotation.z += 0.001 * (i % 2 === 0 ? 1 : -1);
  });

  renderer.render(scene, camera);
}
